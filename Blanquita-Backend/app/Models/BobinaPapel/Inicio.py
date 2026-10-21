from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.Models.BobinaPapel.InventarioBobinaPapel import VerResumenInventarioBobinaPapelResponse
from app.Models.Inicio.Inicio import MotivoPausaInicio


class IndicadoresSemanaBobinaPapel(BaseModel):
    Logs: int
    LogsSemanaAnterior: int
    Cargadas: int
    CargadasSemanaAnterior: int
    Finalizadas: int
    Canceladas: int
    CambiosLinea: int
    Pausas: int
    SegundosPausa: int
    SegundosPausaSemanaAnterior: int


class ProduccionProductoBobinaPapel(BaseModel):
    IdProducto: int
    NombreProducto: str
    Logs: int
    Cargadas: int


class ProduccionDiaBobinaPapel(BaseModel):
    Fecha: date
    Logs: int
    Cargadas: int
    Productos: list[ProduccionProductoBobinaPapel]


class ProduccionActivaInicioBobinaPapel(BaseModel):
    IdProduccionBobinaTubo: int
    NombreTipoBobina: str
    NombreProducto: str
    CodigoBobina1: str
    CodigoBobina2: str
    NombreTurno: str
    Operador: str
    FechaInicioProduccion: datetime
    CantidadLogsActual: int
    Atrasada: bool


class PausaAbiertaInicioBobinaPapel(BaseModel):
    IdPausaProduccionBobinaTubo: int
    IdProduccionBobinaTubo: int
    NombreTipoBobina: str
    NombreProducto: str
    CodigoBobina1: str
    CodigoBobina2: str
    MotivoPausaProduccion: Optional[str]
    Operador: str
    FechaHoraPausa: datetime
    CantidadLogsActual: int
    Atrasada: bool


class BobinaFueraInicioBobinaPapel(BaseModel):
    IdBobinaPapel: int
    CodigoBobina: str
    NombreTipoBobina: str
    FechaUltimoMovimiento: Optional[datetime]


class FueraInventarioInicioBobinaPapel(BaseModel):
    Cantidad: int
    Bobinas: list[BobinaFueraInicioBobinaPapel]


class UltimoLoteInicioBobinaPapel(BaseModel):
    IdLoteBobina: int
    CodigoLote: str
    FechaRecepcion: date
    NombreProveedor: str
    NombreTipoBobina: Optional[str]
    CantidadBobinas: int
    PesoNetoTotalKg: Decimal


class InicioBobinaPapelResponse(BaseModel):
    FechaInicio: date
    FechaFin: date
    HorasAlertaPausa: int
    Indicadores: IndicadoresSemanaBobinaPapel
    Dias: list[ProduccionDiaBobinaPapel]
    Productos: list[ProduccionProductoBobinaPapel]
    MotivosPausa: list[MotivoPausaInicio]
    Activas: list[ProduccionActivaInicioBobinaPapel]
    Pausadas: list[PausaAbiertaInicioBobinaPapel]
    Stock: list[VerResumenInventarioBobinaPapelResponse]
    FueraInventario: FueraInventarioInicioBobinaPapel
    UltimoLote: Optional[UltimoLoteInicioBobinaPapel]
