import logging
from decimal import Decimal
from datetime import date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.cache import memory_cache

logger = logging.getLogger(__name__)


class GerenciaRepository:
    def __init__(self, session: Session):
        self.session = session

    # =========================================================================
    # 1. BUSCADOR GLOBAL POR CÓDIGO NUMÉRICO O TEXTO
    # =========================================================================
    def BuscarDocumentosGlobal(self, query: str, id_sucursal: int | None = None) -> List[Dict[str, Any]]:
        resultados = []
        codigo_limpio = query.strip()
        es_num = codigo_limpio.isdigit()
        codigo_num = int(codigo_limpio) if es_num else -1
        patron = f"%{codigo_limpio}%"

        suc_nv_filter = 'AND nv."IdSucursal" = :id_s' if id_sucursal is not None else ""
        suc_cc_filter = 'AND c_caja."IdSucursal" = :id_s' if id_sucursal is not None else ""
        suc_abono_filter = 'AND cc."IdSucursal" = :id_s' if id_sucursal is not None else ""

        # 1. Buscar en Notas de Venta (usando índice exacto por ID o NumeroNota si es numérico)
        if es_num:
            sql_nv = text(f"""
                SELECT 
                    nv."IdNotaVenta",
                    nv."NumeroNotaVenta",
                    COALESCE(nv."FechaVenta", nv."FechaRegistro") as "FechaNota",
                    COALESCE(nv."ImporteNeto", nv."TotalVentaBruto", 0) as "MontoTotal",
                    COALESCE(nv."EstadoCobranza", 'EMITIDA') as "EstadoNota",
                    COALESCE(c."NombreComercial", c."RazonSocial", nv."ClienteNombreLibre", 'Sin nombre') as cliente,
                    s."nombre" as sucursal
                FROM public."NotaVenta" nv
                LEFT JOIN public."Cliente" c ON nv."IdCliente" = c."IdCliente"
                LEFT JOIN public.sucursales s ON nv."IdSucursal" = s.id
                WHERE (nv."IdNotaVenta" = :codigo_num 
                   OR nv."NumeroNotaVenta" = :codigo_limpio
                   OR nv."NumeroNotaVenta" ILIKE :patron)
                   {suc_nv_filter}
                ORDER BY nv."IdNotaVenta" DESC
                LIMIT 5;
            """)
            params_nv = {"patron": patron, "codigo_limpio": codigo_limpio, "codigo_num": codigo_num}
        else:
            sql_nv = text(f"""
                SELECT 
                    nv."IdNotaVenta",
                    nv."NumeroNotaVenta",
                    COALESCE(nv."FechaVenta", nv."FechaRegistro") as "FechaNota",
                    COALESCE(nv."ImporteNeto", nv."TotalVentaBruto", 0) as "MontoTotal",
                    COALESCE(nv."EstadoCobranza", 'EMITIDA') as "EstadoNota",
                    COALESCE(c."NombreComercial", c."RazonSocial", nv."ClienteNombreLibre", 'Sin nombre') as cliente,
                    s."nombre" as sucursal
                FROM public."NotaVenta" nv
                LEFT JOIN public."Cliente" c ON nv."IdCliente" = c."IdCliente"
                LEFT JOIN public.sucursales s ON nv."IdSucursal" = s.id
                WHERE nv."NumeroNotaVenta" ILIKE :patron
                   {suc_nv_filter}
                ORDER BY nv."IdNotaVenta" DESC
                LIMIT 5;
            """)
            params_nv = {"patron": patron}

        if id_sucursal is not None:
            params_nv["id_s"] = id_sucursal

        for r in self.session.execute(sql_nv, params_nv):
            resultados.append({
                "tipo_documento": "NOTA_VENTA",
                "id_registro": r.IdNotaVenta,
                "codigo": r.NumeroNotaVenta or f"NV-{r.IdNotaVenta}",
                "titulo": f"Nota de Venta {r.NumeroNotaVenta or r.IdNotaVenta}",
                "descripcion": f"Cliente: {r.cliente or 'Sin nombre'} - Sucursal: {r.sucursal or 'Sucre'}",
                "monto": Decimal(str(r.MontoTotal or 0)),
                "fecha": str(r.FechaNota) if r.FechaNota else None,
                "estado": str(r.EstadoNota or "EMITIDA"),
                "solicitante_o_cliente": r.cliente,
                "sucursal": r.sucursal,
                "ruta_acceso": f"/supervisor/entrega-chofer?id={r.IdNotaVenta}",
                "detalles": {"id_nota": r.IdNotaVenta}
            })

        # 2. Buscar en Vales de Caja Chica
        if es_num:
            sql_cc = text(f"""
                SELECT 
                    sc."IdSolicitudCajaChica",
                    sc."CodigoSolicitud",
                    sc."FechaSolicitud",
                    sc."MontoSolicitado",
                    sc."MontoGastoReal",
                    sc."MontoEntregado",
                    sc."Estado",
                    sc."AprobacionGerencia",
                    sc."NombreSolicitante",
                    sc."DestinoJustificacion",
                    s."nombre" as sucursal
                FROM public."SolicitudCajaChica" sc
                LEFT JOIN public."Caja" c_caja ON sc."IdCaja" = c_caja."IdCaja"
                LEFT JOIN public.sucursales s ON c_caja."IdSucursal" = s.id
                WHERE (sc."IdSolicitudCajaChica" = :codigo_num
                   OR sc."CodigoSolicitud" = :codigo_limpio
                   OR sc."CodigoSolicitud" ILIKE :patron)
                   {suc_cc_filter}
                ORDER BY sc."IdSolicitudCajaChica" DESC
                LIMIT 5;
            """)
            params_cc = {"patron": patron, "codigo_limpio": codigo_limpio, "codigo_num": codigo_num}
        else:
            sql_cc = text(f"""
                SELECT 
                    sc."IdSolicitudCajaChica",
                    sc."CodigoSolicitud",
                    sc."FechaSolicitud",
                    sc."MontoSolicitado",
                    sc."MontoGastoReal",
                    sc."MontoEntregado",
                    sc."Estado",
                    sc."AprobacionGerencia",
                    sc."NombreSolicitante",
                    sc."DestinoJustificacion",
                    s."nombre" as sucursal
                FROM public."SolicitudCajaChica" sc
                LEFT JOIN public."Caja" c_caja ON sc."IdCaja" = c_caja."IdCaja"
                LEFT JOIN public.sucursales s ON c_caja."IdSucursal" = s.id
                WHERE sc."CodigoSolicitud" ILIKE :patron
                   {suc_cc_filter}
                ORDER BY sc."IdSolicitudCajaChica" DESC
                LIMIT 5;
            """)
            params_cc = {"patron": patron}

        if id_sucursal is not None:
            params_cc["id_s"] = id_sucursal

        for r in self.session.execute(sql_cc, params_cc):
            monto_final = r.MontoGastoReal if r.MontoGastoReal is not None else r.MontoSolicitado
            resultados.append({
                "tipo_documento": "CAJA_CHICA",
                "id_registro": r.IdSolicitudCajaChica,
                "codigo": r.CodigoSolicitud or f"VALE-{r.IdSolicitudCajaChica}",
                "titulo": f"Vale de Caja Chica {r.CodigoSolicitud or r.IdSolicitudCajaChica}",
                "descripcion": f"Solicitante: {r.NombreSolicitante} - {r.DestinoJustificacion or ''}",
                "monto": Decimal(str(monto_final or 0)),
                "fecha": str(r.FechaSolicitud) if r.FechaSolicitud else None,
                "estado": f"{r.Estado} (Gerencia: {r.AprobacionGerencia})",
                "solicitante_o_cliente": r.NombreSolicitante,
                "sucursal": r.sucursal or "Central Sucre",
                "ruta_acceso": f"/contador/caja-chica?id={r.IdSolicitudCajaChica}",
                "detalles": {
                    "monto_entregado": float(r.MontoEntregado or 0),
                    "aprobacion_gerencia": r.AprobacionGerencia
                }
            })

        # 3. Buscar en Abonos de Cuentas por Cobrar
        if es_num:
            sql_abono = text(f"""
                SELECT 
                    a."IdAbonoCuentaCobrar" as "IdAbono",
                    a."MontoAbonado",
                    a."FechaAbono",
                    a."EstadoAprobacion",
                    COALESCE(c."NombreComercial", c."RazonSocial", 'Cliente') as cliente,
                    s."nombre" as sucursal
                FROM public."AbonoCuentaCobrar" a
                LEFT JOIN public."CuentaCobrar" cc ON a."IdCuentaCobrar" = cc."IdCuentaCobrar"
                LEFT JOIN public."Cliente" c ON cc."IdCliente" = c."IdCliente"
                LEFT JOIN public.sucursales s ON cc."IdSucursal" = s.id
                WHERE a."IdAbonoCuentaCobrar" = :codigo_num
                   {suc_abono_filter}
                LIMIT 3;
            """)
            params_abono = {"codigo_num": codigo_num}
            if id_sucursal is not None:
                params_abono["id_s"] = id_sucursal
            for r in self.session.execute(sql_abono, params_abono):
                resultados.append({
                    "tipo_documento": "ABONO_CXC",
                    "id_registro": r.IdAbono,
                    "codigo": f"ABONO-{r.IdAbono}",
                    "titulo": f"Recibo de Cobranza #{r.IdAbono}",
                    "descripcion": f"Cliente: {r.cliente or 'Cliente Venta'}",
                    "monto": Decimal(str(r.MontoAbonado or 0)),
                    "fecha": str(r.FechaAbono) if r.FechaAbono else None,
                    "estado": str(r.EstadoAprobacion or "PENDIENTE"),
                    "solicitante_o_cliente": r.cliente,
                    "sucursal": r.sucursal or "Logística",
                    "ruta_acceso": f"/contador/aprobacion-qr?id={r.IdAbono}",
                    "detalles": {"id_abono": r.IdAbono}
                })

        # 4. Buscar en Pedidos Distribuidores Mayoristas
        if es_num:
            sql_dist = text("""
                SELECT 
                    pd.id,
                    pd.monto_total,
                    pd.estado,
                    pd.fecha_pedido,
                    de.nombre_comercial as distribuidor
                FROM public.pedidos_distribuidores pd
                LEFT JOIN public.distribuidores_externos de ON pd.distribuidor_id = de.id
                WHERE pd.id = :codigo_num
                LIMIT 3;
            """)
            for r in self.session.execute(sql_dist, {"codigo_num": codigo_num}):
                resultados.append({
                    "tipo_documento": "PEDIDO_DISTRIBUIDOR",
                    "id_registro": r.id,
                    "codigo": f"PED-DIST-{r.id}",
                    "titulo": f"Pedido Mayorista #{r.id}",
                    "descripcion": f"Distribuidor: {r.distribuidor or 'Mayorista'}",
                    "monto": Decimal(str(r.monto_total or 0)),
                    "fecha": str(r.fecha_pedido) if r.fecha_pedido else None,
                    "estado": str(r.estado or "PENDIENTE"),
                    "solicitante_o_cliente": r.distribuidor,
                    "sucursal": "Planta Distribución",
                    "ruta_acceso": f"/supervisor/distribuidores?id={r.id}",
                    "detalles": {"id_pedido": r.id}
                })

        return resultados

    # =========================================================================
    # 2. KPIS EJECUTIVOS GLOBALES
    # =========================================================================
    def ObtenerKPIsEjecutivos(self, id_sucursal: int | None = None) -> Dict[str, Any]:
        cache_key = f"gerencia:kpis_ejecutivos:{id_sucursal or 'todas'}"
        cached_val = memory_cache.get(cache_key)
        if cached_val is not None:
            return cached_val

        hoy_str = date.today().isoformat()

        suc_nv_filter = 'AND "IdSucursal" = :id_s' if id_sucursal is not None else ""
        suc_cxc_filter = 'AND "IdSucursal" = :id_s' if id_sucursal is not None else ""
        suc_vales_filter = 'AND c."IdSucursal" = :id_s' if id_sucursal is not None else ""
        params_base = {"id_s": id_sucursal} if id_sucursal is not None else {}

        # A. Ventas del día (usando comparación directa de fecha con índice)
        sql_ventas = text(f"""
            SELECT 
                COALESCE(SUM(COALESCE("ImporteNeto", "TotalVentaBruto", 0)), 0) as monto,
                COUNT(*) as cantidad
            FROM public."NotaVenta"
            WHERE COALESCE("FechaVenta", "FechaRegistro")::date = CURRENT_DATE
              AND COALESCE("EstadoCobranza", '') != 'ANULADA'
              {suc_nv_filter};
        """)
        row_ventas = self.session.execute(sql_ventas, params_base).fetchone()
        ventas_hoy_monto = Decimal(str(row_ventas.monto or 0))
        ventas_hoy_cantidad = int(row_ventas.cantidad or 0)

        # Si no hubo ventas hoy, obtener la última fecha con ventas usando índice DESC rápido
        if ventas_hoy_cantidad == 0:
            sql_ult_fecha = text(f"""
                SELECT COALESCE("FechaVenta", "FechaRegistro")::date as ult_fecha
                FROM public."NotaVenta"
                WHERE COALESCE("EstadoCobranza", '') != 'ANULADA'
                  {suc_nv_filter}
                ORDER BY COALESCE("FechaVenta", "FechaRegistro") DESC
                LIMIT 1;
            """)
            ult_row = self.session.execute(sql_ult_fecha, params_base).fetchone()
            if ult_row and ult_row.ult_fecha:
                sql_ventas_ult = text(f"""
                    SELECT 
                        COALESCE(SUM(COALESCE("ImporteNeto", "TotalVentaBruto", 0)), 0) as monto,
                        COUNT(*) as cantidad
                    FROM public."NotaVenta"
                    WHERE COALESCE("FechaVenta", "FechaRegistro")::date = :ult_fecha
                      AND COALESCE("EstadoCobranza", '') != 'ANULADA'
                      {suc_nv_filter};
                """)
                params_ult = {"ult_fecha": ult_row.ult_fecha}
                if id_sucursal is not None:
                    params_ult["id_s"] = id_sucursal
                row_ult = self.session.execute(sql_ventas_ult, params_ult).fetchone()
                if row_ult and row_ult.cantidad:
                    ventas_hoy_monto = Decimal(str(row_ult.monto or 0))
                    ventas_hoy_cantidad = int(row_ult.cantidad or 0)

        # B. Cuentas por Cobrar y Mora (usa idx_cxc_saldo_pendiente)
        sql_cxc = text(f"""
            SELECT 
                COALESCE(SUM("SaldoPendiente"), 0) as total_saldo,
                COALESCE(SUM(CASE WHEN "FechaVencimiento" < CURRENT_DATE THEN "SaldoPendiente" ELSE 0 END), 0) as en_mora
            FROM public."CuentaCobrar"
            WHERE "SaldoPendiente" > 0
              {suc_cxc_filter};
        """)
        row_cxc = self.session.execute(sql_cxc, params_base).fetchone()
        cxc_total = Decimal(str(row_cxc.total_saldo or 0))
        cxc_mora = Decimal(str(row_cxc.en_mora or 0))

        # C. Vales de Caja Chica Pendientes de Gerencia (usa idx_solcajachica_aprob_estado)
        sql_vales = text(f"""
            SELECT 
                COUNT(*) as cantidad,
                COALESCE(SUM(COALESCE(sc."MontoGastoReal", sc."MontoSolicitado")), 0) as monto
            FROM public."SolicitudCajaChica" sc
            LEFT JOIN public."Caja" c ON sc."IdCaja" = c."IdCaja"
            WHERE sc."AprobacionGerencia" = 'PENDIENTE'
              AND sc."Estado" IN ('RENDIDO', 'Rendido', 'Rendida')
              {suc_vales_filter};
        """)
        row_vales = self.session.execute(sql_vales, params_base).fetchone()
        vales_cant = int(row_vales.cantidad or 0)
        vales_monto = Decimal(str(row_vales.monto or 0))

        # D. Saldos en los 3 Bancos Referenciales
        sql_bancos = text("""
            SELECT 
                "IdCuentaBancaria" as id_cuenta,
                "NombreBanco" as nombre_banco,
                "Sigla" as sigla,
                "NumeroCuenta" as numero_cuenta,
                COALESCE("Proposito", 'OPERACIONES_GENERALES') as proposito,
                COALESCE("SaldoActual", 0) as saldo_actual,
                COALESCE("SaldoConciliado", "SaldoActual", 0) as saldo_conciliado,
                (COALESCE("SaldoActual", 0) - COALESCE("SaldoConciliado", "SaldoActual", 0)) as diferencia,
                "FechaUltimaConciliacion" as fecha_ultima_conciliacion
            FROM public."CuentaBancariaEmpresa"
            WHERE "Activa" = true
            ORDER BY "IdCuentaBancaria" ASC;
        """)
        rows_bancos = self.session.execute(sql_bancos).fetchall()
        bancos_list = []
        saldos_total = Decimal("0.00")
        for b in rows_bancos:
            s_actual = Decimal(str(b.saldo_actual or 0))
            s_conciliado = Decimal(str(b.saldo_conciliado or 0))
            saldos_total += s_conciliado
            bancos_list.append({
                "id_cuenta": b.id_cuenta,
                "nombre_banco": b.nombre_banco,
                "sigla": b.sigla,
                "numero_cuenta": b.numero_cuenta,
                "proposito": b.proposito,
                "saldo_actual": s_actual,
                "saldo_conciliado": s_conciliado,
                "diferencia": s_actual - s_conciliado,
                "fecha_ultima_conciliacion": str(b.fecha_ultima_conciliacion) if b.fecha_ultima_conciliacion else None
            })

        # E. Alertas Gerenciales destacadas (sin round-trips extras a la BD)
        alertas = []
        if vales_cant > 0:
            alertas.append({
                "tipo": "CAJA_CHICA_PENDIENTE",
                "mensaje": f"Hay {vales_cant} vales de caja chica rendidos esperando tu firma y aprobación (Total: Bs. {vales_monto:.2f})",
                "codigo_referencia": "CAJA_CHICA",
                "fecha": hoy_str,
                "severidad": "WARNING"
            })
        if cxc_mora > 0:
            alertas.append({
                "tipo": "COBRANZA_ALERTA",
                "mensaje": f"Cartera vencida en mora: Bs. {cxc_mora:.2f} requiere seguimiento con supervisión",
                "codigo_referencia": "MORA_CXC",
                "fecha": hoy_str,
                "severidad": "DANGER"
            })

        resultado = {
            "fecha_consulta": hoy_str,
            "ventas_hoy_monto": ventas_hoy_monto,
            "ventas_hoy_cantidad": ventas_hoy_cantidad,
            "cuentas_cobrar_saldo_total": cxc_total,
            "cuentas_cobrar_en_mora": cxc_mora,
            "vales_caja_chica_pendientes_cantidad": vales_cant,
            "vales_caja_chica_pendientes_monto": vales_monto,
            "saldos_bancarios_total": saldos_total,
            "bancos": bancos_list,
            "alertas": alertas
        }

        memory_cache.set(cache_key, resultado, ttl=45)
        return resultado

    # =========================================================================
    # 3. REGISTRO DE FIRMA Y SELLO DIGITAL DE GERENCIA
    # =========================================================================
    def RegistrarFirmaDigital(self, id_usuario: int, datos: dict) -> dict:
        sql = text("""
            INSERT INTO public."FirmaDigitalDocumento" (
                "IdUsuario", "TipoDocumento", "IdRegistroDocumento", 
                "CodigoReferencia", "UrlFotoFirmaSello", "Observaciones"
            ) VALUES (
                :id_usuario, :tipo_doc, :id_reg, :cod_ref, :url_foto, :obs
            ) RETURNING *;
        """)
        res = self.session.execute(sql, {
            "id_usuario": id_usuario,
            "tipo_doc": datos["tipo_documento"],
            "id_reg": datos["id_registro_documento"],
            "cod_ref": datos.get("codigo_referencia"),
            "url_foto": datos.get("url_foto_firma_sello"),
            "obs": datos.get("observaciones")
        }).fetchone()
        self.session.commit()
        return dict(res._mapping)

    def ListarFirmasHistorial(self, limit: int = 20) -> List[Dict[str, Any]]:
        sql = text("""
            SELECT f.*, 
                   CONCAT(COALESCE(u."PrimerNombre", ''), ' ', COALESCE(u."ApellidoPaterno", '')) as "NombreUsuario"
            FROM public."FirmaDigitalDocumento" f
            JOIN public."Usuario" u ON f."IdUsuario" = u."IdUsuario"
            ORDER BY f."FechaFirma" DESC
            LIMIT :lim;
        """)
        rows = self.session.execute(sql, {"lim": limit}).fetchall()
        return [dict(r._mapping) for r in rows]

    # =========================================================================
    # 4. CONCILIACIÓN DE BANCOS REFERENCIALES (MSC, UNIÓN, BNB)
    # =========================================================================
    def ConciliarCuentaBancaria(self, id_cuenta: int, saldo_conciliado: Decimal, id_usuario: int, obs: Optional[str] = None) -> dict:
        # Obtener saldo anterior
        cta = self.session.execute(
            text('SELECT "SaldoActual", "SaldoConciliado" FROM public."CuentaBancariaEmpresa" WHERE "IdCuentaBancaria" = :id'),
            {"id": id_cuenta}
        ).fetchone()
        saldo_ant = Decimal(str(cta.SaldoConciliado or cta.SaldoActual or 0)) if cta else Decimal("0.00")
        dif = Decimal(str(saldo_conciliado)) - saldo_ant

        # Actualizar cuenta
        sql_update = text("""
            UPDATE public."CuentaBancariaEmpresa"
            SET "SaldoConciliado" = :saldo,
                "FechaUltimaConciliacion" = CURRENT_TIMESTAMP,
                "ObservacionesConciliacion" = :obs
            WHERE "IdCuentaBancaria" = :id
            RETURNING *;
        """)
        res_cta = self.session.execute(sql_update, {
            "saldo": saldo_conciliado,
            "obs": obs,
            "id": id_cuenta
        }).fetchone()

        # Registrar historial
        sql_hist = text("""
            INSERT INTO public."ConciliacionBancariaHistorial" (
                "IdCuentaBancaria", "SaldoAnterior", "SaldoNuevo", 
                "Diferencia", "IdUsuario", "Observacion"
            ) VALUES (
                :id_cuenta, :saldo_ant, :saldo_nuevo, :dif, :id_usuario, :obs
            );
        """)
        self.session.execute(sql_hist, {
            "id_cuenta": id_cuenta,
            "saldo_ant": saldo_ant,
            "saldo_nuevo": saldo_conciliado,
            "dif": dif,
            "id_usuario": id_usuario,
            "obs": obs
        })
        self.session.commit()
        return dict(res_cta._mapping)
