from typing import Optional
from fastapi import APIRouter, Depends, Query, Path, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date

from app.Config.supabase import get_db
from app.Auth.Dependencies import get_current_user, require_role
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal, obtener_caja_para_alcance
from app.Constants.Roles import ROL_CONTADOR, ROL_GERENTE_GENERAL
from app.Services.Contabilidad.TesoreriaService import TesoreriaService
from app.Models.Contabilidad.TesoreriaModel import (
    CuentaBancariaCrear, CuentaBancariaActualizar, CuentaBancariaResponse,
    AperturaCajaCrear, CierreCajaCrear, AperturaCierreCajaResponse,
    CategoriaMovimientoResponse, MovimientoCajaCrear, MovimientoCajaResponse,
    SolicitudCajaChicaCrear, SolicitudCajaChicaActualizarEstado, SolicitudCajaChicaResponse,
    EntregaFondosCajaChicaRequest, RendicionGastoCajaChicaRequest, ResolverAprobacionGerenciaRequest
)

TesoreriaRouter = APIRouter(prefix="/tesoreria", tags=["Contabilidad - Tesorería y Caja"])

PERMISOS_TESORERIA = [ROL_CONTADOR, ROL_GERENTE_GENERAL]


# ==========================================
# CUENTAS BANCARIAS
# ==========================================
@TesoreriaRouter.get("/bancos")
def listar_cuentas_bancarias(
    solo_activas: bool = Query(False),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    if not alcance.puede_ver_todas:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: La administración de cuentas bancarias es de alcance corporativo y requiere permisos multisede."
        )
    cuentas = TesoreriaService(db).ListarCuentasBancarias()
    if solo_activas:
        cuentas = [c for c in cuentas if c.get("Activa", True)]
    # Normalizar campos para compatibilidad
    for c in cuentas:
        c["SaldoActual"] = float(c.get("SaldoActual") or 0.0)
        c["TipoMoneda"] = c.get("Moneda", "BOB")
        c["Activo"] = c.get("Activa", True)
        if not c.get("Titular"):
            c["Titular"] = "Shema Asociados S.R.L."
    return cuentas

