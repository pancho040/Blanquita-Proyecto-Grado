"""
Módulo Central de Alcance de Sucursales y Autorización Multisede (Fase 1)
Sistema Integral ERP Papelera Blanquita

Reglas:
1. Permiso explícito y fallo cerrado: Se consulta usuario_sucursal_permiso.
2. Si un usuario sin 'puede_ver_todas' pide otra sucursal -> 403 Forbidden.
3. Si un usuario no envía sucursal, se fuerza la suya (fallo seguro).
4. Verificación por recurso (IDOR) en consultas puntuales por ID.
5. Verificación de envíos (origen o destino).
"""

from typing import Optional, List, Union, Any
from dataclasses import dataclass
from fastapi import Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.Config.supabase import get_db
from app.Auth.Dependencies import get_current_user

@dataclass
class AlcanceUsuario:
    id_usuario: int
    puede_ver_todas: bool
    sucursales_permitidas: List[int]
    sucursal_efectiva: Optional[int] # None = consolidado ('todas'), int = filtro forzado
    sucursal_asignada_defecto: Optional[int]

    def tiene_acceso_a_sucursal(self, id_sucursal: Optional[int]) -> bool:
        if id_sucursal is None:
            return self.puede_ver_todas
        return self.puede_ver_todas or (id_sucursal in self.sucursales_permitidas)

    def validar_recurso(
        self,
        id_sucursal_recurso: Optional[int],
        nombre_recurso: str = "registro",
        responder_404: bool = False,
        db: Optional[Session] = None
    ) -> None:
        if id_sucursal_recurso is None:
            return
        if not self.tiene_acceso_a_sucursal(id_sucursal_recurso):
            if db:
                try:
                    stmt = text("""
                        INSERT INTO public."AuditLog" (
                            "FechaHora", "IdUsuario", "Accion", "TablaAfectada", "IdRegistroAfectado", "Detalle"
                        ) VALUES (
                            NOW(), :uid, :acc, 'SeguridadSucursal', :reg, :det
                        )
                    """)
                    acc = "IDOR_RECURSO_AJENO_404" if responder_404 else "ACCESO_CRUZADO_DENEGADO_403"
                    db.execute(stmt, {
                        "uid": self.id_usuario,
                        "acc": acc,
                        "reg": str(id_sucursal_recurso or 0),
                        "det": f"Intento de acceso a {nombre_recurso} perteneciente a sucursal {id_sucursal_recurso}"
                    })
                    db.flush()
                except Exception:
                    pass
            if responder_404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"{nombre_recurso.capitalize()} no encontrado"
                )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado: este {nombre_recurso} pertenece a una sucursal ({id_sucursal_recurso}) fuera de su alcance autorizado."
            )

    def validar_envio(self, id_origen: int, id_destino: int) -> None:
        if self.puede_ver_todas:
            return
        if id_origen not in self.sucursales_permitidas and id_destino not in self.sucursales_permitidas:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso denegado: el envío no involucra a su sucursal autorizada como origen ni como destino."
            )

    def validar_escritura(self, id_sucursal_operacion: Optional[Union[int, str]] = None) -> int:
        """
        Regla de Oro para Escrituras (Fase 2):
        Con alcance consolidado (sucursal_efectiva is None), toda escritura debe exigir
        una sucursal explícita validada en el backend, aunque puede_escribir sea true.
        Para usuario de sede fija, se valida que coincida o se fuerza su sede autorizada.
        """
        sid_operacion: Optional[int] = None
        if id_sucursal_operacion is not None:
            try:
                sid_operacion = int(id_sucursal_operacion)
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Identificador de sucursal inválido: '{id_sucursal_operacion}'"
                )

        if self.sucursal_efectiva is None:
            # Alcance consolidado (multisede sin filtro fijado)
            if sid_operacion is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="En modo consolidado/multisede debe especificar explícitamente la sucursal para realizar esta operación."
                )
            if not self.tiene_acceso_a_sucursal(sid_operacion):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"No tiene autorización para registrar operaciones en la sucursal {sid_operacion}."
                )
            return sid_operacion
        else:
            # Sede fija o filtro específico fijado
            sede_fija = self.sucursal_efectiva
            if sid_operacion is not None and sid_operacion != sede_fija:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"No puede registrar operaciones en la sucursal {sid_operacion}. Su sede autorizada es la {sede_fija}."
                )
            return sede_fija


