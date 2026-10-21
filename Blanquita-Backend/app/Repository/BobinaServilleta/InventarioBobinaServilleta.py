from fastapi import HTTPException, status
from sqlalchemy import and_, func, select, true
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.Constants.Estados import (
    ESTADO_MATERIA_PRIMA_EN_ALMACEN,
    ESTADO_MATERIA_PRIMA_FUERA_INVENTARIO,
    MOVIMIENTO_MATERIA_PRIMA_REINGRESO,
)
from app.Repository.BobinaServilleta.Unidades import con_unidades, unidades_de_bobinas
from app.Repository.Consultas import nivel_stock, visible_en_inventario
from app.Repository.DbCaller import DbCaller
from app.Schemas.BobinaServilleta import (
    BobinaServilleta,
    LoteBobinaServilleta,
    MovimientoSubBobina,
    SubBobinaServilleta,
    TipoBobinaServilleta,
    TipoMedidaSubBobina,
    UnidadBobinaServilleta,
)
from app.Schemas.Proveedor import Proveedor


class InventarioBobinaServilletaRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def VerResumenInventarioBobinaServilleta(self) -> list[dict]:
        cantidad = func.count(BobinaServilleta.IdBobinaServilleta)
        consulta = (
            select(
                TipoBobinaServilleta.IdTipoBobinaServilleta,
                TipoBobinaServilleta.NombreTipoBobinaServilleta,
                TipoBobinaServilleta.Activo,
                cantidad.label("CantidadBobinaServilleta"),
                TipoBobinaServilleta.StockMinimo,
                TipoBobinaServilleta.StockPreventivo,
                nivel_stock(cantidad, TipoBobinaServilleta.StockMinimo, TipoBobinaServilleta.StockPreventivo).label("NivelStock"),
            )
            .outerjoin(
                BobinaServilleta,
                and_(
                    BobinaServilleta.IdTipoBobinaServilleta
                    == TipoBobinaServilleta.IdTipoBobinaServilleta,
                    BobinaServilleta.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN,
                ),
            )
            .group_by(
                TipoBobinaServilleta.IdTipoBobinaServilleta,
                TipoBobinaServilleta.NombreTipoBobinaServilleta,
                TipoBobinaServilleta.Activo,
                TipoBobinaServilleta.StockMinimo,
                TipoBobinaServilleta.StockPreventivo,
            )
            .having(visible_en_inventario(TipoBobinaServilleta.Activo, cantidad))
            .order_by(TipoBobinaServilleta.IdTipoBobinaServilleta)
        )
        return self.caller.Consultar(consulta)

    def VerDetalleInventarioBobinaServilleta(self, id_tipo: int) -> list[dict]:
        bobinas = self.caller.Consultar(
            select(
                BobinaServilleta.IdBobinaServilleta,
                LoteBobinaServilleta.FechaRecepcion,
                Proveedor.NombreProveedor,
            )
            .join(
                LoteBobinaServilleta,
                LoteBobinaServilleta.IdLoteBobinaServilleta == BobinaServilleta.IdLoteBobinaServilleta,
            )
            .join(Proveedor, Proveedor.IdProveedor == LoteBobinaServilleta.IdProveedor)
            .where(
                BobinaServilleta.IdTipoBobinaServilleta == id_tipo,
                BobinaServilleta.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN,
            )
            .order_by(BobinaServilleta.IdBobinaServilleta)
        )
        return con_unidades(self.caller, bobinas)

    def UnidadesDeBobinas(self, ids_bobina: list[int]) -> dict[int, list[dict]]:
        return unidades_de_bobinas(self.caller, ids_bobina)

    def VerResumenInventarioSubBobinaServilleta(self) -> list[dict]:
        cantidad = func.count(SubBobinaServilleta.IdSubBobinaServilleta)
        consulta = (
            select(
                TipoMedidaSubBobina.IdTipoMedidaSubBobina,
                TipoMedidaSubBobina.Descripcion.label("NombreTipoMedida"),
                TipoMedidaSubBobina.MedidaMm,
                TipoMedidaSubBobina.Activo,
                cantidad.label("CantidadSubBobinas"),
                TipoMedidaSubBobina.StockMinimo,
                TipoMedidaSubBobina.StockPreventivo,
                nivel_stock(cantidad, TipoMedidaSubBobina.StockMinimo, TipoMedidaSubBobina.StockPreventivo).label("NivelStock"),
            )
            .outerjoin(
                SubBobinaServilleta,
                and_(
                    SubBobinaServilleta.IdTipoMedidaSubBobina
                    == TipoMedidaSubBobina.IdTipoMedidaSubBobina,
                    SubBobinaServilleta.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN,
                ),
            )
            .group_by(
                TipoMedidaSubBobina.IdTipoMedidaSubBobina,
                TipoMedidaSubBobina.Descripcion,
                TipoMedidaSubBobina.MedidaMm,
                TipoMedidaSubBobina.Activo,
                TipoMedidaSubBobina.StockMinimo,
                TipoMedidaSubBobina.StockPreventivo,
            )
            .having(visible_en_inventario(TipoMedidaSubBobina.Activo, cantidad))
            .order_by(TipoMedidaSubBobina.IdTipoMedidaSubBobina)
        )
        return self.caller.Consultar(consulta)

    def VerDetalleInventarioSubBobinaServilleta(self, id_tipo_medida: int) -> list[dict]:
        reingresos = (
            select(
                MovimientoSubBobina.IdSubBobinaServilleta,
                func.max(MovimientoSubBobina.FechaMovimiento).label("FechaUltimoReingreso"),
            )
            .where(MovimientoSubBobina.IdTipoMovimiento == MOVIMIENTO_MATERIA_PRIMA_REINGRESO)
            .group_by(MovimientoSubBobina.IdSubBobinaServilleta)
            .subquery()
        )
        consulta = (
            select(
                SubBobinaServilleta.IdSubBobinaServilleta,
                UnidadBobinaServilleta.CodigoBobina.label("CodigoUnidadOrigen"),
                reingresos.c.FechaUltimoReingreso.is_not(None).label("Reingresada"),
                reingresos.c.FechaUltimoReingreso,
            )
            .join(
                UnidadBobinaServilleta,
                UnidadBobinaServilleta.IdUnidadBobinaServilleta
                == SubBobinaServilleta.IdUnidadBobinaServilleta,
            )
            .outerjoin(
                reingresos,
                reingresos.c.IdSubBobinaServilleta == SubBobinaServilleta.IdSubBobinaServilleta,
            )
            .where(
                SubBobinaServilleta.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN,
                SubBobinaServilleta.IdTipoMedidaSubBobina == id_tipo_medida,
            )
            .order_by(SubBobinaServilleta.IdSubBobinaServilleta)
        )
        return self.caller.Consultar(consulta)

    def VerSubBobinasServilletaFueraInventario(self) -> list[dict]:
        ultimo = (
            select(MovimientoSubBobina.Observacion, MovimientoSubBobina.FechaMovimiento)
            .where(
                MovimientoSubBobina.IdSubBobinaServilleta
                == SubBobinaServilleta.IdSubBobinaServilleta
            )
            .order_by(MovimientoSubBobina.FechaMovimiento.desc())
            .limit(1)
            .lateral()
        )
        consulta = (
            select(
                SubBobinaServilleta.IdSubBobinaServilleta,
                UnidadBobinaServilleta.CodigoBobina.label("CodigoUnidadOrigen"),
                TipoMedidaSubBobina.Descripcion.label("NombreTipoMedida"),
                ultimo.c.Observacion.label("UltimaObservacion"),
                ultimo.c.FechaMovimiento.label("FechaUltimoMovimiento"),
            )
            .join(
                UnidadBobinaServilleta,
                UnidadBobinaServilleta.IdUnidadBobinaServilleta
                == SubBobinaServilleta.IdUnidadBobinaServilleta,
            )
            .join(
                TipoMedidaSubBobina,
                TipoMedidaSubBobina.IdTipoMedidaSubBobina == SubBobinaServilleta.IdTipoMedidaSubBobina,
            )
            .outerjoin(ultimo, true())
            .where(SubBobinaServilleta.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_FUERA_INVENTARIO)
            .order_by(ultimo.c.FechaMovimiento.desc())
        )
        return self.caller.Consultar(consulta)

    def ObtenerSubBobinaBloqueada(self, id_sub_bobina: int) -> SubBobinaServilleta | None:
        try:
            return self.db.scalars(
                select(SubBobinaServilleta)
                .where(SubBobinaServilleta.IdSubBobinaServilleta == id_sub_bobina)
                .with_for_update()
            ).first()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener la sub-bobina",
            )

    def ObtenerBobinaBloqueada(self, id_bobina: int) -> BobinaServilleta | None:
        try:
            return self.db.scalars(
                select(BobinaServilleta)
                .where(BobinaServilleta.IdBobinaServilleta == id_bobina)
                .with_for_update()
            ).first()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener la bobina servilleta",
            )

    def ObtenerUnidadesBloqueadas(self, id_bobina: int) -> dict[int, UnidadBobinaServilleta]:
        try:
            unidades = self.db.scalars(
                select(UnidadBobinaServilleta)
                .where(UnidadBobinaServilleta.IdBobinaServilleta == id_bobina)
                .order_by(UnidadBobinaServilleta.IdUnidadBobinaServilleta)
                .with_for_update()
            ).all()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener las unidades de la bobina servilleta",
            )
        return {unidad.IdUnidadBobinaServilleta: unidad for unidad in unidades}

    def CodigosEnUso(self, codigos: list[str], ids_excluir: list[int]) -> list[str]:
        filas = self.caller.Consultar(
            select(UnidadBobinaServilleta.CodigoBobina).where(
                func.lower(UnidadBobinaServilleta.CodigoBobina).in_([c.lower() for c in codigos]),
                UnidadBobinaServilleta.IdUnidadBobinaServilleta.not_in(ids_excluir),
            )
        )
        return [fila["CodigoBobina"] for fila in filas]

    def Guardar(self, *registros, mensaje_error: str) -> None:
        try:
            self.db.add_all(registros)
            self.db.commit()
            for registro in registros:
                self.db.refresh(registro)
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una unidad de bobina servilleta registrada con ese código",
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=mensaje_error,
            )

    def Revertir(self) -> None:
        self.db.rollback()
