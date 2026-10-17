from datetime import date, datetime
from pydantic import BaseModel


class ResumenInventarioRodelaResponse(BaseModel):
    IdTipoRodela: int
    NombreTipoRodela: str
    Descripcion: str | None
    Activo: bool
    CantidadEnAlmacen: int
    CantidadAbiertas: int


class DetalleInventarioRodelaRequest(BaseModel):
    IdTipoRodela: int


class DetalleInventarioRodelaResponse(BaseModel):
    IdRodela: int
    CodigoRodela: str
    CodigoLote: str
    FechaRecepcion: date
    NombreProveedor: str
    TipoEstado: str


class RodelaEnAlmacenResponse(BaseModel):
    IdRodela: int
    CodigoRodela: str


class TrasladarRodelaRequest(BaseModel):
    IdRodela: int
    Observacion: str | None = None


class TrasladarRodelaResponse(BaseModel):
    IdRodela: int
    CodigoRodela: str
    IdEstadoMateriaPrima: int
    FechaMovimiento: datetime


class CorregirTrasladoRodelaRequest(BaseModel):
    IdRodela: int
    Observacion: str | None = None


class CorregirTrasladoRodelaResponse(BaseModel):
    IdRodela: int
    CodigoRodela: str
    IdEstadoMateriaPrima: int
    FechaMovimiento: datetime


class DeshacerTrasladoRodelaRequest(BaseModel):
    IdRodela: int
    Observacion: str | None = None


class DeshacerTrasladoRodelaResponse(BaseModel):
    IdRodela: int
    CodigoRodela: str
    IdEstadoMateriaPrima: int
    FechaMovimiento: datetime


class EditarRodelaRequest(BaseModel):
    IdRodela: int
    CodigoRodela: str
    Observacion: str


class EditarRodelaResponse(BaseModel):
    IdRodela: int
    CodigoAnterior: str
    CodigoRodela: str
    IdEstadoMateriaPrima: int
    FechaMovimiento: datetime


class RodelaReingresableResponse(BaseModel):
    IdRodela: int
    CodigoRodela: str
    IdTipoRodela: int
    NombreTipoRodela: str
    FechaRecepcion: date
    NombreProveedor: str
    FechaTraslado: datetime
    MinutosRestantes: int
