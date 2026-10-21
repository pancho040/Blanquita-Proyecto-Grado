from datetime import datetime

from pydantic import BaseModel, Field

from app.Constants.Cantidades import (
    LONGITUD_MAXIMA_NOMBRE_INSUMO,
    LONGITUD_MINIMA_NOMBRE_INSUMO,
)
from app.Models.AlertaStock.AlertaStock import NivelStockResponse


class CatalogoInsumoResponse(NivelStockResponse):
    IdInventarioInsumo: int
    IdTipoInsumo: int
    CantidadActual: int
    NombreInsumo: str
    DescripcionInsumo: str | None = None
    Activo: bool


class MovimientoInsumoRequest(BaseModel):
    IdTipoInsumo: int = Field(..., gt=0)
    Cantidad: int
    Observacion: str


class MovimientoInsumoResponse(BaseModel):
    IdMovimientoInsumo: int
    IdTipoInsumo: int
    NombreInsumo: str
    NombreMovimiento: str
    CantidadMovimiento: int
    CantidadActual: int
    FechaMovimiento: datetime


class ListarInsumosRequest(BaseModel):
    Activo: bool | None = None
    Busqueda: str | None = Field(default=None, max_length=50)
    Pagina: int = Field(default=1, ge=1)
    TamanoPagina: int = Field(default=20, ge=1, le=100)


class InsumoItem(NivelStockResponse):
    IdTipoInsumo: int
    NombreInsumo: str
    DescripcionInsumo: str | None = None
    CantidadActual: int
    Activo: bool


class ListarInsumosResponse(BaseModel):
    Total: int
    Pagina: int
    TamanoPagina: int
    Insumos: list[InsumoItem]


class CrearInsumoRequest(BaseModel):
    NombreInsumo: str = Field(
        ...,
        min_length=LONGITUD_MINIMA_NOMBRE_INSUMO,
        max_length=LONGITUD_MAXIMA_NOMBRE_INSUMO,
    )
    DescripcionInsumo: str
    StockMinimo: int | None = Field(default=None, ge=0)
    StockPreventivo: int | None = Field(default=None, ge=0)


class EditarInsumoRequest(BaseModel):
    IdTipoInsumo: int = Field(..., gt=0)
    DescripcionInsumo: str
    StockMinimo: int | None = Field(default=None, ge=0)
    StockPreventivo: int | None = Field(default=None, ge=0)


class InsumoResponse(InsumoItem):
    pass
