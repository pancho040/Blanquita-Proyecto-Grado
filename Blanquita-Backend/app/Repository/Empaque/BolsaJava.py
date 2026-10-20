from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.Repository.Consultas import nivel_stock
from app.Repository.DbCaller import DbCaller
from app.Schemas.Empaque import (
    InventarioBolsaJava,
    LoteEmpaque,
    MovimientoBolsaJava,
    TipoBolsaJava,
)
from app.Schemas.Proveedor import Proveedor


class BolsaJavaRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def VerInventario(self) -> list[dict]:
        consulta = (
            select(
                InventarioBolsaJava.IdInventarioBolsaJava,
                InventarioBolsaJava.IdTipoBolsaJava,
                InventarioBolsaJava.CantidadActual,
                TipoBolsaJava.NombreBolsaJava,
                TipoBolsaJava.DescripcionBolsaJava,
                TipoBolsaJava.Activo,
                InventarioBolsaJava.StockMinimo,
                InventarioBolsaJava.StockPreventivo,
                nivel_stock(InventarioBolsaJava.CantidadActual, InventarioBolsaJava.StockMinimo, InventarioBolsaJava.StockPreventivo).label("NivelStock"),
            )
            .join(
                TipoBolsaJava,
                InventarioBolsaJava.IdTipoBolsaJava == TipoBolsaJava.IdTipoBolsaJava,
            )
            .order_by(TipoBolsaJava.NombreBolsaJava)
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
        self, ids_tipo_bolsa_java: list[int]
    ) -> dict[int, tuple[InventarioBolsaJava, TipoBolsaJava]]:
        try:
            filas = self.db.execute(
                select(InventarioBolsaJava, TipoBolsaJava)
                .join(
                    TipoBolsaJava,
                    InventarioBolsaJava.IdTipoBolsaJava == TipoBolsaJava.IdTipoBolsaJava,
                )
                .where(InventarioBolsaJava.IdTipoBolsaJava.in_(ids_tipo_bolsa_java))
                .order_by(
                    InventarioBolsaJava.IdTipoBolsaJava,
                    InventarioBolsaJava.IdInventarioBolsaJava,
                )
                .with_for_update(of=InventarioBolsaJava)
            ).all()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener el inventario de bolsas de jaba",
            )

        inventarios: dict[int, tuple[InventarioBolsaJava, TipoBolsaJava]] = {}
        for inventario, tipo in filas:
            inventarios.setdefault(inventario.IdTipoBolsaJava, (inventario, tipo))
        return inventarios

    def RegistrarIngreso(
        self,
        lote: LoteEmpaque,
        registros: list[tuple[InventarioBolsaJava, MovimientoBolsaJava, int]],
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
                detail="No se pudo registrar el lote de bolsas de jaba",
            )

    def RegistrarMovimiento(
        self,
        inventario: InventarioBolsaJava,
        movimiento: MovimientoBolsaJava,
        cantidad_nueva: int,
    ) -> MovimientoBolsaJava:
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
                detail="No se pudo registrar el movimiento de la bolsa de jaba",
            )

    def Revertir(self) -> None:
        self.db.rollback()
