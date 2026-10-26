from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Constants.Roles import ROL_CONTADOR, ROL_GERENTE_GENERAL, ROL_SUPERVISOR

ReportesRouter = APIRouter(prefix="/reportes", tags=["Módulo Central de Reportes y Análisis"])

ROLES_PERMITIDOS = [ROL_GERENTE_GENERAL, ROL_CONTADOR, ROL_SUPERVISOR]


# =============================================================================
# 1. REPORTES DE CONTABILIDAD Y TESORERÍA
# =============================================================================

@ReportesRouter.get("/contabilidad/flujo-caja")
def reporte_flujo_caja(
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    tipo: Optional[str] = None,
    id_categoria: Optional[int] = None,
    id_cuenta_bancaria: Optional[int] = None,
    metodo_pago: Optional[str] = None,
    busqueda: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_PERMITIDOS))
):
    where = ["1=1", 'COALESCE(mc."Anulado", false) = false']
    params = {}

    if fecha_inicio:
        where.append('mc."FechaMovimiento"::date >= :f_ini')
        params["f_ini"] = fecha_inicio
    if fecha_fin:
        where.append('mc."FechaMovimiento"::date <= :f_fin')
        params["f_fin"] = fecha_fin
    if tipo and tipo != "TODOS":
        where.append('cat."TipoMovimiento" = :tipo')
        params["tipo"] = tipo
    if id_categoria:
        where.append('mc."IdCategoriaMovimientoCaja" = :id_cat')
        params["id_cat"] = id_categoria
    if id_cuenta_bancaria:
        where.append('mc."IdCuentaBancaria" = :id_banco')
        params["id_banco"] = id_cuenta_bancaria
    if metodo_pago and metodo_pago != "TODOS":
        where.append('mc."MetodoPago" ILIKE :metodo')
        params["metodo"] = f"%{metodo_pago}%"
    if busqueda and busqueda.strip():
        where.append('(mc."Descripcion" ILIKE :q OR mc."Solicitante" ILIKE :q OR mc."NumeroReferencia" ILIKE :q OR cat."NombreCategoria" ILIKE :q)')
        params["q"] = f"%{busqueda.strip()}%"

    where_sql = " AND ".join(where)

    sql = f"""
        SELECT 
            mc."IdMovimientoCaja" as "id",
            mc."FechaMovimiento" as "fecha_hora",
            cat."TipoMovimiento" as "tipo",
            mc."Monto" as "monto",
            COALESCE(cat."NombreCategoria", 'General') as "categoria",
            COALESCE(mc."Descripcion", '-') as "glosa",
            COALESCE(mc."Solicitante", 'Empresa') as "beneficiario",
            COALESCE(mc."NumeroReferencia", 'S/N') as "referencia",
            COALESCE(mc."MetodoPago", 'Efectivo') as "metodo_pago",
            b."NombreBanco" as "banco"
        FROM "MovimientoCaja" mc
        LEFT JOIN "CategoriaMovimientoCaja" cat ON mc."IdCategoriaMovimientoCaja" = cat."IdCategoriaMovimientoCaja"
        LEFT JOIN "CuentaBancariaEmpresa" b ON mc."IdCuentaBancaria" = b."IdCuentaBancaria"
        WHERE {where_sql}
        ORDER BY mc."FechaMovimiento" DESC, mc."IdMovimientoCaja" DESC;
    """
    rows = db.execute(text(sql), params).mappings().fetchall()
    items = [dict(r) for r in rows]

    total_ingresos = sum(float(i["monto"] or 0) for i in items if i["tipo"] == "Ingreso")
    total_egresos = sum(float(i["monto"] or 0) for i in items if i["tipo"] == "Egreso")

    return {
        "metricas": {
            "total_ingresos_bs": total_ingresos,
            "total_egresos_bs": total_egresos,
            "saldo_neto_bs": round(total_ingresos - total_egresos, 2),
            "total_movimientos": len(items)
        },
        "data": items
    }


