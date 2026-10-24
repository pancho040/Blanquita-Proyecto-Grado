from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.Repository.Consultas import nivel_stock, nombre_operador, visible_en_inventario
from app.Repository.DbCaller import DbCaller
from app.Schemas.Producto import (
    BloqueoProductoTerminado,
    InventarioProductoTerminado,
    MovimientoProductoTerminado,
    PresentacionProducto,
    Producto,
    TipoMovimientoInventario,
)
from app.Schemas.Usuario import Usuario


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

    def ObtenerBloqueoActivo(self) -> dict | None:
        filas = self.caller.Consultar(
            select(
                BloqueoProductoTerminado.IdBloqueoProductoTerminado,
                nombre_operador(Usuario).label("UsuarioBloqueo"),
                BloqueoProductoTerminado.FechaHoraBloqueo,
                BloqueoProductoTerminado.MotivoBloqueo,
                BloqueoProductoTerminado.BloqueaIngreso,
                BloqueoProductoTerminado.BloqueaCorreccion,
                BloqueoProductoTerminado.BloqueaSalida,
            )
            .join(Usuario, Usuario.IdUsuario == BloqueoProductoTerminado.IdUsuarioBloqueo)
            .where(BloqueoProductoTerminado.FechaHoraDesbloqueo.is_(None))
        )
        return filas[0] if filas else None

    def RegistrarBloqueo(
        self,
        id_usuario: int,
        motivo: str,
        bloquea_ingreso: bool,
        bloquea_correccion: bool,
        bloquea_salida: bool,
    ) -> None:
        try:
            self.db.add(
                BloqueoProductoTerminado(
                    IdUsuarioBloqueo=id_usuario,
                    MotivoBloqueo=motivo,
                    BloqueaIngreso=bloquea_ingreso,
                    BloqueaCorreccion=bloquea_correccion,
                    BloqueaSalida=bloquea_salida,
                )
            )
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya hay un bloqueo activo de movimientos de producto terminado",
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo bloquear los movimientos de producto terminado",
            )

    def CerrarBloqueoActivo(self, id_usuario: int) -> bool:
        try:
            bloqueo = self.db.execute(
                select(BloqueoProductoTerminado)
                .where(BloqueoProductoTerminado.FechaHoraDesbloqueo.is_(None))
                .with_for_update()
            ).scalar_one_or_none()
            if bloqueo is None:
                self.db.rollback()
                return False

            bloqueo.IdUsuarioDesbloqueo = id_usuario
            bloqueo.FechaHoraDesbloqueo = func.now()
            self.db.commit()
            return True
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo desbloquear los movimientos de producto terminado",
            )

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
