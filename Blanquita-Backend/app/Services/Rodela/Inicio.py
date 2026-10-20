from sqlalchemy.orm import Session

from app.Constants.Cantidades import (
    BOBINAS_FUERA_INICIO,
    MINUTOS_DESHACER_TRASLADO_RODELA,
    MOVIMIENTOS_RECIENTES_INICIO,
)
from app.Constants.Estados import (
    MOVIMIENTO_MATERIA_PRIMA_CORRECCION,
    MOVIMIENTO_MATERIA_PRIMA_DEVOLUCION,
    MOVIMIENTO_MATERIA_PRIMA_INGRESO,
    MOVIMIENTO_MATERIA_PRIMA_REINGRESO,
    MOVIMIENTO_MATERIA_PRIMA_TRASLADO,
)
from app.Models.Rodela.Inicio import (
    EnProduccionInicioRodela,
    IndicadoresSemanaRodela,
    InicioRodelaResponse,
    MovimientoDiaRodela,
    MovimientoRecienteRodela,
    MovimientoTipoRodela,
    RodelaEnProduccionInicio,
    UltimoLoteInicioRodela,
)
from app.Models.Rodela.InventarioRodela import ResumenInventarioRodelaResponse, RodelaReingresableResponse
from app.Repository.Rodela.Inicio import InicioRodelaRepository
from app.Repository.Rodela.InventarioRodela import InventarioRodelaRepository
from app.utils.inicio import semana_inicio

MOVIMIENTOS_DEVOLUCION = (MOVIMIENTO_MATERIA_PRIMA_DEVOLUCION, MOVIMIENTO_MATERIA_PRIMA_REINGRESO)


def _total(filas: list[dict], *tipos: int) -> int:
    return sum(int(fila["Cantidad"]) for fila in filas if fila["IdTipoMovimiento"] in tipos)


def _tipos(filas: list[dict]) -> list[MovimientoTipoRodela]:
    tipos: dict[int, dict] = {}
    for fila in filas:
        if fila["IdTipoMovimiento"] == MOVIMIENTO_MATERIA_PRIMA_TRASLADO:
            campo = "Enviadas"
        elif fila["IdTipoMovimiento"] == MOVIMIENTO_MATERIA_PRIMA_INGRESO:
            campo = "Recibidas"
        else:
            continue
        tipo = tipos.setdefault(
            fila["IdTipoRodela"],
            {"IdTipoRodela": fila["IdTipoRodela"], "NombreTipoRodela": fila["NombreTipoRodela"], "Enviadas": 0, "Recibidas": 0},
        )
        tipo[campo] += int(fila["Cantidad"])
    return sorted(
        (MovimientoTipoRodela(**tipo) for tipo in tipos.values()),
        key=lambda tipo: (-tipo.Enviadas, -tipo.Recibidas, tipo.NombreTipoRodela),
    )


class InicioRodelaService:
    def __init__(self, db: Session):
        self.repository = InicioRodelaRepository(db)
        self.inventario = InventarioRodelaRepository(db)

    def VerInicio(self) -> InicioRodelaResponse:
        semana = semana_inicio()

        movimientos = self.repository.MovimientosPorDia(semana.lunes, semana.hoy)
        anteriores = self.repository.MovimientosPorDia(semana.lunes_anterior, semana.hoy_anterior)

        indicadores = IndicadoresSemanaRodela(
            Enviadas=_total(movimientos, MOVIMIENTO_MATERIA_PRIMA_TRASLADO),
            EnviadasSemanaAnterior=_total(anteriores, MOVIMIENTO_MATERIA_PRIMA_TRASLADO),
            Recibidas=_total(movimientos, MOVIMIENTO_MATERIA_PRIMA_INGRESO),
            RecibidasSemanaAnterior=_total(anteriores, MOVIMIENTO_MATERIA_PRIMA_INGRESO),
            Devueltas=_total(movimientos, *MOVIMIENTOS_DEVOLUCION),
            DevueltasSemanaAnterior=_total(anteriores, *MOVIMIENTOS_DEVOLUCION),
            Correcciones=_total(movimientos, MOVIMIENTO_MATERIA_PRIMA_CORRECCION),
            CorreccionesSemanaAnterior=_total(anteriores, MOVIMIENTO_MATERIA_PRIMA_CORRECCION),
        )

        dias = []
        for fecha in semana.dias():
            del_dia = [fila for fila in movimientos if fila["Fecha"] == fecha]
            dias.append(
                MovimientoDiaRodela(
                    Fecha=fecha,
                    Enviadas=_total(del_dia, MOVIMIENTO_MATERIA_PRIMA_TRASLADO),
                    Recibidas=_total(del_dia, MOVIMIENTO_MATERIA_PRIMA_INGRESO),
                    Tipos=_tipos(del_dia),
                )
            )

        stock = [ResumenInventarioRodelaResponse(**fila) for fila in self.inventario.VerResumenInventarioRodela()]
        ultimo_lote = self.repository.UltimoLote()

        return InicioRodelaResponse(
            FechaInicio=semana.lunes,
            FechaFin=semana.hoy,
            MinutosDeshacerTraslado=MINUTOS_DESHACER_TRASLADO_RODELA,
            Indicadores=indicadores,
            Dias=dias,
            Tipos=_tipos(movimientos),
            Stock=stock,
            EnProduccion=EnProduccionInicioRodela(
                Cantidad=sum(tipo.CantidadAbiertas for tipo in stock),
                Rodelas=[
                    RodelaEnProduccionInicio(**fila)
                    for fila in self.repository.EnProduccion(BOBINAS_FUERA_INICIO)
                ],
            ),
            Reingresables=[
                RodelaReingresableResponse(**fila) for fila in self.inventario.ListarRodelasReingresables()
            ],
            UltimosMovimientos=[
                MovimientoRecienteRodela(**fila)
                for fila in self.repository.UltimosMovimientos(MOVIMIENTOS_RECIENTES_INICIO)
            ],
            UltimoLote=UltimoLoteInicioRodela(**ultimo_lote) if ultimo_lote else None,
        )
