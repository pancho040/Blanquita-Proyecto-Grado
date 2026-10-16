from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date

from app.Config.supabase import get_db
from app.Auth.Dependencies import get_current_user, require_role
from app.Constants.Roles import ROL_CONTADOR, ROL_GERENTE_GENERAL
from app.Services.Contabilidad.CuentasCobrarService import CuentasCobrarService
from app.Models.Contabilidad.CuentasCobrarModel import (
    NotaVentaCrear, NotaVentaResponse,
    CuentaCobrarResponse, AbonoCuentaCobrarCrear, AbonoCuentaCobrarResponse,
    ResumenCarteraCliente
)

CuentasCobrarRouter = APIRouter(prefix="/cxc", tags=["Contabilidad - Cuentas por Cobrar y Notas de Venta"])

PERMISOS_CXC = [ROL_CONTADOR, ROL_GERENTE_GENERAL]


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
    usuario: dict = Depends(require_role(PERMISOS_CXC))
):
    num_nota = dto.get("numero_nota") or dto.get("NumeroNotaVenta", "NV-000")
    total = float(dto.get("total_neto") or dto.get("subtotal") or 0.0)
    id_cli = dto.get("id_cliente") or dto.get("IdCliente")

    detalles = []
    for d in dto.get("detalles", []):
        detalles.append({
            "NombreProducto": d.get("presentacion") or d.get("NombreProducto", "Papel"),
            "Cantidad": float(d.get("paquetes_entregados") or d.get("Cantidad", 1)),
            "PrecioUnitario": float(d.get("precio_unitario") or d.get("PrecioUnitario", 0)),
            "Subtotal": float(d.get("subtotal") or 0)
        })

    nv = NotaVentaCrear(
        NumeroNotaVenta=num_nota,
        IdCliente=id_cli,
        Chofer=dto.get("chofer"),
        PlacaCamion=dto.get("placa"),
        TotalVentaBruto=total,
        ImporteNeto=total,
        EsCredito=dto.get("condicion_venta") == "Crédito",
        Detalles=detalles
    )
    return CuentasCobrarService(db).CrearNotaVenta(nv, usuario["IdUsuario"])


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
