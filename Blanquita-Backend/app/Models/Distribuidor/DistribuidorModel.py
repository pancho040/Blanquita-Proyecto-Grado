from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class DistribuidorBase(BaseModel):
    nombre_comercial: str
    contacto_nombre: str
    telefono: Optional[str] = None
    ciudad: str # Oruro, Tarija, La Paz, Tupiza
    nit_ci: Optional[str] = None
    direccion: Optional[str] = None

class DistribuidorCrear(DistribuidorBase):
    id_usuario: Optional[int] = None

class DistribuidorResponse(DistribuidorBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    id_usuario: Optional[int] = None
    activo: bool = True
    created_at: datetime


class DetallePedidoItem(BaseModel):
    presentacion_id: int
    cantidad_solicitada: float = Field(..., gt=0)

class DetallePedidoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    pedido_id: int
    presentacion_id: int
    nombre_producto: Optional[str] = None
    cantidad_solicitada: float
    cantidad_aprobada: Optional[float] = None
    precio_unitario: float
    subtotal: float


class PedidoDistribuidorCrear(BaseModel):
    distribuidor_id: int
    observacion_distribuidor: Optional[str] = None
    detalles: List[DetallePedidoItem] = []

class AjustePedidoDetalle(BaseModel):
    detalle_id: int
    cantidad_aprobada: float = Field(..., ge=0)

class AjustePedidoKevinRequest(BaseModel):
    detalles_ajuste: List[AjustePedidoDetalle] = []
    observacion_kevin: Optional[str] = None

class SubirBoletaPagoRequest(BaseModel):
    id_comprobante_archivo: int

class PedidoDistribuidorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    codigo_pedido: str
    distribuidor_id: int
    nombre_distribuidor: Optional[str] = None
    ciudad: Optional[str] = None
    fecha_pedido: datetime
    estado: str # PENDIENTE_REVISION, PROFORMA_AJUSTADA, COMPROBANTE_SUBIDO, APROBADO_DESPACHO, DESPACHADO, RECHAZADO
    monto_total: float
    id_comprobante_archivo: Optional[int] = None
    url_comprobante: Optional[str] = None
    observacion_kevin: Optional[str] = None
    observacion_distribuidor: Optional[str] = None
    fecha_aprobacion: Optional[datetime] = None
    created_at: datetime
    detalles: List[DetallePedidoResponse] = []
