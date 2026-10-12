from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.Constants.Cantidades import DIAS_MAXIMOS_REPORTE_PRODUCCION
from app.Models.InventarioFinal.Reporte import (
    ReporteProduccionDiariaProductoTerminadoRequest,
    ReporteProduccionDiariaProductoTerminadoResponse,
    ProduccionPresentacionResponse,
    ProduccionLineaResponse,
    ProduccionDiaResponse,
    MovimientoProduccionProductoTerminadoResponse,
    ReporteInventarioProductoTerminadoRequest,
    ReporteInventarioProductoTerminadoResponse,
    InventarioLineaResponse,
    InventarioPresentacionResponse,
    ReporteSalidasProductoTerminadoRequest,
    ReporteSalidasProductoTerminadoResponse,
    SalidaLineaResponse,
    SalidaPresentacionResponse,
    MovimientoSalidaProductoTerminadoResponse,
)
from app.Repository.InventarioFinal.ProductoFinal import ProductoFinalRepository
from app.Repository.InventarioFinal.Reporte import ReporteProductoTerminadoRepository
from app.utils.dates import ZONA_BOLIVIA

ID_TIPO_MOVIMIENTO_SALIDA = 2
ID_PRODUCTO_MERMA = 6
# Mega Rollo, Económico y Merma se cuentan en unidades; el resto de líneas en jabas.
IDS_PRODUCTO_EN_UNIDADES = {4, 5, ID_PRODUCTO_MERMA}

CAMPOS_PRODUCCION = ("Entradas", "Aumentos", "Descuentos", "Total", "NumeroRegistros")


def _nombre_presentacion(nombre_producto: str, cantidad_rollos_unidades: int | None) -> str:
    """'Luxury' y 24 -> 'Luxury 24'. Las presentaciones de una sola unidad
    (merma) quedan solo con el nombre; el código las diferencia."""
    if not cantidad_rollos_unidades or cantidad_rollos_unidades == 1:
        return nombre_producto
    return f"{nombre_producto} {cantidad_rollos_unidades}"


def _unidad_linea(id_producto: int) -> str:
    return "unidades" if id_producto in IDS_PRODUCTO_EN_UNIDADES else "jabas"


