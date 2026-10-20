from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Numeric, Text, func, text, true
from sqlalchemy.orm import Mapped, mapped_column

from app.Config.supabase import Base


class TipoBobina(Base):
    __tablename__ = "TipoBobina"

    IdTipoBobina: Mapped[int] = mapped_column(primary_key=True)
    NombreTipoBobina: Mapped[str] = mapped_column(Text)
    DiametroMm: Mapped[Decimal] = mapped_column(Numeric, server_default=text("1210"))
    Formato: Mapped[Decimal] = mapped_column(Numeric, server_default=text("2760"))
    TaraKg: Mapped[Decimal] = mapped_column(Numeric, server_default=text("38"))
    Descripcion: Mapped[str | None] = mapped_column(Text)
    Activo: Mapped[bool] = mapped_column(server_default=true())
    StockMinimo: Mapped[int | None]
    StockPreventivo: Mapped[int | None]


class LoteBobina(Base):
    __tablename__ = "LoteBobina"

    IdLoteBobina: Mapped[int] = mapped_column(primary_key=True)
    IdProveedor: Mapped[int]
    IdUsuario: Mapped[int | None]
    FechaRecepcion: Mapped[date] = mapped_column(Date)


class BobinaPapel(Base):
    __tablename__ = "BobinaPapel"

    IdBobinaPapel: Mapped[int] = mapped_column(primary_key=True)
    CodigoBobina: Mapped[str] = mapped_column(Text)
    IdTipoBobina: Mapped[int]
    IdLoteBobina: Mapped[int]
    IdEstadoMateriaPrima: Mapped[int]
    PesoBrutoKg: Mapped[Decimal | None] = mapped_column(Numeric)
    Gramaje: Mapped[Decimal | None] = mapped_column(Numeric)
    PesoNetoKg: Mapped[Decimal | None] = mapped_column(Numeric)


class MovimientoBobina(Base):
    __tablename__ = "MovimientoBobina"

    IdMovimientoBobina: Mapped[int] = mapped_column(primary_key=True)
    IdBobinaPapel: Mapped[int]
    IdTipoMovimiento: Mapped[int]
    IdUsuario: Mapped[int]
    FechaMovimiento: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    Observacion: Mapped[str | None] = mapped_column(Text)
