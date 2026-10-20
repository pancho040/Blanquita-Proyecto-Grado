from datetime import timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.Constants.Cantidades import (
    DIAS_SIN_MOVIMIENTO_PRODUCTO,
    MOVIMIENTOS_RECIENTES_INICIO,
    PRESENTACIONES_DESTACADAS_INICIO,
)
from app.Constants.Estados import (
    MOVIMIENTO_PT_AJUSTE_NEGATIVO,
    MOVIMIENTO_PT_AJUSTE_POSITIVO,
    MOVIMIENTO_PT_AUMENTO,
    MOVIMIENTO_PT_DESCUENTO,
    MOVIMIENTO_PT_ENTRADA,
)
from app.Constants.AlertaStock import NIVEL_STOCK_BAJO, NIVEL_STOCK_CRITICO
from app.Models.InventarioFinal.Inicio import (
    AlertasStockInicio,
    ConteoMovimientoInicio,
    DespachoInicio,
    DiaSemanaProductoTerminado,
    IndicadoresProduccionProductoTerminado,
    IndicadoresSalidasProductoTerminado,
    InicioInventarioProductoTerminadoResponse,
    InicioProduccionProductoTerminadoResponse,
    InicioSalidasProductoTerminadoResponse,
    LineaSemanaInicio,
    LineaStockInicio,
    MovimientoRecienteProductoTerminado,
    PresentacionDespachadaInicio,
    PresentacionPendienteInicio,
    PresentacionStockInicio,
    TurnoProduccionProductoTerminado,
)
from app.Models.InventarioFinal.Reporte import ReporteSalidasProductoTerminadoRequest
from app.Repository.Consultas import ZONA_HORARIA, turno_de_hora
from app.Repository.InventarioFinal.Inicio import InicioProductoTerminadoRepository
from app.Services.InventarioFinal.Reporte import ReporteProductoTerminadoService
from app.utils.inicio import semana_inicio

MOVIMIENTOS_INGRESO = (MOVIMIENTO_PT_ENTRADA, MOVIMIENTO_PT_AUMENTO)
MOVIMIENTOS_PRODUCCION = (*MOVIMIENTOS_INGRESO, MOVIMIENTO_PT_DESCUENTO)
MOVIMIENTOS_CONTROL = (MOVIMIENTO_PT_AJUSTE_POSITIVO, MOVIMIENTO_PT_AJUSTE_NEGATIVO, MOVIMIENTO_PT_DESCUENTO)
TURNO_SIN_DEFINIR = "Sin turno"


def _unidades(cantidad: int, rollos: int | None, paquetes: int | None) -> int:
    return int(cantidad or 0) * (rollos or 1) * (paquetes or 1)


def _unidades_fila(fila: dict) -> int:
    return _unidades(fila["Cantidad"], fila["CantidadRollosUnidades"], fila["CantidadPorUnidadTerminada"])


def _signo_produccion(fila: dict) -> int:
    return -1 if fila["IdTipoMovimientoInventario"] == MOVIMIENTO_PT_DESCUENTO else 1


def _contar(filas: list[dict], tipo: int) -> int:
    return sum(1 for fila in filas if fila["IdTipoMovimientoInventario"] == tipo)


def _reciente(fila: dict) -> MovimientoRecienteProductoTerminado:
    return MovimientoRecienteProductoTerminado(**fila)


def _pendiente(presentacion: dict) -> PresentacionPendienteInicio:
    return PresentacionPendienteInicio(**presentacion)


