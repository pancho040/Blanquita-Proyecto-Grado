from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class ReporteInventarioBobinaPapelRequest(BaseModel):
    IdsTipoBobina: Optional[list[int]] = None


class ReporteInventarioResumenTipoResponse(BaseModel):
    IdTipoBobina: int
    NombreTipoBobina: str
    CantidadBobinas: int
    PesoNetoTotalKg: Decimal
    GramajePromedio: Decimal
    RecepcionMasAntigua: Optional[date]
    RecepcionMasReciente: Optional[date]


class ReporteInventarioBobinaResponse(BaseModel):
    IdTipoBobina: int
    NombreTipoBobina: str
    IdBobinaPapel: int
    CodigoBobina: str
    CodigoLote: str
    FechaRecepcion: date
    NombreProveedor: str
    PesoBrutoKg: Optional[Decimal]
    PesoNetoKg: Optional[Decimal]
    Gramaje: Optional[Decimal]


class ReporteInventarioBobinaPapelResponse(BaseModel):
    FechaGeneracion: datetime
    TotalBobinas: int
    PesoNetoGeneralKg: Decimal
    Resumen: list[ReporteInventarioResumenTipoResponse]
    Bobinas: list[ReporteInventarioBobinaResponse]


class VerProduccionesBobinaTuboRequest(BaseModel):
    FechaInicio: Optional[date] = None
    FechaFin: Optional[date] = None
    IdTurno: Optional[int] = None
    IdsProducto: Optional[list[int]] = None
    CodigoBobina: Optional[str] = None
    Operador: Optional[str] = None
    IdEstadoProduccion: Optional[int] = None
    IdsEstadoProduccion: Optional[list[int]] = None
    Pagina: int = 1
    TamanoPagina: int = 50


class ProduccionBobinaTuboCatalogoResponse(BaseModel):
    IdProduccionBobinaTubo: int
    NombreEstadoProduccion: str
    NombreTurno: str
    Operador: str
    Ci: str
    NombreRol: str
    IdProducto: int
    NombreProducto: str
    CodigoBobina1: str
    CodigoBobina2: str
    FechaInicioProduccion: datetime
    FechaFinProduccion: Optional[datetime]
    DuracionTotal: Optional[timedelta]
    CantidadLogsActual: int
    CantidadCargada: int = 1


class VerProduccionesBobinaTuboResponse(BaseModel):
    Total: int
    Pagina: int
    TamanoPagina: int
    Producciones: list[ProduccionBobinaTuboCatalogoResponse]


class ReporteProduccionBobinaTuboDetalleRequest(BaseModel):
    IdProduccion: int
    VerPausas: bool = False
    VerMovimientos: bool = False


class PausaProduccionBobinaTuboResponse(BaseModel):
    IdPausaProduccionBobinaTubo: int
    IdProduccionBobinaTubo: int
    NombreProducto: str
    CodigoBobina1: str
    CodigoBobina2: str
    NombreTurno: str
    FechaHoraPausa: datetime
    MotivoPausaProduccion: Optional[str]
    FechaHoraReanudacion: Optional[datetime]
    MotivoReanudacion: Optional[str] = None
    DuracionPausa: Optional[timedelta]
    OperadorPausa: str
    RolPausa: str
    EstadoPausa: str


class MovimientoOperadorLogsResponse(BaseModel):
    IdMovimientoOperadorLogs: int
    IdProduccionBobinaTubo: int
    CantidadLogs: int
    FechaMovimiento: datetime
    Observacion: Optional[str]
    NombreMovimiento: str
    Ci: str
    PrimerNombre: str
    ApellidoPaterno: str
    NombreRol: str


class ProduccionCargadaResponse(BaseModel):
    IdProduccionBobinaTubo: int
    NombreProducto: str
    NombreEstadoProduccion: str
    NombreTurno: str
    Operador: str
    FechaInicioProduccion: datetime
    FechaFinProduccion: Optional[datetime]
    DuracionTotal: Optional[timedelta]
    CantidadLogsActual: int


class ReporteProduccionBobinaTuboDetalleResponse(BaseModel):
    IdProduccionBobinaTubo: int
    NombreEstadoProduccion: str
    NombreTurno: str
    Operador: str
    Ci: str
    NombreRol: str
    IdProducto: int
    NombreProducto: str
    TipoBobina: str
    CodigoBobina1: str
    PesoNeto1: Optional[Decimal]
    Gramaje1: Optional[Decimal]
    Proveedor1: str
    Recepcion1: date
    CodigoBobina2: str
    PesoNeto2: Optional[Decimal]
    Gramaje2: Optional[Decimal]
    Proveedor2: str
    Recepcion2: date
    FechaInicioProduccion: datetime
    FechaFinProduccion: Optional[datetime]
    DuracionTotal: Optional[timedelta]
    CantidadLogsActual: int
    Cargada: list[ProduccionCargadaResponse] = []
    Pausas: Optional[list[PausaProduccionBobinaTuboResponse]] = None
    TotalTiempoPausado: Optional[timedelta] = None
    Movimientos: Optional[list[MovimientoOperadorLogsResponse]] = None


