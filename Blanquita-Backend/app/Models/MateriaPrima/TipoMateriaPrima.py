from pydantic import BaseModel, Field

from app.Constants.Cantidades import (
    LONGITUD_MAXIMA_NOMBRE_TIPO_MATERIA_PRIMA,
    LONGITUD_MINIMA_NOMBRE_TIPO_MATERIA_PRIMA,
)


def CampoNombreTipo():
    return Field(
        ...,
        min_length=LONGITUD_MINIMA_NOMBRE_TIPO_MATERIA_PRIMA,
        max_length=LONGITUD_MAXIMA_NOMBRE_TIPO_MATERIA_PRIMA,
    )


class DatosTipoRequest(BaseModel):
    Descripcion: str | None = None
    StockMinimo: int | None = Field(default=None, ge=0)
    StockPreventivo: int | None = Field(default=None, ge=0)


class ProductoAsociado(BaseModel):
    IdProducto: int
    NombreProducto: str
    Activo: bool


class ProductoDisponible(ProductoAsociado):
    IdTipoActual: int | None = None
    NombreTipoActual: str | None = None


class CambiarEstadoTipoRequest(BaseModel):
    Id: int = Field(..., gt=0)
    Activo: bool
    Motivo: str


class CambiarEstadoTipoResponse(BaseModel):
    Id: int
    Nombre: str
    ActivoAnterior: bool
    Activo: bool
