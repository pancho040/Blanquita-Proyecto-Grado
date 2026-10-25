from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.Auth.Dependencies import get_generado_por, require_role
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_GERENTE_GENERAL, ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR
from app.Models.InventarioFinal.Conteo import (
    AnularConteoProductoTerminadoRequest,
    CerrarConteoProductoTerminadoRequest,
    ConteoProductoTerminadoResponse,
    EstadoConteoProductoTerminadoResponse,
    IniciarConteoProductoTerminadoRequest,
    RegistrarCantidadesConteoRequest,
    ResumenConteoProductoTerminadoResponse,
)
from app.Reportes.ConteoProductoTerminado import (
    construir_acta_conteo_producto_terminado,
    construir_hoja_conteo_producto_terminado,
    construir_reporte_conteos_producto_terminado,
    nombre_archivo_acta_conteo,
    nombre_archivo_hoja_conteo,
    nombre_archivo_reporte_conteos,
)
from app.Services.InventarioFinal.Conteo import ConteoProductoTerminadoService


DESCRIPCION_ESTADOS = "Estados del conteo a incluir (Abierto, Cerrado, Anulado). Vacío = todos."


def conteo_producto_terminado_service(db: Session = Depends(get_db)) -> ConteoProductoTerminadoService:
    return ConteoProductoTerminadoService(db)


ConteoProductoTerminadoRouter = APIRouter(
    prefix="/productofinal/conteo", tags=["Inventario - Conteo físico de Producto Terminado"]
)


@ConteoProductoTerminadoRouter.get(
    "/activo",
    response_model=EstadoConteoProductoTerminadoResponse,
    status_code=200,
    dependencies=[
        Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL]))
    ],
)
def VerConteoActivo(
    service: ConteoProductoTerminadoService = Depends(conteo_producto_terminado_service),
):
    return service.VerActivo()


@ConteoProductoTerminadoRouter.get(
    "/listar",
    response_model=list[ResumenConteoProductoTerminadoResponse],
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ListarConteos(
    FechaInicio: date | None = None,
    FechaFin: date | None = None,
    Estados: list[str] | None = Query(default=None, description=DESCRIPCION_ESTADOS),
    service: ConteoProductoTerminadoService = Depends(conteo_producto_terminado_service),
):
    return service.Listar(FechaInicio, FechaFin, Estados)


@ConteoProductoTerminadoRouter.get(
    "/reporte",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ReporteConteos(
    FechaInicio: date,
    FechaFin: date,
    Estados: list[str] | None = Query(default=None, description=DESCRIPCION_ESTADOS),
    generado_por: str | None = Depends(get_generado_por),
    service: ConteoProductoTerminadoService = Depends(conteo_producto_terminado_service),
):
    data = service.Reporte(FechaInicio, FechaFin, Estados)
    pdf = construir_reporte_conteos_producto_terminado(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_reporte_conteos(FechaInicio, FechaFin)}"'
        },
    )


@ConteoProductoTerminadoRouter.get(
    "/hoja",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def HojaConteo(
    generado_por: str | None = Depends(get_generado_por),
    service: ConteoProductoTerminadoService = Depends(conteo_producto_terminado_service),
):
    data = service.Hoja()
    pdf = construir_hoja_conteo_producto_terminado(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo_hoja_conteo()}"'},
    )


@ConteoProductoTerminadoRouter.get(
    "/{id_conteo}",
    response_model=ConteoProductoTerminadoResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def VerConteo(
    id_conteo: int,
    service: ConteoProductoTerminadoService = Depends(conteo_producto_terminado_service),
):
    return service.VerConteo(id_conteo)


@ConteoProductoTerminadoRouter.get(
    "/{id_conteo}/acta",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ActaConteo(
    id_conteo: int,
    generado_por: str | None = Depends(get_generado_por),
    service: ConteoProductoTerminadoService = Depends(conteo_producto_terminado_service),
):
    data = service.Acta(id_conteo)
    pdf = construir_acta_conteo_producto_terminado(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_acta_conteo(id_conteo)}"'
        },
    )


@ConteoProductoTerminadoRouter.post(
    "/iniciar",
    response_model=ConteoProductoTerminadoResponse,
    status_code=201,
)
def IniciarConteo(
    data: IniciarConteoProductoTerminadoRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: ConteoProductoTerminadoService = Depends(conteo_producto_terminado_service),
):
    return service.Iniciar(data, usuario_actual["IdUsuario"])


@ConteoProductoTerminadoRouter.put(
    "/{id_conteo}/cantidades",
    response_model=ConteoProductoTerminadoResponse,
    status_code=200,
)
def RegistrarCantidadesConteo(
    id_conteo: int,
    data: RegistrarCantidadesConteoRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: ConteoProductoTerminadoService = Depends(conteo_producto_terminado_service),
):
    return service.RegistrarCantidades(id_conteo, data, usuario_actual["IdUsuario"])


@ConteoProductoTerminadoRouter.post(
    "/{id_conteo}/cerrar",
    response_model=ConteoProductoTerminadoResponse,
    status_code=200,
)
def CerrarConteo(
    id_conteo: int,
    data: CerrarConteoProductoTerminadoRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: ConteoProductoTerminadoService = Depends(conteo_producto_terminado_service),
):
    return service.Cerrar(id_conteo, data, usuario_actual["IdUsuario"])


@ConteoProductoTerminadoRouter.post(
    "/{id_conteo}/anular",
    response_model=ConteoProductoTerminadoResponse,
    status_code=200,
)
def AnularConteo(
    id_conteo: int,
    data: AnularConteoProductoTerminadoRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: ConteoProductoTerminadoService = Depends(conteo_producto_terminado_service),
):
    return service.Anular(id_conteo, data, usuario_actual["IdUsuario"])
