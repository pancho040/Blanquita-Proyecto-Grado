from sqlalchemy import Integer, select
from sqlalchemy.orm import Session

from app.Repository.Consultas import filtro_rango
from app.Repository.DbCaller import DbCaller
from app.Schemas.Producto import (
    InventarioProductoTerminado,
    MovimientoProductoTerminado,
    PresentacionProducto,
    Producto,
)
from app.Schemas.Usuario import Rol, Usuario


class ReporteProductoTerminadoRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def ReporteProduccionDiaria(self, params: dict) -> list[dict]:
        sql = """
            SELECT * FROM "ReporteProduccionDiariaProductoTerminado"(
                :p_FechaInicio,
                :p_FechaFin,
                CAST(:p_IdsProducto AS integer[])
            )
        """
        return self.caller.LlamarFuncion(sql, params)

    def ReporteMovimientosProduccion(self, params: dict) -> list[dict]:
        sql = """
            SELECT * FROM "ReporteMovimientosProduccionProductoTerminado"(
                :p_FechaInicio,
                :p_FechaFin,
                CAST(:p_IdsProducto AS integer[])
            )
        """
        return self.caller.LlamarFuncion(sql, params)

    def ReporteInventario(self, params: dict) -> list[dict]:
        sql = """
            SELECT * FROM "ReporteInventarioProductoTerminado"(
                CAST(:p_IdsProducto AS integer[])
            )
        """
        return self.caller.LlamarFuncion(sql, params)

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
