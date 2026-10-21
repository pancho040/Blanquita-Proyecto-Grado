from datetime import date
from pydantic import BaseModel


class RodelaItem(BaseModel):
    CodigoRodela: str


class IngresoRodelaRequest(BaseModel):
    IdProveedor: int
    IdTipoRodela: int
    Rodelas: list[RodelaItem]


class IngresoRodelaResponse(BaseModel):
    FechaRecepcion: date
    CantidadRodelas: int


class TipoRodela(BaseModel):
    IdTipoRodela: int
    NombreTipoRodela: str
    Descripcion: str | None = None
    Activo: bool
