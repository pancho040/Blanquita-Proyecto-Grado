from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.Auth.Security import LONGITUD_MAXIMA, LONGITUD_MINIMA


class UsuarioCreate(BaseModel):
    IdRol: int = Field(..., gt=0)
    Ci: str = Field(..., min_length=6, max_length=12, pattern=r"^\d+$")
    PrimerNombre: str = Field(..., min_length=1, max_length=15)
    SegundoNombre: str | None = Field(default=None, max_length=15)
    ApellidoPaterno: str = Field(..., min_length=1, max_length=15)
    ApellidoMaterno: str | None = Field(default=None, max_length=15)
    Celular: str = Field(..., pattern=r"^[67]\d{7}$")
    Clave: str = Field(..., min_length=LONGITUD_MINIMA, max_length=LONGITUD_MAXIMA)
    IsAdmin: bool = False


class UsuarioResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    IdUsuario: int = Field(..., validation_alias="IdUsuarioOut")
    AuthUserId: UUID = Field(..., validation_alias="AuthUserIdOut")
    Ci: str = Field(..., validation_alias="CiOut")
    IdRol: int = Field(..., validation_alias="IdRolOut")
    NombreRol: str = Field(..., validation_alias="NombreRolOut")
    IdEstadoUsuario: int = Field(..., validation_alias="IdEstadoUsuarioOut")
    NombreCompleto: str = Field(..., validation_alias="NombreCompletoOut")
    Celular: str = Field(..., validation_alias="CelularOut")
    IsAdmin: bool = Field(..., validation_alias="IsAdminOut")
    FechaRegistro: datetime = Field(..., validation_alias="FechaRegistroOut")


class ListarUsuariosRequest(BaseModel):
    IdEstadoUsuario: int | None = None
    IdRol: int | None = None
    Busqueda: str | None = Field(default=None, max_length=50)
    Pagina: int = Field(default=1, ge=1)
    TamanoPagina: int = Field(default=20, ge=1, le=100)


class UsuarioListaItem(BaseModel):
    IdUsuario: int
    Ci: str
    PrimerNombre: str
    SegundoNombre: str | None = None
    ApellidoPaterno: str
    ApellidoMaterno: str | None = None
    Celular: str | None = None
    FechaRegistro: datetime
    IsAdmin: bool
    IdRol: int
    NombreRol: str
    IdEstadoUsuario: int
    NombreEstadoUsuario: str


class ListarUsuariosResponse(BaseModel):
    Total: int
    Pagina: int
    TamanoPagina: int
    Usuarios: list[UsuarioListaItem]


class CambiarEstadoUsuarioRequest(BaseModel):
    IdUsuario: int = Field(..., gt=0)
    IdEstadoUsuario: int = Field(..., gt=0)
    Motivo: str


class CambiarEstadoUsuarioResponse(BaseModel):
    IdUsuario: int
    Ci: str
    NombreCompleto: str
    IdEstadoAnterior: int
    NombreEstadoAnterior: str
    IdEstadoUsuario: int
    NombreEstadoUsuario: str


class RestablecerClaveRequest(BaseModel):
    IdUsuario: int = Field(..., gt=0)
    ClaveNueva: str = Field(..., min_length=LONGITUD_MINIMA, max_length=LONGITUD_MAXIMA)


class RestablecerClaveResponse(BaseModel):
    IdUsuario: int
    Ci: str
    NombreCompleto: str


class EditarUsuarioRequest(BaseModel):
    IdUsuario: int = Field(..., gt=0)
    PrimerNombre: str = Field(..., min_length=1, max_length=15)
    SegundoNombre: str | None = Field(default=None, max_length=15)
    ApellidoPaterno: str = Field(..., min_length=1, max_length=15)
    ApellidoMaterno: str | None = Field(default=None, max_length=15)
    Celular: str | None = Field(default=None, pattern=r"^[67]\d{7}$")


class EditarUsuarioResponse(BaseModel):
    IdUsuario: int
    Ci: str
    NombreCompleto: str


class UsuarioPerfil(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    IdUsuario: int = Field(..., validation_alias="IdUsuarioOut")
    Ci: str = Field(..., validation_alias="CiOut")
    PrimerNombre: str = Field(..., validation_alias="PrimerNombreOut")
    SegundoNombre: str | None = Field(default=None, validation_alias="SegundoNombreOut")
    ApellidoPaterno: str = Field(..., validation_alias="ApellidoPaternoOut")
    ApellidoMaterno: str | None = Field(default=None, validation_alias="ApellidoMaternoOut")
    NombreCompleto: str = Field(..., validation_alias="NombreCompletoOut")
    Celular: str | None = Field(default=None, validation_alias="CelularOut")
    IdRol: int = Field(..., validation_alias="IdRolOut")
    NombreRol: str = Field(..., validation_alias="NombreRolOut")
    IdEstadoUsuario: int = Field(..., validation_alias="IdEstadoUsuarioOut")
    NombreEstadoUsuario: str = Field(..., validation_alias="NombreEstadoUsuarioOut")
    FechaRegistro: datetime = Field(..., validation_alias="FechaRegistroOut")
    Correo: str | None = None