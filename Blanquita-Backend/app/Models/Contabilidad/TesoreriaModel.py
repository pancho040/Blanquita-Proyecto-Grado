from typing import Optional, List
from pydantic import BaseModel, Field, AliasChoices, ConfigDict
from datetime import datetime, date, time

# --- Cuentas Bancarias de la Empresa ---
class CuentaBancariaBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    NombreBanco: str = Field(..., validation_alias=AliasChoices("NombreBanco", "nombre_banco"))
    Sigla: Optional[str] = Field(None, validation_alias=AliasChoices("Sigla", "sigla"))
    NumeroCuenta: Optional[str] = Field(None, validation_alias=AliasChoices("NumeroCuenta", "numero_cuenta"))
    TipoCuenta: str = Field("Cuenta Corriente", validation_alias=AliasChoices("TipoCuenta", "tipo_cuenta"))
    Moneda: str = Field("BOB", validation_alias=AliasChoices("Moneda", "tipo_moneda", "moneda"))
    SaldoActual: float = Field(0.0, validation_alias=AliasChoices("SaldoActual", "saldo_actual"))
    Activa: bool = Field(True, validation_alias=AliasChoices("Activa", "activa", "Activo"))
    Titular: Optional[str] = Field("Shema Asociados S.R.L.", validation_alias=AliasChoices("Titular", "titular"))

class CuentaBancariaCrear(CuentaBancariaBase):
    pass

