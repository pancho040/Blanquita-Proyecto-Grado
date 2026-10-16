from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.Config.supabase import get_db

from app.Services.BobinaPapel.ProduccionBobinaPapelService import (
    ProduccionBobinaPapelService,
)

from app.Auth.Dependencies import require_role
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR

from app.Models.BobinaPapel.ProduccionBobinaPapel import (
    IniciarProduccionBobinaTuboRequest,
    IniciarProduccionBobinaTuboResponse,
    CambiarLineaProduccionBobinaTuboRequest,
    CambiarLineaProduccionBobinaTuboResponse,
    FinalizarProduccionBobinaTuboRequest,
    FinalizarProduccionBobinaTuboResponse,
    PausarProduccionBobinaTuboRequest,
    PausarProduccionBobinaTuboResponse,
    ReanudarProduccionBobinaTuboRequest,
    ReanudarProduccionBobinaTuboResponse,
    CancelarProduccionBobinaTuboRequest,
    CancelarProduccionBobinaTuboResponse,
    InsertarMovimientoOperadorLogsRequest,
    InsertarMovimientoOperadorLogsResponse,
    VerProduccionBobinaTuboRequest,
    VerProduccionBobinaTuboResponse,
    VerPausasProduccionBobinaTuboActivasRequest,
    VerPausasProduccionBobinaTuboActivasResponse,
)


def produccion_bobina_papel_service(
    db: Session = Depends(get_db),
) -> ProduccionBobinaPapelService:
    return ProduccionBobinaPapelService(db)


ProduccionBobinaPapelRouter = APIRouter(
    prefix="/papelbobina/produccion", tags=["Papel Bobina - Producción"]
)


@ProduccionBobinaPapelRouter.post(
    "/iniciar",
    response_model=IniciarProduccionBobinaTuboResponse,
    status_code=201,
)
def IniciarProduccion(
    data: IniciarProduccionBobinaTuboRequest,
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    service: ProduccionBobinaPapelService = Depends(produccion_bobina_papel_service),
):
    return service.IniciarProduccionBobinaTubo(data, usuario_actual["IdUsuario"])


@ProduccionBobinaPapelRouter.post(
    "/cambiarlinea",
    response_model=CambiarLineaProduccionBobinaTuboResponse,
    status_code=201,
)
def CambiarLineaProduccion(
    data: CambiarLineaProduccionBobinaTuboRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: ProduccionBobinaPapelService = Depends(produccion_bobina_papel_service),
):
    return service.CambiarLineaProduccion(data, usuario_actual["IdUsuario"])


@ProduccionBobinaPapelRouter.post(
    "/finalizar",
    response_model=FinalizarProduccionBobinaTuboResponse,
    status_code=200,
)
def FinalizarProduccion(
    data: FinalizarProduccionBobinaTuboRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: ProduccionBobinaPapelService = Depends(produccion_bobina_papel_service),
):
    return service.FinalizarProduccion(data, usuario_actual["IdUsuario"])


@ProduccionBobinaPapelRouter.post(
    "/pausar",
    response_model=PausarProduccionBobinaTuboResponse,
    status_code=200,
)
def PausarProduccion(
    data: PausarProduccionBobinaTuboRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: ProduccionBobinaPapelService = Depends(produccion_bobina_papel_service),
):
    return service.PausarProduccion(data, usuario_actual["IdUsuario"])


@ProduccionBobinaPapelRouter.post(
    "/reanudar",
    response_model=ReanudarProduccionBobinaTuboResponse,
    status_code=200,
)
def ReanudarProduccion(
    data: ReanudarProduccionBobinaTuboRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: ProduccionBobinaPapelService = Depends(produccion_bobina_papel_service),
):
    return service.ReanudarProduccion(data, usuario_actual["IdUsuario"])


@ProduccionBobinaPapelRouter.post(
    "/cancelar",
    response_model=CancelarProduccionBobinaTuboResponse,
    status_code=200,
)
def CancelarProduccion(
    data: CancelarProduccionBobinaTuboRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: ProduccionBobinaPapelService = Depends(produccion_bobina_papel_service),
):
    return service.CancelarProduccion(data, usuario_actual["IdUsuario"])


@ProduccionBobinaPapelRouter.post(
    "/insertarlog",
    response_model=InsertarMovimientoOperadorLogsResponse,
    status_code=201,
)
def InsertarMovimientoLog(
    data: InsertarMovimientoOperadorLogsRequest,
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    service: ProduccionBobinaPapelService = Depends(produccion_bobina_papel_service),
):
    return service.InsertarMovimientoOperadorLogs(data, usuario_actual["IdUsuario"])


@ProduccionBobinaPapelRouter.get(
    "/activas",
    response_model=list[VerProduccionBobinaTuboResponse],
    status_code=200,
    dependencies=[
        Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR]))
    ],
)
def VerProduccionBobinaTubo(
    IdTipoBobina: int | None = None,
    IdProducto: int | None = None,
    service: ProduccionBobinaPapelService = Depends(produccion_bobina_papel_service),
):
    return service.VerProduccionBobinaTubo(
        VerProduccionBobinaTuboRequest(IdTipoBobina=IdTipoBobina, IdProducto=IdProducto)
    )


@ProduccionBobinaPapelRouter.get(
    "/pausadas",
    response_model=list[VerPausasProduccionBobinaTuboActivasResponse],
    status_code=200,
    dependencies=[
        Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR]))
    ],
)
def VerPausasProduccionBobinaTuboActivas(
    FiltroIdTipoBobina: int | None = None,
    FiltroIdProducto: int | None = None,
    service: ProduccionBobinaPapelService = Depends(produccion_bobina_papel_service),
):
    return service.VerPausasActivas(
        VerPausasProduccionBobinaTuboActivasRequest(
            FiltroIdTipoBobina=FiltroIdTipoBobina,
            FiltroIdProducto=FiltroIdProducto,
        )
    )