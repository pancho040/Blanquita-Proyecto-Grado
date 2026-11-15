"""
Utilidades de fecha y zona horaria oficiales para Papelera Blanquita.
Zona Horaria Oficial: America/La_Paz (UTC-4).
Prohibido usar datetime.utcnow(), date.today() o CURRENT_DATE en PostgreSQL sin
especificar AT TIME ZONE 'America/La_Paz', pues después de las 20:00 BOT la fecha
UTC avanza al día siguiente creando inconsistencias críticas en logística y finanzas.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo
from typing import Optional, Union

ZONA_BOLIVIA = ZoneInfo("America/La_Paz")


def zona_horaria_bolivia() -> ZoneInfo:
    """Retorna el objeto ZoneInfo de America/La_Paz."""
    return ZONA_BOLIVIA


def fecha_actual_bolivia() -> date:
    """Retorna la fecha local en Bolivia (date)."""
    return datetime.now(ZONA_BOLIVIA).date()


def ahora_bolivia() -> datetime:
    """Retorna la fecha y hora actual en Bolivia con zona horaria (datetime)."""
    return datetime.now(ZONA_BOLIVIA)


def es_hoy_bolivia(fecha_val: Union[date, str, datetime]) -> bool:
    """Verifica si la fecha dada corresponde a hoy en Bolivia."""
    if not fecha_val:
        return False
    if isinstance(fecha_val, str):
        try:
            return fecha_val.strip()[:10] == fecha_actual_bolivia().isoformat()
        except Exception:
            return False
    if isinstance(fecha_val, datetime):
        return fecha_val.astimezone(ZONA_BOLIVIA).date() == fecha_actual_bolivia()
    if isinstance(fecha_val, date):
        return fecha_val == fecha_actual_bolivia()
    return False


def normalizar_fecha_bolivia(fecha_input: Optional[Union[date, str, datetime]] = None) -> date:
    """
    Retorna la fecha normalizada como objeto date. Si es None o vacía, retorna hoy en Bolivia.
    """
    if not fecha_input:
        return fecha_actual_bolivia()
    if isinstance(fecha_input, str):
        try:
            return date.fromisoformat(fecha_input.strip()[:10])
        except Exception:
            return fecha_actual_bolivia()
    if isinstance(fecha_input, datetime):
        return fecha_input.astimezone(ZONA_BOLIVIA).date()
    if isinstance(fecha_input, date):
        return fecha_input
    return fecha_actual_bolivia()
