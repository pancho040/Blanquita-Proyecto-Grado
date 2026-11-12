"""
Modelos de Datos y DTOs para el Módulo Chofer Móvil (Fase 2)
Sistema ERP Papelera Blanquita
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, AliasChoices


class ItemEntregaDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    presentacion_id: int = Field(..., gt=0)
    cantidad: float = Field(..., gt=0)
    es_cortesia_bandeo: bool = False


class EntregaMovilRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id_pedido: int = Field(..., gt=0, validation_alias=AliasChoices("id_pedido", "IdPedido"))
    latitud: float = Field(..., validation_alias=AliasChoices("latitud", "LatitudEntrega"))
    longitud: float = Field(..., validation_alias=AliasChoices("longitud", "LongitudEntrega"))
    tipo_entrega: str = Field("TOTAL", description="'TOTAL' o 'PARCIAL'")
    items_entregados: Optional[List[ItemEntregaDTO]] = None
    recibido_por: Optional[str] = Field("Cliente", validation_alias=AliasChoices("recibido_por", "RecibidoPor"))
    ci_receptor: Optional[str] = Field(None, validation_alias=AliasChoices("ci_receptor", "CiReceptor"))
    observacion: Optional[str] = Field(None, validation_alias=AliasChoices("observacion", "Observacion"))
    firma_chofer: str = Field(..., min_length=5, description="Firma digital obligatoria del chofer (SVG path, base64 o URL)")
    firma_cliente: str = Field(..., min_length=5, description="Firma digital obligatoria del cliente o receptor")
    fecha_dispositivo: Optional[str] = None


class TramoPagoDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    metodo: str = Field(..., description="'EFECTIVO' | 'QR' | 'TRANSFERENCIA' | 'CREDITO'")
    monto: float = Field(..., gt=0)
    numero_referencia: Optional[str] = None
    id_comprobante_archivo: Optional[int] = None
    url_comprobante: Optional[str] = None


class CobroMovilRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id_pedido: int = Field(..., gt=0, validation_alias=AliasChoices("id_pedido", "IdPedido"))
    monto_total: float = Field(..., gt=0, validation_alias=AliasChoices("monto_total", "Monto"))
    latitud: float = Field(..., validation_alias=AliasChoices("latitud", "LatitudCobro"))
    longitud: float = Field(..., validation_alias=AliasChoices("longitud", "LongitudCobro"))
    pagos: List[TramoPagoDTO] = Field(..., min_length=1, description="Desglose de tramos de pago simples o mixtos")
    observacion: Optional[str] = Field(None, validation_alias=AliasChoices("observacion", "Observacion"))
    fecha_dispositivo: Optional[str] = None


class NoEntregaMovilRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id_pedido: int = Field(..., gt=0, validation_alias=AliasChoices("id_pedido", "IdPedido"))
    motivo: str = Field(..., description="Motivo de la no entrega")
    latitud: float = Field(..., validation_alias=AliasChoices("latitud", "Latitud"))
    longitud: float = Field(..., validation_alias=AliasChoices("longitud", "Longitud"))
    observacion: Optional[str] = None
    id_comprobante_archivo: Optional[int] = None
    fecha_dispositivo: Optional[str] = None


class ItemStockDevueltoDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    presentacion_id: int = Field(..., gt=0)
    cantidad_devuelta: float = Field(..., ge=0)


class MermaDeclaradaDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    presentacion_id: int = Field(..., gt=0)
    cantidad_merma: float = Field(..., gt=0)
    motivo: str
    imputable_chofer: bool = False


class CierreTurnoMovilRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id_asignacion: int = Field(..., gt=0)
    monto_efectivo_entregado: float = Field(..., ge=0)
    monto_qr_reportado: float = Field(..., ge=0)
    monto_transferencia_reportada: float = Field(..., ge=0)
    monto_credito_reportado: float = Field(0.0, ge=0)
    stock_devuelto: List[ItemStockDevueltoDTO] = Field(default_factory=list)
    mermas_declaradas: Optional[List[MermaDeclaradaDTO]] = Field(default_factory=list)
    firma_chofer: str = Field(..., min_length=5, description="Firma digital obligatoria de conformidad")
    observaciones: Optional[str] = None


class ItemInventarioCamionDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    presentacion_id: int
    nombre_producto: str
    codigo_presentacion: str
    tipo_contenedor: str
    cantidad_cargada: float
    cantidad_vendida: float
    cantidad_remanente: float
    precio_vigente_carga: float
    valor_remanente: float
    precio_vigente_actual: float = 0.0
    diferencia_revalorizacion_bs: float = 0.0
    valor_remanente_revalorizado: float = 0.0
    es_bandeo: bool = False
    valor_bandeo: int = 0
    cortesia_bandeo_descripcion: Optional[str] = None


class ResumenInventarioChoferDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    chofer_id: int
    sucursal_id: int
    total_bultos_cargados: float
    total_bultos_entregados: float
    total_saldo_camion: float
    valor_total_camion_bs: float
    valor_total_revalorizado_bs: float = 0.0
    ajuste_revalorizacion_total_bs: float = 0.0
    items: List[ItemInventarioCamionDTO]


class ClienteMovilRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    razon_social: str = Field(..., min_length=2, validation_alias=AliasChoices("razon_social", "RazonSocial"))
    nombre_comercial: Optional[str] = Field(None, validation_alias=AliasChoices("nombre_comercial", "NombreComercial"))
    nombre_propietario: Optional[str] = Field(None, validation_alias=AliasChoices("nombre_propietario", "NombrePropietario"))
    nit_ci: Optional[str] = Field(None, validation_alias=AliasChoices("nit_ci", "NitCi", "nit"))
    telefono: Optional[str] = Field(None, validation_alias=AliasChoices("telefono", "Telefono"))
    direccion: str = Field(..., min_length=3, validation_alias=AliasChoices("direccion", "Direccion"))
    zona: Optional[str] = None
    tipo_negocio: Optional[str] = "TIENDA_BARRIO"
    observaciones: Optional[str] = None
    latitud: float = Field(..., validation_alias=AliasChoices("latitud", "Latitud"))
    longitud: float = Field(..., validation_alias=AliasChoices("longitud", "Longitud"))

