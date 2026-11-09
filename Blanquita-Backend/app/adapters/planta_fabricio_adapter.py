import os
import logging
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.ports.inventario_planta_port import (
    InventarioProductoTerminadoPort,
    PlantaNoSoportadaException,
    StockInsuficienteException,
)

logger = logging.getLogger(__name__)

# Tipos de movimiento existentes en TipoMovimientoInventario de Fabricio
ID_TIPO_SALIDA_DESPACHO = 2  # 'Salida'
ID_TIPO_AJUSTE_POSITIVO = 5  # 'Ajuste Positivo'


class FabricioLegacyAdapter(InventarioProductoTerminadoPort):
    """
    Adaptador oficial para interactuar transaccionalmente con las tablas de
    producto terminado de la Planta Sucre gestionadas por el esquema de Fabricio.
    Es el ÚNICO componente del sistema autorizado a ejecutar DML sobre:
      - public."InventarioProductoTerminado"
      - public."MovimientoProductoTerminado"
    """

    def _validar_planta(self, session: Session, planta_id: int) -> None:
        row = session.execute(
            text("SELECT id, proveedor_inventario, activa FROM public.plantas WHERE id = :id"),
            {"id": planta_id}
        ).fetchone()
        
        if not row:
            raise PlantaNoSoportadaException(f"La planta con ID {planta_id} no existe en el sistema.")
        
        if row.proveedor_inventario != "FABRICIO_LEGACY":
            raise PlantaNoSoportadaException(
                f"La planta {planta_id} no está gestionada por el proveedor FABRICIO_LEGACY (actual: {row.proveedor_inventario})."
            )
        
        if not row.activa:
            raise PlantaNoSoportadaException(f"La planta {planta_id} se encuentra inactiva.")

    def get_stock_disponible(self, session: Session, planta_id: int, presentacion_id: int) -> Decimal:
        self._validar_planta(session, planta_id)
        row = session.execute(
            text('SELECT "CantidadActual" FROM public."InventarioProductoTerminado" WHERE "IdPresentacion" = :pid'),
            {"pid": presentacion_id}
        ).fetchone()
        
        if not row:
            return Decimal("0.00")
        return Decimal(str(row[0]))

    def descontar_stock_despacho(
        self,
        session: Session,
        planta_id: int,
        presentacion_id: int,
        cantidad: Decimal,
        usuario_id: int,
        referencia_guia: str
    ) -> bool:
        self._validar_planta(session, planta_id)

        # 1. Verificar si el interruptor de seguridad está activo
        descontar_activo = os.getenv("DESCONTAR_PLANTA_ACTIVO", "false").lower() in ("true", "1", "yes")

        # Verificar disponibilidad física
        stock_actual = self.get_stock_disponible(session, planta_id, presentacion_id)
        if stock_actual < cantidad:
            raise StockInsuficienteException(
                f"Stock insuficiente en planta Sucre para la presentación {presentacion_id}. Disponible: {stock_actual}, Solicitado: {cantidad}"
            )

        if not descontar_activo:
            logger.warning(
                f"[INTERRUPTOR INACTIVO] DESCONTAR_PLANTA_ACTIVO=false. Se omite descuento físico de {cantidad} "
                f"para la presentación {presentacion_id} en planta {planta_id} (Guía: {referencia_guia})."
            )
            return False

        # 2. Descuento atómico condicional anti race-condition
        update_stmt = text("""
            UPDATE public."InventarioProductoTerminado"
            SET "CantidadActual" = "CantidadActual" - :cant
            WHERE "IdPresentacion" = :pid AND "CantidadActual" >= :cant
            RETURNING "CantidadActual";
        """)
        result = session.execute(update_stmt, {"cant": cantidad, "pid": presentacion_id})
        updated_row = result.fetchone()

        if not updated_row:
            raise StockInsuficienteException(
                f"Conflicto de concurrencia: el stock en planta Sucre cambió durante la operación para la presentación {presentacion_id}."
            )

        # 3. Registrar contraparte en Kardex de Fabricio (Tipo 2 = 'Salida')
        insert_mov_stmt = text("""
            INSERT INTO public."MovimientoProductoTerminado" (
                "IdTipoMovimientoInventario",
                "IdPresentacion",
                "IdUsuario",
                "CantidadIngresoInventario",
                "FechaMovimiento",
                "Observacion"
            ) VALUES (
                :tipo_mov,
                :pid,
                :uid,
                :cant,
                :fecha,
                :obs
            );
        """)
        session.execute(insert_mov_stmt, {
            "tipo_mov": ID_TIPO_SALIDA_DESPACHO,
            "pid": presentacion_id,
            "uid": usuario_id,
            "cant": cantidad,
            "fecha": datetime.now(timezone.utc),
            "obs": f"Egreso por despacho comercial Guía {referencia_guia}"
        })

        return True

    def reintegrar_stock_anulacion(
        self,
        session: Session,
        planta_id: int,
        presentacion_id: int,
        cantidad: Decimal,
        usuario_id: int,
        referencia_guia: str
    ) -> bool:
        self._validar_planta(session, planta_id)

        update_stmt = text("""
            UPDATE public."InventarioProductoTerminado"
            SET "CantidadActual" = "CantidadActual" + :cant
            WHERE "IdPresentacion" = :pid;
        """)
        session.execute(update_stmt, {"cant": cantidad, "pid": presentacion_id})

        insert_mov_stmt = text("""
            INSERT INTO public."MovimientoProductoTerminado" (
                "IdTipoMovimientoInventario",
                "IdPresentacion",
                "IdUsuario",
                "CantidadIngresoInventario",
                "FechaMovimiento",
                "Observacion"
            ) VALUES (
                :tipo_mov,
                :pid,
                :uid,
                :cant,
                :fecha,
                :obs
            );
        """)
        session.execute(insert_mov_stmt, {
            "tipo_mov": ID_TIPO_AJUSTE_POSITIVO,
            "pid": presentacion_id,
            "uid": usuario_id,
            "cant": cantidad,
            "fecha": datetime.now(timezone.utc),
            "obs": f"Reverso por anulación de Guía {referencia_guia}"
        })

        return True
