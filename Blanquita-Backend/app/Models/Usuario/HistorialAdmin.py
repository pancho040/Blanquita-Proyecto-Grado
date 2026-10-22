from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.Constants.HistorialAdmin import LONGITUD_MAXIMA_BUSQUEDA_HISTORIAL_ADMIN
from app.Constants.RegistroIngreso import LONGITUD_MAXIMA_CI_BUSQUEDA, PATRON_CI_BUSQUEDA
from app.Models.Usuario.RegistroIngreso import UsuarioRegistroIngresoResponse


class FiltroHistorialAdminRequest(BaseModel):
    FechaInicio: date
    FechaFin: date
    Modulo: Optional[str] = None
    Ci: Optional[str] = Field(
        default=None, max_length=LONGITUD_MAXIMA_CI_BUSQUEDA, pattern=PATRON_CI_BUSQUEDA
    )
    Busqueda: Optional[str] = Field(default=None, max_length=LONGITUD_MAXIMA_BUSQUEDA_HISTORIAL_ADMIN)


class ListarHistorialAdminRequest(FiltroHistorialAdminRequest):
    Pagina: int = Field(default=1, ge=1)
    TamanoPagina: int = Field(default=20, ge=1, le=100)


class ReporteUsuarioHistorialAdminRequest(BaseModel):
    FechaInicio: Optional[date] = None
    FechaFin: Optional[date] = None
    Ci: str = Field(..., max_length=LONGITUD_MAXIMA_CI_BUSQUEDA, pattern=PATRON_CI_BUSQUEDA)
    Modulo: Optional[str] = None
    Busqueda: Optional[str] = Field(default=None, max_length=LONGITUD_MAXIMA_BUSQUEDA_HISTORIAL_ADMIN)


class ListarUsuarioHistorialAdminRequest(ReporteUsuarioHistorialAdminRequest):
    Pagina: int = Field(default=1, ge=1)
    TamanoPagina: int = Field(default=20, ge=1, le=100)


class HistorialAdminItem(BaseModel):
    IdHistorialAdmin: int
    Modulo: str
    Accion: str
    Detalle: Optional[str] = None
    Observacion: str
    FechaMovimiento: datetime
    IdUsuario: int
    Ci: str
    PrimerNombre: str
    ApellidoPaterno: str
    NombreRol: str
    NombreEstadoUsuario: str


class ResumenModuloHistorialAdminResponse(BaseModel):
    Modulo: str
    Cantidad: int


class ResumenHistorialAdminResponse(BaseModel):
    Total: int
    AdministradoresDistintos: int
    Modulos: list[ResumenModuloHistorialAdminResponse]


class ListarHistorialAdminResponse(BaseModel):
    Total: int
    Pagina: int
    TamanoPagina: int
    Resumen: ResumenHistorialAdminResponse
    Acciones: list[HistorialAdminItem]


class ReporteHistorialAdminResponse(BaseModel):
    PeriodoInicio: date
    PeriodoFin: date
    Modulo: Optional[str] = None
    Ci: Optional[str] = None
    Busqueda: Optional[str] = None
    Resumen: ResumenHistorialAdminResponse
    Acciones: list[HistorialAdminItem]


class ReporteUsuarioHistorialAdminResponse(BaseModel):
    PeriodoInicio: Optional[date] = None
    PeriodoFin: Optional[date] = None
    Ci: str
    Modulo: Optional[str] = None
    Busqueda: Optional[str] = None
    Usuario: Optional[UsuarioRegistroIngresoResponse] = None
    Resumen: ResumenHistorialAdminResponse
    UltimaAccion: Optional[datetime] = None
    Acciones: list[HistorialAdminItem]


class ListarUsuarioHistorialAdminResponse(BaseModel):
    Total: int
    Pagina: int
    TamanoPagina: int
    Ci: str
    Usuario: Optional[UsuarioRegistroIngresoResponse] = None
    Resumen: ResumenHistorialAdminResponse
    UltimaAccion: Optional[datetime] = None
    Acciones: list[HistorialAdminItem]
