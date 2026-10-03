from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime

class PuntoVentaBase(BaseModel):
    NombrePuntoVenta: str
    Direccion: str
    Latitud: Optional[float] = None
    Longitud: Optional[float] = None
    Referencia: Optional[str] = None
    Activo: bool = True

class PuntoVentaCrear(PuntoVentaBase):
    pass

class PuntoVentaResponse(PuntoVentaBase):
    IdPuntoVenta: int
    IdCliente: int

    class Config:
        from_attributes = True

class ClienteBase(BaseModel):
    RazonSocial: str
    NombreComercial: Optional[str] = None
    NitCi: str
    Telefono: Optional[str] = None
    CorreoElectronico: Optional[str] = None
    Direccion: Optional[str] = None
    Latitud: Optional[float] = None
    Longitud: Optional[float] = None
    LimiteCreditoBs: float = 0.0
    DiasCredito: int = 0
    Observacion: Optional[str] = None

class ClienteCrear(ClienteBase):
    IdEstadoCliente: int = 1
    # Punto de venta inicial opcional (si se deja vacío, se toma la dirección principal)
    NombrePuntoVentaPrincipal: Optional[str] = None
    ReferenciaUbicacion: Optional[str] = None

class ClienteActualizar(BaseModel):
    RazonSocial: Optional[str] = None
    NombreComercial: Optional[str] = None
    NitCi: Optional[str] = None
    Telefono: Optional[str] = None
    CorreoElectronico: Optional[str] = None
    Direccion: Optional[str] = None
    Latitud: Optional[float] = None
    Longitud: Optional[float] = None
    LimiteCreditoBs: Optional[float] = None
    DiasCredito: Optional[int] = None
    BloqueadoPorMora: Optional[bool] = None
    IdEstadoCliente: Optional[int] = None
    Observacion: Optional[str] = None

class ClienteResponse(ClienteBase):
    IdCliente: int
    IdEstadoCliente: int
    NombreEstado: Optional[str] = None
    BloqueadoPorMora: bool = False
    FechaRegistro: Optional[datetime] = None
    TotalPuntosVenta: Optional[int] = 0

    class Config:
        from_attributes = True

class ClienteDetalleResponse(ClienteResponse):
    PuntosVenta: List[PuntoVentaResponse] = []
