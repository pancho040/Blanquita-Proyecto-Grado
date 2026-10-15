from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.Config.supabase import get_db

from app.Auth.Dependencies import require_role, get_generado_por
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION

from app.Models.InventarioFinal.Reporte import (
    ReporteProduccionDiariaProductoTerminadoRequest,
    ReporteProduccionDiariaProductoTerminadoResponse,
    ReporteInventarioProductoTerminadoRequest,
    ReporteInventarioProductoTerminadoResponse,
    ReporteSalidasProductoTerminadoRequest,
    ReporteSalidasConDespachosResponse,
    DespachoSalidaResponse,
)
from app.Services.InventarioFinal.Reporte import ReporteProductoTerminadoService
from app.Reportes.ProductoTerminado import (
    construir_reporte_produccion_diaria_producto_terminado,
    nombre_archivo_produccion_diaria_producto_terminado,
    construir_reporte_inventario_producto_terminado,
    nombre_archivo_inventario_producto_terminado,
    construir_reporte_salidas_producto_terminado,
    nombre_archivo_salidas_producto_terminado,
    construir_reporte_despacho_salida,
    nombre_archivo_despacho_salida,
)
from app.Reportes.ProductoTerminadoExcel import (
    construir_excel_salidas_producto_terminado,
    construir_excel_despacho_salida,
)

MEDIA_TYPE_EXCEL = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
DESCRIPCION_LINEAS = "IDs de Producto (líneas) a incluir. Vacío = todas las líneas."


def reporte_producto_terminado_service(
    db: Session = Depends(get_db),
) -> ReporteProductoTerminadoService:
    return ReporteProductoTerminadoService(db)


ProductoFinalReporteRouter = APIRouter(
    prefix="/productofinal/reportes",
    tags=["Producto Terminado - Reportes"],
)


@ProductoFinalReporteRouter.get(
    "/produccion/diaria/resumen",
    response_model=ReporteProduccionDiariaProductoTerminadoResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)
def ResumenProduccionDiariaProductoTerminado(
    FechaInicio: date,
    FechaFin: date,
    IdsProducto: list[int] | None = Query(
        default=None,
        description="IDs de Producto (líneas) a incluir. Vacío = todas las líneas.",
    ),
    service: ReporteProductoTerminadoService = Depends(
        reporte_producto_terminado_service
    ),
):
    return service.ResumenProduccionDiaria(
        ReporteProduccionDiariaProductoTerminadoRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdsProducto=IdsProducto,
        )
    )


@ProductoFinalReporteRouter.get(
    "/produccion/diaria",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)
def ReporteProduccionDiariaProductoTerminado(
    FechaInicio: date,
    FechaFin: date,
    IdsProducto: list[int] | None = Query(
        default=None,
        description="IDs de Producto (líneas) a incluir. Vacío = todas las líneas.",
    ),
    VerMovimientos: bool = False,
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteProductoTerminadoService = Depends(
        reporte_producto_terminado_service
    ),
):
    data = service.ReporteProduccionDiaria(
        ReporteProduccionDiariaProductoTerminadoRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdsProducto=IdsProducto,
            VerMovimientos=VerMovimientos,
        )
    )
    pdf = construir_reporte_produccion_diaria_producto_terminado(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_produccion_diaria_producto_terminado(FechaInicio, FechaFin)}"'
        },
    )


@ProductoFinalReporteRouter.get(
    "/inventario/resumen",
    response_model=ReporteInventarioProductoTerminadoResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)
def ResumenInventarioProductoTerminado(
    IdsProducto: list[int] | None = Query(
        default=None,
        description="IDs de Producto (líneas) a incluir. Vacío = todas las líneas.",
    ),
    service: ReporteProductoTerminadoService = Depends(
        reporte_producto_terminado_service
    ),
):
    return service.ReporteInventario(
        ReporteInventarioProductoTerminadoRequest(IdsProducto=IdsProducto)
    )


@ProductoFinalReporteRouter.get(
    "/inventario",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)
