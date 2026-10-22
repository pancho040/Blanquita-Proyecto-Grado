from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.Auth.Dependencies import get_current_user, require_admin_db
from app.Config.supabase import get_db
from app.Models.Usuario.Usuario import (
    CambiarAdminUsuarioRequest,
    CambiarAdminUsuarioResponse,
    CambiarEstadoUsuarioRequest,
    CambiarEstadoUsuarioResponse,
    CambiarRolUsuarioRequest,
    CambiarRolUsuarioResponse,
    EditarUsuarioRequest,
    EditarUsuarioResponse,
    ListarUsuariosRequest,
    ListarUsuariosResponse,
    RestablecerClaveRequest,
    RestablecerClaveResponse,
    UsuarioCreate,
    UsuarioDetalle,
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
    return service.CrearUsuario(datos, usuario_actual["IdUsuario"])

@UsuarioRouter.get(
    "/listar",
    response_model=ListarUsuariosResponse,
)
def ListarUsuarios(
    IdEstadoUsuario: int | None = None,
    IdRol: int | None = None,
    Busqueda: str | None = Query(default=None, max_length=50),
    Pagina: int = Query(default=1, ge=1),
    TamanoPagina: int = Query(default=20, ge=1, le=100),
    service: UsuarioService = Depends(get_usuario_service),
    usuario_actual: dict = Depends(require_admin_db),
):
    return service.ListarUsuarios(
        ListarUsuariosRequest(
            IdEstadoUsuario=IdEstadoUsuario,
            IdRol=IdRol,
            Busqueda=Busqueda,
            Pagina=Pagina,
            TamanoPagina=TamanoPagina,
        )
    )

@UsuarioRouter.get(
    "/detalle",
    response_model=UsuarioDetalle,
)
def DetalleUsuario(
    IdUsuario: int = Query(..., gt=0),
    service: UsuarioService = Depends(get_usuario_service),
    usuario_actual: dict = Depends(require_admin_db),
):
    return service.ObtenerDetalle(IdUsuario)

@UsuarioRouter.patch(
    "/rol",
    response_model=CambiarRolUsuarioResponse,
)
def CambiarRolUsuario(
    datos: CambiarRolUsuarioRequest,
    service: UsuarioService = Depends(get_usuario_service),
    usuario_actual: dict = Depends(require_admin_db),
):
    return service.CambiarRolUsuario(datos, usuario_actual["IdUsuario"])

@UsuarioRouter.patch(
    "/admin",
    response_model=CambiarAdminUsuarioResponse,
)
def CambiarAdminUsuario(
    datos: CambiarAdminUsuarioRequest,
    service: UsuarioService = Depends(get_usuario_service),
    usuario_actual: dict = Depends(require_admin_db),
):
    return service.CambiarAdminUsuario(datos, usuario_actual["IdUsuario"])

@UsuarioRouter.patch(
    "/estado",
    response_model=CambiarEstadoUsuarioResponse,
)
def CambiarEstadoUsuario(
    datos: CambiarEstadoUsuarioRequest,
    service: UsuarioService = Depends(get_usuario_service),
    usuario_actual: dict = Depends(require_admin_db),
):
    return service.CambiarEstadoUsuario(datos, usuario_actual["IdUsuario"])

@UsuarioRouter.patch(
    "/clave",
    response_model=RestablecerClaveResponse,
)
def RestablecerClave(
    datos: RestablecerClaveRequest,
    service: UsuarioService = Depends(get_usuario_service),
    usuario_actual: dict = Depends(require_admin_db),
):
    return service.RestablecerClave(datos, usuario_actual["IdUsuario"])

@UsuarioRouter.get(
    "/ver",
    response_model=UsuarioPerfil,
)
def VerPerfil(
    service: UsuarioService = Depends(get_usuario_service),
    usuario_actual: dict = Depends(get_current_user),
):
    return service.ObtenerPerfil(usuario_actual)

@UsuarioRouter.patch(
    "/editar",
    response_model=EditarUsuarioResponse,
)
def EditarUsuario(
    datos: EditarUsuarioRequest,
    service: UsuarioService = Depends(get_usuario_service),
    usuario_actual: dict = Depends(require_admin_db),
):
    return service.EditarUsuario(datos, usuario_actual["IdUsuario"])