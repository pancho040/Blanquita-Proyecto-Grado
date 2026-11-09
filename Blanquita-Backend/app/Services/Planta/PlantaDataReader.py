import logging
from decimal import Decimal
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)


class PlantaDataReader:
    """
    Capa oficial de SOLO LECTURA para inspeccionar el estado físico y saldos
    de los módulos de planta y producción de Fabricio sin alterar ninguna tabla.
    """

    @staticmethod
    def obtener_stock_producto_terminado(session: Session, presentacion_id: int) -> Decimal:
        """
        Retorna el saldo disponible actual en InventarioProductoTerminado para una presentación dada.
        """
        row = session.execute(
            text('SELECT "CantidadActual" FROM public."InventarioProductoTerminado" WHERE "IdPresentacion" = :pid'),
            {"pid": presentacion_id}
        ).fetchone()
        if not row:
            return Decimal("0.00")
        return Decimal(str(row[0]))

    @staticmethod
    def obtener_catalogo_productos(session: Session) -> List[Dict[str, Any]]:
        """
        Consulta el catálogo unificado de productos y sus presentaciones físicas activas.
        """
        stmt = text("""
            SELECT 
                p."IdProducto" as producto_id,
                p."NombreProducto" as producto_nombre,
                pr."IdPresentacion" as presentacion_id,
                pr."CodigoPresentacion" as codigo_presentacion,
                pr."TipoContenedor" as tipo_contenedor,
                pr."CantidadRollosUnidades" as unidades_por_paquete,
                pr."CantidadPorUnidadTerminada" as unidades_terminadas,
                COALESCE(inv."CantidadActual", 0) as stock_planta_sucre,
                COALESCE(cfg."EsBandeo", false) as es_bandeo,
                COALESCE(cfg."ValorBandeo", 0) as valor_bandeo
            FROM public."Producto" p
            JOIN public."PresentacionProducto" pr ON p."IdProducto" = pr."IdProducto"
            LEFT JOIN public."InventarioProductoTerminado" inv ON pr."IdPresentacion" = inv."IdPresentacion"
            LEFT JOIN public."ProductoConfigComercial" cfg ON p."IdProducto" = cfg."IdProducto"
            ORDER BY p."NombreProducto", pr."CodigoPresentacion";
        """)
        rows = session.execute(stmt).fetchall()
        
        catalogo = []
        for r in rows:
            catalogo.append({
                "producto_id": r.producto_id,
                "producto_nombre": r.producto_nombre,
                "presentacion_id": r.presentacion_id,
                "codigo_presentacion": r.codigo_presentacion,
                "tipo_contenedor": r.tipo_contenedor,
                "unidades_por_paquete": r.unidades_por_paquete,
                "unidades_terminadas": r.unidades_terminadas,
                "stock_planta_sucre": Decimal(str(r.stock_planta_sucre)),
                "es_bandeo": r.es_bandeo,
                "valor_bandeo": r.valor_bandeo
            })
        return catalogo

    @staticmethod
    def obtener_saldos_materia_prima(session: Session) -> Dict[str, Any]:
        """
        Consulta en solo lectura los saldos consolidados de bobinas y rodelas para los
        reportes financieros y balances de gerencia.
        """
        stmt_bobinas = text("""
            SELECT 
                COUNT(*) as total_bobinas,
                COALESCE(SUM("PesoNetoKg"), 0) as peso_total_kg
            FROM public."BobinaPapel"
            WHERE "IdEstadoMateriaPrima" = 1; -- En almacén
        """)
        row_bobinas = session.execute(stmt_bobinas).fetchone()

        stmt_servilletas = text("""
            SELECT COUNT(*) as total_bobinas_servilleta
            FROM public."BobinaServilleta"
            WHERE "IdEstadoMateriaPrima" = 1;
        """)
        row_servilletas = session.execute(stmt_servilletas).fetchone()

        stmt_rodelas = text("""
            SELECT COUNT(*) as total_rodelas
            FROM public."Rodela";
        """)
        row_rodelas = session.execute(stmt_rodelas).fetchone()

        return {
            "bobinas_papel_almacen": row_bobinas.total_bobinas if row_bobinas else 0,
            "bobinas_papel_peso_kg": Decimal(str(row_bobinas.peso_total_kg)) if row_bobinas else Decimal("0.00"),
            "bobinas_servilleta_almacen": row_servilletas.total_bobinas_servilleta if row_servilletas else 0,
            "rodelas_total": row_rodelas.total_rodelas if row_rodelas else 0,
        }