class VerLotesBobinaPapelRequest(BaseModel):
    FechaInicio: Optional[date] = None
    FechaFin: Optional[date] = None
    IdProveedor: Optional[int] = None
    IdsTipoBobina: Optional[list[int]] = None
    Pagina: int = 1
    TamanoPagina: int = 50


class LoteBobinaPapelCatalogoResponse(BaseModel):
    IdLoteBobina: int
    FechaRecepcion: date
    NombreProveedor: str
    CantidadBobinas: int


class VerLotesBobinaPapelResponse(BaseModel):
    Total: int
    Pagina: int
    TamanoPagina: int
    Lotes: list[LoteBobinaPapelCatalogoResponse]


class ReporteLoteBobinaPapelDetalleRequest(BaseModel):
    IdLoteBobina: int


class BobinaLoteDetalleResponse(BaseModel):
    CodigoBobina: str
    NombreTipoBobina: str
    PesoBrutoKg: Optional[Decimal]
    Gramaje: Optional[Decimal]
    PesoNetoKg: Optional[Decimal]


class ReporteLoteBobinaPapelDetalleResponse(BaseModel):
    IdLoteBobina: int
    FechaRecepcion: date
    NombreProveedor: str
    CantidadBobinas: int
    Ci: str
    PrimerNombre: str
    ApellidoPaterno: str
    NombreRol: str
    Bobinas: list[BobinaLoteDetalleResponse]


class ReporteLotesPorPeriodoRequest(BaseModel):
    FechaInicio: date
    FechaFin: date


class ReporteLotesPorPeriodoResponse(BaseModel):
    PeriodoInicio: date
    PeriodoFin: date
    TotalLotes: int
    TotalBobinas: int
    Lotes: list[ReporteLoteBobinaPapelDetalleResponse]


class ReporteCancelacionProduccionBobinaTuboRequest(BaseModel):
    IdProduccion: int


class CancelacionProduccionBobinaTuboResponse(BaseModel):
    FechaHoraCancelacion: datetime
    MotivoCancelacion: Optional[str]
    Ci: str
    Operador: str
    NombreRol: str


class ReporteCancelacionProduccionBobinaTuboResponse(
    ReporteProduccionBobinaTuboDetalleResponse
):
    Pausas: list[PausaProduccionBobinaTuboResponse]
    TotalTiempoPausado: timedelta
    Movimientos: list[MovimientoOperadorLogsResponse]
    Cancelacion: CancelacionProduccionBobinaTuboResponse


class ReporteProduccionPorPeriodoRequest(BaseModel):
    FechaInicio: date
    FechaFin: date
    VerCancelaciones: bool = False


class PausaPorMotivoResponse(BaseModel):
    NombreProducto: str
    Motivo: str
    CantidadPausas: int
    TiempoTotal: timedelta


class ResumenProductoPeriodoResponse(BaseModel):
    NombreProducto: str
    CantidadProducciones: int
    TotalLogs: int
    PromedioLogs: Optional[Decimal]
    CantidadCanceladas: int


class CancelacionPeriodoResponse(BaseModel):
    IdProduccionBobinaTubo: int
    NombreProducto: str
    FechaHoraCancelacion: datetime
    MotivoCancelacion: Optional[str]
    Ci: str
    PrimerNombre: str
    ApellidoPaterno: str
    NombreRol: str


class ReporteProduccionPorPeriodoResponse(BaseModel):
    PeriodoInicio: date
    PeriodoFin: date
    TotalProducciones: int
    TotalLogs: int
    ResumenPorProducto: list[ResumenProductoPeriodoResponse]
    Producciones: list[ProduccionBobinaTuboCatalogoResponse]
    PausasPorMotivo: list[PausaPorMotivoResponse]
    TotalPausas: int
    TotalTiempoPausado: timedelta
    Cancelaciones: Optional[list[CancelacionPeriodoResponse]] = None


class VerBobinasPapelRequest(BaseModel):
    CodigoBobina: Optional[str] = None
    IdProveedor: Optional[int] = None
    IdsTipoBobina: Optional[list[int]] = None
    IdEstadoMateriaPrima: Optional[int] = None
    IdBobinaPapel: Optional[int] = None
    Pagina: int = 1
    TamanoPagina: int = 50


class BobinaPapelCatalogoResponse(BaseModel):
    IdBobinaPapel: int
    CodigoBobina: str
    PesoBrutoKg: Optional[Decimal]
    Gramaje: Optional[Decimal]
    NombreTipoBobina: str
    TipoEstado: str
    NombreProveedor: str


class VerBobinasPapelResponse(BaseModel):
    Total: int
    Pagina: int
    TamanoPagina: int
    Bobinas: list[BobinaPapelCatalogoResponse]


class ReporteHistorialMovimientosBobinaRequest(BaseModel):
    IdBobinaPapel: int


class MovimientoBobinaResponse(BaseModel):
    IdMovimientoBobina: int
    NombreMovimiento: str
    FechaMovimiento: datetime
    Observacion: Optional[str]
    Ci: str
    PrimerNombre: str
    ApellidoPaterno: str
    NombreRol: str


class ReporteHistorialMovimientosBobinaResponse(BaseModel):
    IdBobinaPapel: int
    CodigoBobina: str
    NombreTipoBobina: str
    TipoEstado: str
    Movimientos: list[MovimientoBobinaResponse]
