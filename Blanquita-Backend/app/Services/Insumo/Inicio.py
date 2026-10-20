from datetime import timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.Constants.AlertaStock import DOMINIO_STOCK_INSUMO, NIVELES_STOCK_ALERTA
from app.Constants.Cantidades import DIAS_SIN_MOVIMIENTO_PRODUCTO, MOVIMIENTOS_RECIENTES_INICIO
from app.Constants.Estados import MOVIMIENTO_MATERIA_PRIMA_INGRESO, MOVIMIENTO_MATERIA_PRIMA_TRASLADO
from app.Models.Insumo.Inicio import (
    IndicadoresSemanaInsumo,
    InicioInsumoResponse,
    MovimientoDiaInsumo,
    MovimientoRecienteInsumo,
    MovimientoTipoInsumo,
    StockInsumoInicio,
)
from app.Repository.AlertaStock.AlertaStock import AlertaStockRepository
from app.Repository.Consultas import ZONA_HORARIA
from app.Repository.Insumo.Reporte import ReporteInsumoRepository
from app.utils.inicio import semana_inicio

CAMPO_POR_MOVIMIENTO = {
    MOVIMIENTO_MATERIA_PRIMA_INGRESO: "Ingresos",
    MOVIMIENTO_MATERIA_PRIMA_TRASLADO: "Salidas",
}

NOMBRE_SALIDA = "Salida"


def _cantidad(fila: dict) -> int:
    return int(fila["CantidadMovimiento"] or 0)


def _total(filas: list[dict], tipo: int) -> int:
    return sum(_cantidad(fila) for fila in filas if fila["IdTipoMovimiento"] == tipo)


def _insumos(filas: list[dict]) -> list[MovimientoTipoInsumo]:
    insumos: dict[int, dict] = {}
    for fila in filas:
        campo = CAMPO_POR_MOVIMIENTO.get(fila["IdTipoMovimiento"])
        if campo is None:
            continue
        insumo = insumos.setdefault(
            fila["IdTipoInsumo"],
            {"IdTipoInsumo": fila["IdTipoInsumo"], "NombreInsumo": fila["NombreInsumo"], "Ingresos": 0, "Salidas": 0},
        )
        insumo[campo] += _cantidad(fila)
    return sorted(
        (MovimientoTipoInsumo(**insumo) for insumo in insumos.values()),
        key=lambda insumo: (-insumo.Salidas, -insumo.Ingresos, insumo.NombreInsumo),
    )


class InicioInsumoService:
    def __init__(self, db: Session):
        self.reporte = ReporteInsumoRepository(db)
        self.alertas = AlertaStockRepository(db)
        self.zona = ZoneInfo(ZONA_HORARIA)

    def _movimientos(self, fecha_inicio, fecha_fin) -> list[dict]:
        return self.reporte.ReporteMovimientos({"p_FechaInicio": fecha_inicio, "p_FechaFin": fecha_fin})

    def VerInicio(self) -> InicioInsumoResponse:
        semana = semana_inicio()
        movimientos = self._movimientos(semana.lunes, semana.hoy)
        anteriores = self._movimientos(semana.lunes_anterior, semana.hoy_anterior)

        ultimos = {fila["IdTipoInsumo"]: fila["FechaUltimoMovimiento"] for fila in self.reporte.ReporteInventario({})}
        stock = [
            StockInsumoInicio(
                IdTipoInsumo=fila["Id"],
                NombreInsumo=fila["Nombre"],
                Activo=fila["Activo"],
                CantidadActual=int(fila["CantidadActual"] or 0),
                StockMinimo=fila["StockMinimo"],
                StockPreventivo=fila["StockPreventivo"],
                NivelStock=fila["NivelStock"],
                FechaUltimoMovimiento=ultimos.get(fila["Id"]),
            )
            for fila in self.alertas.ListarStock(DOMINIO_STOCK_INSUMO)
        ]

        limite = semana.ahora - timedelta(days=DIAS_SIN_MOVIMIENTO_PRODUCTO)
        sin_movimiento = sorted(
            (
                insumo
                for insumo in stock
                if insumo.Activo
                and insumo.CantidadActual > 0
                and (insumo.FechaUltimoMovimiento is None or insumo.FechaUltimoMovimiento < limite)
            ),
            key=lambda insumo: (insumo.FechaUltimoMovimiento is not None, insumo.FechaUltimoMovimiento or semana.ahora),
        )

        dias = []
        for fecha in semana.dias():
            del_dia = [fila for fila in movimientos if fila["FechaMovimiento"].astimezone(self.zona).date() == fecha]
            dias.append(
                MovimientoDiaInsumo(
                    Fecha=fecha,
                    Ingresos=_total(del_dia, MOVIMIENTO_MATERIA_PRIMA_INGRESO),
                    Salidas=_total(del_dia, MOVIMIENTO_MATERIA_PRIMA_TRASLADO),
                    Insumos=_insumos(del_dia),
                )
            )

        return InicioInsumoResponse(
            FechaInicio=semana.lunes,
            FechaFin=semana.hoy,
            DiasSinMovimiento=DIAS_SIN_MOVIMIENTO_PRODUCTO,
            Indicadores=IndicadoresSemanaInsumo(
                Ingresos=_total(movimientos, MOVIMIENTO_MATERIA_PRIMA_INGRESO),
                IngresosSemanaAnterior=_total(anteriores, MOVIMIENTO_MATERIA_PRIMA_INGRESO),
                Salidas=_total(movimientos, MOVIMIENTO_MATERIA_PRIMA_TRASLADO),
                SalidasSemanaAnterior=_total(anteriores, MOVIMIENTO_MATERIA_PRIMA_TRASLADO),
                Movimientos=len(movimientos),
                MovimientosSemanaAnterior=len(anteriores),
                StockTotal=sum(insumo.CantidadActual for insumo in stock if insumo.Activo),
                InsumosEnAlerta=sum(
                    1 for insumo in stock if insumo.Activo and insumo.NivelStock in NIVELES_STOCK_ALERTA
                ),
            ),
            Dias=dias,
            Insumos=_insumos(movimientos),
            Stock=stock,
            SinMovimiento=sin_movimiento,
            UltimosMovimientos=[
                MovimientoRecienteInsumo(
                    IdMovimientoInsumo=fila["IdMovimientoInsumo"],
                    NombreInsumo=fila["NombreInsumo"],
                    IdTipoMovimiento=fila["IdTipoMovimiento"],
                    NombreMovimiento=(
                        NOMBRE_SALIDA
                        if fila["IdTipoMovimiento"] == MOVIMIENTO_MATERIA_PRIMA_TRASLADO
                        else fila["NombreMovimiento"]
                    ),
                    Cantidad=_cantidad(fila),
                    Usuario=f"{fila['PrimerNombre']} {fila['ApellidoPaterno']}",
                    FechaMovimiento=fila["FechaMovimiento"],
                    Observacion=fila["Observacion"],
                )
                for fila in movimientos[:MOVIMIENTOS_RECIENTES_INICIO]
            ],
        )
