"""
Router de la API Móvil v1 (Fase 1 - Base Común)
Sistema ERP Papelera Blanquita

Endpoints:
- POST /api/movil/v1/auth/login: Proxy de autenticación móvil contra Supabase Auth vía CI y contraseña.
- POST /api/movil/v1/auth/refresh: Proxy para refresco de token de acceso.
- POST /api/movil/v1/auth/logout: Revoca sesión y desactiva token push del dispositivo.
- POST /api/movil/v1/dispositivos/registro: Registra o actualiza el token Expo Push del usuario.
- GET  /api/movil/v1/notificaciones: Bandeja interna de notificaciones (NotificacionInterna).
- PUT  /api/movil/v1/notificaciones/{id}/leida: Marca notificación como leída.
- POST /api/movil/v1/operaciones/probar-idempotencia: Verificación transaccional de idempotencia con clave UUID v4.
"""

import os
import time
import uuid
import threading
from collections import defaultdict
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Request, HTTPException, Header, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.Config.supabase import get_db
from app.Auth.Dependencies import get_current_user
from app.Auth.Limiter import limiter
from app.Auth.AlcanceSucursal import resolver_alcance_usuario
from app.Services.Usuario.Auth import AuthService
from app.Services.Common.NotificationService import NotificationService
from app.Services.Movil.PushNotificationService import PushNotificationService
from app.Middleware.Idempotencia import IdempotenciaService
from app.Models.Movil.MovilModel import (
    LoginMovilRequest,
    UsuarioMovilDTO,
    LoginMovilResponse,
    RefreshMovilRequest,
    RefreshMovilResponse,
    LogoutMovilRequest,
    RegistroDispositivoRequest,
    DispositivoResponse,
    MovilResponse,
    NotificacionMovilDTO
)

MovilRouter = APIRouter(prefix="/api/movil/v1", tags=["API Móvil v1"])

# Control de tasa en memoria por combinacion (CI + IP) contando unicamente fallos
# Evita que un atacante desde otra IP bloquee a un chofer legitimo.
_fallos_ci_ip = defaultdict(list)
_ci_lock = threading.Lock()

def _verificar_rate_limit_ci_ip(ci: str, ip: str, max_fallos: int = 5, ventana_seg: int = 60) -> None:
    clave = f"{ci}:{ip}"
    ahora = time.time()
    with _ci_lock:
        fallos = [t for t in _fallos_ci_ip[clave] if ahora - t < ventana_seg]
        _fallos_ci_ip[clave] = fallos
        if len(fallos) >= max_fallos:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos fallidos para este usuario desde esta conexión. Intente más tarde."
            )

def _registrar_fallo_ci_ip(ci: str, ip: str) -> None:
    clave = f"{ci}:{ip}"
    ahora = time.time()
    with _ci_lock:
        _fallos_ci_ip[clave].append(ahora)

def _limpiar_fallos_ci_ip(ci: str, ip: str) -> None:
    clave = f"{ci}:{ip}"
    with _ci_lock:
        _fallos_ci_ip.pop(clave, None)

ENTORNO_PRUEBAS_HABILITADO = (
    os.getenv("ENTORNO_PRUEBAS", "true").lower() in ("true", "1", "test")
    and os.getenv("PRODUCCION", "false").lower() != "true"
)


def _obtener_request_id(request: Request) -> str:
    return request.headers.get("x-request-id") or str(uuid.uuid4())