@ReportesRouter.get("/contabilidad/cuentas-cobrar")
def reporte_cuentas_cobrar(
    id_cliente: Optional[int] = None,
    estado: Optional[str] = None,
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    ciudad: Optional[str] = None,
    busqueda: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_PERMITIDOS))
):
    where = ["1=1"]
    params = {}

    if id_cliente:
        where.append('cxc."IdCliente" = :id_cli')
        params["id_cli"] = id_cliente
    if fecha_inicio:
        where.append('cxc."FechaEmision" >= :f_ini')
        params["f_ini"] = fecha_inicio
    if fecha_fin:
        where.append('cxc."FechaEmision" <= :f_fin')
        params["f_fin"] = fecha_fin
    if ciudad and ciudad != "TODAS":
        where.append('cli."CiudadDestino" ILIKE :ciudad')
        params["ciudad"] = f"%{ciudad}%"
    if busqueda and busqueda.strip():
        where.append('(cli."RazonSocial" ILIKE :q OR cxc."NumeroNotaVenta" ILIKE :q OR cli."NitCi" ILIKE :q)')
        params["q"] = f"%{busqueda.strip()}%"

    where_sql = " AND ".join(where)

    sql = f"""
        SELECT 
            cxc."IdCuentaCobrar" as "id",
            COALESCE(cxc."NumeroNotaVenta", 'NV-' || cxc."IdCuentaCobrar") as "nro_nota",
            cxc."FechaEmision" as "fecha_emision",
            cxc."FechaVencimiento" as "fecha_vencimiento",
            cli."RazonSocial" as "cliente_nombre",
            COALESCE(cli."NitCi", '-') as "cliente_nit",
            COALESCE(cli."CiudadDestino", 'Sucre') as "ciudad",
            COALESCE(cli."Telefono", '-') as "telefono",
            cxc."MontoTotal" as "monto_total",
            cxc."SaldoPendiente" as "saldo_pendiente",
            (cxc."MontoTotal" - cxc."SaldoPendiente") as "total_abonado",
            CASE 
                WHEN cxc."SaldoPendiente" > 0 AND cxc."FechaVencimiento" IS NOT NULL AND CURRENT_DATE > cxc."FechaVencimiento" 
                THEN (CURRENT_DATE - cxc."FechaVencimiento")
                ELSE COALESCE(cxc."DiasMora", 0)
            END as "dias_mora",
            cli."LimiteCreditoBs" as "limite_credito"
        FROM "CuentaCobrar" cxc
        JOIN "Cliente" cli ON cxc."IdCliente" = cli."IdCliente"
        WHERE {where_sql}
        ORDER BY cxc."FechaEmision" DESC, cxc."IdCuentaCobrar" DESC;
    """
    rows = db.execute(text(sql), params).mappings().fetchall()
    items = []

    for r in rows:
        d = dict(r)
        dias_mora = int(d.get("dias_mora") or 0)
        saldo = float(d.get("saldo_pendiente") or 0.0)

        if saldo <= 0:
            urgencia = "CANCELADO"
        elif dias_mora > 15:
            urgencia = "VENCIDO"
        elif dias_mora > 0:
            urgencia = "CRÍTICO"
        else:
            urgencia = "NORMAL"

        d["urgencia"] = urgencia

        # Filtro de estado post-query si aplica
        if estado == "VIGENTE" and (saldo <= 0 or dias_mora > 15):
            continue
        if estado == "VENCIDO_15" and (saldo <= 0 or dias_mora <= 15):
            continue
        if estado == "CANCELADO" and saldo > 0:
            continue

        items.append(d)

    total_cartera = sum(float(i["monto_total"] or 0) for i in items)
    total_abonado = sum(float(i["total_abonado"] or 0) for i in items)
    total_pendiente = sum(float(i["saldo_pendiente"] or 0) for i in items)
    deuda_vencida = sum(float(i["saldo_pendiente"] or 0) for i in items if i["urgencia"] == "VENCIDO")
    clientes_mora = len(set(i["cliente_nombre"] for i in items if i["urgencia"] == "VENCIDO"))

    return {
        "metricas": {
            "total_cartera_bs": total_cartera,
            "total_abonado_bs": total_abonado,
            "total_pendiente_bs": total_pendiente,
            "deuda_vencida_15_dias_bs": deuda_vencida,
            "clientes_en_riesgo": clientes_mora,
            "cantidad_cuentas": len(items)
        },
        "data": items
    }