def resolver_alcance_usuario(
    id_usuario: int,
    db: Session,
    sucursal_solicitada: Optional[Union[int, str]] = None
) -> AlcanceUsuario:
    """
    Resuelve el alcance de sucursales para un usuario desde la tabla usuario_sucursal_permiso.
    Aplica principio de fallo cerrado y no confía en heurísticas de cliente.
    """
    # 1. Consultar permisos en usuario_sucursal_permiso
    sql_permisos = text("""
        SELECT id_sucursal, puede_ver_todas, puede_escribir
        FROM usuario_sucursal_permiso
        WHERE id_usuario = :id_usuario
    """)
    filas = db.execute(sql_permisos, {"id_usuario": id_usuario}).fetchall()

    puede_ver_todas = False
    sucursales_permitidas: List[int] = []

    # Consultar IdSucursal asignado en Usuario (sede base por defecto)
    sql_user = text('SELECT "IdSucursal" FROM "Usuario" WHERE "IdUsuario" = :id_usuario')
    user_row = db.execute(sql_user, {"id_usuario": id_usuario}).fetchone()
    sucursal_defecto = user_row[0] if user_row else None

    if filas:
        for r in filas:
            if r[1]: # puede_ver_todas
                puede_ver_todas = True
            if r[0] is not None and r[0] not in sucursales_permitidas:
                sucursales_permitidas.append(int(r[0]))
    else:
        # Fallo cerrado: si no tiene filas en usuario_sucursal_permiso, solo su IdSucursal asignado
        if sucursal_defecto is not None:
            sucursales_permitidas = [int(sucursal_defecto)]
            puede_ver_todas = False
        else:
            # No tiene permisos ni sucursal asignada: alcance vacío
            sucursales_permitidas = []
            puede_ver_todas = False

    # CAUSA RAÍZ MULTISEDE:
    # Si el usuario tiene una fila con puede_ver_todas=true, sus sucursales_permitidas
    # son TODAS las sucursales activas de la tabla sucursales, sin depender de filas
    # individuales por sede en usuario_sucursal_permiso.
    if puede_ver_todas:
        try:
            sql_activas = text("SELECT id FROM sucursales WHERE activa = true ORDER BY id")
            filas_activas = db.execute(sql_activas).fetchall()
            activas = [int(r[0]) for r in filas_activas if r[0] is not None]
            if activas:
                sucursales_permitidas = activas
        except Exception:
            pass

    # 2. Normalizar la sucursal solicitada
    sid_limpio: Optional[int] = None
    pidio_todas: bool = False
    if sucursal_solicitada is not None:
        str_val = str(sucursal_solicitada).strip().lower()
        if str_val in ("todas", "all"):
            pidio_todas = True
        elif str_val not in ("", "null", "none", "0"):
            try:
                sid_limpio = int(str_val)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Parámetro de sucursal inválido: '{sucursal_solicitada}'"
                )

    # 3. Resolver sucursal efectiva y aplicar reglas estrictas de autorización
    if pidio_todas:
        if not puede_ver_todas:
            auditar_acceso_cruzado_denegado(
                db=db,
                id_usuario=id_usuario,
                endpoint="alcance_sucursal",
                sucursal_solicitada="todas",
                detalle="Intento no autorizado de consultar vista consolidada 'todas' desde sede fija."
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene autorización para acceder a la vista consolidada de todas las sucursales."
            )
        sucursal_efectiva = None # Consolidado nacional explícito
    elif sid_limpio is not None:
        # El usuario pidió una sucursal específica
        if puede_ver_todas or (sid_limpio in sucursales_permitidas):
            sucursal_efectiva = sid_limpio
        else:
            auditar_acceso_cruzado_denegado(
                db=db,
                id_usuario=id_usuario,
                endpoint="alcance_sucursal",
                sucursal_solicitada=sid_limpio,
                detalle=f"Intento de acceso denegado a sucursal {sid_limpio} no asignada."
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No tiene autorización para acceder a los datos de la sucursal {sid_limpio}."
            )
    else:
        # El usuario no especificó sucursal (sucursal_solicitada is None o "")
        if puede_ver_todas:
            sucursal_efectiva = None # Consolidado nacional autorizado por omisión
        else:
            if not sucursales_permitidas:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="El usuario no tiene ninguna sucursal asignada o autorizada en el sistema."
                )
            # Para usuario de sede fija: forzar su sucursal permitida
            sucursal_efectiva = sucursal_defecto if sucursal_defecto in sucursales_permitidas else sucursales_permitidas[0]

    return AlcanceUsuario(
        id_usuario=id_usuario,
        puede_ver_todas=puede_ver_todas,
        sucursales_permitidas=sorted(sucursales_permitidas),
        sucursal_efectiva=sucursal_efectiva,
        sucursal_asignada_defecto=sucursal_defecto
    )


