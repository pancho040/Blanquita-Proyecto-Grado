from typing import Optional
from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.orm import Session
from datetime import date

from app.Config.supabase import get_db
from app.Auth.Dependencies import get_current_user, require_role
from app.Constants.Roles import ROL_CONTADOR, ROL_GERENTE_GENERAL
from app.Services.Contabilidad.TesoreriaService import TesoreriaService
from app.Models.Contabilidad.TesoreriaModel import (
    CuentaBancariaCrear, CuentaBancariaActualizar, CuentaBancariaResponse,
    AperturaCajaCrear, CierreCajaCrear, AperturaCierreCajaResponse,
    CategoriaMovimientoResponse, MovimientoCajaCrear, MovimientoCajaResponse,
    SolicitudCajaChicaCrear, SolicitudCajaChicaActualizarEstado, SolicitudCajaChicaResponse
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
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
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

@TesoreriaRouter.post("/bancos", response_model=CuentaBancariaResponse)
def crear_cuenta_bancaria(
    dto: CuentaBancariaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
    return TesoreriaService(db).CrearCuentaBancaria(dto)

@TesoreriaRouter.put("/bancos/{id_cuenta}")
def actualizar_cuenta_bancaria(
    id_cuenta: int = Path(...),
    dto: CuentaBancariaActualizar = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
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
    id_caja: int = Query(1, description="Id de la caja"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
    estado = TesoreriaService(db).ObtenerEstadoCajaActual(id_caja)
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
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
    sql = """
        SELECT ac.*, c."NombreCaja", e."NombreEstado",
               u1."PrimerNombre" || ' ' || u1."ApellidoPaterno" as "NombreUsuarioApertura",
               u2."PrimerNombre" || ' ' || u2."ApellidoPaterno" as "NombreUsuarioCierre"
        FROM "AperturaCierreCaja" ac
        JOIN "Caja" c ON ac."IdCaja" = c."IdCaja"
        JOIN "EstadoAperturaCaja" e ON ac."IdEstadoAperturaCaja" = e."IdEstadoAperturaCaja"
        LEFT JOIN "Usuario" u1 ON ac."IdUsuarioApertura" = u1."IdUsuario"
        LEFT JOIN "Usuario" u2 ON ac."IdUsuarioCierre" = u2."IdUsuario"
        ORDER BY ac."FechaApertura" DESC
        LIMIT :limit OFFSET :offset;
    """
    rows = TesoreriaService(db).repo.caller.LlamarFuncion(sql, {"limit": limit, "offset": offset})
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
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
    return TesoreriaService(db).AbrirCaja(dto, usuario["IdUsuario"])

@TesoreriaRouter.post("/cajas/cierre")
@TesoreriaRouter.post("/caja/cerrar")
def cerrar_caja_con_arqueo(
    dto: CierreCajaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
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
    limit: int = Query(25),
    offset: int = Query(0),
    page: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
    if page is not None and page > 0:
        offset = (page - 1) * limit

    apertura = id_apertura_cierre or id_apertura
    f_ini = fecha_desde or fecha_inicio
    f_fin = fecha_hasta or fecha_fin
    movs = TesoreriaService(db).ListarMovimientosCaja(apertura, f_ini, f_fin, tipo)
    
    resultado = []
    for m in movs:
        m["IdMovimiento"] = m.get("IdMovimientoCaja")
        m["Tipo"] = m.get("TipoMovimiento", "Ingreso")
        m["Monto"] = float(m.get("Monto") or 0.0)
        m["Beneficiario"] = m.get("Solicitante") or "General"
        m["Glosa"] = m.get("Descripcion") or m.get("Respaldo") or ""
        m["NumeroComprobante"] = m.get("NumeroReferencia") or m.get("NotaCodigo") or f"MOV-{m.get('IdMovimientoCaja')}"
        m["MetodoPago"] = m.get("MetodoPago") or "Efectivo"
        
        # Filtro por banco si se solicita
        if id_cuenta_bancaria is not None and m.get("IdCuentaBancaria") != id_cuenta_bancaria:
            continue

        # Filtro de búsqueda
        if busqueda and busqueda.strip():
            q = busqueda.strip().lower()
            glosa = str(m.get("Glosa") or "").lower()
            ben = str(m.get("Beneficiario") or "").lower()
            comp = str(m.get("NumeroComprobante") or "").lower()
            cat = str(m.get("NombreCategoria") or "").lower()
            if q not in glosa and q not in ben and q not in comp and q not in cat:
                continue

        resultado.append(m)

    total_registros = len(resultado)
    paginados = resultado[offset : offset + limit]

    return {
        "items": paginados,
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
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
    res = TesoreriaService(db).RegistrarMovimientoCaja(dto, usuario["IdUsuario"])
    res["IdMovimiento"] = res.get("IdMovimientoCaja")
    res["Tipo"] = res.get("TipoMovimiento", "Ingreso")
    res["Beneficiario"] = res.get("Solicitante")
    res["Glosa"] = res.get("Descripcion")
    return res


# ==========================================
# SOLICITUDES DE CAJA CHICA (SC) Y KPIS
# ==========================================
@TesoreriaRouter.get("/caja-chica-kpis")
@TesoreriaRouter.get("/caja-chica/kpis")
def obtener_caja_chica_kpis(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
    repo = TesoreriaService(db).repo
    sql = """
        SELECT 
            COUNT(*) as "Total",
            COUNT(CASE WHEN "Estado" = 'Pendiente' THEN 1 END) as "Pendientes",
            COUNT(CASE WHEN "Estado" = 'Aprobada' THEN 1 END) as "Aprobadas",
            COUNT(CASE WHEN "Estado" = 'Rendida' THEN 1 END) as "Rendidas",
            COUNT(CASE WHEN "Estado" = 'Rechazada' THEN 1 END) as "Rechazadas",
            COALESCE(SUM("MontoSolicitado"), 0) as "MontoTotalSolicitado"
        FROM "SolicitudCajaChica";
    """
    res = repo.caller.LlamarUnRegistro(sql)
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
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
    if page is not None and page > 0:
        offset = (page - 1) * limit

    f_ini = fecha_desde or fecha_inicio
    f_fin = fecha_hasta or fecha_fin
    sols = TesoreriaService(db).ListarSolicitudesCajaChica(estado, f_ini, f_fin)
    
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

        if busqueda and busqueda.strip():
            q = busqueda.strip().lower()
            cod = str(s.get("CodigoSolicitud") or "").lower()
            sol = str(s.get("NombreSolicitante") or "").lower()
            dep = str(s.get("Departamento") or "").lower()
            jus = str(s.get("Justificacion") or "").lower()
            if q not in cod and q not in sol and q not in dep and q not in jus:
                continue

        resultado.append(s)

    total_registros = len(resultado)
    paginados = resultado[offset : offset + limit]

    return {
        "items": paginados,
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
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
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
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
    dto = SolicitudCajaChicaActualizarEstado(Estado="Aprobada", GenerarMovimientoCaja=True)
    return TesoreriaService(db).ActualizarEstadoSolicitud(id_solicitud, dto, usuario["IdUsuario"])

@TesoreriaRouter.post("/solicitudes-caja-chica/{id_solicitud}/rechazar")
def rechazar_solicitud(
    id_solicitud: int,
    datos: dict = {},
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
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
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
    dto = SolicitudCajaChicaActualizarEstado(
        Estado="Rendida",
        MontoGastado=datos.get("monto_gastado"),
        DetalleDescargo=datos.get("detalle_descargo")
    )
    return TesoreriaService(db).ActualizarEstadoSolicitud(id_solicitud, dto, usuario["IdUsuario"])


# ==========================================
# DASHBOARD KPIS CONSOLIDADOS
# ==========================================
@TesoreriaRouter.get("/dashboard-kpis")
def obtener_dashboard_kpis(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_TESORERIA))
):
    repo = TesoreriaService(db).repo
    # Totales bancarios
    cuentas = repo.ListarCuentasBancarias()
    total_bob = sum(float(c.get("SaldoActual", 0)) for c in cuentas if c.get("Moneda") == "BOB")
    total_usd = sum(float(c.get("SaldoActual", 0)) for c in cuentas if c.get("Moneda") == "USD")

    # Deuda CxP
    sql_cxp = 'SELECT COALESCE(SUM("SaldoPendiente"), 0) as "TotalCxP" FROM "CuentaPagarProveedor" WHERE "SaldoPendiente" > 0;'
    cxp_res = repo.caller.LlamarUnRegistro(sql_cxp)
    total_cxp = float(cxp_res["TotalCxP"]) if cxp_res else 0.0

    # Cartera CxC
    sql_cxc = 'SELECT COALESCE(SUM("SaldoPendiente"), 0) as "TotalCxC" FROM "CuentaCobrar" WHERE "SaldoPendiente" > 0;'
    cxc_res = repo.caller.LlamarUnRegistro(sql_cxc)
    total_cxc = float(cxc_res["TotalCxC"]) if cxc_res else 0.0

    return {
        "TotalBancosBOB": total_bob,
        "TotalBancosUSD": total_usd,
        "TotalCuentasPagar": total_cxp,
        "TotalCuentasCobrar": total_cxc,
    }
