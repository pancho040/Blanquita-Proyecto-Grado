from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Numeric, Text, func, text, true
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
    CantidadUnidades: Mapped[int] = mapped_column(server_default=text("1"))
    Activo: Mapped[bool] = mapped_column(server_default=true())
    StockMinimo: Mapped[int | None]
    StockPreventivo: Mapped[int | None]


class FormatoSubBobina(Base):
    __tablename__ = "FormatoSubBobina"

    IdFormatoSubBobina: Mapped[int] = mapped_column(primary_key=True)
    DescripcionFormato: Mapped[str] = mapped_column(Text)
    Activo: Mapped[bool] = mapped_column(server_default=true())


class TipoMedidaSubBobina(Base):
    __tablename__ = "TipoMedidaSubBobina"

    IdTipoMedidaSubBobina: Mapped[int] = mapped_column(primary_key=True)
    MedidaMm: Mapped[int]
    Descripcion: Mapped[str | None] = mapped_column(Text)
    Activo: Mapped[bool] = mapped_column(server_default=true())
    StockMinimo: Mapped[int | None]
    StockPreventivo: Mapped[int | None]


class FormatoSubBobinaDetalle(Base):
    __tablename__ = "FormatoSubBobinaDetalle"

    IdFormatoSubBobinaDetalle: Mapped[int] = mapped_column(primary_key=True)
    IdFormatoSubBobina: Mapped[int]
    IdTipoMedidaSubBobina: Mapped[int]
    Cantidad: Mapped[int]


class TipoBobinaServilletaFormato(Base):
    __tablename__ = "TipoBobinaServilletaFormato"

    IdTipoBobinaServilletaFormato: Mapped[int] = mapped_column(primary_key=True)
    IdTipoBobinaServilleta: Mapped[int]
    IdFormatoSubBobina: Mapped[int]


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
