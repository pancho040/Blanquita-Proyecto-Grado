from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.Models.AlertaStock.AlertaStock import NivelStockResponse


class IngresoEmpaqueBolsaItem(BaseModel):
    IdTipoEmpaqueBolsa: int = Field(..., gt=0)
    Cantidad: int


class IngresoEmpaqueBolsaRequest(BaseModel):
    IdProveedor: int = Field(..., gt=0)
    CantidadToneladasPedida: Decimal | None = Field(default=None, gt=0)
    EmpaquesBolsa: list[IngresoEmpaqueBolsaItem]


class IngresoEmpaqueBolsaItemResponse(BaseModel):
    IdMovimientoEmpaqueBolsa: int
    IdTipoEmpaqueBolsa: int
    NombreEmpaqueBolsa: str
    CantidadIngresada: int
    CantidadActual: int
    FechaMovimiento: datetime


class IngresoEmpaqueBolsaResponse(BaseModel):
    IdLoteEmpaque: int
    IdProveedor: int
    NombreProveedor: str
    FechaRecepcion: date
    CantidadToneladasPedida: Decimal | None = None
    CantidadTotalIngresada: int
    Empaques: list[IngresoEmpaqueBolsaItemResponse]


class SalidaEmpaqueBolsaRequest(BaseModel):
    IdTipoEmpaqueBolsa: int = Field(..., gt=0)
    Cantidad: int
    Observacion: str


class SalidaEmpaqueBolsaResponse(BaseModel):
    IdMovimientoEmpaqueBolsa: int
    IdTipoEmpaqueBolsa: int
    NombreEmpaqueBolsa: str
    NombreMovimiento: str
    CantidadMovimiento: int
    CantidadActual: int
    FechaMovimiento: datetime


class InventarioEmpaqueBolsaResponse(NivelStockResponse):
    IdInventarioEmpaqueBolsa: int
    IdTipoEmpaqueBolsa: int
    NombreEmpaqueBolsa: str
    DescripcionEmpaqueBolsa: str | None = None
    Activo: bool
    CantidadActual: int
