from datetime import date, datetime

from app.Models.Usuario.RegistroIngreso import (
    RegistroIngresoItem,
    ReporteRegistroIngresoResponse,
    ReporteUsuarioRegistroIngresoResponse,
    ResumenRegistroIngresoResponse,
)
from app.Reportes.reporte import Reporte
from app.utils.dates import ZONA_BOLIVIA, date_formatter


def _texto_periodo(inicio: date | None, fin: date | None) -> str:
    if inicio is None or fin is None:
        return "Todo el historial"
    if inicio == fin:
        return f"Día {inicio.strftime('%d/%m/%Y')}"
    return f"Del {inicio.strftime('%d/%m/%Y')} al {fin.strftime('%d/%m/%Y')}"


def _texto_fecha(fecha: datetime | None) -> str:
    return date_formatter(fecha) if fecha else "-"


def _nombre_completo(*partes: str | None) -> str:
    return " ".join(p for p in partes if p)


def _tabla_resumen(reporte: Reporte, resumen: ResumenRegistroIngresoResponse) -> None:
    reporte.titulo_seccion("Resumen")
    reporte.tabla(
        columnas=[("Registro", "Registro"), ("Cantidad", "Cantidad")],
        filas=[
            {"Registro": "Ingresos", "Cantidad": resumen.Ingresos},
            {"Registro": "Salidas", "Cantidad": resumen.Salidas},
            {"Registro": "Intentos fallidos", "Cantidad": resumen.IntentosFallidos},
        ],
        fila_total=["TOTAL", resumen.Total],
    )


def _celda_usuario(reporte: Reporte, r: RegistroIngresoItem):
    if r.IdUsuario is None:
        return reporte.celda_multilinea(["CI no registrado", r.Ci])
    return reporte.celda_multilinea(
        [f"{_nombre_completo(r.PrimerNombre, r.ApellidoPaterno)},", r.Ci, r.NombreRol]
    )


def _celda_equipo(reporte: Reporte, r: RegistroIngresoItem):
    return reporte.celda_multilinea([r.DireccionIp or "-", r.Dispositivo])


def construir_reporte_registro_ingreso(
    data: ReporteRegistroIngresoResponse,
    generado_por: str | None = None,
) -> bytes:
    filtros = {"Registro": data.Registro or "Todos"}
    if data.Ci:
        filtros["CI contiene"] = data.Ci

    reporte = Reporte(
        titulo="Registro de accesos al sistema",
        subtitulo=_texto_periodo(data.PeriodoInicio, data.PeriodoFin),
        filtros=filtros,
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    _tabla_resumen(reporte, data.Resumen)
    reporte.parrafo(f"CI distintos en el período: {data.Resumen.CisDistintos}")

    reporte.titulo_seccion(f"Detalle de accesos ({len(data.Registros)})")
    reporte.tabla(
        columnas=[
            ("Fecha", "FechaRegistro"),
            ("Registro", "Registro"),
            ("Usuario", lambda r: _celda_usuario(reporte, r)),
            ("Detalle", "Detalle"),
            ("IP / Dispositivo", lambda r: _celda_equipo(reporte, r)),
        ],
        filas=data.Registros,
    )

    return reporte.a_pdf()


def nombre_archivo_registro_ingreso(fecha_inicio: date, fecha_fin: date) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    return (
        f"registro-accesos-{fecha_inicio:%Y%m%d}-{fecha_fin:%Y%m%d}"
        f"-{ahora:%Y%m%d-%H%M}.pdf"
    )


def construir_reporte_usuario_registro_ingreso(
    data: ReporteUsuarioRegistroIngresoResponse,
    generado_por: str | None = None,
) -> bytes:
    usuario = data.Usuario
    filtros = {"CI": data.Ci, "Registro": data.Registro or "Todos"}
    if usuario:
        filtros["Usuario"] = _nombre_completo(
            usuario.PrimerNombre, usuario.SegundoNombre, usuario.ApellidoPaterno, usuario.ApellidoMaterno
        )
        filtros["Rol"] = usuario.NombreRol
        filtros["Estado"] = usuario.NombreEstadoUsuario
    else:
        filtros["Usuario"] = "CI no registrado en el sistema"

    reporte = Reporte(
        titulo="Registro de accesos por usuario",
        subtitulo=_texto_periodo(data.PeriodoInicio, data.PeriodoFin),
        filtros=filtros,
        generado_en=datetime.now(ZONA_BOLIVIA),
        generado_por=generado_por,
    )

    _tabla_resumen(reporte, data.Resumen)
    reporte.parrafo(f"Último ingreso: {_texto_fecha(data.UltimoIngreso)}")
    reporte.parrafo(f"Último intento fallido: {_texto_fecha(data.UltimoIntentoFallido)}")

    reporte.titulo_seccion(f"Historial de accesos ({len(data.Registros)})")
    reporte.tabla(
        columnas=[
            ("Fecha", "FechaRegistro"),
            ("Registro", "Registro"),
            ("Detalle", "Detalle"),
            ("IP", "DireccionIp"),
            ("Dispositivo", "Dispositivo"),
        ],
        filas=data.Registros,
    )

    return reporte.a_pdf()


def nombre_archivo_usuario_registro_ingreso(
    ci: str, fecha_inicio: date | None, fecha_fin: date | None
) -> str:
    ahora = datetime.now(ZONA_BOLIVIA)
    periodo = f"{fecha_inicio:%Y%m%d}-{fecha_fin:%Y%m%d}" if fecha_inicio and fecha_fin else "todo"
    return f"registro-accesos-ci-{ci}-{periodo}-{ahora:%Y%m%d-%H%M}.pdf"
