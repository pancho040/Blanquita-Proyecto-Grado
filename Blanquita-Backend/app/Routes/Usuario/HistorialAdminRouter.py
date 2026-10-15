from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.Auth.Dependencies import get_generado_por, require_admin_db
from app.Config.supabase import get_db
from app.Constants.HistorialAdmin import LONGITUD_MAXIMA_BUSQUEDA_HISTORIAL_ADMIN
from app.Constants.RegistroIngreso import LONGITUD_MAXIMA_CI_BUSQUEDA, PATRON_CI_BUSQUEDA
from app.Models.Usuario.HistorialAdmin import (
    FiltroHistorialAdminRequest,
    ListarHistorialAdminRequest,
    ListarHistorialAdminResponse,
    ReporteUsuarioHistorialAdminRequest,
    ReporteUsuarioHistorialAdminResponse,
)
from app.Reportes.HistorialAdmin import (
    construir_reporte_historial_admin,
    construir_reporte_usuario_historial_admin,
    nombre_archivo_historial_admin,
    nombre_archivo_usuario_historial_admin,
)
from app.Services.Usuario.HistorialAdmin import HistorialAdminService


def historial_admin_service(db: Session = Depends(get_db)) -> HistorialAdminService:
    return HistorialAdminService(db)


HistorialAdminRouter = APIRouter(
    prefix="/historialadmin",
    tags=["Usuario - Acciones de administrador"],
    dependencies=[Depends(require_admin_db)],
)

DESCRIPCION_MODULO = "Usuarios, Proveedores, Insumos u Otros"


@HistorialAdminRouter.get(
    "/listar",
    response_model=ListarHistorialAdminResponse,
    status_code=200,
)
def ListarHistorialAdmin(
    FechaInicio: date,
    FechaFin: date,
    Modulo: str | None = Query(default=None, description=DESCRIPCION_MODULO),
    Ci: str | None = Query(default=None, max_length=LONGITUD_MAXIMA_CI_BUSQUEDA, pattern=PATRON_CI_BUSQUEDA),
    Busqueda: str | None = Query(default=None, max_length=LONGITUD_MAXIMA_BUSQUEDA_HISTORIAL_ADMIN),
    Pagina: int = Query(default=1, ge=1),
    TamanoPagina: int = Query(default=20, ge=1, le=100),
    service: HistorialAdminService = Depends(historial_admin_service),
):
    return service.ListarAcciones(
        ListarHistorialAdminRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            Modulo=Modulo,
            Ci=Ci,
            Busqueda=Busqueda,
            Pagina=Pagina,
            TamanoPagina=TamanoPagina,
        )
    )


@HistorialAdminRouter.get(
    "/reporte",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def ReporteHistorialAdmin(
    FechaInicio: date,
    FechaFin: date,
    Modulo: str | None = Query(default=None, description=DESCRIPCION_MODULO),
    Ci: str | None = Query(default=None, max_length=LONGITUD_MAXIMA_CI_BUSQUEDA, pattern=PATRON_CI_BUSQUEDA),
    Busqueda: str | None = Query(default=None, max_length=LONGITUD_MAXIMA_BUSQUEDA_HISTORIAL_ADMIN),
    generado_por: str | None = Depends(get_generado_por),
    service: HistorialAdminService = Depends(historial_admin_service),
):
    data = service.ReporteGeneral(
        FiltroHistorialAdminRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            Modulo=Modulo,
            Ci=Ci,
            Busqueda=Busqueda,
        )
    )
    pdf = construir_reporte_historial_admin(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_historial_admin(FechaInicio, FechaFin)}"'
        },
    )


@HistorialAdminRouter.get(
    "/usuario/resumen",
    response_model=ReporteUsuarioHistorialAdminResponse,
    status_code=200,
)
def ResumenUsuarioHistorialAdmin(
    Ci: str = Query(..., max_length=LONGITUD_MAXIMA_CI_BUSQUEDA, pattern=PATRON_CI_BUSQUEDA),
    FechaInicio: date = Query(...),
    FechaFin: date = Query(...),
    Modulo: str | None = Query(default=None, description=DESCRIPCION_MODULO),
    Busqueda: str | None = Query(default=None, max_length=LONGITUD_MAXIMA_BUSQUEDA_HISTORIAL_ADMIN),
    service: HistorialAdminService = Depends(historial_admin_service),
):
    return service.ResumenUsuario(
        ReporteUsuarioHistorialAdminRequest(
            Ci=Ci,
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            Modulo=Modulo,
            Busqueda=Busqueda,
        )
    )


@HistorialAdminRouter.get(
    "/usuario/reporte",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def ReporteUsuarioHistorialAdmin(
    Ci: str = Query(..., max_length=LONGITUD_MAXIMA_CI_BUSQUEDA, pattern=PATRON_CI_BUSQUEDA),
    FechaInicio: date = Query(...),
    FechaFin: date = Query(...),
    Modulo: str | None = Query(default=None, description=DESCRIPCION_MODULO),
    Busqueda: str | None = Query(default=None, max_length=LONGITUD_MAXIMA_BUSQUEDA_HISTORIAL_ADMIN),
    generado_por: str | None = Depends(get_generado_por),
    service: HistorialAdminService = Depends(historial_admin_service),
):
    data = service.ReporteUsuario(
        ReporteUsuarioHistorialAdminRequest(
            Ci=Ci,
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            Modulo=Modulo,
            Busqueda=Busqueda,
        )
    )
    pdf = construir_reporte_usuario_historial_admin(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_usuario_historial_admin(Ci, FechaInicio, FechaFin)}"'
        },
    )
