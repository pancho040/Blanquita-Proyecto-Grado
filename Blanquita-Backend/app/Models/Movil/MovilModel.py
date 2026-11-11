"""
Modelos de Datos y Esquemas para la App Móvil (Fase 1 - Base Común)
Sistema ERP Papelera Blanquita
"""

from typing import Optional, List, Any, Generic, TypeVar
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, AliasChoices

T = TypeVar("T")


class LoginMovilRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    Ci: str = Field(..., validation_alias=AliasChoices("Ci", "ci"), min_length=3, max_length=20, description="Cédula de identidad del usuario")
    Clave: str = Field(..., validation_alias=AliasChoices("Clave", "clave"), min_length=4, description="Contraseña de acceso")


class UsuarioMovilDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id_usuario: int
    nombre: str
    apellido: str
    ci: str
    id_rol: int
    nombre_rol: str
    sucursales_permitidas: List[int] = Field(default_factory=list)
    puede_ver_todas: bool = False
    sucursal_defecto: Optional[int] = None


class LoginMovilResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    usuario: UsuarioMovilDTO


class RefreshMovilRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    refresh_token: str = Field(..., description="Token de refresco de Supabase Auth")


class RefreshMovilResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 3600


class LogoutMovilRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    token_push: Optional[str] = Field(None, description="Token push opcional para desregistrar")


class RegistroDispositivoRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    token_push: str = Field(..., min_length=10, max_length=255, description="Token de Expo Push")
    plataforma: str = Field("android", description="Plataforma del dispositivo (android/ios)")
    version_app: Optional[str] = Field("1.0.0", max_length=50, description="Versión actual de la app móvil")


class DispositivoResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: int
    usuario_id: int
    token_push: str
    plataforma: str
    version_app: Optional[str]
    activo: bool
    ultimo_uso: Optional[datetime] = None


class MovilResponse(BaseModel, Generic[T]):
    model_config = ConfigDict(populate_by_name=True)
    codigo: str = "EXITO"
    mensaje: str = "Operación completada con éxito"
    request_id: Optional[str] = None
    datos: Optional[T] = None


class NotificacionMovilDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: int
    titulo: str
    mensaje: str
    tipo: str
    codigo_referencia: Optional[int] = None
    leido: bool
    fecha_creacion: Optional[str] = None
