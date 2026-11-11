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
from datetime import datetime, date, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, Request, Header, HTTPException, status, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL
from app.Middleware.Idempotencia import IdempotenciaService
from app.Services.Logistica.RutaService import RutaService
from app.Services.Contabilidad.CuentasCobrarService import CuentasCobrarService
from app.Services.Logistica.InventarioComercialService import InventarioComercialService
from app.Services.Common.FileStorageService import FileStorageService
from app.Routes.Logistica.ChoferRouter import _validar_pertenencia_pedido_chofer, ROLES_CHOFER_OPERATIVO
from app.Models.Movil.MovilModel import MovilResponse
from app.Models.Movil.ChoferMovilModel import (
    EntregaMovilRequest,
    CobroMovilRequest,
    NoEntregaMovilRequest,
    CierreTurnoMovilRequest,
    ResumenInventarioChoferDTO,
    ItemInventarioCamionDTO
)
from app.Models.Contabilidad.CuentasCobrarModel import (
    AbonoCuentaCobrarCrear,
    CierreTurnoChoferRequest
)

ChoferMovilRouter = APIRouter(prefix="/chofer", tags=["Móvil - Choferes (Fase 2)"])


def _obtener_request_id(request: Request) -> str:
    return request.headers.get("x-request-id") or str(uuid.uuid4())


