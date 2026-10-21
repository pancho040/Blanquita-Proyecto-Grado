from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column

from app.Config.supabase import Base


class EstadoMateriaPrima(Base):
    __tablename__ = "EstadoMateriaPrima"

    IdEstadoMateriaPrima: Mapped[int] = mapped_column(primary_key=True)
    TipoEstado: Mapped[str] = mapped_column(Text)


class TipoMovimientoMateriaPrima(Base):
    __tablename__ = "TipoMovimientoMateriaPrima"

    IdTipoMovimiento: Mapped[int] = mapped_column(primary_key=True)
    NombreMovimiento: Mapped[str] = mapped_column(Text)
    AplicaA: Mapped[str] = mapped_column(Text)
    DescripcionTipoMovimientoMateriaPrima: Mapped[str | None] = mapped_column(Text)
