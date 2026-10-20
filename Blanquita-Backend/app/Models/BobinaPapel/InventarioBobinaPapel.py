from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.Models.AlertaStock.AlertaStock import NivelStockResponse


class VerResumenInventarioBobinaPapelResponse(NivelStockResponse):
    IdTipoBobina: int
    NombreTipoBobina: str
    Activo: bool
    CantidadBobinas: int
    PesoNetoTotalKg: Decimal
    GramajePromedio: Decimal


class VerDetalleInventarioBobinaPapelRequest(BaseModel):
    IdTipoBobina: int


class VerDetalleInventarioBobinaPapelResponse(BaseModel):
    IdBobinaPapel: int
    CodigoBobina: str
    CodigoLote: str
    FechaRecepcion: date
    NombreProveedor: str
    PesoBrutoKg: Decimal
    PesoNetoKg: Decimal
    Gramaje: Decimal
    Reingresada: bool
    FechaUltimoReingreso: Optional[datetime]


class ReingresarBobinaAInventarioRequest(BaseModel):
    IdBobinaPapel: int
    Observacion: str


class ReingresarBobinaAInventarioResponse(BaseModel):
    IdBobinaPapel: int
    IdEstadoMateriaPrima: int
    FechaMovimiento: datetime


class VerBobinasPapelFueraInventarioResponse(BaseModel):
    IdBobinaPapel: int
    CodigoBobina: str
    NombreTipoBobina: str
    PesoBrutoKg: Optional[float]
    Gramaje: Optional[float]
    NombreProveedor: str
    FechaRecepcion: date
    UltimaObservacion: Optional[str]
    FechaUltimoMovimiento: Optional[datetime]