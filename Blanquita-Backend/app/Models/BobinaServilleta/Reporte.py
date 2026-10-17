from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.Models.BobinaServilleta.BobinaServilleta import UnidadServilletaResponse


class ReporteInventarioBobinaServilletaRequest(BaseModel):
    IdsTipoBobinaServilleta: Optional[list[int]] = None


class ReporteInventarioResumenTipoServilletaResponse(BaseModel):
    IdTipoBobinaServilleta: int
    NombreTipoBobinaServilleta: str
    CantidadBobinas: int
    PesoBrutoTotalKg: Decimal
    GramajePromedio: Decimal
    RecepcionMasAntigua: Optional[date]
    RecepcionMasReciente: Optional[date]


class ReporteInventarioBobinaServilletaDetalleResponse(BaseModel):
    IdTipoBobinaServilleta: int
    NombreTipoBobinaServilleta: str
    IdBobinaServilleta: int
    CodigoLote: str
    FechaRecepcion: date
    NombreProveedor: str
    Unidades: list[UnidadServilletaResponse]


class ReporteInventarioBobinaServilletaResponse(BaseModel):
    FechaGeneracion: datetime
    TotalBobinas: int
    PesoBrutoGeneralKg: Decimal
    Resumen: list[ReporteInventarioResumenTipoServilletaResponse]
    Bobinas: list[ReporteInventarioBobinaServilletaDetalleResponse]


class VerBobinasServilletaRequest(BaseModel):
    CodigoBobina: Optional[str] = None
    IdProveedor: Optional[int] = None
    IdTipoBobinaServilleta: Optional[int] = None
    IdEstadoMateriaPrima: Optional[int] = None
    IdBobinaServilleta: Optional[int] = None
    Pagina: int = 1
    TamanoPagina: int = 50


class BobinaServilletaCatalogoResponse(BaseModel):
    IdBobinaServilleta: int
    TipoEstado: str
    NombreTipoBobinaServilleta: str
    CodigoLote: str
    FechaRecepcion: date
    NombreProveedor: str
    Unidades: list[UnidadServilletaResponse]


class VerBobinasServilletaResponse(BaseModel):
    Total: int
    Pagina: int
    TamanoPagina: int
    Bobinas: list[BobinaServilletaCatalogoResponse]


class VerSubBobinasServilletaRequest(BaseModel):
    CodigoBobina: Optional[str] = None
    IdProveedor: Optional[int] = None
    IdTipoBobinaServilleta: Optional[int] = None
    IdsTipoMedidaSubBobina: Optional[list[int]] = None
    IdEstadoMateriaPrima: Optional[int] = None
    IdBobinaServilleta: Optional[int] = None
    IdSubBobinaServilleta: Optional[int] = None
    Pagina: int = 1
    TamanoPagina: int = 50


class SubBobinaServilletaCatalogoResponse(BaseModel):
    IdSubBobinaServilleta: int
    TipoEstado: str
    IdTipoMedidaSubBobina: int
    DescripcionMedida: str
    CantidadPorMedida: int
    CodigoBobina: str
    IdBobinaServilleta: int
    NombreTipoBobinaServilleta: str
    CodigoLote: str
    FechaRecepcion: date
    NombreProveedor: str


class VerSubBobinasServilletaResponse(BaseModel):
    Total: int
    Pagina: int
    TamanoPagina: int
    SubBobinas: list[SubBobinaServilletaCatalogoResponse]


class ReporteInventarioResumenMedidaResponse(BaseModel):
    IdTipoMedidaSubBobina: int
    NombreTipoMedida: str
    CantidadSubBobinas: int


class ReporteInventarioSubBobinaServilletaResponse(BaseModel):
    FechaGeneracion: datetime
    TotalSubBobinas: int
    Resumen: list[ReporteInventarioResumenMedidaResponse]
    SubBobinas: list[SubBobinaServilletaCatalogoResponse]


class ReporteInventarioCompletoServilletaResponse(BaseModel):
    Bobinas: Optional[ReporteInventarioBobinaServilletaResponse] = None
    SubBobinas: Optional[ReporteInventarioSubBobinaServilletaResponse] = None


