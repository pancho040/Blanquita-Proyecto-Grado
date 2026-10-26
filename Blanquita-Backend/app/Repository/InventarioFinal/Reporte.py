from sqlalchemy import Date, Integer, cast, func, select
from sqlalchemy.orm import Session

from app.Repository.Consultas import ZONA_HORARIA, filtro_rango, listar_turnos
from app.Repository.DbCaller import DbCaller
from app.Schemas.Producto import (
    InventarioProductoTerminado,
    MovimientoProductoTerminado,
    PresentacionProducto,
    Producto,
    TipoMovimientoInventario,
)
from app.Schemas.Produccion import Turno
from app.Schemas.Usuario import Rol, Usuario

TIPO_MOVIMIENTO_ENTRADA = 1
TIPO_MOVIMIENTO_DESCUENTO = 3
TIPO_MOVIMIENTO_AUMENTO = 4
TIPOS_MOVIMIENTO_PRODUCCION = (
    TIPO_MOVIMIENTO_ENTRADA,
    TIPO_MOVIMIENTO_DESCUENTO,
    TIPO_MOVIMIENTO_AUMENTO,
)


class ReporteProductoTerminadoRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def ReporteProduccionDiaria(self, params: dict) -> list[dict]:
        mpt = MovimientoProductoTerminado
        cantidad = cast(mpt.CantidadIngresoInventario, Integer)

        def suma_tipo(id_tipo: int):
            return func.coalesce(
                func.sum(cantidad).filter(mpt.IdTipoMovimientoInventario == id_tipo), 0
            )

        entradas = suma_tipo(TIPO_MOVIMIENTO_ENTRADA)
        aumentos = suma_tipo(TIPO_MOVIMIENTO_AUMENTO)
        descuentos = suma_tipo(TIPO_MOVIMIENTO_DESCUENTO)
        fecha = cast(func.timezone(ZONA_HORARIA, mpt.FechaMovimiento), Date)

        consulta = (
            select(
                fecha.label("Fecha"),
                Producto.IdProducto,
                Producto.NombreProducto,
                PresentacionProducto.IdPresentacion,
                PresentacionProducto.CodigoPresentacion,
                PresentacionProducto.CantidadRollosUnidades,
                entradas.label("Entradas"),
                aumentos.label("Aumentos"),
                descuentos.label("Descuentos"),
                (entradas + aumentos - descuentos).label("Total"),
                func.count(mpt.IdMovimientoProductoTerminado).label("NumeroRegistros"),
            )
            .join(PresentacionProducto, PresentacionProducto.IdPresentacion == mpt.IdPresentacion)
            .join(Producto, Producto.IdProducto == PresentacionProducto.IdProducto)
            .where(
                mpt.IdTipoMovimientoInventario.in_(TIPOS_MOVIMIENTO_PRODUCCION),
                *filtro_rango(
                    mpt.FechaMovimiento, params.get("p_FechaInicio"), params.get("p_FechaFin")
                ),
            )
            .group_by(
                fecha,
                Producto.IdProducto,
                Producto.NombreProducto,
                PresentacionProducto.IdPresentacion,
                PresentacionProducto.CodigoPresentacion,
                PresentacionProducto.CantidadRollosUnidades,
            )
            .order_by(fecha, Producto.IdProducto, PresentacionProducto.IdPresentacion)
        )

        if params.get("p_IdsProducto"):
            consulta = consulta.where(Producto.IdProducto.in_(params["p_IdsProducto"]))
        if params.get("p_IdTurno") is not None:
            consulta = consulta.where(mpt.IdTurno == params["p_IdTurno"])

        return self.caller.Consultar(consulta)

    def Turnos(self) -> list[dict]:
        return listar_turnos(self.caller)

    def ReporteMovimientosProduccion(self, params: dict) -> list[dict]:
        mpt = MovimientoProductoTerminado
        consulta = (
            select(
                mpt.IdMovimientoProductoTerminado,
                mpt.FechaMovimiento,
                Producto.IdProducto,
                Producto.NombreProducto,
                PresentacionProducto.IdPresentacion,
                PresentacionProducto.CodigoPresentacion,
                PresentacionProducto.CantidadRollosUnidades,
                mpt.IdTipoMovimientoInventario,
                TipoMovimientoInventario.NombreTipoMovimientoInventario,
                cast(mpt.CantidadIngresoInventario, Integer).label("Cantidad"),
                Turno.NombreTurno,
                mpt.Observacion,
                Usuario.Ci,
                Usuario.PrimerNombre,
                Usuario.ApellidoPaterno,
                Rol.NombreRol,
            )
            .join(PresentacionProducto, PresentacionProducto.IdPresentacion == mpt.IdPresentacion)
            .join(Producto, Producto.IdProducto == PresentacionProducto.IdProducto)
            .join(
                TipoMovimientoInventario,
                TipoMovimientoInventario.IdTipoMovimientoInventario == mpt.IdTipoMovimientoInventario,
            )
            .join(Usuario, Usuario.IdUsuario == mpt.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .join(Turno, Turno.IdTurno == mpt.IdTurno)
            .where(
                mpt.IdTipoMovimientoInventario.in_(TIPOS_MOVIMIENTO_PRODUCCION),
                *filtro_rango(
                    mpt.FechaMovimiento, params.get("p_FechaInicio"), params.get("p_FechaFin")
                ),
            )
            .order_by(mpt.FechaMovimiento.desc(), mpt.IdMovimientoProductoTerminado.desc())
        )

        if params.get("p_IdsProducto"):
            consulta = consulta.where(Producto.IdProducto.in_(params["p_IdsProducto"]))
        if params.get("p_IdTurno") is not None:
            consulta = consulta.where(mpt.IdTurno == params["p_IdTurno"])

        return self.caller.Consultar(consulta)

    def ReporteInventario(self, params: dict) -> list[dict]:
        ultimo = (
            select(
                MovimientoProductoTerminado.IdPresentacion,
                func.max(MovimientoProductoTerminado.FechaMovimiento).label("FechaUltimoMovimiento"),
            )
            .group_by(MovimientoProductoTerminado.IdPresentacion)
            .subquery()
        )
        consulta = (
            select(
                Producto.IdProducto,
                Producto.NombreProducto,
                PresentacionProducto.IdPresentacion,
                PresentacionProducto.CodigoPresentacion,
                PresentacionProducto.TipoContenedor,
                PresentacionProducto.CantidadRollosUnidades,
                PresentacionProducto.CantidadPorUnidadTerminada,
                cast(func.coalesce(InventarioProductoTerminado.CantidadActual, 0), Integer).label(
                    "CantidadActual"
                ),
                ultimo.c.FechaUltimoMovimiento,
            )
            .join(Producto, Producto.IdProducto == PresentacionProducto.IdProducto)
            .outerjoin(
                InventarioProductoTerminado,
                InventarioProductoTerminado.IdPresentacion == PresentacionProducto.IdPresentacion,
            )
            .outerjoin(ultimo, ultimo.c.IdPresentacion == PresentacionProducto.IdPresentacion)
            .order_by(Producto.IdProducto, PresentacionProducto.IdPresentacion)
        )

        if params.get("p_IdsProducto"):
            consulta = consulta.where(Producto.IdProducto.in_(params["p_IdsProducto"]))

        return self.caller.Consultar(consulta)

    def _ConsultaSalidas(self, id_tipo_movimiento: int):
        mpt = MovimientoProductoTerminado

        return (
            select(
                mpt.IdMovimientoProductoTerminado,
                mpt.FechaMovimiento,
                Producto.IdProducto,
                Producto.NombreProducto,
                PresentacionProducto.IdPresentacion,
                PresentacionProducto.CodigoPresentacion,
                PresentacionProducto.CantidadRollosUnidades,
                mpt.CantidadIngresoInventario.cast(Integer).label("Cantidad"),
                mpt.Observacion,
                Usuario.Ci,
                Usuario.PrimerNombre,
                Usuario.ApellidoPaterno,
                Rol.NombreRol,
            )
            .join(PresentacionProducto, mpt.IdPresentacion == PresentacionProducto.IdPresentacion)
            .join(Producto, PresentacionProducto.IdProducto == Producto.IdProducto)
            .join(Usuario, mpt.IdUsuario == Usuario.IdUsuario)
            .join(Rol, Usuario.IdRol == Rol.IdRol)
            .where(mpt.IdTipoMovimientoInventario == id_tipo_movimiento)
        )

    def MovimientosSalida(self, params: dict) -> list[dict]:
        mpt = MovimientoProductoTerminado

        consulta = (
            self._ConsultaSalidas(params["p_IdTipoMovimientoInventario"])
            .where(
                *filtro_rango(
                    mpt.FechaMovimiento, params.get("p_FechaInicio"), params.get("p_FechaFin")
                )
            )
            .order_by(mpt.FechaMovimiento.desc(), mpt.IdMovimientoProductoTerminado.asc())
        )

        if params.get("p_IdsProducto"):
            consulta = consulta.where(Producto.IdProducto.in_(params["p_IdsProducto"]))

        return self.caller.Consultar(consulta)

    def StockPresentaciones(self, ids_presentacion: list[int]) -> dict[int, int]:
        if not ids_presentacion:
            return {}

        filas = self.caller.Consultar(
            select(
                InventarioProductoTerminado.IdPresentacion,
                InventarioProductoTerminado.CantidadActual.cast(Integer).label("CantidadActual"),
            ).where(InventarioProductoTerminado.IdPresentacion.in_(ids_presentacion))
        )
        return {fila["IdPresentacion"]: fila["CantidadActual"] for fila in filas}

    def DespachoSalida(self, params: dict) -> list[dict]:
        mpt = MovimientoProductoTerminado
        id_tipo = params["p_IdTipoMovimientoInventario"]

        referencia = (
            select(mpt.FechaMovimiento, mpt.IdUsuario)
            .where(
                mpt.IdMovimientoProductoTerminado == params["p_IdMovimiento"],
                mpt.IdTipoMovimientoInventario == id_tipo,
            )
            .subquery()
        )

        consulta = (
            self._ConsultaSalidas(id_tipo)
            .join(
                referencia,
                (mpt.FechaMovimiento == referencia.c.FechaMovimiento)
                & (mpt.IdUsuario == referencia.c.IdUsuario),
            )
            .order_by(mpt.IdMovimientoProductoTerminado.asc())
        )

        return self.caller.Consultar(consulta)
