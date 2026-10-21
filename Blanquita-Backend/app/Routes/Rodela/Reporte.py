from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.Config.supabase import get_db

from app.Auth.Dependencies import require_role, get_generado_por
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL

from app.Models.Rodela.Reporte import (
    VerRodelasRequest,
    VerRodelasResponse,
    ReporteInventarioRodelaRequest,
    ReporteHistorialMovimientosRodelaRequest,
    VerLotesRodelaRequest,
    VerLotesRodelaResponse,
    ReporteLoteRodelaDetalleRequest,
    ReporteLotesRodelaPorPeriodoRequest,
)
from app.Services.Rodela.Reporte import ReporteRodelaService
from app.Reportes.Rodela import (
    construir_reporte_inventario_rodela,
    nombre_archivo_inventario_rodela,
    construir_reporte_historial_movimientos_rodela,
    nombre_archivo_historial_movimientos_rodela,
    construir_reporte_lote_rodela_detalle,
    nombre_archivo_lote_rodela_detalle,
    construir_reporte_lotes_rodela_por_periodo,
    nombre_archivo_lotes_rodela_periodo,
)


def reporte_rodela_service(db: Session = Depends(get_db)) -> ReporteRodelaService:
    return ReporteRodelaService(db)


RodelaReporteRouter = APIRouter(
    prefix="/rodela/reportes",
    tags=["Rodela - Reportes"],
)


@RodelaReporteRouter.get(
    "/inventario/catalogo",
    response_model=VerRodelasResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def CatalogoRodelas(
    CodigoRodela: str | None = None,
    IdProveedor: int | None = None,
    IdsTipoRodela: list[int] | None = Query(default=None),
    IdEstadoMateriaPrima: int | None = None,
    IdLoteRodela: int | None = None,
    Pagina: int = 1,
    TamanoPagina: int = 50,
    service: ReporteRodelaService = Depends(reporte_rodela_service),
):
    return service.VerRodelas(
        VerRodelasRequest(
            CodigoRodela=CodigoRodela,
            IdProveedor=IdProveedor,
            IdsTipoRodela=IdsTipoRodela,
            IdEstadoMateriaPrima=IdEstadoMateriaPrima,
            IdLoteRodela=IdLoteRodela,
            Pagina=Pagina,
            TamanoPagina=TamanoPagina,
        )
    )


@RodelaReporteRouter.get(
    "/inventario",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ReporteInventarioRodelas(
    tipos: list[int] | None = Query(
        default=None,
        description="IDs de TipoRodela a incluir. Vacío = todos los tipos.",
    ),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteRodelaService = Depends(reporte_rodela_service),
):
    data = service.ReporteInventario(
        ReporteInventarioRodelaRequest(IdsTipoRodela=tipos)
    )
    pdf = construir_reporte_inventario_rodela(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_inventario_rodela()}"'
        },
    )


@RodelaReporteRouter.get(
    "/movimientos/reporte/{id_rodela}",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ReporteRodelaMovimientos(
    id_rodela: int,
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteRodelaService = Depends(reporte_rodela_service),
):
    data = service.ReporteHistorialMovimientosRodela(
        ReporteHistorialMovimientosRodelaRequest(IdRodela=id_rodela)
    )
    pdf = construir_reporte_historial_movimientos_rodela(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_historial_movimientos_rodela(id_rodela)}"'
        },
    )


@RodelaReporteRouter.get(
    "/lote/catalogo",
    response_model=VerLotesRodelaResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ObtenerLoteRodelaCatalogo(
    FechaInicio: date | None = None,
    FechaFin: date | None = None,
    IdProveedor: int | None = None,
    IdsTipoRodela: list[int] | None = Query(default=None),
    Pagina: int = 1,
    TamanoPagina: int = 50,
    service: ReporteRodelaService = Depends(reporte_rodela_service),
):
    return service.VerLotesRodela(
        VerLotesRodelaRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdProveedor=IdProveedor,
            IdsTipoRodela=IdsTipoRodela,
            Pagina=Pagina,
            TamanoPagina=TamanoPagina,
        )
    )


@RodelaReporteRouter.get(
    "/lote/detalle/{id_lote_rodela}",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def CrearReporteLoteRodela(
    id_lote_rodela: int,
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteRodelaService = Depends(reporte_rodela_service),
):
    data = service.ReporteLoteRodelaDetalle(
        ReporteLoteRodelaDetalleRequest(IdLoteRodela=id_lote_rodela)
    )
    pdf = construir_reporte_lote_rodela_detalle(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_lote_rodela_detalle(id_lote_rodela)}"'
        },
    )


@RodelaReporteRouter.get(
    "/lote/periodo",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ReporteLotesRodelaPorPeriodo(
    FechaInicio: date,
    FechaFin: date,
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteRodelaService = Depends(reporte_rodela_service),
):
    data = service.ReporteLotesPorPeriodo(
        ReporteLotesRodelaPorPeriodoRequest(FechaInicio=FechaInicio, FechaFin=FechaFin)
    )
    pdf = construir_reporte_lotes_rodela_por_periodo(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_lotes_rodela_periodo(FechaInicio, FechaFin)}"'
        },
    )
