from pydantic import BaseModel

from app.Models.AlertaStock.AlertaStock import UmbralStockItem
from app.Models.BobinaPapel.Inicio import (
    PausaAbiertaInicioBobinaPapel,
    ProduccionActivaInicioBobinaPapel,
)
from app.Models.BobinaServilleta.Inicio import (
    PausaAbiertaInicioBobinaServilleta,
    ProduccionActivaInicioBobinaServilleta,
)


class StockNotificaciones(BaseModel):
    SinStock: list[UmbralStockItem]
    Criticos: list[UmbralStockItem]


class ProduccionBobinaPapelNotificaciones(BaseModel):
    Activas: list[ProduccionActivaInicioBobinaPapel]
    Pausadas: list[PausaAbiertaInicioBobinaPapel]


class ProduccionBobinaServilletaNotificaciones(BaseModel):
    Activas: list[ProduccionActivaInicioBobinaServilleta]
    Pausadas: list[PausaAbiertaInicioBobinaServilleta]


class NotificacionesResponse(BaseModel):
    Stock: StockNotificaciones | None
    BobinaPapel: ProduccionBobinaPapelNotificaciones
    BobinaServilleta: ProduccionBobinaServilletaNotificaciones
    HorasAlertaPausa: int
    Atrasadas: int
    Total: int
