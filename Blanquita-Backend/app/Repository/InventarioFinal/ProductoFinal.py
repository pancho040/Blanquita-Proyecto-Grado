from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.Repository.DbCaller import DbCaller
from app.Schemas.Producto import (
    InventarioProductoTerminado,
    MovimientoProductoTerminado,
    PresentacionProducto,
    Producto,
)


class ProductoFinalRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def InsertarIngresoProductoTerminado(self, params: dict) -> list[dict]:
        sql = """
            SELECT * FROM "InsertarIngresoProductoTerminado"(
                :p_IdUsuario,
                :p_Presentaciones
            )
        """
        return self.caller.LlamarFuncion(sql, params)

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

    def RegistrarSalida(
        self,
        registros: list[tuple[InventarioProductoTerminado, MovimientoProductoTerminado, int]],
    ) -> list[MovimientoProductoTerminado]:
        try:
            for inventario, movimiento, cantidad_nueva in registros:
                inventario.CantidadActual = cantidad_nueva
                self.db.add(movimiento)

            self.db.commit()
            for _, movimiento, _ in registros:
                self.db.refresh(movimiento)
            return [movimiento for _, movimiento, _ in registros]
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar la salida de producto terminado",
            )

    def Revertir(self) -> None:
        self.db.rollback()

    def CorregirInventarioProductoTerminado(self, params: dict) -> dict | None:
        sql = """
            SELECT * FROM "CorregirInventarioProductoTerminado"(
                :p_IdTipoMovimientoInventario,
                :p_IdPresentacion,
                :p_IdUsuario,
                :p_Cantidad,
                :p_Observacion
            )
        """
        return self.caller.LlamarUnRegistro(sql, params)

    def VerInventarioProductoTerminado(self, params: dict) -> list[dict]:
        sql = """
            SELECT * FROM "VerInventarioProductoTerminado"(
                :p_IdProducto
            )
        """
        return self.caller.LlamarFuncion(sql, params)

    def ObtenerProductos(self) -> list[dict]:
        sql = """
            SELECT "IdProducto", "NombreProducto"
            FROM "Producto"
            ORDER BY "IdProducto"
        """
        return self.caller.LlamarFuncion(sql)