@ReportesRouter.get("/contabilidad/cuentas-pagar")
def reporte_cuentas_pagar(
    id_proveedor: Optional[int] = None,
    urgencia: Optional[str] = None,
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    busqueda: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_PERMITIDOS))
):
    where = ["1=1"]
    params = {}

    if id_proveedor:
        where.append('cxp."IdProveedor" = :id_prov')
        params["id_prov"] = id_proveedor
    if fecha_inicio:
        where.append('cxp."FechaRecepcion" >= :f_ini')
        params["f_ini"] = fecha_inicio
    if fecha_fin:
        where.append('cxp."FechaRecepcion" <= :f_fin')
        params["f_fin"] = fecha_fin
    if busqueda and busqueda.strip():
        where.append('(p."NombreProveedor" ILIKE :q OR cxp."NumeroFactura" ILIKE :q OR cxp."NumeroNota" ILIKE :q)')
        params["q"] = f"%{busqueda.strip()}%"

    where_sql = " AND ".join(where)

    sql = f"""
        SELECT 
            cxp."IdCuentaPagar" as "id",
            p."NombreProveedor" as "proveedor_nombre",
            COALESCE(p."CelularProveedor", '-') as "proveedor_nit",
            COALESCE(cxp."NumeroFactura", cxp."NumeroNota", 'S/N') as "nro_factura_o_nota",
            cxp."FechaRecepcion" as "fecha_recepcion",
            cxp."FechaEnvio" as "fecha_vencimiento",
            COALESCE(cxp."PrecioFacturado", 0) as "monto_total",
            COALESCE(cxp."SaldoPendiente", 0) as "saldo_pendiente_bs",
            COALESCE(cxp."ConceptoMaterial", 'Materia Prima e Insumos') as "concepto",
            CASE 
                WHEN cxp."FechaEnvio" IS NOT NULL THEN (cxp."FechaEnvio" - CURRENT_DATE)
                ELSE 30
            END as "dias_para_vencimiento"
        FROM "CuentaPagarProveedor" cxp
        JOIN "Proveedor" p ON cxp."IdProveedor" = p."IdProveedor"
        WHERE {where_sql}
        ORDER BY cxp."FechaRecepcion" DESC, cxp."IdCuentaPagar" DESC;
    """
    rows = db.execute(text(sql), params).mappings().fetchall()
    items = []

    for r in rows:
        d = dict(r)
        dias = int(d.get("dias_para_vencimiento") or 0)
        saldo = float(d.get("saldo_pendiente_bs") or 0.0)

        if saldo <= 0:
            urg = "PAGADO"
        elif dias < 0:
            urg = "VENCIDO"
        elif dias <= 7:
            urg = "CRÍTICO"
        else:
            urg = "NORMAL"

        d["urgencia"] = urg

        if urgencia and urgencia != "TODOS" and urg != urgencia:
            continue

        items.append(d)

    deuda_total = sum(float(i["saldo_pendiente_bs"] or 0) for i in items)
    deuda_vencida = sum(float(i["saldo_pendiente_bs"] or 0) for i in items if i["urgencia"] == "VENCIDO")
    deuda_critica = sum(float(i["saldo_pendiente_bs"] or 0) for i in items if i["urgencia"] == "CRÍTICO")
    deuda_regular = sum(float(i["saldo_pendiente_bs"] or 0) for i in items if i["urgencia"] == "NORMAL")

    return {
        "metricas": {
            "deuda_total_acumulada_bs": deuda_total,
            "deuda_vencida_bs": deuda_vencida,
            "deuda_critica_7_dias_bs": deuda_critica,
            "deuda_regular_bs": deuda_regular,
            "cantidad_facturas": len(items)
        },
        "data": items
    }


