from datetime import date
from pydantic import BaseModel
from datetime import datetime

from app.Models.AlertaStock.AlertaStock import NivelStockResponse



class EmpaqueItem(BaseModel):
    CodigoEmpaque: str
    IdTipoEmpaque: int
    PesoKg: float


class IngresoEmpaqueRequest(BaseModel):
    IdProveedor: int
    CantidadToneladasPedida: float
    Empaques: list[EmpaqueItem]


class IngresoEmpaqueResponseItem(BaseModel):
    FechaRecepcion: date
    IdTipoEmpaque: int
    NombreTipoEmpaque: str
    CantidadEmpaques: int


class IngresoEmpaqueResponse(BaseModel):
    Resumen: list[IngresoEmpaqueResponseItem]



class TrasladarEmpaquesProduccionRequest(BaseModel):
    IdsEmpaque: list[int]


class TrasladarEmpaquesProduccionResponseItem(BaseModel):
    IdEmpaque: int
    CodigoEmpaque: str
    IdEstadoMateriaPrima: int
    FechaMovimiento: datetime


class ResumenInventarioEmpaqueResponse(NivelStockResponse):
    IdTipoEmpaque: int
    NombreTipoEmpaque: str
    Activo: bool
    CantidadEmpaques: int


class DetalleInventarioEmpaqueRequest(BaseModel):
    IdTipoEmpaque: int


class DetalleInventarioEmpaqueResponse(BaseModel):
    IdEmpaque: int
    CodigoEmpaque: str
    PesoKg: float
    FechaRecepcion: date
    NombreProveedor: str


class TipoEmpaque(BaseModel):
    IdTipoEmpaque: int
    NombreTipoEmpaque: str
    Activo: bool