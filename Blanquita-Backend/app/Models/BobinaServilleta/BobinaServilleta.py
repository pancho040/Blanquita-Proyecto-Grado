from datetime import date
from decimal import Decimal

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


class DetalleFormatoResponse(BaseModel):
    IdTipoMedidaSubBobina: int
    MedidaMm: int
    DescripcionMedida: str | None
    Cantidad: int


class FormatoSubBobinaResponse(BaseModel):
    IdFormatoSubBobina: int
    DescripcionFormato: str
    Activo: bool
    Detalle: list[DetalleFormatoResponse]


class TipoBobinaServilletaIngreso(BaseModel):
    IdTipoBobinaServilleta: int
    NombreTipoBobinaServilleta: str
    CantidadUnidades: int
    Activo: bool
    Formatos: list[FormatoSubBobinaResponse]


class UnidadServilletaResponse(BaseModel):
    IdUnidadBobinaServilleta: int
    CodigoBobina: str
    IdFormatoSubBobina: int
    DescripcionFormato: str
    PesoBrutoKg: Decimal | None
    GramajeGr: Decimal | None
