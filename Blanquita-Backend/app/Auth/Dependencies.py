from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.Auth.Jwt import verificar_token
from app.Config.supabase import get_db
from app.Repository.Usuario.UsuarioRepository import UsuarioRepository

seguridad = HTTPBearer()

ESTADO_USUARIO_ACTIVO = 1
ESTADO_USUARIO_INACTIVO = 2
ESTADO_USUARIO_SUSPENDIDO = 3

MENSAJE_POR_ESTADO = {
    ESTADO_USUARIO_INACTIVO: "Usuario inactivo, no puede operar el sistema",
    ESTADO_USUARIO_SUSPENDIDO: "Usuario suspendido, no puede operar el sistema",
}


def get_current_user(credenciales: HTTPAuthorizationCredentials = Depends(seguridad)) -> dict:
    token = credenciales.credentials
    payload = verificar_token(token)
    metadata = payload.get("app_metadata", {})

    id_usuario = metadata.get("IdUsuario")
    id_rol = metadata.get("IdRol")
    if id_usuario is None or id_rol is None:
        id_estado = metadata.get("IdEstadoUsuario")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=MENSAJE_POR_ESTADO.get(
                id_estado,
                "Usuario no habilitado para operar el sistema"
            )
        )

    return {
        "IdUsuario": int(id_usuario),
        "IdRol": int(id_rol),
        "IdEstadoUsuario": metadata.get("IdEstadoUsuario"),
        "IsAdmin": bool(metadata.get("IsAdmin", False)),
        "AuthUserId": payload.get("sub"),
        "Correo": payload.get("email"),
    }


def require_role(roles_permitidos: list[int]):
    def verificar_rol(usuario_actual: dict = Depends(get_current_user)) -> dict:
        if usuario_actual.get("IsAdmin"):
            return usuario_actual
        if usuario_actual["IdRol"] not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para realizar esta acción"
            )
        return usuario_actual

    return verificar_rol


def require_admin(usuario_actual: dict = Depends(get_current_user)) -> dict:
    if not usuario_actual["IsAdmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requiere permisos de administrador"
        )
    return usuario_actual


def require_admin_db(
    usuario_actual: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    fila = UsuarioRepository(db).VerificarAdmin(
        {"p_IdUsuario": usuario_actual["IdUsuario"]}
    )

    if (
        fila is None
        or not fila["EsAdminOut"]
        or fila["IdEstadoUsuarioOut"] != ESTADO_USUARIO_ACTIVO
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requiere permisos de administrador"
        )

    usuario_actual["IsAdmin"] = True
    return usuario_actual