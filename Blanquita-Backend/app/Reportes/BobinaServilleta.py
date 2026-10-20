from datetime import date, datetime, timedelta
from typing import Optional

from app.Models.BobinaServilleta.Reporte import (
    ReporteInventarioBobinaServilletaResponse,
    ReporteInventarioSubBobinaServilletaResponse,
    ReporteInventarioCompletoServilletaResponse,
    ReporteHistorialMovimientosUnidadServilletaResponse,
    ReporteDetalleBobinaServilletaResponse,
    ReporteLoteBobinaServilletaDetalleResponse,
    ReporteLotesServilletaPorPeriodoResponse,
    ReporteProduccionServilletaDetalleResponse,
    ReporteCancelacionProduccionServilletaResponse,
    ReporteProduccionServilletaPorPeriodoResponse,
)
from app.Reportes.reporte import Reporte
from app.utils.dates import ZONA_BOLIVIA


def _formatear_duracion(duracion: Optional[timedelta]) -> str:
    if duracion is None:
        return "-"
    total_segundos = int(duracion.total_seconds())
    horas, resto = divmod(total_segundos, 3600)
    minutos = resto // 60
    return f"{horas}h {minutos:02d}m"


def _tabla_pausas_servilleta(reporte: Reporte, pausas) -> None:
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
        filas=pausas,
    )


def _escribir_inventario_bobina_servilleta(
    reporte: Reporte, data: ReporteInventarioBobinaServilletaResponse
) -> None:
    reporte.titulo_seccion("Resumen por tipo")
    reporte.tabla(
        columnas=[
            ("Tipo", "NombreTipoBobinaServilleta"),
            ("Cantidad", "CantidadBobinas"),
            ("Peso bruto (kg)", "PesoBrutoTotalKg"),
            ("Gramaje prom.", "GramajePromedio"),
            ("Recepción más antigua", "RecepcionMasAntigua"),
            ("Recepción más reciente", "RecepcionMasReciente"),
        ],
        filas=data.Resumen,
        fila_total=[
            "TOTAL",
            data.TotalBobinas,
            data.PesoBrutoGeneralKg,
            "",
            "",
            "",
        ],
    )

    for tipo in data.Resumen:
        bobinas_tipo = [
            b for b in data.Bobinas if b.IdTipoBobinaServilleta == tipo.IdTipoBobinaServilleta
        ]
        reporte.titulo_seccion(f"{tipo.NombreTipoBobinaServilleta} ({tipo.CantidadBobinas})")
        reporte.tabla(
            columnas=[
                ("Lote", "CodigoLote"),
                ("Recepción", "FechaRecepcion"),
                ("Proveedor", "NombreProveedor"),
                (
                    "Código",
                    lambda b: reporte.celda_multilinea(
                        [u.CodigoBobina for u in b.Unidades]
                    ),
                ),
                (
                    "Formato",
                    lambda b: reporte.celda_multilinea(
                        [u.DescripcionFormato for u in b.Unidades]
                    ),
                ),
                (
                    "P. bruto (kg)",
                    lambda b: reporte.celda_multilinea(
                        [u.PesoBrutoKg for u in b.Unidades]
                    ),
                ),
                (
                    "Gramaje",
                    lambda b: reporte.celda_multilinea([u.GramajeGr for u in b.Unidades]),
                ),
            ],
            filas=bobinas_tipo,
        )


def construir_reporte_inventario_bobina_servilleta(
    data: ReporteInventarioBobinaServilletaResponse,
    generado_por: str | None = None,
) -> bytes:
    tipos = ", ".join(r.NombreTipoBobinaServilleta for r in data.Resumen) or "Todos"

    reporte = Reporte(
        titulo="Informe de inventario - Bobina de servilleta",
        subtitulo="Bobinas en almacén",
        filtros={"Tipos": tipos},
        generado_en=data.FechaGeneracion,
        generado_por=generado_por,
    )

    _escribir_inventario_bobina_servilleta(reporte, data)

    return reporte.a_pdf()


def nombre_archivo_inventario_servilleta() -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return f"informe-inventario-bobina-servilleta-{ahora:%Y%m%d-%H%M}.pdf"


def _escribir_inventario_subbobina_servilleta(
    reporte: Reporte, data: ReporteInventarioSubBobinaServilletaResponse
) -> None:
    reporte.titulo_seccion("Resumen por formato")
    reporte.tabla(
        columnas=[
            ("Formato", "NombreTipoMedida"),
            ("Cantidad", "CantidadSubBobinas"),
        ],
        filas=data.Resumen,
        fila_total=["TOTAL", data.TotalSubBobinas],
    )

    for medida in data.Resumen:
        sub_bobinas_medida = [
            sb
            for sb in data.SubBobinas
            if sb.IdTipoMedidaSubBobina == medida.IdTipoMedidaSubBobina
        ]
        reporte.titulo_seccion(f"{medida.NombreTipoMedida} ({medida.CantidadSubBobinas})")
        if sub_bobinas_medida:
            reporte.tabla(
                columnas=[
                    ("Código unidad", "CodigoBobina"),
                    ("Tipo bobina", "NombreTipoBobinaServilleta"),
                    ("Lote", "CodigoLote"),
                    ("Recepción", "FechaRecepcion"),
                    ("Proveedor", "NombreProveedor"),
                ],
                filas=sub_bobinas_medida,
            )
        else:
            reporte.parrafo("No hay sub-bobinas en almacén con este formato.")


