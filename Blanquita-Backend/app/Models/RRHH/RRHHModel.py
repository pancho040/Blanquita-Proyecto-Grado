from pydantic import BaseModel, Field
from datetime import date, time, datetime
from decimal import Decimal
from typing import Optional, List

# =============================================================================
# MODELOS EMPLEADOS Y DATOS LABORALES
# =============================================================================
class EmpleadoActualizar(BaseModel):
    PrimerNombre: Optional[str] = None
    SegundoNombre: Optional[str] = None
    ApellidoPaterno: Optional[str] = None
    ApellidoMaterno: Optional[str] = None
    Celular: Optional[str] = None
    Cargo: Optional[str] = None
    Area: Optional[str] = None
    SueldoBasico: Optional[Decimal] = None
    FechaIngreso: Optional[date] = None
    PorcentajeComisionDefault: Optional[Decimal] = None
    CuentaBancaria: Optional[str] = None
    Banco: Optional[str] = None
    Activo: Optional[bool] = None

class EmpleadoResponse(BaseModel):
    IdUsuario: int
    Ci: str
    PrimerNombre: str
    SegundoNombre: Optional[str] = None
    ApellidoPaterno: str
    ApellidoMaterno: Optional[str] = None
    NombreCompleto: str
    Celular: Optional[str] = None
    IdRol: int
    NombreRol: Optional[str] = None
    Cargo: Optional[str] = None
    Area: Optional[str] = "Rebobinado"
    SueldoBasico: Decimal = Decimal("0.00")
    FechaIngreso: Optional[date] = None
    PorcentajeComisionDefault: Decimal = Decimal("0.00")
    CuentaBancaria: Optional[str] = None
    Banco: Optional[str] = None
    Activo: bool = True
    IsAdmin: bool = False

# =============================================================================
# MODELOS TURNOS Y HORARIOS
# =============================================================================
class TurnoCrear(BaseModel):
    NombreTurno: str = Field(..., min_length=2, max_length=100)
    HoraInicio: str = Field(..., description="Formato HH:MM:SS o HH:MM")
    HoraFin: str = Field(..., description="Formato HH:MM:SS o HH:MM")
    Area: Optional[str] = "General"
    Color: Optional[str] = "#20A7DB"
    DescripcionTurno: Optional[str] = None

class TurnoActualizar(BaseModel):
    NombreTurno: Optional[str] = None
    HoraInicio: Optional[str] = None
    HoraFin: Optional[str] = None
    Area: Optional[str] = None
    Color: Optional[str] = None
    DescripcionTurno: Optional[str] = None

class TurnoResponse(BaseModel):
    IdTurno: int
    NombreTurno: str
    HoraInicio: str
    HoraFin: str
    Area: Optional[str] = "General"
    Color: Optional[str] = "#20A7DB"
    DescripcionTurno: Optional[str] = None

# =============================================================================
# CRONOGRAMA DE TURNOS (ASIGNACIÓN)
# =============================================================================
class AsignacionTurnoCrear(BaseModel):
    IdUsuario: int
    IdTurno: int
    Fecha: date
    Area: Optional[str] = None
    Observacion: Optional[str] = None

class AsignacionTurnoBatch(BaseModel):
    Asignaciones: List[AsignacionTurnoCrear]

# =============================================================================
# MARCAS BIOMÉTRICAS Y ASISTENCIA
# =============================================================================
class MarcaBiometricaCrear(BaseModel):
    IdUsuario: int
    FechaHoraMarca: datetime
    TipoMarca: str = Field(..., pattern="^(Entrada|Salida)$")
    OrigenDatos: Optional[str] = "Manual"
    IdDispositivo: Optional[str] = "NG-ECO-01"

class ImportacionBiometricoItem(BaseModel):
    CodigoUsuario: Optional[str] = Field(None, description="AC-No, UserID o CI del biometrico")
    Identificador: Optional[str] = Field(None, description="Alias para CodigoUsuario")
    FechaHora: str = Field(..., description="YYYY-MM-DD HH:MM:SS")
    Estado: Optional[str] = Field("Auto", description="Entrada, Salida o Auto")
    Tipo: Optional[str] = Field(None, description="Alias para Estado")
    Dispositivo: Optional[str] = "NG-ECO-01"
    IdDispositivo: Optional[str] = Field(None, description="Alias para Dispositivo")

class ImportacionBiometricoRequest(BaseModel):
    Marcas: List[ImportacionBiometricoItem]

class AsistenciaDiariaActualizar(BaseModel):
    IdTurno: Optional[int] = None
    HoraEntrada: Optional[str] = None
    HoraSalida: Optional[str] = None
    MinutosAtraso: Optional[int] = None
    HorasExtraTrabajadas: Optional[Decimal] = None
    EsFalta: Optional[bool] = None
    FaltaJustificada: Optional[bool] = None
    Observacion: Optional[str] = None

# =============================================================================
# CONFIGURACIÓN LABORAL
# =============================================================================
class ConfiguracionLaboralActualizar(BaseModel):
    Valor: Decimal
    Descripcion: Optional[str] = None

class ConfiguracionLaboralResponse(BaseModel):
    IdConfiguracionLaboral: int
    Parametro: str
    Valor: Decimal
    Descripcion: Optional[str] = None
    FechaActualizacion: datetime

# =============================================================================
# PLANILLAS DE SUELDOS Y PAGOS
# =============================================================================
class PeriodoNominaCrear(BaseModel):
    Mes: int = Field(..., ge=1, le=12)
    Anio: int = Field(..., ge=2020, le=2100)
    FechaInicio: date
    FechaFin: date

class PeriodoNominaResponse(BaseModel):
    IdPeriodoNomina: int
    Mes: int
    Anio: int
    FechaInicio: date
    FechaFin: date
    Cerrado: bool
    NombrePeriodo: str

class PlanillaGenerarRequest(BaseModel):
    IdPeriodoNomina: int

class DetallePlanillaActualizar(BaseModel):
    SueldoBasico: Optional[Decimal] = None
    MontoHorasExtra: Optional[Decimal] = None
    MontoComisiones: Optional[Decimal] = None
    TotalBonos: Optional[Decimal] = None
    DescuentoAtrasos: Optional[Decimal] = None
    DescuentoFaltas: Optional[Decimal] = None
    AporteAFP: Optional[Decimal] = None
    OtrasDeducciones: Optional[Decimal] = None
    TotalGanado: Optional[Decimal] = None
    TotalDescuento: Optional[Decimal] = None
    LiquidoPagable: Optional[Decimal] = None
    Observacion: Optional[str] = None

class PlanillaAprobarRequest(BaseModel):
    Observacion: Optional[str] = None
