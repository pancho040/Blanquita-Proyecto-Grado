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


def get_current_user(
    credenciales: HTTPAuthorizationCredentials = Depends(seguridad),
    db: Session = Depends(get_db)
) -> dict:
    token = credenciales.credentials
    payload = verificar_token(token)
    metadata = payload.get("app_metadata", {})

    id_usuario = metadata.get("IdUsuario")
    id_rol = metadata.get("IdRol")
    id_estado = metadata.get("IdEstadoUsuario")
    is_admin = bool(metadata.get("IsAdmin", False))
    auth_user_id = payload.get("sub")

    # Si falta IdUsuario o IdRol en app_metadata (hook deshabilitado, RLS o token basico),
    # resolver la identidad directamente desde la tabla Usuario usando la sesion de BD.
    if id_usuario is None or id_rol is None:
        if auth_user_id:
            from sqlalchemy import text
            row = db.execute(
                text('SELECT "IdUsuario", "IdRol", "IdEstadoUsuario", "IsAdmin" FROM public."Usuario" WHERE "AuthUserId" = :sub LIMIT 1;'),
                {"sub": auth_user_id}
            ).fetchone()
            if row:
                id_usuario = row[0]
                id_rol = row[1]
                id_estado = row[2]
                is_admin = bool(row[3])
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Usuario no registrado en el sistema"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Token no contiene identificador de autenticación"
            )
    else:
        # Si venian en metadata, verificar en tiempo real el estado activo en base de datos.
        # Garantiza que un usuario desactivado remotamente recibe 403 de inmediato
        # aunque su JWT siga tecnicamente vigente.
        from sqlalchemy import text
        estado_actual = db.execute(
            text('SELECT "IdEstadoUsuario" FROM public."Usuario" WHERE "IdUsuario" = :uid LIMIT 1;'),
            {"uid": int(id_usuario)}
        ).scalar()
        if estado_actual is not None:
            id_estado = estado_actual

    if id_estado != ESTADO_USUARIO_ACTIVO:
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
        "IdEstadoUsuario": id_estado,
        "IsAdmin": is_admin,
        "AuthUserId": auth_user_id,
        "Correo": payload.get("email"),
    }


def require_role(roles_permitidos: list[int]):
    def verificar_rol(usuario_actual: dict = Depends(get_current_user)) -> dict:
        # RBAC Estricto: la autorización se rige exclusivamente por IdRol.
        # IsAdmin no otorga bypass arbitrario sobre endpoints restringidos.
        if usuario_actual.get("IdRol") not in roles_permitidos:
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