from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date

from app.Config.supabase import get_db
from app.Auth.Dependencies import get_current_user, require_role
from app.Constants.Roles import ROL_CONTADOR, ROL_GERENTE_GENERAL, ROL_SUPERVISOR, ROL_AGENTE_REPARTO
from app.Services.Contabilidad.CuentasCobrarService import CuentasCobrarService
from app.Models.Contabilidad.CuentasCobrarModel import (
    NotaVentaCrear, NotaVentaAjustarKevin, NotaVentaResponse,
    CuentaCobrarResponse, AbonoCuentaCobrarCrear, AbonoCuentaCobrarResponse,
    CierreTurnoChoferRequest, CierreTurnoResponse, PlanillaAbonosMasivosRequest,
    ResumenCarteraCliente
)

CuentasCobrarRouter = APIRouter(prefix="/cxc", tags=["Contabilidad - Cuentas por Cobrar y Notas de Venta"])

PERMISOS_CXC = [ROL_CONTADOR, ROL_GERENTE_GENERAL]
PERMISOS_VENTA_Y_REPARTO = [ROL_CONTADOR, ROL_GERENTE_GENERAL, ROL_SUPERVISOR, ROL_AGENTE_REPARTO]


# --- Notas de Venta por Camión / Despacho ---
@CuentasCobrarRouter.get("/notas-venta")
def listar_notas_venta(
    id_cliente: Optional[int] = Query(None),
    destino: Optional[str] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    fecha_inicio: Optional[date] = Query(None),
    fecha_fin: Optional[date] = Query(None),
    estado_pago: Optional[str] = Query(None),
    busqueda: str = Query(""),
    limit: int = Query(25),
    offset: int = Query(0),
    page: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXC))
):
    if page is not None and page > 0:
        offset = (page - 1) * limit

    f_ini = fecha_desde or fecha_inicio
    f_fin = fecha_hasta or fecha_fin
    notas = CuentasCobrarService(db).ListarNotasVenta(id_cliente, destino, f_ini, f_fin, busqueda)
    
    # Adaptar campos para compatibilidad con la interfaz
    resultado_notas = []
    for n in notas:
        saldo = float(n.get("SaldoPendiente") or 0.0)
        tot = float(n.get("ImporteNeto") or n.get("TotalVentaBruto") or 0.0)
        est = "Pagado" if saldo <= 0 else "Pendiente"
        cond = "Crédito" if saldo > 0 else "Contado"

        if estado_pago and estado_pago != "TODOS" and est.lower() != estado_pago.lower():
            continue

        n["NumeroNota"] = n.get("NumeroNotaVenta")
        n["FechaEmision"] = n.get("FechaVenta")
        n["RazonSocial"] = n.get("ClienteNombre")
        n["Ciudad"] = n.get("DestinoDepartamento")
        n["NumeroCamion"] = str(n.get("CantidadCamiones", 1))
        n["Placa"] = n.get("PlacaCamion")
        n["FleteChofer"] = 0.0
        n["CondicionVenta"] = cond
        n["TotalNeto"] = tot
        n["SaldoPendiente"] = saldo
        n["EstadoPago"] = est
        resultado_notas.append(n)

    total_notas = len(resultado_notas)
    paginados_notas = resultado_notas[offset : offset + limit]

    return {
        "items": paginados_notas,
        "total": total_notas,
        "limit": limit,
        "offset": offset,
        "page": (offset // limit) + 1 if limit > 0 else 1,
        "total_paginas": (total_notas + limit - 1) // limit if limit > 0 else 1
    }

@CuentasCobrarRouter.get("/notas-venta/{id_nota}")
def obtener_nota_venta(
    id_nota: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXC))
):
    n = CuentasCobrarService(db).ObtenerNotaVentaDetalle(id_nota)
    if n:
        n["NumeroNota"] = n.get("NumeroNotaVenta")
        n["TotalNeto"] = float(n.get("ImporteNeto") or n.get("TotalVentaBruto") or 0.0)
        n["SaldoPendiente"] = float(n.get("SaldoPendiente") or 0.0)
        n["CondicionVenta"] = "Crédito" if n["SaldoPendiente"] > 0 else "Contado"
        n["Cliente"] = {"RazonSocial": n.get("ClienteNombre"), "Ciudad": n.get("DestinoDepartamento")}
    return n

