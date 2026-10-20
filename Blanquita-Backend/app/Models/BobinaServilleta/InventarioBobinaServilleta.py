from pydantic import BaseModel, Field
from datetime import datetime,date

from app.Models.AlertaStock.AlertaStock import NivelStockResponse
from app.Models.BobinaServilleta.BobinaServilleta import UnidadServilletaResponse


class ReingresarSubBobinaInventarioRequest(BaseModel):
    IdSubBobina: int
    Observacion: str


class ReingresarSubBobinaInventarioResponse(BaseModel):
    IdSubBobina: int
    IdEstadoMateriaPrima: int
    FechaMovimiento: datetime


class ResumenInventarioBobinaServilletaResponse(NivelStockResponse):
    IdTipoBobinaServilleta: int
    NombreTipoBobinaServilleta: str
    Activo: bool
    CantidadBobinaServilleta: int


class DetalleInventarioBobinaServilletaRequest(BaseModel):
    IdTipoBobinaServilleta: int


class DetalleInventarioBobinaServilletaResponse(BaseModel):
    IdBobinaServilleta: int
    FechaRecepcion: date
    NombreProveedor: str
    Unidades: list[UnidadServilletaResponse]


class ResumenInventarioSubBobinaServilletaResponse(NivelStockResponse):
    IdTipoMedidaSubBobina: int
    NombreTipoMedida: str
    CantidadSubBobinas: int


class DetalleInventarioSubBobinaServilletaRequest(BaseModel):
    IdTipoMedidaSubBobina: int


class DetalleInventarioSubBobinaServilletaResponse(BaseModel):
    IdSubBobinaServilleta: int
    CodigoUnidadOrigen: str
    Reingresada: bool
    FechaUltimoReingreso: datetime | None



class SubBobinaServilletaFueraInventarioResponse(BaseModel):
    IdSubBobinaServilleta: int
    CodigoUnidadOrigen: str
    NombreTipoMedida: str
    UltimaObservacion: str | None
    FechaUltimoMovimiento: datetime | None

class EditarUnidadBobinaServilletaItem(BaseModel):
    IdUnidadBobinaServilleta: int
    CodigoBobina: str
    PesoBrutoKg: float | None = Field(default=None, gt=0)
    GramajeGr: float | None = Field(default=None, gt=0)


class EditarBobinaServilletaRequest(BaseModel):
    IdBobinaServilleta: int
    Unidades: list[EditarUnidadBobinaServilletaItem] = Field(min_length=1)
    Observacion: str


class EditarBobinaServilletaResponse(BaseModel):
    IdBobinaServilleta: int
    IdUnidadBobinaServilleta: int
    CodigoBobina: str
    IdFormatoSubBobina: int
    DescripcionFormato: str
    PesoBrutoKg: float | None
    GramajeGr: float | None
    FechaMovimiento: datetime
