from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Numeric, Text, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.Config.supabase import Base


class LoteEmpaque(Base):
    __tablename__ = "LoteEmpaque"

    IdLoteEmpaque: Mapped[int] = mapped_column(primary_key=True)
    IdProveedor: Mapped[int]
    IdUsuario: Mapped[int | None]
    FechaRecepcion: Mapped[date] = mapped_column(Date)
    CantidadToneladasPedida: Mapped[Decimal | None] = mapped_column(Numeric)


class TipoEmpaque(Base):
    __tablename__ = "TipoEmpaque"

    IdTipoEmpaque: Mapped[int] = mapped_column(primary_key=True)
    NombreTipoEmpaque: Mapped[str] = mapped_column(Text)
    Activo: Mapped[bool] = mapped_column(server_default=true())


class Empaque(Base):
    __tablename__ = "Empaque"

    IdEmpaque: Mapped[int] = mapped_column(primary_key=True)
    IdTipoEmpaque: Mapped[int]
    IdLoteEmpaque: Mapped[int]
    IdEstadoMateriaPrima: Mapped[int]
    PesoKg: Mapped[Decimal | None] = mapped_column(Numeric)
    CodigoEmpaque: Mapped[str] = mapped_column(Text)


class MovimientoEmpaque(Base):
    __tablename__ = "MovimientoEmpaque"

    IdMovimientoEmpaque: Mapped[int] = mapped_column(primary_key=True)
    IdEmpaque: Mapped[int]
    IdTipoMovimiento: Mapped[int]
    IdUsuario: Mapped[int]
    FechaMovimiento: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    Observacion: Mapped[str | None] = mapped_column(Text)


class TipoEmpaqueBolsa(Base):
    __tablename__ = "TipoEmpaqueBolsa"

    IdTipoEmpaqueBolsa: Mapped[int] = mapped_column(primary_key=True)
    NombreEmpaqueBolsa: Mapped[str] = mapped_column(Text)
    DescripcionEmpaqueBolsa: Mapped[str | None] = mapped_column(Text)
    Activo: Mapped[bool] = mapped_column(server_default=true())


class InventarioEmpaqueBolsa(Base):
    __tablename__ = "InventarioEmpaqueBolsa"

    IdInventarioEmpaqueBolsa: Mapped[int] = mapped_column(primary_key=True)
    IdTipoEmpaqueBolsa: Mapped[int]
    CantidadActual: Mapped[Decimal] = mapped_column(Numeric, default=0)


class TipoBolsaJava(Base):
    __tablename__ = "TipoBolsaJava"

    IdTipoBolsaJava: Mapped[int] = mapped_column(primary_key=True)
    NombreBolsaJava: Mapped[str] = mapped_column(Text)
    DescripcionBolsaJava: Mapped[str | None] = mapped_column(Text)
    Activo: Mapped[bool] = mapped_column(server_default=true())


class InventarioBolsaJava(Base):
    __tablename__ = "InventarioBolsaJava"

    IdInventarioBolsaJava: Mapped[int] = mapped_column(primary_key=True)
    IdTipoBolsaJava: Mapped[int]
    CantidadActual: Mapped[Decimal] = mapped_column(Numeric, default=0)


class MovimientoBolsaJava(Base):
    __tablename__ = "MovimientoBolsaJava"

    IdMovimientoBolsaJava: Mapped[int] = mapped_column(primary_key=True)
    IdTipoBolsaJava: Mapped[int]
    IdLoteEmpaque: Mapped[int | None]
    IdTipoMovimiento: Mapped[int]
    IdUsuario: Mapped[int]
    CantidadMovimiento: Mapped[Decimal | None] = mapped_column(Numeric)
    FechaMovimiento: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    Observacion: Mapped[str | None] = mapped_column(Text)


class MovimientoEmpaqueBolsa(Base):
    __tablename__ = "MovimientoEmpaqueBolsa"

    IdMovimientoEmpaqueBolsa: Mapped[int] = mapped_column(primary_key=True)
    IdTipoEmpaqueBolsa: Mapped[int]
    IdLoteEmpaque: Mapped[int | None]
    IdTipoMovimiento: Mapped[int]
    IdUsuario: Mapped[int]
    CantidadMovimiento: Mapped[Decimal] = mapped_column(Numeric)
    FechaMovimiento: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    Observacion: Mapped[str | None] = mapped_column(Text)