@CuentasCobrarRouter.post("/notas-venta")
def crear_nota_venta(
    dto: dict,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_VENTA_Y_REPARTO))
):
    num_nota = dto.get("numero_nota") or dto.get("NumeroNotaVenta", "NV-000")
    total = float(dto.get("total_neto") or dto.get("TotalVentaBruto") or dto.get("subtotal") or 0.0)
    id_cli = dto.get("id_cliente") or dto.get("IdCliente")

    detalles = []
    for d in dto.get("detalles", []):
        detalles.append({
            "IdPresentacion": d.get("presentacion_id") or d.get("IdPresentacion"),
            "NombreProducto": d.get("presentacion") or d.get("NombreProducto", "Papel"),
            "Cantidad": float(d.get("paquetes_entregados") or d.get("Cantidad", 1)),
            "PrecioUnitario": float(d.get("precio_unitario") or d.get("PrecioUnitario", 0)),
            "Subtotal": float(d.get("subtotal") or 0),
            "EsBonificacionBandeo": bool(d.get("es_bonificacion_bandeo") or d.get("EsBonificacionBandeo", False))
        })

    id_chofer_asignado = dto.get("id_chofer") or dto.get("IdChofer")
    if not id_chofer_asignado and usuario.get("IdRol") == ROL_AGENTE_REPARTO:
        id_chofer_asignado = usuario["IdUsuario"]

    nv = NotaVentaCrear(
        NumeroNotaVenta=num_nota,
        NumeroNotaEntrega=dto.get("numero_entrega") or dto.get("NumeroNotaEntrega"),
        IdCliente=id_cli,
        ClienteNombreLibre=dto.get("cliente_nombre_libre") or dto.get("ClienteNombreLibre"),
        DestinoDepartamento=dto.get("destino_departamento") or dto.get("DestinoDepartamento") or "Sucre",
        IdChofer=id_chofer_asignado,
        Chofer=dto.get("chofer") or usuario.get("NombreCompleto"),
        PlacaCamion=dto.get("placa") or dto.get("PlacaCamion"),
        TotalVentaBruto=total,
        ImporteNeto=float(dto.get("importe_neto") or total),
        EsCredito=dto.get("condicion_venta") == "Crédito" or bool(dto.get("es_credito")),
        IdSucursal=int(dto.get("id_sucursal") or dto.get("IdSucursal") or 1),
        MetodoPago=dto.get("metodo_pago") or dto.get("MetodoPago") or "Efectivo",
        MontoEfectivo=float(dto.get("monto_efectivo") or dto.get("MontoEfectivo") or 0.0),
        MontoQR=float(dto.get("monto_qr") or dto.get("MontoQR") or 0.0),
        MontoCredito=float(dto.get("monto_credito") or dto.get("MontoCredito") or 0.0),
        ComprobanteQRArchivoId=dto.get("comprobante_qr_archivo_id") or dto.get("ComprobanteQRArchivoId"),
        FirmaDigitalUrl=dto.get("firma_digital_url") or dto.get("FirmaDigitalUrl"),
        FirmaNombre=dto.get("firma_nombre") or dto.get("FirmaNombre"),
        FirmaCi=dto.get("firma_ci") or dto.get("FirmaCi"),
        Detalles=detalles
    )
    return CuentasCobrarService(db).CrearNotaVenta(nv, usuario["IdUsuario"])

@CuentasCobrarRouter.put("/notas-venta/{id_nota}/ajuste-kevin")
def ajustar_nota_venta_kevin(
    id_nota: int,
    dto: NotaVentaAjustarKevin,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXC))
):
    """Permite a Supervisión o Administrador ajustar importes de una nota con notificación al chofer."""
    return CuentasCobrarService(db).AjustarNotaVentaKevin(id_nota, dto, usuario["IdUsuario"])

@CuentasCobrarRouter.post("/chofer/cierre-turno")
def cierre_turno_chofer(
    dto: CierreTurnoChoferRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_VENTA_Y_REPARTO))
):
    """Cierre de turno diario: comparativa stock cargado vs vendido vs devuelto y liquidación de mermas/faltantes."""
    return CuentasCobrarService(db).ProcesarCierreTurnoChofer(dto, usuario["IdUsuario"])

