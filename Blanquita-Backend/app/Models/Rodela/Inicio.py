from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.Models.Rodela.InventarioRodela import ResumenInventarioRodelaResponse, RodelaReingresableResponse


class IndicadoresSemanaRodela(BaseModel):
    Enviadas: int
    EnviadasSemanaAnterior: int
    Recibidas: int
    RecibidasSemanaAnterior: int
    Devueltas: int
    DevueltasSemanaAnterior: int
    Correcciones: int
    CorreccionesSemanaAnterior: int


class MovimientoTipoRodela(BaseModel):
    IdTipoRodela: int
    NombreTipoRodela: str
    Enviadas: int
    Recibidas: int


class MovimientoDiaRodela(BaseModel):
    Fecha: date
    Enviadas: int
    Recibidas: int
    Tipos: list[MovimientoTipoRodela]


class RodelaEnProduccionInicio(BaseModel):
    IdRodela: int
    CodigoRodela: str
    NombreTipoRodela: str
    FechaTraslado: Optional[datetime]


class EnProduccionInicioRodela(BaseModel):
    Cantidad: int
    Rodelas: list[RodelaEnProduccionInicio]


class MovimientoRecienteRodela(BaseModel):
    IdMovimientoRodela: int
    CodigoRodela: str
    NombreTipoRodela: str
    IdTipoMovimiento: int
    NombreMovimiento: str
    Usuario: str
    FechaMovimiento: datetime
    Observacion: Optional[str]


class UltimoLoteInicioRodela(BaseModel):
    IdLoteRodela: int
    CodigoLote: str
    FechaRecepcion: date
    NombreProveedor: str
    NombreTipoRodela: Optional[str]
    CantidadRodelas: int


class InicioRodelaResponse(BaseModel):
    FechaInicio: date
    FechaFin: date
    MinutosDeshacerTraslado: int
    Indicadores: IndicadoresSemanaRodela
    Dias: list[MovimientoDiaRodela]
    Tipos: list[MovimientoTipoRodela]
    Stock: list[ResumenInventarioRodelaResponse]
    EnProduccion: EnProduccionInicioRodela
    Reingresables: list[RodelaReingresableResponse]
    UltimosMovimientos: list[MovimientoRecienteRodela]
    UltimoLote: Optional[UltimoLoteInicioRodela]
