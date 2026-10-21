from datetime import date, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.Constants.AlertaStock import (
    DOMINIO_STOCK_PRODUCTO,
    DOMINIOS_STOCK,
    NIVEL_STOCK_CRITICO,
    NIVELES_STOCK_ALERTA,
    NOMBRES_DOMINIO_STOCK,
)
from app.Constants.Cantidades import HORAS_ALERTA_PAUSA_ABIERTA, MOVIMIENTOS_RECIENTES_INICIO
from app.Models.Inicio.Gerente import (
    InicioGerenteResponse,
    MateriaPrimaInicioGerente,
    PausasAreaInicioGerente,
    PausasInicioGerente,
    PeriodoInicio,
    PlantaInicioGerente,
    ProduccionInicioGerente,
    SalidasInicioGerente,
    StockInicioGerente,
    TramoInicioGerente,
)
from app.Models.InventarioFinal.Reporte import ReporteSalidasProductoTerminadoRequest
from app.Repository.AlertaStock.AlertaStock import AlertaStockRepository
from app.Repository.BobinaPapel.Inicio import InicioBobinaPapelRepository
from app.Repository.BobinaServilleta.Inicio import InicioBobinaServilletaRepository
from app.Repository.Consultas import ZONA_HORARIA
from app.Repository.InventarioFinal.Inicio import InicioProductoTerminadoRepository
from app.Services.InventarioFinal.Inicio import (
    MOVIMIENTOS_INGRESO,
    MOVIMIENTOS_PRODUCCION,
    InicioProductoTerminadoService,
    _signo_produccion,
    _unidades_fila,
    agrupar_lineas,
    despacho_inicio,
    filas_salida,
    signo_salida,
)
from app.Services.InventarioFinal.Reporte import ReporteProductoTerminadoService
from app.Services.AlertaStock.AlertaStock import _item
from app.Services.Notificacion.Notificacion import NotificacionService
from app.utils.inicio import SemanaInicio, semana_inicio


def _tramos(periodo: PeriodoInicio, inicio: date, fin: date) -> list[tuple[date, date]]:
    if periodo == PeriodoInicio.semana:
        dias = [inicio + timedelta(days=i) for i in range((fin - inicio).days + 1)]
        return [(dia, dia) for dia in dias]

    tramos = []
    desde = inicio
    while desde <= fin:
        hasta = min(desde + timedelta(days=6 - desde.weekday()), fin)
        tramos.append((desde, hasta))
        desde = hasta + timedelta(days=1)
    return tramos


def _pausas(semana: SemanaInicio, pausas: list[dict]) -> PausasAreaInicioGerente:
    return PausasAreaInicioGerente(
        Pausas=len(pausas),
        Segundos=semana.segundos_pausas(pausas),
        Motivos=semana.motivos_pausa(pausas),
    )


