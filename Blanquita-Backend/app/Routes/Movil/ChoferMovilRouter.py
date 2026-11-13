"""
Router del Módulo Chofer Móvil (Fase 2)
Sistema ERP Papelera Blanquita

Rutas expuestas bajo /api/movil/v1/chofer/*:
- GET  /hoja-ruta/activa: Obtiene la hoja de ruta y paradas asignadas para el chofer autenticado.
- GET  /mi-inventario: Stock en camión (cargado vs entregado vs saldo) con desglose de promociones/bandeo.
- POST /entregar: Entrega física total o parcial con firma digital, control de bandeo y alerta de revalorización.
- POST /cobrar: Cobro simple o mixto (Efectivo, QR, Transferencia, Crédito) con comprobante obligatorio y estado PENDIENTE_APROBACION.
- POST /no-entrega: Registro de fallos de entrega georreferenciados con motivo.
- POST /cierre-turno: Arqueo financiero desglosado, cuadre físico de camión, mermas/faltantes y firma de conformidad.
- POST /sincronizar-batch: Procesamiento por lote de transacciones offline con idempotencia granular.
- POST /subir-archivo: Subida de fotos y comprobantes vinculados a ComprobanteArchivo (<= 5MB, depuración 60 días).
"""

import os
import uuid
import logging
from datetime import datetime, date, timezone, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, Request, Header, HTTPException, status, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

ENTORNO_PRUEBAS_HABILITADO = (
    os.getenv("ENTORNO_PRUEBAS", "true").lower() in ("true", "1", "test")
    and os.getenv("PRODUCCION", "false").lower() != "true"
)

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL
from app.Middleware.Idempotencia import IdempotenciaService
from app.Services.Logistica.RutaService import RutaService
from app.Services.Contabilidad.CuentasCobrarService import CuentasCobrarService
from app.Services.Logistica.InventarioComercialService import InventarioComercialService
from app.Services.Common.FileStorageService import FileStorageService
from app.Services.Logistica.FlotaWebSocketManager import flota_ws_manager
from app.Routes.Logistica.ChoferRouter import _validar_pertenencia_pedido_chofer, ROLES_CHOFER_OPERATIVO
from app.Models.Movil.MovilModel import MovilResponse
from app.Models.Movil.ChoferMovilModel import (
    EntregaMovilRequest,
    CobroMovilRequest,
    NoEntregaMovilRequest,
    CierreTurnoMovilRequest,
    ClienteMovilRequest,
    ResumenInventarioChoferDTO,
    ItemInventarioCamionDTO,
    SolicitarCargaRequest,
    ClienteEnRutaRequest,
    DatosClienteEnRutaDTO
)
from app.Models.Contabilidad.CuentasCobrarModel import (
    AbonoCuentaCobrarCrear,
    CierreTurnoChoferRequest
)

ChoferMovilRouter = APIRouter(prefix="/chofer", tags=["Móvil - Choferes (Fase 2)"])


def _obtener_request_id(request: Request) -> str:
    return request.headers.get("x-request-id") or str(uuid.uuid4())


def _obtener_nombre_sucursal(db: Session, id_sucursal: Optional[int]) -> str:
    if not id_sucursal:
        return "Sucursal Central Sucre"
    nombre = db.execute(
        text('SELECT nombre FROM public.sucursales WHERE id = :id LIMIT 1;'),
        {"id": id_sucursal}
    ).scalar()
    return nombre or f"Sucursal {id_sucursal}"


def _validar_gatekeeper_carga_camion(db: Session, id_pedido: Optional[int], uid: int):
    """
    Gatekeeper de Carga de Camión:
    Mientras la asignación del chofer esté en PENDIENTE_CARGA, CARGA_SOLICITADA,
    CARGA_OBSERVADA o CARGA_RECHAZADA, devolver HTTP 403 bloqueando la operación en ruta.
    """
    row = None
    if id_pedido:
        sql = text("""
            SELECT ar."IdAsignacionRuta", COALESCE(ar."estado_operativo", 'PENDIENTE_CARGA') AS estado_operativo
            FROM public."Pedido" p
            JOIN public."AsignacionRuta" ar ON p."IdAsignacionRuta" = ar."IdAsignacionRuta"
            WHERE p."IdPedido" = :id_pedido AND ar."IdUsuarioRepartidor" = :uid;
        """)
        row = db.execute(sql, {"id_pedido": id_pedido, "uid": uid}).fetchone()

        if not row:
            # Si el pedido existe pero pertenece a otra asignación/chofer, dejamos que el endpoint maneje el 404
            ped_ajeno = db.execute(text("""
                SELECT "IdPedido" FROM public."Pedido" WHERE "IdPedido" = :pid;
            """), {"pid": id_pedido}).fetchone()
            if ped_ajeno:
                return

    if not row:
        sql_asig = text("""
            SELECT "IdAsignacionRuta", COALESCE("estado_operativo", 'PENDIENTE_CARGA') AS estado_operativo
            FROM public."AsignacionRuta"
            WHERE "IdUsuarioRepartidor" = :uid
              AND "FechaAsignacion" = CURRENT_DATE
              AND "Estado" NOT IN ('Completada', 'Cancelada', 'Finalizada')
            ORDER BY 
                CASE 
                    WHEN UPPER(COALESCE("estado_operativo", 'PENDIENTE_CARGA')) IN ('APROBADA_EN_RUTA', 'EN_RUTA') THEN 1
                    WHEN UPPER(COALESCE("estado_operativo", 'PENDIENTE_CARGA')) = 'CARGA_SOLICITADA' THEN 2
                    WHEN UPPER(COALESCE("estado_operativo", 'PENDIENTE_CARGA')) IN ('OBSERVADA', 'RECHAZADA', 'CARGA_OBSERVADA', 'CARGA_RECHAZADA') THEN 3
                    WHEN UPPER(COALESCE("estado_operativo", 'PENDIENTE_CARGA')) = 'PENDIENTE_CARGA' THEN 4
                    ELSE 5
                END ASC,
                "IdAsignacionRuta" DESC LIMIT 1;
        """)
        row = db.execute(sql_asig, {"uid": uid}).fetchone()

    if row:
        estado_op = str(row.estado_operativo or "").strip().upper()
        if estado_op in ("PENDIENTE_CARGA", "CARGA_SOLICITADA", "CARGA_OBSERVADA", "CARGA_RECHAZADA", "OBSERVADA", "RECHAZADA"):
            logger.warning(f"[GATEKEEPER BLOQUEO 403] Chofer {uid} intentó operar pero asignación está en {estado_op}")
            if estado_op in ("CARGA_OBSERVADA", "OBSERVADA"):
                detalle_msg = "La carga de tu camión ha sido observada en Web. Contacta a tu supervisor."
            elif estado_op in ("CARGA_RECHAZADA", "RECHAZADA"):
                detalle_msg = "La carga de tu camión ha sido rechazada en Web."
            else:
                detalle_msg = "La carga de tu camión aún no fue aprobada en Web"
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detalle_msg
            )