class ReporteHistorialMovimientosUnidadServilletaRequest(BaseModel):
    IdUnidadBobinaServilleta: int


class MovimientoSubBobinaHistorialResponse(BaseModel):
    IdMovimientoSubBobina: int
    IdSubBobinaServilleta: int
    NombreTipoMedida: str
    NombreMovimiento: str
    FechaMovimiento: datetime
    Observacion: Optional[str]
    Ci: str
    PrimerNombre: str
    ApellidoPaterno: str
    NombreRol: str


class MovimientoBobinaServilletaResponse(BaseModel):
    IdMovimientoBobinaServilleta: int
    NombreMovimiento: str
    FechaMovimiento: datetime
    Observacion: Optional[str]
    Ci: str
    PrimerNombre: str
    ApellidoPaterno: str
    NombreRol: str


class ReporteHistorialMovimientosUnidadServilletaResponse(BaseModel):
    IdUnidadBobinaServilleta: int
    CodigoBobina: str
    DescripcionFormato: str
    PesoBrutoKg: Optional[Decimal]
    GramajeGr: Optional[Decimal]
    IdBobinaServilleta: int
    NombreTipoBobinaServilleta: str
    TipoEstado: str
    Movimientos: list[MovimientoSubBobinaHistorialResponse]


class ReporteDetalleBobinaServilletaRequest(BaseModel):
    IdBobinaServilleta: int


class UnidadDetalleBobinaServilletaResponse(BaseModel):
    IdUnidadBobinaServilleta: int
    CodigoUnidad: str
    DescripcionFormato: str
    PesoBrutoKg: Optional[Decimal]
    GramajeGr: Optional[Decimal]
    Movimientos: list[MovimientoSubBobinaHistorialResponse]


class ReporteDetalleBobinaServilletaResponse(BaseModel):
    IdBobinaServilleta: int
    NombreTipoBobinaServilleta: str
    TipoEstado: str
    CodigoLote: str
    FechaRecepcion: date
    NombreProveedor: str
    MovimientosBobina: list[MovimientoBobinaServilletaResponse]
    Unidades: list[UnidadDetalleBobinaServilletaResponse]


class VerLotesBobinaServilletaRequest(BaseModel):
    FechaInicio: Optional[date] = None
    FechaFin: Optional[date] = None
    IdProveedor: Optional[int] = None
    IdsTipoBobinaServilleta: Optional[list[int]] = None
    Pagina: int = 1
    TamanoPagina: int = 50


class LoteBobinaServilletaCatalogoResponse(BaseModel):
    IdLoteBobinaServilleta: int
    FechaRecepcion: date
    NombreProveedor: str
    CantidadBobinas: int


class VerLotesBobinaServilletaResponse(BaseModel):
    Total: int
    Pagina: int
    TamanoPagina: int
    Lotes: list[LoteBobinaServilletaCatalogoResponse]


class ReporteLoteBobinaServilletaDetalleRequest(BaseModel):
    IdLoteBobinaServilleta: int


class BobinaLoteServilletaDetalleResponse(BaseModel):
    IdBobinaServilleta: int
    NombreTipoBobinaServilleta: str
    Unidades: list[UnidadServilletaResponse]


class ReporteLoteBobinaServilletaDetalleResponse(BaseModel):
    IdLoteBobinaServilleta: int
    FechaRecepcion: date
    NombreProveedor: str
    CantidadBobinas: int
    Bobinas: list[BobinaLoteServilletaDetalleResponse]


class ReporteLotesServilletaPorPeriodoRequest(BaseModel):
    FechaInicio: date
    FechaFin: date


class ReporteLotesServilletaPorPeriodoResponse(BaseModel):
    PeriodoInicio: date
    PeriodoFin: date
    TotalLotes: int
    TotalBobinas: int
    Lotes: list[ReporteLoteBobinaServilletaDetalleResponse]


