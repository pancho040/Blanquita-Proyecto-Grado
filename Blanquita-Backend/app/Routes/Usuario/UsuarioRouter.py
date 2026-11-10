from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.Auth.Dependencies import get_current_user, require_admin_db
from app.Config.supabase import get_db
from app.Models.Usuario.Usuario import (
    PerfilUpdate,
    UsuarioCreate,
    UsuarioPerfil,
    UsuarioResponse,
)
from app.Services.Usuario.UsuarioService import UsuarioService


UsuarioRouter = APIRouter(prefix="/Usuario", tags=["Funciones Usuario"])


def get_usuario_service(db: Session = Depends(get_db)) -> UsuarioService:
    return UsuarioService(db)


@UsuarioRouter.post(
    "/crear",
    response_model=UsuarioResponse,
    status_code=status.HTTP_201_CREATED,
)
def CrearUsuario(
    datos: UsuarioCreate,
    service: UsuarioService = Depends(get_usuario_service),
    usuario_actual: dict = Depends(require_admin_db),
):
    return service.CrearUsuario(datos)

@UsuarioRouter.get(
    "/ver",
    response_model=UsuarioPerfil,
)
def VerPerfil(
    service: UsuarioService = Depends(get_usuario_service),
    usuario_actual: dict = Depends(get_current_user),
):
    return service.ObtenerPerfil(usuario_actual)

@UsuarioRouter.post(
    "/editar",
    response_model=UsuarioPerfil,
)
def EditarPerfil(
    datos: PerfilUpdate,
    service: UsuarioService = Depends(get_usuario_service),
    usuario_actual: dict = Depends(get_current_user),
):
    return service.EditarPerfil(usuario_actual, datos)


@UsuarioRouter.get(
    "/listar",
    response_model=list[dict],
)
def ListarUsuarios(
    service: UsuarioService = Depends(get_usuario_service),
    usuario_actual: dict = Depends(require_admin_db),
):
    """Lista todos los colaboradores registrados con su rol y sucursal asignada."""
    return service.ListarUsuarios()


@UsuarioRouter.put(
    "/{id_usuario}/sucursal",
    response_model=dict,
)
def ActualizarSucursal(
    id_usuario: int,
    id_sucursal: int | None = None,
    service: UsuarioService = Depends(get_usuario_service),
    usuario_actual: dict = Depends(require_admin_db),
):
    """Configura la sucursal de operación asignada a un colaborador (o null para multisede)."""
    return service.ActualizarSucursalUsuario(id_usuario, id_sucursal)