from typing import Optional, List, Dict
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, date

# --- Detalle de Nota de Venta ---
class DetalleNotaVentaItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    IdPresentacion: Optional[int] = None
    NombreProducto: str # 'MEGA 12R', 'Economico', 'LUX 6R', 'SERV 500X6', etc.
    Cantidad: float = Field(..., gt=0)
    PrecioUnitario: float = Field(0.0, ge=0)
    Subtotal: float = Field(0.0, ge=0)
    EsBonificacionBandeo: bool = False

class DetalleNotaVentaResponse(DetalleNotaVentaItem):
    IdDetalleNotaVenta: int
    IdNotaVenta: int


# --- Nota de Venta (Venta por Camión / Despacho) ---
class NotaVentaCrear(BaseModel):
    NumeroNotaVenta: str # ej: 'NV-501', '260801'
    NumeroNotaEntrega: Optional[str] = None
    FechaVenta: date = Field(default_factory=date.today)
    IdCliente: Optional[int] = None
    ClienteNombreLibre: Optional[str] = None
    DestinoDepartamento: str = "Sucre"
    IdChofer: Optional[int] = None
    Chofer: Optional[str] = None
    PlacaCamion: Optional[str] = None
    CantidadCamiones: float = 1.0
    TotalVentaBruto: float = Field(..., ge=0)
    DescuentoBonificacion: float = Field(0.0, ge=0)
    Promocion: float = Field(0.0, ge=0)
    ImporteNeto: Optional[float] = None # Si es None se calcula TotalVentaBruto - Descuento - Promocion
    SaldoAnterior: float = 0.0
    EsCredito: bool = False
    IdSucursal: int = 1
    MetodoPago: str = "Efectivo" # 'Efectivo', 'QR', 'Credito', 'Mixto'
    MontoEfectivo: float = Field(0.0, ge=0)
    MontoQR: float = Field(0.0, ge=0)
    MontoCredito: float = Field(0.0, ge=0)
    ComprobanteQRArchivoId: Optional[int] = None
    FirmaDigitalUrl: Optional[str] = None
    FirmaNombre: Optional[str] = None
    FirmaCi: Optional[str] = None
    Observacion: Optional[str] = None
    Detalles: List[DetalleNotaVentaItem] = []

class NotaVentaAjustarKevin(BaseModel):
    ObservacionAjuste: str
    NuevoImporteNeto: Optional[float] = None
    NuevoTotalCancelado: Optional[float] = None
    NuevoSaldoPendiente: Optional[float] = None

class NotaVentaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    IdNotaVenta: int
    NumeroNotaVenta: str
    NumeroNotaEntrega: Optional[str] = None
    FechaVenta: date
    IdCliente: Optional[int] = None
    ClienteNombre: Optional[str] = None
    DestinoDepartamento: str
    IdChofer: Optional[int] = None
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
    IdSucursal: Optional[int] = 1
    MetodoPago: Optional[str] = "Efectivo"
    MontoEfectivo: float = 0.0
    MontoQR: float = 0.0
    MontoCredito: float = 0.0
    ComprobanteQRArchivoId: Optional[int] = None
    FirmaDigitalUrl: Optional[str] = None
    FirmaNombre: Optional[str] = None
    FirmaCi: Optional[str] = None
    EditadoPorKevin: bool = False
    ObservacionAjuste: Optional[str] = None
    Observacion: Optional[str] = None
    FechaRegistro: Optional[datetime] = None
    Detalles: List[DetalleNotaVentaResponse] = []


# --- Cierre de Turno y Rendición Diaria de Chofer ---
class CierreTurnoChoferRequest(BaseModel):
    IdUsuarioRepartidor: int
    IdSucursal: int = 1
    IdAsignacionRuta: Optional[int] = None
    StockDevueltoFisico: Dict[int, float] = {} # presentacion_id -> cantidad física devuelta
    MontoEfectivoEntregado: float = Field(0.0, ge=0)
    MontoTransferenciaReportada: float = Field(0.0, ge=0)
    MontoQrReportado: float = Field(0.0, ge=0)
    Observaciones: Optional[str] = None

