from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Constants.Roles import ROL_GERENTE_GENERAL, ROL_CONTADOR, ROL_SUPERVISOR

AuditRouter = APIRouter(prefix="/admin/auditoria", tags=["Administración - Auditoría Transaccional"])

# Roles autorizados para consultar logs de auditoría (HU-16, HU-37)
PERMISOS_AUDITORIA = [ROL_GERENTE_GENERAL, ROL_CONTADOR]

@AuditRouter.get("", response_model=dict)
def listar_auditoria(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    tabla: Optional[str] = Query(None, description="Filtrar por tabla afectada"),
    accion: Optional[str] = Query(None, description="Filtrar por acción (CREACION, MODIFICACION, ELIMINACION, CIERRE)"),
    id_usuario: Optional[int] = Query(None, description="Filtrar por usuario responsable"),
    fecha_inicio: Optional[date] = Query(None, description="Fecha desde"),
    fecha_fin: Optional[date] = Query(None, description="Fecha hasta"),
    busqueda: Optional[str] = Query(None, description="Texto libre en detalle"),
    db: Session = Depends(get_db),
    usuario_actual: dict = Depends(require_role(PERMISOS_AUDITORIA))
):
    offset = (page - 1) * limit
    where_clauses = ["1=1"]
    params = {"limit": limit, "offset": offset}

    if tabla:
        where_clauses.append('a."TablaAfectada" ILIKE :tabla')
        params["tabla"] = f"%{tabla}%"

    if accion:
        where_clauses.append('a."Accion" = :accion')
        params["accion"] = accion

    if id_usuario:
        where_clauses.append('a."IdUsuario" = :id_usuario')
        params["id_usuario"] = id_usuario

    if fecha_inicio:
        where_clauses.append('a."FechaHora"::date >= :fecha_inicio')
        params["fecha_inicio"] = fecha_inicio

    if fecha_fin:
        where_clauses.append('a."FechaHora"::date <= :fecha_fin')
        params["fecha_fin"] = fecha_fin

    if busqueda:
        where_clauses.append('(a."Detalle" ILIKE :busqueda OR a."TablaAfectada" ILIKE :busqueda OR a."IdRegistroAfectado" ILIKE :busqueda)')
        params["busqueda"] = f"%{busqueda}%"

    where_sql = " AND ".join(where_clauses)

    sql_count = f"""
        SELECT COUNT(*) as total
        FROM "AuditLog" a
        WHERE {where_sql};
    """
    total_res = db.execute(text(sql_count), params).fetchone()
    total_items = total_res[0] if total_res else 0

    sql_items = f"""
        SELECT 
            a."IdAuditLog",
            a."IdUsuario",
            CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "NombreUsuario",
            u."Ci" as "CiUsuario",
            r."NombreRol",
            a."Accion",
            a."TablaAfectada",
            a."IdRegistroAfectado",
            a."DireccionIp",
            a."FechaHora",
            a."Detalle"
        FROM "AuditLog" a
        LEFT JOIN "Usuario" u ON a."IdUsuario" = u."IdUsuario"
        LEFT JOIN "Rol" r ON u."IdRol" = r."IdRol"
        WHERE {where_sql}
        ORDER BY a."FechaHora" DESC
        LIMIT :limit OFFSET :offset;
    """
    rows = db.execute(text(sql_items), params).mappings().fetchall()
    items = [dict(r) for r in rows]

    total_paginas = (total_items + limit - 1) // limit if total_items > 0 else 1

    return {
        "items": items,
        "total": total_items,
        "page": page,
        "limit": limit,
        "total_paginas": total_paginas
    }

@AuditRouter.get("/{id_audit}", response_model=dict)
def obtener_detalle_auditoria(
    id_audit: int,
    db: Session = Depends(get_db),
    usuario_actual: dict = Depends(require_role(PERMISOS_AUDITORIA))
):
    sql = """
        SELECT 
            a."IdAuditLog",
            a."IdUsuario",
            CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "NombreUsuario",
            r."NombreRol",
            a."Accion",
            a."TablaAfectada",
            a."IdRegistroAfectado",
            a."DatosAnteriores",
            a."DatosNuevos",
            a."DireccionIp",
            a."FechaHora",
            a."Detalle"
        FROM "AuditLog" a
        LEFT JOIN "Usuario" u ON a."IdUsuario" = u."IdUsuario"
        LEFT JOIN "Rol" r ON u."IdRol" = r."IdRol"
        WHERE a."IdAuditLog" = :id_audit;
    """
    row = db.execute(text(sql), {"id_audit": id_audit}).mappings().fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro de auditoría no encontrado")
    return dict(row)
