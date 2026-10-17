from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.Config.supabase import get_db

from app.Auth.Dependencies import require_role, get_generado_por
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR

from app.Models.BobinaServilleta.Reporte import (
    ReporteInventarioBobinaServilletaRequest,
    VerBobinasServilletaRequest,
    VerBobinasServilletaResponse,
    VerSubBobinasServilletaRequest,
    VerSubBobinasServilletaResponse,
    ReporteHistorialMovimientosUnidadServilletaRequest,
    ReporteDetalleBobinaServilletaRequest,
    VerLotesBobinaServilletaRequest,
    VerLotesBobinaServilletaResponse,
    ReporteLoteBobinaServilletaDetalleRequest,
    ReporteLotesServilletaPorPeriodoRequest,
    VerProduccionesServilletaRequest,
    VerProduccionesServilletaResponse,
    ReporteProduccionServilletaDetalleRequest,
    ReporteCancelacionProduccionServilletaRequest,
    ReporteProduccionServilletaPorPeriodoRequest,
)
from app.Services.BobinaServilleta.Reporte import ReporteBobinaServilletaService
from app.Reportes.BobinaServilleta import (
    construir_reporte_inventario_bobina_servilleta,
    nombre_archivo_inventario_servilleta,
    construir_reporte_inventario_subbobina_servilleta,
    nombre_archivo_inventario_subbobina_servilleta,
    construir_reporte_historial_movimientos_unidad_servilleta,
    nombre_archivo_historial_movimientos_unidad_servilleta,
    construir_reporte_detalle_bobina_servilleta,
    nombre_archivo_detalle_bobina_servilleta,
    construir_reporte_lote_bobina_servilleta_detalle,
    nombre_archivo_lote_servilleta_detalle,
    construir_reporte_lotes_servilleta_por_periodo,
    nombre_archivo_lotes_servilleta_periodo,
    construir_reporte_detalle_produccion_servilleta,
    nombre_archivo_detalle_produccion_servilleta,
    construir_reporte_cancelacion_produccion_servilleta,
    nombre_archivo_cancelacion_produccion_servilleta,
    construir_reporte_produccion_servilleta_por_periodo,
    nombre_archivo_produccion_servilleta_por_periodo,
    construir_reporte_inventario_completo_servilleta,
    nombre_archivo_inventario_completo_servilleta,
)


bs_ReporteRouter = APIRouter(
    prefix="/bobinaservilleta/reporte", tags=["Bobina Servilleta - Reportes"]
)


def reporte_bobina_servilleta_service(
    db: Session = Depends(get_db),
) -> ReporteBobinaServilletaService:
    return ReporteBobinaServilletaService(db)


@bs_ReporteRouter.get(
    "/inventario/completo",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def ReporteInventarioCompletoServilleta(
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaServilletaService = Depends(reporte_bobina_servilleta_service),
):
    data = service.ReporteInventarioCompleto()
    pdf = construir_reporte_inventario_completo_servilleta(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_inventario_completo_servilleta()}"'
        },
    )


@bs_ReporteRouter.get(
    "/bobina/inventario",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def ReporteInventarioBobinasServilleta(
    tipos: list[int] | None = Query(
        default=None,
        description="IDs de TipoBobinaServilleta a incluir. Vacío = todos los tipos.",
    ),
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaServilletaService = Depends(reporte_bobina_servilleta_service),
):
    data = service.ReporteInventario(
        ReporteInventarioBobinaServilletaRequest(IdsTipoBobinaServilleta=tipos)
    )
    pdf = construir_reporte_inventario_bobina_servilleta(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_inventario_servilleta()}"'
        },
    )


@bs_ReporteRouter.get(
    "/bobina/catalogo",
    response_model=VerBobinasServilletaResponse,
    status_code=200,
)
def CatalogoBobinasServilleta(
    CodigoBobina: str | None = None,
    IdProveedor: int | None = None,
    IdTipoBobinaServilleta: int | None = None,
    IdEstadoMateriaPrima: int | None = None,
    Pagina: int = 1,
    TamanoPagina: int = 50,
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    service: ReporteBobinaServilletaService = Depends(reporte_bobina_servilleta_service),
):
    return service.VerBobinasServilleta(
        VerBobinasServilletaRequest(
            CodigoBobina=CodigoBobina,
            IdProveedor=IdProveedor,
            IdTipoBobinaServilleta=IdTipoBobinaServilleta,
            IdEstadoMateriaPrima=IdEstadoMateriaPrima,
            Pagina=Pagina,
            TamanoPagina=TamanoPagina,
        )
    )

