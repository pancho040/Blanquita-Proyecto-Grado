from datetime import date, datetime

from sqlalchemy import Date, DateTime, Text, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.Config.supabase import Base


class TipoRodela(Base):
    __tablename__ = "TipoRodela"

    IdTipoRodela: Mapped[int] = mapped_column(primary_key=True)
    NombreTipoRodela: Mapped[str] = mapped_column(Text)
    Descripcion: Mapped[str | None] = mapped_column(Text)
    Activo: Mapped[bool] = mapped_column(server_default=true())


class LoteRodela(Base):
    __tablename__ = "LoteRodela"

    IdLoteRodela: Mapped[int] = mapped_column(primary_key=True)
    IdProveedor: Mapped[int]
    IdUsuario: Mapped[int | None]
    FechaRecepcion: Mapped[date] = mapped_column(Date)


class Rodela(Base):
    __tablename__ = "Rodela"

    IdRodela: Mapped[int] = mapped_column(primary_key=True)
    IdLoteRodela: Mapped[int]
    IdEstadoMateriaPrima: Mapped[int]
    IdTipoRodela: Mapped[int]
    CodigoRodela: Mapped[str] = mapped_column(Text)


class MovimientoRodela(Base):
    __tablename__ = "MovimientoRodela"

    IdMovimientoRodela: Mapped[int] = mapped_column(primary_key=True)
    IdRodela: Mapped[int]
    IdTipoMovimiento: Mapped[int]
    IdUsuario: Mapped[int]
    FechaMovimiento: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    Observacion: Mapped[str | None] = mapped_column(Text)
