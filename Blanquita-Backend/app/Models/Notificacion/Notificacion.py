from datetime import time

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
from app.Models.InventarioFinal.Conteo import ResumenConteoProductoTerminadoResponse
from app.Models.InventarioFinal.ProductoFinal import EstadoBloqueoProductoTerminadoResponse


class StockNotificaciones(BaseModel):
    SinStock: list[UmbralStockItem]
    Criticos: list[UmbralStockItem]


class ProduccionBobinaPapelNotificaciones(BaseModel):
    Activas: list[ProduccionActivaInicioBobinaPapel]
    Pausadas: list[PausaAbiertaInicioBobinaPapel]


class ProduccionBobinaServilletaNotificaciones(BaseModel):
    Activas: list[ProduccionActivaInicioBobinaServilleta]
    Pausadas: list[PausaAbiertaInicioBobinaServilleta]


class ModoConsultaNotificaciones(BaseModel):
    HoraInicio: time
    HoraFin: time


class NotificacionesResponse(BaseModel):
    ModoConsulta: ModoConsultaNotificaciones | None
    Stock: StockNotificaciones | None
    BloqueoProductoTerminado: EstadoBloqueoProductoTerminadoResponse | None
    ConteoProductoTerminado: ResumenConteoProductoTerminadoResponse | None
    HorasAlertaConteo: int
    BobinaPapel: ProduccionBobinaPapelNotificaciones
    BobinaServilleta: ProduccionBobinaServilletaNotificaciones
    HorasAlertaPausa: int
    Atrasadas: int
    Total: int