class CierreTurnoItemComparativa(BaseModel):
    presentacion_id: int
    producto_nombre: str
    cargado: float
    vendido: float
    devuelto_esperado: float
    devuelto_fisico: float
    diferencia: float # negativa = faltante
    es_faltante: bool

class CierreTurnoResponse(BaseModel):
    IdRendicionRuta: int
    IdUsuarioRepartidor: int
    FechaRendicion: datetime
    TotalVentasBs: float
    MontoEfectivoEntregado: float
    DiferenciaEfectivo: float
    CantidadTotalMerma: float
    MontoTotalFaltante: float
    EstadoConciliacion: str # 'CONCILIADO', 'CON_DIFERENCIA'
    ComparativaStock: List[CierreTurnoItemComparativa]
    ObservacionesCierre: Optional[str] = None


# --- Abono / Pago a Cuenta por Cobrar ---
class AbonoCuentaCobrarCrear(BaseModel):
    IdCuentaCobrar: int
    IdNotaVenta: Optional[int] = None
    IdCuentaBancaria: Optional[int] = None
    IdMetodoPago: Optional[int] = 1 # 1: Efectivo, 2: QR, etc.
    MetodoPago: Optional[str] = "Efectivo" # 'Efectivo', 'QR', 'Transferencia'
    MontoAbonado: float = Field(..., gt=0)
    FechaAbono: datetime = Field(default_factory=datetime.now)
    BancoSigla: Optional[str] = None
    Depositante: Optional[str] = None
    Moneda: str = "BOB"
    MontoDolares: float = 0.0
    TipoCambio: float = 1.0
    NumeroReferencia: Optional[str] = None
    IdComprobanteArchivo: Optional[int] = None
    Observacion: Optional[str] = None

class AbonoAprobarRechazarRequest(BaseModel):
    Aprobado: bool
    Observacion: Optional[str] = None

class PlanillaAbonoFila(BaseModel):
    IdCuentaCobrar: Optional[int] = None
    NumeroNotaVenta: Optional[str] = None
    MontoAbonado: float = Field(..., gt=0)
    BancoSigla: Optional[str] = "BU"
    NumeroReferencia: Optional[str] = None
    Depositante: Optional[str] = None

class PlanillaAbonosMasivosRequest(BaseModel):
    Abonos: List[PlanillaAbonoFila]

class AbonoCuentaCobrarResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    IdAbonoCuentaCobrar: int
    IdCuentaCobrar: int
    IdNotaVenta: Optional[int] = None
    NumeroNotaVenta: Optional[str] = None
    IdCuentaBancaria: Optional[int] = None
    NombreBanco: Optional[str] = None
    IdMetodoPago: Optional[int] = None
    NombreMetodoPago: Optional[str] = None
    MetodoPago: Optional[str] = "Efectivo"
    MontoAbonado: float
    FechaAbono: datetime
    BancoSigla: Optional[str] = None
    Depositante: Optional[str] = None
    Moneda: str = "BOB"
    MontoDolares: float = 0.0
    TipoCambio: float = 1.0
    NumeroReferencia: Optional[str] = None
    EstadoAprobacion: str = "PENDIENTE_APROBACION"
    AprobadoPor: Optional[int] = None
    FechaAprobacion: Optional[datetime] = None
    IdComprobanteArchivo: Optional[int] = None
    UrlComprobante: Optional[str] = None
    Observacion: Optional[str] = None


# --- Cuenta por Cobrar (Ledger por Cliente) ---
class CuentaCobrarResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
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
    EstadoCobranza: str = "VIGENTE"
    FechaEmision: date
    FechaVencimiento: Optional[date] = None
    IdSucursal: Optional[int] = 1
    Observacion: Optional[str] = None
    Abonos: List[AbonoCuentaCobrarResponse] = []


# --- Resumen General de Cartera (Hoja CXC) ---
class ResumenCarteraCliente(BaseModel):
    IdCliente: int
    Distribuidor: str
    Departamento: str
    MontoDespachoTotal: float
    TotalDepositos: float
    SaldoPorCobrar: float
    DiasMoraPromedio: int
    EstadoAlertaMora: str = "AL_DIA" # 'AL_DIA', 'EN_MORA', 'MORA_CRITICA'
    Observacion: Optional[str] = None
