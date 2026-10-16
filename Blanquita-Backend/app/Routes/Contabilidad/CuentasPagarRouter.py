from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date

from app.Config.supabase import get_db
from app.Auth.Dependencies import get_current_user, require_role
from app.Constants.Roles import ROL_CONTADOR, ROL_GERENTE_GENERAL
from app.Services.Contabilidad.CuentasPagarService import CuentasPagarService
from app.Models.Contabilidad.CuentasPagarModel import (
    CuentaPagarCrear, CuentaPagarResponse,
    PagoCuentaPagarCrear, PagoCuentaPagarResponse,
    DevolucionProveedorCrear, DevolucionProveedorResponse
)

CuentasPagarRouter = APIRouter(prefix="/cxp", tags=["Contabilidad - Cuentas por Pagar a Proveedores"])

PERMISOS_CXP = [ROL_CONTADOR, ROL_GERENTE_GENERAL]


# --- Proveedores ---
@CuentasPagarRouter.get("/proveedores")
def listar_proveedores(
    solo_activos: bool = Query(True),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXP))
):
    provs = CuentasPagarService(db).ListarProveedores()
    for p in provs:
        p["NombreEmpresa"] = p.get("NombreProveedor") or p.get("RazonSocial")
        p["Rubro"] = "Materias Primas e Insumos"
    return provs

@CuentasPagarRouter.post("/proveedores")
def crear_proveedor_contabilidad(
    dto: dict,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXP))
):
    sql = """
        INSERT INTO "Proveedor" ("NombreProveedor", "NIT", "Telefono", "Ciudad", "Direccion")
        VALUES (:nombre, :nit, :telefono, :ciudad, :direccion)
        RETURNING *;
    """
    return CuentasPagarService(db).repo.caller.LlamarUnRegistro(sql, {
        "nombre": dto.get("nombre") or dto.get("NombreProveedor"),
        "nit": dto.get("nit"),
        "telefono": dto.get("telefono"),
        "ciudad": dto.get("ciudad", "Sucre"),
        "direccion": dto.get("direccion")
    })


# --- KPIs y Resumen CxP para Cards Superiores ---
@CuentasPagarRouter.get("/kpis-resumen")
def obtener_kpis_cxp(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXP))
):
    repo = CuentasPagarService(db).repo
    sql = """
        SELECT 
            COALESCE(SUM("SaldoPendiente"), 0) as "TotalDeuda",
            COUNT(*) as "TotalCuentas",
            COUNT(CASE WHEN "SaldoPendiente" > 0 THEN 1 END) as "FacturasPendientes",
            COUNT(CASE WHEN "SaldoPendiente" > 0 AND "FechaRecepcion" < CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as "FacturasVencidas",
            COUNT(DISTINCT CASE WHEN "SaldoPendiente" > 0 THEN "IdProveedor" END) as "ProveedoresConDeuda"
        FROM "CuentaPagarProveedor";
    """
    res = repo.caller.LlamarUnRegistro(sql)
    sql_prov = 'SELECT COUNT(*) as "TotalProveedores" FROM "Proveedor";'
    res_prov = repo.caller.LlamarUnRegistro(sql_prov)
    return {
        "TotalDeuda": float(res.get("TotalDeuda", 0.0)) if res else 0.0,
        "TotalCuentas": int(res.get("TotalCuentas", 0)) if res else 0,
        "FacturasPendientes": int(res.get("FacturasPendientes", 0)) if res else 0,
        "FacturasVencidas": int(res.get("FacturasVencidas", 0)) if res else 0,
        "ProveedoresConDeuda": int(res.get("ProveedoresConDeuda", 0)) if res else 0,
        "TotalProveedores": int(res_prov.get("TotalProveedores", 0)) if res_prov else 0,
    }


# --- Cuentas por Pagar ---
@CuentasPagarRouter.get("/cuentas")
def listar_cuentas_pagar(
    id_proveedor: Optional[int] = Query(None),
    estado: Optional[str] = Query(None),
    fecha_inicio: Optional[date] = Query(None),
    fecha_fin: Optional[date] = Query(None),
    busqueda: Optional[str] = Query(None),
    solo_vencidas: bool = Query(False),
    limit: int = Query(25),
    offset: int = Query(0),
    page: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXP))
):
    if page is not None and page > 0:
        offset = (page - 1) * limit

    cuentas = CuentasPagarService(db).ListarCuentasPagar(id_proveedor, estado, fecha_inicio, fecha_fin)
    
    # Normalización completa y segura de campos para evitar cualquier TypeError en el frontend
    resultado = []
    for c in cuentas:
        monto_total = float(c.get("PrecioFacturado") or c.get("TotalNeto") or c.get("MontoTotal") or 0.0)
        saldo_pendiente = float(c.get("SaldoPendiente") or 0.0)
        total_pagado = float(c.get("TotalPagado") or 0.0)
        est = "Pagada" if saldo_pendiente <= 0 else ("Parcial" if saldo_pendiente < monto_total else "Pendiente")
        
        c["MontoTotal"] = monto_total
        c["PrecioFacturado"] = monto_total
        c["SaldoPendiente"] = saldo_pendiente
        c["TotalPagado"] = total_pagado
        c["Concepto"] = c.get("ConceptoMaterial", "Compra de Insumos")
        c["FechaEmision"] = c.get("FechaRecepcion")
        c["EsVencida"] = False
        c["Estado"] = est

        # Filtro de búsqueda
        if busqueda and busqueda.strip():
            q = busqueda.strip().lower()
            prov = str(c.get("NombreProveedor") or "").lower()
            fac = str(c.get("NumeroFactura") or "").lower()
            con = str(c.get("Concepto") or "").lower()
            if q not in prov and q not in fac and q not in con:
                continue

        # Filtro de estado
        if estado and estado != "TODOS" and est.lower() != estado.lower():
            continue

        if solo_vencidas and not c["EsVencida"]:
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

