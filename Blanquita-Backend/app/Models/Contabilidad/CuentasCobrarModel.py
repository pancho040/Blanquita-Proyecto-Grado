from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime, date

# --- Detalle de Nota de Venta ---
class DetalleNotaVentaItem(BaseModel):
    IdPresentacion: Optional[int] = None
    NombreProducto: str # 'MEGA 12R', 'Economico', 'LUX 6R', 'SERV 500X6', etc.
    Cantidad: float = Field(..., gt=0)
    PrecioUnitario: float = Field(0.0, ge=0)
    Subtotal: float = Field(0.0, ge=0)

class DetalleNotaVentaResponse(DetalleNotaVentaItem):
    IdDetalleNotaVenta: int
    IdNotaVenta: int

    class Config:
        from_attributes = True


# --- Nota de Venta (Venta por Camión / Despacho) ---
class NotaVentaCrear(BaseModel):
    NumeroNotaVenta: str # ej: '260801'
    NumeroNotaEntrega: Optional[str] = None # ej: '568'
    FechaVenta: date = Field(default_factory=date.today)
    IdCliente: Optional[int] = None
    ClienteNombreLibre: Optional[str] = None
    DestinoDepartamento: str = "Sucre"
    Chofer: Optional[str] = None
    PlacaCamion: Optional[str] = None
    CantidadCamiones: float = 1.0
    TotalVentaBruto: float = Field(..., ge=0)
    DescuentoBonificacion: float = Field(0.0, ge=0)
    Promocion: float = Field(0.0, ge=0)
    ImporteNeto: Optional[float] = None # Si es None se calcula TotalVentaBruto - Descuento - Promocion
    SaldoAnterior: float = 0.0
    EsCredito: bool = False
    Observacion: Optional[str] = None
    Detalles: List[DetalleNotaVentaItem] = []

class NotaVentaResponse(BaseModel):
    IdNotaVenta: int
    NumeroNotaVenta: str
    NumeroNotaEntrega: Optional[str] = None
    FechaVenta: date
    IdCliente: Optional[int] = None
    ClienteNombre: Optional[str] = None
    DestinoDepartamento: str
    Chofer: Optional[str] = None
    PlacaCamion: Optional[str] = None
    CantidadCamiones: float
    TotalVentaBruto: float
    DescuentoBonificacion: float
    Promocion: float
    ImporteNeto: float
    SaldoAnterior: float
    TotalCancelado: float
    SaldoPendiente: float
    EstadoCobranza: str
    Observacion: Optional[str] = None
    FechaRegistro: Optional[datetime] = None
    Detalles: List[DetalleNotaVentaResponse] = []

    class Config:
        from_attributes = True


# --- Abono / Pago a Cuenta por Cobrar ---
class AbonoCuentaCobrarCrear(BaseModel):
    IdCuentaCobrar: int
    IdNotaVenta: Optional[int] = None
    IdCuentaBancaria: Optional[int] = None
    IdMetodoPago: Optional[int] = 1 # Efectivo, Transferencia, QR, Dólar
    MontoAbonado: float = Field(..., gt=0)
    FechaAbono: datetime = Field(default_factory=datetime.now)
    BancoSigla: Optional[str] = None # 'BU', 'BNB', 'BMSC', 'CAJA'
    Depositante: Optional[str] = None # ej: 'Transf. Romero Quispe Luis Hector'
    Moneda: str = "BOB"
    MontoDolares: float = 0.0
    TipoCambio: float = 1.0
    NumeroReferencia: Optional[str] = None
    Observacion: Optional[str] = None

class AbonoCuentaCobrarResponse(BaseModel):
    IdAbonoCuentaCobrar: int
    IdCuentaCobrar: int
    IdNotaVenta: Optional[int] = None
    NumeroNotaVenta: Optional[str] = None
    IdCuentaBancaria: Optional[int] = None
    NombreBanco: Optional[str] = None
    IdMetodoPago: Optional[int] = None
    NombreMetodoPago: Optional[str] = None
    MontoAbonado: float
    FechaAbono: datetime
    BancoSigla: Optional[str] = None
    Depositante: Optional[str] = None
    Moneda: str
    MontoDolares: float
    TipoCambio: float
    NumeroReferencia: Optional[str] = None
    Observacion: Optional[str] = None

    class Config:
        from_attributes = True


# --- Cuenta por Cobrar (Ledger por Cliente) ---
class CuentaCobrarResponse(BaseModel):
    IdCuentaCobrar: int
    IdCliente: int
    RazonSocialCliente: Optional[str] = None
    CiudadDestino: Optional[str] = None
    IdNotaVenta: Optional[int] = None
    NumeroNotaVenta: Optional[str] = None
    NumeroNotaEntrega: Optional[str] = None
    FechaDespacho: Optional[date] = None
    MontoTotal: float
    SaldoPendiente: float
    DiasMora: int = 0
    IdEstadoCuentaCobrar: int
    NombreEstado: Optional[str] = None
    FechaEmision: date
    FechaVencimiento: Optional[date] = None
    Observacion: Optional[str] = None
    Abonos: List[AbonoCuentaCobrarResponse] = []

    class Config:
        from_attributes = True


# --- Resumen General de Cartera (Hoja CXC) ---
class ResumenCarteraCliente(BaseModel):
    IdCliente: int
    Distribuidor: str
    Departamento: str
    MontoDespachoTotal: float
    TotalDepositos: float
    SaldoPorCobrar: float
    DiasMoraPromedio: int
    Observacion: Optional[str] = None
