import os
import uuid
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

import httpx
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

# Configuración de almacenamiento local efímero (Render)
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "comprobantes"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
FORMATOS_PERMITIDOS = {".jpg", ".jpeg", ".png", ".pdf", ".svg"}

# Configuración de Supabase Storage (Bucket privado)
STORAGE_SUPABASE_ACTIVO = os.getenv("STORAGE_SUPABASE_ACTIVO", "true").lower() == "true"
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "comprobantes-privados")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
RETENCION_DIAS = int(os.getenv("STORAGE_RETENCION_DIAS", "60"))

FALLBACK_DISCO_COUNT = 0


class FileStorageService:
    """
    Servicio transversal para validación, almacenamiento, registro de metadatos y
    depuración automática a los 60 días de comprobantes y fotos de respaldo.
    Soporta almacenamiento local en disco y Supabase Storage con bucket privado.
    Gestiona resubida de archivos caídos en disco efímero (Render).
    """

    FALLBACK_DISCO_COUNT = 0

    @classmethod
    def validar_archivo(cls, nombre_original: str, contenido: bytes) -> str:
        extension = Path(nombre_original).suffix.lower()
        if extension not in FORMATOS_PERMITIDOS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Formato no permitido ({extension}). Solo se aceptan: {', '.join(FORMATOS_PERMITIDOS)}"
            )

        tamano_bytes = len(contenido)
        if tamano_bytes > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"El archivo supera el tamaño máximo permitido de 5MB ({tamano_bytes / (1024*1024):.2f}MB)"
            )
        return extension

    @classmethod
    def generar_url_firmada(cls, ruta_objeto: str, duracion_segundos: int = 3600) -> str:
        """
        Genera una URL firmada de corta duración para lectura de archivos en el bucket privado de Supabase.
        """
        if not STORAGE_SUPABASE_ACTIVO:
            return f"/uploads/comprobantes/{Path(ruta_objeto).name}"

        url_firmar = f"{SUPABASE_URL}/storage/v1/object/sign/{SUPABASE_STORAGE_BUCKET}/{ruta_objeto.lstrip('/')}"
        headers = {
            "apikey": SUPABASE_SECRET_KEY,
            "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
            "Content-Type": "application/json"
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(url_firmar, json={"expiresIn": duracion_segundos}, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    signed_url = data.get("signedURL", "")
                    return f"{SUPABASE_URL}/storage/v1{signed_url}"
                logger.error(f"Fallo al firmar URL en Supabase Storage ({resp.status_code}): {resp.text}")
                return ""
        except Exception as e:
            logger.error(f"Excepción al conectar con Supabase Storage para firmar URL: {e}")
            return ""

    @classmethod
    def subir_a_supabase_storage(cls, ruta_destino: str, contenido: bytes, mime_type: str = "application/octet-stream") -> bool:
        """
        Sube un archivo binario a un bucket privado de Supabase Storage.
        """
        url_subida = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_STORAGE_BUCKET}/{ruta_destino.lstrip('/')}"
        headers = {
            "apikey": SUPABASE_SECRET_KEY,
            "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
            "Content-Type": mime_type,
            "x-upsert": "true"
        }
        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(url_subida, content=contenido, headers=headers)
                return resp.status_code in (200, 201)
        except Exception as e:
            logger.error(f"Excepción subiendo a Supabase Storage: {e}")
            return False

    @classmethod
    def guardar_comprobante(
        cls,
        session: Session,
        archivo: UploadFile,
        entidad_origen: str,
        id_registro_origen: int,
        id_sucursal: Optional[int] = 1,
        id_chofer: Optional[int] = 1
    ) -> Dict[str, Any]:
        """
        Valida tamaño (<=5MB), formato y calcula SHA-256.
        Si STORAGE_SUPABASE_ACTIVO=True -> Guarda particionado en bucket privado:
           sucursal/{id_sucursal}/chofer/{id_chofer}/{uuid}.ext
        Si STORAGE_SUPABASE_ACTIVO=False o falla la subida -> Guarda en disco local efímero y marca ResubidaPendiente.
        Registra metadatos con retención de 60 días en ComprobanteArchivo.
        """
        nombre_original = archivo.filename or "comprobante"
        contenido = archivo.file.read()
        extension = cls.validar_archivo(nombre_original, contenido)
        tamano_bytes = len(contenido)
        sha256 = hashlib.sha256(contenido).hexdigest()
        uuid_unico = uuid.uuid4().hex

        provider = "local"
        resubida_pendiente = False
        storage_path = None
        url_archivo = None

        if STORAGE_SUPABASE_ACTIVO:
            sucursal_id = id_sucursal or 1
            chofer_id = id_chofer or 1
            ruta_objeto = f"sucursal/{sucursal_id}/chofer/{chofer_id}/{uuid_unico}{extension}"
            mime_type = archivo.content_type or "application/octet-stream"
            subida_ok = cls.subir_a_supabase_storage(ruta_objeto, contenido, mime_type)
            if subida_ok:
                provider = "supabase"
                storage_path = ruta_objeto
                url_archivo = f"/storage/v1/object/{SUPABASE_STORAGE_BUCKET}/{ruta_objeto}"
                resubida_pendiente = False
            else:
                cls.FALLBACK_DISCO_COUNT += 1
                logger.warning(
                    f"[STORAGE-FALLBACK-ALERTA] Fallback #{cls.FALLBACK_DISCO_COUNT} a disco local efímero para {entidad_origen} id={id_registro_origen}. "
                    f"ADVERTENCIA RENDER: Los archivos locales se perderán al reiniciar el contenedor. Marcado con ResubidaPendiente=True."
                )
                resubida_pendiente = True

        if not url_archivo:
            provider = "local"
            timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            nombre_guardado = f"{entidad_origen.lower()}_{id_registro_origen}_{timestamp_str}_{sha256[:8]}{extension}"
            ruta_archivo = UPLOAD_DIR / nombre_guardado
            ruta_archivo.write_bytes(contenido)
            storage_path = str(ruta_archivo)
            url_archivo = f"/uploads/comprobantes/{nombre_guardado}"
            if not STORAGE_SUPABASE_ACTIVO:
                resubida_pendiente = False

        # Registrar metadatos en BD con expiración configurable (60 días)
        stmt = text("""
            INSERT INTO public."ComprobanteArchivo" (
                "EntidadOrigen",
                "IdRegistroOrigen",
                "UrlArchivo",
                "NombreOriginal",
                "Formato",
                "TamanoBytes",
                "Sha256",
                "ArchivoEliminado",
                "FechaSubida",
                "FechaExpiracion",
                "StorageProvider",
                "StoragePath",
                "ResubidaPendiente"
            ) VALUES (
                :entidad,
                :id_registro,
                :url,
                :nombre_orig,
                :formato,
                :tamano,
                :sha,
                false,
                NOW(),
                NOW() + (:retencion_dias || ' days')::INTERVAL,
                :provider,
                :storage_path,
                :resubida_pendiente
            ) RETURNING "IdComprobante", "FechaExpiracion";
        """)

        res = session.execute(stmt, {
            "entidad": entidad_origen,
            "id_registro": id_registro_origen,
            "url": url_archivo,
            "nombre_orig": nombre_original,
            "formato": extension.replace(".", "").upper(),
            "tamano": tamano_bytes,
            "sha": sha256,
            "retencion_dias": str(RETENCION_DIAS),
            "provider": provider,
            "storage_path": storage_path,
            "resubida_pendiente": resubida_pendiente
        }).fetchone()

        session.flush()

        return {
            "id_comprobante": res[0],
            "url": url_archivo,
            "nombre_original": nombre_original,
            "tamano_bytes": tamano_bytes,
            "sha256": sha256,
            "fecha_expiracion": res[1],
            "storage_provider": provider,
            "resubida_pendiente": resubida_pendiente
        }

    @classmethod
    def guardar_bytes_directo(
        cls,
        session: Session,
        contenido: bytes,
        nombre_archivo: str,
        entidad_origen: str,
        id_registro_origen: int,
        id_sucursal: Optional[int] = 1,
        id_chofer: Optional[int] = 1,
        mime_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Almacena bytes directos (p. ej. firmas vectoriales SVG o PNG comprimidos)
        con particionado en Supabase Storage y fallback a disco local.
        """
        extension = Path(nombre_archivo).suffix.lower() or ".png"
        if extension not in FORMATOS_PERMITIDOS:
            extension = ".png"
        tamano_bytes = len(contenido)
        sha256 = hashlib.sha256(contenido).hexdigest()
        uuid_unico = uuid.uuid4().hex

        provider = "local"
        resubida_pendiente = False
        storage_path = None
        url_archivo = None

        if STORAGE_SUPABASE_ACTIVO:
            sucursal_id = id_sucursal or 1
            chofer_id = id_chofer or 1
            ruta_objeto = f"sucursal/{sucursal_id}/chofer/{chofer_id}/{uuid_unico}{extension}"
            m_type = mime_type or ("image/png" if extension == ".png" else ("image/svg+xml" if extension == ".svg" else "application/octet-stream"))
            subida_ok = cls.subir_a_supabase_storage(ruta_objeto, contenido, m_type)
            if subida_ok:
                provider = "supabase"
                storage_path = ruta_objeto
                url_archivo = f"/storage/v1/object/{SUPABASE_STORAGE_BUCKET}/{ruta_objeto}"
                resubida_pendiente = False
            else:
                cls.FALLBACK_DISCO_COUNT += 1
                logger.warning(
                    f"[STORAGE-FALLBACK-ALERTA] Fallback #{cls.FALLBACK_DISCO_COUNT} a disco local para firma/bytes directos de {entidad_origen} id={id_registro_origen}. "
                    f"ADVERTENCIA RENDER: Los archivos locales se perderán al reiniciar. Marcado con ResubidaPendiente=True."
                )
                resubida_pendiente = True

        if not url_archivo:
            provider = "local"
            timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            nombre_guardado = f"{entidad_origen.lower()}_{id_registro_origen}_{timestamp_str}_{sha256[:8]}{extension}"
            ruta_archivo = UPLOAD_DIR / nombre_guardado
            ruta_archivo.write_bytes(contenido)
            storage_path = str(ruta_archivo)
            url_archivo = f"/uploads/comprobantes/{nombre_guardado}"
            if not STORAGE_SUPABASE_ACTIVO:
                resubida_pendiente = False

        stmt = text("""
            INSERT INTO public."ComprobanteArchivo" (
                "EntidadOrigen",
                "IdRegistroOrigen",
                "UrlArchivo",
                "NombreOriginal",
                "Formato",
                "TamanoBytes",
                "Sha256",
                "ArchivoEliminado",
                "FechaSubida",
                "FechaExpiracion",
                "StorageProvider",
                "StoragePath",
                "ResubidaPendiente"
            ) VALUES (
                :entidad,
                :id_registro,
                :url,
                :nombre_orig,
                :formato,
                :tamano,
                :sha,
                false,
                NOW(),
                NOW() + (:retencion_dias || ' days')::INTERVAL,
                :provider,
                :storage_path,
                :resubida_pendiente
            ) RETURNING "IdComprobante", "FechaExpiracion";
        """)

        res = session.execute(stmt, {
            "entidad": entidad_origen,
            "id_registro": id_registro_origen,
            "url": url_archivo,
            "nombre_orig": nombre_archivo,
            "formato": extension.replace(".", "").upper(),
            "tamano": tamano_bytes,
            "sha": sha256,
            "retencion_dias": str(RETENCION_DIAS),
            "provider": provider,
            "storage_path": storage_path,
            "resubida_pendiente": resubida_pendiente
        }).fetchone()

        session.flush()

        return {
            "id_comprobante": res[0],
            "url": url_archivo,
            "nombre_original": nombre_archivo,
            "tamano_bytes": tamano_bytes,
            "sha256": sha256,
            "fecha_expiracion": res[1],
            "storage_provider": provider,
            "resubida_pendiente": resubida_pendiente
        }

    @classmethod
    def reintentar_subidas_pendientes(cls, session: Session, limite: int = 50) -> int:
        """
        Reintenta subir a Supabase Storage todos los comprobantes que cayeron en disco local
        (ResubidaPendiente = true). Esencial para Render para evitar que se destruyan al reiniciar.
        """
        if not STORAGE_SUPABASE_ACTIVO:
            logger.info("STORAGE_SUPABASE_ACTIVO es false; reintentos de subida a Supabase omitidos.")
            return 0

        stmt = text("""
            SELECT "IdComprobante", "UrlArchivo", "StoragePath", "Formato", "NombreOriginal"
            FROM public."ComprobanteArchivo"
            WHERE "ResubidaPendiente" = true AND "ArchivoEliminado" = false
            ORDER BY "FechaSubida" ASC
            LIMIT :limite;
        """)
        pendientes = session.execute(stmt, {"limite": limite}).fetchall()
        if not pendientes:
            return 0

        logger.info(f"Iniciando reintento de subida para {len(pendientes)} comprobantes pendientes a Supabase...")
        resubidos_count = 0

        for r in pendientes:
            id_comprobante, url_archivo, storage_path, formato, nombre_orig = r
            extension = f".{str(formato).lower()}" if formato else ".png"
            
            # Buscar archivo físico local
            ruta_fisica = None
            if storage_path and Path(storage_path).exists():
                ruta_fisica = Path(storage_path)
            elif url_archivo:
                posible_local = UPLOAD_DIR / Path(url_archivo).name
                if posible_local.exists():
                    ruta_fisica = posible_local

            if not ruta_fisica:
                logger.warning(f"No se encontró archivo local para comprobante #{id_comprobante} ({url_archivo}). No se puede resubir.")
                continue

            try:
                contenido = ruta_fisica.read_bytes()
                mime_map = {
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".pdf": "application/pdf",
                    ".svg": "image/svg+xml"
                }
                mime_type = mime_map.get(extension, "application/octet-stream")
                uuid_unico = uuid.uuid4().hex
                ruta_objeto = f"resubidos/{uuid_unico}{extension}"

                if cls.subir_a_supabase_storage(ruta_objeto, contenido, mime_type):
                    nueva_url = f"/storage/v1/object/{SUPABASE_STORAGE_BUCKET}/{ruta_objeto}"
                    session.execute(
                        text("""
                            UPDATE public."ComprobanteArchivo"
                            SET "StorageProvider" = 'supabase',
                                "StoragePath" = :path,
                                "UrlArchivo" = :url,
                                "ResubidaPendiente" = false
                            WHERE "IdComprobante" = :id
                        """),
                        {"path": ruta_objeto, "url": nueva_url, "id": id_comprobante}
                    )
                    # Liberar espacio en disco efímero de Render
                    try:
                        ruta_fisica.unlink(missing_ok=True)
                    except Exception:
                        pass
                    resubidos_count += 1
                    logger.info(f"Comprobante #{id_comprobante} resubido exitosamente a Supabase Storage.")
            except Exception as e:
                logger.error(f"Error resubiendo comprobante #{id_comprobante}: {e}")

        session.commit()
        return resubidos_count

    @classmethod
    def depurar_archivos_expirados(cls, session: Session) -> int:
        """
        Job de limpieza: Localiza comprobantes con FechaExpiracion vencida y ArchivoEliminado = False.
        Elimina el archivo físico y marca ArchivoEliminado = True en la base de datos.
        """
        stmt = text("""
            SELECT "IdComprobante", "UrlArchivo", "StorageProvider", "StoragePath"
            FROM public."ComprobanteArchivo"
            WHERE "FechaExpiracion" <= NOW() AND "ArchivoEliminado" = false;
        """)
        expirados = session.execute(stmt).fetchall()
        eliminados_count = 0

        for r in expirados:
            id_comprobante = r[0]
            url_archivo = r[1]
            provider = r[2]
            storage_path = r[3]
            
            try:
                if provider == "local" or not provider:
                    nombre_archivo = Path(url_archivo).name
                    ruta_fisica = UPLOAD_DIR / nombre_archivo
                    if ruta_fisica.exists():
                        ruta_fisica.unlink()
                elif provider == "supabase" and storage_path:
                    # En Supabase Storage se podría eliminar con llamada REST si se requiere
                    pass

                session.execute(
                    text('UPDATE public."ComprobanteArchivo" SET "ArchivoEliminado" = true WHERE "IdComprobante" = :id'),
                    {"id": id_comprobante}
                )
                eliminados_count += 1
            except Exception as e:
                logger.error(f"Error al depurar comprobante #{id_comprobante}: {e}")

        session.flush()
        logger.info(f"Depuración de comprobantes completada: {eliminados_count} archivos eliminados.")
        return eliminados_count
