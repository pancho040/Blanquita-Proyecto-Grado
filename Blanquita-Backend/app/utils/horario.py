from datetime import datetime
from zoneinfo import ZoneInfo

from app.Constants.Horario import HORA_FIN_SOLO_CONSULTA, HORA_INICIO_SOLO_CONSULTA
from app.Repository.Consultas import ZONA_HORARIA


def en_modo_consulta(ahora: datetime | None = None) -> bool:
    hora = (ahora or datetime.now(ZoneInfo(ZONA_HORARIA))).astimezone(ZoneInfo(ZONA_HORARIA)).time()
    if HORA_INICIO_SOLO_CONSULTA <= HORA_FIN_SOLO_CONSULTA:
        return HORA_INICIO_SOLO_CONSULTA <= hora <= HORA_FIN_SOLO_CONSULTA
    return hora >= HORA_INICIO_SOLO_CONSULTA or hora <= HORA_FIN_SOLO_CONSULTA
