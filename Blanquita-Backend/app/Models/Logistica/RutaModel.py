from typing import Optional, List
from pydantic import BaseModel
from datetime import date, datetime

class ZonaBase(BaseModel):
    NombreZona: str
    Ciudad: str = "Sucre"
    Descripcion: Optional[str] = None
    Activa: bool = True

class ZonaCrear(ZonaBase):
    pass

class ZonaResponse(ZonaBase):
    IdZonaDistribucion: int
    TotalRutas: Optional[int] = 0

    class Config:
        from_attributes = True

class RutaBase(BaseModel):
    IdZonaDistribucion: int
    NombreRuta: str
    DiaSemana: Optional[int] = None # 1=Lunes, 7=Domingo
    Descripcion: Optional[str] = None
    Activa: bool = True

class RutaCrear(RutaBase):
    pass

class RutaActualizar(BaseModel):
    IdZonaDistribucion: Optional[int] = None
    NombreRuta: Optional[str] = None
    DiaSemana: Optional[int] = None
    Descripcion: Optional[str] = None
    Activa: Optional[bool] = None

class PuntoVentaRutaItem(BaseModel):
    IdPuntoVenta: int
    NombrePuntoVenta: str
    NombreCliente: str
    Direccion: str
    Latitud: Optional[float] = None
    Longitud: Optional[float] = None
    OrdenVisita: int

class RutaResponse(RutaBase):
    IdRutaDistribucion: int
    NombreZona: Optional[str] = None
    TotalPuntosVenta: Optional[int] = 0
    PuntosVenta: List[PuntoVentaRutaItem] = []

    class Config:
        from_attributes = True

class GuardarPuntosVentaRuta(BaseModel):
    PuntosVenta: List[dict] # [{"IdPuntoVenta": int, "OrdenVisita": int}]

class AsignacionRutaCrear(BaseModel):
    IdRutaDistribucion: int
    IdUsuarioRepartidor: int
    FechaAsignacion: date
    KilometrajeInicial: Optional[float] = None
    Observacion: Optional[str] = None

class AsignacionRutaActualizar(BaseModel):
    Estado: Optional[str] = None # 'Pendiente', 'En Ruta', 'Finalizada', 'Cancelada'
    KilometrajeFinal: Optional[float] = None
    Observacion: Optional[str] = None

class AsignacionRutaResponse(BaseModel):
    IdAsignacionRuta: int
    IdRutaDistribucion: int
    NombreRuta: str
    NombreZona: Optional[str] = None
    IdUsuarioRepartidor: int
    NombreRepartidor: str
    FechaAsignacion: date
    Estado: str
    KilometrajeInicial: Optional[float] = None
    KilometrajeFinal: Optional[float] = None
    Observacion: Optional[str] = None

    class Config:
        from_attributes = True

class RepartidorCrear(BaseModel):
    Ci: str
    PrimerNombre: str
    SegundoNombre: Optional[str] = None
    ApellidoPaterno: str
    ApellidoMaterno: Optional[str] = None
    Celular: Optional[str] = None
    Clave: Optional[str] = "Blanquita123!"

class RepartidorResponse(BaseModel):
    IdUsuario: int
    NombreCompleto: str
    Ci: str
    Celular: Optional[str] = None
    IdEstadoUsuario: int
    Estado: str
    TotalAsignaciones: Optional[int] = 0

class TelemetriaPing(BaseModel):
    IdUsuarioRepartidor: int
    IdAsignacionRuta: Optional[int] = None
    Latitud: float
    Longitud: float
    Velocidad: Optional[float] = 0.0
    Bateria: Optional[int] = 100
    EstadoMovimiento: Optional[str] = "En Ruta"
    DireccionAproximada: Optional[str] = None
    ParadaActual: Optional[int] = None
    ParadasCompletadas: Optional[int] = None
    MontoCobradoTotal: Optional[float] = None

class ChoferTrackingResponse(BaseModel):
    IdTracking: int
    IdUsuarioRepartidor: int
    NombreRepartidor: str
    Celular: Optional[str] = None
    IdAsignacionRuta: Optional[int] = None
    NombreRuta: Optional[str] = None
    NombreZona: Optional[str] = None
    EstadoAsignacion: Optional[str] = None
    Latitud: float
    Longitud: float
    Velocidad: float
    Bateria: int
    EstadoMovimiento: str
    DireccionAproximada: Optional[str] = None
    ParadaActual: int
    TotalParadas: int
    ParadasCompletadas: int
    MontoCobradoTotal: float
    UltimaActualizacion: Optional[datetime] = None
    SegundosDesdeUltimoReporte: Optional[int] = 0

    class Config:
        from_attributes = True

