from sqlalchemy.orm import Session

from app.Constants.Cantidades import BOBINAS_FUERA_INICIO, HORAS_ALERTA_PAUSA_ABIERTA
from app.Models.BobinaServilleta.Inicio import (
    FueraInventarioInicioBobinaServilleta,
    IndicadoresSemanaBobinaServilleta,
    InicioBobinaServilletaResponse,
    PausaAbiertaInicioBobinaServilleta,
    ProduccionActivaInicioBobinaServilleta,
    ProduccionDiaBobinaServilleta,
    ProduccionMedidaBobinaServilleta,
    SubBobinaFueraInicioBobinaServilleta,
    UltimoLoteInicioBobinaServilleta,
)
from app.Models.BobinaServilleta.InventarioBobinaServilleta import (
    ResumenInventarioBobinaServilletaResponse,
    ResumenInventarioSubBobinaServilletaResponse,
)
from app.Models.Inicio.Inicio import MotivoPausaInicio
from app.Repository.BobinaServilleta.Inicio import InicioBobinaServilletaRepository
from app.Repository.BobinaServilleta.InventarioBobinaServilleta import InventarioBobinaServilletaRepository
from app.utils.inicio import semana_inicio


def _total(filas: list[dict]) -> int:
    return sum(int(fila["Cantidad"]) for fila in filas)


def _medidas(iniciadas: list[dict], finalizadas: list[dict]) -> list[ProduccionMedidaBobinaServilleta]:
    medidas: dict[int, dict] = {}
    for filas, campo in ((iniciadas, "Iniciadas"), (finalizadas, "Finalizadas")):
        for fila in filas:
            medida = medidas.setdefault(
                fila["IdTipoMedidaSubBobina"],
                {
                    "IdTipoMedidaSubBobina": fila["IdTipoMedidaSubBobina"],
                    "MedidaMm": fila["MedidaMm"],
                    "Iniciadas": 0,
                    "Finalizadas": 0,
                },
            )
            medida[campo] += int(fila["Cantidad"])
    return sorted(
        (ProduccionMedidaBobinaServilleta(**medida) for medida in medidas.values()),
        key=lambda medida: -medida.MedidaMm,
    )


class InicioBobinaServilletaService:
    def __init__(self, db: Session):
        self.repository = InicioBobinaServilletaRepository(db)
        self.inventario = InventarioBobinaServilletaRepository(db)

    def VerInicio(self) -> InicioBobinaServilletaResponse:
        semana = semana_inicio()

        iniciadas = self.repository.IniciadasPorDia(semana.lunes, semana.hoy)
        finalizadas = self.repository.FinalizadasPorDia(semana.lunes, semana.hoy)
        pausas = self.repository.Pausas(semana.lunes, semana.hoy)
        pausas_anteriores = self.repository.Pausas(semana.lunes_anterior, semana.hoy_anterior)

        indicadores = IndicadoresSemanaBobinaServilleta(
            Iniciadas=_total(iniciadas),
            IniciadasSemanaAnterior=_total(
                self.repository.IniciadasPorDia(semana.lunes_anterior, semana.hoy_anterior)
            ),
            Finalizadas=_total(finalizadas),
            FinalizadasSemanaAnterior=_total(
                self.repository.FinalizadasPorDia(semana.lunes_anterior, semana.hoy_anterior)
            ),
            Canceladas=self.repository.Canceladas(semana.lunes, semana.hoy),
            BobinasAbiertas=self.repository.BobinasAbiertas(semana.lunes, semana.hoy),
            BobinasAbiertasSemanaAnterior=self.repository.BobinasAbiertas(
                semana.lunes_anterior, semana.hoy_anterior
            ),
            Pausas=len(pausas),
            SegundosPausa=semana.segundos_pausas(pausas),
            SegundosPausaSemanaAnterior=semana.segundos_pausas(pausas_anteriores),
        )

        dias = []
        for fecha in semana.dias():
            iniciadas_dia = [fila for fila in iniciadas if fila["Fecha"] == fecha]
            finalizadas_dia = [fila for fila in finalizadas if fila["Fecha"] == fecha]
            dias.append(
                ProduccionDiaBobinaServilleta(
                    Fecha=fecha,
                    Iniciadas=_total(iniciadas_dia),
                    Finalizadas=_total(finalizadas_dia),
                    Medidas=_medidas(iniciadas_dia, finalizadas_dia),
                )
            )

        fuera = self.inventario.VerSubBobinasServilletaFueraInventario()
        ultimo_lote = self.repository.UltimoLote()

        return InicioBobinaServilletaResponse(
            FechaInicio=semana.lunes,
            FechaFin=semana.hoy,
            HorasAlertaPausa=HORAS_ALERTA_PAUSA_ABIERTA,
            Indicadores=indicadores,
            Dias=dias,
            Medidas=_medidas(iniciadas, finalizadas),
            MotivosPausa=[MotivoPausaInicio(**motivo) for motivo in semana.motivos_pausa(pausas)],
            Activas=[
                ProduccionActivaInicioBobinaServilleta(
                    **fila, Atrasada=semana.produccion_atrasada(fila["FechaInicioProduccion"])
                )
                for fila in self.repository.Activas()
            ],
            Pausadas=[
                PausaAbiertaInicioBobinaServilleta(
                    **fila, Atrasada=semana.pausa_atrasada(fila["FechaHoraPausa"])
                )
                for fila in self.repository.PausasAbiertas()
            ],
            StockBobinas=[
                ResumenInventarioBobinaServilletaResponse(**fila)
                for fila in self.inventario.VerResumenInventarioBobinaServilleta()
            ],
            StockSubBobinas=[
                ResumenInventarioSubBobinaServilletaResponse(**fila)
                for fila in self.inventario.VerResumenInventarioSubBobinaServilleta()
            ],
            FueraInventario=FueraInventarioInicioBobinaServilleta(
                Cantidad=len(fuera),
                SubBobinas=[
                    SubBobinaFueraInicioBobinaServilleta(**fila) for fila in fuera[:BOBINAS_FUERA_INICIO]
                ],
            ),
            UltimoLote=UltimoLoteInicioBobinaServilleta(**ultimo_lote) if ultimo_lote else None,
        )
