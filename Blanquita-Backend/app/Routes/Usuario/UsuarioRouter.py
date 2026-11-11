from typing import Optional
from fastapi import APIRouter, Depends, status, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.Auth.Dependencies import get_current_user, require_admin_db
from app.Config.supabase import get_db
from app.Auth.AlcanceSucursal import resolver_alcance_usuario
from app.Constants.Roles import ROL_GERENTE_GENERAL
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
    db: Session = Depends(get_db),
):
    # RBAC Estricto: Únicamente el Gerente General (IdRol = 3) tiene autorización para crear colaboradores o asignar roles.
    # Un usuario con IsAdmin = true de otro rol (ej. Líder de Inventario IdRol=2) NO está autorizado (403 Forbidden).
    if int(usuario_actual.get("IdRol", 0)) != ROL_GERENTE_GENERAL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación restringida: únicamente el Gerente General tiene autorización para registrar colaboradores o asignar roles."
        )

    # Validar que la sucursal asignada exista y esté activa (si se especifica)
    if datos.IdSucursal is not None:
        suc = db.execute(text("SELECT id FROM sucursales WHERE id = :sid AND activa = true"), {"sid": datos.IdSucursal}).fetchone()
        if not suc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sucursal inválida o inactiva (ID {datos.IdSucursal})."
            )

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
    id_sucursal: Optional[int] = Query(None, description="Filtrar por sucursal (solo multisede)"),
    service: UsuarioService = Depends(get_usuario_service),
    usuario_actual: dict = Depends(require_admin_db),
    db: Session = Depends(get_db),
):
    """
    Lista los colaboradores registrados.
    Aplica principio de fallo cerrado y aislamiento estricto:
    Un usuario sin permiso multisede explícito solo puede ver los colaboradores de su propia sucursal,
    incluso si posee la marca IsAdmin = true.
    """
    id_u = int(usuario_actual.get("IdUsuario") or usuario_actual.get("id") or 0)
    alcance = resolver_alcance_usuario(id_usuario=id_u, db=db)

    if not alcance.puede_ver_todas:
        # Sede fija: aislamiento estricto
        sucursal_efectiva = alcance.sucursal_asignada_defecto or (alcance.sucursales_permitidas[0] if alcance.sucursales_permitidas else None)
        return service.ListarUsuarios(sucursal_id=sucursal_efectiva)

    # Multisede: puede ver todas o filtrar por la sucursal solicitada
    return service.ListarUsuarios(sucursal_id=id_sucursal)


