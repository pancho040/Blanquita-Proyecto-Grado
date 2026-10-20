from datetime import datetime, time

from sqlalchemy import DateTime, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column

from app.Config.supabase import Base


class EstadoProduccion(Base):
    __tablename__ = "EstadoProduccion"

    IdEstadoProduccion: Mapped[int] = mapped_column(primary_key=True)
    NombreEstadoProduccion: Mapped[str] = mapped_column(Text)
    DescripcionEstadoProduccion: Mapped[str | None] = mapped_column(Text)


class Turno(Base):
    __tablename__ = "Turno"

    IdTurno: Mapped[int] = mapped_column(primary_key=True)
    NombreTurno: Mapped[str] = mapped_column(Text)
    HoraInicio: Mapped[time] = mapped_column(Time)
    HoraFin: Mapped[time] = mapped_column(Time)
    DescripcionTurno: Mapped[str | None] = mapped_column(Text)


class ProduccionBobinaTubo(Base):
    __tablename__ = "ProduccionBobinaTubo"

    IdProduccionBobinaTubo: Mapped[int] = mapped_column(primary_key=True)
    IdEstadoProduccion: Mapped[int]
    IdUsuario: Mapped[int]
    IdBobina_1: Mapped[int]
    IdBobina_2: Mapped[int]
    IdTurno: Mapped[int]
    IdProducto: Mapped[int]
    FechaInicioProduccion: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    FechaFinProduccion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    CantidadLogsActual: Mapped[int]


class CancelacionProduccionBobinaTubo(Base):
    __tablename__ = "CancelacionProduccionBobinaTubo"

    IdCancelacionProduccionBobinaTubo: Mapped[int] = mapped_column(primary_key=True)
    IdProduccionBobinaTubo: Mapped[int]
    IdUsuario: Mapped[int]
    FechaHoraCancelacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    MotivoCancelacion: Mapped[str | None] = mapped_column(Text)


class TipoMovimientoOperadorLogs(Base):
    __tablename__ = "TipoMovimientoOperadorLogs"

    IdTipoMovimientoOperadorLogs: Mapped[int] = mapped_column(primary_key=True)
    NombreMovimiento: Mapped[str] = mapped_column(Text)
    DescripcionTipoMovimientoOperadorLogs: Mapped[str | None] = mapped_column(Text)


class MovimientoOperadorLogs(Base):
    __tablename__ = "MovimientoOperadorLogs"

    IdMovimientoOperadorLogs: Mapped[int] = mapped_column(primary_key=True)
    IdProduccionBobinaTubo: Mapped[int]
    IdTipoMovimientoOperadorLogs: Mapped[int]
    IdUsuario: Mapped[int]
    CantidadLogs: Mapped[int]
    FechaMovimiento: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    Observacion: Mapped[str | None] = mapped_column(Text)


class ProduccionServilleta(Base):
    __tablename__ = "ProduccionServilleta"

    IdProduccionServilleta: Mapped[int] = mapped_column(primary_key=True)
    IdEstadoProduccion: Mapped[int]
    IdUsuario: Mapped[int]
    IdSubBobina: Mapped[int]
    IdTurno: Mapped[int]
    FechaInicioProduccion: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    FechaFinProduccion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PausaProduccionServilleta(Base):
    __tablename__ = "PausaProduccionServilleta"

    IdPausaProduccionServilleta: Mapped[int] = mapped_column(primary_key=True)
    IdProduccionServilleta: Mapped[int]
    IdUsuario: Mapped[int]
    FechaHoraPausa: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    MotivoPausaProduccion: Mapped[str | None] = mapped_column(Text)
    FechaHoraReanudacion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CancelacionProduccionServilleta(Base):
    __tablename__ = "CancelacionProduccionServilleta"

    IdCancelacionProduccionServilleta: Mapped[int] = mapped_column(primary_key=True)
    IdProduccionServilleta: Mapped[int]
    IdUsuario: Mapped[int]
    FechaHoraCancelacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    MotivoCancelacion: Mapped[str | None] = mapped_column(Text)


class PausaProduccionBobinaTubo(Base):
    __tablename__ = "PausaProduccionBobinaTubo"

    IdPausaProduccionBobinaTubo: Mapped[int] = mapped_column(primary_key=True)
    IdProduccionBobinaTubo: Mapped[int]
    IdUsuario: Mapped[int]
    FechaHoraPausa: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    MotivoPausaProduccion: Mapped[str | None] = mapped_column(Text)
    FechaHoraReanudacion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