def ReporteInventarioProductoTerminado(
    IdsProducto: list[int] | None = Query(
        default=None,
        description="IDs de Producto (líneas) a incluir. Vacío = todas las líneas.",
    ),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteProductoTerminadoService = Depends(
        reporte_producto_terminado_service
    ),
):
    data = service.ReporteInventario(
        ReporteInventarioProductoTerminadoRequest(IdsProducto=IdsProducto)
    )
    pdf = construir_reporte_inventario_producto_terminado(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_inventario_producto_terminado()}"'
        },
    )


@ProductoFinalReporteRouter.get(
    "/salidas/resumen",
    response_model=ReporteSalidasConDespachosResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)
def ResumenSalidasProductoTerminado(
    FechaInicio: date,
    FechaFin: date,
    IdsProducto: list[int] | None = Query(default=None, description=DESCRIPCION_LINEAS),
    service: ReporteProductoTerminadoService = Depends(
        reporte_producto_terminado_service
    ),
):
    return service.ResumenSalidas(
        ReporteSalidasProductoTerminadoRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdsProducto=IdsProducto,
        )
    )


@ProductoFinalReporteRouter.get(
    "/salidas",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)
def ReporteSalidasProductoTerminado(
    FechaInicio: date,
    FechaFin: date,
    IdsProducto: list[int] | None = Query(default=None, description=DESCRIPCION_LINEAS),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteProductoTerminadoService = Depends(
        reporte_producto_terminado_service
    ),
):
    data = service.ReporteSalidas(
        ReporteSalidasProductoTerminadoRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdsProducto=IdsProducto,
        )
    )
    pdf = construir_reporte_salidas_producto_terminado(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_salidas_producto_terminado(FechaInicio, FechaFin)}"'
        },
    )


@ProductoFinalReporteRouter.get(
    "/salidas/excel",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {MEDIA_TYPE_EXCEL: {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)
def ExcelSalidasProductoTerminado(
    FechaInicio: date,
    FechaFin: date,
    IdsProducto: list[int] | None = Query(default=None, description=DESCRIPCION_LINEAS),
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteProductoTerminadoService = Depends(
        reporte_producto_terminado_service
    ),
):
    data = service.ReporteSalidas(
        ReporteSalidasProductoTerminadoRequest(
            FechaInicio=FechaInicio,
            FechaFin=FechaFin,
            IdsProducto=IdsProducto,
        )
    )
    excel = construir_excel_salidas_producto_terminado(data, generado_por)

    return Response(
        content=excel,
        media_type=MEDIA_TYPE_EXCEL,
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_salidas_producto_terminado(FechaInicio, FechaFin, "xlsx")}"'
        },
    )


@ProductoFinalReporteRouter.get(
    "/salidas/despacho/{id_movimiento}/detalle",
    response_model=DespachoSalidaResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)
def DetalleDespachoSalida(
    id_movimiento: int,
    service: ReporteProductoTerminadoService = Depends(
        reporte_producto_terminado_service
    ),
):
    return service.ReporteDespacho(id_movimiento)


@ProductoFinalReporteRouter.get(
    "/salidas/despacho/{id_movimiento}",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)
def ReporteDespachoSalida(
    id_movimiento: int,
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteProductoTerminadoService = Depends(
        reporte_producto_terminado_service
    ),
):
    data = service.ReporteDespacho(id_movimiento)
    pdf = construir_reporte_despacho_salida(data, generado_por)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_despacho_salida(data.IdDespacho)}"'
        },
    )


@ProductoFinalReporteRouter.get(
    "/salidas/despacho/{id_movimiento}/excel",
    status_code=200,
    response_class=Response,
    responses={200: {"content": {MEDIA_TYPE_EXCEL: {}}}},
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)
def ExcelDespachoSalida(
    id_movimiento: int,
    generado_por: str | None = Depends(get_generado_por),
    service: ReporteProductoTerminadoService = Depends(
        reporte_producto_terminado_service
    ),
):
    data = service.ReporteDespacho(id_movimiento)
    excel = construir_excel_despacho_salida(data, generado_por)

    return Response(
        content=excel,
        media_type=MEDIA_TYPE_EXCEL,
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo_despacho_salida(data.IdDespacho, "xlsx")}"'
        },
    )