@CuentasCobrarRouter.post("/abonos/chofer")
def registrar_abono_chofer(
    dto: AbonoCuentaCobrarCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_VENTA_Y_REPARTO))
):
    """El chofer registra un cobro en calle. Si es QR, la foto es obligatoria. Nace PENDIENTE_APROBACION."""
    return CuentasCobrarService(db).RegistrarAbonoChofer(dto, usuario["IdUsuario"])

@CuentasCobrarRouter.get("/abonos/pendientes")
def listar_abonos_pendientes(
    id_sucursal: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXC))
):
    """Bandeja de verificación de abonos QR y transferencias bancarias pendientes de conciliación."""
    return CuentasCobrarService(db).ListarAbonosPendientes(id_sucursal)

@CuentasCobrarRouter.put("/abonos/{id_abono}/resolver")
def resolver_abono_kevin(
    id_abono: int,
    dto: dict,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXC))
):
    """Supervisión aprueba o rechaza el cobro. Al aprobar, descuenta formalmente el saldo deudor."""
    aprobado = bool(dto.get("aprobado", False))
    obs = str(dto.get("observacion", ""))
    return CuentasCobrarService(db).ResolverAbonoKevin(id_abono, aprobado, usuario["IdUsuario"], obs)

@CuentasCobrarRouter.post("/abonos/masivos")
def procesar_abonos_masivos(
    dto: PlanillaAbonosMasivosRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXC))
):
    """Conciliación bancaria masiva por planilla Excel para cadenas de clientes."""
    return CuentasCobrarService(db).ProcesarAbonosMasivos(dto, usuario["IdUsuario"])


# --- Cuentas por Cobrar a Clientes ---
@CuentasCobrarRouter.get("/cuentas")
def listar_cuentas_cobrar(
    id_cliente: Optional[int] = Query(None),
    id_estado: Optional[int] = Query(None),
    busqueda: Optional[str] = Query(None),
    solo_con_saldo: bool = Query(False),
    solo_vencidas: bool = Query(False),
    limit: int = Query(25),
    offset: int = Query(0),
    page: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXC))
):
    if page is not None and page > 0:
        offset = (page - 1) * limit

    cuentas = CuentasCobrarService(db).ListarCuentasCobrar(id_cliente, id_estado, solo_con_saldo)
    
    resultado = []
    for c in cuentas:
        monto_total = float(c.get("MontoTotal") or 0.0)
        saldo_pendiente = float(c.get("SaldoPendiente") or 0.0)
        dias_mora = int(c.get("DiasMora") or 0)
        es_vencida = (dias_mora > 15)
        est = "Pagada" if saldo_pendiente <= 0 else ("Parcial" if saldo_pendiente < monto_total else "Pendiente")

        c["MontoTotal"] = monto_total
        c["SaldoPendiente"] = saldo_pendiente
        c["DiasMora"] = dias_mora
        c["RazonSocial"] = c.get("RazonSocialCliente")
        c["Ciudad"] = c.get("CiudadDestino", "Sucre")
        c["NumeroNota"] = c.get("NumeroNotaVenta") or f"NV-{c.get('IdNotaVenta', c.get('IdCuentaCobrar'))}"
        c["EsVencida"] = es_vencida
        c["Estado"] = est

        if solo_vencidas and not es_vencida:
            continue

        if busqueda and busqueda.strip():
            q = busqueda.strip().lower()
            cli = str(c.get("RazonSocial") or "").lower()
            ciu = str(c.get("Ciudad") or "").lower()
            not_v = str(c.get("NumeroNota") or "").lower()
            if q not in cli and q not in ciu and q not in not_v:
                continue

        resultado.append(c)

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

@CuentasCobrarRouter.post("/cuentas")
def crear_cuenta_cobrar_manual(
    dto: dict,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXC))
):
    """Permite registrar manualmente una Cuenta por Cobrar desde el módulo web."""
    return CuentasCobrarService(db).CrearCuentaCobrarManual(dto, usuario["IdUsuario"])

@CuentasCobrarRouter.get("/cuentas/{id_cxc}")
def obtener_cuenta_cobrar(
    id_cxc: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXC))
):
    c = CuentasCobrarService(db).ObtenerCuentaCobrarDetalle(id_cxc)
    if c:
        c["Cliente"] = {"RazonSocial": c.get("RazonSocialCliente"), "Ciudad": c.get("CiudadDestino")}
        for ab in c.get("Abonos", []):
            ab["IdAbono"] = ab.get("IdAbonoCuentaCobrar")
            ab["NumeroDeposito"] = ab.get("NumeroReferencia")
            ab["MontoAbono"] = ab.get("MontoAbonado")
    return c