@ReportesRouter.get("/contabilidad/notas-venta")
def reporte_notas_venta(
    id_cliente: Optional[int] = None,
    condicion: Optional[str] = None,
    estado_pago: Optional[str] = None,
    ciudad: Optional[str] = None,
    chofer: Optional[str] = None,
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    busqueda: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_PERMITIDOS))
):
    where = ["1=1"]
    params = {}

    if id_cliente:
        where.append('nv."IdCliente" = :id_cli')
        params["id_cli"] = id_cliente
    if fecha_inicio:
        where.append('nv."FechaVenta" >= :f_ini')
        params["f_ini"] = fecha_inicio
    if fecha_fin:
        where.append('nv."FechaVenta" <= :f_fin')
        params["f_fin"] = fecha_fin
    if ciudad and ciudad != "TODAS":
        where.append('nv."DestinoDepartamento" ILIKE :ciu')
        params["ciu"] = f"%{ciudad}%"
    if chofer and chofer.strip():
        where.append('nv."Chofer" ILIKE :chof')
        params["chof"] = f"%{chofer.strip()}%"
    if busqueda and busqueda.strip():
        where.append('(nv."NumeroNotaVenta" ILIKE :q OR nv."ClienteNombreLibre" ILIKE :q OR c."RazonSocial" ILIKE :q OR nv."PlacaCamion" ILIKE :q)')
        params["q"] = f"%{busqueda.strip()}%"

    where_sql = " AND ".join(where)

    sql = f"""
        SELECT 
            nv."IdNotaVenta" as "id",
            nv."NumeroNotaVenta" as "nro_nota",
            nv."NumeroNotaEntrega" as "nro_entrega",
            nv."FechaVenta" as "fecha_venta",
            COALESCE(c."RazonSocial", nv."ClienteNombreLibre", 'Cliente Mostrador') as "cliente_nombre",
            COALESCE(nv."DestinoDepartamento", 'Sucre') as "ciudad_destino",
            COALESCE(nv."Chofer", 'Sin Chofer') as "chofer",
            COALESCE(nv."PlacaCamion", '-') as "placa",
            nv."TotalVentaBruto" as "total_bruto",
            COALESCE(nv."DescuentoBonificacion", 0) as "descuento",
            nv."ImporteNeto" as "importe_neto",
            nv."TotalCancelado" as "total_cancelado",
            nv."SaldoPendiente" as "saldo_pendiente",
            CASE WHEN nv."SaldoPendiente" > 0 THEN 'Crédito' ELSE 'Contado' END as "condicion_venta",
            CASE WHEN nv."SaldoPendiente" <= 0 THEN 'Pagado' ELSE 'Pendiente' END as "estado_pago"
        FROM "NotaVenta" nv
        LEFT JOIN "Cliente" c ON nv."IdCliente" = c."IdCliente"
        WHERE {where_sql}
        ORDER BY nv."FechaVenta" DESC, nv."IdNotaVenta" DESC;
    """
    rows = db.execute(text(sql), params).mappings().fetchall()
    items = []

    for r in rows:
        d = dict(r)
        if condicion == "CONTADO" and d["condicion_venta"] != "Contado":
            continue
        if condicion == "CREDITO" and d["condicion_venta"] != "Crédito":
            continue
        if estado_pago and estado_pago != "TODOS" and d["estado_pago"] != estado_pago:
            continue
        items.append(d)

    total_bruto = sum(float(i["total_bruto"] or 0) for i in items)
    total_descuento = sum(float(i["descuento"] or 0) for i in items)
    total_neto = sum(float(i["importe_neto"] or 0) for i in items)
    total_cancelado = sum(float(i["total_cancelado"] or 0) for i in items)
    total_saldo = sum(float(i["saldo_pendiente"] or 0) for i in items)

    return {
        "metricas": {
            "total_bruto_bs": total_bruto,
            "total_descuentos_bs": total_descuento,
            "total_neto_bs": total_neto,
            "total_cancelado_bs": total_cancelado,
            "total_saldo_pendiente_bs": total_saldo,
            "cantidad_notas": len(items)
        },
        "data": items
    }


# =============================================================================
# 2. REPORTES DE LOGÍSTICA Y DISTRIBUCIÓN
# =============================================================================

