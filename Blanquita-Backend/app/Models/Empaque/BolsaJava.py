from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.Models.AlertaStock.AlertaStock import NivelStockResponse


class IngresoBolsaJavaItem(BaseModel):
    IdTipoBolsaJava: int = Field(..., gt=0)
    Cantidad: int


class IngresoBolsaJavaRequest(BaseModel):
    IdProveedor: int = Field(..., gt=0)
    CantidadToneladasPedida: Decimal | None = None
    BolsasJava: list[IngresoBolsaJavaItem]


class IngresoBolsaJavaItemResponse(BaseModel):
    IdMovimientoBolsaJava: int
    IdTipoBolsaJava: int
    NombreBolsaJava: str
    CantidadIngresada: int
    CantidadActual: int
    FechaMovimiento: datetime


class IngresoBolsaJavaResponse(BaseModel):
    IdLoteEmpaque: int
    IdProveedor: int
    NombreProveedor: str
    FechaRecepcion: date
    CantidadToneladasPedida: Decimal | None = None
    CantidadTotalIngresada: int
    BolsasJava: list[IngresoBolsaJavaItemResponse]


class SalidaBolsaJavaRequest(BaseModel):
    IdTipoBolsaJava: int = Field(..., gt=0)
    Cantidad: int
    Observacion: str


class SalidaBolsaJavaResponse(BaseModel):
    IdMovimientoBolsaJava: int
    IdTipoBolsaJava: int
    NombreBolsaJava: str
    NombreMovimiento: str
    CantidadMovimiento: int
    CantidadActual: int
    FechaMovimiento: datetime


class ReingresoBolsaJavaRequest(BaseModel):
    IdTipoBolsaJava: int = Field(..., gt=0)
    Cantidad: int
    Observacion: str


ReingresoBolsaJavaResponse = SalidaBolsaJavaResponse


class InventarioBolsaJavaResponse(NivelStockResponse):
    IdInventarioBolsaJava: int
    IdTipoBolsaJava: int
    NombreBolsaJava: str
    DescripcionBolsaJava: str | None = None
    Activo: bool
    CantidadActual: int
