from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.Constants.Cantidades import HORAS_ALERTA_PAUSA_ABIERTA, MOTIVOS_PAUSA_INICIO
from app.Repository.Consultas import ZONA_HORARIA

MOTIVO_SIN_DETALLE = "Sin motivo"
MOTIVO_OTROS = "Otros"


@dataclass(frozen=True)
class SemanaInicio:
    ahora: datetime
    hoy: date
    lunes: date
    lunes_anterior: date
    hoy_anterior: date

    def dias(self) -> list[date]:
        return [self.lunes + timedelta(days=i) for i in range((self.hoy - self.lunes).days + 1)]

    def produccion_atrasada(self, fecha_inicio: datetime) -> bool:
        return fecha_inicio.astimezone(ZoneInfo(ZONA_HORARIA)).date() < self.hoy

    def pausa_atrasada(self, fecha_pausa: datetime) -> bool:
        return self.ahora - fecha_pausa > timedelta(hours=HORAS_ALERTA_PAUSA_ABIERTA)

    def segundos(self, inicio: datetime, fin: datetime | None) -> int:
        return max(int(((fin or self.ahora) - inicio).total_seconds()), 0)

    def segundos_pausas(self, pausas: list[dict]) -> int:
        return sum(self.segundos(p["FechaHoraPausa"], p["FechaHoraReanudacion"]) for p in pausas)

    def motivos_pausa(self, pausas: list[dict]) -> list[dict]:
        motivos: dict[str, dict] = {}
        for pausa in pausas:
            motivo = (pausa["MotivoPausaProduccion"] or "").strip() or MOTIVO_SIN_DETALLE
            registro = motivos.setdefault(motivo, {"Motivo": motivo, "Pausas": 0, "Segundos": 0})
            registro["Pausas"] += 1
            registro["Segundos"] += self.segundos(pausa["FechaHoraPausa"], pausa["FechaHoraReanudacion"])

        ordenados = sorted(motivos.values(), key=lambda m: (-m["Segundos"], -m["Pausas"]))
        if len(ordenados) > MOTIVOS_PAUSA_INICIO:
            resto = ordenados[MOTIVOS_PAUSA_INICIO - 1 :]
            ordenados = ordenados[: MOTIVOS_PAUSA_INICIO - 1] + [
                {
                    "Motivo": MOTIVO_OTROS,
                    "Pausas": sum(m["Pausas"] for m in resto),
                    "Segundos": sum(m["Segundos"] for m in resto),
                }
            ]
        return ordenados


def semana_inicio() -> SemanaInicio:
    ahora = datetime.now(timezone.utc)
    hoy = ahora.astimezone(ZoneInfo(ZONA_HORARIA)).date()
    lunes = hoy - timedelta(days=hoy.weekday())
    return SemanaInicio(
        ahora=ahora,
        hoy=hoy,
        lunes=lunes,
        lunes_anterior=lunes - timedelta(days=7),
        hoy_anterior=hoy - timedelta(days=7),
    )
