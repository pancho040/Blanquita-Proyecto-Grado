"""Router de Server-Sent Events (SSE) para eventos de Logística y Flota en tiempo real.
Conectado a la outbox persistente evento_logistica con LISTEN/NOTIFY y soporte Last-Event-ID.
"""
import asyncio
import json
from typing import Optional

from fastapi import APIRouter, Request, Query, Header, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from starlette.concurrency import run_in_threadpool

from app.core.serializers import json_dumps_safe
from app.Auth.Jwt import verificar_token
from app.Config.supabase import SessionLocal
from app.Constants.Roles import (
    ROL_SUPERVISOR,
    ROL_CHOFER,
    ROL_GERENTE_GENERAL,
    ROL_CONTADOR,
    ROL_DISTRIBUIDOR
)

SSERouter = APIRouter(prefix="/logistica/eventos", tags=["Logística - Tiempo Real SSE"])

ROLES_PERMITIDOS = [
    ROL_SUPERVISOR,
    ROL_CHOFER,
    ROL_GERENTE_GENERAL,
    ROL_CONTADOR,
    ROL_DISTRIBUIDOR
]


def resolver_usuario_sse(
    request: Request,
    auth_header: Optional[str] = None
) -> dict:
    """Extrae y valida el JWT exclusivamente desde cabecera Authorization: Bearer o cookie segura."""
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    elif "access_token" in request.cookies:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se proporcionó token de autenticación en cabecera Authorization: Bearer"
        )

    try:
        payload = verificar_token(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido o expirado: {str(e)}"
        )

    metadata = payload.get("app_metadata", {})
    id_usuario = metadata.get("IdUsuario")
    id_rol = metadata.get("IdRol")
    id_sucursal = metadata.get("IdSucursal")
    auth_user_id = payload.get("sub")

    if id_usuario is None or id_rol is None:
        db = SessionLocal()
        try:
            row = db.execute(
                text('SELECT "IdUsuario", "IdRol", "IdSucursal", "IdEstadoUsuario" FROM public."Usuario" WHERE "AuthUserId" = :sub LIMIT 1;'),
                {"sub": auth_user_id}
            ).fetchone()
            if row:
                id_usuario = row[0]
                id_rol = row[1]
                id_sucursal = row[2]
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Usuario no registrado en el sistema"
                )
        finally:
            db.close()

    if id_rol not in ROLES_PERMITIDOS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para suscribirte a eventos de logística"
        )

    return {
        "IdUsuario": int(id_usuario),
        "IdRol": int(id_rol),
        "IdSucursal": id_sucursal,
        "Email": payload.get("email")
    }


def consultar_eventos_outbox(cursor_id: int, sucursal_id: Optional[int], usuario_id: int, es_chofer: bool, limite: int = 200) -> list[dict]:
    """Consulta la tabla evento_logistica filtrando por id > cursor_id y alcance."""
    db = SessionLocal()
    try:
        filtros = ['id > :cursor_id']
        params = {"cursor_id": cursor_id, "limite": limite}

        if es_chofer:
            # Chofer solo ve sus propios eventos o broadcasts generales sin usuario específico
            filtros.append('(usuario_id = :uid OR usuario_id IS NULL)')
            params["uid"] = usuario_id
        elif sucursal_id:
            # Supervisor de sucursal ve eventos de su sede o globales
            filtros.append('(sucursal_id = :sid OR sucursal_id IS NULL)')
            params["sid"] = sucursal_id

        where_clause = " AND ".join(filtros)
        sql = f"""
            SELECT id, creado_en, sucursal_id, usuario_id, asignacion_id, tipo, payload
            FROM public.evento_logistica
            WHERE {where_clause}
            ORDER BY id ASC
            LIMIT :limite
        """
        rows = db.execute(text(sql), params).fetchall()
        eventos = []
        for r in rows:
            eventos.append({
                "id": r[0],
                "creado_en": r[1],
                "sucursal_id": r[2],
                "usuario_id": r[3],
                "asignacion_id": r[4],
                "tipo": r[5],
                "payload": r[6]
            })
        return eventos
    finally:
        db.close()


def obtener_ultimo_id_outbox() -> int:
    db = SessionLocal()
    try:
        val = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM public.evento_logistica")).scalar()
        return int(val or 0)
    finally:
        db.close()


@SSERouter.get("/stream")
async def stream_eventos_logistica(
    request: Request,
    last_event_id: Optional[str] = Header(None, alias="Last-Event-ID"),
    last_id_query: Optional[int] = Query(None, alias="last_event_id"),
    sucursal_id: Optional[int] = Query(None)
):
    """Canal Server-Sent Events (SSE) para logística y flota.
    Admite reconexión con cabecera Last-Event-ID, filtrado por sucursal y rol,
    y latidos heartbeat cada 15 segundos.
    """
    auth_header = request.headers.get("Authorization")
    usuario = resolver_usuario_sse(request, auth_header=auth_header)

    es_chofer = (usuario["IdRol"] == ROL_CHOFER)
    sucursal_efectiva = sucursal_id if sucursal_id is not None else usuario.get("IdSucursal")

    # Determinar cursor inicial
    cursor_id = 0
    if last_event_id:
        try:
            cursor_id = int(last_event_id)
        except ValueError:
            cursor_id = 0
    elif last_id_query is not None:
        cursor_id = last_id_query

    # Si es primera conexión y no solicita histórico anterior, tomar último id existente
    if cursor_id == 0 and last_event_id is None and last_id_query is None:
        cursor_id = await run_in_threadpool(obtener_ultimo_id_outbox)

    async def generador_eventos():
        nonlocal cursor_id
        # Enviar evento de conexión exitosa
        yield f"event: CONECTADO\ndata: {json.dumps({'status': 'ok', 'usuario_id': usuario['IdUsuario'], 'cursor': cursor_id})}\n\n"

        segundos_desde_ping = 0

        while True:
            if await request.is_disconnected():
                break

            # Consultar eventos pendientes en outbox
            eventos = await run_in_threadpool(
                consultar_eventos_outbox,
                cursor_id=cursor_id,
                sucursal_id=sucursal_efectiva,
                usuario_id=usuario["IdUsuario"],
                es_chofer=es_chofer,
                limite=100
            )

            if eventos:
                for ev in eventos:
                    cursor_id = ev["id"]
                    payload_str = json_dumps_safe(ev["payload"])
                    yield f"id: {ev['id']}\nevent: {ev['tipo']}\ndata: {payload_str}\n\n"
                segundos_desde_ping = 0
            else:
                # Sin eventos en este tick: sleep adaptativo rápido para latencia sub-segundo
                await asyncio.sleep(0.35)
                segundos_desde_ping += 0.35

                # Heartbeat cada 15 segundos para mantener vivo el canal
                if segundos_desde_ping >= 15:
                    yield ": ping\n\n"
                    segundos_desde_ping = 0

    return StreamingResponse(
        generador_eventos(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )
