from datetime import date, datetime

from app.Models.InventarioFinal.Reporte import (
    ReporteProduccionDiariaProductoTerminadoResponse,
    ReporteInventarioProductoTerminadoResponse,
    ReporteSalidasConDespachosResponse,
    DespachoSalidaResponse,
)
from app.Reportes.reporte import Reporte
from app.utils.dates import ZONA_BOLIVIA

DIAS_SEMANA = ("Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom")


def _texto_periodo(inicio: date, fin: date) -> str:
    if inicio == fin:
        return f"Día {inicio.strftime('%d/%m/%Y')}"
    return f"Del {inicio.strftime('%d/%m/%Y')} al {fin.strftime('%d/%m/%Y')}"


def _texto_lineas(
    data: ReporteProduccionDiariaProductoTerminadoResponse
    | ReporteInventarioProductoTerminadoResponse,
) -> str:
    if data.TodasLasLineas:
        return "Todas"
    if len(data.Lineas) <= 3:
        return ", ".join(linea.NombreProducto for linea in data.Lineas)
    return f"{len(data.Lineas)} seleccionadas"


def _texto_fecha_con_dia(fecha: date) -> str:
    return f"{DIAS_SEMANA[fecha.weekday()]} {fecha.strftime('%d/%m/%Y')}"


def _texto_paquetes(cantidad: int | None) -> str | None:
    if cantidad is None:
        return None
    return f"{cantidad} paquete" if cantidad == 1 else f"{cantidad} paquetes"


