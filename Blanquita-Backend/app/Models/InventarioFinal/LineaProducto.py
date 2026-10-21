from pydantic import BaseModel, Field

from app.Constants.Cantidades import (
    LONGITUD_MAXIMA_NOMBRE_LINEA_PRODUCTO,
    LONGITUD_MINIMA_NOMBRE_LINEA_PRODUCTO,
    PAQUETES_MAXIMOS_POR_JABA,
    PRESENTACIONES_MAXIMAS_AL_CREAR_LINEA,
    UNIDADES_MAXIMAS_POR_PAQUETE,
)
from app.Models.AlertaStock.AlertaStock import NivelStockResponse


class PresentacionRequest(BaseModel):
    TipoContenedor: str
    CantidadRollosUnidades: int = Field(..., ge=1, le=UNIDADES_MAXIMAS_POR_PAQUETE)
    CantidadPorUnidadTerminada: int | None = Field(default=None, ge=1, le=PAQUETES_MAXIMOS_POR_JABA)
    CodigoPresentacion: str | None = None
    StockMinimo: int | None = Field(default=None, ge=0)
    StockPreventivo: int | None = Field(default=None, ge=0)


class CrearPresentacionRequest(PresentacionRequest):
    IdProducto: int = Field(..., gt=0)


class OrigenLineaRequest(BaseModel):
    IdTipoBobina: int | None = Field(default=None, gt=0)
    IdTipoBobinaServilleta: int | None = Field(default=None, gt=0)


class CrearLineaProductoRequest(OrigenLineaRequest):
    NombreProducto: str = Field(
        ...,
        min_length=LONGITUD_MINIMA_NOMBRE_LINEA_PRODUCTO,
        max_length=LONGITUD_MAXIMA_NOMBRE_LINEA_PRODUCTO,
    )
    SiglasProducto: str = Field(..., min_length=3, max_length=3)
    Presentaciones: list[PresentacionRequest] = Field(
        ..., min_length=1, max_length=PRESENTACIONES_MAXIMAS_AL_CREAR_LINEA
    )


class EditarLineaProductoRequest(OrigenLineaRequest):
    IdProducto: int = Field(..., gt=0)


class PresentacionAdminItem(NivelStockResponse):
    IdPresentacion: int
    IdProducto: int
    TipoContenedor: str
    CantidadRollosUnidades: int | None = None
    CantidadPorUnidadTerminada: int | None = None
    CodigoPresentacion: str
    Activo: bool
    CantidadActual: int


class LineaProductoAdminItem(BaseModel):
    IdProducto: int
    NombreProducto: str
    SiglasProducto: str
    Activo: bool
    IdTipoBobina: int | None = None
    NombreTipoBobina: str | None = None
    IdTipoBobinaServilleta: int | None = None
    NombreTipoBobinaServilleta: str | None = None
    EnProduccion: bool
    Presentaciones: list[PresentacionAdminItem]


class TipoOrigenItem(BaseModel):
    Id: int
    Nombre: str


class TiposOrigenResponse(BaseModel):
    BobinaPapel: list[TipoOrigenItem]
    BobinaServilleta: list[TipoOrigenItem]