@ReportesRouter.get("/logistica/desempeno-rutas")
def reporte_desempeno_rutas(
    id_repartidor: Optional[int] = None,
    id_ruta: Optional[int] = None,
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_PERMITIDOS))
):
    where = ["1=1"]
    params = {}

    if id_repartidor:
        where.append('ar."IdUsuarioRepartidor" = :id_rep')
        params["id_rep"] = id_repartidor
    if id_ruta:
        where.append('ar."IdRutaDistribucion" = :id_ruta')
        params["id_ruta"] = id_ruta
    if fecha_inicio:
        where.append('ar."FechaAsignacion" >= :f_ini')
        params["f_ini"] = fecha_inicio
    if fecha_fin:
        where.append('ar."FechaAsignacion" <= :f_fin')
        params["f_fin"] = fecha_fin

    where_sql = " AND ".join(where)

    sql = f"""
        SELECT 
            ar."IdAsignacionRuta" as "id",
            ar."FechaAsignacion" as "fecha",
            r."NombreRuta" as "ruta_nombre",
            CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "chofer_nombre",
            ar."Estado" as "estado_asignacion",
            COALESCE(ar."KilometrajeInicial", 0) as "km_inicial",
            COALESCE(ar."KilometrajeFinal", 0) as "km_final",
            GREATEST(COALESCE(ar."KilometrajeFinal", 0) - COALESCE(ar."KilometrajeInicial", 0), 0) as "km_recorridos",
            (SELECT COUNT(*) FROM "Pedido" p WHERE p."IdAsignacionRuta" = ar."IdAsignacionRuta") as "paradas_totales",
            (SELECT COUNT(*) FROM "Pedido" p WHERE p."IdAsignacionRuta" = ar."IdAsignacionRuta" AND p."IdEstadoPedido" IN (3, 4)) as "paradas_entregadas",
            (SELECT COALESCE(SUM(pp."Monto"), 0) FROM "PagoPedido" pp JOIN "Pedido" p ON pp."IdPedido" = p."IdPedido" WHERE p."IdAsignacionRuta" = ar."IdAsignacionRuta" AND pp."IdMetodoPago" = 1) as "recaudacion_efectivo",
            (SELECT COALESCE(SUM(pp."Monto"), 0) FROM "PagoPedido" pp JOIN "Pedido" p ON pp."IdPedido" = p."IdPedido" WHERE p."IdAsignacionRuta" = ar."IdAsignacionRuta" AND pp."IdMetodoPago" != 1) as "recaudacion_qr"
        FROM "AsignacionRuta" ar
        JOIN "RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
        JOIN "Usuario" u ON ar."IdUsuarioRepartidor" = u."IdUsuario"
        WHERE {where_sql}
        ORDER BY ar."FechaAsignacion" DESC, ar."IdAsignacionRuta" DESC;
    """
    rows = db.execute(text(sql), params).mappings().fetchall()
    items = []

    for r in rows:
        d = dict(r)
        tot_paradas = int(d.get("paradas_totales") or 0)
        entregadas = int(d.get("paradas_entregadas") or 0)
        efectividad = round((entregadas / tot_paradas * 100), 1) if tot_paradas > 0 else 0.0

        efectivo = float(d.get("recaudacion_efectivo") or 0.0)
        qr = float(d.get("recaudacion_qr") or 0.0)

        d["porcentaje_efectividad"] = efectividad
        d["total_recaudado"] = round(efectivo + qr, 2)
        items.append(d)

    total_paradas = sum(int(i["paradas_totales"] or 0) for i in items)
    total_entregadas = sum(int(i["paradas_entregadas"] or 0) for i in items)
    efectividad_global = round((total_entregadas / total_paradas * 100), 1) if total_paradas > 0 else 0.0
    total_efectivo = sum(float(i["recaudacion_efectivo"] or 0) for i in items)
    total_qr = sum(float(i["recaudacion_qr"] or 0) for i in items)
    total_km = sum(float(i["km_recorridos"] or 0) for i in items)

    return {
        "metricas": {
            "total_rutas_ejecutadas": len(items),
            "total_paradas_programadas": total_paradas,
            "total_paradas_entregadas": total_entregadas,
            "efectividad_promedio": efectividad_global,
            "total_recaudado_efectivo_bs": total_efectivo,
            "total_recaudado_qr_bs": total_qr,
            "total_recaudado_global_bs": round(total_efectivo + total_qr, 2),
            "km_totales_recorridos": total_km
        },
        "data": items
    }