class InicioGerenteService:
    def __init__(self, db: Session):
        self.producto = InicioProductoTerminadoRepository(db)
        self.inicio_producto = InicioProductoTerminadoService(db)
        self.reporte = ReporteProductoTerminadoService(db)
        self.notificaciones = NotificacionService(db)
        self.alertas = AlertaStockRepository(db)
        self.bobina_papel = InicioBobinaPapelRepository(db)
        self.bobina_servilleta = InicioBobinaServilletaRepository(db)
        self.zona = ZoneInfo(ZONA_HORARIA)

    def _fecha(self, fila: dict) -> date:
        return fila["FechaMovimiento"].astimezone(self.zona).date()

    def _Tramos(self, tramos: list[tuple[date, date]], filas: list[dict], signo) -> list[TramoInicioGerente]:
        resultado = []
        for desde, hasta in tramos:
            lineas = agrupar_lineas([fila for fila in filas if desde <= self._fecha(fila) <= hasta], signo)
            resultado.append(
                TramoInicioGerente(
                    FechaInicio=desde,
                    FechaFin=hasta,
                    Unidades=sum(linea.Unidades for linea in lineas),
                    Contenedores=sum(linea.Contenedores for linea in lineas),
                    Lineas=lineas,
                )
            )
        return resultado

    def _Stock(self) -> StockInicioGerente:
        inventario = self.inicio_producto.VerInventario()
        return StockInicioGerente(
            UnidadesTotales=inventario.UnidadesTotales,
            Alertas=inventario.Alertas,
            Lineas=inventario.Lineas,
        )

    def _Produccion(self, inicio: date, fin: date, tramos) -> ProduccionInicioGerente:
        movimientos = self.producto.Movimientos(inicio, fin, MOVIMIENTOS_PRODUCCION)
        ingresos = [fila for fila in movimientos if fila["IdTipoMovimientoInventario"] in MOVIMIENTOS_INGRESO]
        return ProduccionInicioGerente(
            Unidades=sum(_signo_produccion(fila) * _unidades_fila(fila) for fila in movimientos),
            Contenedores=sum(_signo_produccion(fila) * int(fila["Cantidad"] or 0) for fila in movimientos),
            Ingresos=len(ingresos),
            DiasConProduccion=len({self._fecha(fila) for fila in ingresos}),
            Lineas=agrupar_lineas(movimientos, _signo_produccion),
            Tramos=self._Tramos(tramos, movimientos, _signo_produccion),
        )

    def _Salidas(self, inicio: date, fin: date, tramos) -> SalidasInicioGerente:
        presentaciones = {fila["IdPresentacion"]: fila for fila in self.producto.Presentaciones()}
        resumen = self.reporte.ResumenSalidas(
            ReporteSalidasProductoTerminadoRequest(FechaInicio=inicio, FechaFin=fin)
        )
        filas = filas_salida(resumen, presentaciones)

        despachos_por_linea: dict[int, set] = {}
        for fila in filas:
            despachos_por_linea.setdefault(fila["IdProducto"], set()).add(fila["Despacho"])

        return SalidasInicioGerente(
            Despachos=len(resumen.Despachos),
            Unidades=sum(_unidades_fila(fila) for fila in filas),
            Contenedores=sum(int(fila["Cantidad"] or 0) for fila in filas),
            Lineas=agrupar_lineas(
                filas,
                signo_salida,
                {id_producto: len(grupo) for id_producto, grupo in despachos_por_linea.items()},
            ),
            Tramos=self._Tramos(tramos, filas, signo_salida),
            UltimosDespachos=[
                despacho_inicio(despacho) for despacho in resumen.Despachos[:MOVIMIENTOS_RECIENTES_INICIO]
            ],
        )

    def _MateriaPrima(self) -> list[MateriaPrimaInicioGerente]:
        areas = {
            dominio: {
                "Dominio": dominio,
                "NombreDominio": NOMBRES_DOMINIO_STOCK[dominio],
                "Cantidad": 0,
                "Alertas": 0,
                "Criticas": 0,
                "Items": [],
            }
            for dominio in DOMINIOS_STOCK
            if dominio != DOMINIO_STOCK_PRODUCTO
        }
        for fila in self.alertas.ListarStock(solo_visibles=True):
            area = areas.get(fila["Dominio"])
            if area is None:
                continue
            area["Cantidad"] += int(fila["CantidadActual"] or 0)
            area["Items"].append(_item(fila))
            if fila["Activo"] and fila["NivelStock"] in NIVELES_STOCK_ALERTA:
                area["Alertas"] += 1
                if fila["NivelStock"] == NIVEL_STOCK_CRITICO:
                    area["Criticas"] += 1
        return [MateriaPrimaInicioGerente(**area) for area in areas.values()]

    def VerInicio(self, periodo: PeriodoInicio) -> InicioGerenteResponse:
        semana = semana_inicio()
        inicio = semana.lunes if periodo == PeriodoInicio.semana else semana.hoy.replace(day=1)
        fin = semana.hoy
        tramos = _tramos(periodo, inicio, fin)
        bobina_papel, bobina_servilleta = self.notificaciones.Producciones(semana)

        return InicioGerenteResponse(
            Periodo=periodo,
            FechaInicio=inicio,
            FechaFin=fin,
            Planta=PlantaInicioGerente(
                BobinaPapel=bobina_papel,
                BobinaServilleta=bobina_servilleta,
                HorasAlertaPausa=HORAS_ALERTA_PAUSA_ABIERTA,
            ),
            Stock=self._Stock(),
            Produccion=self._Produccion(inicio, fin, tramos),
            Salidas=self._Salidas(inicio, fin, tramos),
            Pausas=PausasInicioGerente(
                BobinaPapel=_pausas(semana, self.bobina_papel.Pausas(inicio, fin)),
                BobinaServilleta=_pausas(semana, self.bobina_servilleta.Pausas(inicio, fin)),
            ),
            MateriaPrima=self._MateriaPrima(),
        )
