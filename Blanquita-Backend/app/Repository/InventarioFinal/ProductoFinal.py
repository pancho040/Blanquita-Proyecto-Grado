from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.Repository.Consultas import nivel_stock, visible_en_inventario
from app.Repository.DbCaller import DbCaller
from app.Schemas.Producto import (
    InventarioProductoTerminado,
    MovimientoProductoTerminado,
    PresentacionProducto,
    Producto,
    TipoMovimientoInventario,
)


class ProductoFinalRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def ObtenerPresentaciones(
        self, ids_presentacion: list[int]
    ) -> dict[int, tuple[PresentacionProducto, Producto]]:
        try:
            filas = self.db.execute(
                select(PresentacionProducto, Producto)
                .join(Producto, PresentacionProducto.IdProducto == Producto.IdProducto)
                .where(PresentacionProducto.IdPresentacion.in_(ids_presentacion))
            ).all()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener las presentaciones de producto terminado",
            )
        return {presentacion.IdPresentacion: (presentacion, producto) for presentacion, producto in filas}

    def ObtenerInventariosBloqueados(
        self, ids_presentacion: list[int]
    ) -> dict[int, tuple[InventarioProductoTerminado, PresentacionProducto, Producto]]:
        try:
            filas = self.db.execute(
                select(InventarioProductoTerminado, PresentacionProducto, Producto)
                .join(
                    PresentacionProducto,
                    InventarioProductoTerminado.IdPresentacion == PresentacionProducto.IdPresentacion,
                )
                .join(Producto, PresentacionProducto.IdProducto == Producto.IdProducto)
                .where(InventarioProductoTerminado.IdPresentacion.in_(ids_presentacion))
                .order_by(InventarioProductoTerminado.IdPresentacion)
                .with_for_update(of=InventarioProductoTerminado)
            ).all()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener el inventario de producto terminado",
            )

        return {
            inventario.IdPresentacion: (inventario, presentacion, producto)
            for inventario, presentacion, producto in filas
        }

    def NombreTipoMovimiento(self, id_tipo_movimiento: int) -> str:
        filas = self.caller.Consultar(
            select(TipoMovimientoInventario.NombreTipoMovimientoInventario).where(
                TipoMovimientoInventario.IdTipoMovimientoInventario == id_tipo_movimiento
            )
        )
        return filas[0]["NombreTipoMovimientoInventario"] if filas else ""

    def RegistrarMovimientos(
        self,
        registros: list[tuple[InventarioProductoTerminado, MovimientoProductoTerminado, int]],
        mensaje_error: str,
    ) -> list[MovimientoProductoTerminado]:
        try:
            for inventario, movimiento, cantidad_nueva in registros:
                inventario.CantidadActual = cantidad_nueva
                self.db.add(inventario)
                self.db.add(movimiento)

            self.db.commit()
            for _, movimiento, _ in registros:
                self.db.refresh(movimiento)
            return [movimiento for _, movimiento, _ in registros]
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=mensaje_error,
            )

    def Revertir(self) -> None:
        self.db.rollback()

    def VerInventarioProductoTerminado(self, id_producto: int | None) -> list[dict]:
        consulta = (
            select(
                PresentacionProducto.IdPresentacion,
                PresentacionProducto.CodigoPresentacion,
                Producto.NombreProducto,
                PresentacionProducto.TipoContenedor,
                PresentacionProducto.CantidadRollosUnidades,
                PresentacionProducto.CantidadPorUnidadTerminada,
                InventarioProductoTerminado.CantidadActual,
                and_(Producto.Activo, PresentacionProducto.Activo).label("Activo"),
                InventarioProductoTerminado.StockMinimo,
                InventarioProductoTerminado.StockPreventivo,
                nivel_stock(InventarioProductoTerminado.CantidadActual, InventarioProductoTerminado.StockMinimo, InventarioProductoTerminado.StockPreventivo).label("NivelStock"),
            )
            .join(
                PresentacionProducto,
                PresentacionProducto.IdPresentacion == InventarioProductoTerminado.IdPresentacion,
            )
            .join(Producto, Producto.IdProducto == PresentacionProducto.IdProducto)
            .where(
                visible_en_inventario(
                    and_(Producto.Activo, PresentacionProducto.Activo),
                    InventarioProductoTerminado.CantidadActual,
                )
            )
            .order_by(Producto.NombreProducto, PresentacionProducto.CodigoPresentacion)
        )
        if id_producto is not None:
            consulta = consulta.where(Producto.IdProducto == id_producto)
        return self.caller.Consultar(consulta)

    def ObtenerProductos(self) -> list[dict]:
        consulta = select(
            Producto.IdProducto,
            Producto.NombreProducto,
            Producto.IdTipoBobina,
            Producto.IdTipoBobinaServilleta,
            Producto.Activo,
        ).order_by(Producto.IdProducto)
        return self.caller.Consultar(consulta)
