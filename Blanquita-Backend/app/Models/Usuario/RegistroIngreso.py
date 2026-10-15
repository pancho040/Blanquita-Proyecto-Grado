from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.Constants.RegistroIngreso import LONGITUD_MAXIMA_CI_BUSQUEDA, PATRON_CI_BUSQUEDA


class FiltroRegistroIngresoRequest(BaseModel):
    FechaInicio: date
    FechaFin: date
    Registro: Optional[str] = None
    Ci: Optional[str] = Field(
        default=None, max_length=LONGITUD_MAXIMA_CI_BUSQUEDA, pattern=PATRON_CI_BUSQUEDA
    )


class ListarRegistroIngresoRequest(FiltroRegistroIngresoRequest):
    Pagina: int = Field(default=1, ge=1)
    TamanoPagina: int = Field(default=20, ge=1, le=100)


class ReporteUsuarioRegistroIngresoRequest(BaseModel):
    FechaInicio: date
    FechaFin: date
    Ci: str = Field(..., max_length=LONGITUD_MAXIMA_CI_BUSQUEDA, pattern=PATRON_CI_BUSQUEDA)
    Registro: Optional[str] = None


class RegistroIngresoItem(BaseModel):
    IdRegistroIngreso: int
    Registro: str
    IdUsuario: Optional[int] = None
    Ci: Optional[str] = None
    PrimerNombre: Optional[str] = None
    ApellidoPaterno: Optional[str] = None
    ApellidoMaterno: Optional[str] = None
    NombreRol: Optional[str] = None
    Detalle: Optional[str] = None
    DireccionIp: Optional[str] = None
    UserAgent: Optional[str] = None
    Dispositivo: str
    FechaRegistro: datetime


class ResumenRegistroIngresoResponse(BaseModel):
    Ingresos: int
    Salidas: int
    IntentosFallidos: int
    Total: int
    CisDistintos: int


class ListarRegistroIngresoResponse(BaseModel):
    Total: int
    Pagina: int
    TamanoPagina: int
    Resumen: ResumenRegistroIngresoResponse
    Registros: list[RegistroIngresoItem]


class ReporteRegistroIngresoResponse(BaseModel):
    PeriodoInicio: date
    PeriodoFin: date
    Registro: Optional[str] = None
    Ci: Optional[str] = None
    Resumen: ResumenRegistroIngresoResponse
    Registros: list[RegistroIngresoItem]


class UsuarioRegistroIngresoResponse(BaseModel):
    IdUsuario: int
    Ci: str
    PrimerNombre: str
    SegundoNombre: Optional[str] = None
    ApellidoPaterno: str
    ApellidoMaterno: Optional[str] = None
    NombreRol: str
    NombreEstadoUsuario: str


class ReporteUsuarioRegistroIngresoResponse(BaseModel):
    PeriodoInicio: date
    PeriodoFin: date
    Ci: str
    Registro: Optional[str] = None
    Usuario: Optional[UsuarioRegistroIngresoResponse] = None
    Resumen: ResumenRegistroIngresoResponse
    UltimoIngreso: Optional[datetime] = None
    UltimoIntentoFallido: Optional[datetime] = None
    Registros: list[RegistroIngresoItem]