@ReportesRouter.get("/logistica/cobertura-clientes")
def reporte_cobertura_clientes(
    ciudad: Optional[str] = None,
    zona: Optional[str] = None,
    con_gps: Optional[bool] = None,
    busqueda: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_PERMITIDOS))
):
    where = ["1=1"]
    params = {}

    if ciudad and ciudad != "TODAS":
        where.append('c."CiudadDestino" ILIKE :ciu')
        params["ciu"] = f"%{ciudad}%"
    if con_gps is True:
        where.append('c."Latitud" IS NOT NULL AND c."Longitud" IS NOT NULL')
    elif con_gps is False:
        where.append('(c."Latitud" IS NULL OR c."Longitud" IS NULL)')
    if busqueda and busqueda.strip():
        where.append('(c."RazonSocial" ILIKE :q OR c."NombreComercial" ILIKE :q OR c."Direccion" ILIKE :q OR c."NitCi" ILIKE :q)')
        params["q"] = f"%{busqueda.strip()}%"

    where_sql = " AND ".join(where)

    sql = f"""
        SELECT 
            c."IdCliente" as "id",
            c."RazonSocial" as "razon_social",
            COALESCE(c."NombreComercial", c."RazonSocial") as "nombre_comercial",
            COALESCE(c."NitCi", '-') as "nit_ci",
            COALESCE(c."Telefono", '-') as "telefono",
            COALESCE(c."Direccion", 'Sin dirección registrada') as "direccion",
            COALESCE(c."CiudadDestino", 'Sucre') as "ciudad",
            c."Latitud" as "latitud",
            c."Longitud" as "longitud",
            COALESCE(c."LimiteCreditoBs", 0) as "limite_credito_bs",
            COALESCE(c."DiasCredito", 15) as "dias_credito",
            (SELECT COUNT(*) FROM "PuntoVenta" pv WHERE pv."IdCliente" = c."IdCliente") as "puntos_venta_count",
            (SELECT COUNT(*) FROM "NotaVenta" nv WHERE nv."IdCliente" = c."IdCliente") as "total_compras_historicas"
        FROM "Cliente" c
        WHERE {where_sql}
        ORDER BY c."RazonSocial" ASC;
    """
    rows = db.execute(text(sql), params).mappings().fetchall()
    items = [dict(r) for r in rows]

    total_gps = sum(1 for i in items if i.get("latitud") and i.get("longitud"))
    total_puntos = sum(int(i.get("puntos_venta_count") or 0) for i in items)
    con_credito = sum(1 for i in items if float(i.get("limite_credito_bs") or 0) > 0)

    return {
        "metricas": {
            "total_clientes": len(items),
            "clientes_con_gps": total_gps,
            "total_puntos_venta": total_puntos,
            "clientes_habilitados_credito": con_credito
        },
        "data": items
    }


# =============================================================================
# 3. REPORTES DE RECURSOS HUMANOS Y ASISTENCIA
# =============================================================================

@ReportesRouter.get("/rrhh/asistencia-puntualidad")
def reporte_asistencia_puntualidad(
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    id_usuario: Optional[int] = None,
    area: Optional[str] = None,
    solo_atrasos: bool = False,
    solo_faltas: bool = False,
    busqueda: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_PERMITIDOS))
):
    where = ["1=1"]
    params = {}

    if fecha_inicio:
        where.append('a."Fecha" >= :f_ini')
        params["f_ini"] = fecha_inicio
    if fecha_fin:
        where.append('a."Fecha" <= :f_fin')
        params["f_fin"] = fecha_fin
    if id_usuario:
        where.append('a."IdUsuario" = :id_u')
        params["id_u"] = id_usuario
    if area and area != "TODAS":
        where.append('t."Area" ILIKE :area')
        params["area"] = f"%{area}%"
    if solo_atrasos:
        where.append('a."MinutosAtraso" > 0')
    if solo_faltas:
        where.append('a."EsFalta" = true')
    if busqueda and busqueda.strip():
        where.append('(u."PrimerNombre" ILIKE :q OR u."ApellidoPaterno" ILIKE :q OR u."Ci" ILIKE :q)')
        params["q"] = f"%{busqueda.strip()}%"

    where_sql = " AND ".join(where)

    sql = f"""
        SELECT 
            a."IdAsistenciaDiaria" as "id",
            a."Fecha" as "fecha",
            CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "empleado_nombre",
            COALESCE(u."Ci", '-') as "ci",
            COALESCE(r."NombreRol", 'Personal') as "cargo",
            COALESCE(t."Area", 'General') as "area",
            COALESCE(t."NombreTurno", 'Estándar') as "turno",
            t."HoraInicio" as "hora_oficial_entrada",
            a."HoraEntrada" as "hora_real_entrada",
            a."HoraSalida" as "hora_real_salida",
            COALESCE(a."MinutosAtraso", 0) as "minutos_atraso",
            COALESCE(a."HorasExtraTrabajadas", 0) as "horas_extra",
            COALESCE(a."EsFalta", false) as "es_falta",
            COALESCE(a."FaltaJustificada", false) as "falta_justificada",
            CASE 
                WHEN a."EsFalta" = true THEN 'FALTA'
                WHEN a."MinutosAtraso" > 0 THEN 'ATRASADO'
                ELSE 'PUNTUAL'
            END as "estado_asistencia",
            COALESCE(a."Observacion", '-') as "observacion"
        FROM "AsistenciaDiaria" a
        JOIN "Usuario" u ON a."IdUsuario" = u."IdUsuario"
        LEFT JOIN "Turno" t ON a."IdTurno" = t."IdTurno"
        LEFT JOIN "Rol" r ON u."IdRol" = r."IdRol"
        WHERE {where_sql}
        ORDER BY a."Fecha" DESC, a."HoraEntrada" ASC;
    """
    rows = db.execute(text(sql), params).mappings().fetchall()
    items = [dict(r) for r in rows]

    total_atraso_min = sum(int(i["minutos_atraso"] or 0) for i in items)
    total_he = sum(float(i["horas_extra"] or 0) for i in items)
    total_faltas = sum(1 for i in items if i.get("es_falta"))
    total_puntuales = sum(1 for i in items if i.get("estado_asistencia") == "PUNTUAL")

    return {
        "metricas": {
            "total_registros": len(items),
            "total_minutos_atraso": total_atraso_min,
            "total_horas_extra": total_he,
            "total_faltas": total_faltas,
            "total_puntuales": total_puntuales
        },
        "data": items
    }