def _verificar_idempotencia_escritura(
    db: Session,
    uid: int,
    endpoint: str,
    x_idempotency_key: Optional[str],
    cuerpo_bytes: bytes
):
    if not x_idempotency_key:
        msg = "La cabecera X-Idempotency-Key (UUID v4) es obligatoria para toda operación de escritura móvil."
        logger.warning(f"[_verificar_idempotencia_escritura RECHAZADO 400] {msg} | Endpoint: {endpoint} | Chofer: {uid}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )
    key_limpia = str(x_idempotency_key).strip()
    try:
        uuid_obj = uuid.UUID(key_limpia)
    except (ValueError, AttributeError):
        msg = f"La cabecera X-Idempotency-Key debe ser un UUID v4 válido (recibido: '{x_idempotency_key}')."
        logger.warning(f"[_verificar_idempotencia_escritura RECHAZADO 400] {msg} | Endpoint: {endpoint} | Chofer: {uid}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )

    hash_cuerpo, respuesta_cacheada = IdempotenciaService.verificar_y_recuperar(
        session=db,
        usuario_id=uid,
        clave=str(uuid_obj),
        cuerpo_bytes=cuerpo_bytes,
        endpoint=endpoint
    )
    return hash_cuerpo, respuesta_cacheada


def _resolver_id_metodo_pago(db: Session, nombre_metodo: str) -> int:
    """Resuelve dinámicamente el IdMetodoPago desde el catálogo MetodoPago."""
    metodo_norm = (nombre_metodo or "EFECTIVO").strip().upper()
    row = db.execute(text("""
        SELECT "IdMetodoPago"
        FROM public."MetodoPago"
        WHERE UPPER("NombreMetodoPago") = :nombre
        LIMIT 1;
    """), {"nombre": metodo_norm}).fetchone()
    if row:
        return int(row[0])
    if "TRANSF" in metodo_norm:
        return 2
    if "QR" in metodo_norm:
        return 3
    if "CRED" in metodo_norm:
        return 4
    return 1


def _guardar_firma_como_archivo(
    session: Session,
    firma_str: Optional[str],
    prefijo_archivo: str,
    entidad_origen: str,
    id_registro: int,
    sucursal_id: int,
    chofer_id: int
) -> Optional[str]:
    """
    Garantiza que una firma digital se almacene estrictamente como ARCHIVO en Storage (Supabase o disco)
    y NUNCA se guarde el contenido raw (data URI o SVG inline) en FirmaDigitalDocumento ni en NotaVenta.
    Retorna la URL del archivo o None.
    """
    if not firma_str:
        return None

    # Si ya es una ruta relativa o URL pública almacenada, se devuelve tal cual
    if not ("data:" in firma_str or "<svg" in firma_str):
        return firma_str

    try:
        if "data:image/svg+xml" in firma_str or "<svg" in firma_str:
            extension = ".svg"
            mime_type = "image/svg+xml"
            if ";base64," in firma_str:
                import base64
                contenido_bytes = base64.b64decode(firma_str.split(";base64,")[1])
            elif ";utf8," in firma_str:
                import urllib.parse
                contenido_bytes = urllib.parse.unquote(firma_str.split(";utf8,")[1]).encode("utf-8")
            else:
                contenido_bytes = firma_str.encode("utf-8")
        elif "data:image/png" in firma_str:
            extension = ".png"
            mime_type = "image/png"
            import base64
            contenido_b64 = firma_str.split(";base64,")[1] if ";base64," in firma_str else firma_str
            contenido_bytes = base64.b64decode(contenido_b64)
        else:
            extension = ".svg"
            mime_type = "image/svg+xml"
            contenido_bytes = firma_str.encode("utf-8")

        res = FileStorageService.guardar_bytes_directo(
            session=session,
            contenido=contenido_bytes,
            nombre_archivo=f"{prefijo_archivo}_{id_registro}{extension}",
            entidad_origen=entidad_origen,
            id_registro_origen=id_registro,
            id_sucursal=sucursal_id,
            id_chofer=chofer_id,
            mime_type=mime_type
        )
        return res.get("url")
    except Exception as ex:
        logger.error(f"Error al almacenar archivo de firma para {entidad_origen} id={id_registro}: {ex}")
        return None



def _sincronizar_o_crear_nota_venta_entrega(
    db: Session,
    id_pedido: int,
    uid: int,
    nombre_chofer: str,
    url_firma_chofer: Optional[str],
    url_firma_cliente: Optional[str],
    recibido_por: Optional[str],
    ci_receptor: Optional[str],
    sucursal_id: int,
    datos_cobro: Optional[dict] = None,
    observacion: Optional[str] = None
) -> Optional[int]:
    """Asegura la creación o actualización de NotaVenta y DetalleNotaVenta para visualización inmediata en panel web."""
    ped_row = db.execute(text("""
        SELECT p."NumeroPedido", p."IdCliente", p."MontoTotal", c."RazonSocial"
        FROM public."Pedido" p
        LEFT JOIN public."Cliente" c ON p."IdCliente" = c."IdCliente"
        WHERE p."IdPedido" = :id_ped;
    """), {"id_ped": id_pedido}).fetchone()

    if not ped_row:
        return None

    nro_pedido = ped_row[0]
    id_cliente = ped_row[1]
    monto_total_ped = float(ped_row[2] or 0.0)
    cliente_nombre = ped_row[3] or recibido_por or "Cliente"

    if datos_cobro:
        total_venta = float(datos_cobro.get("monto_total") or monto_total_ped)
        total_cancelado = float(datos_cobro.get("monto_pagado") or 0.0)
        saldo_pendiente = float(datos_cobro.get("saldo_credito") or 0.0)
        tramos = datos_cobro.get("tramos") or []
        monto_ef = sum(t["monto"] for t in tramos if t["metodo"] == "EFECTIVO")
        monto_qr = sum(t["monto"] for t in tramos if t["metodo"] in ("QR", "TRANSFERENCIA"))
        monto_cr = saldo_pendiente
        comp_id = next((t.get("id_comprobante_archivo") for t in tramos if t.get("id_comprobante_archivo")), None)

        hay_pendientes = any(t.get("estado") == "PENDIENTE_APROBACION" for t in tramos)
        if hay_pendientes:
            estado_cobranza = "Pendiente Aprobación"
        elif saldo_pendiente <= 0:
            estado_cobranza = "Liquidado"
        else:
            estado_cobranza = "Pendiente"

        if monto_ef > 0 and monto_qr > 0:
            metodo_pago = "Mixto"
        elif monto_qr > 0:
            metodo_pago = "QR"
        elif monto_ef > 0:
            metodo_pago = "Efectivo"
        else:
            metodo_pago = "Crédito"
    else:
        total_venta = monto_total_ped
        total_cancelado = 0.0
        saldo_pendiente = monto_total_ped
        monto_ef = 0.0
        monto_qr = 0.0
        monto_cr = monto_total_ped
        comp_id = None
        estado_cobranza = "Pendiente"
        metodo_pago = "Pendiente Cobro"

    sql_check = text("""
        SELECT "IdNotaVenta"
        FROM public."NotaVenta"
        WHERE "NumeroNotaEntrega" = :nro_ped
           OR "IdNotaVenta" = (SELECT "IdNotaVenta" FROM public."CuentaCobrar" WHERE "IdPedido" = :id_ped LIMIT 1)
        LIMIT 1;
    """)
    existente = db.execute(sql_check, {"nro_ped": nro_pedido, "id_ped": id_pedido}).fetchone()

    if existente:
        id_nv = existente[0]
        db.execute(text("""
            UPDATE public."NotaVenta"
            SET "IdChofer" = :uid,
                "Chofer" = :chofer,
                "TotalVentaBruto" = :total,
                "ImporteNeto" = :total,
                "TotalCancelado" = :cancelado,
                "SaldoPendiente" = :saldo,
                "EstadoCobranza" = :estado,
                "MetodoPago" = :metodo,
                "MontoEfectivo" = :ef,
                "MontoQR" = :qr,
                "MontoCredito" = :cr,
                "ComprobanteQRArchivoId" = COALESCE(:comp, "ComprobanteQRArchivoId"),
                "FirmaDigitalUrl" = COALESCE(:f_ch, "FirmaDigitalUrl"),
                "FirmaNombre" = :chofer,
                "FirmaClienteUrl" = COALESCE(:f_cl, "FirmaClienteUrl"),
                "FirmaClienteNombre" = :rec,
                "FirmaClienteCi" = :ci,
                "FirmaFecha" = NOW()
            WHERE "IdNotaVenta" = :id_nv;
        """), {
            "uid": uid,
            "chofer": nombre_chofer,
            "total": total_venta,
            "cancelado": total_cancelado,
            "saldo": saldo_pendiente,
            "estado": estado_cobranza,
            "metodo": metodo_pago,
            "ef": monto_ef,
            "qr": monto_qr,
            "cr": monto_cr,
            "comp": comp_id,
            "f_ch": url_firma_chofer,
            "f_cl": url_firma_cliente,
            "rec": recibido_por,
            "ci": ci_receptor,
            "id_nv": id_nv
        })
    else:
        num_nv = f"NV-{nro_pedido}"
        sql_insert = text("""
            INSERT INTO public."NotaVenta" (
                "NumeroNotaVenta", "NumeroNotaEntrega", "FechaVenta", "IdCliente",
                "ClienteNombreLibre", "DestinoDepartamento", "IdChofer", "Chofer",
                "CantidadCamiones", "TotalVentaBruto", "DescuentoBonificacion", "Promocion",
                "ImporteNeto", "SaldoAnterior", "TotalCancelado", "SaldoPendiente",
                "EstadoCobranza", "Observacion", "IdUsuarioRegistro", "IdSucursal",
                "MetodoPago", "MontoEfectivo", "MontoQR", "MontoCredito",
                "ComprobanteQRArchivoId", "FirmaDigitalUrl", "FirmaNombre",
                "FirmaClienteUrl", "FirmaClienteNombre", "FirmaClienteCi", "FirmaFecha", "FechaRegistro"
            ) VALUES (
                :num_nv, :nro_ped, CURRENT_DATE, :id_cli,
                :cli_nom, 'Sucre', :uid, :chofer,
                1.0, :total, 0.0, 0.0,
                :total, 0.0, :cancelado, :saldo,
                :estado, :obs, :uid, :sid,
                :metodo, :ef, :qr, :cr,
                :comp, :f_ch, :chofer,
                :f_cl, :rec, :ci, NOW(), NOW()
            ) RETURNING "IdNotaVenta";
        """)
        id_nv = db.execute(sql_insert, {
            "num_nv": num_nv,
            "nro_ped": nro_pedido,
            "id_cli": id_cliente,
            "cli_nom": cliente_nombre,
            "uid": uid,
            "chofer": nombre_chofer,
            "total": total_venta,
            "cancelado": total_cancelado,
            "saldo": saldo_pendiente,
            "estado": estado_cobranza,
            "obs": observacion or f"Entrega móvil pedido #{id_pedido}",
            "sid": sucursal_id,
            "metodo": metodo_pago,
            "ef": monto_ef,
            "qr": monto_qr,
            "cr": monto_cr,
            "comp": comp_id,
            "f_ch": url_firma_chofer,
            "f_cl": url_firma_cliente,
            "rec": recibido_por,
            "ci": ci_receptor
        }).scalar()

        db.execute(text("""
            INSERT INTO public."DetalleNotaVenta" (
                "IdNotaVenta", "IdPresentacion", "NombreProducto", "Cantidad", "PrecioUnitario", "Subtotal", "EsBonificacionBandeo"
            )
            SELECT :id_nv, dp."IdPresentacion", COALESCE(pr."NombreProducto", pp."CodigoPresentacion", 'Producto'), dp."Cantidad", dp."PrecioUnitarioAplicado", dp."Subtotal", false
            FROM public."DetallePedido" dp
            LEFT JOIN public."PresentacionProducto" pp ON dp."IdPresentacion" = pp."IdPresentacion"
            LEFT JOIN public."Producto" pr ON pp."IdProducto" = pr."IdProducto"
            WHERE dp."IdPedido" = :id_ped;
        """), {"id_nv": id_nv, "id_ped": id_pedido})

    db.execute(text("""
        UPDATE public."CuentaCobrar"
        SET "IdNotaVenta" = :id_nv
        WHERE "IdPedido" = :id_ped AND "IdNotaVenta" IS NULL;
    """), {"id_nv": id_nv, "id_ped": id_pedido})

    return id_nv


def _asegurar_cxc_y_abono_bancario_chofer(
    db: Session,
    uid: int,
    id_pedido: int,
    metodo: str,
    monto: float,
    numero_referencia: str,
    id_comprobante_archivo: Optional[int],
    url_comprobante: Optional[str],
    alcance: AlcanceUsuario,
    observacion: Optional[str] = None
) -> tuple[Optional[int], Optional[int]]:
    """Localiza o crea la CuentaCobrar y asienta el AbonoCuentaCobrar en PENDIENTE_APROBACION para Kevin."""
    cxc_service = CuentasCobrarService(db)

    ped_info = db.execute(text("""
        SELECT p."IdCliente", c."IdSucursal", p."MontoTotal", p."NumeroPedido"
        FROM public."Pedido" p
        JOIN public."Cliente" c ON p."IdCliente" = c."IdCliente"
        WHERE p."IdPedido" = :id_ped;
    """), {"id_ped": id_pedido}).fetchone()

    id_cliente = ped_info[0] if ped_info else None
    id_sucursal_ped = ped_info[1] if ped_info else (alcance.sucursal_efectiva or 1)

    id_cxc = None
    if id_cliente:
        cxc_existente = db.execute(text("""
            SELECT "IdCuentaCobrar"
            FROM public."CuentaCobrar"
            WHERE "IdPedido" = :id_ped
            LIMIT 1;
        """), {"id_ped": id_pedido}).fetchone()

        if cxc_existente:
            id_cxc = cxc_existente[0]
        else:
            cxc_cliente = db.execute(text("""
                SELECT "IdCuentaCobrar"
                FROM public."CuentaCobrar"
                WHERE "IdCliente" = :id_cli AND "IdEstadoCuentaCobrar" = 1 AND "SaldoPendiente" > 0
                ORDER BY "IdCuentaCobrar" DESC
                LIMIT 1;
            """), {"id_cli": id_cliente}).fetchone()

            if cxc_cliente:
                id_cxc = cxc_cliente[0]
            else:
                nro_ped = ped_info[3] if ped_info and ped_info[3] else f"PED-{id_pedido}"
                nueva_cxc = cxc_service.repo.CrearCuentaCobrar({
                    "IdCliente": id_cliente,
                    "IdPedido": id_pedido,
                    "IdNotaVenta": None,
                    "NumeroNotaVenta": str(nro_ped),
                    "NumeroNotaEntrega": f"NE-{id_pedido}",
                    "FechaDespacho": date.today(),
                    "DiasMora": 0,
                    "IdEstadoCuentaCobrar": 1,
                    "MontoTotal": monto,
                    "SaldoPendiente": monto,
                    "FechaEmision": date.today(),
                    "FechaVencimiento": date.today() + timedelta(days=15),
                    "IdUsuarioRegistro": uid,
                    "Observacion": f"Cuenta generada por cobro móvil de pedido #{id_pedido}"
                })
                id_cxc = nueva_cxc["IdCuentaCobrar"]
                db.execute(text('UPDATE public."CuentaCobrar" SET "IdSucursal" = :sid WHERE "IdCuentaCobrar" = :id;'), {
                    "sid": id_sucursal_ped,
                    "id": id_cxc
                })

    id_abono_creado = None
    id_metodo_pago = _resolver_id_metodo_pago(db, metodo)
    if id_cxc:
        dto_abono = AbonoCuentaCobrarCrear(
            IdCuentaCobrar=id_cxc,
            IdMetodoPago=id_metodo_pago,
            MetodoPago=metodo.upper(),
            MontoAbonado=monto,
            FechaAbono=date.today(),
            NumeroReferencia=numero_referencia,
            IdComprobanteArchivo=id_comprobante_archivo,
            Observacion=f"Cobro móvil chofer #{uid} para Pedido #{id_pedido} - {observacion or ''}".strip()
        )
        abono_db = cxc_service.RegistrarAbonoChofer(dto_abono, id_usuario=uid)
        id_abono_creado = abono_db.get("IdAbonoCuentaCobrar")

        nom_suc_cxc = _obtener_nombre_sucursal(db, id_sucursal_ped)
        db.execute(text("""
            INSERT INTO public."NotificacionInterna" (
                "IdUsuarioDestinatario", "Tipo", "Titulo", "Mensaje",
                "CodigoReferencia", "Leido", "FechaCreacion"
            ) VALUES (
                1, 'ALERTA', 'Cobro QR/Transferencia Móvil Pendiente',
                :msj, :id_ped, false, NOW()
            );
        """), {
            "msj": f"El chofer #{uid} registró un cobro de Bs. {monto:.2f} vía {metodo.upper()} para Pedido #{id_pedido} en {nom_suc_cxc}. Requiere validación de Kevin.",
            "id_ped": id_pedido
        })

    return id_cxc, id_abono_creado


def _crear_cliente_y_punto_venta_en_ruta(
    db: Session,
    uid: int,
    payload: dict,
    lat: float,
    lng: float,
    alcance: AlcanceUsuario
) -> dict:
    """Crea Cliente y PuntoVenta forzosamente en la sucursal del chofer y lo vincula a su ruta."""
    sid = alcance.sucursal_efectiva or 1
    razon = (payload.get("razon_social") or "").strip()
    if not razon:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La razón social es obligatoria."
        )
    nombre_com = (payload.get("nombre_comercial") or razon).strip()
    nombre_prop = (payload.get("nombre_propietario") or "").strip() or None
    nit = payload.get("nit_ci") or None
    tel = payload.get("telefono") or None
    dir_txt = (payload.get("direccion") or "Sin dirección especificada").strip()
    obs = payload.get("observaciones") or payload.get("tipo_negocio")

    # 1. Insertar Cliente asignado forzosamente a la sucursal del chofer
    cli_row = db.execute(text("""
        INSERT INTO public."Cliente" (
            "IdEstadoCliente", "RazonSocial", "NombreComercial", "NombrePropietario", "NitCi",
            "Telefono", "Direccion", "Latitud", "Longitud",
            "LimiteCreditoBs", "DiasCredito", "IdUsuarioRegistro", "Observacion", "IdSucursal"
        ) VALUES (
            1, :razon, :nom_com, :nom_prop, :nit,
            :tel, :dir, :lat, :lng,
            0, 0, :uid, :obs, :sid
        ) RETURNING "IdCliente";
    """), {
        "razon": razon, "nom_com": nombre_com, "nom_prop": nombre_prop, "nit": nit, "tel": tel,
        "dir": dir_txt, "lat": lat, "lng": lng, "uid": uid, "obs": obs, "sid": sid
    }).fetchone()
    id_cliente = cli_row[0]

    # 2. Insertar PuntoVenta
    pv_row = db.execute(text("""
        INSERT INTO public."PuntoVenta" (
            "IdCliente", "NombrePuntoVenta", "Direccion",
            "Latitud", "Longitud", "Referencia", "Activo"
        ) VALUES (
            :cli, :nom_com, :dir,
            :lat, :lng, :ref, true
        ) RETURNING "IdPuntoVenta";
    """), {
        "cli": id_cliente, "nom_com": nombre_com, "dir": dir_txt,
        "lat": lat, "lng": lng, "ref": obs
    }).fetchone()
    id_pv = pv_row[0]

    # 3. Vincular a la ruta activa del chofer si existe
    asig = db.execute(text("""
        SELECT ar."IdRutaDistribucion"
        FROM public."AsignacionRuta" ar
        WHERE ar."IdUsuarioRepartidor" = :uid AND ar."FechaAsignacion" = CURRENT_DATE
        ORDER BY ar."IdAsignacionRuta" DESC
        LIMIT 1;
    """), {"uid": uid}).fetchone()
    if asig:
        id_ruta = asig[0]
        max_orden = db.execute(text("""
            SELECT COALESCE(MAX("OrdenVisita"), 0) + 1
            FROM public."RutaPuntoVenta"
            WHERE "IdRutaDistribucion" = :rid;
        """), {"rid": id_ruta}).scalar()

        db.execute(text("""
            INSERT INTO public."RutaPuntoVenta" ("IdRutaDistribucion", "IdPuntoVenta", "OrdenVisita")
            VALUES (:rid, :pvid, :orden)
            ON CONFLICT ("IdRutaDistribucion", "IdPuntoVenta") DO NOTHING;
        """), {"rid": id_ruta, "pvid": id_pv, "orden": max_orden})

    return {
        "id_cliente": id_cliente,
        "id_punto_venta": id_pv,
        "razon_social": razon,
        "nombre_comercial": nombre_com,
        "nombre_propietario": nombre_prop,
        "sucursal_id": sid,
        "latitud": lat,
        "longitud": lng
    }


# ==============================================================================
# 1. HOJA DE RUTA ACTIVA DEL DÍA
# ==============================================================================
@ChoferMovilRouter.get("/hoja-ruta/activa", response_model=MovilResponse[Dict[str, Any]])
def obtener_hoja_ruta_activa_movil(
    request: Request,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Obtiene la hoja de ruta y paradas asignadas para el chofer autenticado.
    La identidad del chofer se extrae obligatoriamente del token JWT.
    """
    req_id = _obtener_request_id(request)
    chofer_id = usuario["IdUsuario"]
    service = RutaService(db)
    hoy = date.today()

    asignaciones = service.ListarAsignaciones(
        fecha=hoy,
        id_repartidor=chofer_id,
        id_sucursal=alcance.sucursal_efectiva
    )
    if not asignaciones:
        asignaciones = service.ListarAsignaciones(
            id_repartidor=chofer_id,
            id_sucursal=alcance.sucursal_efectiva
        )

    if not asignaciones:
        return MovilResponse[Dict[str, Any]](
            codigo="EXITO",
            mensaje="No tiene rutas asignadas pendientes para hoy.",
            request_id=req_id,
            datos={"asignacion": None, "paradas": [], "total_paradas": 0}
        )

    # Orden de prioridad estricto para móvil:
    # 1º APROBADA_EN_RUTA (o EN_RUTA)
    # 2º CARGA_SOLICITADA
    # 3º OBSERVADA / RECHAZADA / CARGA_OBSERVADA / CARGA_RECHAZADA
    # 4º PENDIENTE_CARGA
    # Empate: IdAsignacionRuta DESC
    def _prioridad_asignacion_chofer(a: dict) -> tuple:
        st = str(a.get("estado_operativo") or a.get("EstadoOperativo") or "PENDIENTE_CARGA").strip().upper()
        if st in ("APROBADA_EN_RUTA", "EN_RUTA"):
            prio = 1
        elif st == "CARGA_SOLICITADA":
            prio = 2
        elif st in ("OBSERVADA", "RECHAZADA", "CARGA_OBSERVADA", "CARGA_RECHAZADA"):
            prio = 3
        elif st == "PENDIENTE_CARGA":
            prio = 4
        else:
            prio = 5
        id_as = int(a.get("IdAsignacionRuta") or 0)
        return (prio, -id_as)

    asignaciones.sort(key=_prioridad_asignacion_chofer)

    id_asig = asignaciones[0]["IdAsignacionRuta"]
    tracking = service.ObtenerTrackingAsignacion(id_asig)

    # Validar aislamiento: si es chofer, no ver asignación ajena
    if usuario.get("IdRol") in (ROL_AGENTE_REPARTO, 6, 7) and tracking.get("IdUsuarioRepartidor") != chofer_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación no encontrada")

    # Consultar solicitud de carga de camión más reciente de la asignación
    sql_sol_pend = text("""
        SELECT s."id_solicitud", s."estado", s."fecha_solicitud", s."observacion_chofer", s."observacion_admin"
        FROM public."solicitud_carga_camion" s
        WHERE s."id_asignacion_ruta" = :id_asig
        ORDER BY s."id_solicitud" DESC LIMIT 1;
    """)
    sol_pend = db.execute(sql_sol_pend, {"id_asig": id_asig}).mappings().fetchone()

    items_solicitados = []
    if sol_pend:
        sql_items_sol = text("""
            SELECT 
                d."id_detalle",
                d."id_presentacion",
                pp."CodigoPresentacion",
                prod."NombreProducto",
                pp."TipoContenedor",
                COALESCE(d."stock_remanente", 0) as "stock_remanente",
                COALESCE(d."stock_adicional_solicitado", 0) as "stock_adicional_solicitado",
                COALESCE(d."stock_adicional_aprobado", 0) as "stock_adicional_aprobado"
            FROM public."detalle_solicitud_carga_camion" d
            JOIN public."PresentacionProducto" pp ON d."id_presentacion" = pp."IdPresentacion"
            JOIN public."Producto" prod ON pp."IdProducto" = prod."IdProducto"
            WHERE d."id_solicitud" = :sid
            ORDER BY prod."NombreProducto" ASC;
        """)
        items_solicitados = [dict(it) for it in db.execute(sql_items_sol, {"sid": sol_pend["id_solicitud"]}).mappings().fetchall()]

    estado_op = tracking.get("estado_operativo") or "PENDIENTE_CARGA"
    if sol_pend:
        st_sol = str(sol_pend["estado"]).strip().upper()
        if st_sol == "PENDIENTE":
            estado_op = "CARGA_SOLICITADA"
        elif st_sol in ("APROBADA", "APROBADO"):
            estado_op = "APROBADA_EN_RUTA"
        elif st_sol in ("OBSERVADA", "OBSERVADO", "CARGA_OBSERVADA"):
            estado_op = "CARGA_OBSERVADA"
        elif st_sol in ("RECHAZADA", "RECHAZADO", "CARGA_RECHAZADA"):
            estado_op = "CARGA_RECHAZADA"

    es_pendiente_carga = (estado_op == "CARGA_SOLICITADA")

    tracking["estado_operativo"] = estado_op
    tracking["solicitud_carga_pendiente"] = es_pendiente_carga
    tracking["solicitud_carga_items"] = items_solicitados
    tracking["items_solicitados"] = items_solicitados
    tracking["habilitada_para_reparto"] = (estado_op in ("APROBADA_EN_RUTA", "EN_RUTA"))
    if sol_pend:
        tracking["id_solicitud_carga"] = sol_pend["id_solicitud"]
        tracking["observacion_admin"] = sol_pend.get("observacion_admin")

    # Enriquecer paradas con detalle de productos del pedido
    paradas = tracking.get("Paradas", [])

    # Fallback si no hay paradas en tracking: buscar pedidos vinculados a la asignación o puntos de la ruta
    if not paradas:
        sql_ped_fb = text("""
            SELECT 
                ROW_NUMBER() OVER (ORDER BY p."IdPedido" ASC) as "OrdenVisita",
                pv."IdPuntoVenta",
                pv."NombrePuntoVenta",
                pv."Direccion",
                pv."Latitud",
                pv."Longitud",
                pv."Referencia",
                c."IdCliente",
                COALESCE(c."NombreComercial", c."RazonSocial") as "NombreCliente",
                c."Telefono" as "TelefonoCliente",
                p."IdPedido",
                p."NumeroPedido",
                p."MontoTotal" as "MontoPedido",
                p."IdEstadoPedido",
                COALESCE(p."estado_visita", '') as "estado_visita",
                COALESCE(p."tipo_incidencia", '') as "tipo_incidencia",
                CASE 
                    WHEN p."IdEstadoPedido" = 3 THEN 'Entregado'
                    WHEN p."IdEstadoPedido" = 2 THEN 'En Camino'
                    WHEN p."IdEstadoPedido" = 4 THEN 'Cancelado'
                    WHEN p."IdPedido" IS NOT NULL THEN 'Pendiente'
                    ELSE 'Visita Comercial'
                END as "EstadoEntrega",
                p."LatitudEntrega",
                p."LongitudEntrega",
                p."FechaEntrega",
                0.0 as "MontoCobrado"
            FROM public."Pedido" p
            JOIN public."PuntoVenta" pv ON p."IdPuntoVenta" = pv."IdPuntoVenta"
            JOIN public."Cliente" c ON pv."IdCliente" = c."IdCliente"
            WHERE p."IdAsignacionRuta" = :id_asig
            ORDER BY p."IdPedido" ASC;
        """)
        paradas = [dict(r) for r in db.execute(sql_ped_fb, {"id_asig": id_asig}).mappings().fetchall()]

    if not paradas:
        id_ruta_asig = tracking.get("IdRutaDistribucion")
        if id_ruta_asig:
            sql_pv_fb = text("""
                SELECT 
                    ROW_NUMBER() OVER (ORDER BY pv."IdPuntoVenta" ASC) as "OrdenVisita",
                    pv."IdPuntoVenta",
                    pv."NombrePuntoVenta",
                    pv."Direccion",
                    pv."Latitud",
                    pv."Longitud",
                    pv."Referencia",
                    c."IdCliente",
                    COALESCE(c."NombreComercial", c."RazonSocial") as "NombreCliente",
                    c."Telefono" as "TelefonoCliente",
                    NULL::integer as "IdPedido",
                    NULL::varchar as "NumeroPedido",
                    0.0 as "MontoPedido",
                    NULL::integer as "IdEstadoPedido",
                    '' as "estado_visita",
                    '' as "tipo_incidencia",
                    'Visita Comercial' as "EstadoEntrega",
                    NULL::numeric as "LatitudEntrega",
                    NULL::numeric as "LongitudEntrega",
                    NULL::timestamp as "FechaEntrega",
                    0.0 as "MontoCobrado"
                FROM public."PuntoVenta" pv
                JOIN public."Cliente" c ON pv."IdCliente" = c."IdCliente"
                JOIN public."RutaDistribucion" r ON r."IdRutaDistribucion" = :rid
                WHERE (c."IdSucursal" = r."IdSucursal" OR pv."IdZona" = r."IdZonaDistribucion")
                  AND pv."Activo" = true
                ORDER BY pv."IdPuntoVenta" ASC
                LIMIT 10;
            """)
            paradas = [dict(r) for r in db.execute(sql_pv_fb, {"rid": id_ruta_asig}).mappings().fetchall()]
    for p in paradas:
        id_ped = p.get("IdPedido")
        if id_ped:
            sql_detalles = text("""
                SELECT 
                    dp."IdDetallePedido",
                    dp."IdPresentacion",
                    pp."TipoContenedor",
                    prod."NombreProducto",
                    dp."Cantidad",
                    dp."PrecioUnitarioAplicado",
                    dp."Subtotal",
                    COALESCE(pcc."EsBandeo", false) as "EsBandeo",
                    COALESCE(pcc."ValorBandeo", 0) as "ValorBandeo"
                FROM public."DetallePedido" dp
                JOIN public."PresentacionProducto" pp ON dp."IdPresentacion" = pp."IdPresentacion"
                JOIN public."Producto" prod ON pp."IdProducto" = prod."IdProducto"
                LEFT JOIN public."ProductoConfigComercial" pcc ON prod."IdProducto" = pcc."IdProducto"
                WHERE dp."IdPedido" = :id_ped;
            """)
            items_pedido = db.execute(sql_detalles, {"id_ped": id_ped}).mappings().fetchall()
            p["items"] = [dict(item) for item in items_pedido]

    return MovilResponse[Dict[str, Any]](
        codigo="EXITO",
        mensaje="Hoja de ruta cargada correctamente",
        request_id=req_id,
        datos={
            "asignacion": tracking,
            "paradas": paradas,
            "total_paradas": len(paradas),
            "estado_operativo": estado_op,
            "solicitud_carga_pendiente": es_pendiente_carga,
            "solicitud_carga_items": items_solicitados,
            "items_solicitados": items_solicitados,
            "habilitada_para_reparto": (estado_op == "APROBADA_EN_RUTA")
        }
    )


# ==============================================================================
# 2. MI INVENTARIO EN CAMIÓN Y BANDEO
# ==============================================================================
@ChoferMovilRouter.get("/mi-inventario", response_model=MovilResponse[ResumenInventarioChoferDTO])
def obtener_mi_inventario_camion(
    request: Request,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Retorna el inventario físico cargado al camión del chofer autenticado,
    indicando bultos cargados, entregados y saldo actual en camión, con el desglose
    de promociones/bandeo (servilletas de regalo/cortesía a costo Bs. 0).
    """
    req_id = _obtener_request_id(request)
    chofer_id = usuario["IdUsuario"]
    sucursal_id = alcance.sucursal_efectiva or usuario.get("IdSucursal", 1)

    sql = text("""
        SELECT 
            ic.id,
            ic.presentacion_id,
            p."CodigoPresentacion",
            prod."NombreProducto",
            p."TipoContenedor",
            ic.cantidad_cargada,
            ic.cantidad_vendida,
            ic.cantidad_remanente,
            ic.precio_vigente_carga,
            ROUND(ic.cantidad_remanente * ic.precio_vigente_carga, 2) as valor_remanente,
            COALESCE((
                SELECT pp."PrecioUnitario"
                FROM public."PrecioProducto" pp
                WHERE pp."IdPresentacion" = ic.presentacion_id
                  AND (pp."IdSucursal" = ic.sucursal_id OR pp."IdSucursal" IS NULL)
                  AND pp."Activo" = TRUE
                ORDER BY (pp."IdSucursal" = ic.sucursal_id) DESC, pp."IdPrecioProducto" DESC
                LIMIT 1
            ), ic.precio_vigente_carga) as precio_vigente_actual,
            COALESCE(pcc."EsBandeo", false) as es_bandeo,
            COALESCE(pcc."ValorBandeo", 0) as valor_bandeo
        FROM public.inventario_chofer ic
        JOIN public."PresentacionProducto" p ON ic.presentacion_id = p."IdPresentacion"
        JOIN public."Producto" prod ON p."IdProducto" = prod."IdProducto"
        LEFT JOIN public."ProductoConfigComercial" pcc ON prod."IdProducto" = pcc."IdProducto"
        WHERE ic.chofer_id = :cid AND ic.sucursal_id = :sid
        ORDER BY prod."NombreProducto", p."CodigoPresentacion";
    """)
    filas = db.execute(sql, {"cid": chofer_id, "sid": sucursal_id}).mappings().fetchall()

    items: List[ItemInventarioCamionDTO] = []
    total_cargados = 0.0
    total_entregados = 0.0
    total_saldo = 0.0
    valor_total_bs = 0.0
    valor_total_revalorizado_bs = 0.0
    ajuste_revalorizacion_total_bs = 0.0

    for r in filas:
        cargado = float(r["cantidad_cargada"])
        vendido = float(r["cantidad_vendida"])
        remanente = float(r["cantidad_remanente"])
        precio_u = float(r["precio_vigente_carga"])
        valor_rem = float(r["valor_remanente"] or (remanente * precio_u))

        precio_actual = float(r["precio_vigente_actual"] if r["precio_vigente_actual"] is not None else precio_u)
        valor_rem_reval = round(remanente * precio_actual, 2)
        dif_reval = round((precio_actual - precio_u) * remanente, 2)

        total_cargados += cargado
        total_entregados += vendido
        total_saldo += remanente
        valor_total_bs += valor_rem
        valor_total_revalorizado_bs += valor_rem_reval
        ajuste_revalorizacion_total_bs += dif_reval

        cortesia_desc = None
        if r["es_bandeo"] and r["valor_bandeo"] > 0:
            cortesia_desc = f"Incluye {int(r['valor_bandeo'])} servilleta(s) de cortesía por unidad (Costo Bs. 0.00)"

        items.append(ItemInventarioCamionDTO(
            presentacion_id=r["presentacion_id"],
            nombre_producto=r["NombreProducto"],
            codigo_presentacion=r["CodigoPresentacion"],
            tipo_contenedor=r["TipoContenedor"] or "Paquete",
            cantidad_cargada=cargado,
            cantidad_vendida=vendido,
            cantidad_remanente=remanente,
            precio_vigente_carga=precio_u,
            valor_remanente=valor_rem,
            precio_vigente_actual=precio_actual,
            diferencia_revalorizacion_bs=dif_reval,
            valor_remanente_revalorizado=valor_rem_reval,
            es_bandeo=r["es_bandeo"],
            valor_bandeo=r["valor_bandeo"],
            cortesia_bandeo_descripcion=cortesia_desc
        ))

    resumen = ResumenInventarioChoferDTO(
        chofer_id=chofer_id,
        sucursal_id=sucursal_id,
        total_bultos_cargados=total_cargados,
        total_bultos_entregados=total_entregados,
        total_saldo_camion=total_saldo,
        valor_total_camion_bs=round(valor_total_bs, 2),
        valor_total_revalorizado_bs=round(valor_total_revalorizado_bs, 2),
        ajuste_revalorizacion_total_bs=round(ajuste_revalorizacion_total_bs, 2),
        items=items
    )

    return MovilResponse[ResumenInventarioChoferDTO](
        codigo="EXITO",
        mensaje="Inventario de camión obtenido exitosamente",
        request_id=req_id,
        datos=resumen
    )


# ==============================================================================
# 3. REGISTRAR ENTREGA (TOTAL O PARCIAL, BANDEO, FIRMA)
# ==============================================================================
@ChoferMovilRouter.post("/entregar")
async def registrar_entrega_movil(
    request: Request,
    dto: EntregaMovilRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key")
):
    """
    Registra la entrega física total o parcial de un pedido.
    Exige X-Idempotency-Key (UUID v4), firma del chofer obligatoria,
    valida saldo en camión y descuenta inventario_chofer (incluyendo bandeo a costo 0).
    Detecta revalorizaciones de precio posteriores y emite alerta clara.
    """
    req_id = _obtener_request_id(request)
    uid = usuario["IdUsuario"]
    sucursal_id = alcance.sucursal_efectiva or usuario.get("IdSucursal", 1)

    # 0. Gatekeeper de Carga de Camión (bloqueo preventivo antes de procesar)
    _validar_gatekeeper_carga_camion(db, dto.id_pedido, uid)

    cuerpo_bytes = await request.body()

    hash_cuerpo, respuesta_cacheada = _verificar_idempotencia_escritura(
        db, uid, request.url.path, x_idempotency_key, cuerpo_bytes
    )
    if respuesta_cacheada:
        return respuesta_cacheada

    # 1. Validar pertenencia del pedido a la ruta del chofer y sucursal
    _validar_pertenencia_pedido_chofer(db, dto.id_pedido, usuario, alcance)

    # Validaciones previas del bloque de cobro compuesto (si viene provisto)
    if dto.cobro:
        # Caso 1: Ignorar bloque crédito si saldo <= 0
        if dto.cobro.credito and (dto.cobro.credito.saldo is None or dto.cobro.credito.saldo <= 0):
            dto.cobro.credito = None

        suma_pagos = round(sum(p.monto for p in dto.cobro.pagos), 2)
        saldo_cred = round(dto.cobro.credito.saldo if dto.cobro.credito else 0.0, 2)

        # Caso 2: Si monto_total viene en 0, None o vacío, calcularlo automáticamente
        if dto.cobro.monto_total is None or dto.cobro.monto_total <= 0:
            dto.cobro.monto_total = round(suma_pagos + saldo_cred, 2)

        # Tolerancia de centavos (0.05 Bs)
        discrepancia = abs((suma_pagos + saldo_cred) - dto.cobro.monto_total)
        if discrepancia > 0.05:
            msg = (
                f"La suma de pagos ({suma_pagos:.2f}) + saldo a crédito ({saldo_cred:.2f}) "
                f"no coincide con el total declarado ({dto.cobro.monto_total:.2f}). Discrepancia: {discrepancia:.2f} Bs."
            )
            logger.warning(
                f"[/chofer/entregar RECHAZADO 400] Motivo: {msg} | IdPedido: {dto.id_pedido} | "
                f"IdUsuario: {uid} | Items: {dto.items_entregados} | Cobro: {dto.cobro.model_dump() if hasattr(dto.cobro, 'model_dump') else dto.cobro}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=msg
            )

        if suma_pagos > (dto.cobro.monto_total + 0.05):
            msg = f"La suma de pagos ({suma_pagos:.2f}) supera el monto total del cobro ({dto.cobro.monto_total:.2f})."
            logger.warning(
                f"[/chofer/entregar RECHAZADO 400] Motivo: {msg} | IdPedido: {dto.id_pedido} | "
                f"IdUsuario: {uid} | Items: {dto.items_entregados} | Cobro: {dto.cobro.model_dump() if hasattr(dto.cobro, 'model_dump') else dto.cobro}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=msg
            )

        for p in dto.cobro.pagos:
            metodo_up = p.metodo.upper()
            if metodo_up in ("QR", "TRANSFERENCIA") and p.monto > 0:
                if not p.id_comprobante_archivo and not p.url_comprobante:
                    msg = f"Todo cobro con {metodo_up} exige obligatoriamente fotografía o ID de ComprobanteArchivo."
                    logger.warning(
                        f"[/chofer/entregar RECHAZADO 422] Motivo: {msg} | IdPedido: {dto.id_pedido} | "
                        f"IdUsuario: {uid} | Tramo: {p.model_dump() if hasattr(p, 'model_dump') else p}"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=msg
                    )

    # 2. Consultar detalles del pedido para verificar cantidades
    sql_det = text("""
        SELECT dp."IdPresentacion", dp."Cantidad", dp."PrecioUnitarioAplicado"
        FROM public."DetallePedido" dp
        WHERE dp."IdPedido" = :id_ped;
    """)
    filas_det = db.execute(sql_det, {"id_ped": dto.id_pedido}).mappings().fetchall()
    if not filas_det:
        msg = f"El pedido #{dto.id_pedido} no cuenta con detalles de productos"
        logger.warning(f"[/chofer/entregar RECHAZADO 404] Motivo: {msg} | IdUsuario: {uid}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

    # Mapear cantidades a entregar
    cantidades_a_entregar: Dict[int, float] = {}
    if dto.tipo_entrega == "PARCIAL" and dto.items_entregados:
        for it in dto.items_entregados:
            cantidades_a_entregar[it.presentacion_id] = it.cantidad
    else:
        for f in filas_det:
            cantidades_a_entregar[f["IdPresentacion"]] = float(f["Cantidad"])

    # 3. Validar disponibilidad en inventario_chofer
    for pres_id, cant_entregar in cantidades_a_entregar.items():
        sql_stock = text("""
            SELECT "id", "cantidad_remanente"
            FROM public.inventario_chofer
            WHERE "chofer_id" = :cid AND "presentacion_id" = :pid;
        """)
        row_stock = db.execute(sql_stock, {"cid": uid, "pid": pres_id}).fetchone()
        remanente = float(row_stock[1]) if row_stock and row_stock[1] is not None else None

        if remanente is None or remanente < cant_entregar:
            # Caso 3: Si estamos en entorno de desarrollo/pruebas o se prueba con chofer real en local:
            if ENTORNO_PRUEBAS_HABILITADO:
                cant_disponible = remanente or 0.0
                cant_adicional = cant_entregar - cant_disponible
                logger.warning(
                    f"[/chofer/entregar AVISO-PRUEBAS] Chofer #{uid} no disponía de stock suficiente en camión "
                    f"para presentación #{pres_id} (Disponible: {cant_disponible}, Requerido: {cant_entregar}). "
                    f"Aprovisionando {cant_adicional} unidades en inventario_chofer para permitir pruebas locales."
                )
                if row_stock:
                    db.execute(text("""
                        UPDATE public.inventario_chofer
                        SET "cantidad_cargada" = "cantidad_cargada" + :cant,
                            "cantidad_remanente" = "cantidad_remanente" + :cant
                        WHERE "id" = :id;
                    """), {"id": row_stock[0], "cant": cant_adicional})
                else:
                    db.execute(text("""
                        INSERT INTO public.inventario_chofer (
                            "chofer_id", "sucursal_id", "presentacion_id",
                            "cantidad_cargada", "cantidad_vendida", "cantidad_remanente"
                        ) VALUES (
                            :cid, :sid, :pid, :cant, 0, :cant
                        );
                    """), {"cid": uid, "sid": sucursal_id, "pid": pres_id, "cant": cant_entregar})
            else:
                msg = f"Stock insuficiente en camión para la presentación #{pres_id}. Disponible: {remanente or 0.0}, Solicitado: {cant_entregar}"
                logger.warning(
                    f"[/chofer/entregar RECHAZADO 400] Motivo: {msg} | IdPedido: {dto.id_pedido} | "
                    f"IdUsuario: {uid} | Items: {dto.items_entregados} | Cobro: {dto.cobro.model_dump() if dto.cobro and hasattr(dto.cobro, 'model_dump') else dto.cobro}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=msg
                )

    # 4. Descontar inventario_chofer e incrementar cantidad_vendida
    for pres_id, cant_entregar in cantidades_a_entregar.items():
        db.execute(text("""
            UPDATE public.inventario_chofer
            SET "cantidad_vendida" = "cantidad_vendida" + :cant,
                "cantidad_remanente" = "cantidad_remanente" - :cant
            WHERE "chofer_id" = :cid AND "presentacion_id" = :pid;
        """), {"cant": cant_entregar, "cid": uid, "pid": pres_id})

    # 5. Registrar doble firma digital (Chofer y Cliente receptor) con guardado en Storage y sync a NotaVenta
    url_firma_chofer = _guardar_firma_como_archivo(
        session=db,
        firma_str=dto.firma_chofer,
        prefijo_archivo="firma_chofer_ped",
        entidad_origen="FIRMA_CHOFER",
        id_registro=dto.id_pedido,
        sucursal_id=sucursal_id,
        chofer_id=uid
    )

    url_firma_cliente = _guardar_firma_como_archivo(
        session=db,
        firma_str=dto.firma_cliente,
        prefijo_archivo="firma_cliente_ped",
        entidad_origen="FIRMA_CLIENTE",
        id_registro=dto.id_pedido,
        sucursal_id=sucursal_id,
        chofer_id=uid
    )

    # Guardar en FirmaDigitalDocumento
    db.execute(text("""
        INSERT INTO public."FirmaDigitalDocumento" (
            "IdUsuario", "TipoDocumento", "IdRegistroDocumento", "CodigoReferencia",
            "UrlFotoFirmaSello", "Observaciones", "FechaFirma"
        ) VALUES (
            :uid, 'ENTREGA_PEDIDO', :id_ped, :cod_ref,
            :firma_chofer, :obs, NOW()
        );
    """), {
        "uid": uid,
        "id_ped": dto.id_pedido,
        "cod_ref": f"PED-{dto.id_pedido}-CHOFER",
        "firma_chofer": url_firma_chofer,
        "obs": f"Firma digital táctil del chofer #{uid}."
    })

    if url_firma_cliente:
        db.execute(text("""
            INSERT INTO public."FirmaDigitalDocumento" (
                "IdUsuario", "TipoDocumento", "IdRegistroDocumento", "CodigoReferencia",
                "UrlFotoFirmaSello", "Observaciones", "FechaFirma"
            ) VALUES (
                :uid, 'FIRMA_CLIENTE_ENTREGA', :id_ped, :cod_ref,
                :firma_cliente, :obs, NOW()
            );
        """), {
            "uid": uid,
            "id_ped": dto.id_pedido,
            "cod_ref": f"PED-{dto.id_pedido}-CLIENTE",
            "firma_cliente": url_firma_cliente,
            "obs": f"Recibido por: {dto.recibido_por} (CI: {dto.ci_receptor or 'S/CI'})."
        })

    # 6. Actualizar pedido delegando en RutaService
    nombre_chofer_txt = f"{usuario.get('PrimerNombre', '')} {usuario.get('ApellidoPaterno', '')}".strip() or "Chofer"
    ruta_service = RutaService(db)
    obs_final = f"Recibido por: {dto.recibido_por}. {dto.observacion or ''} [Tipo: {dto.tipo_entrega}]".strip()
    ruta_service.RegistrarEntregaParada({
        "IdPedido": dto.id_pedido,
        "LatitudEntrega": dto.latitud,
        "LongitudEntrega": dto.longitud,
        "Observacion": obs_final
    })

    # Guardar estado de visita e incidencias flexibles en paradas
    est_visita = getattr(dto, "estado_visita", None)
    if not est_visita:
        if dto.tipo_entrega == "PARCIAL":
            est_visita = "PIDIO_MENOS"
        else:
            est_visita = "ENTREGADO_COMPLETO"
    tipo_inc = getattr(dto, "tipo_incidencia", None) or (dto.observacion if est_visita in ("PIDIO_MAS", "PIDIO_MENOS") else None)

    db.execute(text("""
        UPDATE public."Pedido"
        SET "estado_visita" = :est_v,
            "tipo_incidencia" = :t_inc
        WHERE "IdPedido" = :pid;
    """), {
        "est_v": est_visita,
        "t_inc": tipo_inc,
        "pid": dto.id_pedido
    })

    # 7. Procesar bloque de cobro unificado (si fue enviado) en la misma transacción ACID
    datos_cobro_resumen = None
    if dto.cobro:
        tramos_procesados = []
        for p in dto.cobro.pagos:
            metodo_p = p.metodo.upper()
            ref_p = p.numero_referencia or f"MOVIL-{int(datetime.now().timestamp())}-{uuid.uuid4().hex[:4].upper()}"
            id_metodo_pago = _resolver_id_metodo_pago(db, metodo_p)
            obs_pago = f"[{metodo_p}] {dto.observacion or ''}".strip()
            if metodo_p in ("QR", "TRANSFERENCIA"):
                obs_pago += f" [PENDIENTE_APROBACION - Comprobante: {p.id_comprobante_archivo or p.url_comprobante}]"

            pago_db = ruta_service.RegistrarCobroParada({
                "IdPedido": dto.id_pedido,
                "IdMetodoPago": id_metodo_pago,
                "Monto": p.monto,
                "NumeroReferencia": ref_p,
                "LatitudCobro": dto.latitud,
                "LongitudCobro": dto.longitud,
                "Observacion": obs_pago
            })

            id_abono_creado = None
            id_cxc = None
            if metodo_p in ("QR", "TRANSFERENCIA"):
                id_cxc, id_abono_creado = _asegurar_cxc_y_abono_bancario_chofer(
                    db=db,
                    uid=uid,
                    id_pedido=dto.id_pedido,
                    metodo=metodo_p,
                    monto=p.monto,
                    numero_referencia=ref_p,
                    id_comprobante_archivo=p.id_comprobante_archivo,
                    url_comprobante=p.url_comprobante,
                    alcance=alcance,
                    observacion=dto.observacion
                )

            tramos_procesados.append({
                "metodo": metodo_p,
                "monto": p.monto,
                "numero_referencia": ref_p,
                "estado": "PENDIENTE_APROBACION" if metodo_p in ("QR", "TRANSFERENCIA") else "CONFIRMADO",
                "id_pago_pedido": pago_db.get("IdPagoPedido") if isinstance(pago_db, dict) else None,
                "id_abono_cuenta_cobrar": id_abono_creado,
                "id_cuenta_cobrar": id_cxc
            })

        cxc_resumen = None
        if dto.cobro.credito and dto.cobro.credito.saldo > 0:
            cxc_service = CuentasCobrarService(db)
            ped_info = db.execute(text("""
                SELECT p."IdCliente", c."IdSucursal", p."NumeroPedido"
                FROM public."Pedido" p
                JOIN public."Cliente" c ON p."IdCliente" = c."IdCliente"
                WHERE p."IdPedido" = :id_ped;
            """), {"id_ped": dto.id_pedido}).fetchone()

            if ped_info:
                id_cli = ped_info[0]
                suc_ped = ped_info[1] or sucursal_id
                plazo = dto.cobro.credito.plazo_dias or 15
                vencimiento = date.today() + timedelta(days=plazo)

                cxc_existente = db.execute(text("""
                    SELECT "IdCuentaCobrar" FROM public."CuentaCobrar" WHERE "IdPedido" = :id_ped LIMIT 1;
                """), {"id_ped": dto.id_pedido}).fetchone()

                if cxc_existente:
                    id_cxc_cred = cxc_existente[0]
                    db.execute(text("""
                        UPDATE public."CuentaCobrar"
                        SET "SaldoPendiente" = :saldo,
                            "FechaVencimiento" = :venc
                        WHERE "IdCuentaCobrar" = :id;
                    """), {"saldo": dto.cobro.credito.saldo, "venc": vencimiento, "id": id_cxc_cred})
                else:
                    nueva_cxc = cxc_service.repo.CrearCuentaCobrar({
                        "IdCliente": id_cli,
                        "IdPedido": dto.id_pedido,
                        "IdNotaVenta": None,
                        "NumeroNotaVenta": str(ped_info[2] or f"PED-{dto.id_pedido}"),
                        "NumeroNotaEntrega": f"NE-{dto.id_pedido}",
                        "FechaDespacho": date.today(),
                        "DiasMora": 0,
                        "IdEstadoCuentaCobrar": 1,
                        "MontoTotal": dto.cobro.monto_total,
                        "SaldoPendiente": dto.cobro.credito.saldo,
                        "FechaEmision": date.today(),
                        "FechaVencimiento": vencimiento,
                        "IdUsuarioRegistro": uid,
                        "Observacion": f"Crédito otorgado en entrega móvil (plazo: {plazo} días)"
                    })
                    id_cxc_cred = nueva_cxc["IdCuentaCobrar"]
                    db.execute(text('UPDATE public."CuentaCobrar" SET "IdSucursal" = :sid WHERE "IdCuentaCobrar" = :id;'), {
                        "sid": suc_ped,
                        "id": id_cxc_cred
                    })

                cxc_resumen = {
                    "id_cuenta_cobrar": id_cxc_cred,
                    "saldo_pendiente": dto.cobro.credito.saldo,
                    "plazo_dias": plazo,
                    "fecha_vencimiento": str(vencimiento),
                    "estado": "PENDIENTE"
                }

        datos_cobro_resumen = {
            "monto_total": dto.cobro.monto_total,
            "monto_pagado": sum(p.monto for p in dto.cobro.pagos),
            "saldo_credito": dto.cobro.credito.saldo if dto.cobro.credito else 0.0,
            "tramos": tramos_procesados,
            "cuenta_cobrar": cxc_resumen
        }

    # 8. Sincronizar o crear NotaVenta para visualización inmediata en Panel Web y Contabilidad
    _sincronizar_o_crear_nota_venta_entrega(
        db=db,
        id_pedido=dto.id_pedido,
        uid=uid,
        nombre_chofer=nombre_chofer_txt,
        url_firma_chofer=url_firma_chofer,
        url_firma_cliente=url_firma_cliente,
        recibido_por=dto.recibido_por,
        ci_receptor=dto.ci_receptor,
        sucursal_id=sucursal_id,
        datos_cobro=datos_cobro_resumen,
        observacion=dto.observacion
    )

    # 9. Verificar si hubo revalorización de precios reciente (Kevin)
    alerta_revalorizacion = None
    for pres_id in cantidades_a_entregar.keys():
        sql_rev = text("""
            SELECT "PrecioAnterior", "PrecioNuevo", "FechaRevalorizacion", "DetalleNotificacion"
            FROM public."RevalorizacionInventarioChofer"
            WHERE "IdChofer" = :cid AND "IdPresentacion" = :pid
            ORDER BY "FechaRevalorizacion" DESC
            LIMIT 1;
        """)
        rev_row = db.execute(sql_rev, {"cid": uid, "pid": pres_id}).fetchone()
        if rev_row:
            alerta_revalorizacion = (
                f"Pedido #{dto.id_pedido}: El precio fue recalculado por el servidor al sincronizar "
                f"(Original: Bs. {float(rev_row[0]):.2f} -> Actual: Bs. {float(rev_row[1]):.2f})."
            )
            break

    respuesta_datos = {
        "codigo": "EXITO",
        "mensaje": "Entrega y cobro registrados exitosamente en una sola transacción" if dto.cobro else "Entrega registrada exitosamente",
        "request_id": req_id,
        "datos": {
            "id_pedido": dto.id_pedido,
            "estado": "Entregado",
            "estado_pedido": "Entregado",
            "tipo_entrega": dto.tipo_entrega,
            "items_entregados": [
                {"presentacion_id": pid, "cantidad": cant}
                for pid, cant in cantidades_a_entregar.items()
            ],
            "recibido_por": dto.recibido_por,
            "alerta_revalorizacion": alerta_revalorizacion,
            "cobro": datos_cobro_resumen
        }
    }

    # 8. Guardar en idempotencia y confirmar transacción
    IdempotenciaService.registrar_respuesta(
        session=db,
        usuario_id=uid,
        clave=x_idempotency_key,
        endpoint=request.url.path,
        hash_cuerpo=hash_cuerpo,
        codigo_estado=200,
        cuerpo_respuesta=respuesta_datos
    )
    db.commit()

    return JSONResponse(status_code=200, content=respuesta_datos)


# ==============================================================================
# 4. REGISTRAR COBRO (MIXTOS, QR PENDIENTE_APROBACION, CRÉDITO)
# ==============================================================================
@ChoferMovilRouter.post("/cobrar")
async def registrar_cobro_movil(
    request: Request,
    dto: CobroMovilRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key")
):
    """
    Registra cobro simple o mixto para un pedido (Efectivo, QR, Transferencia, Crédito).
    Exige X-Idempotency-Key (UUID v4).
    Todo tramo de pago con QR o Transferencia exige comprobante fotográfico y nace como
    PENDIENTE_APROBACION para validación de Kevin en Contabilidad.
    """
    req_id = _obtener_request_id(request)
    uid = usuario["IdUsuario"]
    sucursal_id = alcance.sucursal_efectiva or usuario.get("IdSucursal", 1)

    # 0. Gatekeeper de Carga de Camión
    _validar_gatekeeper_carga_camion(db, dto.id_pedido, uid)

    cuerpo_bytes = await request.body()

    hash_cuerpo, respuesta_cacheada = _verificar_idempotencia_escritura(
        db, uid, request.url.path, x_idempotency_key, cuerpo_bytes
    )
    if respuesta_cacheada:
        return respuesta_cacheada

    # 1. Validar pertenencia del pedido
    _validar_pertenencia_pedido_chofer(db, dto.id_pedido, usuario, alcance)

    # 2. Validar suma de tramos contra monto total
    suma_tramos = sum(p.monto for p in dto.pagos)
    if abs(suma_tramos - dto.monto_total) > 0.01:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La suma de los tramos de pago ({suma_tramos:.2f}) no coincide con el total declarado ({dto.monto_total:.2f})."
        )

    # 3. Procesar cada tramo de pago
    tramos_procesados = []
    ruta_service = RutaService(db)

    for p in dto.pagos:
        metodo = p.metodo.upper()
        if metodo in ("QR", "TRANSFERENCIA"):
            # Exigir comprobante obligatorio
            if not p.id_comprobante_archivo and not p.url_comprobante:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Todo cobro con {metodo} exige obligatoriamente fotografía o ID de ComprobanteArchivo."
                )

        ref = p.numero_referencia or f"MOVIL-{int(datetime.now().timestamp())}-{uuid.uuid4().hex[:4].upper()}"

        # Resolver dinámicamente IdMetodoPago desde el catálogo MetodoPago
        id_metodo_pago = _resolver_id_metodo_pago(db, metodo)
        obs_pago = f"[{metodo}] {dto.observacion or ''}".strip()
        if metodo in ("QR", "TRANSFERENCIA"):
            obs_pago += f" [PENDIENTE_APROBACION - Comprobante: {p.id_comprobante_archivo or p.url_comprobante}]"

        pago_db = ruta_service.RegistrarCobroParada({
            "IdPedido": dto.id_pedido,
            "IdMetodoPago": id_metodo_pago,
            "Monto": p.monto,
            "NumeroReferencia": ref,
            "LatitudCobro": dto.latitud,
            "LongitudCobro": dto.longitud,
            "Observacion": obs_pago
        })

        # Si el método es QR o Transferencia, asentar en AbonoCuentaCobrar en estado PENDIENTE_APROBACION para Kevin
        id_abono_creado = None
        id_cxc = None
        if metodo in ("QR", "TRANSFERENCIA"):
            id_cxc, id_abono_creado = _asegurar_cxc_y_abono_bancario_chofer(
                db=db,
                uid=uid,
                id_pedido=dto.id_pedido,
                metodo=metodo,
                monto=p.monto,
                numero_referencia=ref,
                id_comprobante_archivo=p.id_comprobante_archivo,
                url_comprobante=p.url_comprobante,
                alcance=alcance,
                observacion=dto.observacion
            )

        tramos_procesados.append({
            "metodo": metodo,
            "monto": p.monto,
            "numero_referencia": ref,
            "estado": "PENDIENTE_APROBACION" if metodo in ("QR", "TRANSFERENCIA") else "CONFIRMADO",
            "id_pago_pedido": pago_db.get("IdPagoPedido") if isinstance(pago_db, dict) else None,
            "id_abono_cuenta_cobrar": id_abono_creado,
            "id_cuenta_cobrar": id_cxc
        })

    respuesta_datos = {
        "codigo": "EXITO",
        "mensaje": "Cobro registrado correctamente",
        "request_id": req_id,
        "datos": {
            "id_pedido": dto.id_pedido,
            "monto_total": dto.monto_total,
            "tramos": tramos_procesados
        }
    }

    # 4. Registrar idempotencia y confirmar
    IdempotenciaService.registrar_respuesta(
        session=db,
        usuario_id=uid,
        clave=x_idempotency_key,
        endpoint=request.url.path,
        hash_cuerpo=hash_cuerpo,
        codigo_estado=200,
        cuerpo_respuesta=respuesta_datos
    )
    db.commit()

    return JSONResponse(status_code=200, content=respuesta_datos)


# ==============================================================================
# 5. REGISTRAR NO-ENTREGA
# ==============================================================================
@ChoferMovilRouter.post("/no-entrega")
async def registrar_no_entrega_movil(
    request: Request,
    dto: NoEntregaMovilRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key")
):
    """
    Registra una parada no entregada con georreferenciación y motivo.
    Exige X-Idempotency-Key (UUID v4). No descuenta el inventario del camión.
    """
    req_id = _obtener_request_id(request)
    uid = usuario["IdUsuario"]
    sucursal_id = alcance.sucursal_efectiva or usuario.get("IdSucursal", 1)
    cuerpo_bytes = await request.body()

    hash_cuerpo, respuesta_cacheada = _verificar_idempotencia_escritura(
        db, uid, request.url.path, x_idempotency_key, cuerpo_bytes
    )
    if respuesta_cacheada:
        return respuesta_cacheada

    _validar_pertenencia_pedido_chofer(db, dto.id_pedido, usuario, alcance)

    est_visita = getattr(dto, "estado_visita", None)
    motivo_str = str(dto.motivo or "").strip()
    if not est_visita:
        m_lower = motivo_str.lower()
        if "cerrad" in m_lower or "no estab" in m_lower or "ausente" in m_lower:
            est_visita = "NO_ESTABA / CERRADO"
        elif "rechaz" in m_lower:
            est_visita = "RECHAZO_PEDIDO"
        elif "atrasad" in m_lower or "reprogram" in m_lower or "demor" in m_lower:
            est_visita = "ATRASADO / REPROGRAMADO"
        else:
            est_visita = motivo_str

    tipo_inc = getattr(dto, "tipo_incidencia", None) or motivo_str

    obs_no_entrega = f"[NO ENTREGADO - Motivo: {dto.motivo}]: {dto.observacion or ''}".strip()
    db.execute(text("""
        UPDATE public."Pedido"
        SET "IdEstadoPedido" = 4,
            "LatitudEntrega" = :lat,
            "LongitudEntrega" = :lng,
            "Observacion" = :obs,
            "estado_visita" = :est_v,
            "tipo_incidencia" = :t_inc
        WHERE "IdPedido" = :id_ped;
    """), {
        "lat": dto.latitud,
        "lng": dto.longitud,
        "obs": obs_no_entrega,
        "est_v": est_visita,
        "t_inc": tipo_inc,
        "id_ped": dto.id_pedido
    })

    respuesta_datos = {
        "codigo": "EXITO",
        "mensaje": "No entrega registrada exitosamente",
        "request_id": req_id,
        "datos": {
            "id_pedido": dto.id_pedido,
            "motivo": dto.motivo,
            "estado": "NO_ENTREGADO"
        }
    }

    IdempotenciaService.registrar_respuesta(
        session=db,
        usuario_id=uid,
        clave=x_idempotency_key,
        endpoint=request.url.path,
        hash_cuerpo=hash_cuerpo,
        codigo_estado=200,
        cuerpo_respuesta=respuesta_datos
    )
    db.commit()

    return JSONResponse(status_code=200, content=respuesta_datos)


# ==============================================================================
# 6. CIERRE DE TURNO COMPLETO (ARQUEO, CUADRE STOCK, MERMAS, FIRMA)
# ==============================================================================
@ChoferMovilRouter.post("/cierre-turno")
async def registrar_cierre_turno_movil(
    request: Request,
    dto: CierreTurnoMovilRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key")
):
    """
    Cierre definitivo de turno del chofer:
    (a) Arqueo financiero desglosado (Efectivo vs QR/Transferencia vs Crédito).
    (b) Cuadre físico de inventario de camión (devueltos a almacén y declaración de mermas/faltantes).
    (c) Firma digital de conformidad.
    Exige X-Idempotency-Key (UUID v4) y conexión obligatoria.
    """
    req_id = _obtener_request_id(request)
    uid = usuario["IdUsuario"]
    sucursal_id = alcance.sucursal_efectiva or usuario.get("IdSucursal", 1)
    cuerpo_bytes = await request.body()

    hash_cuerpo, respuesta_cacheada = _verificar_idempotencia_escritura(
        db, uid, request.url.path, x_idempotency_key, cuerpo_bytes
    )
    if respuesta_cacheada:
        return respuesta_cacheada

    # Validar pertenencia de la asignación
    sql_asig = text("""
        SELECT ar."IdUsuarioRepartidor", r."IdSucursal"
        FROM public."AsignacionRuta" ar
        JOIN public."RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
        WHERE ar."IdAsignacionRuta" = :id;
    """)
    asig_row = db.execute(sql_asig, {"id": dto.id_asignacion}).fetchone()
    if not asig_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación no encontrada")

    if usuario.get("IdRol") == ROL_AGENTE_REPARTO and asig_row.IdUsuarioRepartidor != uid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación no pertenece a su usuario")

    alcance.validar_recurso(asig_row.IdSucursal, nombre_recurso="asignacion", responder_404=True)

    # Armar payload para CuentasCobrarService.ProcesarCierreTurnoChofer
    stock_devuelto_dict = {
        item.presentacion_id: item.cantidad_devuelta
        for item in dto.stock_devuelto
    }

    req_cierre = CierreTurnoChoferRequest(
        IdUsuarioRepartidor=uid,
        IdSucursal=asig_row.IdSucursal,
        IdAsignacionRuta=dto.id_asignacion,
        MontoEfectivoEntregado=dto.monto_efectivo_entregado,
        MontoTransferenciaReportada=dto.monto_transferencia_reportada,
        MontoQrReportado=dto.monto_qr_reportado,
        StockDevueltoFisico=stock_devuelto_dict,
        Observaciones=dto.observaciones,
        SobrantePermaneceEnCamion=dto.sobrante_permanece_en_camion,
        ValorSobranteRevalorizado=dto.valor_sobrante_revalorizado or 0.0
    )

    cxc_service = CuentasCobrarService(db)
    resultado_cierre = cxc_service.ProcesarCierreTurnoChofer(req_cierre, id_usuario=uid)

    # Registrar firma digital de conformidad en Storage
    url_firma_cierre = _guardar_firma_como_archivo(
        session=db,
        firma_str=dto.firma_chofer,
        prefijo_archivo="firma_cierre_asig",
        entidad_origen="FIRMA_CIERRE_TURNO",
        id_registro=dto.id_asignacion,
        sucursal_id=sucursal_id,
        chofer_id=uid
    )

    db.execute(text("""
        INSERT INTO public."FirmaDigitalDocumento" (
            "IdUsuario", "TipoDocumento", "IdRegistroDocumento", "CodigoReferencia",
            "UrlFotoFirmaSello", "Observaciones", "FechaFirma"
        ) VALUES (
            :uid, 'CIERRE_TURNO', :id_asig, :cod_ref,
            :firma, :obs, NOW()
        );
    """), {
        "uid": uid,
        "id_asig": dto.id_asignacion,
        "cod_ref": f"ASIG-{dto.id_asignacion}",
        "firma": url_firma_cierre,
        "obs": f"Cierre de turno de conformidad por el chofer #{uid}."
    })

    # Cerrar la asignación de ruta
    db.execute(text("""
        UPDATE public."AsignacionRuta"
        SET "Estado" = 'Finalizada',
            "Observacion" = COALESCE(:obs, "Observacion")
        WHERE "IdAsignacionRuta" = :id;
    """), {"id": dto.id_asignacion, "obs": dto.observaciones})

    respuesta_datos = {
        "codigo": "EXITO",
        "mensaje": "Cierre de turno completado y conciliado exitosamente",
        "request_id": req_id,
        "datos": {
            "id_rendicion": resultado_cierre.IdRendicionRuta,
            "id_asignacion": dto.id_asignacion,
            "estado_conciliacion": resultado_cierre.EstadoConciliacion,
            "monto_faltante_bs": resultado_cierre.MontoTotalFaltante,
            "cantidad_merma": resultado_cierre.CantidadTotalMerma,
            "total_ventas_bs": resultado_cierre.TotalVentasBs
        }
    }

    IdempotenciaService.registrar_respuesta(
        session=db,
        usuario_id=uid,
        clave=x_idempotency_key,
        endpoint=request.url.path,
        hash_cuerpo=hash_cuerpo,
        codigo_estado=200,
        cuerpo_respuesta=respuesta_datos
    )
    db.commit()

    return JSONResponse(status_code=200, content=respuesta_datos)


# ==============================================================================
# 7. SINCRONIZACIÓN BATCH OFFLINE CON IDEMPOTENCIA
# ==============================================================================
@ChoferMovilRouter.post("/sincronizar-batch")
async def sincronizar_batch_movil(
    request: Request,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key")
):
    """
    Sincroniza un lote de transacciones generadas offline.
    Cada operación individual es evaluada de manera transaccional e idempotente.
    """
    req_id = _obtener_request_id(request)
    uid = usuario["IdUsuario"]
    sucursal_id = alcance.sucursal_efectiva or usuario.get("IdSucursal", 1)
    cuerpo_bytes = await request.body()

    hash_cuerpo, respuesta_cacheada = _verificar_idempotencia_escritura(
        db, uid, request.url.path, x_idempotency_key, cuerpo_bytes
    )
    if respuesta_cacheada:
        return respuesta_cacheada

    import json
    cuerpo_json = json.loads(cuerpo_bytes.decode("utf-8")) if cuerpo_bytes else {}
    operaciones = cuerpo_json.get("operaciones", [])

    sincronizados = []
    errores = []

    for op in operaciones:
        op_id = op.get("id") or op.get("idempotency_key") or op.get("id_operacion")
        tipo = op.get("tipo")
        payload = op.get("payload") or op.get("datos") or {}
        gps = op.get("gps", {})
        lat = gps.get("latitud") or payload.get("latitud") or -19.0483
        lng = gps.get("longitud") or payload.get("longitud") or -65.2598

        try:
            if tipo == "ENTREGA":
                id_pedido = payload.get("id_pedido") or payload.get("IdPedido")
                _validar_pertenencia_pedido_chofer(db, int(id_pedido), usuario, alcance)
                # Registrar entrega
                ruta_service = RutaService(db)
                ruta_service.RegistrarEntregaParada({
                    "IdPedido": int(id_pedido),
                    "LatitudEntrega": lat,
                    "LongitudEntrega": lng,
                    "Observacion": payload.get("observacion") or f"Entregado offline a {payload.get('recibido_por', 'Cliente')}"
                })
                sincronizados.append(op_id)

            elif tipo == "COBRO":
                id_pedido = payload.get("id_pedido") or payload.get("IdPedido")
                _validar_pertenencia_pedido_chofer(db, int(id_pedido), usuario, alcance)
                monto_total = float(payload.get("monto_total") or payload.get("monto") or payload.get("Monto") or 0.0)
                pagos = payload.get("pagos")

                ruta_service = RutaService(db)

                if isinstance(pagos, list) and len(pagos) > 0:
                    for p in pagos:
                        met = (p.get("metodo") or "EFECTIVO").upper()
                        m_tramo = float(p.get("monto") or 0.0)
                        id_comp = p.get("id_comprobante_archivo")
                        url_comp = p.get("url_comprobante")
                        ref = p.get("numero_referencia") or f"BATCH-{uuid.uuid4().hex[:6].upper()}"
                        id_met = _resolver_id_metodo_pago(db, met)

                        obs_pago = f"[{met}] {payload.get('observacion') or 'Cobro sincronizado en lote'}".strip()
                        if met in ("QR", "TRANSFERENCIA"):
                            obs_pago += f" [PENDIENTE_APROBACION - Comprobante: {id_comp or url_comp}]"

                        ruta_service.RegistrarCobroParada({
                            "IdPedido": int(id_pedido),
                            "IdMetodoPago": id_met,
                            "Monto": m_tramo,
                            "NumeroReferencia": ref,
                            "LatitudCobro": lat,
                            "LongitudCobro": lng,
                            "Observacion": obs_pago
                        })

                        if met in ("QR", "TRANSFERENCIA"):
                            _asegurar_cxc_y_abono_bancario_chofer(
                                db=db,
                                uid=uid,
                                id_pedido=int(id_pedido),
                                metodo=met,
                                monto=m_tramo,
                                numero_referencia=ref,
                                id_comprobante_archivo=id_comp,
                                url_comprobante=url_comp,
                                alcance=alcance,
                                observacion="Sincronización batch offline"
                            )
                else:
                    met = (payload.get("metodo") or "EFECTIVO").upper()
                    id_comp = payload.get("id_comprobante_archivo")
                    url_comp = payload.get("url_comprobante")
                    ref = payload.get("numero_referencia") or f"BATCH-{uuid.uuid4().hex[:6].upper()}"
                    id_met = _resolver_id_metodo_pago(db, met)

                    obs_pago = f"[{met}] {payload.get('observacion') or 'Cobro sincronizado en lote'}".strip()
                    if met in ("QR", "TRANSFERENCIA"):
                        obs_pago += f" [PENDIENTE_APROBACION - Comprobante: {id_comp or url_comp}]"

                    ruta_service.RegistrarCobroParada({
                        "IdPedido": int(id_pedido),
                        "IdMetodoPago": id_met,
                        "Monto": monto_total,
                        "NumeroReferencia": ref,
                        "LatitudCobro": lat,
                        "LongitudCobro": lng,
                        "Observacion": obs_pago
                    })

                    if met in ("QR", "TRANSFERENCIA"):
                        _asegurar_cxc_y_abono_bancario_chofer(
                            db=db,
                            uid=uid,
                            id_pedido=int(id_pedido),
                            metodo=met,
                            monto=monto_total,
                            numero_referencia=ref,
                            id_comprobante_archivo=id_comp,
                            url_comprobante=url_comp,
                            alcance=alcance,
                            observacion="Sincronización batch offline"
                        )
                sincronizados.append(op_id)

            elif tipo == "ALTA_CLIENTE":
                _crear_cliente_y_punto_venta_en_ruta(
                    db=db,
                    uid=uid,
                    payload=payload,
                    lat=lat,
                    lng=lng,
                    alcance=alcance
                )
                sincronizados.append(op_id)

            elif tipo == "NO_ENTREGA":
                id_pedido = payload.get("id_pedido") or payload.get("IdPedido")
                _validar_pertenencia_pedido_chofer(db, int(id_pedido), usuario, alcance)
                motivo = payload.get("motivo") or "Cliente Ausente"
                db.execute(text("""
                    UPDATE public."Pedido"
                    SET "IdEstadoPedido" = 4,
                        "LatitudEntrega" = :lat,
                        "LongitudEntrega" = :lng,
                        "Observacion" = :obs
                    WHERE "IdPedido" = :id_ped;
                """), {"lat": lat, "lng": lng, "obs": f"[NO ENTREGADO]: {motivo}", "id_ped": int(id_pedido)})
                sincronizados.append(op_id)

            else:
                sincronizados.append(op_id)

        except Exception as ex:
            errores.append({"id": op_id, "error": str(ex)})

    respuesta_datos = {
        "codigo": "EXITO" if len(errores) == 0 else "PARCIAL",
        "mensaje": f"Sincronización procesada: {len(sincronizados)} éxitos, {len(errores)} fallos",
        "request_id": req_id,
        "datos": {
            "total": len(operaciones),
            "sincronizados": sincronizados,
            "errores": errores
        }
    }

    IdempotenciaService.registrar_respuesta(
        session=db,
        usuario_id=uid,
        clave=x_idempotency_key,
        endpoint=request.url.path,
        hash_cuerpo=hash_cuerpo,
        codigo_estado=200,
        cuerpo_respuesta=respuesta_datos
    )
    db.commit()

    return JSONResponse(status_code=200, content=respuesta_datos)


# ==============================================================================
# 8. SUBIDA DE ARCHIVOS Y COMPROBANTES (COMPROBANTEARCHIVO, <= 5MB)
# ==============================================================================
@ChoferMovilRouter.post("/subir-archivo")
def subir_comprobante_archivo_movil(
    request: Request,
    archivo: UploadFile = File(...),
    entidad_origen: str = Form("COMPROBANTE_COBRO"),
    id_registro_origen: int = Form(1),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Sube un archivo de comprobante, fotografía o firma digital.
    Valida tamaño máximo (5MB) y formato permitido. Registra en ComprobanteArchivo
    con política de depuración automática a los 60 días.
    """
    req_id = _obtener_request_id(request)
    uid = usuario["IdUsuario"]
    sucursal_id = alcance.sucursal_efectiva or usuario.get("IdSucursal", 1)

    resultado = FileStorageService.guardar_comprobante(
        session=db,
        archivo=archivo,
        entidad_origen=entidad_origen,
        id_registro_origen=id_registro_origen,
        id_sucursal=sucursal_id,
        id_chofer=uid
    )
    db.commit()

    return MovilResponse[Dict[str, Any]](
        codigo="EXITO",
        mensaje="Archivo subido y registrado exitosamente",
        request_id=req_id,
        datos=resultado
    )


# ==============================================================================
# 9. ALTA DE NUEVO CLIENTE Y PUNTO DE VENTA EN RUTA
# ==============================================================================
@ChoferMovilRouter.post("/clientes", response_model=MovilResponse[Dict[str, Any]])
async def registrar_nuevo_cliente_movil(
    request: Request,
    dto: ClienteMovilRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key")
):
    """
    Registra un nuevo cliente y su punto de venta asignado forzosamente a la sucursal del chofer.
    Exige X-Idempotency-Key (UUID v4).
    """
    req_id = _obtener_request_id(request)
    uid = usuario["IdUsuario"]
    sucursal_id = alcance.sucursal_efectiva or usuario.get("IdSucursal", 1)
    cuerpo_bytes = await request.body()

    hash_cuerpo, respuesta_cacheada = _verificar_idempotencia_escritura(
        db, uid, request.url.path, x_idempotency_key, cuerpo_bytes
    )
    if respuesta_cacheada:
        return respuesta_cacheada

    IdempotenciaService.registrar_respuesta(
        session=db,
        usuario_id=uid,
        clave=x_idempotency_key,
        endpoint=request.url.path,
        hash_cuerpo=hash_cuerpo,
        codigo_estado=200,
        cuerpo_respuesta=respuesta_datos
    )
    db.commit()

    return JSONResponse(status_code=200, content=respuesta_datos)


# ==============================================================================
# 10. SOLICITUD DE CARGA DE CAMIÓN (GATEKEEPER)
# ==============================================================================
@ChoferMovilRouter.post("/solicitar-carga")
async def solicitar_carga_camion_movil(
    request: Request,
    dto: SolicitarCargaRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key")
):
    """
    Registra una solicitud de carga de camión para la asignación activa del chofer.
    Pasa el estado operativo a CARGA_SOLICITADA (habilitada_para_reparto: false).
    Si ya se encuentra en CARGA_SOLICITADA o existe solicitud pendiente, responde 200 idempotente.
    """
    req_id = _obtener_request_id(request)
    uid = usuario["IdUsuario"]
    cuerpo_bytes = await request.body()

    if x_idempotency_key:
        hash_cuerpo, respuesta_cacheada = _verificar_idempotencia_escritura(
            db, uid, request.url.path, x_idempotency_key, cuerpo_bytes
        )
        if respuesta_cacheada:
            return respuesta_cacheada

    # Verificar asignación
    sql_asig = text("""
        SELECT ar."IdAsignacionRuta", ar."IdUsuarioRepartidor", r."IdSucursal", ar."estado_operativo"
        FROM public."AsignacionRuta" ar
        JOIN public."RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
        WHERE ar."IdAsignacionRuta" = :id_asig;
    """)
    asig = db.execute(sql_asig, {"id_asig": dto.id_asignacion}).fetchone()
    if not asig:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación no encontrada")

    if usuario.get("IdRol") in (ROL_AGENTE_REPARTO, 6, 7) and asig.IdUsuarioRepartidor != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para esta asignación")

    # Idempotencia: Verificar si ya existe una solicitud en estado PENDIENTE o si ya está en CARGA_SOLICITADA
    sql_sol_existente = text("""
        SELECT s."id_solicitud", s."estado", s."fecha_solicitud", s."observacion_chofer"
        FROM public."solicitud_carga_camion" s
        WHERE s."id_asignacion_ruta" = :id_asig AND s."estado" = 'PENDIENTE'
        ORDER BY s."id_solicitud" DESC LIMIT 1;
    """)
    sol_existente = db.execute(sql_sol_existente, {"id_asig": dto.id_asignacion}).mappings().fetchone()

    if sol_existente or asig.estado_operativo == "CARGA_SOLICITADA":
        id_sol_existente = sol_existente["id_solicitud"] if sol_existente else None
        items_existentes = []
        if id_sol_existente:
            sql_items_existentes = text("""
                SELECT 
                    d."id_detalle",
                    d."id_presentacion",
                    pp."CodigoPresentacion",
                    prod."NombreProducto",
                    pp."TipoContenedor",
                    COALESCE(d."stock_remanente", 0) as "stock_remanente",
                    COALESCE(d."stock_adicional_solicitado", 0) as "stock_adicional_solicitado",
                    COALESCE(d."stock_adicional_aprobado", 0) as "stock_adicional_aprobado"
                FROM public."detalle_solicitud_carga_camion" d
                JOIN public."PresentacionProducto" pp ON d."id_presentacion" = pp."IdPresentacion"
                JOIN public."Producto" prod ON pp."IdProducto" = prod."IdProducto"
                WHERE d."id_solicitud" = :sid
                ORDER BY prod."NombreProducto" ASC;
            """)
            items_existentes = [dict(it) for it in db.execute(sql_items_existentes, {"sid": id_sol_existente}).mappings().fetchall()]

        resp_idempotente = {
            "codigo": "EXITO",
            "mensaje": "Solicitud de carga ya registrada previamente.",
            "request_id": req_id,
            "datos": {
                "id_solicitud": id_sol_existente,
                "id_asignacion": dto.id_asignacion,
                "estado_operativo": "CARGA_SOLICITADA",
                "solicitud_carga_pendiente": True,
                "habilitada_para_reparto": False,
                "items_solicitados": items_existentes,
                "solicitud_carga_items": items_existentes
            }
        }
        if x_idempotency_key:
            _registrar_respuesta_idempotente(
                session=db,
                usuario_id=uid,
                clave=x_idempotency_key,
                endpoint=request.url.path,
                hash_cuerpo=hash_cuerpo,
                codigo_estado=200,
                cuerpo_respuesta=resp_idempotente
            )
            db.commit()
        return JSONResponse(status_code=200, content=resp_idempotente)

    # Nombre del chofer
    sql_chofer = text('SELECT CONCAT("PrimerNombre", \' \', "ApellidoPaterno") FROM public."Usuario" WHERE "IdUsuario" = :uid LIMIT 1;')
    nombre_chofer = db.execute(sql_chofer, {"uid": uid}).scalar() or f"Chofer #{uid}"

    # Crear registro en solicitud_carga_camion
    sql_ins = text("""
        INSERT INTO public."solicitud_carga_camion" (
            "id_asignacion_ruta", "id_chofer", "estado", "observacion_chofer", "fecha_solicitud"
        ) VALUES (
            :id_asig, :id_chofer, 'PENDIENTE', :obs, NOW()
        ) RETURNING "id_solicitud";
    """)
    sol_row = db.execute(sql_ins, {
        "id_asig": dto.id_asignacion,
        "id_chofer": uid,
        "obs": dto.observacion or ""
    }).fetchone()
    id_solicitud = sol_row[0]

    # Insertar detalles
    items_solicitados_ws = []
    total_remanente = 0.0
    for item in dto.items:
        remanente = 0.0
        if dto.usar_remanente:
            sql_rem = text("""
                SELECT COALESCE(cantidad_remanente, 0)
                FROM public.inventario_chofer
                WHERE chofer_id = :uid AND presentacion_id = :pid
                ORDER BY id DESC LIMIT 1;
            """)
            r = db.execute(sql_rem, {"uid": uid, "pid": item.presentacion_id}).scalar()
            remanente = float(r or 0.0)

        total_remanente += remanente

        sql_det = text("""
            INSERT INTO public."detalle_solicitud_carga_camion" (
                "id_solicitud", "id_presentacion", "stock_remanente", "stock_adicional_solicitado"
            ) VALUES (
                :id_sol, :pid, :rem, :cant
            );
        """)
        db.execute(sql_det, {
            "id_sol": id_solicitud,
            "pid": item.presentacion_id,
            "rem": remanente,
            "cant": item.cantidad_solicitada
        })

        items_solicitados_ws.append({
            "id_presentacion": item.presentacion_id,
            "stock_remanente": remanente,
            "stock_adicional_solicitado": item.cantidad_solicitada
        })

    # Actualizar estado_operativo de AsignacionRuta a CARGA_SOLICITADA
    db.execute(text("""
        UPDATE public."AsignacionRuta"
        SET "estado_operativo" = 'CARGA_SOLICITADA'
        WHERE "IdAsignacionRuta" = :id_asig;
    """), {"id_asig": dto.id_asignacion})

    # Guardar NotificacionInterna para Supervisores/Administradores de esa sucursal
    supervisores = db.execute(text("""
        SELECT "IdUsuario" FROM public."Usuario"
        WHERE ("IdSucursal" = :suc_id OR "IdSucursal" IS NULL)
          AND "IdRol" IN (1, 2, 3, 5)
          AND "IdEstadoUsuario" = 1;
    """), {"suc_id": asig.IdSucursal}).fetchall()

    nom_suc = _obtener_nombre_sucursal(db, asig.IdSucursal)

    if supervisores:
        for sup in supervisores:
            db.execute(text("""
                INSERT INTO public."NotificacionInterna" (
                    "IdUsuarioDestinatario", "Titulo", "Mensaje", "Tipo", "CodigoReferencia", "Leido", "FechaCreacion"
                ) VALUES (
                    :uid_dest, 'Solicitud de Carga Recibida', :msg, 'SOLICITUD_CARGA', :ref, false, NOW()
                );
            """), {
                "uid_dest": sup.IdUsuario,
                "msg": f"El chofer {nombre_chofer} ha solicitado carga de camión para la asignación #{dto.id_asignacion} en {nom_suc}.",
                "ref": id_solicitud
            })
    else:
        db.execute(text("""
            INSERT INTO public."NotificacionInterna" (
                "IdUsuarioDestinatario", "Titulo", "Mensaje", "Tipo", "CodigoReferencia", "Leido", "FechaCreacion"
            ) VALUES (
                NULL, 'Solicitud de Carga Recibida', :msg, 'SOLICITUD_CARGA', :ref, false, NOW()
            );
        """), {
            "msg": f"El chofer {nombre_chofer} ha solicitado carga de camión para la asignación #{dto.id_asignacion} en {nom_suc}.",
            "ref": id_solicitud
        })

    db.commit()

    # Emitir WebSocket evento solicitud_carga_recibida con formato requerido
    evento_ws = {
        "tipo": "solicitud_carga_recibida",
        "id_solicitud": id_solicitud,
        "id_asignacion": dto.id_asignacion,
        "id_chofer": uid,
        "nombre_chofer": nombre_chofer,
        "sucursal_id": asig.IdSucursal,
        "id_sucursal": asig.IdSucursal,
        "nombre_sucursal": nom_suc,
        "items_solicitados": items_solicitados_ws,
        "stock_remanente": total_remanente,
        "fecha": datetime.now(timezone.utc).isoformat()
    }
    try:
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(flota_ws_manager.emitir_a_web(evento_ws, asig.IdSucursal))
        except RuntimeError:
            asyncio.run(flota_ws_manager.emitir_a_web(evento_ws, asig.IdSucursal))
    except Exception as e:
        logger.debug(f"[WS solicitud-carga] Error emitiendo ws: {e}")

    respuesta = {
        "codigo": "EXITO",
        "mensaje": "Solicitud de carga registrada exitosamente.",
        "request_id": req_id,
        "datos": {
            "id_solicitud": id_solicitud,
            "id_asignacion": dto.id_asignacion,
            "estado_operativo": "CARGA_SOLICITADA",
            "solicitud_carga_pendiente": True,
            "habilitada_para_reparto": False,
            "items_solicitados": items_solicitados_ws,
            "solicitud_carga_items": items_solicitados_ws
        }
    }

    if x_idempotency_key:
        _registrar_respuesta_idempotente(
            session=db,
            usuario_id=uid,
            clave=x_idempotency_key,
            endpoint=request.url.path,
            hash_cuerpo=hash_cuerpo,
            codigo_estado=200,
            cuerpo_respuesta=respuesta
        )
        db.commit()

    return JSONResponse(status_code=200, content=respuesta)


# ==============================================================================
# 11. RESUMEN DE SINCRONIZACIÓN MÓVIL
# ==============================================================================
@ChoferMovilRouter.get("/resumen-sincronizacion")
def obtener_resumen_sincronizacion_movil(
    request: Request,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Devuelve la asignación activa (con estado_operativo, habilitada_para_reparto y paradas),
    el inventario actual en camión y el historial de operaciones de hoy (con estado_revision_web).
    """
    uid = usuario["IdUsuario"]
    service = RutaService(db)

    # 1. Asignación activa
    sql_asig = text("""
        SELECT 
            ar."IdAsignacionRuta",
            ar."IdRutaDistribucion",
            r."NombreRuta",
            ar."FechaAsignacion",
            ar."Estado",
            COALESCE(ar."estado_operativo", 'PENDIENTE_CARGA') AS estado_operativo,
            ar."KilometrajeInicial",
            ar."KilometrajeFinal",
            ar."Observacion"
        FROM public."AsignacionRuta" ar
        JOIN public."RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
        WHERE ar."IdUsuarioRepartidor" = :uid
          AND (ar."FechaAsignacion" = CURRENT_DATE OR ar."Estado" NOT IN ('Finalizada', 'Cancelada'))
        ORDER BY 
            (ar."FechaAsignacion" = CURRENT_DATE) DESC,
            CASE 
                WHEN UPPER(COALESCE(ar."estado_operativo", 'PENDIENTE_CARGA')) IN ('APROBADA_EN_RUTA', 'EN_RUTA') THEN 1
                WHEN UPPER(COALESCE(ar."estado_operativo", 'PENDIENTE_CARGA')) = 'CARGA_SOLICITADA' THEN 2
                WHEN UPPER(COALESCE(ar."estado_operativo", 'PENDIENTE_CARGA')) IN ('OBSERVADA', 'RECHAZADA', 'CARGA_OBSERVADA', 'CARGA_RECHAZADA') THEN 3
                WHEN UPPER(COALESCE(ar."estado_operativo", 'PENDIENTE_CARGA')) = 'PENDIENTE_CARGA' THEN 4
                ELSE 5
            END ASC,
            ar."IdAsignacionRuta" DESC
        LIMIT 1;
    """)
    asig_row = db.execute(sql_asig, {"uid": uid}).mappings().fetchone()

    asignacion_activa = None
    if asig_row:
        id_asig = asig_row["IdAsignacionRuta"]
        estado_op = asig_row["estado_operativo"]
        tracking = service.ObtenerTrackingAsignacion(id_asig)
        paradas = tracking.get("Paradas", [])

        # Fallback si tracking no tiene paradas
        if not paradas:
            sql_ped_fb2 = text("""
                SELECT 
                    ROW_NUMBER() OVER (ORDER BY p."IdPedido" ASC) as "OrdenVisita",
                    pv."IdPuntoVenta",
                    pv."NombrePuntoVenta",
                    pv."Direccion",
                    pv."Latitud",
                    pv."Longitud",
                    pv."Referencia",
                    c."IdCliente",
                    COALESCE(c."NombreComercial", c."RazonSocial") as "NombreCliente",
                    c."Telefono" as "TelefonoCliente",
                    p."IdPedido",
                    p."NumeroPedido",
                    p."MontoTotal" as "MontoPedido",
                    p."IdEstadoPedido",
                    COALESCE(p."estado_visita", '') as "estado_visita",
                    COALESCE(p."tipo_incidencia", '') as "tipo_incidencia",
                    CASE 
                        WHEN p."IdEstadoPedido" = 3 THEN 'Entregado'
                        WHEN p."IdEstadoPedido" = 2 THEN 'En Camino'
                        WHEN p."IdEstadoPedido" = 4 THEN 'Cancelado'
                        WHEN p."IdPedido" IS NOT NULL THEN 'Pendiente'
                        ELSE 'Visita Comercial'
                    END as "EstadoEntrega",
                    p."LatitudEntrega",
                    p."LongitudEntrega",
                    p."FechaEntrega",
                    0.0 as "MontoCobrado"
                FROM public."Pedido" p
                JOIN public."PuntoVenta" pv ON p."IdPuntoVenta" = pv."IdPuntoVenta"
                JOIN public."Cliente" c ON pv."IdCliente" = c."IdCliente"
                WHERE p."IdAsignacionRuta" = :id_asig
                ORDER BY p."IdPedido" ASC;
            """)
            paradas = [dict(r) for r in db.execute(sql_ped_fb2, {"id_asig": id_asig}).mappings().fetchall()]

        if not paradas:
            id_ruta_asig2 = asig_row["IdRutaDistribucion"]
            if id_ruta_asig2:
                sql_pv_fb2 = text("""
                    SELECT 
                        ROW_NUMBER() OVER (ORDER BY pv."IdPuntoVenta" ASC) as "OrdenVisita",
                        pv."IdPuntoVenta",
                        pv."NombrePuntoVenta",
                        pv."Direccion",
                        pv."Latitud",
                        pv."Longitud",
                        pv."Referencia",
                        c."IdCliente",
                        COALESCE(c."NombreComercial", c."RazonSocial") as "NombreCliente",
                        c."Telefono" as "TelefonoCliente",
                        NULL::integer as "IdPedido",
                        NULL::varchar as "NumeroPedido",
                        0.0 as "MontoPedido",
                        NULL::integer as "IdEstadoPedido",
                        '' as "estado_visita",
                        '' as "tipo_incidencia",
                        'Visita Comercial' as "EstadoEntrega",
                        NULL::numeric as "LatitudEntrega",
                        NULL::numeric as "LongitudEntrega",
                        NULL::timestamp as "FechaEntrega",
                        0.0 as "MontoCobrado"
                    FROM public."PuntoVenta" pv
                    JOIN public."Cliente" c ON pv."IdCliente" = c."IdCliente"
                    JOIN public."RutaDistribucion" r ON r."IdRutaDistribucion" = :rid
                    WHERE (c."IdSucursal" = r."IdSucursal" OR pv."IdZona" = r."IdZonaDistribucion")
                      AND pv."Activo" = true
                    ORDER BY pv."IdPuntoVenta" ASC
                    LIMIT 10;
                """)
                paradas = [dict(r) for r in db.execute(sql_pv_fb2, {"rid": id_ruta_asig2}).mappings().fetchall()]

        # Enriquecer paradas con items del pedido
        for p in paradas:
            id_ped = p.get("IdPedido")
            if id_ped:
                sql_det = text("""
                    SELECT dp."IdPresentacion", prod."NombreProducto", dp."Cantidad",
                           dp."PrecioUnitarioAplicado", dp."Subtotal",
                           COALESCE(p."estado_revision_web", 'PENDIENTE') AS estado_revision_web
                    FROM public."DetallePedido" dp
                    JOIN public."Pedido" p ON dp."IdPedido" = p."IdPedido"
                    JOIN public."PresentacionProducto" pp ON dp."IdPresentacion" = pp."IdPresentacion"
                    JOIN public."Producto" prod ON pp."IdProducto" = prod."IdProducto"
                    WHERE dp."IdPedido" = :id_ped;
                """)
                items_p = db.execute(sql_det, {"id_ped": id_ped}).mappings().fetchall()
                p["items"] = [dict(it) for it in items_p]

        # Verificar solicitud de carga de camión más reciente
        sql_sol_pend = text("""
            SELECT s."id_solicitud", s."estado", s."fecha_solicitud", s."observacion_chofer", s."observacion_admin"
            FROM public."solicitud_carga_camion" s
            WHERE s."id_asignacion_ruta" = :id_asig
            ORDER BY s."id_solicitud" DESC LIMIT 1;
        """)
        sol_pend = db.execute(sql_sol_pend, {"id_asig": id_asig}).mappings().fetchone()

        items_solicitados = []
        if sol_pend:
            sql_items_sol = text("""
                SELECT 
                    d."id_detalle",
                    d."id_presentacion",
                    pp."CodigoPresentacion",
                    prod."NombreProducto",
                    pp."TipoContenedor",
                    COALESCE(d."stock_remanente", 0) as "stock_remanente",
                    COALESCE(d."stock_adicional_solicitado", 0) as "stock_adicional_solicitado",
                    COALESCE(d."stock_adicional_aprobado", 0) as "stock_adicional_aprobado"
                FROM public."detalle_solicitud_carga_camion" d
                JOIN public."PresentacionProducto" pp ON d."id_presentacion" = pp."IdPresentacion"
                JOIN public."Producto" prod ON pp."IdProducto" = prod."IdProducto"
                WHERE d."id_solicitud" = :sid
                ORDER BY prod."NombreProducto" ASC;
            """)
            items_solicitados = [dict(it) for it in db.execute(sql_items_sol, {"sid": sol_pend["id_solicitud"]}).mappings().fetchall()]

        if sol_pend:
            st_sol = str(sol_pend["estado"]).strip().upper()
            if st_sol == "PENDIENTE":
                estado_op = "CARGA_SOLICITADA"
            elif st_sol in ("APROBADA", "APROBADO"):
                estado_op = "APROBADA_EN_RUTA"
            elif st_sol in ("OBSERVADA", "OBSERVADO", "CARGA_OBSERVADA"):
                estado_op = "CARGA_OBSERVADA"
            elif st_sol in ("RECHAZADA", "RECHAZADO", "CARGA_RECHAZADA"):
                estado_op = "CARGA_RECHAZADA"

        es_pendiente_carga = (estado_op == "CARGA_SOLICITADA")

        asignacion_activa = {
            "id_asignacion": id_asig,
            "id_ruta": asig_row["IdRutaDistribucion"],
            "nombre_ruta": asig_row["NombreRuta"],
            "fecha": str(asig_row["FechaAsignacion"]),
            "estado": asig_row["Estado"],
            "estado_operativo": estado_op,
            "habilitada_para_reparto": (estado_op in ("APROBADA_EN_RUTA", "EN_RUTA")),
            "solicitud_carga_pendiente": es_pendiente_carga,
            "solicitud_carga_items": items_solicitados,
            "items_solicitados": items_solicitados,
            "id_solicitud_carga": sol_pend["id_solicitud"] if sol_pend else None,
            "observacion_admin": sol_pend.get("observacion_admin") if sol_pend else None,
            "kilometraje_inicial": float(asig_row["KilometrajeInicial"] or 0.0),
            "paradas": paradas,
            "total_paradas": len(paradas)
        }

    # 2. Inventario Camión
    sql_inv = text("""
        SELECT 
            ic.id,
            ic.presentacion_id,
            pp."TipoContenedor",
            prod."NombreProducto",
            ic.cantidad_cargada,
            ic.cantidad_vendida,
            (ic.cantidad_cargada - ic.cantidad_vendida) AS saldo_actual,
            ic.cantidad_remanente,
            ic.precio_vigente_carga,
            COALESCE(pcc."EsBandeo", false) AS es_bandeo,
            COALESCE(pcc."ValorBandeo", 0) AS valor_bandeo
        FROM public.inventario_chofer ic
        JOIN public."PresentacionProducto" pp ON ic.presentacion_id = pp."IdPresentacion"
        JOIN public."Producto" prod ON pp."IdProducto" = prod."IdProducto"
        LEFT JOIN public."ProductoConfigComercial" pcc ON prod."IdProducto" = pcc."IdProducto"
        WHERE ic.chofer_id = :uid
        ORDER BY prod."NombreProducto" ASC;
    """)
    filas_inv = db.execute(sql_inv, {"uid": uid}).mappings().fetchall()
    inventario_camion = []
    for f in filas_inv:
        inventario_camion.append({
            "id": f["id"],
            "presentacion_id": f["presentacion_id"],
            "nombre_producto": f["NombreProducto"],
            "tipo_contenedor": f["TipoContenedor"],
            "cantidad_cargada": float(f["cantidad_cargada"] or 0),
            "cantidad_vendida": float(f["cantidad_vendida"] or 0),
            "saldo_actual": float(f["saldo_actual"] or 0),
            "cantidad_remanente": float(f["cantidad_remanente"] or 0),
            "precio_vigente_carga": float(f["precio_vigente_carga"] or 0),
            "es_bandeo": bool(f["es_bandeo"]),
            "valor_bandeo": int(f["valor_bandeo"] or 0)
        })

    # 3. Historial de Operaciones Hoy (excluye clientes nuevos sin venta)
    sql_hist_entregas = text("""
        SELECT 
            'entrega' AS tipo,
            p."IdPedido" AS id,
            p."NumeroPedido" AS referencia,
            p."FechaEntrega" AS fecha_hora,
            p."MontoTotal" AS monto,
            c."RazonSocial" AS cliente,
            COALESCE(p."estado_revision_web", 'PENDIENTE') AS estado_revision_web,
            p."observacion_revision"
        FROM public."Pedido" p
        JOIN public."Cliente" c ON p."IdCliente" = c."IdCliente"
        WHERE p."IdUsuarioRepartidor" = :uid
          AND (DATE(p."FechaEntrega") = CURRENT_DATE OR DATE(p."FechaPedido") = CURRENT_DATE);
    """)
    entregas = db.execute(sql_hist_entregas, {"uid": uid}).mappings().fetchall()

    sql_hist_cobros = text("""
        SELECT 
            'cobro' AS tipo,
            pp."IdPagoPedido" AS id,
            p."NumeroPedido" AS referencia,
            pp."FechaPago" AS fecha_hora,
            pp."MontoPagado" AS monto,
            c."RazonSocial" AS cliente,
            COALESCE(pp."estado_revision_web", 'PENDIENTE') AS estado_revision_web,
            pp."observacion_revision"
        FROM public."PagoPedido" pp
        JOIN public."Pedido" p ON pp."IdPedido" = p."IdPedido"
        JOIN public."Cliente" c ON p."IdCliente" = c."IdCliente"
        WHERE p."IdUsuarioRepartidor" = :uid
          AND DATE(pp."FechaPago") = CURRENT_DATE;
    """)
    cobros = db.execute(sql_hist_cobros, {"uid": uid}).mappings().fetchall()

    historial_operaciones_hoy = []
    for e in entregas:
        historial_operaciones_hoy.append({
            "tipo": e["tipo"],
            "id": e["id"],
            "referencia": e["referencia"],
            "fecha_hora": e["fecha_hora"].isoformat() if e["fecha_hora"] else None,
            "monto": float(e["monto"] or 0.0),
            "cliente": e["cliente"],
            "estado_revision_web": e["estado_revision_web"],
            "observacion_revision": e["observacion_revision"]
        })
    for c in cobros:
        historial_operaciones_hoy.append({
            "tipo": c["tipo"],
            "id": c["id"],
            "referencia": c["referencia"],
            "fecha_hora": c["fecha_hora"].isoformat() if c["fecha_hora"] else None,
            "monto": float(c["monto"] or 0.0),
            "cliente": c["cliente"],
            "estado_revision_web": c["estado_revision_web"],
            "observacion_revision": c["observacion_revision"]
        })

    historial_operaciones_hoy.sort(key=lambda x: x["fecha_hora"] or "", reverse=True)

    return {
        "codigo": "EXITO",
        "datos": {
            "asignacion_activa": asignacion_activa,
            "estado_operativo": asignacion_activa.get("estado_operativo") if asignacion_activa else None,
            "solicitud_carga_pendiente": asignacion_activa.get("solicitud_carga_pendiente", False) if asignacion_activa else False,
            "solicitud_carga_items": asignacion_activa.get("solicitud_carga_items", []) if asignacion_activa else [],
            "items_solicitados": asignacion_activa.get("items_solicitados", []) if asignacion_activa else [],
            "inventario_camion": inventario_camion,
            "historial_operaciones_hoy": historial_operaciones_hoy
        }
    }


# ==============================================================================
# 12. CLIENTE EN RUTA (SOLO_REGISTRO, PROGRAMAR_ENTREGA, ENTREGA_INMEDIATA)
# ==============================================================================
@ChoferMovilRouter.post("/cliente-en-ruta")
async def registrar_cliente_en_ruta(
    request: Request,
    dto: ClienteEnRutaRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key")
):
    """
    Registra cliente en ruta bajo 3 modalidades:
    - SOLO_REGISTRO: solo alta de cliente y punto de venta.
    - PROGRAMAR_ENTREGA: programa visita para un día de la semana.
    - ENTREGA_INMEDIATA: inserta parada en parada_actual_orden + 1, desplaza siguientes,
      ejecuta entrega con cobro y devuelve ruta reordenada 1..N.
    """
    req_id = _obtener_request_id(request)
    uid = usuario["IdUsuario"]
    sucursal_id = alcance.sucursal_efectiva or usuario.get("IdSucursal", 1)
    cuerpo_bytes = await request.body()

    if x_idempotency_key:
        hash_cuerpo, respuesta_cacheada = _verificar_idempotencia_escritura(
            db, uid, request.url.path, x_idempotency_key, cuerpo_bytes
        )
        if respuesta_cacheada:
            return respuesta_cacheada

    modalidad = (dto.modalidad or "SOLO_REGISTRO").upper()
    cli_data = dto.datos_cliente

    import json
    frec_visita = dto.frecuencia_visita or getattr(cli_data, "frecuencia_visita", None) or "SEMANAL"
    dias_visita_val = dto.dias_visita or getattr(cli_data, "dias_visita", None) or "TODOS"
    if isinstance(dias_visita_val, list):
        dias_visita_val = json.dumps(dias_visita_val)
    elif not isinstance(dias_visita_val, str):
        dias_visita_val = str(dias_visita_val)

    fecha_prog_str = dto.fecha_entrega_programada or getattr(cli_data, "fecha_entrega_programada", None)
    fecha_prog_date = None
    if fecha_prog_str:
        if isinstance(fecha_prog_str, str):
            fecha_prog_date = date.fromisoformat(fecha_prog_str[:10])
        elif isinstance(fecha_prog_str, date):
            fecha_prog_date = fecha_prog_str
    elif dto.dia_semana_programado:
        hoy = date.today()
        dias_adelante = (int(dto.dia_semana_programado) - hoy.isoweekday()) % 7
        if dias_adelante <= 0:
            dias_adelante += 7
        fecha_prog_date = hoy + timedelta(days=dias_adelante)
    else:
        fecha_prog_date = date.today() + timedelta(days=1)

    items_prog_list = [it.model_dump() if hasattr(it, "model_dump") else it for it in (dto.items_programados or [])]
    items_prog_json = json.dumps(items_prog_list)

    # 1. Buscar asignación y ruta activa de hoy para el chofer
    sql_asig = text("""
        SELECT ar."IdAsignacionRuta", ar."IdRutaDistribucion", ar."estado_operativo"
        FROM public."AsignacionRuta" ar
        WHERE ar."IdUsuarioRepartidor" = :uid
          AND (ar."FechaAsignacion" = CURRENT_DATE OR ar."Estado" NOT IN ('Finalizada', 'Cancelada'))
        ORDER BY ar."FechaAsignacion" DESC, ar."IdAsignacionRuta" DESC
        LIMIT 1;
    """)
    asig = db.execute(sql_asig, {"uid": uid}).fetchone()
    id_asig = asig.IdAsignacionRuta if asig else None
    id_ruta = asig.IdRutaDistribucion if asig else None

    # Si es ENTREGA_INMEDIATA, el gatekeeper de carga aplica
    if modalidad == "ENTREGA_INMEDIATA":
        if asig and str(asig.estado_operativo).strip().upper() in ("PENDIENTE_CARGA", "CARGA_SOLICITADA"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="La carga de tu camión aún no fue aprobada en Web"
            )

    # 2. Crear Cliente en BD
    sql_cli = text("""
        INSERT INTO public."Cliente" (
            "IdEstadoCliente", "RazonSocial", "NombreComercial", "NombrePropietario", "NitCi",
            "Telefono", "Direccion", "Latitud", "Longitud", "CiudadDestino",
            "LimiteCreditoBs", "DiasCredito", "IdUsuarioRegistro", "Observacion", "IdSucursal",
            "modalidad_registro", "dia_semana_programado", "fecha_entrega_programada",
            "frecuencia_visita", "dias_visita", "items_programados_json", "id_ruta_sugerida"
        ) VALUES (
            1, :razon, :nom_com, :nom_prop, :nit,
            :tel, :dir, :lat, :lng, :ciudad,
            0, 0, :uid, :obs, :sid,
            :modalidad, :dia_prog, :fecha_prog,
            :frec, :dias, :items::jsonb, :id_ruta
        ) RETURNING "IdCliente";
    """)
    cli_row = db.execute(sql_cli, {
        "razon": cli_data.razon_social,
        "nom_com": cli_data.nombre_comercial or cli_data.razon_social,
        "nom_prop": cli_data.nombre_propietario,
        "nit": cli_data.nit_ci,
        "tel": cli_data.telefono,
        "dir": cli_data.direccion or "Sin dirección especificada",
        "lat": cli_data.latitud,
        "lng": cli_data.longitud,
        "ciudad": cli_data.ciudad_destino or "Sucre",
        "uid": uid,
        "obs": cli_data.observacion,
        "sid": sucursal_id,
        "modalidad": modalidad,
        "dia_prog": dto.dia_semana_programado,
        "fecha_prog": fecha_prog_date,
        "frec": frec_visita,
        "dias": str(dias_visita_val),
        "items": items_prog_json,
        "id_ruta": id_ruta
    }).fetchone()
    id_cliente = cli_row[0]

    # 3. Crear Punto de Venta
    sql_pv = text("""
        INSERT INTO public."PuntoVenta" (
            "IdCliente", "NombrePuntoVenta", "Direccion",
            "Latitud", "Longitud", "Referencia", "Activo"
        ) VALUES (
            :cli, :nom_com, :dir,
            :lat, :lng, :ref, true
        ) RETURNING "IdPuntoVenta";
    """)
    pv_row = db.execute(sql_pv, {
        "cli": id_cliente,
        "nom_com": cli_data.nombre_comercial or cli_data.razon_social,
        "dir": cli_data.direccion or "Sin dirección especificada",
        "lat": cli_data.latitud,
        "lng": cli_data.longitud,
        "ref": cli_data.observacion
    }).fetchone()
    id_punto_venta = pv_row[0]

    ruta_reordenada = []

    # 4. Procesar según modalidad
    if modalidad == "ENTREGA_INMEDIATA":
        if not id_ruta:
            raise HTTPException(status_code=400, detail="No se encontró una ruta activa para insertar la entrega inmediata")

        nuevo_orden = (dto.parada_actual_orden or 0) + 1

        # Desplazar siguientes paradas
        db.execute(text("""
            UPDATE public."RutaPuntoVenta"
            SET "OrdenVisita" = "OrdenVisita" + 1
            WHERE "IdRutaDistribucion" = :rid
              AND "OrdenVisita" >= :orden;
        """), {"rid": id_ruta, "orden": nuevo_orden})

        # Insertar nueva parada en parada_actual_orden + 1
        db.execute(text("""
            INSERT INTO public."RutaPuntoVenta" ("IdRutaDistribucion", "IdPuntoVenta", "OrdenVisita")
            VALUES (:rid, :pvid, :orden);
        """), {"rid": id_ruta, "pvid": id_punto_venta, "orden": nuevo_orden})

        # Si viene entrega_con_cobro, ejecutar la entrega inmediata
        if dto.entrega_con_cobro:
            subtotal = 0.0
            for item in (dto.entrega_con_cobro.items_entregados or []):
                p_unit = db.execute(text("""
                    SELECT COALESCE("PrecioUnitario", 0) FROM public."PrecioProducto"
                    WHERE "IdProducto" = (SELECT "IdProducto" FROM public."PresentacionProducto" WHERE "IdPresentacion" = :pid)
                    LIMIT 1;
                """), {"pid": item.presentacion_id}).scalar() or 0.0
                subtotal += float(p_unit) * float(item.cantidad)

            num_ped = f"PED-INM-{int(datetime.now().timestamp())}"
            ped_row = db.execute(text("""
                INSERT INTO public."Pedido" (
                    "NumeroPedido", "IdCliente", "IdPuntoVenta", "IdUsuarioRepartidor",
                    "IdEstadoPedido", "IdAsignacionRuta", "FechaPedido", "FechaEntrega",
                    "EsVentaDirecta", "SubTotal", "Descuento", "MontoTotal",
                    "LatitudEntrega", "LongitudEntrega", "SincronizadoDesdeMovil"
                ) VALUES (
                    :nped, :cid, :pvid, :uid,
                    4, :asig, NOW(), NOW(),
                    true, :sub, 0, :sub,
                    :lat, :lng, true
                ) RETURNING "IdPedido";
            """), {
                "nped": num_ped, "cid": id_cliente, "pvid": id_punto_venta, "uid": uid,
                "asig": id_asig, "sub": subtotal, "lat": cli_data.latitud, "lng": cli_data.longitud
            }).fetchone()
            nuevo_id_pedido = ped_row[0]

            dto.entrega_con_cobro.id_pedido = nuevo_id_pedido
            for item in (dto.entrega_con_cobro.items_entregados or []):
                p_unit = db.execute(text("""
                    SELECT COALESCE("PrecioUnitario", 0) FROM public."PrecioProducto"
                    WHERE "IdProducto" = (SELECT "IdProducto" FROM public."PresentacionProducto" WHERE "IdPresentacion" = :pid)
                    LIMIT 1;
                """), {"pid": item.presentacion_id}).scalar() or 0.0
                st = float(p_unit) * float(item.cantidad)
                db.execute(text("""
                    INSERT INTO public."DetallePedido" (
                        "IdPedido", "IdPresentacion", "Cantidad", "PrecioUnitarioAplicado", "Subtotal"
                    ) VALUES (
                        :ped, :pid, :cant, :pu, :st
                    );
                """), {"ped": nuevo_id_pedido, "pid": item.presentacion_id, "cant": item.cantidad, "pu": p_unit, "st": st})

            await registrar_entrega_movil(
                request=request,
                dto=dto.entrega_con_cobro,
                db=db,
                usuario=usuario,
                alcance=alcance,
                x_idempotency_key=f"INMEDIATA-{uuid.uuid4()}"
            )

        # Consultar la ruta reordenada 1..N
        filas_reord = db.execute(text("""
            SELECT 
                rpv."OrdenVisita",
                pv."IdPuntoVenta",
                pv."NombrePuntoVenta",
                c."IdCliente",
                c."RazonSocial",
                pv."Direccion",
                pv."Latitud",
                pv."Longitud"
            FROM public."RutaPuntoVenta" rpv
            JOIN public."PuntoVenta" pv ON rpv."IdPuntoVenta" = pv."IdPuntoVenta"
            JOIN public."Cliente" c ON pv."IdCliente" = c."IdCliente"
            WHERE rpv."IdRutaDistribucion" = :rid
            ORDER BY rpv."OrdenVisita" ASC;
        """), {"rid": id_ruta}).mappings().fetchall()

        idx = 1
        for f in filas_reord:
            parada = dict(f)
            parada["OrdenVisita"] = idx
            ruta_reordenada.append(parada)
            idx += 1

    elif modalidad == "PROGRAMAR_ENTREGA":
        if not id_ruta:
            sql_r_fb = text('SELECT "IdRutaDistribucion" FROM public."RutaDistribucion" WHERE "IdSucursal" = :sid AND "Activa" = true ORDER BY "IdRutaDistribucion" ASC LIMIT 1;')
            id_ruta = db.execute(sql_r_fb, {"sid": sucursal_id}).scalar()

        if id_ruta:
            max_ord = db.execute(text("""
                SELECT COALESCE(MAX("OrdenVisita"), 0) FROM public."RutaPuntoVenta" WHERE "IdRutaDistribucion" = :rid;
            """), {"rid": id_ruta}).scalar() or 0

            db.execute(text("""
                INSERT INTO public."RutaPuntoVenta" (
                    "IdRutaDistribucion", "IdPuntoVenta", "OrdenVisita",
                    "frecuencia_visita", "dias_visita", "items_programados_json"
                ) VALUES (
                    :rid, :pvid, :orden, :frec, :dias, :items::jsonb
                ) ON CONFLICT ("IdRutaDistribucion", "IdPuntoVenta") DO UPDATE SET
                    "OrdenVisita" = EXCLUDED."OrdenVisita",
                    "frecuencia_visita" = EXCLUDED."frecuencia_visita",
                    "dias_visita" = EXCLUDED."dias_visita",
                    "items_programados_json" = EXCLUDED."items_programados_json";
            """), {
                "rid": id_ruta,
                "pvid": id_punto_venta,
                "orden": max_ord + 1,
                "frec": frec_visita,
                "dias": str(dias_visita_val),
                "items": items_prog_json
            })

            # Invocación inmediata del generador diario de rutas para la fecha programada
            service = RutaService(db)
            try:
                service.repo.EjecutarGeneradorRutasDiarias(fecha_prog_date)
            except Exception as e_cron:
                logger.warning(f"[Generador Rutas Diarias] Error: {e_cron}")

            try:
                service.recalcular_orden_paradas_ruta(id_ruta)
            except Exception as e_rec:
                logger.warning(f"[Recalcular Orden Paradas] Error: {e_rec}")

            # Vincular asignación futura si existe
            asig_futura = db.execute(text("""
                SELECT "IdAsignacionRuta", "IdUsuarioRepartidor"
                FROM public."AsignacionRuta"
                WHERE "IdRutaDistribucion" = :rid AND "FechaAsignacion" = :fec
                LIMIT 1;
            """), {"rid": id_ruta, "fec": fecha_prog_date}).fetchone()

            id_asig_futura = asig_futura.IdAsignacionRuta if asig_futura else id_asig
            id_chofer_futuro = asig_futura.IdUsuarioRepartidor if asig_futura else uid

            if items_prog_list:
                subtotal = 0.0
                for it in items_prog_list:
                    pid = it.get("presentacion_id")
                    cant = float(it.get("cantidad") or 0.0)
                    p_unit = db.execute(text("""
                        SELECT COALESCE("PrecioUnitario", 0) FROM public."PrecioProducto"
                        WHERE "IdProducto" = (SELECT "IdProducto" FROM public."PresentacionProducto" WHERE "IdPresentacion" = :pid)
                        LIMIT 1;
                    """), {"pid": pid}).scalar() or 0.0
                    subtotal += float(p_unit) * cant

                num_ped = f"PED-PROG-{int(datetime.now().timestamp())}"
                ped_row = db.execute(text("""
                    INSERT INTO public."Pedido" (
                        "NumeroPedido", "IdCliente", "IdPuntoVenta", "IdUsuarioRepartidor",
                        "IdEstadoPedido", "IdAsignacionRuta", "FechaPedido", "FechaEntrega",
                        "EsVentaDirecta", "SubTotal", "Descuento", "MontoTotal",
                        "LatitudEntrega", "LongitudEntrega", "SincronizadoDesdeMovil",
                        "Observacion", "estado_visita"
                    ) VALUES (
                        :nped, :cid, :pvid, :uid_repartidor,
                        1, :asig, :fec, :fec,
                        false, :sub, 0, :sub,
                        :lat, :lng, true,
                        'Pedido programado para entrega futura', 'PROGRAMADO'
                    ) RETURNING "IdPedido";
                """), {
                    "nped": num_ped, "cid": id_cliente, "pvid": id_punto_venta, "uid_repartidor": id_chofer_futuro,
                    "asig": id_asig_futura, "fec": fecha_prog_date, "sub": subtotal,
                    "lat": cli_data.latitud, "lng": cli_data.longitud
                }).fetchone()
                nuevo_id_pedido = ped_row[0]

                for it in items_prog_list:
                    pid = it.get("presentacion_id")
                    cant = float(it.get("cantidad") or 0.0)
                    p_unit = db.execute(text("""
                        SELECT COALESCE("PrecioUnitario", 0) FROM public."PrecioProducto"
                        WHERE "IdProducto" = (SELECT "IdProducto" FROM public."PresentacionProducto" WHERE "IdPresentacion" = :pid)
                        LIMIT 1;
                    """), {"pid": pid}).scalar() or 0.0
                    st = float(p_unit) * cant
                    db.execute(text("""
                        INSERT INTO public."DetallePedido" (
                            "IdPedido", "IdPresentacion", "Cantidad", "PrecioUnitarioAplicado", "Subtotal"
                        ) VALUES (
                            :ped, :pid, :cant, :pu, :st
                        );
                    """), {"ped": nuevo_id_pedido, "pid": pid, "cant": cant, "pu": p_unit, "st": st})

            filas_reord = db.execute(text("""
                SELECT 
                    rpv."OrdenVisita",
                    pv."IdPuntoVenta",
                    pv."NombrePuntoVenta",
                    c."IdCliente",
                    c."RazonSocial",
                    COALESCE(rpv."frecuencia_visita", 'SEMANAL') as "frecuencia_visita",
                    COALESCE(rpv."dias_visita", 'TODOS') as "dias_visita",
                    rpv."items_programados_json" as "items_programados_json",
                    pv."Direccion",
                    pv."Latitud",
                    pv."Longitud"
                FROM public."RutaPuntoVenta" rpv
                JOIN public."PuntoVenta" pv ON rpv."IdPuntoVenta" = pv."IdPuntoVenta"
                JOIN public."Cliente" c ON pv."IdCliente" = c."IdCliente"
                WHERE rpv."IdRutaDistribucion" = :rid
                ORDER BY rpv."OrdenVisita" ASC;
            """), {"rid": id_ruta}).mappings().fetchall()
            ruta_reordenada = [dict(f) for f in filas_reord]

    db.commit()

    return {
        "codigo": "EXITO",
        "mensaje": f"Cliente registrado exitosamente bajo modalidad {modalidad}",
        "datos": {
            "id_cliente": id_cliente,
            "id_punto_venta": id_punto_venta,
            "modalidad": modalidad,
            "ruta_reordenada": ruta_reordenada
        }
    }


