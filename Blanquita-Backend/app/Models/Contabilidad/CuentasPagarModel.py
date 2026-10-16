from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime, date

# --- Detalle de Insumo / Material Recibido ---
class DetalleInsumoItem(BaseModel):
    DescripcionInsumo: str # ej: '48 x 64 /40 - Mega. 2ª', 'Laminado LAM-950', 'Pegamento Colilla R200'
    MedidaOFormato: Optional[str] = None # ej: '47x77cm', 'Turril 200KG'
    Cantidad: float = 0.0
    PesoKgr: float = 0.0
    PrecioUnitario: float = 0.0
    Subtotal: float = 0.0

class DetalleInsumoResponse(DetalleInsumoItem):
    IdDetalleInsumo: int
    IdCuentaPagar: int

    class Config:
        from_attributes = True


# --- Pago a Proveedor ---
class PagoCuentaPagarCrear(BaseModel):
    IdCuentaPagar: int
    MontoPagado: float = Field(..., gt=0)
    FechaPago: date = Field(default_factory=date.today)
    IdCuentaBancaria: Optional[int] = None
    BancoSigla: Optional[str] = None # 'BU', 'BNB', 'CAJA'
    NumeroTransaccion: Optional[str] = None
    EsCompensacion: bool = False
    DetalleCompensacion: Optional[str] = None # ej: 'Compensado con la venta de rodelas antiguas'
    Observacion: Optional[str] = None

class PagoCuentaPagarResponse(BaseModel):
    IdPagoCuentaPagar: int
    IdCuentaPagar: int
    MontoPagado: float
    FechaPago: date
    IdCuentaBancaria: Optional[int] = None
    NombreBanco: Optional[str] = None
    BancoSigla: Optional[str] = None
    NumeroTransaccion: Optional[str] = None
    EsCompensacion: bool = False
    DetalleCompensacion: Optional[str] = None
    Observacion: Optional[str] = None
    FechaRegistro: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Cuenta por Pagar a Proveedor ---
class CuentaPagarCrear(BaseModel):
    IdProveedor: int
    FechaRecepcion: date = Field(default_factory=date.today)
    FechaEnvio: Optional[date] = None
    NumeroNota: Optional[str] = None # N° nota de entrega del proveedor
    NumeroFactura: Optional[str] = None # N° factura fiscal
    ConceptoMaterial: str # 'Material Bolsas', 'Pegamento', 'Bobinas Papel', 'Rodellas'
    PesoTotalKgr: float = 0.0
    CantidadUnidades: float = 0.0
    PrecioUnitario: float = 0.0
    Descuento: float = 0.0
    PrecioFacturado: float = Field(..., ge=0) # Total a pagar
    BancoPago: Optional[str] = None
    Observacion: Optional[str] = None
    DetallesInsumos: List[DetalleInsumoItem] = []

class CuentaPagarResponse(BaseModel):
    IdCuentaPagar: int
    IdProveedor: int
    NombreProveedor: Optional[str] = None
    FechaRecepcion: date
    FechaEnvio: Optional[date] = None
    NumeroNota: Optional[str] = None
    NumeroFactura: Optional[str] = None
    ConceptoMaterial: str
    PesoTotalKgr: float
    CantidadUnidades: float
    PrecioUnitario: float
    Descuento: float
    PrecioFacturado: float
    TotalPagado: float
    SaldoPendiente: float
    Estado: str # 'PENDIENTE', 'PARCIAL', 'PAGADO', 'COMPENSADO', 'ANULADO'
    FechaPago: Optional[date] = None
    BancoPago: Optional[str] = None
    Observacion: Optional[str] = None
    FechaRegistro: Optional[datetime] = None
    DetallesInsumos: List[DetalleInsumoResponse] = []
    Pagos: List[PagoCuentaPagarResponse] = []

    class Config:
        from_attributes = True


# --- Devolución a Proveedor ---
class DevolucionProveedorCrear(BaseModel):
    IdProveedor: int
    FechaDevolucion: date = Field(default_factory=date.today)
    ProductoMaterial: str # ej: 'Bolsas de Megarollo - Defectuoso'
    Motivo: Optional[str] = None
    TotalPesoKgr: float = 0.0
    TotalPaquetes: int = 0
    Observacion: Optional[str] = None

class DevolucionProveedorResponse(DevolucionProveedorCrear):
    IdDevolucionProveedor: int
    NombreProveedor: Optional[str] = None
    FechaRegistro: Optional[datetime] = None

    class Config:
        from_attributes = True
