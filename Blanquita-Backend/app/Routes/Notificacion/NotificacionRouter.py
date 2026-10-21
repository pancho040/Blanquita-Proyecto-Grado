from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_role
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR
from app.Models.Notificacion.Notificacion import NotificacionesResponse
from app.Services.Notificacion.Notificacion import NotificacionService


def notificacion_service(db: Session = Depends(get_db)) -> NotificacionService:
    return NotificacionService(db)


NotificacionRouter = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])


@NotificacionRouter.get(
    "/resumen",
    response_model=NotificacionesResponse,
    status_code=200,
)
def VerNotificaciones(
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: NotificacionService = Depends(notificacion_service),
):
    return service.VerNotificaciones(usuario_actual["IdRol"])
