from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.Auth.Dependencies import get_generado_por, require_role
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL
from app.Models.Insumo.Reporte import (
    ReporteInventarioInsumoRequest,
    ReporteInventarioInsumoResponse,
    ReporteMovimientosInsumoRequest,
    ReporteMovimientosInsumoResponse,
)
from app.Reportes.Insumo import (
    construir_reporte_inventario_insumo,
    construir_reporte_movimientos_insumo,
    nombre_archivo_inventario_insumo,
    nombre_archivo_movimientos_insumo,
)
from app.Services.Insumo.Reporte import ReporteInsumoService


def reporte_insumo_service(db: Session = Depends(get_db)) -> ReporteInsumoService:
    return ReporteInsumoService(db)


InsumoReporteRouter = APIRouter(
    prefix="/insumo/reportes",
    tags=["Insumo - Reportes"],
)


@InsumoReporteRouter.get(
    "/inventario/resumen",
    response_model=ReporteInventarioInsumoResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ResumenInventarioInsumo(
    IdsTipoInsumo: list[int] | None = Query(
        default=None,
        description="IDs de TipoInsumo a incluir. Vacío = todos los insumos.",
    ),
    service: ReporteInsumoService = Depends(reporte_insumo_service),
):
    return service.ReporteInventario(
        ReporteInventarioInsumoRequest(IdsTipoInsumo=IdsTipoInsumo)
    )


@InsumoReporteRouter.get(
    "/inventario",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ReporteInventarioInsumo(
    IdsTipoInsumo: list[int] | None = Query(
        default=None,
        description="IDs de TipoInsumo a incluir. Vacío = todos los insumos.",
    ),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteInsumoService = Depends(reporte_insumo_service),
):
    data = service.ReporteInventario(
        ReporteInventarioInsumoRequest(IdsTipoInsumo=IdsTipoInsumo)
    )
    pdf = construir_reporte_inventario_insumo(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_inventario_insumo()}"'
        },
    )


@InsumoReporteRouter.get(
    "/movimientos/resumen",
    response_model=ReporteMovimientosInsumoResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ResumenMovimientosInsumo(
    FechaInicio: date,
    FechaFin: date,
    IdsTipoInsumo: list[int] | None = Query(
        default=None,
        description="IDs de TipoInsumo a incluir. Vacío = todos los insumos.",
    ),
    service: ReporteInsumoService = Depends(reporte_insumo_service),
):
    return service.ResumenMovimientos(
        ReporteMovimientosInsumoRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdsTipoInsumo=IdsTipoInsumo,
        )
    )


@InsumoReporteRouter.get(
    "/movimientos",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ReporteMovimientosInsumo(
    FechaInicio: date,
    FechaFin: date,
    IdsTipoInsumo: list[int] | None = Query(
        default=None,
        description="IDs de TipoInsumo a incluir. Vacío = todos los insumos.",
    ),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteInsumoService = Depends(reporte_insumo_service),
):
    data = service.ReporteMovimientos(
        ReporteMovimientosInsumoRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdsTipoInsumo=IdsTipoInsumo,
        )
    )
    pdf = construir_reporte_movimientos_insumo(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_movimientos_insumo(FechaInicio, FechaFin)}"'
        },
    )
