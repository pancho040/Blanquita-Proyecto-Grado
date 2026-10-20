from datetime import date, datetime, timedelta
from typing import Optional

from app.Models.BobinaPapel.Reportes import (
    ReporteInventarioBobinaPapelResponse,
    ReporteProduccionBobinaTuboDetalleResponse,
    ReporteLoteBobinaPapelDetalleResponse,
    ReporteLotesPorPeriodoResponse,
    ReporteCancelacionProduccionBobinaTuboResponse,
    ReporteProduccionPorPeriodoResponse,
    ReporteHistorialMovimientosBobinaResponse,
)
from app.Reportes.reporte import Reporte
from app.utils.dates import ZONA_BOLIVIA


def _formatear_duracion(duracion: Optional[timedelta]) -> str:
    if duracion is None:
        return "-"
    total_segundos = int(duracion.total_seconds())
    horas, resto = divmod(total_segundos, 3600)
    minutos, segundos = divmod(resto, 60)
    return f"{horas}h {minutos:02d}m {segundos:02d}s"


def _seccion_movimientos_logs(reporte: Reporte, movimientos) -> None:
    reporte.titulo_seccion(f"Movimientos de logs ({len(movimientos)})")
    if movimientos:
        reporte.tabla(
            columnas=[
                ("Fecha", "FechaMovimiento"),
                ("Movimiento", "NombreMovimiento"),
                ("Cantidad", "CantidadLogs"),
                (
                    "Operador",
                    lambda m: reporte.celda_multilinea(
                        [f"{m.PrimerNombre} {m.ApellidoPaterno},", m.Ci, m.NombreRol]
                    ),
                ),
                ("Observación", "Observacion"),
            ],
            filas=movimientos,
        )
    else:
        reporte.parrafo("Esta producción no registró movimientos de logs.")


def _seccion_cargada(reporte: Reporte, data) -> None:
    reporte.titulo_seccion(f"Producciones de la cargada ({len(data.Cargada)})")
    reporte.parrafo(
        "Producciones realizadas con el mismo par de bobinas, en orden de inicio. "
        "Cada cambio de línea cierra una producción e inicia la siguiente."
    )
    reporte.tabla(
        columnas=[
            (
                "Producción",
                lambda c: f"#{c.IdProduccionBobinaTubo}"
                + (" (este reporte)" if c.IdProduccionBobinaTubo == data.IdProduccionBobinaTubo else ""),
            ),
            ("Producto", "NombreProducto"),
            ("Estado", "NombreEstadoProduccion"),
            ("Turno", "NombreTurno"),
            ("Operador", "Operador"),
            ("Inicio", "FechaInicioProduccion"),
            ("Fin", "FechaFinProduccion"),
            ("Duración", lambda c: _formatear_duracion(c.DuracionTotal)),
            ("Logs", "CantidadLogsActual"),
        ],
        filas=data.Cargada,
        fila_total=[
            "TOTAL",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            sum(c.CantidadLogsActual for c in data.Cargada),
        ],
    )


def _filas_datos_generales(data, etiqueta_operador: str) -> list[dict]:
    return [
        {"campo": "Producto", "valor": data.NombreProducto},
        {"campo": "Tipo de bobina", "valor": data.TipoBobina},
        {"campo": etiqueta_operador, "valor": data.Operador},
        {"campo": "CI", "valor": data.Ci},
        {"campo": "Rol", "valor": data.NombreRol},
        {"campo": "Fecha inicio", "valor": data.FechaInicioProduccion},
        {"campo": "Fecha fin", "valor": data.FechaFinProduccion},
        {"campo": "Duración total", "valor": _formatear_duracion(data.DuracionTotal)},
        {
            "campo": "Cantidad de logs",
            "valor": f"{data.CantidadLogsActual:,}".replace(",", "."),
        },
    ]


