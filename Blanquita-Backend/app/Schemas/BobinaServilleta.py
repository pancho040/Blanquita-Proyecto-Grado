from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Numeric, Text, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.Config.supabase import Base


class TipoBobinaServilleta(Base):
    __tablename__ = "TipoBobinaServilleta"

    IdTipoBobinaServilleta: Mapped[int] = mapped_column(primary_key=True)
    NombreTipoBobinaServilleta: Mapped[str] = mapped_column(Text)
    DiametroMm: Mapped[Decimal] = mapped_column(Numeric)
    CrepadoPorcentaje: Mapped[Decimal] = mapped_column(Numeric)
    ResistenciaKgf: Mapped[Decimal] = mapped_column(Numeric)
    Descripcion: Mapped[str | None] = mapped_column(Text)
    Activo: Mapped[bool] = mapped_column(server_default=true())


class FormatoSubBobina(Base):
    __tablename__ = "FormatoSubBobina"

    IdFormatoSubBobina: Mapped[int] = mapped_column(primary_key=True)
    DescripcionFormato: Mapped[str] = mapped_column(Text)
    CantidadBobina435: Mapped[int]
    CantidadBobina220: Mapped[int]


class TipoMedidaSubBobina(Base):
    __tablename__ = "TipoMedidaSubBobina"

    IdTipoMedidaSubBobina: Mapped[int] = mapped_column(primary_key=True)
    MedidaMm: Mapped[int]
    Descripcion: Mapped[str | None] = mapped_column(Text)


class LoteBobinaServilleta(Base):
    __tablename__ = "LoteBobinaServilleta"

    IdLoteBobinaServilleta: Mapped[int] = mapped_column(primary_key=True)
    IdProveedor: Mapped[int]
    IdUsuario: Mapped[int | None]
    FechaRecepcion: Mapped[date] = mapped_column(Date)


class BobinaServilleta(Base):
    __tablename__ = "BobinaServilleta"

    IdBobinaServilleta: Mapped[int] = mapped_column(primary_key=True)
    IdLoteBobinaServilleta: Mapped[int]
    IdTipoBobinaServilleta: Mapped[int]
    IdEstadoMateriaPrima: Mapped[int]


class UnidadBobinaServilleta(Base):
    __tablename__ = "UnidadBobinaServilleta"

    IdUnidadBobinaServilleta: Mapped[int] = mapped_column(primary_key=True)
    IdBobinaServilleta: Mapped[int]
    IdFormatoSubBobina: Mapped[int]
    CodigoBobina: Mapped[str] = mapped_column(Text)
    PesoBrutoKg: Mapped[Decimal | None] = mapped_column(Numeric)
    GramajeGr: Mapped[Decimal | None] = mapped_column(Numeric)


class SubBobinaServilleta(Base):
    __tablename__ = "SubBobinaServilleta"

    IdSubBobinaServilleta: Mapped[int] = mapped_column(primary_key=True)
    IdUnidadBobinaServilleta: Mapped[int]
    IdTipoMedidaSubBobina: Mapped[int]
    IdEstadoMateriaPrima: Mapped[int]


class MovimientoBobinaServilleta(Base):
    __tablename__ = "MovimientoBobinaServilleta"

    IdMovimientoBobinaServilleta: Mapped[int] = mapped_column(primary_key=True)
    IdBobinaServilleta: Mapped[int]
    IdTipoMovimiento: Mapped[int]
    IdUsuario: Mapped[int]
    FechaMovimiento: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    Observacion: Mapped[str | None] = mapped_column(Text)


class MovimientoSubBobina(Base):
    __tablename__ = "MovimientoSubBobina"

    IdMovimientoSubBobina: Mapped[int] = mapped_column(primary_key=True)
    IdSubBobinaServilleta: Mapped[int]
    IdTipoMovimiento: Mapped[int]
    IdUsuario: Mapped[int]
    FechaMovimiento: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    Observacion: Mapped[str | None] = mapped_column(Text)
