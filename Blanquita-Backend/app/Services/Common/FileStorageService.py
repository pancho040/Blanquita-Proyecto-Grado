import os
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

# Configuración de almacenamiento
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "comprobantes"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
FORMATOS_PERMITIDOS = {".jpg", ".jpeg", ".png", ".pdf"}


class FileStorageService:
    """
    Servicio transversal para validación, almacenamiento, registro de metadatos y
    depuración automática a los 60 días de comprobantes y fotos de respaldo.
    """

    @staticmethod
    def guardar_comprobante(
        session: Session,
        archivo: UploadFile,
        entidad_origen: str,
        id_registro_origen: int
    ) -> Dict[str, Any]:
        """
        Valida tamaño, formato y calcula SHA-256. Almacena en disco y registra en ComprobanteArchivo.
        """
        nombre_original = archivo.filename or "comprobante"
        extension = Path(nombre_original).suffix.lower()

        if extension not in FORMATOS_PERMITIDOS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Formato no permitido ({extension}). Solo se aceptan: {', '.join(FORMATOS_PERMITIDOS)}"
            )

        contenido = archivo.file.read()
        tamano_bytes = len(contenido)

        if tamano_bytes > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"El archivo supera el tamaño máximo permitido de 5MB ({tamano_bytes / (1024*1024):.2f}MB)"
            )

        # Cálculo de hash SHA-256
        sha256 = hashlib.sha256(contenido).hexdigest()

        # Generar nombre único para evitar colisiones
        timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        nombre_guardado = f"{entidad_origen.lower()}_{id_registro_origen}_{timestamp_str}_{sha256[:8]}{extension}"
        ruta_archivo = UPLOAD_DIR / nombre_guardado

        # Guardar en disco
        ruta_archivo.write_bytes(contenido)
        url_archivo = f"/uploads/comprobantes/{nombre_guardado}"

        # Registrar metadatos en BD con expiración a 60 días
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
                "FechaExpiracion"
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
                NOW() + INTERVAL '60 days'
            ) RETURNING "IdComprobante", "FechaExpiracion";
        """)

        res = session.execute(stmt, {
            "entidad": entidad_origen,
            "id_registro": id_registro_origen,
            "url": url_archivo,
            "nombre_orig": nombre_original,
            "formato": extension.replace(".", "").upper(),
            "tamano": tamano_bytes,
            "sha": sha256
        }).fetchone()

        return {
            "id_comprobante": res[0],
            "url": url_archivo,
            "nombre_original": nombre_original,
            "tamano_bytes": tamano_bytes,
            "sha256": sha256,
            "fecha_expiracion": res[1]
        }

    @staticmethod
    def depurar_archivos_expirados(session: Session) -> int:
        """
        Job de limpieza: Localiza comprobantes con FechaExpiracion vencida y ArchivoEliminado = False.
        Elimina el archivo físico del disco y marca ArchivoEliminado = True en la base de datos.
        """
        stmt = text("""
            SELECT "IdComprobante", "UrlArchivo"
            FROM public."ComprobanteArchivo"
            WHERE "FechaExpiracion" <= NOW() AND "ArchivoEliminado" = false;
        """)
        expirados = session.execute(stmt).fetchall()
        eliminados_count = 0

        for r in expirados:
            id_comprobante = r[0]
            url_archivo = r[1]
            nombre_archivo = Path(url_archivo).name
            ruta_fisica = UPLOAD_DIR / nombre_archivo

            try:
                if ruta_fisica.exists():
                    ruta_fisica.unlink()
                
                session.execute(
                    text('UPDATE public."ComprobanteArchivo" SET "ArchivoEliminado" = true WHERE "IdComprobante" = :id'),
                    {"id": id_comprobante}
                )
                eliminados_count += 1
            except Exception as e:
                logger.error(f"Error al eliminar archivo físico {ruta_fisica}: {e}")

        session.commit()
        logger.info(f"Depuración de comprobantes completada: {eliminados_count} archivos físicos eliminados.")
        return eliminados_count
