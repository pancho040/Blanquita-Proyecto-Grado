from datetime import date, datetime

from app.Models.Empaque.Reporte import (
    ClaseEmpaque,
    ReporteInventarioEmpaqueResponse,
    ReporteLotesEmpaqueResponse,
    ReporteMovimientosEmpaqueResponse,
)
from app.Reportes.reporte import Reporte
from app.utils.dates import ZONA_BOLIVIA


def _texto_periodo(inicio: date, fin: date) -> str:
    if inicio == fin:
        return f"Día {inicio.strftime('%d/%m/%Y')}"
    return f"Del {inicio.strftime('%d/%m/%Y')} al {fin.strftime('%d/%m/%Y')}"


def _texto_tipos(todos: bool, nombres: list[str]) -> str:
    if todos:
        return "Todos"
    if len(nombres) <= 3:
        return ", ".join(nombres)
    return f"{len(nombres)} seleccionados"


def _texto_toneladas(toneladas) -> str:
    if not toneladas:
        return "Sin dato"
    formateado = f"{float(toneladas):,.2f}"
    return formateado.replace(",", "X").replace(".", ",").replace("X", ".") + " t"


def _estado_stock(cantidad: int) -> str:
    return "Sin stock" if cantidad == 0 else "Disponible"


def construir_reporte_inventario_empaque(
    data: ReporteInventarioEmpaqueResponse,
    generado_por: str | None = None,
) -> bytes:
    es_bobina = data.Clase == ClaseEmpaque.bobina

    reporte = Reporte(
        titulo=f"Informe de inventario - {data.NombreClase}",
        subtitulo="Stock actual en almacén",
        filtros={"Tipos": "Todos"},
        generado_en=data.FechaGeneracion,
        generado_por=generado_por,
    )

    columnas = [("Tipo", "NombreTipo")]
    total = ["TOTAL"]
    if not es_bobina:
        columnas.append(("Descripción", "DescripcionTipo"))
        total.append("")
    columnas.append((f"{data.Unidad.capitalize()} en almacén", "CantidadActual"))
    total.append(sum(t.CantidadActual for t in data.Tipos))
    if es_bobina:
        columnas.append(("Peso (kg)", "PesoKg"))
        total.append(sum(t.PesoKg or 0 for t in data.Tipos))
    columnas += [
        ("Estado", lambda t: _estado_stock(t.CantidadActual)),
        ("Último movimiento", "FechaUltimoMovimiento"),
    ]
    total += ["", ""]

    reporte.titulo_seccion(f"Tipos ({len(data.Tipos)})")
    reporte.tabla(columnas=columnas, filas=data.Tipos, fila_total=total)

    if es_bobina:
        reporte.titulo_seccion(f"Bobinas en almacén ({len(data.Unidades)})")
        if data.Unidades:
            reporte.tabla(
                columnas=[
                    ("Código", "CodigoEmpaque"),
                    ("Tipo", "NombreTipo"),
                    ("Peso (kg)", "PesoKg"),
                    (
                        "Lote",
                        lambda u: reporte.celda_multilinea(
                            [f"#{u.IdLoteEmpaque}", u.NombreProveedor]
                        ),
                    ),
                    ("Recepción", "FechaRecepcion"),
                ],
                filas=data.Unidades,
            )
        else:
            reporte.parrafo("No hay bobinas de empaque en almacén.")

    return reporte.a_pdf()


def nombre_archivo_inventario_empaque(clase: ClaseEmpaque) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return f"informe-inventario-empaque-{clase.value}-{ahora:%Y%m%d-%H%M}.pdf"


