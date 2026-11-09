import logging
from decimal import Decimal
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)


class GerenciaRepository:
    def __init__(self, session: Session):
        self.session = session

    # =========================================================================
    # 1. BUSCADOR GLOBAL POR CÓDIGO NUMÉRICO O TEXTO
    # =========================================================================
    def BuscarDocumentosGlobal(self, query: str) -> List[Dict[str, Any]]:
        resultados = []
        codigo_limpio = query.strip()
        es_num = codigo_limpio.isdigit()
        codigo_num = int(codigo_limpio) if es_num else -1
        patron = f"%{codigo_limpio}%"

        # 1. Buscar en Notas de Venta
        sql_nv = text("""
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
               OR (:es_num AND nv."IdNotaVenta" = :codigo_num)
            ORDER BY nv."IdNotaVenta" DESC
            LIMIT 5;
        """)
        for r in self.session.execute(sql_nv, {"patron": patron, "es_num": es_num, "codigo_num": codigo_num}):
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
        sql_cc = text("""
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
                sc."DestinoJustificacion"
            FROM public."SolicitudCajaChica" sc
            WHERE sc."CodigoSolicitud" ILIKE :patron 
               OR (:es_num AND sc."IdSolicitudCajaChica" = :codigo_num)
            ORDER BY sc."IdSolicitudCajaChica" DESC
            LIMIT 5;
        """)
        for r in self.session.execute(sql_cc, {"patron": patron, "es_num": es_num, "codigo_num": codigo_num}):
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
                "sucursal": "Central Sucre",
                "ruta_acceso": f"/contador/caja-chica?id={r.IdSolicitudCajaChica}",
                "detalles": {
                    "monto_entregado": float(r.MontoEntregado or 0),
                    "aprobacion_gerencia": r.AprobacionGerencia
                }
            })

        # 3. Buscar en Abonos de Cuentas por Cobrar
        if es_num:
            sql_abono = text("""
                SELECT 
                    a."IdAbonoCuentaCobrar" as "IdAbono",
                    a."MontoAbonado",
                    a."FechaAbono",
                    a."EstadoAprobacion",
                    COALESCE(c."NombreComercial", c."RazonSocial", 'Cliente') as cliente
                FROM public."AbonoCuentaCobrar" a
                LEFT JOIN public."CuentaCobrar" cc ON a."IdCuentaCobrar" = cc."IdCuentaCobrar"
                LEFT JOIN public."Cliente" c ON cc."IdCliente" = c."IdCliente"
                WHERE a."IdAbonoCuentaCobrar" = :codigo_num
                LIMIT 3;
            """)
            for r in self.session.execute(sql_abono, {"codigo_num": codigo_num}):
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
                    "sucursal": "Logística",
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
    def ObtenerKPIsEjecutivos(self) -> Dict[str, Any]:
        # A. Ventas del día
        sql_ventas = text("""
            SELECT 
                COALESCE(SUM(COALESCE("ImporteNeto", "TotalVentaBruto", 0)), 0) as monto,
                COUNT(*) as cantidad
            FROM public."NotaVenta"
            WHERE DATE(COALESCE("FechaVenta", "FechaRegistro")) = CURRENT_DATE
              AND COALESCE("EstadoCobranza", '') != 'ANULADA';
        """)
        row_ventas = self.session.execute(sql_ventas).fetchone()
        ventas_hoy_monto = Decimal(str(row_ventas.monto or 0))
        ventas_hoy_cantidad = int(row_ventas.cantidad or 0)

        # Si no hubo ventas hoy (ej. fin de semana o inicio de jornada), traer el último día con ventas
        if ventas_hoy_cantidad == 0:
            sql_ventas_ult = text("""
                SELECT 
                    COALESCE(SUM(COALESCE("ImporteNeto", "TotalVentaBruto", 0)), 0) as monto,
                    COUNT(*) as cantidad
                FROM public."NotaVenta"
                WHERE DATE(COALESCE("FechaVenta", "FechaRegistro")) = (
                    SELECT MAX(DATE(COALESCE("FechaVenta", "FechaRegistro"))) 
                    FROM public."NotaVenta" 
                    WHERE COALESCE("EstadoCobranza", '') != 'ANULADA'
                )
                AND COALESCE("EstadoCobranza", '') != 'ANULADA';
            """)
            row_ult = self.session.execute(sql_ventas_ult).fetchone()
            if row_ult and row_ult.cantidad:
                ventas_hoy_monto = Decimal(str(row_ult.monto or 0))
                ventas_hoy_cantidad = int(row_ult.cantidad or 0)

        # B. Cuentas por Cobrar y Mora
        sql_cxc = text("""
            SELECT 
                COALESCE(SUM("SaldoPendiente"), 0) as total_saldo,
                COALESCE(SUM(CASE WHEN "FechaVencimiento" < CURRENT_DATE THEN "SaldoPendiente" ELSE 0 END), 0) as en_mora
            FROM public."CuentaCobrar"
            WHERE "SaldoPendiente" > 0;
        """)
        row_cxc = self.session.execute(sql_cxc).fetchone()
        cxc_total = Decimal(str(row_cxc.total_saldo or 0))
        cxc_mora = Decimal(str(row_cxc.en_mora or 0))

        # C. Vales de Caja Chica Pendientes de Gerencia (Don Osvaldo)
        sql_vales = text("""
            SELECT 
                COUNT(*) as cantidad,
                COALESCE(SUM(COALESCE("MontoGastoReal", "MontoSolicitado")), 0) as monto
            FROM public."SolicitudCajaChica"
            WHERE "AprobacionGerencia" = 'PENDIENTE'
              AND "Estado" IN ('RENDIDO', 'Rendido', 'Rendida');
        """)
        row_vales = self.session.execute(sql_vales).fetchone()
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

        # E. Alertas Gerenciales destacadas
        alertas = []
        if vales_cant > 0:
            alertas.append({
                "tipo": "CAJA_CHICA_PENDIENTE",
                "mensaje": f"Hay {vales_cant} vales de caja chica rendidos esperando tu firma y aprobación (Total: Bs. {vales_monto:.2f})",
                "codigo_referencia": "CAJA_CHICA",
                "fecha": str(self.session.execute(text("SELECT CURRENT_DATE")).scalar()),
                "severidad": "WARNING"
            })
        if cxc_mora > 0:
            alertas.append({
                "tipo": "COBRANZA_ALERTA",
                "mensaje": f"Cartera vencida en mora: Bs. {cxc_mora:.2f} requiere seguimiento con supervisión",
                "codigo_referencia": "MORA_CXC",
                "fecha": str(self.session.execute(text("SELECT CURRENT_DATE")).scalar()),
                "severidad": "DANGER"
            })

        return {
            "fecha_consulta": str(self.session.execute(text("SELECT CURRENT_DATE")).scalar()),
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
