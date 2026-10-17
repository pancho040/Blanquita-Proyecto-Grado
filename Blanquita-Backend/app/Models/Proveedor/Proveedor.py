from pydantic import BaseModel, Field, field_validator

from app.Constants.Cantidades import (
    LONGITUD_MINIMA_NOMBRE_PROVEEDOR,
    LONGITUD_MAXIMA_NOMBRE_PROVEEDOR,
    LONGITUD_MAXIMA_CORREO_PROVEEDOR,
)

PATRON_CELULAR = r"^[67]\d{7}$"
PATRON_CORREO = r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"


class ProveedorForm(BaseModel):
    IdProveedor: int
    NombreProveedor: str


class ProveedorItem(BaseModel):
    IdProveedor: int
    NombreProveedor: str
    CelularProveedor: str | None
    CorreoProveedor: str | None
    Activo: bool


class ListarProveedoresRequest(BaseModel):
    Activo: bool | None = None
    Busqueda: str | None = Field(default=None, max_length=50)
    Pagina: int = Field(default=1, ge=1)
    TamanoPagina: int = Field(default=20, ge=1, le=100)


class ListarProveedoresResponse(BaseModel):
    Total: int
    Pagina: int
    TamanoPagina: int
    Proveedores: list[ProveedorItem]


class ProveedorContacto(BaseModel):
    CelularProveedor: str | None = Field(default=None, pattern=PATRON_CELULAR)
    CorreoProveedor: str | None = Field(
        default=None, max_length=LONGITUD_MAXIMA_CORREO_PROVEEDOR, pattern=PATRON_CORREO
    )

    @field_validator("CelularProveedor", "CorreoProveedor", mode="before")
    @classmethod
    def VacioANulo(cls, valor):
        if isinstance(valor, str):
            valor = valor.strip()
            return valor or None
        return valor


class CrearProveedorRequest(ProveedorContacto):
    NombreProveedor: str = Field(
        ...,
        min_length=LONGITUD_MINIMA_NOMBRE_PROVEEDOR,
        max_length=LONGITUD_MAXIMA_NOMBRE_PROVEEDOR,
    )


class EditarProveedorRequest(ProveedorContacto):
    IdProveedor: int = Field(..., gt=0)


class ProveedorResponse(ProveedorItem):
    pass


class CambiarEstadoProveedorRequest(BaseModel):
    IdProveedor: int = Field(..., gt=0)
    Activo: bool
    Motivo: str


class CambiarEstadoProveedorResponse(BaseModel):
    IdProveedor: int
    NombreProveedor: str
    ActivoAnterior: bool
    Activo: bool
