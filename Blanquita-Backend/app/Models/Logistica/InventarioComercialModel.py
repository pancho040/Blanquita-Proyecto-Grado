from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from datetime import datetime


class InventarioSucursalResponse(BaseModel):
    id: int
    sucursal_id: int
    presentacion_id: int
    codigo_presentacion: str
    nombre_producto: str
    tipo_contenedor: str
    cantidad_disponible: Decimal
    cantidad_reservada: Decimal
    precio_unitario_vigente: Optional[Decimal] = None
    valor_total_disponible: Optional[Decimal] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventarioChoferResponse(BaseModel):
    id: int
    chofer_id: int
    chofer_nombre: Optional[str] = None
    sucursal_id: int
    presentacion_id: int
    codigo_presentacion: str
    nombre_producto: str
    tipo_contenedor: str
    cantidad_cargada: Decimal
    cantidad_vendida: Decimal
    cantidad_remanente: Decimal
    precio_vigente_carga: Decimal
    valor_remanente: Decimal
    fecha_carga: datetime

    model_config = ConfigDict(from_attributes=True)


class CargaChoferItem(BaseModel):
    presentacion_id: int
    cantidad: Decimal


class CargaChoferDTO(BaseModel):
    chofer_id: int
    sucursal_id: int
    items: List[CargaChoferItem]


class ItemReporteInventarioValorizado(BaseModel):
    presentacion_id: int
    codigo_presentacion: str
    nombre_producto: str
    tipo_contenedor: str
    unidades_por_paquete: Optional[int] = None
    cantidad_disponible: Decimal
    precio_unitario: Decimal
    subtotal_valorizado: Decimal


class ReporteInventarioValorizadoResponse(BaseModel):
    sucursal_id: int
    sucursal_nombre: str
    fecha_corte: datetime
    total_items: int
    valor_total_inventario: Decimal
    items: List[ItemReporteInventarioValorizado]
