from datetime import date, datetime

from app.Models.Usuario.HistorialAdmin import (
    HistorialAdminItem,
    ReporteHistorialAdminResponse,
    ReporteUsuarioHistorialAdminResponse,
    ResumenHistorialAdminResponse,
)
from app.Reportes.reporte import Reporte
from app.utils.dates import ZONA_BOLIVIA, date_formatter


def _texto_periodo(inicio: date, fin: date) -> str:
    if inicio == fin:
        return f"Día {inicio.strftime('%d/%m/%Y')}"
    return f"Del {inicio.strftime('%d/%m/%Y')} al {fin.strftime('%d/%m/%Y')}"


def _nombre_completo(*partes: str | None) -> str:
    return " ".join(p for p in partes if p)


def _tabla_resumen(reporte: Reporte, resumen: ResumenHistorialAdminResponse) -> None:
    reporte.titulo_seccion("Resumen por módulo")
    reporte.tabla(
        columnas=[("Módulo", "Modulo"), ("Acciones", "Cantidad")],
        filas=resumen.Modulos,
        fila_total=["TOTAL", resumen.Total],
    )


def _celda_administrador(reporte: Reporte, a: HistorialAdminItem):
    return reporte.celda_multilinea(
        [f"{_nombre_completo(a.PrimerNombre, a.ApellidoPaterno)},", a.Ci, a.NombreRol]
    )


def _filtros_comunes(modulo: str | None, busqueda: str | None) -> dict[str, str]:
    filtros = {"Módulo": modulo or "Todos"}
    if busqueda:
        filtros["Texto"] = busqueda
    return filtros


def construir_reporte_historial_admin(
    data: ReporteHistorialAdminResponse,
    generado_por: str | None = None,
) -> bytes:
    filtros = _filtros_comunes(data.Modulo, data.Busqueda)
    if data.Ci:
        filtros["CI contiene"] = data.Ci

    reporte = Reporte(
        titulo="Acciones de administrador",
        subtitulo=_texto_periodo(data.PeriodoInicio, data.PeriodoFin),
        filtros=filtros,
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    _tabla_resumen(reporte, data.Resumen)
    reporte.parrafo(f"Administradores distintos en el período: {data.Resumen.AdministradoresDistintos}")

    reporte.titulo_seccion(f"Detalle de acciones ({len(data.Acciones)})")
    reporte.tabla(
        columnas=[
            ("Fecha", "FechaMovimiento"),
            ("Módulo", "Modulo"),
            ("Acción", "Accion"),
            ("Detalle", "Detalle"),
            ("Administrador", lambda a: _celda_administrador(reporte, a)),
        ],
        filas=data.Acciones,
    )

    return reporte.a_pdf()


def nombre_archivo_historial_admin(fecha_inicio: date, fecha_fin: date) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return (
        f"acciones-administrador-{fecha_inicio:%Y%m%d}-{fecha_fin:%Y%m%d}"
        f"-{ahora:%Y%m%d-%H%M}.pdf"
    )


def construir_reporte_usuario_historial_admin(
    data: ReporteUsuarioHistorialAdminResponse,
    generado_por: str | None = None,
) -> bytes:
    usuario = data.Usuario
    filtros = {"CI": data.Ci, **_filtros_comunes(data.Modulo, data.Busqueda)}
    if usuario:
        filtros["Administrador"] = _nombre_completo(
            usuario.PrimerNombre, usuario.SegundoNombre, usuario.ApellidoPaterno, usuario.ApellidoMaterno
        )
        filtros["Rol"] = usuario.NombreRol
        filtros["Estado"] = usuario.NombreEstadoUsuario

    reporte = Reporte(
        titulo="Acciones de administrador por usuario",
        subtitulo=_texto_periodo(data.PeriodoInicio, data.PeriodoFin),
        filtros=filtros,
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    _tabla_resumen(reporte, data.Resumen)
    reporte.parrafo(
        f"Última acción en el período: {date_formatter(data.UltimaAccion) if data.UltimaAccion else '-'}"
    )

    reporte.titulo_seccion(f"Historial de acciones ({len(data.Acciones)})")
    reporte.tabla(
        columnas=[
            ("Fecha", "FechaMovimiento"),
            ("Módulo", "Modulo"),
            ("Acción", "Accion"),
            ("Detalle", "Detalle"),
        ],
        filas=data.Acciones,
    )

    return reporte.a_pdf()


def nombre_archivo_usuario_historial_admin(ci: str, fecha_inicio: date, fecha_fin: date) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return (
        f"acciones-administrador-ci-{ci}-{fecha_inicio:%Y%m%d}-{fecha_fin:%Y%m%d}"
        f"-{ahora:%Y%m%d-%H%M}.pdf"
    )