@ReportesRouter.get("/rrhh/nomina-historica")
def reporte_nomina_historica(
    id_periodo: Optional[int] = None,
    anio: Optional[int] = None,
    mes: Optional[int] = None,
    id_usuario: Optional[int] = None,
    busqueda: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_PERMITIDOS))
):
    where = ["1=1"]
    params = {}

    if id_periodo:
        where.append('pl."IdPeriodoNomina" = :id_per')
        params["id_per"] = id_periodo
    if anio:
        where.append('pn."Anio" = :anio')
        params["anio"] = anio
    if mes:
        where.append('pn."Mes" = :mes')
        params["mes"] = mes
    if id_usuario:
        where.append('dp."IdUsuario" = :id_u')
        params["id_u"] = id_usuario
    if busqueda and busqueda.strip():
        where.append('(u."PrimerNombre" ILIKE :q OR u."ApellidoPaterno" ILIKE :q OR u."Ci" ILIKE :q)')
        params["q"] = f"%{busqueda.strip()}%"

    where_sql = " AND ".join(where)

    sql = f"""
        SELECT 
            dp."IdDetallePlanilla" as "id",
            pl."IdPlanilla" as "id_planilla",
            CONCAT(pn."Mes", '/', pn."Anio") as "periodo",
            CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "empleado_nombre",
            COALESCE(u."Ci", '-') as "ci",
            COALESCE(r."NombreRol", 'Personal') as "cargo",
            dp."SueldoBasico" as "sueldo_basico",
            dp."MontoHorasExtra" as "horas_extra_bs",
            dp."MontoComisiones" as "comisiones_bs",
            dp."TotalBonos" as "bonos_bs",
            dp."TotalGanado" as "total_ganado",
            dp."AporteAFP" as "afp_bs",
            (dp."DescuentoAtrasos" + dp."DescuentoFaltas") as "descuento_asistencia_bs",
            dp."OtrasDeducciones" as "anticipos_bs",
            dp."TotalDescuento" as "total_descuento",
            dp."LiquidoPagable" as "liquido_pagable",
            pl."Aprobada" as "aprobada",
            dp."Observacion" as "observacion"
        FROM "DetallePlanilla" dp
        JOIN "Planilla" pl ON dp."IdPlanilla" = pl."IdPlanilla"
        JOIN "PeriodoNomina" pn ON pl."IdPeriodoNomina" = pn."IdPeriodoNomina"
        JOIN "Usuario" u ON dp."IdUsuario" = u."IdUsuario"
        LEFT JOIN "Rol" r ON u."IdRol" = r."IdRol"
        WHERE {where_sql}
        ORDER BY pn."Anio" DESC, pn."Mes" DESC, dp."LiquidoPagable" DESC;
    """
    rows = db.execute(text(sql), params).mappings().fetchall()
    items = [dict(r) for r in rows]

    total_bruto = sum(float(i["total_ganado"] or 0) for i in items)
    total_comisiones = sum(float(i["comisiones_bs"] or 0) for i in items)
    total_afp = sum(float(i["afp_bs"] or 0) for i in items)
    total_anticipos = sum(float(i["anticipos_bs"] or 0) for i in items)
    total_deducciones = sum(float(i["total_descuento"] or 0) for i in items)
    total_liquido = sum(float(i["liquido_pagable"] or 0) for i in items)

    return {
        "metricas": {
            "total_bruto_acumulado_bs": total_bruto,
            "total_comisiones_reparto_bs": total_comisiones,
            "total_afp_ley_bs": total_afp,
            "total_anticipos_deducidos_bs": total_anticipos,
            "total_deducciones_bs": total_deducciones,
            "total_liquido_pagable_bs": total_liquido,
            "cantidad_boletas": len(items)
        },
        "data": items
    }


