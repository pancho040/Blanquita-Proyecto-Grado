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
from datetime import datetime, date, timezone, timedelta
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
    ClienteMovilRequest,
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

        db.execute(text("""
            INSERT INTO public."NotificacionInterna" (
                "IdUsuarioDestinatario", "Tipo", "Titulo", "Mensaje",
                "CodigoReferencia", "Leido", "FechaCreacion"
            ) VALUES (
                1, 'ALERTA', 'Cobro QR/Transferencia Móvil Pendiente',
                :msj, :id_ped, false, NOW()
            );
        """), {
            "msj": f"El chofer #{uid} registró un cobro de Bs. {monto:.2f} vía {metodo.upper()} para Pedido #{id_pedido}. Requiere validación de Kevin.",
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

    # 5. Registrar doble firma digital (Chofer y Cliente receptor) con guardado en Storage y sync a NotaVenta
    url_firma_chofer = dto.firma_chofer
    url_firma_cliente = dto.firma_cliente

    # Si vienen como data URIs o vectores SVG, almacenarlos como archivos formales
    try:
        if dto.firma_chofer and "data:" in dto.firma_chofer:
            res_fc = FileStorageService.guardar_bytes_directo(
                session=db,
                contenido=dto.firma_chofer.encode("utf-8"),
                nombre_archivo=f"firma_chofer_ped_{dto.id_pedido}.svg",
                entidad_origen="FIRMA_CHOFER",
                id_registro_origen=dto.id_pedido,
                id_sucursal=sucursal_id,
                id_chofer=uid,
                mime_type="image/svg+xml"
            )
            url_firma_chofer = res_fc.get("url") or dto.firma_chofer

        if dto.firma_cliente and "data:" in dto.firma_cliente:
            res_cl = FileStorageService.guardar_bytes_directo(
                session=db,
                contenido=dto.firma_cliente.encode("utf-8"),
                nombre_archivo=f"firma_cliente_ped_{dto.id_pedido}.svg",
                entidad_origen="FIRMA_CLIENTE",
                id_registro_origen=dto.id_pedido,
                id_sucursal=sucursal_id,
                id_chofer=uid,
                mime_type="image/svg+xml"
            )
            url_firma_cliente = res_cl.get("url") or dto.firma_cliente
    except Exception as ex_st:
        logger.warning(f"Aviso: Guardado en Storage de firmas omitió fallback por: {ex_st}")

    # Guardar en FirmaDigitalDocumento
    db.execute(text("""
        INSERT INTO public."FirmaDigitalDocumento" (
            "IdUsuario", "TipoDocumento", "IdRegistroDocumento", "CodigoReferencia",
            "UrlFotoFirmaSello", "Observaciones", "FechaFirma"
        ) VALUES (
            :uid, 'FIRMA_CHOFER_ENTREGA', :id_ped, :cod_ref,
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

    # Sincronizar en NotaVenta para visualización inmediata en la Web
    nombre_chofer_txt = f"{usuario.get('PrimerNombre', '')} {usuario.get('ApellidoPaterno', '')}".strip() or "Chofer"
    db.execute(text("""
        UPDATE public."NotaVenta"
        SET "FirmaDigitalUrl" = COALESCE(:firma_chofer, "FirmaDigitalUrl"),
            "FirmaNombre" = COALESCE(:nombre_chofer, "FirmaNombre"),
            "FirmaClienteUrl" = COALESCE(:firma_cliente, "FirmaClienteUrl"),
            "FirmaClienteNombre" = COALESCE(:recibido_por, "FirmaClienteNombre"),
            "FirmaClienteCi" = COALESCE(:ci_receptor, "FirmaClienteCi"),
            "FirmaFecha" = NOW()
        WHERE "IdChofer" = :uid AND (
            "IdNotaVenta" = (SELECT "IdNotaVenta" FROM public."CuentaCobrar" WHERE "IdPedido" = :id_ped LIMIT 1)
            OR "NumeroNotaEntrega" = (SELECT "NumeroPedido" FROM public."Pedido" WHERE "IdPedido" = :id_ped LIMIT 1)
            OR "IdCliente" = (SELECT "IdCliente" FROM public."Pedido" WHERE "IdPedido" = :id_ped LIMIT 1)
        );
    """), {
        "firma_chofer": url_firma_chofer,
        "nombre_chofer": nombre_chofer_txt,
        "firma_cliente": url_firma_cliente,
        "recibido_por": dto.recibido_por,
        "ci_receptor": dto.ci_receptor,
        "uid": uid,
        "id_ped": dto.id_pedido
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
    cuerpo_bytes = await request.body()

    hash_cuerpo, respuesta_cacheada = _verificar_idempotencia_escritura(
        db, uid, request.url.path, x_idempotency_key, cuerpo_bytes
    )
    if respuesta_cacheada:
        return respuesta_cacheada

    datos_cliente = _crear_cliente_y_punto_venta_en_ruta(
        db=db,
        uid=uid,
        payload=dto.model_dump(),
        lat=dto.latitud,
        lng=dto.longitud,
        alcance=alcance
    )

    respuesta_datos = {
        "codigo": "EXITO",
        "mensaje": "Nuevo cliente y punto de venta registrados exitosamente",
        "request_id": req_id,
        "datos": datos_cliente
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

