from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from app.Schemas.Produccion import Turno

ZONA_HORARIA = "America/La_Paz"


def nombre_operador(usuario):
    return usuario.PrimerNombre + " " + usuario.ApellidoPaterno


def filtro_rango(columna, fecha_inicio, fecha_fin):
    
    columna = func.timezone(ZONA_HORARIA, columna)
    condiciones = []
    if fecha_inicio is not None:
        condiciones.append(columna >= fecha_inicio)
    if fecha_fin is not None:
        condiciones.append(columna < fecha_fin + timedelta(days=1))
    return condiciones


def _turno_cubre_hora(turno: dict, hora: time) -> bool:
    if turno["HoraInicio"] <= turno["HoraFin"]:
        return turno["HoraInicio"] <= hora <= turno["HoraFin"]
    return hora >= turno["HoraInicio"] or hora <= turno["HoraFin"]


def turno_actual(caller) -> dict | None:
    turnos = caller.Consultar(
        select(Turno.IdTurno, Turno.NombreTurno, Turno.HoraInicio, Turno.HoraFin).order_by(
            Turno.IdTurno
        )
    )
    if not turnos:
        return None

    hora = datetime.now(ZoneInfo(ZONA_HORARIA)).time().replace(microsecond=0)

    for turno in turnos:
        if _turno_cubre_hora(turno, hora):
            return turno

    anteriores = [turno for turno in turnos if turno["HoraInicio"] <= hora]
    return max(anteriores or turnos, key=lambda turno: turno["HoraInicio"])