# =============================================================================
# 4. REPORTES DE SEGURIDAD Y AUDITORÍA TRANSACCIONAL
# =============================================================================

@ReportesRouter.get("/auditoria/actividad-seguridad")
def reporte_auditoria_seguridad(
    id_usuario: Optional[int] = None,
    accion: Optional[str] = None,
    tabla: Optional[str] = None,
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    busqueda: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role([ROL_GERENTE_GENERAL, ROL_CONTADOR]))
):
    where = ["1=1"]
    params = {}

    if id_usuario:
        where.append('a."IdUsuario" = :id_u')
        params["id_u"] = id_usuario
    if accion and accion != "TODAS":
        where.append('a."Accion" = :acc')
        params["acc"] = accion
    if tabla and tabla.strip():
        where.append('a."TablaAfectada" ILIKE :tab')
        params["tab"] = f"%{tabla.strip()}%"
    if fecha_inicio:
        where.append('a."FechaHora"::date >= :f_ini')
        params["f_ini"] = fecha_inicio
    if fecha_fin:
        where.append('a."FechaHora"::date <= :f_fin')
        params["f_fin"] = fecha_fin
    if busqueda and busqueda.strip():
        where.append('(a."Detalle" ILIKE :q OR a."TablaAfectada" ILIKE :q OR u."PrimerNombre" ILIKE :q OR u."ApellidoPaterno" ILIKE :q)')
        params["q"] = f"%{busqueda.strip()}%"

    where_sql = " AND ".join(where)

    sql = f"""
        SELECT 
            a."IdAuditLog" as "id",
            a."FechaHora" as "fecha_hora",
            CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "usuario_nombre",
            COALESCE(r."NombreRol", 'Administrativo') as "rol",
            a."Accion" as "accion",
            a."TablaAfectada" as "modulo_tabla",
            COALESCE(a."IdRegistroAfectado", '-') as "id_registro",
            COALESCE(a."DireccionIp", '127.0.0.1') as "direccion_ip",
            COALESCE(a."Detalle", 'Registro sin glosa técnica') as "detalle"
        FROM "AuditLog" a
        LEFT JOIN "Usuario" u ON a."IdUsuario" = u."IdUsuario"
        LEFT JOIN "Rol" r ON u."IdRol" = r."IdRol"
        WHERE {where_sql}
        ORDER BY a."FechaHora" DESC
        LIMIT 500;
    """
    rows = db.execute(text(sql), params).mappings().fetchall()
    items = [dict(r) for r in rows]

    total_criticos = sum(1 for i in items if i["accion"] in ("CIERRE_CAJA", "APROBACION_NOMINA", "MODIFICACION_PRECIO", "ELIMINACION"))
    total_modificaciones = sum(1 for i in items if i["accion"] in ("MODIFICACION", "MODIFICACION_PRECIO"))
    total_creaciones = sum(1 for i in items if i["accion"] in ("CREACION", "APERTURA_CAJA"))

    return {
        "metricas": {
            "total_eventos_auditados": len(items),
            "eventos_criticos_financieros": total_criticos,
            "modificaciones_transaccionales": total_modificaciones,
            "creaciones_registradas": total_creaciones,
            "usuarios_activos": len(set(i["usuario_nombre"] for i in items if i.get("usuario_nombre")))
        },
        "data": items
    }
