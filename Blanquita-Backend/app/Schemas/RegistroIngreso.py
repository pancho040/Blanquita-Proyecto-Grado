from datetime import datetime

from sqlalchemy import DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.Config.supabase import Base


class RegistroIngreso(Base):
    __tablename__ = "RegistroIngreso"

    IdRegistroIngreso: Mapped[int] = mapped_column(primary_key=True)
    IdUsuario: Mapped[int | None]
    Registro: Mapped[str] = mapped_column(Text)
    CiIntentado: Mapped[str | None] = mapped_column(Text)
    Detalle: Mapped[str | None] = mapped_column(Text)
    DireccionIp: Mapped[str | None] = mapped_column(Text)
    UserAgent: Mapped[str | None] = mapped_column(Text)
    FechaRegistro: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
