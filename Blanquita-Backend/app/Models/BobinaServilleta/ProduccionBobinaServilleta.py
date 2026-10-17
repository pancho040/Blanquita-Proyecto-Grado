from pydantic import BaseModel
from datetime import datetime

class AbrirBobinaServilletaRequest(BaseModel):
    IdBobinaServilleta: int
    Observacion: str | None = None


class SubBobinasMedidaResponse(BaseModel):
    IdTipoMedidaSubBobina: int
    MedidaMm: int
    Cantidad: int


class AbrirBobinaServilletaResponse(BaseModel):
    IdBobinaServilleta: int
    IdEstadoMateriaPrima: int
    SubBobinas: list[SubBobinasMedidaResponse]
    CantidadSubBobinasTotal: int


class IniciarProduccionServilletaRequest(BaseModel):
    IdSubBobina: int


class IniciarProduccionServilletaResponse(BaseModel):
    IdProduccionServilleta: int
    FechaInicioProduccion: datetime
    IdTurno: int
    NombreTurno: str



class PausaProduccionServilletaRequest(BaseModel):
    IdProduccionServilleta: int
    MotivoPausaProduccion: str | None = None


class PausaProduccionServilletaResponse(BaseModel):
    IdPausaProduccionServilleta: int
    IdProduccionServilleta: int
    FechaHoraPausa: datetime
    MotivoPausaProduccion: str | None
    FechaHoraReanudacion: datetime | None
    IdEstadoProduccion: int




class ReanudarProduccionServilletaRequest(BaseModel):
    IdProduccionServilleta: int


class ReanudarProduccionServilletaResponse(BaseModel):
    IdPausaProduccionServilleta: int
    IdProduccionServilleta: int
    FechaHoraPausa: datetime
    MotivoPausaProduccion: str | None
    FechaHoraReanudacion: datetime
    IdEstadoProduccion: int



class FinalizarProduccionServilletaRequest(BaseModel):
    IdProduccionServilleta: int


class FinalizarProduccionServilletaResponse(BaseModel):
    IdProduccionServilleta: int
    FechaFinProduccion: datetime
    IdEstadoProduccion: int
    NombreEstadoProduccion: str


class CancelarProduccionServilletaRequest(BaseModel):
    IdProduccionServilleta: int
    MotivoCancelacion: str | None = None


class CancelarProduccionServilletaResponse(BaseModel):
    IdCancelacionProduccionServilleta: int
    IdProduccionServilleta: int
    FechaHoraCancelacion: datetime
    MotivoCancelacion: str | None
    IdEstadoProduccion: int



class VerProduccionServilletaActivasRequest(BaseModel):
    IdTipoMedidaSubBobina: int | None = None


class VerProduccionServilletaActivasResponse(BaseModel):
    IdProduccionServilleta: int
    NombreEstadoProduccion: str
    IdSubBobina: int
    CodigoUnidadOrigen: str
    IdTipoMedidaSubBobina: int
    NombreTurno: str
    FechaInicioProduccion: datetime


class VerPausasProduccionServilletaActivasResponse(BaseModel):
    IdPausaProduccionServilleta: int
    IdProduccionServilleta: int
    IdSubBobina: int
    CodigoUnidadOrigen: str
    FechaHoraPausa: datetime
    NombreEstadoProduccion: str