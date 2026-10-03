from typing import Optional
from pydantic import BaseModel
from datetime import date

class PrecioProductoBase(BaseModel):
    IdPresentacion: int
    PrecioUnitario: float
    PrecioMayorista: Optional[float] = None
    CantidadMinimaMayorista: int = 10
    VigenteDesde: date = date.today()
    VigenteHasta: Optional[date] = None
    Activo: bool = True

class PrecioProductoCrear(PrecioProductoBase):
    pass

class PrecioProductoResponse(BaseModel):
    IdPrecioProducto: Optional[int] = None
    IdPresentacion: int
    NombreProducto: str
    TipoContenedor: str
    CantidadRollosUnidades: Optional[int] = None
    CodigoPresentacion: str
    PrecioUnitario: Optional[float] = None
    PrecioMayorista: Optional[float] = None
    CantidadMinimaMayorista: Optional[int] = 10
    VigenteDesde: Optional[date] = None
    Activo: bool = True

    class Config:
        from_attributes = True