class ReporteProductoTerminadoService:
    def __init__(self, db: Session):
        self.repository = ReporteProductoTerminadoRepository(db)
        self.producto_repository = ProductoFinalRepository(db)

    def ReporteProduccionDiaria(
        self, data: ReporteProduccionDiariaProductoTerminadoRequest
    ) -> ReporteProduccionDiariaProductoTerminadoResponse:
        resumen = self.ResumenProduccionDiaria(data)

        if not any(linea.NumeroRegistros for linea in resumen.Lineas):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se registró producción en el período y las líneas seleccionadas",
            )

        if data.VerMovimientos:
            resumen.Movimientos = self._ObtenerMovimientos(
                self._ParametrosPeriodo(data)
            )

        return resumen

    def ResumenProduccionDiaria(
        self, data: ReporteProduccionDiariaProductoTerminadoRequest
    ) -> ReporteProduccionDiariaProductoTerminadoResponse:
        if data.FechaInicio > data.FechaFin:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="La fecha de inicio no puede ser posterior a la fecha de fin",
            )

        dias_periodo = (data.FechaFin - data.FechaInicio).days + 1
        if dias_periodo > DIAS_MAXIMOS_REPORTE_PRODUCCION:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El rango de fechas no puede superar los {DIAS_MAXIMOS_REPORTE_PRODUCCION} días",
            )

        lineas_solicitadas, todas_las_lineas = self._LineasSolicitadas(data.IdsProducto)

        filas = self.repository.ReporteProduccionDiaria(self._ParametrosPeriodo(data))

        presentaciones: dict[int, dict[int, dict]] = defaultdict(dict)
        dias_con_produccion: dict[int, set[date]] = defaultdict(set)
        produccion_por_dia: dict[date, dict[int, int]] = defaultdict(
            lambda: defaultdict(int)
        )

        for fila in filas:
            id_producto = fila["IdProducto"]

            acumulado = presentaciones[id_producto].setdefault(
                fila["IdPresentacion"],
                {
                    "IdPresentacion": fila["IdPresentacion"],
                    "CodigoPresentacion": fila["CodigoPresentacion"],
                    "NombrePresentacion": _nombre_presentacion(
                        fila["NombreProducto"], fila["CantidadRollosUnidades"]
                    ),
                    **{campo: 0 for campo in CAMPOS_PRODUCCION},
                },
            )
            for campo in CAMPOS_PRODUCCION:
                acumulado[campo] += fila[campo]

            if fila["Entradas"] > 0:
                dias_con_produccion[id_producto].add(fila["Fecha"])

            produccion_por_dia[fila["Fecha"]][id_producto] += fila["Total"]

        lineas = [
            self._ConstruirLinea(
                producto,
                presentaciones[producto["IdProducto"]],
                dias_con_produccion[producto["IdProducto"]],
            )
            for producto in lineas_solicitadas
        ]

        return ReporteProduccionDiariaProductoTerminadoResponse(
            PeriodoInicio=data.FechaInicio,
            PeriodoFin=data.FechaFin,
            DiasPeriodo=dias_periodo,
            DiasConProduccion=len(set().union(*dias_con_produccion.values())),
            TodasLasLineas=todas_las_lineas,
            Lineas=lineas,
            ProduccionPorDia=[
                ProduccionDiaResponse(Fecha=fecha, TotalesPorLinea=dict(totales))
                for fecha, totales in sorted(produccion_por_dia.items())
            ],
        )

    def ReporteInventario(
        self, data: ReporteInventarioProductoTerminadoRequest
    ) -> ReporteInventarioProductoTerminadoResponse:
        lineas_solicitadas, todas_las_lineas = self._LineasSolicitadas(data.IdsProducto)

        filas = self.repository.ReporteInventario(
            {"p_IdsProducto": data.IdsProducto or None}
        )

        if not filas:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No hay presentaciones registradas para las líneas seleccionadas",
            )

        presentaciones: dict[int, list[InventarioPresentacionResponse]] = defaultdict(list)
        for fila in filas:
            presentaciones[fila["IdProducto"]].append(
                InventarioPresentacionResponse(
                    **fila,
                    NombrePresentacion=_nombre_presentacion(
                        fila["NombreProducto"], fila["CantidadRollosUnidades"]
                    ),
                )
            )

        lineas = []
        for producto in lineas_solicitadas:
            presentaciones_linea = presentaciones[producto["IdProducto"]]
            lineas.append(
                InventarioLineaResponse(
                    IdProducto=producto["IdProducto"],
                    NombreProducto=producto["NombreProducto"],
                    Unidad=_unidad_linea(producto["IdProducto"]),
                    Total=sum(p.CantidadActual for p in presentaciones_linea),
                    Presentaciones=presentaciones_linea,
                )
            )

        return ReporteInventarioProductoTerminadoResponse(
            FechaGeneracion=datetime.now(ZONA_BOLIVIA),
            TodasLasLineas=todas_las_lineas,
            Lineas=lineas,
        )

    def _LineasSolicitadas(
        self, ids_producto: list[int] | None
    ) -> tuple[list[dict], bool]:
        productos = self.producto_repository.ObtenerProductos()
        ids_solicitados = set(ids_producto or [])

        if ids_solicitados - {p["IdProducto"] for p in productos}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Una o más líneas seleccionadas no existen",
            )

        lineas = sorted(
            (
                p
                for p in productos
                if not ids_solicitados or p["IdProducto"] in ids_solicitados
            ),
            key=lambda p: (p["IdProducto"] == ID_PRODUCTO_MERMA, p["IdProducto"]),
        )

        return lineas, len(lineas) == len(productos)

    def _ParametrosPeriodo(
        self, data: ReporteProduccionDiariaProductoTerminadoRequest
    ) -> dict:
        return {
            "p_FechaInicio": data.FechaInicio,
            "p_FechaFin": data.FechaFin,
            "p_IdsProducto": data.IdsProducto or None,
        }

    def _ConstruirLinea(
        self,
        producto: dict,
        presentaciones: dict[int, dict],
        dias_con_produccion: set[date],
    ) -> ProduccionLineaResponse:
        filas_presentacion = [
            ProduccionPresentacionResponse(
                **acumulado,
                Correcciones=acumulado["Aumentos"] - acumulado["Descuentos"],
            )
            for _, acumulado in sorted(presentaciones.items())
        ]
        total = sum(p.Total for p in filas_presentacion)
        dias = len(dias_con_produccion)

        return ProduccionLineaResponse(
            IdProducto=producto["IdProducto"],
            NombreProducto=producto["NombreProducto"],
            Unidad=_unidad_linea(producto["IdProducto"]),
            Entradas=sum(p.Entradas for p in filas_presentacion),
            Correcciones=sum(p.Correcciones for p in filas_presentacion),
            Total=total,
            NumeroRegistros=sum(p.NumeroRegistros for p in filas_presentacion),
            DiasConProduccion=dias,
            PromedioPorDia=(
                (Decimal(total) / dias).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                if dias
                else None
            ),
            Presentaciones=filas_presentacion,
        )

    def _ObtenerMovimientos(
        self, params: dict
    ) -> list[MovimientoProduccionProductoTerminadoResponse]:
        filas = self.repository.ReporteMovimientosProduccion(params)

        return [
            MovimientoProduccionProductoTerminadoResponse(
                **fila,
                NombrePresentacion=_nombre_presentacion(
                    fila["NombreProducto"], fila["CantidadRollosUnidades"]
                ),
            )
            for fila in filas
        ]

    def ResumenSalidas(
        self, data: ReporteSalidasProductoTerminadoRequest
    ) -> ReporteSalidasProductoTerminadoResponse:
        self._ValidarPeriodo(data.FechaInicio, data.FechaFin)
        lineas_solicitadas, todas_las_lineas = self._LineasSolicitadas(data.IdsProducto)

        movimientos = [
            MovimientoSalidaProductoTerminadoResponse(
                **fila,
                NombrePresentacion=_nombre_presentacion(
                    fila["NombreProducto"], fila["CantidadRollosUnidades"]
                ),
                Unidad=_unidad_linea(fila["IdProducto"]),
            )
            for fila in self.repository.MovimientosSalida(
                {
                    "p_IdTipoMovimientoInventario": ID_TIPO_MOVIMIENTO_SALIDA,
                    "p_FechaInicio": data.FechaInicio,
                    "p_FechaFin": data.FechaFin,
                    "p_IdsProducto": data.IdsProducto or None,
                }
            )
        ]

        presentaciones: dict[int, dict] = {}
        for m in movimientos:
            acumulado = presentaciones.setdefault(
                m.IdPresentacion,
                {
                    "IdProducto": m.IdProducto,
                    "NombreProducto": m.NombreProducto,
                    "Unidad": m.Unidad,
                    "IdPresentacion": m.IdPresentacion,
                    "CodigoPresentacion": m.CodigoPresentacion,
                    "NombrePresentacion": m.NombrePresentacion,
                    "CantidadSalida": 0,
                    "NumeroSalidas": 0,
                },
            )
            acumulado["CantidadSalida"] += m.Cantidad
            acumulado["NumeroSalidas"] += 1

        stock = self.repository.StockPresentaciones(list(presentaciones))
        orden_lineas = {p["IdProducto"]: i for i, p in enumerate(lineas_solicitadas)}

        filas_presentacion = sorted(
            (
                SalidaPresentacionResponse(**acumulado, CantidadActual=stock.get(id_presentacion, 0))
                for id_presentacion, acumulado in presentaciones.items()
            ),
            key=lambda p: (orden_lineas.get(p.IdProducto, len(orden_lineas)), p.CodigoPresentacion),
        )

        lineas = []
        for producto in lineas_solicitadas:
            propias = [p for p in filas_presentacion if p.IdProducto == producto["IdProducto"]]
            if not propias:
                continue
            lineas.append(
                SalidaLineaResponse(
                    IdProducto=producto["IdProducto"],
                    NombreProducto=producto["NombreProducto"],
                    Unidad=_unidad_linea(producto["IdProducto"]),
                    CantidadSalida=sum(p.CantidadSalida for p in propias),
                    NumeroSalidas=sum(p.NumeroSalidas for p in propias),
                )
            )

        return ReporteSalidasProductoTerminadoResponse(
            PeriodoInicio=data.FechaInicio,
            PeriodoFin=data.FechaFin,
            TodasLasLineas=todas_las_lineas,
            NombresLineas=[p["NombreProducto"] for p in lineas_solicitadas],
            NumeroSalidas=len(movimientos),
            Lineas=lineas,
            Presentaciones=filas_presentacion,
            Movimientos=movimientos,
        )

    def ReporteSalidas(
        self, data: ReporteSalidasProductoTerminadoRequest
    ) -> ReporteSalidasProductoTerminadoResponse:
        resumen = self.ResumenSalidas(data)

        if not resumen.Movimientos:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se registraron salidas de producto terminado en el período y las líneas seleccionadas",
            )

        return resumen

    def _ValidarPeriodo(self, fecha_inicio: date, fecha_fin: date) -> None:
        if fecha_inicio > fecha_fin:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="La fecha de inicio no puede ser posterior a la fecha de fin",
            )

        if (fecha_fin - fecha_inicio).days + 1 > DIAS_MAXIMOS_REPORTE_PRODUCCION:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El rango de fechas no puede superar los {DIAS_MAXIMOS_REPORTE_PRODUCCION} días",
            )
