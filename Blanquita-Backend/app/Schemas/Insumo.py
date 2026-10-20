from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, Text, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.Config.supabase import Base


class TipoInsumo(Base):
    __tablename__ = "TipoInsumo"

    IdTipoInsumo: Mapped[int] = mapped_column(primary_key=True)
    NombreInsumo: Mapped[str] = mapped_column(Text)
    DescripcionInsumo: Mapped[str | None] = mapped_column(Text)
    Activo: Mapped[bool] = mapped_column(server_default=true())


class InventarioInsumo(Base):
    __tablename__ = "InventarioInsumo"

    IdInventarioInsumo: Mapped[int] = mapped_column(primary_key=True)
    IdTipoInsumo: Mapped[int]
    CantidadActual: Mapped[Decimal] = mapped_column(Numeric, default=0)
    StockMinimo: Mapped[int | None]
    StockPreventivo: Mapped[int | None]


class MovimientoInsumo(Base):
    __tablename__ = "MovimientoInsumo"

    IdMovimientoInsumo: Mapped[int] = mapped_column(primary_key=True)
    IdTipoInsumo: Mapped[int]
    IdTipoMovimiento: Mapped[int]
    IdUsuario: Mapped[int]
    CantidadMovimiento: Mapped[Decimal | None] = mapped_column(Numeric)
    FechaMovimiento: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    Observacion: Mapped[str | None] = mapped_column(Text)