def DependenciaAlcanceSucursal(
    id_sucursal: Optional[Union[int, str]] = Query(None, alias="id_sucursal"),
    filtro_sucursal_id: Optional[Union[int, str]] = Query(None, alias="sucursal_id"),
    usuario: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> AlcanceUsuario:
    """
    Inyección de dependencia FastAPI para endpoints con alcance multi-sucursal.
    Acepta tanto ?id_sucursal=X como ?sucursal_id=X para máxima compatibilidad.
    """
    id_usuario = int(usuario.get("IdUsuario") or usuario.get("id") or 0)
    solicitada = id_sucursal if id_sucursal is not None else filtro_sucursal_id
    return resolver_alcance_usuario(
        id_usuario=id_usuario,
        db=db,
        sucursal_solicitada=solicitada
    )


def obtener_caja_para_alcance(db: Session, alcance: AlcanceUsuario) -> dict:
    """
    Resuelve la caja correspondiente a la sucursal del alcance de forma dinámica,
    eliminando todo hardcode de id_caja = 1.
    Si el usuario tiene alcance consolidado y no especificó sucursal, rechaza con 400 Bad Request.
    """
    if alcance.puede_ver_todas and alcance.sucursal_efectiva is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe especificar una sucursal para consultar el estado o realizar operaciones de caja en modo consolidado."
        )

    sid = alcance.sucursal_efectiva or alcance.sucursal_asignada_defecto
    if sid is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo determinar la sucursal para la operación de caja."
        )

    sql = text("""
        SELECT "IdCaja", "NombreCaja", "Descripcion", "Activa", "IdSucursal"
        FROM "Caja"
        WHERE "IdSucursal" = :sid AND "Activa" = true
        ORDER BY "IdCaja" ASC
        LIMIT 1
    """)
    caja = db.execute(sql, {"sid": sid}).mappings().fetchone()
    if not caja:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró una caja activa configurada para la sucursal {sid}"
        )
    return dict(caja)


def auditar_acceso_cruzado_denegado(
    db: Session,
    id_usuario: int,
    endpoint: str,
    sucursal_solicitada: Any,
    detalle: Optional[str] = None
) -> None:
    """Registra en AuditLog los accesos denegados por intentar acceder a otra sede."""
    try:
        stmt = text("""
            INSERT INTO public."AuditLog" (
                "FechaHora", "IdUsuario", "Accion", "TablaAfectada", "IdRegistroAfectado", "Detalle"
            ) VALUES (
                NOW(), :uid, 'ACCESO_CRUZADO_DENEGADO_403', 'SeguridadSucursal', :reg, :det
            )
        """)
        db.execute(stmt, {
            "uid": id_usuario,
            "reg": str(sucursal_solicitada or 0),
            "det": detalle or f"Acceso denegado a sucursal {sucursal_solicitada} en {endpoint}"
        })
        db.flush()
    except Exception:
        pass
