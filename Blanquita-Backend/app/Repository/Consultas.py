from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import case, func, literal, null, or_, select

from app.Constants.AlertaStock import NIVEL_STOCK_BAJO, NIVEL_STOCK_CRITICO, NIVEL_STOCK_NORMAL
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


def nivel_stock(cantidad, minimo, preventivo):
    return case(
        (minimo.is_(None), null()),
        (cantidad <= minimo, literal(NIVEL_STOCK_CRITICO)),
        (cantidad <= preventivo, literal(NIVEL_STOCK_BAJO)),
        else_=literal(NIVEL_STOCK_NORMAL),
    )


def visible_en_inventario(activo, cantidad):
    return or_(activo, cantidad > 0)


def _turno_cubre_hora(turno: dict, hora: time) -> bool:
    if turno["HoraInicio"] <= turno["HoraFin"]:
        return turno["HoraInicio"] <= hora <= turno["HoraFin"]
    return hora >= turno["HoraInicio"] or hora <= turno["HoraFin"]


def listar_turnos(caller) -> list[dict]:
    return caller.Consultar(
        select(Turno.IdTurno, Turno.NombreTurno, Turno.HoraInicio, Turno.HoraFin).order_by(
            Turno.IdTurno
        )
    )


def turno_de_hora(turnos: list[dict], hora: time) -> dict | None:
    if not turnos:
        return None

    for turno in turnos:
        if _turno_cubre_hora(turno, hora):
            return turno

    anteriores = [turno for turno in turnos if turno["HoraInicio"] <= hora]
    return max(anteriores or turnos, key=lambda turno: turno["HoraInicio"])


def turno_actual(caller) -> dict | None:
    hora = datetime.now(ZoneInfo(ZONA_HORARIA)).time().replace(microsecond=0)
    return turno_de_hora(listar_turnos(caller), hora)
