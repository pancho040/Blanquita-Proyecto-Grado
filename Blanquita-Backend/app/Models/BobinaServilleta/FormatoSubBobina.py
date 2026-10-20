from pydantic import BaseModel, Field

from app.Constants.Cantidades import (
    CANTIDAD_MAXIMA_SUB_BOBINAS_POR_MEDIDA,
    MEDIDA_MAXIMA_SUB_BOBINA_MM,
    MEDIDA_MINIMA_SUB_BOBINA_MM,
    MEDIDAS_MAXIMAS_POR_FORMATO,
)
from app.Models.BobinaServilleta.BobinaServilleta import DetalleFormatoResponse


class DetalleFormatoRequest(BaseModel):
    MedidaMm: int = Field(..., ge=MEDIDA_MINIMA_SUB_BOBINA_MM, le=MEDIDA_MAXIMA_SUB_BOBINA_MM)
    Cantidad: int = Field(..., ge=1, le=CANTIDAD_MAXIMA_SUB_BOBINAS_POR_MEDIDA)
    StockMinimo: int | None = Field(default=None, ge=0)
    StockPreventivo: int | None = Field(default=None, ge=0)


class CrearFormatoSubBobinaRequest(BaseModel):
    Detalle: list[DetalleFormatoRequest] = Field(
        ..., min_length=1, max_length=MEDIDAS_MAXIMAS_POR_FORMATO
    )


class TipoAsignadoFormato(BaseModel):
    IdTipoBobinaServilleta: int
    NombreTipoBobinaServilleta: str
    Activo: bool


class FormatoSubBobinaAdminItem(BaseModel):
    IdFormatoSubBobina: int
    DescripcionFormato: str
    Activo: bool
    Detalle: list[DetalleFormatoResponse]
    Tipos: list[TipoAsignadoFormato]
    CantidadUnidades: int