def construir_reporte_inventario_subbobina_servilleta(
    data: ReporteInventarioSubBobinaServilletaResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Informe de inventario - Sub-bobina de servilleta",
        subtitulo="Sub-bobinas en almacén",
        generado_en=data.FechaGeneracion,
        generado_por=generado_por,
    )

    _escribir_inventario_subbobina_servilleta(reporte, data)

    return reporte.a_pdf()


def nombre_archivo_inventario_subbobina_servilleta() -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return f"informe-inventario-subbobina-servilleta-{ahora:%Y%m%d-%H%M}.pdf"


def construir_reporte_inventario_completo_servilleta(
    data: ReporteInventarioCompletoServilletaResponse,
    generado_por: str | None = None,
) -> bytes:
    generado_en = (
        data.Bobinas.FechaGeneracion
        if data.Bobinas
        else data.SubBobinas.FechaGeneracion
        if data.SubBobinas
        else datetime.now(ZONA_BOLIVIA)
    )

    reporte = Reporte(
        titulo="Informe de inventario - Bobina de servilleta",
        subtitulo="Bobinas y sub-bobinas en almacén",
        generado_en=generado_en,
        generado_por=generado_por,
    )

    reporte.titulo_seccion("Bobinas de servilleta")
    if data.Bobinas:
        _escribir_inventario_bobina_servilleta(reporte, data.Bobinas)
    else:
        reporte.parrafo("No hay bobinas de servilleta en almacén.")

    reporte.titulo_seccion("Sub-bobinas de servilleta")
    if data.SubBobinas:
        _escribir_inventario_subbobina_servilleta(reporte, data.SubBobinas)
    else:
        reporte.parrafo("No hay sub-bobinas de servilleta en almacén.")

    return reporte.a_pdf()


def nombre_archivo_inventario_completo_servilleta() -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return f"informe-inventario-servilleta-{ahora:%Y%m%d-%H%M}.pdf"


