from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from datetime import datetime


class DetalleEnvioItem(BaseModel):
    presentacion_id: int
    cantidad_enviada: Decimal


class DetalleEnvioResponse(BaseModel):
    id: int
    presentacion_id: int
    codigo_presentacion: Optional[str] = None
    nombre_producto: Optional[str] = None
    tipo_contenedor: Optional[str] = None
    cantidad_enviada: Decimal
    cantidad_recibida: Decimal

    model_config = ConfigDict(from_attributes=True)


class EnvioCrearDTO(BaseModel):
    numero_guia: str
    origen_tipo: str  # 'PLANTA' | 'SUCURSAL'
    origen_id: int
    destino_tipo: str  # 'PLANTA' | 'SUCURSAL'
    destino_id: int
    chofer_nombre: Optional[str] = None
    camion_placa: Optional[str] = None
    observaciones: Optional[str] = None
    detalles: List[DetalleEnvioItem]


class EnvioRecepcionarItem(BaseModel):
    presentacion_id: int
    cantidad_recibida: Decimal
    motivo_merma: Optional[str] = None


class EnvioRecepcionarDTO(BaseModel):
    items: List[EnvioRecepcionarItem]
    observaciones: Optional[str] = None


class MermaEnvioResponse(BaseModel):
    id: int
    presentacion_id: int
    codigo_presentacion: Optional[str] = None
    cantidad_merma: Decimal
    motivo: str
    fecha_registro: datetime

    model_config = ConfigDict(from_attributes=True)


class EnvioResponse(BaseModel):
    id: int
    numero_guia: str
    origen_tipo: str
    origen_id: int
    origen_nombre: Optional[str] = None
    destino_tipo: str
    destino_id: int
    destino_nombre: Optional[str] = None
    estado: str
    descuento_planta_aplicado: bool
    chofer_nombre: Optional[str] = None
    camion_placa: Optional[str] = None
    usuario_despacho_id: int
    usuario_recepcion_id: Optional[int] = None
    fecha_despacho: Optional[datetime] = None
    fecha_recepcion: Optional[datetime] = None
    observaciones: Optional[str] = None
    detalles: List[DetalleEnvioResponse] = []
    mermas: List[MermaEnvioResponse] = []

    model_config = ConfigDict(from_attributes=True)
