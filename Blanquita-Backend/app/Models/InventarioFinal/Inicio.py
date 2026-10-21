from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.Models.AlertaStock.AlertaStock import NivelStockResponse


class PresentacionStockInicio(NivelStockResponse):
    IdPresentacion: int
    CodigoPresentacion: str
    TipoContenedor: str
    CantidadRollosUnidades: Optional[int]
    CantidadPorUnidadTerminada: Optional[int]
    Activo: bool
    CantidadActual: int
    Unidades: int
    FechaUltimoMovimiento: Optional[datetime]


class LineaStockInicio(BaseModel):
    IdProducto: int
    NombreProducto: str
    Activo: bool
    CantidadActual: int
    Unidades: int
    Presentaciones: list[PresentacionStockInicio]


class AlertasStockInicio(BaseModel):
    Agotadas: int
    Criticas: int
    Bajas: int


class ConteoMovimientoInicio(BaseModel):
    Registros: int
    RegistrosSemanaAnterior: int
    Contenedores: int


class PresentacionPendienteInicio(BaseModel):
    IdPresentacion: int
    NombreProducto: str
    CodigoPresentacion: str
    TipoContenedor: str
    CantidadActual: int
    FechaUltimoMovimiento: Optional[datetime]


class MovimientoRecienteProductoTerminado(BaseModel):
    IdMovimientoProductoTerminado: int
    IdTipoMovimientoInventario: int
    NombreTipoMovimientoInventario: str
    NombreProducto: str
    CodigoPresentacion: str
    TipoContenedor: str
    Cantidad: int
    Usuario: str
    FechaMovimiento: datetime
    Observacion: Optional[str]


class LineaSemanaInicio(BaseModel):
    IdProducto: int
    NombreProducto: str
    Unidades: int
    Contenedores: int
    Registros: int


class DiaSemanaProductoTerminado(BaseModel):
    Fecha: date
    Unidades: int
    Contenedores: int
    Lineas: list[LineaSemanaInicio]


class InicioInventarioProductoTerminadoResponse(BaseModel):
    FechaInicio: date
    FechaFin: date
    DiasSinMovimiento: int
    Alertas: AlertasStockInicio
    UnidadesTotales: int
    Lineas: list[LineaStockInicio]
    AjustesPositivos: ConteoMovimientoInicio
    AjustesNegativos: ConteoMovimientoInicio
    Correcciones: ConteoMovimientoInicio
    SinMovimiento: list[PresentacionPendienteInicio]
    InactivasConStock: list[PresentacionPendienteInicio]
    UltimosMovimientos: list[MovimientoRecienteProductoTerminado]


class IndicadoresProduccionProductoTerminado(BaseModel):
    Unidades: int
    UnidadesSemanaAnterior: int
    Contenedores: int
    ContenedoresSemanaAnterior: int
    Ingresos: int
    IngresosSemanaAnterior: int
    Descuentos: int
    DescuentosSemanaAnterior: int


class TurnoProduccionProductoTerminado(BaseModel):
    NombreTurno: str
    Unidades: int
    Registros: int


class InicioProduccionProductoTerminadoResponse(BaseModel):
    FechaInicio: date
    FechaFin: date
    Indicadores: IndicadoresProduccionProductoTerminado
    Dias: list[DiaSemanaProductoTerminado]
    Lineas: list[LineaSemanaInicio]
    Turnos: list[TurnoProduccionProductoTerminado]
    UltimosIngresos: list[MovimientoRecienteProductoTerminado]


class IndicadoresSalidasProductoTerminado(BaseModel):
    Despachos: int
    DespachosSemanaAnterior: int
    Unidades: int
    UnidadesSemanaAnterior: int
    Contenedores: int
    ContenedoresSemanaAnterior: int
    Presentaciones: int


class PresentacionDespachadaInicio(BaseModel):
    IdPresentacion: int
    NombreProducto: str
    CodigoPresentacion: str
    TipoContenedor: str
    Contenedores: int
    Unidades: int
    CantidadActual: int


class DespachoInicio(BaseModel):
    IdDespacho: int
    FechaMovimiento: datetime
    Usuario: str
    Observacion: Optional[str]
    NumeroPresentaciones: int
    CantidadTotal: int


class InicioSalidasProductoTerminadoResponse(BaseModel):
    FechaInicio: date
    FechaFin: date
    Indicadores: IndicadoresSalidasProductoTerminado
    Dias: list[DiaSemanaProductoTerminado]
    Lineas: list[LineaSemanaInicio]
    PresentacionesDestacadas: list[PresentacionDespachadaInicio]
    Despachos: list[DespachoInicio]
    UltimoDespacho: Optional[DespachoInicio]
