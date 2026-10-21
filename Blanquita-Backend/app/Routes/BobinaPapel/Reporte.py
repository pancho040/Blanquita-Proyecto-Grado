from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.Config.supabase import get_db

from app.Auth.Dependencies import require_role, get_generado_por
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL

from app.Models.BobinaPapel.Reportes import (
    ReporteInventarioBobinaPapelRequest,
    VerProduccionesBobinaTuboRequest,
    VerProduccionesBobinaTuboResponse,
    ReporteProduccionBobinaTuboDetalleRequest,
    VerLotesBobinaPapelRequest,
    VerLotesBobinaPapelResponse,
    ReporteLoteBobinaPapelDetalleRequest,
    ReporteLotesPorPeriodoRequest,
    ReporteCancelacionProduccionBobinaTuboRequest,
    ReporteProduccionPorPeriodoRequest,
    VerBobinasPapelRequest,
    VerBobinasPapelResponse,
    ReporteHistorialMovimientosBobinaRequest,
)
from app.Services.BobinaPapel.Reportes import ReporteBobinaPapelService
from app.Reportes.BobinaPapel import (
    construir_reporte_inventario_bobina_papel,
    nombre_archivo_inventario,
    construir_reporte_detalle_produccion_bobina_papel,
    nombre_archivo_detalle_produccion,
    construir_reporte_lote_bobina_papel_detalle,
    nombre_archivo_lote_detalle,
    construir_reporte_lotes_por_periodo,
    nombre_archivo_lotes_periodo,
    construir_reporte_cancelacion_produccion_bobina_papel,
    nombre_archivo_cancelacion_produccion,
    construir_reporte_produccion_por_periodo,
    nombre_archivo_produccion_por_periodo,
    construir_reporte_historial_movimientos_bobina,
    nombre_archivo_historial_movimientos_bobina,
)


def reporte_bobina_papel_service(
    db: Session = Depends(get_db),
) -> ReporteBobinaPapelService:
    return ReporteBobinaPapelService(db)


bpReporteRouter = APIRouter(
    prefix="/papelbobina/reportes",
    tags=["Papel Bobina - Reportes"],
)


@bpReporteRouter.get(
    "/inventario",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ReporteInventarioBobinasPapel(
    tipos: list[int] | None = Query(
        default=None,
        description="IDs de TipoBobina a incluir. Vacío = todos los tipos.",
    ),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaPapelService = Depends(reporte_bobina_papel_service),
):
    data = service.ReporteInventario(
        ReporteInventarioBobinaPapelRequest(IdsTipoBobina=tipos)
    )
    pdf = construir_reporte_inventario_bobina_papel(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_inventario()}"'
        },
    )

@bpReporteRouter.get(
    "/produccion/catalogo",
    response_model=VerProduccionesBobinaTuboResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ObtenerCatalogoProduccion(
    FechaInicio: date | None = None,
    FechaFin: date | None = None,
    IdTurno: int | None = None,
    IdsProducto: list[int] | None = Query(default=None),
    CodigoBobina: str | None = None,
    Operador: str | None = None,
    IdEstadoProduccion: int | None = None,
    IdsEstadoProduccion: list[int] | None = Query(default=None),
    Pagina: int = 1,
    TamanoPagina: int = 50,
    service: ReporteBobinaPapelService = Depends(reporte_bobina_papel_service),
):
    return service.VerProduccionesBobinaTubo(
        VerProduccionesBobinaTuboRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdTurno=IdTurno,
            IdsProducto=IdsProducto,
            CodigoBobina=CodigoBobina,
            Operador=Operador,
            IdEstadoProduccion=IdEstadoProduccion,
            IdsEstadoProduccion=IdsEstadoProduccion,
            Pagina=Pagina,
            TamanoPagina=TamanoPagina,
        )
    )


@bpReporteRouter.get(
    "/produccion/detalle/{id_produccion}",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ObtenerDetalleProduccion(
    id_produccion: int,
    VerPausas: bool = False,
    VerMovimientos: bool = False,
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaPapelService = Depends(reporte_bobina_papel_service),
):
    data = service.ReporteDetalleProduccion(
        ReporteProduccionBobinaTuboDetalleRequest(
            IdProduccion=id_produccion,
            VerPausas=VerPausas,
            VerMovimientos=VerMovimientos,
        )
    )
    pdf = construir_reporte_detalle_produccion_bobina_papel(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_detalle_produccion(id_produccion)}"'
        },
    )
