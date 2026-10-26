from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class ReporteProduccionDiariaProductoTerminadoRequest(BaseModel):
    FechaInicio: date
    FechaFin: date
    IdsProducto: Optional[list[int]] = None
    IdTurno: Optional[int] = None
    VerMovimientos: bool = False


class ProduccionPresentacionResponse(BaseModel):
    IdPresentacion: int
    CodigoPresentacion: str
    NombrePresentacion: str
    Entradas: int
    Aumentos: int
    Descuentos: int
    Correcciones: int
    Total: int
    NumeroRegistros: int


class ProduccionLineaResponse(BaseModel):
    IdProducto: int
    NombreProducto: str
    Unidad: str
    Entradas: int
    Correcciones: int
    Total: int
    NumeroRegistros: int
    DiasConProduccion: int
    PromedioPorDia: Optional[Decimal]
    Presentaciones: list[ProduccionPresentacionResponse]


class ProduccionDiaResponse(BaseModel):
    Fecha: date
    TotalesPorLinea: dict[int, int]


class MovimientoProduccionProductoTerminadoResponse(BaseModel):
    IdMovimientoProductoTerminado: int
    FechaMovimiento: datetime
    IdProducto: int
    NombreProducto: str
    IdPresentacion: int
    CodigoPresentacion: str
    CantidadRollosUnidades: Optional[int]
    NombrePresentacion: str
    IdTipoMovimientoInventario: int
    NombreTipoMovimientoInventario: str
    Cantidad: int
    NombreTurno: str
    Observacion: Optional[str]
    Ci: str
    PrimerNombre: str
    ApellidoPaterno: str
    NombreRol: str


class ReporteProduccionDiariaProductoTerminadoResponse(BaseModel):
    PeriodoInicio: date
    PeriodoFin: date
    DiasPeriodo: int
    DiasConProduccion: int
    TodasLasLineas: bool
    NombreTurno: Optional[str] = None
    Lineas: list[ProduccionLineaResponse]
    ProduccionPorDia: list[ProduccionDiaResponse]
    Movimientos: Optional[list[MovimientoProduccionProductoTerminadoResponse]] = None


class ReporteInventarioProductoTerminadoRequest(BaseModel):
    IdsProducto: Optional[list[int]] = None


class InventarioPresentacionResponse(BaseModel):
    IdPresentacion: int
    CodigoPresentacion: str
    NombrePresentacion: str
    TipoContenedor: str
    CantidadRollosUnidades: Optional[int]
    CantidadPorUnidadTerminada: Optional[int]
    CantidadActual: int
    FechaUltimoMovimiento: Optional[datetime]


class InventarioLineaResponse(BaseModel):
    IdProducto: int
    NombreProducto: str
    Unidad: str
    Total: int
    Presentaciones: list[InventarioPresentacionResponse]


class ReporteInventarioProductoTerminadoResponse(BaseModel):
    FechaGeneracion: datetime
    TodasLasLineas: bool
    Lineas: list[InventarioLineaResponse]


class ReporteSalidasProductoTerminadoRequest(BaseModel):
    FechaInicio: date
    FechaFin: date
    IdsProducto: Optional[list[int]] = None


class SalidaLineaResponse(BaseModel):
    IdProducto: int
    NombreProducto: str
    Unidad: str
    CantidadSalida: int
    NumeroSalidas: int


class SalidaPresentacionResponse(BaseModel):
    IdProducto: int
    NombreProducto: str
    Unidad: str
    IdPresentacion: int
    CodigoPresentacion: str
    NombrePresentacion: str
    CantidadSalida: int
    NumeroSalidas: int
    CantidadActual: int


class MovimientoSalidaProductoTerminadoResponse(BaseModel):
    IdMovimientoProductoTerminado: int
    FechaMovimiento: datetime
    IdProducto: int
    NombreProducto: str
    IdPresentacion: int
    CodigoPresentacion: str
    NombrePresentacion: str
    Unidad: str
    Cantidad: int
    Observacion: Optional[str]
    Ci: str
    PrimerNombre: str
    ApellidoPaterno: str
    NombreRol: str


class ReporteSalidasProductoTerminadoResponse(BaseModel):
    PeriodoInicio: date
    PeriodoFin: date
    TodasLasLineas: bool
    NombresLineas: list[str]
    NumeroSalidas: int
    Lineas: list[SalidaLineaResponse]
    Presentaciones: list[SalidaPresentacionResponse]
    Movimientos: list[MovimientoSalidaProductoTerminadoResponse]


class DespachoSalidaResponse(BaseModel):
    IdDespacho: int
    FechaMovimiento: datetime
    Observacion: Optional[str]
    Ci: str
    PrimerNombre: str
    ApellidoPaterno: str
    NombreRol: str
    NumeroPresentaciones: int
    CantidadTotal: int
    Items: list[MovimientoSalidaProductoTerminadoResponse]


class ReporteSalidasConDespachosResponse(ReporteSalidasProductoTerminadoResponse):
    Despachos: list[DespachoSalidaResponse]