@CuentasPagarRouter.get("/cuentas/{id_cxp}")
def obtener_cuenta_pagar(
    id_cxp: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXP))
):
    c = CuentasPagarService(db).ObtenerCuentaPagarDetalle(id_cxp)
    if c:
        c["Concepto"] = c.get("ConceptoMaterial", "Compra de Insumos")
        c["Proveedor"] = {"NombreEmpresa": c.get("NombreProveedor"), "NIT": "-"}
        for p in c.get("Pagos", []):
            p["IdPago"] = p.get("IdPagoCuentaPagar")
            p["MontoPago"] = p.get("MontoPagado")
            p["NumeroChequeTransferencia"] = p.get("NumeroTransaccion")
            p["MetodoPago"] = "Transferencia" if not p.get("EsCompensacion") else "Compensación"
    return c

@CuentasPagarRouter.post("/cuentas")
def crear_cuenta_pagar(
    dto: dict,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXP))
):
    c_dto = CuentaPagarCrear(
        IdProveedor=int(dto.get("id_proveedor") or dto.get("IdProveedor")),
        NumeroFactura=dto.get("numero_factura"),
        ConceptoMaterial=dto.get("concepto") or dto.get("ConceptoMaterial", "Compra Insumo"),
        TotalNeto=float(dto.get("monto_total") or dto.get("TotalNeto", 0.0)),
        TotalBruto=float(dto.get("monto_total") or dto.get("TotalBruto", 0.0)),
        DiasCredito=int(dto.get("dias_credito", 30)),
        FechaVencimiento=dto.get("fecha_vencimiento") or None
    )
    return CuentasPagarService(db).CrearCuentaPagar(c_dto, usuario["IdUsuario"])

@CuentasPagarRouter.post("/pagos")
def registrar_pago_proveedor(
    dto: dict,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXP))
):
    p_dto = PagoCuentaPagarCrear(
        IdCuentaPagar=int(dto.get("id_cuenta_pagar") or dto.get("IdCuentaPagar")),
        MontoPagado=float(dto.get("monto_pago") or dto.get("MontoPagado")),
        IdCuentaBancaria=dto.get("id_cuenta_bancaria"),
        NumeroTransaccion=dto.get("numero_cheque_transferencia") or dto.get("NumeroTransaccion"),
        EsCompensacion=dto.get("metodo_pago") == "Compensación",
        Observacion=dto.get("observaciones")
    )
    return CuentasPagarService(db).RegistrarPagoProveedor(p_dto, usuario["IdUsuario"])

@CuentasPagarRouter.get("/devoluciones")
def listar_devoluciones(
    id_proveedor: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXP))
):
    return CuentasPagarService(db).ListarDevoluciones(id_proveedor)

@CuentasPagarRouter.post("/devoluciones")
def registrar_devolucion(
    dto: dict,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXP))
):
    d_dto = DevolucionProveedorCrear(
        IdCuentaPagar=int(dto.get("id_cuenta_pagar") or dto.get("IdCuentaPagar")),
        MontoCompensado=float(dto.get("monto_compensado") or dto.get("MontoCompensado")),
        MotivoDevolucion=dto.get("motivo") or dto.get("MotivoDevolucion", "Devolución"),
        NumeroNotaCredito=dto.get("numero_nota_credito") or dto.get("NumeroNotaCredito")
    )
    return CuentasPagarService(db).RegistrarDevolucion(d_dto)

@CuentasPagarRouter.get("/balance-proveedores")
def obtener_balance_proveedores(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_CXP))
):
    sql = """
        SELECT p."IdProveedor", p."NombreProveedor",
               COALESCE(SUM(cp."PrecioFacturado"), 0) as "TotalCompras",
               COALESCE(SUM(cp."SaldoPendiente"), 0) as "SaldoPendiente"
        FROM "Proveedor" p
        LEFT JOIN "CuentaPagarProveedor" cp ON p."IdProveedor" = cp."IdProveedor"
        GROUP BY p."IdProveedor", p."NombreProveedor"
        HAVING COALESCE(SUM(cp."PrecioFacturado"), 0) > 0
        ORDER BY "SaldoPendiente" DESC;
    """
    return CuentasPagarService(db).repo.caller.LlamarFuncion(sql)
