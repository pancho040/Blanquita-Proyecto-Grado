from datetime import datetime

from pydantic import BaseModel, Field

from app.Models.AlertaStock.AlertaStock import NivelStockResponse


class IngresoProductoTerminadoItem(BaseModel):
    IdPresentacion: int
    Cantidad: int
    Observacion: str | None = None


class IngresoProductoTerminadoRequest(BaseModel):
    Presentaciones: list[IngresoProductoTerminadoItem]


class IngresoProductoTerminadoResponse(BaseModel):
    IdPresentacion: int
    CodigoPresentacion: str
    NombreProducto: str
    CantidadIngresada: int
    CantidadActual: int



class SalidaProductoTerminadoItem(BaseModel):
    IdPresentacion: int = Field(..., gt=0)
    Cantidad: int


class SalidaProductoTerminadoRequest(BaseModel):
    Observacion: str
    Presentaciones: list[SalidaProductoTerminadoItem]


class SalidaProductoTerminadoItemResponse(BaseModel):
    IdMovimientoProductoTerminado: int
    IdPresentacion: int
    CodigoPresentacion: str
    NombreProducto: str
    CantidadSalida: int
    CantidadActual: int


class SalidaProductoTerminadoResponse(BaseModel):
    FechaMovimiento: datetime
    Observacion: str
    CantidadTotal: int
    Presentaciones: list[SalidaProductoTerminadoItemResponse]



class CorreccionProductoTerminadoRequest(BaseModel):
    IdPresentacion: int
    Cantidad: int
    Observacion: str


class CorreccionProductoTerminadoResponse(BaseModel):
    IdPresentacion: int
    CodigoPresentacion: str
    NombreProducto: str
    NombreTipoMovimientoInventario: str
    CantidadAplicada: int
    CantidadActual: int



class VerInventarioProductoTerminadoRequest(BaseModel):
    IdProducto: int | None = None


class VerInventarioProductoTerminadoResponse(NivelStockResponse):
    IdPresentacion: int
    CodigoPresentacion: str
    NombreProducto: str
    TipoContenedor: str
    CantidadRollosUnidades: int | None
    CantidadPorUnidadTerminada: int | None
    CantidadActual: int
    Activo: bool


class ProductoResponse(BaseModel):
    IdProducto: int
    NombreProducto: str
    IdTipoBobina: int | None
    IdTipoBobinaServilleta: int | None
    Activo: bool