class VerProduccionesServilletaRequest(BaseModel):
    FechaInicio: Optional[date] = None
    FechaFin: Optional[date] = None
    IdTurno: Optional[int] = None
    IdsTipoBobinaServilleta: Optional[list[int]] = None
    CodigoBobina: Optional[str] = None
    Operador: Optional[str] = None
    IdEstadoProduccion: Optional[int] = None
    IdsEstadoProduccion: Optional[list[int]] = None
    Pagina: int = 1
    TamanoPagina: int = 50


class ProduccionServilletaCatalogoResponse(BaseModel):
    IdProduccionServilleta: int
    NombreEstadoProduccion: str
    NombreTurno: str
    Operador: str
    Ci: str
    NombreRol: str
    NombreTipoBobinaServilleta: str
    CodigoBobina: str
    DescripcionMedida: str
    DescripcionFormato: str
    IdSubBobinaServilleta: int
    FechaInicioProduccion: datetime
    FechaFinProduccion: Optional[datetime]
    DuracionTotal: Optional[timedelta]


class VerProduccionesServilletaResponse(BaseModel):
    Total: int
    Pagina: int
    TamanoPagina: int
    Producciones: list[ProduccionServilletaCatalogoResponse]


class ReporteProduccionServilletaDetalleRequest(BaseModel):
    IdProduccion: int
    VerPausas: bool = False


class PausaProduccionServilletaResponse(BaseModel):
    IdPausaProduccionServilleta: int
    IdProduccionServilleta: int
    CodigoBobina: str
    NombreTurno: str
    FechaHoraPausa: datetime
    MotivoPausaProduccion: Optional[str]
    FechaHoraReanudacion: Optional[datetime]
    DuracionPausa: Optional[timedelta]
    OperadorPausa: str
    RolPausa: str
    EstadoPausa: str


class ReporteProduccionServilletaDetalleResponse(BaseModel):
    IdProduccionServilleta: int
    NombreEstadoProduccion: str
    NombreTurno: str
    Operador: str
    Ci: str
    NombreRol: str
    NombreTipoBobinaServilleta: str
    CodigoBobina: str
    DescripcionMedida: str
    DescripcionFormato: str
    IdSubBobinaServilleta: int
    PesoBrutoKg: Optional[Decimal]
    GramajeGr: Optional[Decimal]
    NombreProveedor: str
    FechaRecepcion: date
    FechaInicioProduccion: datetime
    FechaFinProduccion: Optional[datetime]
    DuracionTotal: Optional[timedelta]
    Pausas: Optional[list[PausaProduccionServilletaResponse]] = None
    TotalTiempoPausado: Optional[timedelta] = None


class ReporteCancelacionProduccionServilletaRequest(BaseModel):
    IdProduccion: int


class CancelacionProduccionServilletaResponse(BaseModel):
    FechaHoraCancelacion: datetime
    MotivoCancelacion: Optional[str]
    Ci: str
    Operador: str
    NombreRol: str


class ReporteCancelacionProduccionServilletaResponse(
    ReporteProduccionServilletaDetalleResponse
):
    Pausas: list[PausaProduccionServilletaResponse]
    TotalTiempoPausado: timedelta
    Cancelacion: CancelacionProduccionServilletaResponse


class ReporteProduccionServilletaPorPeriodoRequest(BaseModel):
    FechaInicio: date
    FechaFin: date
    VerCancelaciones: bool = False


class PausaServilletaPorMotivoResponse(BaseModel):
    Motivo: str
    CantidadPausas: int
    TiempoTotal: timedelta


class CancelacionServilletaPeriodoResponse(BaseModel):
    IdProduccionServilleta: int
    FechaHoraCancelacion: datetime
    MotivoCancelacion: Optional[str]
    Ci: str
    PrimerNombre: str
    ApellidoPaterno: str
    NombreRol: str


class ReporteProduccionServilletaPorPeriodoResponse(BaseModel):
    PeriodoInicio: date
    PeriodoFin: date
    TotalProducciones: int
    Producciones: list[ProduccionServilletaCatalogoResponse]
    PausasPorMotivo: list[PausaServilletaPorMotivoResponse]
    TotalPausas: int
    TotalTiempoPausado: timedelta
    Cancelaciones: Optional[list[CancelacionServilletaPeriodoResponse]] = None