@bs_ReporteRouter.get(
    "/sub/inventario",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def ReporteInventarioSubBobinasServilleta(
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaServilletaService = Depends(reporte_bobina_servilleta_service),
):
    data = service.ReporteInventarioSubBobina()
    pdf = construir_reporte_inventario_subbobina_servilleta(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_inventario_subbobina_servilleta()}"'
        },
    )


@bs_ReporteRouter.get(
    "/sub/catalogo",
    response_model=VerSubBobinasServilletaResponse,
    status_code=200,
)
def subBobinaCatalogo(
    CodigoBobina: str | None = None,
    IdProveedor: int | None = None,
    IdTipoBobinaServilleta: int | None = None,
    IdsTipoMedidaSubBobina: list[int] | None = Query(
        default=None,
        description="IDs de TipoMedidaSubBobina a incluir. Vacío = todas las medidas.",
    ),
    IdEstadoMateriaPrima: int | None = None,
    Pagina: int = 1,
    TamanoPagina: int = 50,
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    service: ReporteBobinaServilletaService = Depends(reporte_bobina_servilleta_service),
):
    return service.VerSubBobinasServilleta(
        VerSubBobinasServilletaRequest(
            CodigoBobina=CodigoBobina,
            IdProveedor=IdProveedor,
            IdTipoBobinaServilleta=IdTipoBobinaServilleta,
            IdsTipoMedidaSubBobina=IdsTipoMedidaSubBobina,
            IdEstadoMateriaPrima=IdEstadoMateriaPrima,
            Pagina=Pagina,
            TamanoPagina=TamanoPagina,
        )
    )


@bs_ReporteRouter.get(
    "/unidad/movimientos/{id_unidad_bobina_servilleta}",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def ReporteHistorialMovimientosUnidadServilleta(
    id_unidad_bobina_servilleta: int,
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaServilletaService = Depends(reporte_bobina_servilleta_service),
):
    data = service.ReporteHistorialMovimientosUnidad(
        ReporteHistorialMovimientosUnidadServilletaRequest(
            IdUnidadBobinaServilleta=id_unidad_bobina_servilleta
        )
    )
    pdf = construir_reporte_historial_movimientos_unidad_servilleta(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_historial_movimientos_unidad_servilleta(id_unidad_bobina_servilleta)}"'
        },
    )


@bs_ReporteRouter.get(
    "/bobina/detalle/{id_bobina_servilleta}",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def ReporteDetalleBobinaServilletaRoute(
    id_bobina_servilleta: int,
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaServilletaService = Depends(reporte_bobina_servilleta_service),
):
    data = service.ReporteDetalleBobinaServilleta(
        ReporteDetalleBobinaServilletaRequest(IdBobinaServilleta=id_bobina_servilleta)
    )
    pdf = construir_reporte_detalle_bobina_servilleta(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_detalle_bobina_servilleta(id_bobina_servilleta)}"'
        },
    )


@bs_ReporteRouter.get(
    "/lote/catalogo",
    response_model=VerLotesBobinaServilletaResponse,
    status_code=200,
)
def CatalogoLotesBobinaServilleta(
    FechaInicio: date | None = None,
    FechaFin: date | None = None,
    IdProveedor: int | None = None,
    IdsTipoBobinaServilleta: list[int] | None = Query(default=None),
    Pagina: int = 1,
    TamanoPagina: int = 50,
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    service: ReporteBobinaServilletaService = Depends(reporte_bobina_servilleta_service),
):
    return service.VerLotesBobinaServilleta(
        VerLotesBobinaServilletaRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdProveedor=IdProveedor,
            IdsTipoBobinaServilleta=IdsTipoBobinaServilleta,
            Pagina=Pagina,
            TamanoPagina=TamanoPagina,
        )
    )


