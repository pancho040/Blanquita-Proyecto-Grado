from datetime import datetime
from typing import Optional

from pydantic import BaseModel,Field


class IniciarProduccionBobinaTuboRequest(BaseModel):
    IdBobina1: int
    IdBobina2: int
    IdProducto: Optional[int] = None


class IniciarProduccionBobinaTuboResponse(BaseModel):
    IdProduccionBobinaTubo: int
    FechaInicioProduccion: datetime
    IdTurno: int
    NombreTurno: str
    IdProducto: int
    NombreProducto: str


class CambiarLineaProduccionBobinaTuboRequest(BaseModel):
    IdProduccionBobinaTubo: int
    IdProducto: int


class CambiarLineaProduccionBobinaTuboResponse(BaseModel):
    IdProduccionAnterior: int
    IdProduccionBobinaTubo: int
    FechaInicioProduccion: datetime
    IdTurno: int
    NombreTurno: str
    IdProducto: int
    NombreProducto: str


class PausarProduccionBobinaTuboRequest(BaseModel):
    IdProduccionBobinaTubo: int
    MotivoPausaProduccion: Optional[str] = None


class PausarProduccionBobinaTuboResponse(BaseModel):
    IdPausaProduccionBobinaTubo: int
    IdProduccionBobinaTubo: int
    FechaHoraPausa: datetime
    MotivoPausaProduccion: Optional[str] = None
    FechaHoraReanudacion: Optional[datetime] = None
    IdEstadoProduccion: int


class ReanudarProduccionBobinaTuboRequest(BaseModel):
    IdProduccionBobinaTubo: int
    MotivoReanudacion: Optional[str] = None


class ReanudarProduccionBobinaTuboResponse(BaseModel):
    IdPausaProduccionBobinaTubo: int
    IdProduccionBobinaTubo: int
    FechaHoraPausa: datetime
    MotivoPausaProduccion: Optional[str] = None
    FechaHoraReanudacion: datetime
    MotivoReanudacion: Optional[str] = None
    IdEstadoProduccion: int


class FinalizarProduccionBobinaTuboRequest(BaseModel):
    IdProduccionBobinaTubo: int


class FinalizarProduccionBobinaTuboResponse(BaseModel):
    IdProduccionBobinaTubo: int
    FechaFinProduccion: datetime
    IdEstadoProduccion: int
    NombreEstadoProduccion: str


class CancelarProduccionBobinaTuboRequest(BaseModel):
    IdProduccionBobinaTubo: int
    MotivoCancelacion: Optional[str] = None


class CancelarProduccionBobinaTuboResponse(BaseModel):
    IdCancelacionProduccionBobinaTubo: int
    IdProduccionBobinaTubo: int
    FechaHoraCancelacion: datetime
    MotivoCancelacion: Optional[str] = None
    IdEstadoProduccion: int


class VerProduccionBobinaTuboRequest(BaseModel):
    IdTipoBobina: Optional[int] = None
    IdProducto: Optional[int] = None


class VerProduccionBobinaTuboResponse(BaseModel):
    IdProduccionBobinaTubo: int
    IdTipoBobina: int
    NombreTipoBobina: str
    IdProducto: int
    NombreProducto: str
    NombreEstadoProduccion: str
    CodigoBobina1: str
    CodigoBobina2: str
    NombreTurno: str
    FechaInicioProduccion: datetime
    CantidadLogsActual: int


class VerPausasProduccionBobinaTuboActivasRequest(BaseModel):
    FiltroIdTipoBobina: Optional[int] = None
    FiltroIdProducto: Optional[int] = None


class VerPausasProduccionBobinaTuboActivasResponse(BaseModel):
    IdPausaProduccionBobinaTubo: int
    IdProduccionBobinaTubo: int
    IdProducto: int
    NombreProducto: str
    CodigoBobina1: str
    CodigoBobina2: str
    FechaHoraPausa: datetime
    NombreEstadoProduccion: str
    CantidadLogsActual: int


class InsertarMovimientoOperadorLogsRequest(BaseModel):
    IdProduccionBobinaTubo: int
    IdTipoMovimientoOperadorLogs: int
    CantidadLogs: int=Field(ge=1)
    Observacion: Optional[str] = None


class InsertarMovimientoOperadorLogsResponse(BaseModel):
    IdMovimientoOperadorLogs: int
    IdProduccionBobinaTubo: int
    IdTipoMovimientoOperadorLogs: int
    CantidadLogs: int
    CantidadTotalActual: int
    FechaMovimiento: datetime