def construir_reporte_movimientos_empaque(
    data: ReporteMovimientosEmpaqueResponse,
    generado_por: str | None = None,
) -> bytes:
    es_bobina = data.Clase == ClaseEmpaque.bobina
    unidad = data.Unidad.capitalize()

    filtros = {"Tipos": _texto_tipos(data.TodosLosTipos, [r.NombreTipo for r in data.Resumen])}
    if data.NombreMovimientoFiltro:
        filtros["Movimiento"] = data.NombreMovimientoFiltro

    reporte = Reporte(
        titulo=f"Movimientos - {data.NombreClase}",
        subtitulo=_texto_periodo(data.PeriodoInicio, data.PeriodoFin),
        filtros=filtros,
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    reporte.titulo_seccion("Resumen por tipo")
    reporte.tabla(
        columnas=[
            ("Tipo", "NombreTipo"),
            (f"Ingresos ({data.Unidad})", "Ingresos"),
            (f"Salidas ({data.Unidad})", "Salidas"),
            ("Neto", "Neto"),
            ("N° Movimientos", "NumeroMovimientos"),
            (f"{unidad} en almacén", "CantidadActual"),
        ],
        filas=data.Resumen,
        fila_total=[
            "TOTAL",
            sum(r.Ingresos for r in data.Resumen),
            sum(r.Salidas for r in data.Resumen),
            sum(r.Neto for r in data.Resumen),
            sum(r.NumeroMovimientos for r in data.Resumen),
            sum(r.CantidadActual for r in data.Resumen),
        ],
    )

    columnas = [
        ("Fecha", "FechaMovimiento"),
        ("Tipo", "NombreTipo"),
        ("Movimiento", "NombreMovimiento"),
    ]
    if es_bobina:
        columnas += [("Código", "CodigoEmpaque"), ("Peso (kg)", "PesoKg")]
    else:
        columnas.append(("Cantidad", "Cantidad"))
    columnas += [
        (
            "Lote",
            lambda m: reporte.celda_multilinea([f"#{m.IdLoteEmpaque}", m.NombreProveedor])
            if m.IdLoteEmpaque
            else "-",
        ),
        (
            "Usuario",
            lambda m: reporte.celda_multilinea(
                [f"{m.PrimerNombre} {m.ApellidoPaterno},", m.Ci, m.NombreRol]
            ),
        ),
        ("Observación", "Observacion"),
    ]

    reporte.titulo_seccion(f"Detalle de movimientos ({len(data.Movimientos)})")
    reporte.tabla(columnas=columnas, filas=data.Movimientos)

    return reporte.a_pdf()


def nombre_archivo_movimientos_empaque(clase: ClaseEmpaque, fecha_inicio: date, fecha_fin: date) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return (
        f"movimientos-empaque-{clase.value}-{fecha_inicio:%Y%m%d}-{fecha_fin:%Y%m%d}"
        f"-{ahora:%Y%m%d-%H%M}.pdf"
    )


def construir_reporte_lotes_empaque(
    data: ReporteLotesEmpaqueResponse,
    generado_por: str | None = None,
) -> bytes:
    es_bobina = data.Clase == ClaseEmpaque.bobina

    reporte = Reporte(
        titulo=f"Lotes recibidos - {data.NombreClase}",
        subtitulo=_texto_periodo(data.PeriodoInicio, data.PeriodoFin),
        filtros={"Tipos": _texto_tipos(data.TodosLosTipos, [r.NombreTipo for r in data.Resumen])},
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    columnas_resumen = [
        ("Tipo", "NombreTipo"),
        ("Lotes", "NumeroLotes"),
        (data.Unidad.capitalize(), "Cantidad"),
    ]
    total_resumen = [
        "TOTAL",
        len(data.Lotes),
        sum(r.Cantidad for r in data.Resumen),
    ]
    if es_bobina:
        columnas_resumen.append(("Peso (kg)", "PesoKg"))
        total_resumen.append(sum(r.PesoKg for r in data.Resumen))

    reporte.titulo_seccion("Resumen por tipo")
    reporte.tabla(columnas=columnas_resumen, filas=data.Resumen, fila_total=total_resumen)

    reporte.titulo_seccion(f"Lotes ({len(data.Lotes)})")
    reporte.tabla(
        columnas=[
            ("Lote", lambda l: f"#{l.IdLoteEmpaque}"),
            ("Recepción", "FechaRecepcion"),
            ("Proveedor", "NombreProveedor"),
            ("Toneladas pedidas", lambda l: _texto_toneladas(l.CantidadToneladasPedida)),
            (data.Unidad.capitalize(), "CantidadTotal"),
            *([("Peso (kg)", "PesoTotalKg")] if es_bobina else []),
            (
                "Registrado por",
                lambda l: reporte.celda_multilinea(
                    [f"{l.PrimerNombre} {l.ApellidoPaterno},", l.Ci, l.NombreRol]
                ),
            ),
        ],
        filas=data.Lotes,
    )

    for lote in data.Lotes:
        reporte.titulo_seccion(
            f"Lote #{lote.IdLoteEmpaque} · {lote.FechaRecepcion.strftime('%d/%m/%Y')} · {lote.NombreProveedor}"
        )
        columnas_items = [
            ("Tipo", "NombreTipo"),
            (data.Unidad.capitalize(), "Cantidad"),
        ]
        total_items = ["TOTAL", lote.CantidadTotal]
        if es_bobina:
            columnas_items += [
                ("Peso (kg)", "PesoKg"),
                ("Códigos", lambda i: reporte.celda_multilinea([", ".join(i.Codigos)])),
            ]
            total_items += [lote.PesoTotalKg, ""]
        reporte.tabla(columnas=columnas_items, filas=lote.Items, fila_total=total_items)

    return reporte.a_pdf()


def nombre_archivo_lotes_empaque(clase: ClaseEmpaque, fecha_inicio: date, fecha_fin: date) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return (
        f"lotes-empaque-{clase.value}-{fecha_inicio:%Y%m%d}-{fecha_fin:%Y%m%d}"
        f"-{ahora:%Y%m%d-%H%M}.pdf"
    )
