from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.Auth.Dependencies import get_generado_por, require_admin_db
from app.Config.supabase import get_db
from app.Constants.RegistroIngreso import LONGITUD_MAXIMA_CI_BUSQUEDA, PATRON_CI_BUSQUEDA
from app.Models.Usuario.RegistroIngreso import (
    FiltroRegistroIngresoRequest,
    ListarRegistroIngresoRequest,
    ListarRegistroIngresoResponse,
    ListarUsuarioRegistroIngresoRequest,
    ListarUsuarioRegistroIngresoResponse,
    ReporteUsuarioRegistroIngresoRequest,
    ReporteUsuarioRegistroIngresoResponse,
)
from app.Reportes.RegistroIngreso import (
    construir_reporte_registro_ingreso,
    construir_reporte_usuario_registro_ingreso,
    nombre_archivo_registro_ingreso,
    nombre_archivo_usuario_registro_ingreso,
)
from app.Services.Usuario.RegistroIngreso import RegistroIngresoService


def registro_ingreso_service(db: Session = Depends(get_db)) -> RegistroIngresoService:
    return RegistroIngresoService(db)


RegistroIngresoRouter = APIRouter(
    prefix="/registroingreso",
    tags=["Usuario - Registro de accesos"],
    dependencies=[Depends(require_admin_db)],
)


@RegistroIngresoRouter.get(
    "/listar",
    response_model=ListarRegistroIngresoResponse,
    status_code=200,
)
def ListarRegistroIngreso(
    FechaInicio: date,
    FechaFin: date,
    Registro: str | None = Query(default=None, description="Ingreso, Salida o Intento fallido"),
    Ci: str | None = Query(default=None, max_length=LONGITUD_MAXIMA_CI_BUSQUEDA, pattern=PATRON_CI_BUSQUEDA),
    Pagina: int = Query(default=1, ge=1),
    TamanoPagina: int = Query(default=20, ge=1, le=100),
    service: RegistroIngresoService = Depends(registro_ingreso_service),
):
    return service.ListarRegistros(
        ListarRegistroIngresoRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            Registro=Registro,
            Ci=Ci,
            Pagina=Pagina,
            TamanoPagina=TamanoPagina,
        )
    )


@RegistroIngresoRouter.get(
    "/reporte",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def ReporteRegistroIngreso(
    FechaInicio: date,
    FechaFin: date,
    Registro: str | None = Query(default=None, description="Ingreso, Salida o Intento fallido"),
    Ci: str | None = Query(default=None, max_length=LONGITUD_MAXIMA_CI_BUSQUEDA, pattern=PATRON_CI_BUSQUEDA),
    generado_por: str | None = Depends(get_generado_por),
    service: RegistroIngresoService = Depends(registro_ingreso_service),
):
    data = service.ReporteGeneral(
        FiltroRegistroIngresoRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            Registro=Registro,
            Ci=Ci,
        )
    )
    pdf = construir_reporte_registro_ingreso(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_registro_ingreso(FechaInicio, FechaFin)}"'
        },
    )


@RegistroIngresoRouter.get(
    "/usuario/listar",
    response_model=ListarUsuarioRegistroIngresoResponse,
    status_code=200,
)
def ListarUsuarioRegistroIngreso(
    Ci: str = Query(..., max_length=LONGITUD_MAXIMA_CI_BUSQUEDA, pattern=PATRON_CI_BUSQUEDA),
    FechaInicio: date | None = None,
    FechaFin: date | None = None,
    Registro: str | None = Query(default=None, description="Ingreso, Salida o Intento fallido"),
    Pagina: int = Query(default=1, ge=1),
    TamanoPagina: int = Query(default=20, ge=1, le=100),
    service: RegistroIngresoService = Depends(registro_ingreso_service),
):
    return service.ListarUsuario(
        ListarUsuarioRegistroIngresoRequest(
            Ci=Ci,
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            Registro=Registro,
            Pagina=Pagina,
            TamanoPagina=TamanoPagina,
        )
    )


@RegistroIngresoRouter.get(
    "/usuario/resumen",
    response_model=ReporteUsuarioRegistroIngresoResponse,
    status_code=200,
)
def ResumenUsuarioRegistroIngreso(
    Ci: str = Query(..., max_length=LONGITUD_MAXIMA_CI_BUSQUEDA, pattern=PATRON_CI_BUSQUEDA),
    FechaInicio: date | None = None,
    FechaFin: date | None = None,
    Registro: str | None = Query(default=None, description="Ingreso, Salida o Intento fallido"),
    service: RegistroIngresoService = Depends(registro_ingreso_service),
):
    return service.ResumenUsuario(
        ReporteUsuarioRegistroIngresoRequest(
            Ci=Ci,
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            Registro=Registro,
        )
    )


@RegistroIngresoRouter.get(
    "/usuario/reporte",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def ReporteUsuarioRegistroIngreso(
    Ci: str = Query(..., max_length=LONGITUD_MAXIMA_CI_BUSQUEDA, pattern=PATRON_CI_BUSQUEDA),
    FechaInicio: date | None = None,
    FechaFin: date | None = None,
    Registro: str | None = Query(default=None, description="Ingreso, Salida o Intento fallido"),
    generado_por: str | None = Depends(get_generado_por),
    service: RegistroIngresoService = Depends(registro_ingreso_service),
):
    data = service.ReporteUsuario(
        ReporteUsuarioRegistroIngresoRequest(
            Ci=Ci,
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            Registro=Registro,
        )
    )
    pdf = construir_reporte_usuario_registro_ingreso(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_usuario_registro_ingreso(Ci, FechaInicio, FechaFin)}"'
        },
    )
