from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.Models.AlertaStock.AlertaStock import NivelStockResponse
from app.Models.Empaque.EmpaqueBobina import EmpaqueReingresableResponse
from app.Models.Empaque.Reporte import ClaseEmpaque


class IndicadoresSemanaEmpaque(BaseModel):
    Ingresos: int
    IngresosSemanaAnterior: int
    Salidas: int
    SalidasSemanaAnterior: int
    Reingresos: int
    ReingresosSemanaAnterior: int
    StockTotal: int
    TiposEnAlerta: int


class MovimientoTipoEmpaque(BaseModel):
    IdTipo: int
    NombreTipo: str
    Ingresos: int
    Salidas: int


class MovimientoDiaEmpaque(BaseModel):
    Fecha: date
    Ingresos: int
    Salidas: int
    Tipos: list[MovimientoTipoEmpaque]


class StockTipoEmpaque(NivelStockResponse):
    IdTipo: int
    NombreTipo: str
    Activo: bool
    CantidadActual: int


class MovimientoRecienteEmpaque(BaseModel):
    IdMovimiento: int
    NombreTipo: str
    IdTipoMovimiento: int
    NombreMovimiento: str
    Cantidad: int
    CodigoEmpaque: Optional[str]
    Usuario: str
    FechaMovimiento: datetime
    Observacion: Optional[str]


class UltimoLoteInicioEmpaque(BaseModel):
    IdLoteEmpaque: int
    FechaRecepcion: date
    CantidadToneladasPedida: Optional[Decimal]
    NombreProveedor: str
    Tipos: Optional[str]
    Cantidad: int
    PesoKg: Optional[Decimal] = None


class InicioEmpaqueResponse(BaseModel):
    Clase: ClaseEmpaque
    FechaInicio: date
    FechaFin: date
    MinutosReingreso: Optional[int]
    Indicadores: IndicadoresSemanaEmpaque
    Dias: list[MovimientoDiaEmpaque]
    Tipos: list[MovimientoTipoEmpaque]
    Stock: list[StockTipoEmpaque]
    Reingresables: list[EmpaqueReingresableResponse]
    UltimosMovimientos: list[MovimientoRecienteEmpaque]
    UltimoLote: Optional[UltimoLoteInicioEmpaque]