def construir_reporte_inventario_bobina_papel(
    data: ReporteInventarioBobinaPapelResponse,
    generado_por: str | None = None,
) -> bytes:
    tipos = ", ".join(r.NombreTipoBobina for r in data.Resumen) or "Todos"

    reporte = Reporte(
        titulo="Informe de inventario - Bobina de papel",
        subtitulo="Bobinas en almacén",
        filtros={"Tipos": tipos},
        generado_en=data.FechaGeneracion,
        generado_por=generado_por,
    )

    reporte.titulo_seccion("Resumen por tipo")
    reporte.tabla(
        columnas=[
            ("Tipo", "NombreTipoBobina"),
            ("Cantidad", "CantidadBobinas"),
            ("Peso neto (kg)", "PesoNetoTotalKg"),
            ("Gramaje prom.", "GramajePromedio"),
            ("Recepción más antigua", "RecepcionMasAntigua"),
            ("Recepción más reciente", "RecepcionMasReciente"),
        ],
        filas=data.Resumen,
        fila_total=[
            "TOTAL",
            data.TotalBobinas,
            data.PesoNetoGeneralKg,
            "",
            "",
            "",
        ],
    )

    for tipo in data.Resumen:
        bobinas_tipo = [
            b for b in data.Bobinas if b.IdTipoBobina == tipo.IdTipoBobina
        ]
        reporte.titulo_seccion(f"{tipo.NombreTipoBobina} ({tipo.CantidadBobinas})")
        reporte.tabla(
            columnas=[
                ("Código", "CodigoBobina"),
                ("Lote", "CodigoLote"),
                ("Recepción", "FechaRecepcion"),
                ("Proveedor", "NombreProveedor"),
                ("P. bruto (kg)", "PesoBrutoKg"),
                ("P. neto (kg)", "PesoNetoKg"),
                ("Gramaje", "Gramaje"),
            ],
            filas=bobinas_tipo,
        )

    return reporte.a_pdf()


def nombre_archivo_inventario() -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return f"informe-inventario-bobina-papel-{ahora:%Y%m%d-%H%M}.pdf"


