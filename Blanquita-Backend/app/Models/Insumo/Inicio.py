from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.Models.AlertaStock.AlertaStock import NivelStockResponse


class IndicadoresSemanaInsumo(BaseModel):
    Ingresos: int
    IngresosSemanaAnterior: int
    Salidas: int
    SalidasSemanaAnterior: int
    Movimientos: int
    MovimientosSemanaAnterior: int
    StockTotal: int
    InsumosEnAlerta: int


class MovimientoTipoInsumo(BaseModel):
    IdTipoInsumo: int
    NombreInsumo: str
    Ingresos: int
    Salidas: int


class MovimientoDiaInsumo(BaseModel):
    Fecha: date
    Ingresos: int
    Salidas: int
    Insumos: list[MovimientoTipoInsumo]


class StockInsumoInicio(NivelStockResponse):
    IdTipoInsumo: int
    NombreInsumo: str
    Activo: bool
    CantidadActual: int
    FechaUltimoMovimiento: Optional[datetime]


class MovimientoRecienteInsumo(BaseModel):
    IdMovimientoInsumo: int
    NombreInsumo: str
    IdTipoMovimiento: int
    NombreMovimiento: str
    Cantidad: int
    Usuario: str
    FechaMovimiento: datetime
    Observacion: Optional[str]


class InicioInsumoResponse(BaseModel):
    FechaInicio: date
    FechaFin: date
    DiasSinMovimiento: int
    Indicadores: IndicadoresSemanaInsumo
    Dias: list[MovimientoDiaInsumo]
    Insumos: list[MovimientoTipoInsumo]
    Stock: list[StockInsumoInicio]
    SinMovimiento: list[StockInsumoInicio]
    UltimosMovimientos: list[MovimientoRecienteInsumo]
