from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.Auth.Dependencies import get_generado_por, require_role
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL
from app.Models.Empaque.Reporte import (
    ClaseEmpaque,
    ReporteEmpaqueRequest,
    ReporteLotesEmpaqueResponse,
    ReporteMovimientosEmpaqueResponse,
)
from app.Reportes.Empaque import (
    construir_reporte_inventario_empaque,
    construir_reporte_lotes_empaque,
    construir_reporte_movimientos_empaque,
    nombre_archivo_inventario_empaque,
    nombre_archivo_lotes_empaque,
    nombre_archivo_movimientos_empaque,
)
from app.Services.Empaque.Reporte import ReporteEmpaqueService


def reporte_empaque_service(db: Session = Depends(get_db)) -> ReporteEmpaqueService:
    return ReporteEmpaqueService(db)


EmpaqueReporteRouter = APIRouter(
    prefix="/empaque/reportes",
    tags=["Empaque - Reportes"],
)

DESCRIPCION_TIPOS = "IDs de tipo de empaque de la clase indicada. Vacío = todos los tipos."
DESCRIPCION_MOVIMIENTO = "IdTipoMovimiento a incluir (1 ingreso, 2 salida/traslado). Vacío = todos."


@EmpaqueReporteRouter.get(
    "/{clase}/inventario",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ReporteInventarioEmpaque(
    clase: ClaseEmpaque,
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteEmpaqueService = Depends(reporte_empaque_service),
):
    data = service.ReporteInventario(clase)
    pdf = construir_reporte_inventario_empaque(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_inventario_empaque(clase)}"'
        },
    )


@EmpaqueReporteRouter.get(
    "/{clase}/movimientos/resumen",
    response_model=ReporteMovimientosEmpaqueResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ResumenMovimientosEmpaque(
    clase: ClaseEmpaque,
    FechaInicio: date,
    FechaFin: date,
    IdsTipo: list[int] | None = Query(default=None, description=DESCRIPCION_TIPOS),
    IdTipoMovimiento: int | None = Query(default=None, gt=0, description=DESCRIPCION_MOVIMIENTO),
    service: ReporteEmpaqueService = Depends(reporte_empaque_service),
):
    return service.ResumenMovimientos(
        ReporteEmpaqueRequest(
            Clase=clase,
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdsTipo=IdsTipo,
            IdTipoMovimiento=IdTipoMovimiento,
        )
    )


@EmpaqueReporteRouter.get(
    "/{clase}/movimientos",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ReporteMovimientosEmpaque(
    clase: ClaseEmpaque,
    FechaInicio: date,
    FechaFin: date,
    IdsTipo: list[int] | None = Query(default=None, description=DESCRIPCION_TIPOS),
    IdTipoMovimiento: int | None = Query(default=None, gt=0, description=DESCRIPCION_MOVIMIENTO),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteEmpaqueService = Depends(reporte_empaque_service),
):
    data = service.ReporteMovimientos(
        ReporteEmpaqueRequest(
            Clase=clase,
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdsTipo=IdsTipo,
            IdTipoMovimiento=IdTipoMovimiento,
        )
    )
    pdf = construir_reporte_movimientos_empaque(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_movimientos_empaque(clase, FechaInicio, FechaFin)}"'
        },
    )


@EmpaqueReporteRouter.get(
    "/{clase}/lotes/resumen",
    response_model=ReporteLotesEmpaqueResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ResumenLotesEmpaque(
    clase: ClaseEmpaque,
    FechaInicio: date,
    FechaFin: date,
    IdsTipo: list[int] | None = Query(default=None, description=DESCRIPCION_TIPOS),
    service: ReporteEmpaqueService = Depends(reporte_empaque_service),
):
    return service.ResumenLotes(
        ReporteEmpaqueRequest(
            Clase=clase,
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdsTipo=IdsTipo,
        )
    )


@EmpaqueReporteRouter.get(
    "/{clase}/lotes",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def ReporteLotesEmpaque(
    clase: ClaseEmpaque,
    FechaInicio: date,
    FechaFin: date,
    IdsTipo: list[int] | None = Query(default=None, description=DESCRIPCION_TIPOS),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteEmpaqueService = Depends(reporte_empaque_service),
):
    data = service.ReporteLotes(
        ReporteEmpaqueRequest(
            Clase=clase,
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdsTipo=IdsTipo,
        )
    )
    pdf = construir_reporte_lotes_empaque(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_lotes_empaque(clase, FechaInicio, FechaFin)}"'
        },
    )