def construir_reporte_historial_movimientos_unidad_servilleta(
    data: ReporteHistorialMovimientosUnidadServilletaResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Historial de movimientos - Unidad de bobina servilleta",
        subtitulo=f"Unidad {data.CodigoBobina} - {data.NombreTipoBobinaServilleta}",
        filtros={"Estado actual": data.TipoEstado, "Formato": data.DescripcionFormato},
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    reporte.titulo_seccion(f"Movimientos ({len(data.Movimientos)})")
    if data.Movimientos:
        reporte.tabla(
            columnas=[
                ("Fecha", "FechaMovimiento"),
                ("Movimiento", "NombreMovimiento"),
                ("Sub-bobina", "IdSubBobinaServilleta"),
                ("Formato", "NombreTipoMedida"),
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
        reporte.parrafo("Esta unidad aún no registra movimientos (no ha sido abierta).")

    return reporte.a_pdf()


def nombre_archivo_historial_movimientos_unidad_servilleta(id_unidad: int) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return f"historial-movimientos-unidad-servilleta-{id_unidad}-{ahora:%Y%m%d-%H%M}.pdf"


def construir_reporte_detalle_bobina_servilleta(
    data: ReporteDetalleBobinaServilletaResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Detalle de bobina - Servilleta",
        subtitulo=f"Bobina #{data.IdBobinaServilleta} - {data.NombreTipoBobinaServilleta}",
        filtros={"Estado": data.TipoEstado, "Lote": data.CodigoLote},
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    reporte.titulo_seccion("Datos generales")
    reporte.tabla(
        columnas=[("Campo", "campo"), ("Valor", "valor")],
        filas=[
            {"campo": "Tipo de bobina", "valor": data.NombreTipoBobinaServilleta},
            {"campo": "Estado", "valor": data.TipoEstado},
            {"campo": "Lote", "valor": data.CodigoLote},
            {"campo": "Recepción", "valor": data.FechaRecepcion},
            {"campo": "Proveedor", "valor": data.NombreProveedor},
        ],
    )

    reporte.titulo_seccion(f"Movimientos de la bobina ({len(data.MovimientosBobina)})")
    if data.MovimientosBobina:
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
            filas=data.MovimientosBobina,
        )
    else:
        reporte.parrafo("Esta bobina aún no registra movimientos.")

    for unidad in data.Unidades:
        reporte.titulo_seccion(f"Unidad {unidad.CodigoUnidad} - {unidad.DescripcionFormato}")
        reporte.tabla(
            columnas=[("Campo", "campo"), ("Valor", "valor")],
            filas=[
                {"campo": "Peso bruto (kg)", "valor": unidad.PesoBrutoKg},
                {"campo": "Gramaje", "valor": unidad.GramajeGr},
            ],
        )

        reporte.titulo_seccion(f"Movimientos ({len(unidad.Movimientos)})")
        if unidad.Movimientos:
            reporte.tabla(
                columnas=[
                    ("Fecha", "FechaMovimiento"),
                    ("Movimiento", "NombreMovimiento"),
                    ("Sub-bobina", "IdSubBobinaServilleta"),
                    ("Formato", "NombreTipoMedida"),
                    (
                        "Operador",
                        lambda m: reporte.celda_multilinea(
                            [f"{m.PrimerNombre} {m.ApellidoPaterno},", m.Ci, m.NombreRol]
                        ),
                    ),
                    ("Observación", "Observacion"),
                ],
                filas=unidad.Movimientos,
            )
        else:
            reporte.parrafo("Esta unidad aún no registra movimientos (no ha sido abierta).")

    return reporte.a_pdf()


def nombre_archivo_detalle_bobina_servilleta(id_bobina: int) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return f"detalle-bobina-servilleta-{id_bobina}-{ahora:%Y%m%d-%H%M}.pdf"


def _columnas_bobinas_lote(reporte: Reporte) -> list:
    return [
        ("Tipo", "NombreTipoBobinaServilleta"),
        (
            "Código",
            lambda b: reporte.celda_multilinea([u.CodigoBobina for u in b.Unidades]),
        ),
        (
            "Formato",
            lambda b: reporte.celda_multilinea(
                [u.DescripcionFormato for u in b.Unidades]
            ),
        ),
        (
            "P. bruto (kg)",
            lambda b: reporte.celda_multilinea([u.PesoBrutoKg for u in b.Unidades]),
        ),
        (
            "Gramaje",
            lambda b: reporte.celda_multilinea([u.GramajeGr for u in b.Unidades]),
        ),
    ]


def construir_reporte_lote_bobina_servilleta_detalle(
    data: ReporteLoteBobinaServilletaDetalleResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Detalle de lote - Bobina de servilleta",
        subtitulo=f"Lote #{data.IdLoteBobinaServilleta} - {data.NombreProveedor}",
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
        ],
    )

    reporte.titulo_seccion(f"Bobinas del lote ({data.CantidadBobinas})")
    reporte.tabla(columnas=_columnas_bobinas_lote(reporte), filas=data.Bobinas)

    return reporte.a_pdf()


def nombre_archivo_lote_servilleta_detalle(id_lote: int) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return f"detalle-lote-bobina-servilleta-{id_lote}-{ahora:%Y%m%d-%H%M}.pdf"


def construir_reporte_lotes_servilleta_por_periodo(
    data: ReporteLotesServilletaPorPeriodoResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Ingresos por período - Bobina de servilleta",
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
            f"Lote #{lote.IdLoteBobinaServilleta} - {lote.FechaRecepcion.strftime('%d/%m/%Y')} "
            f"- {lote.NombreProveedor} ({lote.CantidadBobinas})"
        )
        reporte.tabla(columnas=_columnas_bobinas_lote(reporte), filas=lote.Bobinas)

    return reporte.a_pdf()


def nombre_archivo_lotes_servilleta_periodo(fecha_inicio: date, fecha_fin: date) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return (
        f"ingresos-lotes-servilleta-periodo-{fecha_inicio:%Y%m%d}-{fecha_fin:%Y%m%d}"
        f"-{ahora:%Y%m%d-%H%M}.pdf"
    )


def _datos_generales_produccion_servilleta(data) -> list[dict]:
    return [
        {"campo": "Operador", "valor": data.Operador},
        {"campo": "CI", "valor": data.Ci},
        {"campo": "Rol", "valor": data.NombreRol},
        {"campo": "Fecha inicio", "valor": data.FechaInicioProduccion},
        {"campo": "Fecha fin", "valor": data.FechaFinProduccion},
        {"campo": "Duración total", "valor": _formatear_duracion(data.DuracionTotal)},
    ]


def _subbobina_utilizada_servilleta(data) -> list[dict]:
    return [
        {"campo": "Código de unidad", "valor": data.CodigoBobina},
        {"campo": "Formato de la unidad", "valor": data.DescripcionFormato},
        {"campo": "Medida", "valor": data.DescripcionMedida},
        {"campo": "Sub-bobina", "valor": data.IdSubBobinaServilleta},
        {"campo": "Peso bruto (kg)", "valor": data.PesoBrutoKg},
        {"campo": "Gramaje", "valor": data.GramajeGr},
        {"campo": "Proveedor", "valor": data.NombreProveedor},
        {"campo": "Recepción", "valor": data.FechaRecepcion},
    ]


def construir_reporte_detalle_produccion_servilleta(
    data: ReporteProduccionServilletaDetalleResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Detalle de producción - Servilleta",
        subtitulo=f"Producción #{data.IdProduccionServilleta} - {data.NombreTipoBobinaServilleta}",
        filtros={"Estado": data.NombreEstadoProduccion, "Turno": data.NombreTurno},
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    reporte.titulo_seccion("Datos generales")
    reporte.tabla(
        columnas=[("Campo", "campo"), ("Valor", "valor")],
        filas=_datos_generales_produccion_servilleta(data),
    )

    reporte.titulo_seccion("Sub-bobina utilizada")
    reporte.tabla(
        columnas=[("Campo", "campo"), ("Valor", "valor")],
        filas=_subbobina_utilizada_servilleta(data),
    )

    if data.Pausas is not None:
        reporte.titulo_seccion(f"Pausas ({len(data.Pausas)})")
        if data.Pausas:
            _tabla_pausas_servilleta(reporte, data.Pausas)
            reporte.parrafo(
                f"Tiempo total pausado: {_formatear_duracion(data.TotalTiempoPausado)}"
            )
        else:
            reporte.parrafo("Esta producción no registró pausas.")

    return reporte.a_pdf()


def nombre_archivo_detalle_produccion_servilleta(id_produccion: int) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return f"detalle-produccion-servilleta-{id_produccion}-{ahora:%Y%m%d-%H%M}.pdf"


def construir_reporte_cancelacion_produccion_servilleta(
    data: ReporteCancelacionProduccionServilletaResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Producción cancelada - Servilleta",
        subtitulo=f"Producción #{data.IdProduccionServilleta} - {data.NombreTipoBobinaServilleta}",
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
        filas=_datos_generales_produccion_servilleta(data),
    )

    reporte.titulo_seccion("Sub-bobina utilizada")
    reporte.tabla(
        columnas=[("Campo", "campo"), ("Valor", "valor")],
        filas=_subbobina_utilizada_servilleta(data),
    )

    reporte.titulo_seccion(f"Pausas ({len(data.Pausas)})")
    if data.Pausas:
        _tabla_pausas_servilleta(reporte, data.Pausas)
        reporte.parrafo(
            f"Tiempo total pausado: {_formatear_duracion(data.TotalTiempoPausado)}"
        )
    else:
        reporte.parrafo("Esta producción no registró pausas antes de cancelarse.")

    return reporte.a_pdf()


def nombre_archivo_cancelacion_produccion_servilleta(id_produccion: int) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return f"cancelacion-produccion-servilleta-{id_produccion}-{ahora:%Y%m%d-%H%M}.pdf"


def construir_reporte_produccion_servilleta_por_periodo(
    data: ReporteProduccionServilletaPorPeriodoResponse,
    generado_por: str | None = None,
) -> bytes:
    reporte = Reporte(
        titulo="Producción por período - Servilleta",
        subtitulo=(
            f"Del {data.PeriodoInicio.strftime('%d/%m/%Y')} "
            f"al {data.PeriodoFin.strftime('%d/%m/%Y')}"
        ),
        filtros={
            "Producciones": f"{data.TotalProducciones:,}".replace(",", "."),
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
                "campo": "Total de pausas",
                "valor": f"{data.TotalPausas:,}".replace(",", "."),
            },
            {
                "campo": "Tiempo total pausado",
                "valor": _formatear_duracion(data.TotalTiempoPausado),
            },
        ],
    )

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
                ("Tipo", "NombreTipoBobinaServilleta"),
                ("Código", "CodigoBobina"),
                ("Formato", "DescripcionFormato"),
                ("Medida", "DescripcionMedida"),
                ("Inicio", "FechaInicioProduccion"),
                ("Fin", "FechaFinProduccion"),
                ("Estado", "NombreEstadoProduccion"),
            ],
            filas=data.Producciones,
        )
    else:
        reporte.parrafo("No hubo producciones en este período.")

    reporte.titulo_seccion("Pausas por motivo")
    if data.PausasPorMotivo:
        reporte.tabla(
            columnas=[
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
                    ("Producción", "IdProduccionServilleta"),
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


def nombre_archivo_produccion_servilleta_por_periodo(
    fecha_inicio: date, fecha_fin: date
) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return (
        f"produccion-servilleta-periodo-{fecha_inicio:%Y%m%d}-{fecha_fin:%Y%m%d}"
        f"-{ahora:%Y%m%d-%H%M}.pdf"
    )
