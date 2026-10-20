from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.Repository.Consultas import nivel_stock
from app.Repository.DbCaller import DbCaller
from app.Schemas.Empaque import (
    InventarioEmpaqueBolsa,
    LoteEmpaque,
    MovimientoEmpaqueBolsa,
    TipoEmpaqueBolsa,
)
from app.Schemas.Proveedor import Proveedor


class EmpaqueBolsaRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def VerInventario(self) -> list[dict]:
        consulta = (
            select(
                InventarioEmpaqueBolsa.IdInventarioEmpaqueBolsa,
                InventarioEmpaqueBolsa.IdTipoEmpaqueBolsa,
                InventarioEmpaqueBolsa.CantidadActual,
                TipoEmpaqueBolsa.NombreEmpaqueBolsa,
                TipoEmpaqueBolsa.DescripcionEmpaqueBolsa,
                TipoEmpaqueBolsa.Activo,
                InventarioEmpaqueBolsa.StockMinimo,
                InventarioEmpaqueBolsa.StockPreventivo,
                nivel_stock(InventarioEmpaqueBolsa.CantidadActual, InventarioEmpaqueBolsa.StockMinimo, InventarioEmpaqueBolsa.StockPreventivo).label("NivelStock"),
            )
            .join(
                TipoEmpaqueBolsa,
                InventarioEmpaqueBolsa.IdTipoEmpaqueBolsa == TipoEmpaqueBolsa.IdTipoEmpaqueBolsa,
            )
            .order_by(TipoEmpaqueBolsa.NombreEmpaqueBolsa)
        )
        return self.caller.Consultar(consulta)

    def ObtenerProveedor(self, id_proveedor: int) -> dict | None:
        filas = self.caller.Consultar(
            select(
                Proveedor.IdProveedor,
                Proveedor.NombreProveedor,
                Proveedor.Activo,
            ).where(Proveedor.IdProveedor == id_proveedor)
        )
        return filas[0] if filas else None

    def ObtenerInventariosBloqueados(
        self, ids_tipo_empaque_bolsa: list[int]
    ) -> dict[int, tuple[InventarioEmpaqueBolsa, TipoEmpaqueBolsa]]:
        try:
            filas = self.db.execute(
                select(InventarioEmpaqueBolsa, TipoEmpaqueBolsa)
                .join(
                    TipoEmpaqueBolsa,
                    InventarioEmpaqueBolsa.IdTipoEmpaqueBolsa == TipoEmpaqueBolsa.IdTipoEmpaqueBolsa,
                )
                .where(InventarioEmpaqueBolsa.IdTipoEmpaqueBolsa.in_(ids_tipo_empaque_bolsa))
                .order_by(
                    InventarioEmpaqueBolsa.IdTipoEmpaqueBolsa,
                    InventarioEmpaqueBolsa.IdInventarioEmpaqueBolsa,
                )
                .with_for_update(of=InventarioEmpaqueBolsa)
            ).all()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener el inventario de empaques bolsa",
            )

        inventarios: dict[int, tuple[InventarioEmpaqueBolsa, TipoEmpaqueBolsa]] = {}
        for inventario, tipo in filas:
            inventarios.setdefault(inventario.IdTipoEmpaqueBolsa, (inventario, tipo))
        return inventarios

    def RegistrarIngreso(
        self,
        lote: LoteEmpaque,
        registros: list[tuple[InventarioEmpaqueBolsa, MovimientoEmpaqueBolsa, int]],
        observacion,
    ) -> LoteEmpaque:
        try:
            self.db.add(lote)
            self.db.flush()

            for inventario, movimiento, cantidad_nueva in registros:
                movimiento.IdLoteEmpaque = lote.IdLoteEmpaque
                movimiento.Observacion = observacion(lote)
                inventario.CantidadActual = cantidad_nueva
                self.db.add(movimiento)

            self.db.commit()
            self.db.refresh(lote)
            for _, movimiento, _ in registros:
                self.db.refresh(movimiento)
            return lote
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el lote de empaques bolsa",
            )

    def RegistrarMovimiento(
        self,
        inventario: InventarioEmpaqueBolsa,
        movimiento: MovimientoEmpaqueBolsa,
        cantidad_nueva: int,
    ) -> MovimientoEmpaqueBolsa:
        try:
            inventario.CantidadActual = cantidad_nueva
            self.db.add(movimiento)
            self.db.commit()
            self.db.refresh(movimiento)
            return movimiento
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el movimiento del empaque bolsa",
            )

    def Revertir(self) -> None:
        self.db.rollback()