@MovilRouter.post("/auth/login", response_model=MovilResponse[LoginMovilResponse])
@limiter.limit("5/minute")
def login_movil(
    datos: LoginMovilRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Inicia sesión para agentes de reparto y personal móvil.
    Resuelve el correo interno a partir del CI y autentica contra Supabase Auth.
    Devuelve tokens JWT y datos de perfil con alcance multisede.
    Aplica rate limiting estricto de 5 intentos/minuto por IP y bloqueo de 5 fallos por (CI + IP).
    """
    req_id = _obtener_request_id(request)
    from app.Auth.Limiter import obtener_ip_real
    ip = obtener_ip_real(request)
    user_agent = request.headers.get("x-client-user-agent") or request.headers.get("user-agent")

    # Verificar tasa de fallos previos para la combinacion (CI + IP)
    _verificar_rate_limit_ci_ip(datos.Ci, ip)

    auth_service = AuthService(db)
    try:
        resultado_auth = auth_service.Login(
            ci=datos.Ci,
            clave=datos.Clave,
            ip=ip,
            user_agent=user_agent
        )
    except HTTPException as e:
        if e.status_code == status.HTTP_401_UNAUTHORIZED:
            _registrar_fallo_ci_ip(datos.Ci, ip)
        raise e

    # Login exitoso: limpiar historial de fallos para esta IP y CI
    _limpiar_fallos_ci_ip(datos.Ci, ip)

    # Obtener información extendida del usuario
    sql_user = text("""
        SELECT 
            u."IdUsuario",
            u."PrimerNombre",
            u."SegundoNombre",
            u."ApellidoPaterno",
            u."ApellidoMaterno",
            u."Ci",
            u."IdRol",
            COALESCE(r."NombreRol", 'Agente de Reparto') as "NombreRol",
            u."IdSucursal"
        FROM public."Usuario" u
        LEFT JOIN public."Rol" r ON r."IdRol" = u."IdRol"
        WHERE u."Ci" = :ci
        LIMIT 1;
    """)
    fila_user = db.execute(sql_user, {"ci": datos.Ci}).fetchone()
    if not fila_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas"
        )

    uid = fila_user[0]
    nombres = f"{fila_user[1]} {fila_user[2] or ''}".strip()
    apellidos = f"{fila_user[3]} {fila_user[4] or ''}".strip()

    alcance = resolver_alcance_usuario(id_usuario=uid, db=db)

    usuario_dto = UsuarioMovilDTO(
        id_usuario=uid,
        nombre=nombres,
        apellido=apellidos,
        ci=fila_user[5],
        id_rol=fila_user[6],
        nombre_rol=fila_user[7],
        sucursales_permitidas=alcance.sucursales_permitidas,
        puede_ver_todas=alcance.puede_ver_todas,
        sucursal_defecto=alcance.sucursal_asignada_defecto or fila_user[8]
    )

    resp_data = LoginMovilResponse(
        access_token=resultado_auth["AccessToken"],
        refresh_token=resultado_auth["RefreshTokenCrudo"],
        token_type="bearer",
        expires_in=3600,
        usuario=usuario_dto
    )

    return MovilResponse[LoginMovilResponse](
        codigo="EXITO",
        mensaje="Sesión iniciada correctamente",
        request_id=req_id,
        datos=resp_data
    )


@MovilRouter.post("/auth/refresh", response_model=MovilResponse[RefreshMovilResponse])
def refresh_movil(
    datos: RefreshMovilRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Refresca el access token expirado utilizando el refresh token de Supabase Auth.
    """
    req_id = _obtener_request_id(request)
    auth_service = AuthService(db)
    resultado = auth_service.RefreshAccessToken(refresh_token_crudo=datos.refresh_token)

    resp_data = RefreshMovilResponse(
        access_token=resultado["AccessToken"],
        refresh_token=resultado["RefreshTokenCrudo"],
        token_type="bearer",
        expires_in=3600
    )

    return MovilResponse[RefreshMovilResponse](
        codigo="EXITO",
        mensaje="Token renovado exitosamente",
        request_id=req_id,
        datos=resp_data
    )


@MovilRouter.post("/auth/logout", response_model=MovilResponse[Dict[str, Any]])
def logout_movil(
    request: Request,
    cuerpo: Optional[LogoutMovilRequest] = None,
    usuario_actual: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cierra la sesión móvil, desactiva el token push asociado al dispositivo y revoca el token en Supabase Auth.
    """
    req_id = _obtener_request_id(request)
    uid = usuario_actual["IdUsuario"]

    # 1. Desactivar token push si fue provisto o todos los del usuario
    token_push = cuerpo.token_push if cuerpo else None
    dispositivos_desactivados = PushNotificationService.desactivar_dispositivo(
        session=db,
        usuario_id=uid,
        token_push=token_push
    )

    # 2. Revocar sesión
    auth_service = AuthService(db)
    autorizacion = request.headers.get("authorization", "")
    partes = autorizacion.split()
    revocado = False
    if len(partes) == 2 and partes[0].lower() == "bearer":
        try:
            revocado = auth_service.Logout(partes[1])
        except Exception:
            revocado = False

    return MovilResponse[Dict[str, Any]](
        codigo="EXITO",
        mensaje="Sesión cerrada correctamente",
        request_id=req_id,
        datos={
            "sesion_revocada": revocado,
            "dispositivos_desactivados": dispositivos_desactivados
        }
    )


@MovilRouter.post("/dispositivos/registro", response_model=MovilResponse[DispositivoResponse])
def registrar_dispositivo(
    datos: RegistroDispositivoRequest,
    request: Request,
    usuario_actual: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Registra o actualiza el token Expo Push para el usuario autenticado.
    """
    req_id = _obtener_request_id(request)
    uid = usuario_actual["IdUsuario"]

    disp = PushNotificationService.registrar_dispositivo(
        session=db,
        usuario_id=uid,
        token_push=datos.token_push,
        plataforma=datos.plataforma,
        version_app=datos.version_app
    )

    return MovilResponse[DispositivoResponse](
        codigo="EXITO",
        mensaje="Dispositivo registrado para notificaciones push",
        request_id=req_id,
        datos=DispositivoResponse(
            id=disp["id"],
            usuario_id=disp["usuario_id"],
            token_push=disp["token_push"],
            plataforma=disp["plataforma"],
            version_app=disp["version_app"],
            activo=disp["activo"],
            ultimo_uso=disp["ultimo_uso"]
        )
    )


@MovilRouter.get("/notificaciones", response_model=MovilResponse[List[NotificacionMovilDTO]])
def obtener_notificaciones(
    request: Request,
    solo_no_leidas: bool = Query(False, description="Filtrar únicamente notificaciones pendientes"),
    usuario_actual: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene la bandeja de notificaciones internas del usuario autenticado.
    """
    req_id = _obtener_request_id(request)
    uid = usuario_actual["IdUsuario"]

    items = NotificationService.listar_notificaciones(
        session=db,
        id_usuario=uid,
        solo_no_leidas=solo_no_leidas
    )

    dto_list = [
        NotificacionMovilDTO(
            id=item["id"],
            titulo=item["titulo"],
            mensaje=item["mensaje"],
            tipo=item["tipo"],
            codigo_referencia=item["codigo_referencia"],
            leido=item["leido"],
            fecha_creacion=item["fecha_creacion"]
        )
        for item in items
    ]

    return MovilResponse[List[NotificacionMovilDTO]](
        codigo="EXITO",
        mensaje=f"Se obtuvieron {len(dto_list)} notificaciones",
        request_id=req_id,
        datos=dto_list
    )


@MovilRouter.put("/notificaciones/{id_notificacion}/leida", response_model=MovilResponse[Dict[str, Any]])
@MovilRouter.patch("/notificaciones/{id_notificacion}/leida", response_model=MovilResponse[Dict[str, Any]])
def marcar_notificacion_leida(
    id_notificacion: int,
    request: Request,
    usuario_actual: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Marca una notificación interna específica como leída.
    """
    req_id = _obtener_request_id(request)
    actualizado = NotificationService.marcar_como_leida(session=db, id_notificacion=id_notificacion)
    db.commit()

    if not actualizado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notificación con ID {id_notificacion} no encontrada"
        )

    return MovilResponse[Dict[str, Any]](
        codigo="EXITO",
        mensaje="Notificación marcada como leída",
        request_id=req_id,
        datos={"id_notificacion": id_notificacion, "leido": True}
    )


@MovilRouter.post("/operaciones/probar-idempotencia")
async def probar_operacion_con_idempotencia(
    request: Request,
    usuario_actual: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key")
):
    """
    Endpoint de prueba transaccional de idempotencia para operaciones monetarias/entregas.
    Exige X-Idempotency-Key (UUID v4).
    - Misma clave + mismo cuerpo -> Retorna respuesta en caché con X-Cache-Lookup: HIT.
    - Misma clave + distinto cuerpo -> Retorna HTTP 409 Conflict.
    - Sin clave o clave inválida -> Retorna HTTP 400 Bad Request.
    """
    req_id = _obtener_request_id(request)
    if not ENTORNO_PRUEBAS_HABILITADO:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint de prueba de idempotencia deshabilitado en este entorno."
        )

    if not x_idempotency_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cabecera X-Idempotency-Key es obligatoria para esta operación."
        )

    cuerpo_bytes = await request.body()
    uid = usuario_actual["IdUsuario"]
    endpoint_path = request.url.path

    # Verificar idempotencia
    hash_cuerpo, respuesta_cacheada = IdempotenciaService.verificar_y_recuperar(
        session=db,
        usuario_id=uid,
        clave=x_idempotency_key,
        cuerpo_bytes=cuerpo_bytes,
        endpoint=endpoint_path
    )

    if respuesta_cacheada:
        return respuesta_cacheada

    # Ejecutar operación de negocio (ej. simulación de cobro/entrega monetaria)
    import json
    try:
        cuerpo_json = json.loads(cuerpo_bytes.decode("utf-8")) if cuerpo_bytes else {}
    except Exception:
        cuerpo_json = {}

    monto = cuerpo_json.get("monto", 100.0)
    concepto = cuerpo_json.get("concepto", "Cobro de prueba")

    respuesta_datos = {
        "codigo": "EXITO",
        "mensaje": "Operación financiera procesada correctamente",
        "request_id": req_id,
        "datos": {
            "transaccion_id": f"TX-{uuid.uuid4().hex[:8].upper()}",
            "monto_procesado": monto,
            "concepto": concepto,
            "usuario_responsable": uid,
            "estado": "CONFIRMADO"
        }
    }

    # Registrar en ClaveIdempotenciaProcesada
    IdempotenciaService.registrar_respuesta(
        session=db,
        usuario_id=uid,
        clave=x_idempotency_key,
        endpoint=endpoint_path,
        hash_cuerpo=hash_cuerpo,
        codigo_estado=200,
        cuerpo_respuesta=respuesta_datos
    )
    db.commit()

    return JSONResponse(status_code=200, content=respuesta_datos)

