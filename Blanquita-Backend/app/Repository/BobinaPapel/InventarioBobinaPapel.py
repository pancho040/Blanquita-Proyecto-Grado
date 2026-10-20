from fastapi import HTTPException, status
from sqlalchemy import Text, and_, cast, func, select, true
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.Constants.Estados import (
    ESTADO_MATERIA_PRIMA_EN_ALMACEN,
    ESTADO_MATERIA_PRIMA_FUERA_INVENTARIO,
    MOVIMIENTO_MATERIA_PRIMA_REINGRESO,
)
from app.Repository.Consultas import nivel_stock
from app.Repository.DbCaller import DbCaller
from app.Schemas.BobinaPapel import BobinaPapel, LoteBobina, MovimientoBobina, TipoBobina
from app.Schemas.Proveedor import Proveedor


class InventarioBobinaPapelRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def VerResumen(self) -> list[dict]:
        cantidad = func.count(BobinaPapel.IdBobinaPapel)
        consulta = (
            select(
                TipoBobina.IdTipoBobina,
                TipoBobina.NombreTipoBobina,
                TipoBobina.Activo,
                cantidad.label("CantidadBobinas"),
                func.coalesce(func.sum(BobinaPapel.PesoNetoKg), 0).label("PesoNetoTotalKg"),
                func.coalesce(func.avg(BobinaPapel.Gramaje), 0).label("GramajePromedio"),
                TipoBobina.StockMinimo,
                TipoBobina.StockPreventivo,
                nivel_stock(cantidad, TipoBobina.StockMinimo, TipoBobina.StockPreventivo).label("NivelStock"),
            )
            .outerjoin(
                BobinaPapel,
                and_(
                    BobinaPapel.IdTipoBobina == TipoBobina.IdTipoBobina,
                    BobinaPapel.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN,
                ),
            )
            .group_by(
                TipoBobina.IdTipoBobina,
                TipoBobina.NombreTipoBobina,
                TipoBobina.Activo,
                TipoBobina.StockMinimo,
                TipoBobina.StockPreventivo,
            )
            .order_by(TipoBobina.IdTipoBobina)
        )
        return self.caller.Consultar(consulta)

    def VerDetalle(self, id_tipo_bobina: int) -> list[dict]:
        reingresos = (
            select(
                MovimientoBobina.IdBobinaPapel,
                func.max(MovimientoBobina.FechaMovimiento).label("FechaUltimoReingreso"),
            )
            .where(MovimientoBobina.IdTipoMovimiento == MOVIMIENTO_MATERIA_PRIMA_REINGRESO)
            .group_by(MovimientoBobina.IdBobinaPapel)
            .subquery()
        )
        consulta = (
            select(
                BobinaPapel.IdBobinaPapel,
                BobinaPapel.CodigoBobina,
                func.concat("L-", func.lpad(cast(LoteBobina.IdLoteBobina, Text), 4, "0")).label(
                    "CodigoLote"
                ),
                LoteBobina.FechaRecepcion,
                Proveedor.NombreProveedor,
                BobinaPapel.PesoBrutoKg,
                BobinaPapel.PesoNetoKg,
                BobinaPapel.Gramaje,
                reingresos.c.FechaUltimoReingreso.is_not(None).label("Reingresada"),
                reingresos.c.FechaUltimoReingreso,
            )
            .join(LoteBobina, LoteBobina.IdLoteBobina == BobinaPapel.IdLoteBobina)
            .join(Proveedor, Proveedor.IdProveedor == LoteBobina.IdProveedor)
            .outerjoin(reingresos, reingresos.c.IdBobinaPapel == BobinaPapel.IdBobinaPapel)
            .where(
                BobinaPapel.IdTipoBobina == id_tipo_bobina,
                BobinaPapel.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN,
            )
            .order_by(LoteBobina.FechaRecepcion.desc())
        )
        return self.caller.Consultar(consulta)

    def VerBobinasFueraInventario(self) -> list[dict]:
        ultimo = (
            select(MovimientoBobina.Observacion, MovimientoBobina.FechaMovimiento)
            .where(MovimientoBobina.IdBobinaPapel == BobinaPapel.IdBobinaPapel)
            .order_by(MovimientoBobina.FechaMovimiento.desc())
            .limit(1)
            .lateral()
        )
        consulta = (
            select(
                BobinaPapel.IdBobinaPapel,
                BobinaPapel.CodigoBobina,
                TipoBobina.NombreTipoBobina,
                BobinaPapel.PesoBrutoKg,
                BobinaPapel.Gramaje,
                Proveedor.NombreProveedor,
                LoteBobina.FechaRecepcion,
                ultimo.c.Observacion.label("UltimaObservacion"),
                ultimo.c.FechaMovimiento.label("FechaUltimoMovimiento"),
            )
            .join(TipoBobina, TipoBobina.IdTipoBobina == BobinaPapel.IdTipoBobina)
            .join(LoteBobina, LoteBobina.IdLoteBobina == BobinaPapel.IdLoteBobina)
            .join(Proveedor, Proveedor.IdProveedor == LoteBobina.IdProveedor)
            .outerjoin(ultimo, true())
            .where(BobinaPapel.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_FUERA_INVENTARIO)
            .order_by(ultimo.c.FechaMovimiento.desc())
        )
        return self.caller.Consultar(consulta)

    def ObtenerBobinaBloqueada(self, id_bobina_papel: int) -> BobinaPapel | None:
        try:
            return self.db.scalars(
                select(BobinaPapel)
                .where(BobinaPapel.IdBobinaPapel == id_bobina_papel)
                .with_for_update()
            ).first()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener la bobina",
            )

    def RegistrarMovimiento(
        self, bobina: BobinaPapel, movimiento: MovimientoBobina, id_estado: int
    ) -> MovimientoBobina:
        try:
            bobina.IdEstadoMateriaPrima = id_estado
            self.db.add(movimiento)
            self.db.commit()
            self.db.refresh(movimiento)
            return movimiento
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo reingresar la bobina al inventario",
            )

    def Revertir(self) -> None:
        self.db.rollback()