@bpReporteRouter.get(
    "/produccion/cancelada/{id_produccion}",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ReporteProduccionCancelada(
    id_produccion: int,
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaPapelService = Depends(reporte_bobina_papel_service),
):
    data = service.ReporteCancelacionProduccion(
        ReporteCancelacionProduccionBobinaTuboRequest(IdProduccion=id_produccion)
    )
    pdf = construir_reporte_cancelacion_produccion_bobina_papel(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_cancelacion_produccion(id_produccion)}"'
        },
    )


@bpReporteRouter.get(
    "/lote/catalogo",
    response_model=VerLotesBobinaPapelResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ObtenerLoteCatalogo(
    FechaInicio: date | None = None,
    FechaFin: date | None = None,
    IdProveedor: int | None = None,
    IdsTipoBobina: list[int] | None = Query(default=None),
    Pagina: int = 1,
    TamanoPagina: int = 50,
    service: ReporteBobinaPapelService = Depends(reporte_bobina_papel_service),
):
    return service.VerLotesBobinaPapel(
        VerLotesBobinaPapelRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdProveedor=IdProveedor,
            IdsTipoBobina=IdsTipoBobina,
            Pagina=Pagina,
            TamanoPagina=TamanoPagina,
        )
    )


@bpReporteRouter.get(
    "/lote/detalle/{id_lote_bobina}",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def CrearReporteLote(
    id_lote_bobina: int,
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaPapelService = Depends(reporte_bobina_papel_service),
):
    data = service.ReporteLoteBobinaPapelDetalle(
        ReporteLoteBobinaPapelDetalleRequest(IdLoteBobina=id_lote_bobina)
    )
    pdf = construir_reporte_lote_bobina_papel_detalle(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_lote_detalle(id_lote_bobina)}"'
        },
    )


@bpReporteRouter.get(
    "/lote/periodo",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ReporteLotesPorPeriodo(
    FechaInicio: date,
    FechaFin: date,
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaPapelService = Depends(reporte_bobina_papel_service),
):
    data = service.ReporteLotesPorPeriodo(
        ReporteLotesPorPeriodoRequest(FechaInicio=FechaInicio, FechaFin=FechaFin)
    )
    pdf = construir_reporte_lotes_por_periodo(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_lotes_periodo(FechaInicio, FechaFin)}"'
        },
    )


@bpReporteRouter.get(
    "/produccion/periodo",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ReporteProduccionPorPeriodo(
    FechaInicio: date,
    FechaFin: date,
    VerCancelaciones: bool = False,
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaPapelService = Depends(reporte_bobina_papel_service),
):
    data = service.ReporteProduccionPorPeriodo(
        ReporteProduccionPorPeriodoRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            VerCancelaciones=VerCancelaciones,
        )
    )
    pdf = construir_reporte_produccion_por_periodo(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_produccion_por_periodo(FechaInicio, FechaFin)}"'
        },
    )

@bpReporteRouter.get(
    "/movimientos/catalogo",
    response_model=VerBobinasPapelResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def CatalogoBobinas(
    CodigoBobina: str | None = None,
    IdProveedor: int | None = None,
    IdsTipoBobina: list[int] | None = Query(default=None),
    IdEstadoMateriaPrima: int | None = None,
    Pagina: int = 1,
    TamanoPagina: int = 50,
    service: ReporteBobinaPapelService = Depends(reporte_bobina_papel_service),
):
    return service.VerBobinasPapel(
        VerBobinasPapelRequest(
            CodigoBobina=CodigoBobina,
            IdProveedor=IdProveedor,
            IdsTipoBobina=IdsTipoBobina,
            IdEstadoMateriaPrima=IdEstadoMateriaPrima,
            Pagina=Pagina,
            TamanoPagina=TamanoPagina,
        )
    )


@bpReporteRouter.get(
    "/movimientos/reporte/{id_bobina_papel}",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ReporteBobinaMovimientos(
    id_bobina_papel: int,
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaPapelService = Depends(reporte_bobina_papel_service),
):
    data = service.ReporteHistorialMovimientosBobina(
        ReporteHistorialMovimientosBobinaRequest(IdBobinaPapel=id_bobina_papel)
    )
    pdf = construir_reporte_historial_movimientos_bobina(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_historial_movimientos_bobina(id_bobina_papel)}"'
        },
    )