@CuentasCobrarRouter.post("/abonos")
def registrar_abono(
    dto: dict,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXC))
):
    abono_dto = AbonoCuentaCobrarCrear(
        IdCuentaCobrar=int(dto.get("id_cuenta_cobrar") or dto.get("IdCuentaCobrar")),
        MontoAbonado=float(dto.get("monto_abono") or dto.get("MontoAbonado")),
        IdCuentaBancaria=dto.get("id_cuenta_bancaria"),
        NumeroReferencia=dto.get("numero_deposito") or dto.get("NumeroReferencia"),
        Depositante=dto.get("depositante"),
        MontoDolares=float(dto.get("monto_dolares") or 0.0),
        TipoCambio=float(dto.get("tipo_cambio") or 1.0),
        Observacion=dto.get("observaciones")
    )
    return CuentasCobrarService(db).RegistrarAbono(abono_dto, usuario["IdUsuario"])

@CuentasCobrarRouter.get("/cartera-resumen")
@CuentasCobrarRouter.get("/resumen-cartera")
def obtener_resumen_cartera(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXC))
):
    rows = CuentasCobrarService(db).ObtenerResumenCartera()
    total_por_cobrar = sum(float(r.get("SaldoPorCobrar", 0)) for r in rows)
    total_despachado = sum(float(r.get("MontoDespachoTotal", 0)) for r in rows)
    total_abonado = sum(float(r.get("TotalDepositos", 0)) for r in rows)
    vencida = sum(float(r.get("SaldoPorCobrar", 0)) for r in rows if r.get("DiasMoraPromedio", 0) > 15)
    clientes_mora = sum(1 for r in rows if r.get("DiasMoraPromedio", 0) > 15 and r.get("SaldoPorCobrar", 0) > 0)

    return {
        "TotalPorCobrar": total_por_cobrar,
        "TotalDespachado": total_despachado,
        "TotalAbonado": total_abonado,
        "CarteraVigente": total_por_cobrar - vencida,
        "CarteraVencida": vencida,
        "ClientesEnMora": clientes_mora,
        "TotalCuentasActivas": len(rows),
        "Clientes": rows
    }

@CuentasCobrarRouter.get("/clientes")
def listar_clientes_cxc(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXC))
):
    sql = 'SELECT "IdCliente", "RazonSocial", "NombreComercial", "NitCi", "CiudadDestino" as "Ciudad" FROM "Cliente" ORDER BY "RazonSocial" ASC;'
    return CuentasCobrarService(db).repo.caller.LlamarFuncion(sql)

@CuentasCobrarRouter.get("/clientes/{id_cliente}/estado-credito")
def verificar_estado_credito_cliente(
    id_cliente: int,
    nuevo_monto: float = Query(0.0),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXC))
):
    """Consulta si un cliente está bloqueado para venta a crédito por mora o límite de crédito."""
    return CuentasCobrarService(db).VerificarEstadoCredito(id_cliente, nuevo_monto)

@CuentasCobrarRouter.post("/clientes/{id_cliente}/recordatorio-mora")
def registrar_recordatorio_mora(
    id_cliente: int,
    dto: dict = {},
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXC))
):
    """Registra en el log de auditoría el recordatorio de mora enviado al cliente."""
    from sqlalchemy import text
    obs = dto.get("detalle") or f"Recordatorio de mora emitido por {usuario.get('PrimerNombre', 'Contador')} vía mensajería digital."
    sql_audit = """
        INSERT INTO "AuditLog" ("IdUsuario", "Accion", "TablaAfectada", "IdRegistroAfectado", "Detalle", "FechaHora")
        VALUES (:id_usuario, 'RECORDATORIO_MORA', 'Cliente', :id_cliente, :detalle, NOW())
        RETURNING "IdAuditLog";
    """
    res = db.execute(text(sql_audit), {
        "id_usuario": usuario["IdUsuario"],
        "id_cliente": str(id_cliente),
        "detalle": obs
    }).fetchone()
    db.commit()
    return {"success": True, "mensaje": "Recordatorio registrado con trazabilidad", "id_audit": res[0] if res else None}