class InicioProductoTerminadoService:
    def __init__(self, db: Session):
        self.repository = InicioProductoTerminadoRepository(db)
        self.reporte = ReporteProductoTerminadoService(db)
        self.zona = ZoneInfo(ZONA_HORARIA)

    def _fecha(self, fila: dict):
        return fila["FechaMovimiento"].astimezone(self.zona).date()

    def _lineas(self, filas: list[dict], signo, registros=None) -> list[LineaSemanaInicio]:
        lineas: dict[int, dict] = {}
        for fila in filas:
            linea = lineas.setdefault(
                fila["IdProducto"],
                {
                    "IdProducto": fila["IdProducto"],
                    "NombreProducto": fila["NombreProducto"],
                    "Unidades": 0,
                    "Contenedores": 0,
                    "Registros": 0,
                },
            )
            factor = signo(fila)
            linea["Unidades"] += factor * _unidades_fila(fila)
            linea["Contenedores"] += factor * int(fila["Cantidad"] or 0)
            linea["Registros"] += 1
        if registros:
            for id_producto, cantidad in registros.items():
                if id_producto in lineas:
                    lineas[id_producto]["Registros"] = cantidad
        return sorted(
            (LineaSemanaInicio(**linea) for linea in lineas.values()),
            key=lambda linea: (-linea.Unidades, linea.NombreProducto),
        )

    def _dias(self, semana, filas: list[dict], signo) -> list[DiaSemanaProductoTerminado]:
        dias = []
        for fecha in semana.dias():
            del_dia = [fila for fila in filas if self._fecha(fila) == fecha]
            lineas = self._lineas(del_dia, signo)
            dias.append(
                DiaSemanaProductoTerminado(
                    Fecha=fecha,
                    Unidades=sum(linea.Unidades for linea in lineas),
                    Contenedores=sum(linea.Contenedores for linea in lineas),
                    Lineas=lineas,
                )
            )
        return dias

    def VerInventario(self) -> InicioInventarioProductoTerminadoResponse:
        semana = semana_inicio()
        presentaciones = self.repository.Presentaciones()

        lineas: dict[int, dict] = {}
        alertas = {"Agotadas": 0, "Criticas": 0, "Bajas": 0}
        sin_movimiento = []
        inactivas_con_stock = []
        limite = semana.ahora - timedelta(days=DIAS_SIN_MOVIMIENTO_PRODUCTO)

        for fila in presentaciones:
            activa = fila["ProductoActivo"] and fila["PresentacionActiva"]
            unidades = _unidades(
                fila["CantidadActual"], fila["CantidadRollosUnidades"], fila["CantidadPorUnidadTerminada"]
            )
            linea = lineas.setdefault(
                fila["IdProducto"],
                {
                    "IdProducto": fila["IdProducto"],
                    "NombreProducto": fila["NombreProducto"],
                    "Activo": fila["ProductoActivo"],
                    "CantidadActual": 0,
                    "Unidades": 0,
                    "Presentaciones": [],
                },
            )
            linea["CantidadActual"] += fila["CantidadActual"]
            linea["Unidades"] += unidades
            linea["Presentaciones"].append(
                PresentacionStockInicio(
                    IdPresentacion=fila["IdPresentacion"],
                    CodigoPresentacion=fila["CodigoPresentacion"],
                    TipoContenedor=fila["TipoContenedor"],
                    CantidadRollosUnidades=fila["CantidadRollosUnidades"],
                    CantidadPorUnidadTerminada=fila["CantidadPorUnidadTerminada"],
                    Activo=activa,
                    CantidadActual=fila["CantidadActual"],
                    Unidades=unidades,
                    StockMinimo=fila["StockMinimo"],
                    StockPreventivo=fila["StockPreventivo"],
                    NivelStock=fila["NivelStock"],
                    FechaUltimoMovimiento=fila["FechaUltimoMovimiento"],
                )
            )

            if activa:
                if fila["CantidadActual"] <= 0:
                    alertas["Agotadas"] += 1
                elif fila["NivelStock"] == NIVEL_STOCK_CRITICO:
                    alertas["Criticas"] += 1
                elif fila["NivelStock"] == NIVEL_STOCK_BAJO:
                    alertas["Bajas"] += 1

            if fila["CantidadActual"] > 0:
                if not activa:
                    inactivas_con_stock.append(_pendiente(fila))
                elif fila["FechaUltimoMovimiento"] is None or fila["FechaUltimoMovimiento"] < limite:
                    sin_movimiento.append(_pendiente(fila))

        control = self.repository.Movimientos(semana.lunes, semana.hoy, MOVIMIENTOS_CONTROL)
        control_anterior = self.repository.Movimientos(
            semana.lunes_anterior, semana.hoy_anterior, MOVIMIENTOS_CONTROL
        )

        def conteo(tipo: int) -> ConteoMovimientoInicio:
            return ConteoMovimientoInicio(
                Registros=_contar(control, tipo),
                RegistrosSemanaAnterior=_contar(control_anterior, tipo),
                Contenedores=sum(
                    int(fila["Cantidad"] or 0) for fila in control if fila["IdTipoMovimientoInventario"] == tipo
                ),
            )

        return InicioInventarioProductoTerminadoResponse(
            FechaInicio=semana.lunes,
            FechaFin=semana.hoy,
            DiasSinMovimiento=DIAS_SIN_MOVIMIENTO_PRODUCTO,
            Alertas=AlertasStockInicio(**alertas),
            UnidadesTotales=sum(linea["Unidades"] for linea in lineas.values()),
            Lineas=[LineaStockInicio(**linea) for linea in lineas.values()],
            AjustesPositivos=conteo(MOVIMIENTO_PT_AJUSTE_POSITIVO),
            AjustesNegativos=conteo(MOVIMIENTO_PT_AJUSTE_NEGATIVO),
            Correcciones=conteo(MOVIMIENTO_PT_DESCUENTO),
            SinMovimiento=sorted(
                sin_movimiento,
                key=lambda p: (p.FechaUltimoMovimiento is not None, p.FechaUltimoMovimiento or semana.ahora),
            ),
            InactivasConStock=inactivas_con_stock,
            UltimosMovimientos=[
                _reciente(fila) for fila in self.repository.UltimosMovimientos(MOVIMIENTOS_RECIENTES_INICIO)
            ],
        )

    def VerProduccion(self) -> InicioProduccionProductoTerminadoResponse:
        semana = semana_inicio()
        movimientos = self.repository.Movimientos(semana.lunes, semana.hoy, MOVIMIENTOS_PRODUCCION)
        anteriores = self.repository.Movimientos(
            semana.lunes_anterior, semana.hoy_anterior, MOVIMIENTOS_PRODUCCION
        )

        def neto(filas: list[dict], unidades: bool) -> int:
            return sum(
                _signo_produccion(fila) * (_unidades_fila(fila) if unidades else int(fila["Cantidad"] or 0))
                for fila in filas
            )

        def ingresos(filas: list[dict]) -> int:
            return sum(1 for fila in filas if fila["IdTipoMovimientoInventario"] in MOVIMIENTOS_INGRESO)

        turnos_catalogo = self.repository.Turnos()
        turnos: dict[str, dict] = {
            turno["NombreTurno"]: {"NombreTurno": turno["NombreTurno"], "Unidades": 0, "Registros": 0}
            for turno in turnos_catalogo
        }
        for fila in movimientos:
            turno = turno_de_hora(turnos_catalogo, fila["FechaMovimiento"].astimezone(self.zona).time())
            nombre = turno["NombreTurno"] if turno else TURNO_SIN_DEFINIR
            registro = turnos.setdefault(nombre, {"NombreTurno": nombre, "Unidades": 0, "Registros": 0})
            registro["Unidades"] += _signo_produccion(fila) * _unidades_fila(fila)
            if fila["IdTipoMovimientoInventario"] in MOVIMIENTOS_INGRESO:
                registro["Registros"] += 1

        return InicioProduccionProductoTerminadoResponse(
            FechaInicio=semana.lunes,
            FechaFin=semana.hoy,
            Indicadores=IndicadoresProduccionProductoTerminado(
                Unidades=neto(movimientos, True),
                UnidadesSemanaAnterior=neto(anteriores, True),
                Contenedores=neto(movimientos, False),
                ContenedoresSemanaAnterior=neto(anteriores, False),
                Ingresos=ingresos(movimientos),
                IngresosSemanaAnterior=ingresos(anteriores),
                Descuentos=_contar(movimientos, MOVIMIENTO_PT_DESCUENTO),
                DescuentosSemanaAnterior=_contar(anteriores, MOVIMIENTO_PT_DESCUENTO),
            ),
            Dias=self._dias(semana, movimientos, _signo_produccion),
            Lineas=self._lineas(movimientos, _signo_produccion),
            Turnos=[TurnoProduccionProductoTerminado(**turno) for turno in turnos.values()],
            UltimosIngresos=[
                _reciente(fila)
                for fila in self.repository.UltimosMovimientos(MOVIMIENTOS_RECIENTES_INICIO, MOVIMIENTOS_PRODUCCION)
            ],
        )

    def _despacho(self, despacho) -> DespachoInicio:
        return DespachoInicio(
            IdDespacho=despacho.IdDespacho,
            FechaMovimiento=despacho.FechaMovimiento,
            Usuario=f"{despacho.PrimerNombre} {despacho.ApellidoPaterno}",
            Observacion=despacho.Observacion,
            NumeroPresentaciones=despacho.NumeroPresentaciones,
            CantidadTotal=despacho.CantidadTotal,
        )

    def VerSalidas(self) -> InicioSalidasProductoTerminadoResponse:
        semana = semana_inicio()
        presentaciones = {fila["IdPresentacion"]: fila for fila in self.repository.Presentaciones()}

        def filas_salida(resumen) -> list[dict]:
            filas = []
            for m in resumen.Movimientos:
                presentacion = presentaciones.get(m.IdPresentacion, {})
                filas.append(
                    {
                        "IdProducto": m.IdProducto,
                        "NombreProducto": m.NombreProducto,
                        "IdPresentacion": m.IdPresentacion,
                        "CodigoPresentacion": m.CodigoPresentacion,
                        "TipoContenedor": presentacion.get("TipoContenedor", ""),
                        "CantidadRollosUnidades": presentacion.get("CantidadRollosUnidades"),
                        "CantidadPorUnidadTerminada": presentacion.get("CantidadPorUnidadTerminada"),
                        "Cantidad": m.Cantidad,
                        "FechaMovimiento": m.FechaMovimiento,
                        "Despacho": (m.FechaMovimiento, m.Ci),
                    }
                )
            return filas

        actual = self.reporte.ResumenSalidas(
            ReporteSalidasProductoTerminadoRequest(FechaInicio=semana.lunes, FechaFin=semana.hoy)
        )
        anterior = self.reporte.ResumenSalidas(
            ReporteSalidasProductoTerminadoRequest(
                FechaInicio=semana.lunes_anterior, FechaFin=semana.hoy_anterior
            )
        )
        filas = filas_salida(actual)
        filas_anteriores = filas_salida(anterior)

        despachos_por_linea: dict[int, set] = {}
        for fila in filas:
            despachos_por_linea.setdefault(fila["IdProducto"], set()).add(fila["Despacho"])

        destacadas: dict[int, dict] = {}
        for fila in filas:
            registro = destacadas.setdefault(
                fila["IdPresentacion"],
                {
                    "IdPresentacion": fila["IdPresentacion"],
                    "NombreProducto": fila["NombreProducto"],
                    "CodigoPresentacion": fila["CodigoPresentacion"],
                    "TipoContenedor": fila["TipoContenedor"],
                    "Contenedores": 0,
                    "Unidades": 0,
                    "CantidadActual": presentaciones.get(fila["IdPresentacion"], {}).get("CantidadActual", 0),
                },
            )
            registro["Contenedores"] += int(fila["Cantidad"] or 0)
            registro["Unidades"] += _unidades_fila(fila)

        id_ultima = self.repository.UltimaSalida()
        ultimo = self._despacho(self.reporte.ReporteDespacho(id_ultima)) if id_ultima else None

        return InicioSalidasProductoTerminadoResponse(
            FechaInicio=semana.lunes,
            FechaFin=semana.hoy,
            Indicadores=IndicadoresSalidasProductoTerminado(
                Despachos=len(actual.Despachos),
                DespachosSemanaAnterior=len(anterior.Despachos),
                Unidades=sum(_unidades_fila(fila) for fila in filas),
                UnidadesSemanaAnterior=sum(_unidades_fila(fila) for fila in filas_anteriores),
                Contenedores=sum(int(fila["Cantidad"] or 0) for fila in filas),
                ContenedoresSemanaAnterior=sum(int(fila["Cantidad"] or 0) for fila in filas_anteriores),
                Presentaciones=len(destacadas),
            ),
            Dias=self._dias(semana, filas, lambda fila: 1),
            Lineas=self._lineas(
                filas,
                lambda fila: 1,
                {id_producto: len(grupo) for id_producto, grupo in despachos_por_linea.items()},
            ),
            PresentacionesDestacadas=sorted(
                (PresentacionDespachadaInicio(**registro) for registro in destacadas.values()),
                key=lambda p: (-p.Unidades, p.CodigoPresentacion),
            )[:PRESENTACIONES_DESTACADAS_INICIO],
            Despachos=[self._despacho(despacho) for despacho in actual.Despachos[:MOVIMIENTOS_RECIENTES_INICIO]],
            UltimoDespacho=ultimo,
        )
