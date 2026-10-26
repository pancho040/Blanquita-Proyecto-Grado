from datetime import date

from sqlalchemy import Integer, func, select
from sqlalchemy.orm import Session

from app.Constants.Estados import MOVIMIENTO_PT_SALIDA
from app.Repository.Consultas import filtro_rango, listar_turnos, nivel_stock, nombre_operador
from app.Repository.DbCaller import DbCaller
from app.Schemas.Producto import (
    InventarioProductoTerminado,
    MovimientoProductoTerminado,
    PresentacionProducto,
    Producto,
    TipoMovimientoInventario,
)
from app.Schemas.Produccion import Turno
from app.Schemas.Usuario import Usuario


def _consulta_movimientos():
    mpt = MovimientoProductoTerminado
    return (
        select(
            mpt.IdMovimientoProductoTerminado,
            mpt.FechaMovimiento,
            mpt.IdTipoMovimientoInventario,
            TipoMovimientoInventario.NombreTipoMovimientoInventario,
            Producto.IdProducto,
            Producto.NombreProducto,
            PresentacionProducto.IdPresentacion,
            PresentacionProducto.CodigoPresentacion,
            PresentacionProducto.TipoContenedor,
            PresentacionProducto.CantidadRollosUnidades,
            PresentacionProducto.CantidadPorUnidadTerminada,
            mpt.CantidadIngresoInventario.cast(Integer).label("Cantidad"),
            nombre_operador(Usuario).label("Usuario"),
            mpt.IdTurno,
            Turno.NombreTurno,
            mpt.Observacion,
        )
        .join(
            TipoMovimientoInventario,
            TipoMovimientoInventario.IdTipoMovimientoInventario == mpt.IdTipoMovimientoInventario,
        )
        .join(PresentacionProducto, PresentacionProducto.IdPresentacion == mpt.IdPresentacion)
        .join(Producto, Producto.IdProducto == PresentacionProducto.IdProducto)
        .join(Usuario, Usuario.IdUsuario == mpt.IdUsuario)
        .join(Turno, Turno.IdTurno == mpt.IdTurno)
    )


class InicioProductoTerminadoRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def Presentaciones(self) -> list[dict]:
        inventario = InventarioProductoTerminado
        ultimo_movimiento = (
            select(func.max(MovimientoProductoTerminado.FechaMovimiento))
            .where(MovimientoProductoTerminado.IdPresentacion == PresentacionProducto.IdPresentacion)
            .correlate(PresentacionProducto)
            .scalar_subquery()
        )
        cantidad = func.coalesce(inventario.CantidadActual, 0).cast(Integer)
        consulta = (
            select(
                Producto.IdProducto,
                Producto.NombreProducto,
                Producto.Activo.label("ProductoActivo"),
                PresentacionProducto.IdPresentacion,
                PresentacionProducto.CodigoPresentacion,
                PresentacionProducto.TipoContenedor,
                PresentacionProducto.CantidadRollosUnidades,
                PresentacionProducto.CantidadPorUnidadTerminada,
                PresentacionProducto.Activo.label("PresentacionActiva"),
                cantidad.label("CantidadActual"),
                inventario.StockMinimo,
                inventario.StockPreventivo,
                nivel_stock(cantidad, inventario.StockMinimo, inventario.StockPreventivo).label("NivelStock"),
                ultimo_movimiento.label("FechaUltimoMovimiento"),
            )
            .join(Producto, Producto.IdProducto == PresentacionProducto.IdProducto)
            .outerjoin(inventario, inventario.IdPresentacion == PresentacionProducto.IdPresentacion)
            .order_by(Producto.IdProducto, PresentacionProducto.CodigoPresentacion)
        )
        return self.caller.Consultar(consulta)

    def Movimientos(self, fecha_inicio: date, fecha_fin: date, tipos: tuple[int, ...]) -> list[dict]:
        mpt = MovimientoProductoTerminado
        consulta = (
            _consulta_movimientos()
            .where(
                mpt.IdTipoMovimientoInventario.in_(tipos),
                *filtro_rango(mpt.FechaMovimiento, fecha_inicio, fecha_fin),
            )
            .order_by(mpt.FechaMovimiento.desc(), mpt.IdMovimientoProductoTerminado.desc())
        )
        return self.caller.Consultar(consulta)

    def UltimosMovimientos(self, limite: int, tipos: tuple[int, ...] | None = None) -> list[dict]:
        mpt = MovimientoProductoTerminado
        consulta = _consulta_movimientos()
        if tipos:
            consulta = consulta.where(mpt.IdTipoMovimientoInventario.in_(tipos))
        consulta = consulta.order_by(
            mpt.FechaMovimiento.desc(), mpt.IdMovimientoProductoTerminado.desc()
        ).limit(limite)
        return self.caller.Consultar(consulta)

    def UltimaSalida(self) -> int | None:
        mpt = MovimientoProductoTerminado
        filas = self.caller.Consultar(
            select(mpt.IdMovimientoProductoTerminado)
            .where(mpt.IdTipoMovimientoInventario == MOVIMIENTO_PT_SALIDA)
            .order_by(mpt.FechaMovimiento.desc(), mpt.IdMovimientoProductoTerminado.asc())
            .limit(1)
        )
        return filas[0]["IdMovimientoProductoTerminado"] if filas else None

    def Turnos(self) -> list[dict]:
        return listar_turnos(self.caller)