@bs_ReporteRouter.get(
    "/lote/detalle/{id_lote_bobina_servilleta}",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def ReporteLoteServilletaDetalle(
    id_lote_bobina_servilleta: int,
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaServilletaService = Depends(reporte_bobina_servilleta_service),
):
    data = service.ReporteLoteBobinaServilletaDetalle(
        ReporteLoteBobinaServilletaDetalleRequest(
            IdLoteBobinaServilleta=id_lote_bobina_servilleta
        )
    )
    pdf = construir_reporte_lote_bobina_servilleta_detalle(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_lote_servilleta_detalle(id_lote_bobina_servilleta)}"'
        },
    )


@bs_ReporteRouter.get(
    "/lote/periodo",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def ReporteLotesServilletaPorPeriodo(
    FechaInicio: date,
    FechaFin: date,
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaServilletaService = Depends(reporte_bobina_servilleta_service),
):
    data = service.ReporteLotesServilletaPorPeriodo(
        ReporteLotesServilletaPorPeriodoRequest(
            FechaInicio=FechaInicio, FechaFin=FechaFin
        )
    )
    pdf = construir_reporte_lotes_servilleta_por_periodo(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_lotes_servilleta_periodo(FechaInicio, FechaFin)}"'
        },
    )


@bs_ReporteRouter.get(
    "/produccion/catalogo",
    response_model=VerProduccionesServilletaResponse,
    status_code=200,
)
def CatalogoProduccionServilleta(
    FechaInicio: date | None = None,
    FechaFin: date | None = None,
    IdTurno: int | None = None,
    IdsTipoBobinaServilleta: list[int] | None = Query(default=None),
    CodigoBobina: str | None = None,
    Operador: str | None = None,
    IdEstadoProduccion: int | None = None,
    IdsEstadoProduccion: list[int] | None = Query(default=None),
    Pagina: int = 1,
    TamanoPagina: int = 50,
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    service: ReporteBobinaServilletaService = Depends(reporte_bobina_servilleta_service),
):
    return service.VerProduccionesServilleta(
        VerProduccionesServilletaRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdTurno=IdTurno,
            IdsTipoBobinaServilleta=IdsTipoBobinaServilleta,
            CodigoBobina=CodigoBobina,
            Operador=Operador,
            IdEstadoProduccion=IdEstadoProduccion,
            IdsEstadoProduccion=IdsEstadoProduccion,
            Pagina=Pagina,
            TamanoPagina=TamanoPagina,
        )
    )


@bs_ReporteRouter.get(
    "/produccion/detalle/{id_produccion}",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def ObtenerDetalleProduccionServilleta(
    id_produccion: int,
    VerPausas: bool = False,
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaServilletaService = Depends(reporte_bobina_servilleta_service),
):
    data = service.ReporteDetalleProduccion(
        ReporteProduccionServilletaDetalleRequest(
            IdProduccion=id_produccion,
            VerPausas=VerPausas,
        )
    )
    pdf = construir_reporte_detalle_produccion_servilleta(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_detalle_produccion_servilleta(id_produccion)}"'
        },
    )


@bs_ReporteRouter.get(
    "/produccion/cancelada/{id_produccion}",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def ReporteProduccionServilletaCancelada(
    id_produccion: int,
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaServilletaService = Depends(reporte_bobina_servilleta_service),
):
    data = service.ReporteCancelacionProduccion(
        ReporteCancelacionProduccionServilletaRequest(IdProduccion=id_produccion)
    )
    pdf = construir_reporte_cancelacion_produccion_servilleta(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_cancelacion_produccion_servilleta(id_produccion)}"'
        },
    )


@bs_ReporteRouter.get(
    "/produccion/periodo",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def ReporteProduccionServilletaPorPeriodo(
    FechaInicio: date,
    FechaFin: date,
    VerCancelaciones: bool = False,
    usuario_actual: dict = Depends(
        require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])
    ),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteBobinaServilletaService = Depends(reporte_bobina_servilleta_service),
):
    data = service.ReporteProduccionPorPeriodo(
        ReporteProduccionServilletaPorPeriodoRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            VerCancelaciones=VerCancelaciones,
        )
    )
    pdf = construir_reporte_produccion_servilleta_por_periodo(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_produccion_servilleta_por_periodo(FechaInicio, FechaFin)}"'
        },
    )
