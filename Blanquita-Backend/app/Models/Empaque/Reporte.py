from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class ClaseEmpaque(str, Enum):
    bobina = "bobina"
    bolsa = "bolsa"
    jaba = "jaba"


class ReporteEmpaqueRequest(BaseModel):
    Clase: ClaseEmpaque
    FechaInicio: date
    FechaFin: date
    IdsTipo: Optional[list[int]] = None
    IdTipoMovimiento: Optional[int] = None


class MovimientoEmpaqueReporteResponse(BaseModel):
    IdMovimiento: int
    FechaMovimiento: datetime
    IdTipo: int
    NombreTipo: str
    IdTipoMovimiento: int
    NombreMovimiento: str
    Cantidad: int
    CodigoEmpaque: Optional[str] = None
    PesoKg: Optional[Decimal] = None
    Observacion: Optional[str] = None
    Ci: str
    PrimerNombre: str
    ApellidoPaterno: str
    NombreRol: str
    IdLoteEmpaque: Optional[int] = None
    FechaRecepcion: Optional[date] = None
    CantidadToneladasPedida: Optional[Decimal] = None
    NombreProveedor: Optional[str] = None


class ResumenTipoEmpaqueResponse(BaseModel):
    IdTipo: int
    NombreTipo: str
    Ingresos: int
    Salidas: int
    Neto: int
    NumeroMovimientos: int
    CantidadActual: int


class ReporteMovimientosEmpaqueResponse(BaseModel):
    Clase: ClaseEmpaque
    NombreClase: str
    Unidad: str
    PeriodoInicio: date
    PeriodoFin: date
    TodosLosTipos: bool
    NombreMovimientoFiltro: Optional[str] = None
    Resumen: list[ResumenTipoEmpaqueResponse]
    Movimientos: list[MovimientoEmpaqueReporteResponse]


class ItemLoteEmpaqueResponse(BaseModel):
    IdTipo: int
    NombreTipo: str
    Cantidad: int
    PesoKg: Optional[Decimal] = None
    Codigos: list[str] = []


class LoteEmpaqueReporteResponse(BaseModel):
    IdLoteEmpaque: int
    FechaRecepcion: date
    NombreProveedor: str
    CantidadToneladasPedida: Optional[Decimal] = None
    FechaRegistro: datetime
    Ci: str
    PrimerNombre: str
    ApellidoPaterno: str
    NombreRol: str
    CantidadTotal: int
    PesoTotalKg: Optional[Decimal] = None
    Items: list[ItemLoteEmpaqueResponse]


class ResumenLotesTipoEmpaqueResponse(BaseModel):
    IdTipo: int
    NombreTipo: str
    NumeroLotes: int
    Cantidad: int
    PesoKg: Optional[Decimal] = None


class ReporteLotesEmpaqueResponse(BaseModel):
    Clase: ClaseEmpaque
    NombreClase: str
    Unidad: str
    PeriodoInicio: date
    PeriodoFin: date
    TodosLosTipos: bool
    Resumen: list[ResumenLotesTipoEmpaqueResponse]
    Lotes: list[LoteEmpaqueReporteResponse]


class InventarioTipoEmpaqueResponse(BaseModel):
    IdTipo: int
    NombreTipo: str
    DescripcionTipo: Optional[str] = None
    CantidadActual: int
    PesoKg: Optional[Decimal] = None
    FechaUltimoMovimiento: Optional[datetime] = None


class UnidadEmpaqueInventarioResponse(BaseModel):
    IdEmpaque: int
    CodigoEmpaque: str
    NombreTipo: str
    PesoKg: Optional[Decimal] = None
    IdLoteEmpaque: int
    FechaRecepcion: date
    NombreProveedor: str


class ReporteInventarioEmpaqueResponse(BaseModel):
    Clase: ClaseEmpaque
    NombreClase: str
    Unidad: str
    FechaGeneracion: datetime
    Tipos: list[InventarioTipoEmpaqueResponse]
    Unidades: list[UnidadEmpaqueInventarioResponse] = []
