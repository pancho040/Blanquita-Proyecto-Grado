"""
Modelos de Datos y DTOs para el Módulo Chofer Móvil (Fase 2)
Sistema ERP Papelera Blanquita
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, AliasChoices


class ItemEntregaDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    presentacion_id: int = Field(
        ...,
        gt=0,
        validation_alias=AliasChoices("presentacion_id", "id_presentacion", "id_producto", "IdPresentacion", "IdProducto")
    )
    cantidad: float = Field(..., gt=0, validation_alias=AliasChoices("cantidad", "Cantidad"))
    es_cortesia_bandeo: bool = Field(False, validation_alias=AliasChoices("es_cortesia_bandeo", "EsCortesiaBandeo"))


class TramoPagoDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    metodo: str = Field(
        ...,
        description="'EFECTIVO' | 'QR' | 'TRANSFERENCIA' | 'CREDITO'",
        validation_alias=AliasChoices("metodo", "Metodo", "metodo_pago", "MetodoPago")
    )
    monto: float = Field(..., gt=0, validation_alias=AliasChoices("monto", "Monto"))
    numero_referencia: Optional[str] = Field(None, validation_alias=AliasChoices("numero_referencia", "NumeroReferencia", "numeroReferencia"))
    id_comprobante_archivo: Optional[int] = Field(None, validation_alias=AliasChoices("id_comprobante_archivo", "IdComprobanteArchivo", "idComprobanteArchivo"))
    url_comprobante: Optional[str] = Field(None, validation_alias=AliasChoices("url_comprobante", "UrlComprobante", "urlComprobante"))


class BloqueCreditoDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    saldo: float = Field(0.0, ge=0, validation_alias=AliasChoices("saldo", "Saldo"))
    plazo_dias: Optional[int] = Field(15, ge=1, validation_alias=AliasChoices("plazo_dias", "PlazoDias", "plazoDias"))
    cuotas: Optional[int] = Field(1, ge=1, validation_alias=AliasChoices("cuotas", "Cuotas"))
    fecha_vencimiento: Optional[str] = Field(None, validation_alias=AliasChoices("fecha_vencimiento", "FechaVencimiento", "fechaVencimiento"))


class BloqueCobroEntregaDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    monto_total: Optional[float] = Field(None, ge=0, validation_alias=AliasChoices("monto_total", "MontoTotal", "montoTotal"))
    pagos: List[TramoPagoDTO] = Field(default_factory=list, validation_alias=AliasChoices("pagos", "Pagos"))
    credito: Optional[BloqueCreditoDTO] = Field(None, validation_alias=AliasChoices("credito", "Credito"))


class EntregaMovilRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id_pedido: int = Field(..., gt=0, validation_alias=AliasChoices("id_pedido", "IdPedido"))
    latitud: float = Field(..., validation_alias=AliasChoices("latitud", "LatitudEntrega"))
    longitud: float = Field(..., validation_alias=AliasChoices("longitud", "LongitudEntrega"))
    tipo_entrega: str = Field("TOTAL", description="'TOTAL' o 'PARCIAL'", validation_alias=AliasChoices("tipo_entrega", "TipoEntrega", "tipoEntrega"))
    items_entregados: Optional[List[ItemEntregaDTO]] = Field(None, validation_alias=AliasChoices("items_entregados", "ItemsEntregados", "itemsEntregados"))
    recibido_por: Optional[str] = Field("Cliente", validation_alias=AliasChoices("recibido_por", "RecibidoPor", "recibidoPor"))
    ci_receptor: Optional[str] = Field(None, validation_alias=AliasChoices("ci_receptor", "CiReceptor", "ciReceptor"))
    observacion: Optional[str] = Field(None, validation_alias=AliasChoices("observacion", "Observacion", "observaciones", "Observaciones"))
    firma_chofer: str = Field(..., min_length=5, description="Firma digital obligatoria del chofer (SVG path, base4 o URL)", validation_alias=AliasChoices("firma_chofer", "FirmaChofer", "firmaChofer"))
    firma_cliente: Optional[str] = Field(None, description="Firma digital del cliente o receptor", validation_alias=AliasChoices("firma_cliente", "FirmaCliente", "firmaCliente"))
    fecha_dispositivo: Optional[str] = Field(None, validation_alias=AliasChoices("fecha_dispositivo", "FechaDispositivo", "fechaDispositivo"))
    cobro: Optional[BloqueCobroEntregaDTO] = Field(None, validation_alias=AliasChoices("cobro", "Cobro"))


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
    sobrante_permanece_en_camion: bool = True
    valor_sobrante_revalorizado: Optional[float] = 0.0


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


# ==============================================================================
# Modelos para Carga de Camión, Sincronización y Cliente en Ruta
# ==============================================================================

class ItemSolicitudCargaDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    presentacion_id: int = Field(..., gt=0, validation_alias=AliasChoices("presentacion_id", "id_presentacion", "IdPresentacion"))
    cantidad_solicitada: float = Field(..., gt=0, validation_alias=AliasChoices("cantidad_solicitada", "cantidad", "CantidadSolicitada"))


class SolicitarCargaRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id_asignacion: int = Field(..., gt=0, validation_alias=AliasChoices("id_asignacion", "IdAsignacionRuta", "id_asignacion_ruta"))
    usar_remanente: bool = Field(False, validation_alias=AliasChoices("usar_remanente", "usarRemanente"))
    observacion: Optional[str] = Field(None, validation_alias=AliasChoices("observacion", "observaciones", "Observacion"))
    items: List[ItemSolicitudCargaDTO] = Field(default_factory=list, validation_alias=AliasChoices("items", "Items"))


class DatosClienteEnRutaDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    razon_social: str = Field(..., min_length=2, validation_alias=AliasChoices("razon_social", "RazonSocial"))
    nombre_comercial: Optional[str] = Field(None, validation_alias=AliasChoices("nombre_comercial", "NombreComercial"))
    nombre_propietario: Optional[str] = Field(None, validation_alias=AliasChoices("nombre_propietario", "NombrePropietario"))
    nit_ci: Optional[str] = Field(None, validation_alias=AliasChoices("nit_ci", "NitCi", "nit"))
    telefono: Optional[str] = Field(None, validation_alias=AliasChoices("telefono", "Telefono"))
    direccion: Optional[str] = Field(None, validation_alias=AliasChoices("direccion", "Direccion"))
    latitud: Optional[float] = Field(None, validation_alias=AliasChoices("latitud", "Latitud"))
    longitud: Optional[float] = Field(None, validation_alias=AliasChoices("longitud", "Longitud"))
    ciudad_destino: Optional[str] = Field("Sucre", validation_alias=AliasChoices("ciudad_destino", "CiudadDestino"))
    observacion: Optional[str] = Field(None, validation_alias=AliasChoices("observacion", "observaciones", "Observacion"))


class ItemProgramadoDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    presentacion_id: int = Field(..., gt=0)
    cantidad: float = Field(..., gt=0)


class ClienteEnRutaRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    datos_cliente: DatosClienteEnRutaDTO = Field(..., validation_alias=AliasChoices("datos_cliente", "datosCliente"))
    modalidad: str = Field(
        "SOLO_REGISTRO",
        description="'SOLO_REGISTRO' | 'PROGRAMAR_ENTREGA' | 'ENTREGA_INMEDIATA'",
        validation_alias=AliasChoices("modalidad", "Modalidad")
    )
    dia_semana_programado: Optional[int] = Field(None, ge=1, le=7, validation_alias=AliasChoices("dia_semana_programado", "diaSemanaProgramado"))
    items_programados: Optional[List[ItemProgramadoDTO]] = Field(default_factory=list, validation_alias=AliasChoices("items_programados", "itemsProgramados"))
    parada_actual_orden: Optional[int] = Field(0, ge=0, validation_alias=AliasChoices("parada_actual_orden", "paradaActualOrden"))
    entrega_con_cobro: Optional[EntregaMovilRequest] = Field(None, validation_alias=AliasChoices("entrega_con_cobro", "entregaConCobro"))


