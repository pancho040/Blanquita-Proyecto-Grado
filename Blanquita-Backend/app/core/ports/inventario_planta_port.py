from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session


class PlantaNoSoportadaException(Exception):
    """Se lanza cuando se solicita una operación para una planta no compatible con el adaptador."""
    pass


class StockInsuficienteException(Exception):
    """Se lanza cuando la planta no cuenta con saldo suficiente para cubrir el despacho."""
    pass


class InventarioProductoTerminadoPort(ABC):
    """
    Puerto de Dominio (Arquitectura Hexagonal) para la gestión desacoplada
    del inventario de producto terminado en plantas de producción.
    """

    @abstractmethod
    def get_stock_disponible(self, session: Session, planta_id: int, presentacion_id: int) -> Decimal:
        """
        Retorna la cantidad física disponible en el galpón de la planta para la presentación indicada.
        """
        pass

    @abstractmethod
    def descontar_stock_despacho(
        self,
        session: Session,
        planta_id: int,
        presentacion_id: int,
        cantidad: Decimal,
        usuario_id: int,
        referencia_guia: str
    ) -> bool:
        """
        Ejecuta el descuento atómico de existencias en planta y registra el egreso en el Kardex.
        NOTA ESTRICTA: El adaptador NUNCA ejecuta commit() ni rollback(). La transacción
        la gobierna el orquestador de envíos.
        """
        pass

    @abstractmethod
    def reintegrar_stock_anulacion(
        self,
        session: Session,
        planta_id: int,
        presentacion_id: int,
        cantidad: Decimal,
        usuario_id: int,
        referencia_guia: str
    ) -> bool:
        """
        En caso de anulación de un despacho en tránsito que ya había sido descontado,
        reintegra el stock a la planta y asienta el ajuste positivo correspondiente.
        """
        pass