class CuentaBancariaActualizar(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    NombreBanco: Optional[str] = Field(None, validation_alias=AliasChoices("NombreBanco", "nombre_banco"))
    NumeroCuenta: Optional[str] = Field(None, validation_alias=AliasChoices("NumeroCuenta", "numero_cuenta"))
    TipoCuenta: Optional[str] = Field(None, validation_alias=AliasChoices("TipoCuenta", "tipo_cuenta"))
    SaldoActual: Optional[float] = Field(None, validation_alias=AliasChoices("SaldoActual", "saldo_actual"))
    Activa: Optional[bool] = Field(None, validation_alias=AliasChoices("Activa", "activa"))
    Titular: Optional[str] = Field(None, validation_alias=AliasChoices("Titular", "titular"))

class CuentaBancariaResponse(CuentaBancariaBase):
    IdCuentaBancaria: int
    FechaCreacion: Optional[datetime] = None

    @property
    def TipoMoneda(self) -> str:
        return self.Moneda

    @property
    def Activo(self) -> bool:
        return self.Activa


# --- Arqueo de Caja y Desglose de Cortes ---
class ArqueoCorteItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    TipoEfectivo: str = Field("Billete", validation_alias=AliasChoices("TipoEfectivo", "tipo_efectivo", "tipo_corte"))
    Corte: float = Field(..., validation_alias=AliasChoices("Corte", "corte", "denominacion"))
    Cantidad: int = Field(..., ge=0, validation_alias=AliasChoices("Cantidad", "cantidad"))

class ArqueoCorteResponse(ArqueoCorteItem):
    IdArqueoCajaDetalle: Optional[int] = None
    IdAperturaCierreCaja: Optional[int] = None
    Subtotal: Optional[float] = None


# --- Apertura y Cierre de Caja ---
class AperturaCajaCrear(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    IdCaja: int = Field(1, validation_alias=AliasChoices("IdCaja", "id_caja"))
    SaldoInicial: float = Field(0.0, ge=0, validation_alias=AliasChoices("SaldoInicial", "saldo_inicial"))
    Observacion: Optional[str] = Field(None, validation_alias=AliasChoices("Observacion", "observacion", "observaciones_apertura"))

class CierreCajaCrear(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    SaldoReal: float = Field(..., ge=0, validation_alias=AliasChoices("SaldoReal", "saldo_real", "saldo_final_real"))
    NumeroArqueo: Optional[str] = Field(None, validation_alias=AliasChoices("NumeroArqueo", "numero_arqueo"))
    HoraInicio: Optional[time] = None
    HoraTermino: Optional[time] = None
    Observacion: Optional[str] = Field(None, validation_alias=AliasChoices("Observacion", "observacion", "observaciones_cierre"))
    DesgloseCortes: List[ArqueoCorteItem] = Field(default_factory=list, validation_alias=AliasChoices("DesgloseCortes", "desglose_cortes", "arqueo_detalle"))
    AutorizadoPorContador: Optional[bool] = Field(False, validation_alias=AliasChoices("AutorizadoPorContador", "autorizado_contador"))
    JustificativoDiferencia: Optional[str] = Field(None, validation_alias=AliasChoices("JustificativoDiferencia", "justificativo_diferencia"))

class AperturaCierreCajaResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    IdAperturaCierreCaja: int
    IdCaja: int
    NombreCaja: Optional[str] = None
    IdUsuarioApertura: int
    NombreUsuarioApertura: Optional[str] = None
    IdUsuarioCierre: Optional[int] = None
    NombreUsuarioCierre: Optional[str] = None
    IdEstadoAperturaCaja: int
    NombreEstado: Optional[str] = None
    FechaApertura: datetime
    SaldoInicial: float
    FechaCierre: Optional[datetime] = None
    SaldoTeorico: Optional[float] = None
    SaldoReal: Optional[float] = None
    Diferencia: Optional[float] = None
    NumeroArqueo: Optional[str] = None
    HoraInicio: Optional[time] = None
    HoraTermino: Optional[time] = None
    Observacion: Optional[str] = None
    TotalIngresos: Optional[float] = 0.0
    TotalEgresos: Optional[float] = 0.0
    DesgloseCortes: List[ArqueoCorteResponse] = []

    # Compatibilidad con camelCase / snake_case
    @property
    def IdAperturaCierre(self) -> int:
        return self.IdAperturaCierreCaja

    @property
    def SaldoFinalTeorico(self) -> float:
        return self.SaldoTeorico or self.SaldoInicial

    @property
    def SaldoFinalReal(self) -> Optional[float]:
        return self.SaldoReal

    @property
    def Estado(self) -> str:
        return self.NombreEstado or ("Abierta" if self.FechaCierre is None else "Cerrada")


# --- Categorías de Movimiento de Caja ---
class CategoriaMovimientoResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    IdCategoriaMovimientoCaja: int
    NombreCategoria: str
    TipoMovimiento: str
    Descripcion: Optional[str] = None

    @property
    def IdCategoria(self) -> int:
        return self.IdCategoriaMovimientoCaja

    @property
    def Tipo(self) -> str:
        return self.TipoMovimiento


# --- Movimiento de Caja ---
class MovimientoCajaCrear(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    IdAperturaCierreCaja: Optional[int] = Field(None, validation_alias=AliasChoices("IdAperturaCierreCaja", "id_apertura_cierre", "id_apertura"))
    IdCategoriaMovimientoCaja: int = Field(..., validation_alias=AliasChoices("IdCategoriaMovimientoCaja", "id_categoria"))
    Monto: float = Field(..., gt=0, validation_alias=AliasChoices("Monto", "monto"))
    MetodoPago: str = Field("Efectivo", validation_alias=AliasChoices("MetodoPago", "metodo_pago"))
    NumeroReferencia: Optional[str] = Field(None, validation_alias=AliasChoices("NumeroReferencia", "numero_referencia", "numero_comprobante", "respaldo"))
    NotaCodigo: Optional[str] = None
    Solicitante: Optional[str] = Field(None, validation_alias=AliasChoices("Solicitante", "beneficiario", "solicitante"))
    Respaldo: Optional[str] = Field(None, validation_alias=AliasChoices("Respaldo", "respaldo", "numero_comprobante"))
    IdCuentaBancaria: Optional[int] = Field(None, validation_alias=AliasChoices("IdCuentaBancaria", "id_cuenta_bancaria"))
    Descripcion: Optional[str] = Field(None, validation_alias=AliasChoices("Descripcion", "glosa", "descripcion"))
    Tipo: Optional[str] = Field(None, validation_alias=AliasChoices("Tipo", "tipo"))

class MovimientoCajaResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    IdMovimientoCaja: int
    IdAperturaCierreCaja: Optional[int] = None
    IdCategoriaMovimientoCaja: int
    NombreCategoria: Optional[str] = None
    TipoMovimiento: Optional[str] = None
    IdUsuario: Optional[int] = None
    NombreUsuario: Optional[str] = None
    Monto: float
    MetodoPago: str
    NumeroReferencia: Optional[str] = None
    FechaMovimiento: datetime
    NotaCodigo: Optional[str] = None
    Solicitante: Optional[str] = None
    Respaldo: Optional[str] = None
    IdCuentaBancaria: Optional[int] = None
    NombreBanco: Optional[str] = None
    Descripcion: Optional[str] = None
    Anulado: bool = False

    @property
    def IdMovimiento(self) -> int:
        return self.IdMovimientoCaja

    @property
    def Tipo(self) -> str:
        return self.TipoMovimiento or "Ingreso"

    @property
    def Beneficiario(self) -> Optional[str]:
        return self.Solicitante

    @property
    def Glosa(self) -> Optional[str]:
        return self.Descripcion or self.Respaldo

    @property
    def NumeroComprobante(self) -> Optional[str]:
        return self.NumeroReferencia or self.NotaCodigo


# --- Solicitud de Caja Chica ---
class SolicitudCajaChicaCrear(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    CodigoSolicitud: Optional[str] = None
    IdCaja: int = 1
    FechaSolicitud: date = Field(default_factory=date.today)
    NombreSolicitante: str = Field(..., validation_alias=AliasChoices("NombreSolicitante", "solicitante"))
    CargoSolicitante: Optional[str] = Field("Producción", validation_alias=AliasChoices("CargoSolicitante", "departamento"))
    MontoSolicitado: float = Field(..., gt=0, validation_alias=AliasChoices("MontoSolicitado", "monto_solicitado"))
    DestinoJustificacion: str = Field(..., validation_alias=AliasChoices("DestinoJustificacion", "justificacion"))
    NombreEntregadoPor: Optional[str] = None
    NombreAprobadoPor: str = "GERENCIA GENERAL"
    IdCategoriaMovimientoCaja: Optional[int] = None
    RespaldoDoc: Optional[str] = None

class SolicitudCajaChicaActualizarEstado(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    Estado: str = Field(..., description="'Pendiente', 'Aprobada', 'Rendida', 'Rechazada'")
    RespaldoDoc: Optional[str] = None
    GenerarMovimientoCaja: bool = False
    MontoAprobado: Optional[float] = None
    MontoGastado: Optional[float] = None
    DetalleDescargo: Optional[str] = None
    MotivoRechazo: Optional[str] = None

class SolicitudCajaChicaResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    IdSolicitudCajaChica: int
    CodigoSolicitud: str
    IdCaja: int
    NombreCaja: Optional[str] = None
    FechaSolicitud: date
    NombreSolicitante: str
    CargoSolicitante: Optional[str] = None
    MontoSolicitado: float
    DestinoJustificacion: str
    NombreEntregadoPor: Optional[str] = None
    NombreAprobadoPor: Optional[str] = None
    Estado: str
    IdCategoriaMovimientoCaja: Optional[int] = None
    NombreCategoria: Optional[str] = None
    RespaldoDoc: Optional[str] = None
    IdMovimientoCaja: Optional[int] = None
    FechaRegistro: Optional[datetime] = None
    MontoGastado: Optional[float] = None

    @property
    def IdSolicitud(self) -> int:
        return self.IdSolicitudCajaChica

    @property
    def NumeroSolicitud(self) -> str:
        return self.CodigoSolicitud

    @property
    def Solicitante(self) -> str:
        return self.NombreSolicitante

    @property
    def Departamento(self) -> Optional[str]:
        return self.CargoSolicitante

    @property
    def Justificacion(self) -> str:
        return self.DestinoJustificacion
