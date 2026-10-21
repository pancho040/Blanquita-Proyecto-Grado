from sqlalchemy.orm import Session

from app.Constants.Cantidades import BOBINAS_FUERA_INICIO, HORAS_ALERTA_PAUSA_ABIERTA
from app.Constants.Estados import (
    ESTADO_PRODUCCION_CAMBIO_LINEA,
    ESTADO_PRODUCCION_CANCELADA,
    ESTADO_PRODUCCION_FINALIZADO,
)
from app.Models.BobinaPapel.Inicio import (
    BobinaFueraInicioBobinaPapel,
    FueraInventarioInicioBobinaPapel,
    IndicadoresSemanaBobinaPapel,
    InicioBobinaPapelResponse,
    PausaAbiertaInicioBobinaPapel,
    ProduccionActivaInicioBobinaPapel,
    ProduccionDiaBobinaPapel,
    ProduccionProductoBobinaPapel,
    UltimoLoteInicioBobinaPapel,
)
from app.Models.BobinaPapel.InventarioBobinaPapel import VerResumenInventarioBobinaPapelResponse
from app.Models.Inicio.Inicio import MotivoPausaInicio
from app.Repository.BobinaPapel.Inicio import InicioBobinaPapelRepository
from app.Repository.BobinaPapel.InventarioBobinaPapel import InventarioBobinaPapelRepository
from app.utils.inicio import semana_inicio


def _total(filas: list[dict], campo: str) -> int:
    return sum(int(fila[campo]) for fila in filas)


def _productos(logs: list[dict], cargadas: list[dict]) -> list[ProduccionProductoBobinaPapel]:
    productos: dict[int, dict] = {}
    for filas, campo in ((logs, "Logs"), (cargadas, "Cargadas")):
        for fila in filas:
            producto = productos.setdefault(
                fila["IdProducto"],
                {"IdProducto": fila["IdProducto"], "NombreProducto": fila["NombreProducto"], "Logs": 0, "Cargadas": 0},
            )
            producto[campo] += int(fila[campo])
    return sorted(
        (ProduccionProductoBobinaPapel(**producto) for producto in productos.values()),
        key=lambda producto: (-producto.Logs, -producto.Cargadas, producto.NombreProducto),
    )


class InicioBobinaPapelService:
    def __init__(self, db: Session):
        self.repository = InicioBobinaPapelRepository(db)
        self.inventario = InventarioBobinaPapelRepository(db)

    def VerInicio(self) -> InicioBobinaPapelResponse:
        semana = semana_inicio()

        logs = self.repository.LogsPorDia(semana.lunes, semana.hoy)
        cargadas = self.repository.CargadasPorDia(semana.lunes, semana.hoy)
        pausas = self.repository.Pausas(semana.lunes, semana.hoy)
        pausas_anteriores = self.repository.Pausas(semana.lunes_anterior, semana.hoy_anterior)
        cierres = {
            fila["IdEstadoProduccion"]: int(fila["Cantidad"])
            for fila in self.repository.CierresPorEstado(semana.lunes, semana.hoy)
        }

        indicadores = IndicadoresSemanaBobinaPapel(
            Logs=_total(logs, "Logs"),
            LogsSemanaAnterior=_total(
                self.repository.LogsPorDia(semana.lunes_anterior, semana.hoy_anterior), "Logs"
            ),
            Cargadas=_total(cargadas, "Cargadas"),
            CargadasSemanaAnterior=_total(
                self.repository.CargadasPorDia(semana.lunes_anterior, semana.hoy_anterior), "Cargadas"
            ),
            Finalizadas=cierres.get(ESTADO_PRODUCCION_FINALIZADO, 0),
            Canceladas=cierres.get(ESTADO_PRODUCCION_CANCELADA, 0),
            CambiosLinea=cierres.get(ESTADO_PRODUCCION_CAMBIO_LINEA, 0),
            Pausas=len(pausas),
            SegundosPausa=semana.segundos_pausas(pausas),
            SegundosPausaSemanaAnterior=semana.segundos_pausas(pausas_anteriores),
        )

        dias = []
        for fecha in semana.dias():
            logs_dia = [fila for fila in logs if fila["Fecha"] == fecha]
            cargadas_dia = [fila for fila in cargadas if fila["Fecha"] == fecha]
            dias.append(
                ProduccionDiaBobinaPapel(
                    Fecha=fecha,
                    Logs=_total(logs_dia, "Logs"),
                    Cargadas=_total(cargadas_dia, "Cargadas"),
                    Productos=_productos(logs_dia, cargadas_dia),
                )
            )

        fuera = self.inventario.VerBobinasFueraInventario()
        ultimo_lote = self.repository.UltimoLote()

        return InicioBobinaPapelResponse(
            FechaInicio=semana.lunes,
            FechaFin=semana.hoy,
            HorasAlertaPausa=HORAS_ALERTA_PAUSA_ABIERTA,
            Indicadores=indicadores,
            Dias=dias,
            Productos=_productos(logs, cargadas),
            MotivosPausa=[MotivoPausaInicio(**motivo) for motivo in semana.motivos_pausa(pausas)],
            Activas=[
                ProduccionActivaInicioBobinaPapel(
                    **fila, Atrasada=semana.produccion_atrasada(fila["FechaInicioProduccion"])
                )
                for fila in self.repository.Activas()
            ],
            Pausadas=[
                PausaAbiertaInicioBobinaPapel(**fila, Atrasada=semana.pausa_atrasada(fila["FechaHoraPausa"]))
                for fila in self.repository.PausasAbiertas()
            ],
            Stock=[VerResumenInventarioBobinaPapelResponse(**fila) for fila in self.inventario.VerResumen()],
            FueraInventario=FueraInventarioInicioBobinaPapel(
                Cantidad=len(fuera),
                Bobinas=[BobinaFueraInicioBobinaPapel(**fila) for fila in fuera[:BOBINAS_FUERA_INICIO]],
            ),
            UltimoLote=UltimoLoteInicioBobinaPapel(**ultimo_lote) if ultimo_lote else None,
        )
