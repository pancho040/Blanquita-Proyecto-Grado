from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel


class BobinaPapel(BaseModel):
    IdBobinaPapel: Optional[int] = None
    CodigoBobina: str
    IdTipoBobina: int
    IdLoteBobina: int
    IdEstadoMateriaPrima: int
    PesoBrutoKg: Optional[Decimal] = None
    Gramaje: Optional[Decimal] = None
    PesoNetoKg: Optional[Decimal] = None


class ListaBobinasPapel(BaseModel):
    Bobinas: List[BobinaPapel]


class BobinaPapelIngresoItem(BaseModel):
    CodigoBobina: str
    PesoBrutoKg: Optional[Decimal] = None
    Gramaje: Optional[Decimal] = None
    PesoNetoKg: Optional[Decimal] = None


class IngresoModelo(BaseModel):
    IdProveedor: int
    IdTipoBobina: int
    Bobinas: List[BobinaPapelIngresoItem]


class IngresoLoteBobinaPapelResponse(BaseModel):
    FechaRecepcion: date
    CantidadBobinas: int



class TipoBobinaPapelIngreso(BaseModel):
    IdTipoBobina: int
    NombreTipoBobina: str
    Activo: bool
    TaraKg: Decimal


class EditarBobinaPapelRequest(BaseModel):
    IdBobinaPapel: int
    CodigoBobina: str
    PesoBrutoKg: Decimal
    PesoNetoKg: Decimal
    Gramaje: Optional[Decimal] = None
    Observacion: Optional[str] = None


class EditarBobinaPapelResponse(BaseModel):
    IdBobinaPapel: int
    CodigoBobina: str
    PesoBrutoKg: Decimal
    PesoNetoKg: Decimal
    Gramaje: Optional[Decimal] = None
    FechaMovimiento: datetime