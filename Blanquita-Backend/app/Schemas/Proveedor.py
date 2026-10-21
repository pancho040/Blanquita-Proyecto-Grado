from sqlalchemy import Text, true
from sqlalchemy.orm import Mapped, mapped_column

from app.Config.supabase import Base


class Proveedor(Base):
    __tablename__ = "Proveedor"

    IdProveedor: Mapped[int] = mapped_column(primary_key=True)
    NombreProveedor: Mapped[str] = mapped_column(Text)
    CelularProveedor: Mapped[str | None] = mapped_column(Text)
    CorreoProveedor: Mapped[str | None] = mapped_column(Text)
    Activo: Mapped[bool] = mapped_column(server_default=true())
