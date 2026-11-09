from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class SucursalBase(BaseModel):
    nombre: str
    ciudad: str
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    activa: bool = True


class SucursalCrear(SucursalBase):
    pass


class SucursalUpdate(BaseModel):
    nombre: Optional[str] = None
    ciudad: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    activa: Optional[bool] = None


class SucursalResponse(SucursalBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PlantaResponse(BaseModel):
    id: int
    nombre: str
    sucursal_id: Optional[int] = None
    activa: bool
    proveedor_inventario: str

    model_config = ConfigDict(from_attributes=True)