def construir_reporte_produccion_diaria_producto_terminado(
    data: ReporteProduccionDiariaProductoTerminadoResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Producción diaria - Producto terminado",
        subtitulo=_texto_periodo(data.PeriodoInicio, data.PeriodoFin),
        filtros={"Líneas": _texto_lineas(data)},
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    lineas_con_produccion = [linea for linea in data.Lineas if linea.NumeroRegistros]

    reporte.titulo_seccion("Resumen por línea")
    reporte.tabla(
        columnas=[
            ("Línea", "NombreProducto"),
            ("Unidad", lambda linea: linea.Unidad.capitalize()),
            (
                "Total",
                lambda linea: linea.Total if linea.NumeroRegistros else "Sin producción",
            ),
            ("Días con producción", "DiasConProduccion"),
            ("Promedio por día", "PromedioPorDia"),
            ("N° Registros", "NumeroRegistros"),
        ],
        filas=data.Lineas,
    )
    reporte.parrafo(
        f"Días con producción: {data.DiasConProduccion} de {data.DiasPeriodo}."
    )

    if data.PeriodoInicio < data.PeriodoFin:
        reporte.titulo_seccion("Producción por día")
        reporte.tabla(
            columnas=[("Fecha", lambda dia: _texto_fecha_con_dia(dia.Fecha))]
            + [
                (
                    f"{linea.NombreProducto} ({linea.Unidad})",
                    lambda dia, id_producto=linea.IdProducto: dia.TotalesPorLinea.get(
                        id_producto
                    ),
                )
                for linea in lineas_con_produccion
            ],
            filas=data.ProduccionPorDia,
            fila_total=["TOTAL"] + [linea.Total for linea in lineas_con_produccion],
        )

    for linea in lineas_con_produccion:
        total = f"{linea.Total:,}".replace(",", ".")
        reporte.titulo_seccion(f"{linea.NombreProducto}: {total} {linea.Unidad}")
        reporte.tabla(
            columnas=[
                ("Código", "CodigoPresentacion"),
                ("Producto", "NombrePresentacion"),
                ("Entradas", "Entradas"),
                ("Correcciones", "Correcciones"),
                ("Total", "Total"),
                ("N° Registros", "NumeroRegistros"),
            ],
            filas=linea.Presentaciones,
            fila_total=[
                "TOTAL",
                "",
                linea.Entradas,
                linea.Correcciones,
                linea.Total,
                linea.NumeroRegistros,
            ],
        )

    if data.Movimientos is not None:
        for linea in lineas_con_produccion:
            movimientos = [
                m for m in data.Movimientos if m.IdProducto == linea.IdProducto
            ]
            reporte.titulo_seccion(
                f"Movimientos - {linea.NombreProducto} ({len(movimientos)})"
            )
            reporte.tabla(
                columnas=[
                    ("Fecha", "FechaMovimiento"),
                    ("Código", "CodigoPresentacion"),
                    ("Producto", "NombrePresentacion"),
                    ("Movimiento", "NombreTipoMovimientoInventario"),
                    ("Cantidad", "Cantidad"),
                    (
                        "Operador",
                        lambda m: reporte.celda_multilinea(
                            [f"{m.PrimerNombre} {m.ApellidoPaterno},", m.Ci, m.NombreRol]
                        ),
                    ),
                    ("Observación", "Observacion"),
                ],
                filas=movimientos,
                fila_total=[
                    "TOTAL",
                    "",
                    "",
                    "",
                    sum(m.Cantidad for m in movimientos),
                    "",
                    "",
                ],
            )

    return reporte.a_pdf()


def nombre_archivo_produccion_diaria_producto_terminado(
    fecha_inicio: date, fecha_fin: date
) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return (
        f"produccion-diaria-producto-terminado-{fecha_inicio:%Y%m%d}-{fecha_fin:%Y%m%d}"
        f"-{ahora:%Y%m%d-%H%M}.pdf"
    )


def construir_reporte_inventario_producto_terminado(
    data: ReporteInventarioProductoTerminadoResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Informe de inventario - Producto terminado",
        subtitulo="Stock actual en almacén",
        filtros={"Líneas": _texto_lineas(data)},
        generado_en=data.FechaGeneracion,
        generado_por=generado_por,
    )

    reporte.titulo_seccion("Resumen por línea")
    reporte.tabla(
        columnas=[
            ("Línea", "NombreProducto"),
            ("Unidad", lambda linea: linea.Unidad.capitalize()),
            ("Stock", "Total"),
            ("Presentaciones", lambda linea: len(linea.Presentaciones)),
        ],
        filas=data.Lineas,
    )

    for linea in data.Lineas:
        total = f"{linea.Total:,}".replace(",", ".")
        reporte.titulo_seccion(f"{linea.NombreProducto}: {total} {linea.Unidad}")
        reporte.tabla(
            columnas=[
                ("Código", "CodigoPresentacion"),
                ("Producto", "NombrePresentacion"),
                ("Contenedor", "TipoContenedor"),
                ("Contenido", lambda p: _texto_paquetes(p.CantidadPorUnidadTerminada)),
                ("Stock", "CantidadActual"),
                ("Último movimiento", "FechaUltimoMovimiento"),
            ],
            filas=linea.Presentaciones,
            fila_total=["TOTAL", "", "", "", linea.Total, ""],
        )

    return reporte.a_pdf()


def nombre_archivo_inventario_producto_terminado() -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return f"informe-inventario-producto-terminado-{ahora:%Y%m%d-%H%M}.pdf"


def numero_salida_por_movimiento(data: ReporteSalidasConDespachosResponse) -> dict[int, int]:
    return {
        item.IdMovimientoProductoTerminado: despacho.IdDespacho
        for despacho in data.Despachos
        for item in despacho.Items
    }


def _texto_lineas_salidas(data: ReporteSalidasConDespachosResponse) -> str:
    if data.TodasLasLineas:
        return "Todas"
    if len(data.NombresLineas) <= 3:
        return ", ".join(data.NombresLineas)
    return f"{len(data.NombresLineas)} seleccionadas"


def construir_reporte_salidas_producto_terminado(
    data: ReporteSalidasConDespachosResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Salidas de producto terminado",
        subtitulo=_texto_periodo(data.PeriodoInicio, data.PeriodoFin),
        filtros={"Líneas": _texto_lineas_salidas(data)},
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    reporte.titulo_seccion("Resumen por línea")
    reporte.tabla(
        columnas=[
            ("Línea", "NombreProducto"),
            ("Unidad", lambda linea: linea.Unidad.capitalize()),
            ("Cantidad salida", "CantidadSalida"),
            ("N° salidas", "NumeroSalidas"),
        ],
        filas=data.Lineas,
    )

    reporte.titulo_seccion("Resumen por presentación")
    reporte.tabla(
        columnas=[
            ("Código", "CodigoPresentacion"),
            ("Producto", "NombrePresentacion"),
            ("Unidad", lambda p: p.Unidad.capitalize()),
            ("Cantidad salida", "CantidadSalida"),
            ("N° salidas", "NumeroSalidas"),
            ("Stock actual", "CantidadActual"),
        ],
        filas=data.Presentaciones,
    )

    numero_salida = numero_salida_por_movimiento(data)

    reporte.titulo_seccion(f"Detalle de salidas ({len(data.Despachos)})")
    reporte.tabla(
        columnas=[
            ("Salida", lambda m: f"N° {numero_salida[m.IdMovimientoProductoTerminado]}"),
            ("Fecha", "FechaMovimiento"),
            ("Código", "CodigoPresentacion"),
            ("Producto", "NombrePresentacion"),
            ("Cantidad", "Cantidad"),
            (
                "Usuario",
                lambda m: reporte.celda_multilinea(
                    [f"{m.PrimerNombre} {m.ApellidoPaterno},", m.Ci, m.NombreRol]
                ),
            ),
            ("Observación", "Observacion"),
        ],
        filas=data.Movimientos,
    )

    return reporte.a_pdf()


def nombre_archivo_salidas_producto_terminado(
    fecha_inicio: date, fecha_fin: date, extension: str = "pdf"
) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return (
        f"salidas-producto-terminado-{fecha_inicio:%Y%m%d}-{fecha_fin:%Y%m%d}"
        f"-{ahora:%Y%m%d-%H%M}.{extension}"
    )


def construir_reporte_despacho_salida(
    data: DespachoSalidaResponse,
    generado_por: str | None = None,
) -> bytes:
    fecha = data.FechaMovimiento.astimezone(ZONA_BOLIVIA)
    reporte = Reporte(
        titulo=f"Salida de producto terminado N° {data.IdDespacho}",
        subtitulo=f"Registrada el {fecha:%d/%m/%Y} a las {fecha:%H:%M}",
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    reporte.parrafo(f"Observación: {data.Observacion or '-'}")
    reporte.titulo_seccion(f"Presentaciones ({data.NumeroPresentaciones})")
    reporte.tabla(
        columnas=[
            ("Código", "CodigoPresentacion"),
            ("Producto", "NombrePresentacion"),
            ("Línea", "NombreProducto"),
            ("Unidad", lambda m: m.Unidad.capitalize()),
            ("Cantidad", "Cantidad"),
            (
                "Registrado por",
                lambda m: reporte.celda_multilinea(
                    [f"{data.PrimerNombre} {data.ApellidoPaterno},", data.Ci, data.NombreRol]
                ),
            ),
        ],
        filas=data.Items,
        fila_total=["TOTAL", "", "", "", data.CantidadTotal, ""],
    )

    return reporte.a_pdf()


def nombre_archivo_despacho_salida(id_despacho: int, extension: str = "pdf") -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return f"salida-producto-terminado-{id_despacho}-{ahora:%Y%m%d-%H%M}.{extension}"
