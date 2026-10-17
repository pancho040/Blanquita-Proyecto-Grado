from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.Config.supabase import Base


class Rol(Base):
    __tablename__ = "Rol"

    IdRol: Mapped[int] = mapped_column(primary_key=True)
    NombreRol: Mapped[str] = mapped_column(Text)
    Descripcion: Mapped[str | None] = mapped_column(Text)


class EstadoUsuario(Base):
    __tablename__ = "EstadoUsuario"

    IdEstadoUsuario: Mapped[int] = mapped_column(primary_key=True)
    NombreEstadoUsuario: Mapped[str] = mapped_column(Text)
    DescripcionEstadoUsuario: Mapped[str | None] = mapped_column(Text)


class Usuario(Base):
    __tablename__ = "Usuario"

    IdUsuario: Mapped[int] = mapped_column(primary_key=True)
    AuthUserId: Mapped[UUID] = mapped_column(unique=True)
    IdRol: Mapped[int]
    IdEstadoUsuario: Mapped[int]
    Ci: Mapped[str] = mapped_column(Text, unique=True)
    PrimerNombre: Mapped[str] = mapped_column(Text)
    SegundoNombre: Mapped[str | None] = mapped_column(Text)
    ApellidoPaterno: Mapped[str] = mapped_column(Text)
    ApellidoMaterno: Mapped[str | None] = mapped_column(Text)
    Celular: Mapped[str | None] = mapped_column(Text)
    IsAdmin: Mapped[bool] = mapped_column(server_default=false())
    FechaRegistro: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AuthUsuario(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}

    id: Mapped[UUID] = mapped_column(primary_key=True)
    email: Mapped[str | None] = mapped_column(Text)