def construir_reporte_detalle_produccion_bobina_papel(
    data: ReporteProduccionBobinaTuboDetalleResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Detalle de producción - Bobina de papel",
        subtitulo=f"Producción #{data.IdProduccionBobinaTubo} - {data.NombreProducto}",
        filtros={"Estado": data.NombreEstadoProduccion, "Turno": data.NombreTurno},
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    reporte.titulo_seccion("Datos generales")
    reporte.tabla(
        columnas=[("Campo", "campo"), ("Valor", "valor")],
        filas=_filas_datos_generales(data, "Operador"),
    )

    reporte.titulo_seccion("Bobinas utilizadas")
    reporte.tabla(
        columnas=[
            ("Bobina", "etiqueta"),
            ("Código", "codigo"),
            ("Peso neto (kg)", "peso"),
            ("Gramaje", "gramaje"),
            ("Proveedor", "proveedor"),
            ("Recepción", "recepcion"),
        ],
        filas=[
            {
                "etiqueta": "Bobina 1",
                "codigo": data.CodigoBobina1,
                "peso": data.PesoNeto1,
                "gramaje": data.Gramaje1,
                "proveedor": data.Proveedor1,
                "recepcion": data.Recepcion1,
            },
            {
                "etiqueta": "Bobina 2",
                "codigo": data.CodigoBobina2,
                "peso": data.PesoNeto2,
                "gramaje": data.Gramaje2,
                "proveedor": data.Proveedor2,
                "recepcion": data.Recepcion2,
            },
        ],
    )

    _seccion_cargada(reporte, data)

    if data.Pausas is not None:
        reporte.titulo_seccion(f"Pausas ({len(data.Pausas)})")
        if data.Pausas:
            reporte.tabla(
                columnas=[
                    ("Inicio", "FechaHoraPausa"),
                    ("Reanudación", "FechaHoraReanudacion"),
                    ("Duración", lambda p: _formatear_duracion(p.DuracionPausa)),
                    ("Motivo pausa", "MotivoPausaProduccion"),
                    ("Motivo reanudación", "MotivoReanudacion"),
                    ("Operador", "OperadorPausa"),
                    ("Rol", "RolPausa"),
                    ("Estado", "EstadoPausa"),
                ],
                filas=data.Pausas,
            )
            reporte.parrafo(
                f"Tiempo total pausado: {_formatear_duracion(data.TotalTiempoPausado)}"
            )
        else:
            reporte.parrafo("Esta producción no registró pausas.")

    if data.Movimientos is not None:
        _seccion_movimientos_logs(reporte, data.Movimientos)

    return reporte.a_pdf()


def nombre_archivo_detalle_produccion(id_produccion: int) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return f"detalle-produccion-bobina-papel-{id_produccion}-{ahora:%Y%m%d-%H%M}.pdf"


def construir_reporte_lote_bobina_papel_detalle(
    data: ReporteLoteBobinaPapelDetalleResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Detalle de lote - Bobina de papel",
        subtitulo=f"Lote #{data.IdLoteBobina} - {data.NombreProveedor}",
        filtros={
            "Proveedor": data.NombreProveedor,
            "Recepción": data.FechaRecepcion.strftime("%d/%m/%Y"),
        },
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    reporte.titulo_seccion("Datos generales")
    reporte.tabla(
        columnas=[("Campo", "campo"), ("Valor", "valor")],
        filas=[
            {"campo": "Proveedor", "valor": data.NombreProveedor},
            {"campo": "Fecha de recepción", "valor": data.FechaRecepcion},
            {
                "campo": "Cantidad de bobinas",
                "valor": f"{data.CantidadBobinas:,}".replace(",", "."),
            },
            {
                "campo": "Registrado por",
                "valor": f"{data.PrimerNombre} {data.ApellidoPaterno}",
            },
            {"campo": "CI", "valor": data.Ci},
            {"campo": "Rol", "valor": data.NombreRol},
        ],
    )

    reporte.titulo_seccion(f"Bobinas del lote ({data.CantidadBobinas})")
    reporte.tabla(
        columnas=[
            ("Código", "CodigoBobina"),
            ("Tipo", "NombreTipoBobina"),
            ("P. bruto (kg)", "PesoBrutoKg"),
            ("P. neto (kg)", "PesoNetoKg"),
            ("Gramaje", "Gramaje"),
        ],
        filas=data.Bobinas,
    )

    return reporte.a_pdf()


def nombre_archivo_lote_detalle(id_lote_bobina: int) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return f"detalle-lote-bobina-papel-{id_lote_bobina}-{ahora:%Y%m%d-%H%M}.pdf"


def construir_reporte_lotes_por_periodo(
    data: ReporteLotesPorPeriodoResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Ingresos por período - Bobina de papel",
        subtitulo=(
            f"Del {data.PeriodoInicio.strftime('%d/%m/%Y')} "
            f"al {data.PeriodoFin.strftime('%d/%m/%Y')}"
        ),
        filtros={
            "Lotes": f"{data.TotalLotes:,}".replace(",", "."),
            "Bobinas": f"{data.TotalBobinas:,}".replace(",", "."),
        },
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    if not data.Lotes:
        reporte.parrafo("No se encontraron lotes en este período.")
        return reporte.a_pdf()

    for lote in data.Lotes:
        reporte.titulo_seccion(
            f"Lote #{lote.IdLoteBobina} - {lote.FechaRecepcion.strftime('%d/%m/%Y')} "
            f"- {lote.NombreProveedor} ({lote.CantidadBobinas})"
        )
        reporte.tabla(
            columnas=[
                ("Código", "CodigoBobina"),
                ("Tipo", "NombreTipoBobina"),
                ("P. bruto (kg)", "PesoBrutoKg"),
                ("P. neto (kg)", "PesoNetoKg"),
                ("Gramaje", "Gramaje"),
                (
                    "Registrado por",
                    lambda _bobina, lote=lote: reporte.celda_multilinea(
                        [
                            f"{lote.PrimerNombre} {lote.ApellidoPaterno}",
                            f"CI {lote.Ci}",
                            lote.NombreRol,
                        ]
                    ),
                ),
            ],
            filas=lote.Bobinas,
        )

    return reporte.a_pdf()


def nombre_archivo_lotes_periodo(fecha_inicio: date, fecha_fin: date) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return (
        f"ingresos-lotes-periodo-{fecha_inicio:%Y%m%d}-{fecha_fin:%Y%m%d}"
        f"-{ahora:%Y%m%d-%H%M}.pdf"
    )


def construir_reporte_cancelacion_produccion_bobina_papel(
    data: ReporteCancelacionProduccionBobinaTuboResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Producción cancelada - Bobina de papel",
        subtitulo=f"Producción #{data.IdProduccionBobinaTubo} - {data.NombreProducto}",
        filtros={"Turno": data.NombreTurno, "Cancelada por": data.Cancelacion.Operador},
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    reporte.titulo_seccion("Motivo de cancelación")
    reporte.tabla(
        columnas=[("Campo", "campo"), ("Valor", "valor")],
        filas=[
            {"campo": "Fecha y hora", "valor": data.Cancelacion.FechaHoraCancelacion},
            {"campo": "Motivo", "valor": data.Cancelacion.MotivoCancelacion},
            {"campo": "Cancelado por", "valor": data.Cancelacion.Operador},
            {"campo": "CI", "valor": data.Cancelacion.Ci},
            {"campo": "Rol", "valor": data.Cancelacion.NombreRol},
        ],
    )

    reporte.titulo_seccion("Datos generales")
    reporte.tabla(
        columnas=[("Campo", "campo"), ("Valor", "valor")],
        filas=_filas_datos_generales(data, "Operador de producción"),
    )

    reporte.titulo_seccion("Bobinas utilizadas")
    reporte.tabla(
        columnas=[
            ("Bobina", "etiqueta"),
            ("Código", "codigo"),
            ("Peso neto (kg)", "peso"),
            ("Gramaje", "gramaje"),
            ("Proveedor", "proveedor"),
            ("Recepción", "recepcion"),
        ],
        filas=[
            {
                "etiqueta": "Bobina 1",
                "codigo": data.CodigoBobina1,
                "peso": data.PesoNeto1,
                "gramaje": data.Gramaje1,
                "proveedor": data.Proveedor1,
                "recepcion": data.Recepcion1,
            },
            {
                "etiqueta": "Bobina 2",
                "codigo": data.CodigoBobina2,
                "peso": data.PesoNeto2,
                "gramaje": data.Gramaje2,
                "proveedor": data.Proveedor2,
                "recepcion": data.Recepcion2,
            },
        ],
    )

    _seccion_cargada(reporte, data)

    reporte.titulo_seccion(f"Pausas ({len(data.Pausas)})")
    if data.Pausas:
        reporte.tabla(
            columnas=[
                ("Inicio", "FechaHoraPausa"),
                ("Reanudación", "FechaHoraReanudacion"),
                ("Duración", lambda p: _formatear_duracion(p.DuracionPausa)),
                ("Motivo pausa", "MotivoPausaProduccion"),
                ("Motivo reanudación", "MotivoReanudacion"),
                ("Operador", "OperadorPausa"),
                ("Rol", "RolPausa"),
                ("Estado", "EstadoPausa"),
            ],
            filas=data.Pausas,
        )
        reporte.parrafo(
            f"Tiempo total pausado: {_formatear_duracion(data.TotalTiempoPausado)}"
        )
    else:
        reporte.parrafo("Esta producción no registró pausas antes de cancelarse.")

    _seccion_movimientos_logs(reporte, data.Movimientos)

    return reporte.a_pdf()


def nombre_archivo_cancelacion_produccion(id_produccion: int) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return f"cancelacion-produccion-bobina-papel-{id_produccion}-{ahora:%Y%m%d-%H%M}.pdf"


def construir_reporte_produccion_por_periodo(
    data: ReporteProduccionPorPeriodoResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Producción por período - Bobina de papel",
        subtitulo=(
            f"Del {data.PeriodoInicio.strftime('%d/%m/%Y')} "
            f"al {data.PeriodoFin.strftime('%d/%m/%Y')}"
        ),
        filtros={
            "Producciones": f"{data.TotalProducciones:,}".replace(",", "."),
            "Logs": f"{data.TotalLogs:,}".replace(",", "."),
        },
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    reporte.titulo_seccion("Resumen")
    reporte.tabla(
        columnas=[("Campo", "campo"), ("Valor", "valor")],
        filas=[
            {
                "campo": "Total de producciones",
                "valor": f"{data.TotalProducciones:,}".replace(",", "."),
            },
            {
                "campo": "Total de logs",
                "valor": f"{data.TotalLogs:,}".replace(",", "."),
            },
            {
                "campo": "Total de pausas",
                "valor": f"{data.TotalPausas:,}".replace(",", "."),
            },
            {
                "campo": "Tiempo total pausado",
                "valor": _formatear_duracion(data.TotalTiempoPausado),
            },
        ],
    )

    reporte.titulo_seccion("Resumen por producto")
    if data.ResumenPorProducto:
        reporte.parrafo(
            "Producciones y logs de las producciones finalizadas o cerradas por cambio "
            "de línea. Las canceladas se cuentan aparte y no entran en el promedio."
        )
        reporte.tabla(
            columnas=[
                ("Producto", "NombreProducto"),
                ("Producciones", "CantidadProducciones"),
                ("Logs", "TotalLogs"),
                ("Promedio logs", "PromedioLogs"),
                ("Canceladas", "CantidadCanceladas"),
            ],
            filas=data.ResumenPorProducto,
            fila_total=[
                "TOTAL",
                sum(r.CantidadProducciones for r in data.ResumenPorProducto),
                sum(r.TotalLogs for r in data.ResumenPorProducto),
                "",
                sum(r.CantidadCanceladas for r in data.ResumenPorProducto),
            ],
        )
    else:
        reporte.parrafo("No hubo producciones en este período.")

    reporte.titulo_seccion(f"Producciones ({data.TotalProducciones})")
    if data.Producciones:
        reporte.tabla(
            columnas=[
                ("Turno", "NombreTurno"),
                (
                    "Operador",
                    lambda p: reporte.celda_multilinea(
                        [f"{p.Operador},", p.Ci, p.NombreRol]
                    ),
                ),
                ("Producto", "NombreProducto"),
                ("Bobina 1", "CodigoBobina1"),
                ("Bobina 2", "CodigoBobina2"),
                ("Inicio", "FechaInicioProduccion"),
                ("Fin", "FechaFinProduccion"),
                ("Logs", "CantidadLogsActual"),
                ("Estado", "NombreEstadoProduccion"),
            ],
            filas=data.Producciones,
        )
    else:
        reporte.parrafo("No hubo producciones en este período.")

    reporte.titulo_seccion("Pausas por producto y motivo")
    if data.PausasPorMotivo:
        reporte.tabla(
            columnas=[
                ("Producto", "NombreProducto"),
                ("Motivo", "Motivo"),
                ("Cantidad", "CantidadPausas"),
                ("Tiempo total", lambda p: _formatear_duracion(p.TiempoTotal)),
            ],
            filas=data.PausasPorMotivo,
        )
    else:
        reporte.parrafo("No hubo pausas registradas en este período.")

    if data.Cancelaciones is not None:
        reporte.titulo_seccion(f"Cancelaciones ({len(data.Cancelaciones)})")
        if data.Cancelaciones:
            reporte.tabla(
                columnas=[
                    ("Producción", "IdProduccionBobinaTubo"),
                    ("Producto", "NombreProducto"),
                    ("Fecha y hora", "FechaHoraCancelacion"),
                    ("Motivo", "MotivoCancelacion"),
                    (
                        "Cancelado por",
                        lambda c: f"{c.PrimerNombre} {c.ApellidoPaterno}",
                    ),
                    ("Rol", "NombreRol"),
                ],
                filas=data.Cancelaciones,
            )
        else:
            reporte.parrafo("No hubo cancelaciones en este período.")

    return reporte.a_pdf()


def nombre_archivo_produccion_por_periodo(fecha_inicio: date, fecha_fin: date) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return (
        f"produccion-periodo-{fecha_inicio:%Y%m%d}-{fecha_fin:%Y%m%d}"
        f"-{ahora:%Y%m%d-%H%M}.pdf"
    )


def construir_reporte_historial_movimientos_bobina(
    data: ReporteHistorialMovimientosBobinaResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Historial de movimientos - Bobina de papel",
        subtitulo=f"Bobina {data.CodigoBobina} - {data.NombreTipoBobina}",
        filtros={
            "Estado actual": data.TipoEstado,
            "Movimientos": f"{len(data.Movimientos):,}".replace(",", "."),
        },
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    reporte.titulo_seccion(f"Movimientos ({len(data.Movimientos)})")
    if data.Movimientos:
        reporte.tabla(
            columnas=[
                ("Fecha", "FechaMovimiento"),
                ("Movimiento", "NombreMovimiento"),
                (
                    "Operador",
                    lambda m: reporte.celda_multilinea(
                        [f"{m.PrimerNombre} {m.ApellidoPaterno},", m.Ci, m.NombreRol]
                    ),
                ),
                ("Observación", "Observacion"),
            ],
            filas=data.Movimientos,
        )
    else:
        reporte.parrafo("No hay movimientos registrados para esta bobina.")

    return reporte.a_pdf()


def nombre_archivo_historial_movimientos_bobina(id_bobina_papel: int) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return (
        f"historial-movimientos-bobina-{id_bobina_papel}-{ahora:%Y%m%d-%H%M}.pdf"
    )
