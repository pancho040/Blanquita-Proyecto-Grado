from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.Models.BobinaServilleta.InventarioBobinaServilleta import (
    ResumenInventarioBobinaServilletaResponse,
    ResumenInventarioSubBobinaServilletaResponse,
)
from app.Models.Inicio.Inicio import MotivoPausaInicio


class IndicadoresSemanaBobinaServilleta(BaseModel):
    Iniciadas: int
    IniciadasSemanaAnterior: int
    Finalizadas: int
    FinalizadasSemanaAnterior: int
    Canceladas: int
    BobinasAbiertas: int
    BobinasAbiertasSemanaAnterior: int
    Pausas: int
    SegundosPausa: int
    SegundosPausaSemanaAnterior: int


class ProduccionMedidaBobinaServilleta(BaseModel):
    IdTipoMedidaSubBobina: int
    MedidaMm: int
    Iniciadas: int
    Finalizadas: int


class ProduccionDiaBobinaServilleta(BaseModel):
    Fecha: date
    Iniciadas: int
    Finalizadas: int
    Medidas: list[ProduccionMedidaBobinaServilleta]


class ProduccionActivaInicioBobinaServilleta(BaseModel):
    IdProduccionServilleta: int
    MedidaMm: int
    CodigoUnidadOrigen: str
    NombreTipoBobinaServilleta: str
    NombreTurno: str
    Operador: str
    FechaInicioProduccion: datetime
    Atrasada: bool


class PausaAbiertaInicioBobinaServilleta(BaseModel):
    IdPausaProduccionServilleta: int
    IdProduccionServilleta: int
    MedidaMm: int
    CodigoUnidadOrigen: str
    NombreTipoBobinaServilleta: str
    MotivoPausaProduccion: Optional[str]
    Operador: str
    FechaHoraPausa: datetime
    Atrasada: bool


class SubBobinaFueraInicioBobinaServilleta(BaseModel):
    IdSubBobinaServilleta: int
    CodigoUnidadOrigen: str
    NombreTipoMedida: str
    FechaUltimoMovimiento: Optional[datetime]


class FueraInventarioInicioBobinaServilleta(BaseModel):
    Cantidad: int
    SubBobinas: list[SubBobinaFueraInicioBobinaServilleta]


class UltimoLoteInicioBobinaServilleta(BaseModel):
    IdLoteBobinaServilleta: int
    FechaRecepcion: date
    NombreProveedor: str
    NombreTipoBobinaServilleta: Optional[str]
    CantidadBobinas: int
    PesoBrutoTotalKg: Decimal


class InicioBobinaServilletaResponse(BaseModel):
    FechaInicio: date
    FechaFin: date
    HorasAlertaPausa: int
    Indicadores: IndicadoresSemanaBobinaServilleta
    Dias: list[ProduccionDiaBobinaServilleta]
    Medidas: list[ProduccionMedidaBobinaServilleta]
    MotivosPausa: list[MotivoPausaInicio]
    Activas: list[ProduccionActivaInicioBobinaServilleta]
    Pausadas: list[PausaAbiertaInicioBobinaServilleta]
    StockBobinas: list[ResumenInventarioBobinaServilletaResponse]
    StockSubBobinas: list[ResumenInventarioSubBobinaServilletaResponse]
    FueraInventario: FueraInventarioInicioBobinaServilleta
    UltimoLote: Optional[UltimoLoteInicioBobinaServilleta]
