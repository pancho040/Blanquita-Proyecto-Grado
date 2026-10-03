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