@TesoreriaRouter.get("/bancos/simple")
def listar_cuentas_bancarias_simple(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
    """Listado ligero de cuentas bancarias activas para selectores de pago y cobro."""
    sql = """
        SELECT 
            "IdCuentaBancaria",
            "NombreBanco",
            "NumeroCuenta",
            COALESCE("Moneda", 'BOB') as "Moneda",
            COALESCE("SaldoActual", 0.00) as "SaldoActual"
        FROM "CuentaBancariaEmpresa"
        WHERE COALESCE("Activa", true) = true
        ORDER BY "NombreBanco" ASC;
    """
    return TesoreriaService(db).repo.caller.LlamarFuncion(sql)

@TesoreriaRouter.post("/bancos", response_model=CuentaBancariaResponse)
def crear_cuenta_bancaria(
    dto: CuentaBancariaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    if not alcance.puede_ver_todas:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: La administración de cuentas bancarias es de alcance corporativo y requiere permisos multisede."
        )
    return TesoreriaService(db).CrearCuentaBancaria(dto)

@TesoreriaRouter.put("/bancos/{id_cuenta}")
def actualizar_cuenta_bancaria(
    id_cuenta: int = Path(...),
    dto: CuentaBancariaActualizar = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    if not alcance.puede_ver_todas:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: La administración de cuentas bancarias es de alcance corporativo y requiere permisos multisede."
        )
    # Actualización directa
    repo = TesoreriaService(db).repo
    sql = """
        UPDATE "CuentaBancariaEmpresa"
        SET "NombreBanco" = COALESCE(:NombreBanco, "NombreBanco"),
            "NumeroCuenta" = COALESCE(:NumeroCuenta, "NumeroCuenta"),
            "TipoCuenta" = COALESCE(:TipoCuenta, "TipoCuenta"),
            "SaldoActual" = COALESCE(:SaldoActual, "SaldoActual"),
            "Activa" = COALESCE(:Activa, "Activa")
        WHERE "IdCuentaBancaria" = :id_cuenta
        RETURNING *;
    """
    params = dto.model_dump(exclude_unset=True) if dto else {}
    params["id_cuenta"] = id_cuenta
    params.setdefault("NombreBanco", None)
    params.setdefault("NumeroCuenta", None)
    params.setdefault("TipoCuenta", None)
    params.setdefault("SaldoActual", None)
    params.setdefault("Activa", None)
    return repo.caller.LlamarUnRegistro(sql, params)


# ==========================================
# CATEGORÍAS DE MOVIMIENTO
# ==========================================
@TesoreriaRouter.get("/categorias-caja")
@TesoreriaRouter.get("/caja/categorias")
def listar_categorias_movimiento(
    tipo: Optional[str] = Query(None, description="'Ingreso' o 'Egreso'"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
    cats = TesoreriaService(db).ListarCategoriasMovimiento(tipo)
    for c in cats:
        c["IdCategoria"] = c.get("IdCategoriaMovimientoCaja")
        c["Tipo"] = c.get("TipoMovimiento")
    return cats


# ==========================================
# ESTADO DE CAJA, APERTURA Y CIERRE
# ==========================================
@TesoreriaRouter.get("/cajas/actual")
@TesoreriaRouter.get("/caja/estado")
def obtener_estado_caja(
    id_caja: Optional[int] = Query(None, description="Id de la caja"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    if id_caja is None:
        caja_info = obtener_caja_para_alcance(db, alcance)
        caja_id = caja_info["IdCaja"]
    else:
        # Verificación IDOR si se solicita una caja específica por ID
        sql_caja = text('SELECT "IdSucursal" FROM "Caja" WHERE "IdCaja" = :id_caja')
        caja_row = db.execute(sql_caja, {"id_caja": id_caja}).fetchone()
        if not caja_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caja no encontrada")
        alcance.validar_recurso(caja_row[0], "caja", responder_404=True)
        caja_id = id_caja

    estado = TesoreriaService(db).ObtenerEstadoCajaActual(caja_id)
    if not estado.get("CajaAbierta") or not estado.get("Detalle"):
        return None
    detalle = estado["Detalle"]
    detalle["IdAperturaCierre"] = detalle.get("IdAperturaCierreCaja")
    detalle["SaldoFinalTeorico"] = detalle.get("SaldoTeorico", detalle.get("SaldoInicial", 0.0))
    detalle["Estado"] = "Abierta"
    return detalle

@TesoreriaRouter.get("/cajas")
def listar_cajas_historial(
    limit: int = Query(20),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    where_sql = ""
    params = {"limit": limit, "offset": offset}
    if alcance.sucursal_efectiva is not None:
        where_sql = 'WHERE c."IdSucursal" = :sucursal_id'
        params["sucursal_id"] = alcance.sucursal_efectiva

    sql = f"""
        SELECT ac.*, c."NombreCaja", c."IdSucursal", e."NombreEstado",
               u1."PrimerNombre" || ' ' || u1."ApellidoPaterno" as "NombreUsuarioApertura",
               u2."PrimerNombre" || ' ' || u2."ApellidoPaterno" as "NombreUsuarioCierre"
        FROM "AperturaCierreCaja" ac
        JOIN "Caja" c ON ac."IdCaja" = c."IdCaja"
        JOIN "EstadoAperturaCaja" e ON ac."IdEstadoAperturaCaja" = e."IdEstadoAperturaCaja"
        LEFT JOIN "Usuario" u1 ON ac."IdUsuarioApertura" = u1."IdUsuario"
        LEFT JOIN "Usuario" u2 ON ac."IdUsuarioCierre" = u2."IdUsuario"
        {where_sql}
        ORDER BY ac."FechaApertura" DESC
        LIMIT :limit OFFSET :offset;
    """
    rows = TesoreriaService(db).repo.caller.LlamarFuncion(sql, params)
    for r in rows:
        r["IdAperturaCierre"] = r.get("IdAperturaCierreCaja")
        r["Estado"] = "Abierta" if r.get("FechaCierre") is None else "Cerrada"
        r["SaldoFinalTeorico"] = r.get("SaldoTeorico", r.get("SaldoInicial", 0.0))
        r["SaldoFinalReal"] = r.get("SaldoReal")
    return rows

@TesoreriaRouter.post("/cajas/apertura")
@TesoreriaRouter.post("/caja/abrir")
def abrir_caja(
    dto: AperturaCajaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    # Si no se pasó IdCaja, resolver dinámicamente según el alcance (rechaza 400 en consolidado sin sucursal)
    if not dto.IdCaja:
        caja_info = obtener_caja_para_alcance(db, alcance)
        dto.IdCaja = caja_info["IdCaja"]
    else:
        sql_caja = text('SELECT "IdSucursal" FROM "Caja" WHERE "IdCaja" = :id_caja')
        caja_row = db.execute(sql_caja, {"id_caja": dto.IdCaja}).fetchone()
        if not caja_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caja no encontrada")
        alcance.validar_recurso(caja_row[0], nombre_recurso="caja", responder_404=True)

    return TesoreriaService(db).AbrirCaja(dto, usuario["IdUsuario"])

@TesoreriaRouter.post("/cajas/cierre")
@TesoreriaRouter.post("/caja/cerrar")
def cerrar_caja_con_arqueo(
    dto: CierreCajaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    sql_ac = text('SELECT c."IdSucursal" FROM "AperturaCierreCaja" ac JOIN "Caja" c ON ac."IdCaja" = c."IdCaja" WHERE ac."IdAperturaCierreCaja" = :id_ac')
    row = db.execute(sql_ac, {"id_ac": dto.IdAperturaCierreCaja}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Apertura de caja no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="caja", responder_404=True)

    return TesoreriaService(db).CerrarCaja(dto, usuario["IdUsuario"])


# ==========================================
# MOVIMIENTOS DE CAJA / LIBRO DIARIO
# ==========================================
@TesoreriaRouter.get("/movimientos")
@TesoreriaRouter.get("/caja/movimientos")
def listar_movimientos_caja(
    id_apertura_cierre: Optional[int] = Query(None),
    id_apertura: Optional[int] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    fecha_inicio: Optional[date] = Query(None),
    fecha_fin: Optional[date] = Query(None),
    tipo: Optional[str] = Query(None),
    id_cuenta_bancaria: Optional[int] = Query(None),
    busqueda: Optional[str] = Query(None),
    es_corporativo: Optional[bool] = Query(None, description="Filtrar movimientos corporativos"),
    limit: int = Query(25),
    offset: int = Query(0),
    page: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    if page is not None and page > 0:
        offset = (page - 1) * limit

    # Si se solicitan explícitamente movimientos corporativos, verificar permisos multisede
    if es_corporativo is True:
        if not alcance.puede_ver_todas:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso denegado: solo usuarios con alcance multisede pueden consultar movimientos corporativos."
            )
        sucursal_efectiva = None
    else:
        sucursal_efectiva = alcance.sucursal_efectiva

    apertura = id_apertura_cierre or id_apertura
    f_ini = fecha_desde or fecha_inicio
    f_fin = fecha_hasta or fecha_fin
    movs = TesoreriaService(db).ListarMovimientosCaja(
        id_apertura=apertura,
        fecha_inicio=f_ini,
        fecha_fin=f_fin,
        tipo=tipo,
        id_cuenta_bancaria=id_cuenta_bancaria,
        busqueda=busqueda,
        limit=limit,
        offset=offset,
        id_sucursal=sucursal_efectiva,
        es_corporativo=es_corporativo
    )
    
    total_registros = movs[0]["total_count"] if movs and "total_count" in movs[0] else len(movs)

    resultado = []
    for m in movs:
        m["IdMovimiento"] = m.get("IdMovimientoCaja")
        m["Tipo"] = m.get("TipoMovimiento", "Ingreso")
        m["Monto"] = float(m.get("Monto") or 0.0)
        m["Beneficiario"] = m.get("Solicitante") or "General"
        m["Glosa"] = m.get("Descripcion") or m.get("Respaldo") or ""
        m["NumeroComprobante"] = m.get("NumeroReferencia") or m.get("NotaCodigo") or f"MOV-{m.get('IdMovimientoCaja')}"
        m["MetodoPago"] = m.get("MetodoPago") or "Efectivo"
        m["IdSucursal"] = m.get("IdSucursal")
        m["es_corporativo"] = m.get("es_corporativo", False)
        resultado.append(m)

    return {
        "items": resultado,
        "total": total_registros,
        "limit": limit,
        "offset": offset,
        "page": (offset // limit) + 1 if limit > 0 else 1,
        "total_paginas": (total_registros + limit - 1) // limit if limit > 0 else 1
    }

@TesoreriaRouter.post("/movimientos")
@TesoreriaRouter.post("/caja/movimientos")
def registrar_movimiento_caja(
    dto: MovimientoCajaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    if dto.IdAperturaCierreCaja:
        sql_caja = 'SELECT c."IdSucursal" FROM "AperturaCierreCaja" a JOIN "Caja" c ON a."IdCaja" = c."IdCaja" WHERE a."IdAperturaCierreCaja" = :id_ap;'
        row_caja = db.execute(text(sql_caja), {"id_ap": dto.IdAperturaCierreCaja}).fetchone()
        if not row_caja:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Apertura de caja no encontrada")
        alcance.validar_recurso(row_caja[0], nombre_recurso="caja", responder_404=True)
        dto.IdSucursal = row_caja[0]
        dto.EsCorporativo = False
    elif dto.EsCorporativo:
        if not alcance.puede_ver_todas:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso denegado: solo usuarios con alcance multisede pueden registrar movimientos corporativos."
            )
        dto.IdSucursal = None
    elif dto.IdSucursal:
        alcance.validar_recurso(dto.IdSucursal, nombre_recurso="sucursal", responder_404=False)
    else:
        # Si el usuario es de sede fija, se puede usar su sede por defecto si no es corporativo
        if alcance.sucursal_efectiva:
            dto.IdSucursal = alcance.sucursal_efectiva
            dto.EsCorporativo = False
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe especificar la caja (apertura), la sucursal de destino o marcar el movimiento explícitamente como corporativo."
            )

    res = TesoreriaService(db).RegistrarMovimientoCaja(dto, usuario["IdUsuario"])
    res["IdMovimiento"] = res.get("IdMovimientoCaja")
    res["Tipo"] = res.get("TipoMovimiento", "Ingreso")
    res["Beneficiario"] = res.get("Solicitante")
    res["Glosa"] = res.get("Descripcion")
    return res

@TesoreriaRouter.post("/movimientos/{id_movimiento}/anular")
def anular_movimiento_caja(
    id_movimiento: int,
    datos: dict = {},
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Anula un movimiento de caja con reversión bancaria y registro de auditoría."""
    sql_mov = 'SELECT c."IdSucursal" FROM "MovimientoCaja" mc JOIN "AperturaCierreCaja" a ON mc."IdAperturaCierreCaja" = a."IdAperturaCierreCaja" JOIN "Caja" c ON a."IdCaja" = c."IdCaja" WHERE mc."IdMovimientoCaja" = :id_m;'
    row_mov = db.execute(text(sql_mov), {"id_m": id_movimiento}).fetchone()
    if not row_mov:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movimiento no encontrado")
    alcance.validar_recurso(row_mov[0], nombre_recurso="movimiento de caja", responder_404=True)
    motivo = datos.get("motivo", "Anulación autorizada por administración")
    return TesoreriaService(db).AnularMovimientoCaja(id_movimiento, usuario["IdUsuario"], motivo)

@TesoreriaRouter.delete("/movimientos/{id_movimiento}")
def eliminar_movimiento_caja(
    id_movimiento: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Anulación lógica de movimiento contable."""
    sql_mov = 'SELECT c."IdSucursal" FROM "MovimientoCaja" mc JOIN "AperturaCierreCaja" a ON mc."IdAperturaCierreCaja" = a."IdAperturaCierreCaja" JOIN "Caja" c ON a."IdCaja" = c."IdCaja" WHERE mc."IdMovimientoCaja" = :id_m;'
    row_mov = db.execute(text(sql_mov), {"id_m": id_movimiento}).fetchone()
    if not row_mov:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movimiento no encontrado")
    alcance.validar_recurso(row_mov[0], nombre_recurso="movimiento de caja", responder_404=True)
    return TesoreriaService(db).AnularMovimientoCaja(id_movimiento, usuario["IdUsuario"], "Eliminación convertida en anulación lógica por ajuste contable")


# ==========================================
# SOLICITUDES DE CAJA CHICA (SC) Y KPIS
# ==========================================
@TesoreriaRouter.get("/caja-chica-kpis")
@TesoreriaRouter.get("/caja-chica/kpis")
def obtener_caja_chica_kpis(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    repo = TesoreriaService(db).repo
    where = ""
    params = {}
    if alcance.sucursal_efectiva:
        where = 'WHERE c."IdSucursal" = :id_s'
        params["id_s"] = alcance.sucursal_efectiva

    sql = f"""
        SELECT 
            COUNT(*) as "Total",
            COUNT(CASE WHEN sc."Estado" = 'Pendiente' THEN 1 END) as "Pendientes",
            COUNT(CASE WHEN sc."Estado" = 'Aprobada' THEN 1 END) as "Aprobadas",
            COUNT(CASE WHEN sc."Estado" = 'Rendida' THEN 1 END) as "Rendidas",
            COUNT(CASE WHEN sc."Estado" = 'Rechazada' THEN 1 END) as "Rechazadas",
            COALESCE(SUM(sc."MontoSolicitado"), 0) as "MontoTotalSolicitado"
        FROM "SolicitudCajaChica" sc
        LEFT JOIN "Caja" c ON sc."IdCaja" = c."IdCaja"
        {where};
    """
    res = repo.caller.LlamarUnRegistro(sql, params)
    return {
        "Total": int(res.get("Total", 0)) if res else 0,
        "Pendientes": int(res.get("Pendientes", 0)) if res else 0,
        "Aprobadas": int(res.get("Aprobadas", 0)) if res else 0,
        "Rendidas": int(res.get("Rendidas", 0)) if res else 0,
        "Rechazadas": int(res.get("Rechazadas", 0)) if res else 0,
        "MontoTotalSolicitado": float(res.get("MontoTotalSolicitado", 0.0)) if res else 0.0,
    }


@TesoreriaRouter.get("/solicitudes-caja-chica")
@TesoreriaRouter.get("/caja-chica/solicitudes")
def listar_solicitudes_caja_chica(
    estado: Optional[str] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    fecha_inicio: Optional[date] = Query(None),
    fecha_fin: Optional[date] = Query(None),
    busqueda: Optional[str] = Query(None),
    limit: int = Query(25),
    offset: int = Query(0),
    page: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    if page is not None and page > 0:
        offset = (page - 1) * limit

    f_ini = fecha_desde or fecha_inicio
    f_fin = fecha_hasta or fecha_fin
    sols = TesoreriaService(db).repo.ListarSolicitudesCajaChica(
        estado=estado,
        fecha_inicio=f_ini,
        fecha_fin=f_fin,
        id_sucursal=alcance.sucursal_efectiva,
        busqueda=busqueda,
        limit=limit,
        offset=offset
    )
    
    total_registros = sols[0]["total_count"] if sols and "total_count" in sols[0] else len(sols)

    resultado = []
    for s in sols:
        monto_sol = float(s.get("MontoSolicitado") or 0.0)
        est = s.get("Estado", "Pendiente")
        monto_gastado = monto_sol if est == "Rendida" else None

        s["IdSolicitud"] = s.get("IdSolicitudCajaChica")
        s["NumeroSolicitud"] = s.get("CodigoSolicitud")
        s["Solicitante"] = s.get("NombreSolicitante")
        s["Departamento"] = s.get("CargoSolicitante", "Producción")
        s["Justificacion"] = s.get("DestinoJustificacion")
        s["MontoSolicitado"] = monto_sol
        s["MontoGastado"] = monto_gastado
        s["Estado"] = est
        resultado.append(s)

    return {
        "items": resultado,
        "total": total_registros,
        "limit": limit,
        "offset": offset,
        "page": (offset // limit) + 1 if limit > 0 else 1,
        "total_paginas": (total_registros + limit - 1) // limit if limit > 0 else 1
    }

@TesoreriaRouter.post("/solicitudes-caja-chica")
@TesoreriaRouter.post("/caja-chica/solicitudes")
def crear_solicitud_caja_chica(
    dto: SolicitudCajaChicaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    # Regla de Oro: En modo consolidado exige sucursal explícita; en sede fija fuerza sucursal
    sid = alcance.validar_escritura(dto.IdSucursal)
    dto.IdSucursal = sid

    res = TesoreriaService(db).CrearSolicitudCajaChica(dto)
    res["IdSolicitud"] = res.get("IdSolicitudCajaChica")
    res["NumeroSolicitud"] = res.get("CodigoSolicitud")
    res["Solicitante"] = res.get("NombreSolicitante")
    res["Departamento"] = res.get("CargoSolicitante")
    res["Justificacion"] = res.get("DestinoJustificacion")
    return res

@TesoreriaRouter.post("/solicitudes-caja-chica/{id_solicitud}/aprobar")
def aprobar_solicitud(
    id_solicitud: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    sql = text('SELECT "IdSucursal" FROM "SolicitudCajaChica" WHERE "IdSolicitudCajaChica" = :id')
    row = db.execute(sql, {"id": id_solicitud}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud de caja chica no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="solicitud de caja chica", responder_404=True)

    dto = SolicitudCajaChicaActualizarEstado(Estado="Aprobada", GenerarMovimientoCaja=True)
    return TesoreriaService(db).ActualizarEstadoSolicitud(id_solicitud, dto, usuario["IdUsuario"])

@TesoreriaRouter.post("/solicitudes-caja-chica/{id_solicitud}/rechazar")
def rechazar_solicitud(
    id_solicitud: int,
    datos: dict = {},
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    sql = text('SELECT "IdSucursal" FROM "SolicitudCajaChica" WHERE "IdSolicitudCajaChica" = :id')
    row = db.execute(sql, {"id": id_solicitud}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud de caja chica no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="solicitud de caja chica", responder_404=True)

    dto = SolicitudCajaChicaActualizarEstado(
        Estado="Rechazada",
        MotivoRechazo=datos.get("motivo_rechazo", "Rechazada por administración")
    )
    return TesoreriaService(db).ActualizarEstadoSolicitud(id_solicitud, dto, usuario["IdUsuario"])

@TesoreriaRouter.post("/solicitudes-caja-chica/{id_solicitud}/descargar")
def descargar_solicitud(
    id_solicitud: int,
    datos: dict = {},
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    sql = text('SELECT "IdSucursal" FROM "SolicitudCajaChica" WHERE "IdSolicitudCajaChica" = :id')
    row = db.execute(sql, {"id": id_solicitud}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud de caja chica no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="solicitud de caja chica", responder_404=True)

    dto = SolicitudCajaChicaActualizarEstado(
        Estado="Rendida",
        MontoGastado=datos.get("monto_gastado"),
        DetalleDescargo=datos.get("detalle_descargo")
    )
    return TesoreriaService(db).ActualizarEstadoSolicitud(id_solicitud, dto, usuario["IdUsuario"])

# --- ENDPOINTS FASE 3: CICLO OPERATIVO Y APROBACIÓN GERENCIAL ---
@TesoreriaRouter.post("/caja-chica/{id_solicitud}/entregar-fondos")
def entregar_fondos_caja_chica(
    id_solicitud: int,
    dto: EntregaFondosCajaChicaRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Pasa la solicitud de PENDIENTE a ENTREGADO registrando el monto entregado en efectivo."""
    sql = text('SELECT "IdSucursal" FROM "SolicitudCajaChica" WHERE "IdSolicitudCajaChica" = :id')
    row = db.execute(sql, {"id": id_solicitud}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud de caja chica no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="solicitud de caja chica", responder_404=True)

    return TesoreriaService(db).EntregarFondosCajaChica(id_solicitud, dto)

@TesoreriaRouter.post("/caja-chica/{id_solicitud}/rendir")
def rendir_gasto_caja_chica(
    id_solicitud: int,
    dto: RendicionGastoCajaChicaRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Pasa el vale a RENDIDO calculando automáticamente reintegro y registrando ítems y comprobante."""
    sql = text('SELECT "IdSucursal" FROM "SolicitudCajaChica" WHERE "IdSolicitudCajaChica" = :id')
    row = db.execute(sql, {"id": id_solicitud}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud de caja chica no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="solicitud de caja chica", responder_404=True)

    return TesoreriaService(db).RendirGastoCajaChica(id_solicitud, dto)

@TesoreriaRouter.post("/caja-chica/{id_solicitud}/resolver-gerencia")
def resolver_aprobacion_gerencial(
    id_solicitud: int,
    dto: ResolverAprobacionGerenciaRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role([ROL_GERENTE_GENERAL])),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Gerencia General aprueba o rechaza el vale rendido generando el egreso neto real en caja."""
    sql = text('SELECT "IdSucursal" FROM "SolicitudCajaChica" WHERE "IdSolicitudCajaChica" = :id')
    row = db.execute(sql, {"id": id_solicitud}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud de caja chica no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="solicitud de caja chica", responder_404=True)

    return TesoreriaService(db).ResolverAprobacionGerencia(id_solicitud, dto, usuario["IdUsuario"])

@TesoreriaRouter.get("/caja-chica/{id_solicitud}/imprimir")
def imprimir_vale_caja_chica(
    id_solicitud: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Valida que la aprobación gerencial esté concedida antes de permitir la impresión formal."""
    sql = text('SELECT "IdSucursal" FROM "SolicitudCajaChica" WHERE "IdSolicitudCajaChica" = :id')
    row = db.execute(sql, {"id": id_solicitud}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud de caja chica no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="solicitud de caja chica", responder_404=True)

    return TesoreriaService(db).ValidarImpresionVale(id_solicitud)

@TesoreriaRouter.get("/caja-chica/pendientes-gerencia")
def listar_pendientes_gerencia(
    id_sucursal: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role([ROL_GERENTE_GENERAL])),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Bandeja de vales rendidos pendientes de autorización gerencial."""
    sid = alcance.sucursal_efectiva if alcance.sucursal_efectiva is not None else id_sucursal
    return TesoreriaService(db).ListarPendientesAprobacionGerencia(sid)


# ==========================================
# DASHBOARD KPIS CONSOLIDADOS
# ==========================================
@TesoreriaRouter.get("/dashboard-kpis")
def obtener_dashboard_kpis(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    repo = TesoreriaService(db).repo
    filtro_cxc = 'AND "IdSucursal" = :id_s' if alcance.sucursal_efectiva else ""
    params = {"id_s": alcance.sucursal_efectiva} if alcance.sucursal_efectiva else {}
    sql = f"""
        SELECT 
            COALESCE(SUM(CASE WHEN "Moneda" = 'BOB' AND "Activa" = true THEN "SaldoActual" ELSE 0 END), 0) as "TotalBancosBOB",
            COALESCE(SUM(CASE WHEN "Moneda" = 'USD' AND "Activa" = true THEN "SaldoActual" ELSE 0 END), 0) as "TotalBancosUSD",
            (SELECT COALESCE(SUM("SaldoPendiente"), 0) FROM "CuentaPagarProveedor" WHERE "SaldoPendiente" > 0) as "TotalCuentasPagar",
            (SELECT COALESCE(SUM("SaldoPendiente"), 0) FROM "CuentaCobrar" WHERE "SaldoPendiente" > 0 {filtro_cxc}) as "TotalCuentasCobrar"
        FROM "CuentaBancariaEmpresa";
    """
    row = repo.caller.LlamarUnRegistro(sql, params) or {}
    return {
        "TotalBancosBOB": float(row.get("TotalBancosBOB", 0.0)),
        "TotalBancosUSD": float(row.get("TotalBancosUSD", 0.0)),
        "TotalCuentasPagar": float(row.get("TotalCuentasPagar", 0.0)),
        "TotalCuentasCobrar": float(row.get("TotalCuentasCobrar", 0.0)),
    }

@TesoreriaRouter.get("/cajas/{id_apertura}/resumen-gerencial")
def obtener_resumen_gerencial_caja(
    id_apertura: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Genera el resumen consolidado de liquidez y conciliación para Gerencia General."""
    sql_c = 'SELECT c."IdSucursal" FROM "AperturaCierreCaja" a JOIN "Caja" c ON a."IdCaja" = c."IdCaja" WHERE a."IdAperturaCierreCaja" = :id_ap;'
    r_c = db.execute(text(sql_c), {"id_ap": id_apertura}).fetchone()
    if not r_c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Apertura de caja no encontrada")
    alcance.validar_recurso(r_c[0], nombre_recurso="caja", responder_404=True)
    return TesoreriaService(db).ObtenerResumenGerencial(id_apertura)
