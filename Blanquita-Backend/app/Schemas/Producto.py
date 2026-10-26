from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, Text, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.Config.supabase import Base


class Producto(Base):
    __tablename__ = "Producto"

    IdProducto: Mapped[int] = mapped_column(primary_key=True)
    NombreProducto: Mapped[str] = mapped_column(Text)
    SiglasProducto: Mapped[str] = mapped_column(Text)
    IdTipoBobina: Mapped[int | None]
    IdTipoBobinaServilleta: Mapped[int | None]
    Activo: Mapped[bool] = mapped_column(server_default=true())


class PresentacionProducto(Base):
    __tablename__ = "PresentacionProducto"

    IdPresentacion: Mapped[int] = mapped_column(primary_key=True)
    IdProducto: Mapped[int]
    TipoContenedor: Mapped[str] = mapped_column(Text)
    CantidadRollosUnidades: Mapped[int | None]
    CantidadPorUnidadTerminada: Mapped[int | None]
    CodigoPresentacion: Mapped[str] = mapped_column(Text)
    Activo: Mapped[bool] = mapped_column(server_default=true())


class InventarioProductoTerminado(Base):
    __tablename__ = "InventarioProductoTerminado"

    IdPresentacion: Mapped[int] = mapped_column(primary_key=True)
    CantidadActual: Mapped[Decimal] = mapped_column(Numeric, default=0)
    StockMinimo: Mapped[int | None]
    StockPreventivo: Mapped[int | None]


class MovimientoProductoTerminado(Base):
    __tablename__ = "MovimientoProductoTerminado"

    IdMovimientoProductoTerminado: Mapped[int] = mapped_column(primary_key=True)
    IdTipoMovimientoInventario: Mapped[int]
    IdPresentacion: Mapped[int]
    IdUsuario: Mapped[int]
    IdTurno: Mapped[int]
    CantidadIngresoInventario: Mapped[Decimal] = mapped_column(Numeric)
    FechaMovimiento: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    Observacion: Mapped[str | None] = mapped_column(Text)


class BloqueoProductoTerminado(Base):
    __tablename__ = "BloqueoProductoTerminado"

    IdBloqueoProductoTerminado: Mapped[int] = mapped_column(primary_key=True)
    IdUsuarioBloqueo: Mapped[int]
    FechaHoraBloqueo: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    MotivoBloqueo: Mapped[str] = mapped_column(Text)
    IdUsuarioDesbloqueo: Mapped[int | None]
    FechaHoraDesbloqueo: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    BloqueaIngreso: Mapped[bool] = mapped_column(server_default=true())
    BloqueaCorreccion: Mapped[bool] = mapped_column(server_default=true())
    BloqueaSalida: Mapped[bool] = mapped_column(server_default=true())


class ConteoProductoTerminado(Base):
    __tablename__ = "ConteoProductoTerminado"

    IdConteoProductoTerminado: Mapped[int] = mapped_column(primary_key=True)
    IdUsuarioInicio: Mapped[int]
    FechaHoraInicio: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    MotivoInicio: Mapped[str] = mapped_column(Text)
    Estado: Mapped[str] = mapped_column(Text, server_default="Abierto")
    IdUsuarioCierre: Mapped[int | None]
    FechaHoraCierre: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    MotivoAnulacion: Mapped[str | None] = mapped_column(Text)


class ConteoProductoTerminadoDetalle(Base):
    __tablename__ = "ConteoProductoTerminadoDetalle"

    IdConteoProductoTerminadoDetalle: Mapped[int] = mapped_column(primary_key=True)
    IdConteoProductoTerminado: Mapped[int]
    IdPresentacion: Mapped[int]
    CantidadSistema: Mapped[Decimal] = mapped_column(Numeric)
    CantidadFisica: Mapped[Decimal | None] = mapped_column(Numeric)
    IdUsuarioConteo: Mapped[int | None]
    FechaHoraConteo: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    MotivoDiferencia: Mapped[str | None] = mapped_column(Text)
    IdMovimientoProductoTerminado: Mapped[int | None]


class TipoMovimientoInventario(Base):
    __tablename__ = "TipoMovimientoInventario"

    IdTipoMovimientoInventario: Mapped[int] = mapped_column(primary_key=True)
    NombreTipoMovimientoInventario: Mapped[str] = mapped_column(Text)
    DescripcionTipoMovimientoInventario: Mapped[str | None] = mapped_column(Text)