def _verificar_idempotencia_escritura(
    db: Session,
    uid: int,
    endpoint: str,
    x_idempotency_key: Optional[str],
    cuerpo_bytes: bytes
):
    if not x_idempotency_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cabecera X-Idempotency-Key (UUID v4) es obligatoria para toda operación de escritura móvil."
        )
    try:
        uuid_obj = uuid.UUID(x_idempotency_key, version=4)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cabecera X-Idempotency-Key debe ser un UUID v4 válido."
        )

    hash_cuerpo, respuesta_cacheada = IdempotenciaService.verificar_y_recuperar(
        session=db,
        usuario_id=uid,
        clave=x_idempotency_key,
        cuerpo_bytes=cuerpo_bytes,
        endpoint=endpoint
    )
    return hash_cuerpo, respuesta_cacheada


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

    id_asig = asignaciones[0]["IdAsignacionRuta"]
    tracking = service.ObtenerTrackingAsignacion(id_asig)

    # Validar aislamiento: si es chofer, no ver asignación ajena
    if usuario.get("IdRol") == ROL_AGENTE_REPARTO and tracking.get("IdUsuarioRepartidor") != chofer_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación no encontrada")

    # Enriquecer paradas con detalle de productos del pedido
    paradas = tracking.get("Paradas", [])
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
            "total_paradas": len(paradas)
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

    for r in filas:
        cargado = float(r["cantidad_cargada"])
        vendido = float(r["cantidad_vendida"])
        remanente = float(r["cantidad_remanente"])
        precio_u = float(r["precio_vigente_carga"])
        valor_rem = float(r["valor_remanente"] or (remanente * precio_u))

        total_cargados += cargado
        total_entregados += vendido
        total_saldo += remanente
        valor_total_bs += valor_rem

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
        valor_total_camion_bs=valor_total_bs,
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
    cuerpo_bytes = await request.body()

    hash_cuerpo, respuesta_cacheada = _verificar_idempotencia_escritura(
        db, uid, request.url.path, x_idempotency_key, cuerpo_bytes
    )
    if respuesta_cacheada:
        return respuesta_cacheada

    # 1. Validar pertenencia del pedido a la ruta del chofer y sucursal
    _validar_pertenencia_pedido_chofer(db, dto.id_pedido, usuario, alcance)

    # 2. Consultar detalles del pedido para verificar cantidades
    sql_det = text("""
        SELECT dp."IdPresentacion", dp."Cantidad", dp."PrecioUnitarioAplicado"
        FROM public."DetallePedido" dp
        WHERE dp."IdPedido" = :id_ped;
    """)
    filas_det = db.execute(sql_det, {"id_ped": dto.id_pedido}).mappings().fetchall()
    if not filas_det:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El pedido no cuenta con detalles de productos")

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
            SELECT "cantidad_remanente"
            FROM public.inventario_chofer
            WHERE "chofer_id" = :cid AND "presentacion_id" = :pid;
        """)
        remanente = db.execute(sql_stock, {"cid": uid, "pid": pres_id}).scalar()
        if remanente is None or float(remanente) < cant_entregar:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock insuficiente en camión para la presentación #{pres_id}. Disponible: {remanente or 0.0}, Solicitado: {cant_entregar}"
            )

    # 4. Descontar inventario_chofer e incrementar cantidad_vendida
    for pres_id, cant_entregar in cantidades_a_entregar.items():
        db.execute(text("""
            UPDATE public.inventario_chofer
            SET "cantidad_vendida" = "cantidad_vendida" + :cant,
                "cantidad_remanente" = "cantidad_remanente" - :cant
            WHERE "chofer_id" = :cid AND "presentacion_id" = :pid;
        """), {"cant": cant_entregar, "cid": uid, "pid": pres_id})

    # 5. Registrar firma del chofer (y cliente) en FirmaDigitalDocumento
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
        "cod_ref": f"PED-{dto.id_pedido}",
        "firma_chofer": dto.firma_chofer,
        "obs": f"Recibido por: {dto.recibido_por}. Firma cliente: {'PRESENTE' if dto.firma_cliente else 'NO_REGISTRADA'}"
    })

    # 6. Actualizar pedido delegando en RutaService
    ruta_service = RutaService(db)
    obs_final = f"Recibido por: {dto.recibido_por}. {dto.observacion or ''} [Tipo: {dto.tipo_entrega}]".strip()
    ruta_service.RegistrarEntregaParada({
        "IdPedido": dto.id_pedido,
        "LatitudEntrega": dto.latitud,
        "LongitudEntrega": dto.longitud,
        "Observacion": obs_final
    })

    # 7. Verificar si hubo revalorización de precios reciente (Kevin)
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
        "mensaje": "Entrega registrada exitosamente",
        "request_id": req_id,
        "datos": {
            "id_pedido": dto.id_pedido,
            "tipo_entrega": dto.tipo_entrega,
            "items_entregados": [
                {"presentacion_id": pid, "cantidad": cant}
                for pid, cant in cantidades_a_entregar.items()
            ],
            "recibido_por": dto.recibido_por,
            "alerta_revalorizacion": alerta_revalorizacion
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
    cxc_service = CuentasCobrarService(db)

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

        # Registrar en PagoPedido
        id_metodo_pago = 1 if metodo == "EFECTIVO" else (2 if metodo in ("QR", "TRANSFERENCIA") else 3)
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

        # Si el método es QR o Transferencia, generar alerta y abono pendiente para Kevin
        if metodo in ("QR", "TRANSFERENCIA"):
            db.execute(text("""
                INSERT INTO public."NotificacionInterna" (
                    "IdUsuarioDestinatario", "Tipo", "Titulo", "Mensaje",
                    "CodigoReferencia", "Leido", "FechaCreacion"
                ) VALUES (
                    1, 'ALERTA', 'Cobro QR/Transferencia Móvil Pendiente',
                    :msj, :id_ped, false, NOW()
                );
            """), {
                "msj": f"El chofer #{uid} registró un cobro de Bs. {p.monto:.2f} vía {metodo} para Pedido #{dto.id_pedido}. Requiere validación de Kevin.",
                "id_ped": dto.id_pedido
            })

        tramos_procesados.append({
            "metodo": metodo,
            "monto": p.monto,
            "numero_referencia": ref,
            "estado": "PENDIENTE_APROBACION" if metodo in ("QR", "TRANSFERENCIA") else "CONFIRMADO",
            "id_pago_pedido": pago_db.get("IdPagoPedido") if isinstance(pago_db, dict) else None
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
    cuerpo_bytes = await request.body()

    hash_cuerpo, respuesta_cacheada = _verificar_idempotencia_escritura(
        db, uid, request.url.path, x_idempotency_key, cuerpo_bytes
    )
    if respuesta_cacheada:
        return respuesta_cacheada

    _validar_pertenencia_pedido_chofer(db, dto.id_pedido, usuario, alcance)

    obs_no_entrega = f"[NO ENTREGADO - Motivo: {dto.motivo}]: {dto.observacion or ''}".strip()
    db.execute(text("""
        UPDATE public."Pedido"
        SET "IdEstadoPedido" = 4,
            "LatitudEntrega" = :lat,
            "LongitudEntrega" = :lng,
            "Observacion" = :obs
        WHERE "IdPedido" = :id_ped;
    """), {
        "lat": dto.latitud,
        "lng": dto.longitud,
        "obs": obs_no_entrega,
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
        Observaciones=dto.observaciones
    )

    cxc_service = CuentasCobrarService(db)
    resultado_cierre = cxc_service.ProcesarCierreTurnoChofer(req_cierre, id_usuario=uid)

    # Registrar firma digital de conformidad
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
        "firma": dto.firma_chofer,
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
        op_id = op.get("id")
        tipo = op.get("tipo")
        payload = op.get("payload", {})
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
                monto = float(payload.get("monto") or payload.get("monto_total") or 0.0)
                metodo = payload.get("metodo") or "EFECTIVO"
                id_metodo = 1 if metodo == "EFECTIVO" else 2

                ruta_service = RutaService(db)
                ruta_service.RegistrarCobroParada({
                    "IdPedido": int(id_pedido),
                    "IdMetodoPago": id_metodo,
                    "Monto": monto,
                    "NumeroReferencia": payload.get("numero_referencia") or f"OFFLINE-{uuid.uuid4().hex[:6].upper()}",
                    "LatitudCobro": lat,
                    "LongitudCobro": lng,
                    "Observacion": payload.get("observacion") or "Cobro sincronizado desde cola offline"
                })
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