@UsuarioRouter.get(
    "/mi-alcance",
    response_model=dict,
)
def ObtenerMiAlcance(
    usuario_actual: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna las sucursales permitidas y estado multisede del usuario autenticado."""
    id_u = int(usuario_actual.get("IdUsuario") or usuario_actual.get("id") or 0)
    alcance = resolver_alcance_usuario(id_usuario=id_u, db=db)
    
    # Obtener nombres de las sucursales
    sucursales_db = db.execute(text("SELECT id, nombre, ciudad FROM sucursales WHERE activa = true ORDER BY id")).fetchall()
    mapa_sucursales = {s[0]: {"id": s[0], "nombre": s[1], "ciudad": s[2]} for s in sucursales_db}
    
    lista_permitidas = [mapa_sucursales[sid] for sid in alcance.sucursales_permitidas if sid in mapa_sucursales]
    
    return {
        "id_usuario": id_u,
        "puede_ver_todas": alcance.puede_ver_todas,
        "sucursal_defecto": alcance.sucursal_asignada_defecto or (alcance.sucursales_permitidas[0] if alcance.sucursales_permitidas else 1),
        "sucursales_permitidas": lista_permitidas,
    }


@UsuarioRouter.put(
    "/{id_usuario}/sucursal",
    response_model=dict,
)
def ActualizarSucursal(
    id_usuario: int,
    id_sucursal: int | None = None,
    puede_ver_todas: bool = False,
    service: UsuarioService = Depends(get_usuario_service),
    usuario_actual: dict = Depends(require_admin_db),
    db: Session = Depends(get_db),
):
    """
    Configura la sucursal de operación y permisos explícitos de un colaborador.
    Regla estricta: Nadie puede auto-ampliarse su propio alcance.
    """
    admin_id = int(usuario_actual.get("IdUsuario") or usuario_actual.get("id") or 0)
    
    # Decisión explícita: Modificación de permisos de sucursal reservada SOLO al Gerente General (IdRol = 3)
    if int(usuario_actual.get("IdRol", 0)) != ROL_GERENTE_GENERAL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación restringida: únicamente el Gerente General tiene autorización para modificar permisos de sucursales."
        )

    # Bloqueo de auto-ampliación
    if int(id_usuario) == admin_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación no permitida: ningún colaborador puede modificar o ampliar su propio alcance de sucursales."
        )

    # 1. Actualizar IdSucursal en tabla Usuario
    resultado = service.ActualizarSucursalUsuario(id_usuario, id_sucursal)

    # 2. Sincronizar usuario_sucursal_permiso de forma explícita
    if puede_ver_todas:
        # Multisede: fila con id_sucursal=NULL (puede_ver_todas=True) y filas para 1 y 2
        db.execute(text("""
            INSERT INTO usuario_sucursal_permiso (id_usuario, id_sucursal, puede_ver_todas, puede_escribir, creado_por)
            VALUES (:uid, NULL, true, true, :admin_id)
            ON CONFLICT DO NOTHING;
            INSERT INTO usuario_sucursal_permiso (id_usuario, id_sucursal, puede_ver_todas, puede_escribir, creado_por)
            VALUES (:uid, 1, false, true, :admin_id)
            ON CONFLICT DO NOTHING;
            INSERT INTO usuario_sucursal_permiso (id_usuario, id_sucursal, puede_ver_todas, puede_escribir, creado_por)
            VALUES (:uid, 2, false, true, :admin_id)
            ON CONFLICT DO NOTHING;
        """), {"uid": id_usuario, "admin_id": admin_id})
    else:
        # Sede fija: eliminar permiso 'todas' y restringir a la sucursal asignada
        db.execute(text("""
            DELETE FROM usuario_sucursal_permiso 
            WHERE id_usuario = :uid;
        """), {"uid": id_usuario})
        
        sid_efectivo = id_sucursal or 1
        db.execute(text("""
            INSERT INTO usuario_sucursal_permiso (id_usuario, id_sucursal, puede_ver_todas, puede_escribir, creado_por)
            VALUES (:uid, :sid, false, true, :admin_id);
        """), {"uid": id_usuario, "sid": sid_efectivo, "admin_id": admin_id})

    # 3. Registrar auditoría
    try:
        db.execute(text("""
            INSERT INTO auditoria_transaccional (tabla, accion, id_registro, id_usuario, detalle, fecha)
            VALUES ('Usuario', 'ACTUALIZAR_SUCURSAL', :uid, :admin_id, :det, now())
        """), {
            "uid": id_usuario,
            "admin_id": admin_id,
            "det": f"Cambio de sucursal a {id_sucursal} (multisede: {puede_ver_todas}) realizado por admin {admin_id}"
        })
    except Exception:
        pass # Si la tabla auditoria_transaccional tiene otro formato, no bloquear la transacción

    db.commit()
    return resultado


@UsuarioRouter.get(
    "/roles",
    response_model=list[dict],
)
def ListarRoles(
    usuario_actual: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retorna el catálogo de roles del sistema.
    Solo accesible por Gerente General (IdRol = 3).
    """
    if int(usuario_actual.get("IdRol", 0)) != ROL_GERENTE_GENERAL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación restringida: únicamente el Gerente General puede consultar y administrar roles del sistema."
        )
    roles = db.execute(text('SELECT "IdRol", "NombreRol", "Descripcion" FROM "Rol" ORDER BY "IdRol"')).fetchall()
    return [{"IdRol": r[0], "Nombre": r[1], "Descripcion": r[2]} for r in roles]


@UsuarioRouter.put(
    "/{id_usuario}/rol",
    response_model=dict,
)
def ActualizarRolUsuario(
    id_usuario: int,
    id_rol: int = Query(..., description="Nuevo ID de Rol"),
    usuario_actual: dict = Depends(require_admin_db),
    db: Session = Depends(get_db),
):
    """
    Asigna un nuevo rol a un colaborador.
    Exclusivo para Gerente General (IdRol = 3).
    """
    if int(usuario_actual.get("IdRol", 0)) != ROL_GERENTE_GENERAL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación restringida: únicamente el Gerente General tiene autorización para modificar roles de colaboradores."
        )
    # Bloqueo de auto-modificación de rol
    admin_id = int(usuario_actual.get("IdUsuario") or usuario_actual.get("id") or 0)
    if int(id_usuario) == admin_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación no permitida: ningún colaborador puede modificar su propio rol."
        )

    # Validar que el rol exista
    rol = db.execute(text('SELECT "IdRol" FROM "Rol" WHERE "IdRol" = :rid'), {"rid": id_rol}).fetchone()
    if not rol:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El rol especificado no existe.")

    db.execute(text('UPDATE "Usuario" SET "IdRol" = :rid WHERE "IdUsuario" = :uid'), {"rid": id_rol, "uid": id_usuario})
    db.commit()
    return {"mensaje": f"Rol actualizado a {id_rol} para usuario {id_usuario}"}
