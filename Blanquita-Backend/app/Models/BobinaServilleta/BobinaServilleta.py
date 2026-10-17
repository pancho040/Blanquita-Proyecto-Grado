
from datetime import date

from pydantic import BaseModel


class UnidadBobinaServilletaItem(BaseModel):
    CodigoBobina: str
    IdFormatoSubBobina: int
    PesoBrutoKg: float | None = None
    GramajeGr: float | None = None


class BobinaServilletaItem(BaseModel):
    Unidades: list[UnidadBobinaServilletaItem]


class IngresoBobinaServilletaRequest(BaseModel):
    IdProveedor: int
    IdTipoBobinaServilleta: int
    Bobinas: list[BobinaServilletaItem]


class IngresoBobinaServilletaResponse(BaseModel):
    FechaRecepcion: date
    CantidadBobinasServilleta: int
    CantidadUnidades: int


class TipoBobinaServilletaIngreso(BaseModel):
    IdTipoBobinaServilleta: int
    NombreTipoBobinaServilleta: str
    Activo: bool
