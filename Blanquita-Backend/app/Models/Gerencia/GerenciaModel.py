from decimal import Decimal
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from datetime import datetime, date


class DocumentoEncontrado(BaseModel):
    tipo_documento: str # NOTA_VENTA | CAJA_CHICA | ABONO_CXC | PEDIDO_DISTRIBUIDOR | PLANILLA
    id_registro: int
    codigo: str
    titulo: str
    descripcion: Optional[str] = None
    monto: Decimal = Decimal("0.00")
    fecha: Optional[str] = None
    estado: str
    solicitante_o_cliente: Optional[str] = None
    sucursal: Optional[str] = None
    ruta_acceso: str
    detalles: Optional[Dict[str, Any]] = None


class BuscadorGlobalResponse(BaseModel):
    codigo_buscado: str
    coincidencia_exacta: bool
    total_encontrados: int
    documentos: List[DocumentoEncontrado]


class SaldoBancoItem(BaseModel):
    id_cuenta: int
    nombre_banco: str
    sigla: str
    numero_cuenta: str
    proposito: str
    saldo_actual: Decimal
    saldo_conciliado: Decimal
    diferencia: Decimal
    fecha_ultima_conciliacion: Optional[str] = None


class AlertaGerencialItem(BaseModel):
    tipo: str # PRECIO_MODIFICADO | NOTA_AJUSTADA | COBRANZA_ALERTA | CAJA_CHICA_PENDIENTE
    mensaje: str
    codigo_referencia: Optional[str] = None
    fecha: str
    severidad: str # INFO | WARNING | DANGER


class KPIsEjecutivosResponse(BaseModel):
    fecha_consulta: str
    ventas_hoy_monto: Decimal
    ventas_hoy_cantidad: int
    cuentas_cobrar_saldo_total: Decimal
    cuentas_cobrar_en_mora: Decimal
    vales_caja_chica_pendientes_cantidad: int
    vales_caja_chica_pendientes_monto: Decimal
    saldos_bancarios_total: Decimal
    bancos: List[SaldoBancoItem]
    alertas: List[AlertaGerencialItem]


class RegistrarFirmaSelloRequest(BaseModel):
    tipo_documento: str
    id_registro_documento: int
    codigo_referencia: Optional[str] = None
    url_foto_firma_sello: Optional[str] = None
    observaciones: Optional[str] = None


class FirmaSelloResponse(BaseModel):
    id_firma: int
    tipo_documento: str
    id_registro_documento: int
    codigo_referencia: Optional[str] = None
    url_foto_firma_sello: Optional[str] = None
    observaciones: Optional[str] = None
    fecha_firma: str
    firmado_por: str


class ConciliarBancoRequest(BaseModel):
    saldo_conciliado: Decimal
    observaciones: Optional[str] = None


class MateriaPrimaItem(BaseModel):
    categoria: str
    cantidad_unidades: int
    peso_o_medida: str
    costo_unitario_estimado: Decimal
    valor_total_estimado: Decimal


class ProductoTerminadoItem(BaseModel):
    producto_nombre: str
    presentacion_codigo: str
    tipo_contenedor: str
    stock_paquetes: Decimal
    precio_referencial: Decimal
    valor_total_estimado: Decimal


class ReporteConsolidadoPlantaResponse(BaseModel):
    fecha_corte: str
    total_valor_inventario_planta: Decimal
    total_materias_primas_valor: Decimal
    total_producto_terminado_valor: Decimal
    materias_primas: List[MateriaPrimaItem]
    producto_terminado: List[ProductoTerminadoItem]
    nota_auditoria: str
