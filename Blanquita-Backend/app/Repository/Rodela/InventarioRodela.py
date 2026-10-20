from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import Integer, Text, and_, cast, func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.Constants.Cantidades import MINUTOS_DESHACER_TRASLADO_RODELA
from app.Constants.Estados import (
    ESTADO_MATERIA_PRIMA_ABIERTA,
    ESTADO_MATERIA_PRIMA_EN_ALMACEN,
    MOVIMIENTO_MATERIA_PRIMA_TRASLADO,
)
from app.Repository.Consultas import nivel_stock
from app.Repository.DbCaller import DbCaller
from app.Schemas.MateriaPrima import EstadoMateriaPrima
from app.Schemas.Proveedor import Proveedor
from app.Schemas.Rodela import LoteRodela, MovimientoRodela, Rodela, TipoRodela

VENTANA_DESHACER_TRASLADO = timedelta(minutes=MINUTOS_DESHACER_TRASLADO_RODELA)


class InventarioRodelaRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def VerResumenInventarioRodela(self) -> list[dict]:
        cantidad = func.count(Rodela.IdRodela).filter(
            Rodela.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN
        )
        consulta = (
            select(
                TipoRodela.IdTipoRodela,
                TipoRodela.NombreTipoRodela,
                TipoRodela.Descripcion,
                TipoRodela.Activo,
                cantidad.label("CantidadEnAlmacen"),
                func.count(Rodela.IdRodela)
                .filter(Rodela.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_ABIERTA)
                .label("CantidadAbiertas"),
                TipoRodela.StockMinimo,
                TipoRodela.StockPreventivo,
                nivel_stock(cantidad, TipoRodela.StockMinimo, TipoRodela.StockPreventivo).label("NivelStock"),
            )
            .outerjoin(
                Rodela,
                and_(
                    Rodela.IdTipoRodela == TipoRodela.IdTipoRodela,
                    Rodela.IdEstadoMateriaPrima.in_(
                        [ESTADO_MATERIA_PRIMA_EN_ALMACEN, ESTADO_MATERIA_PRIMA_ABIERTA]
                    ),
                ),
            )
            .group_by(
                TipoRodela.IdTipoRodela,
                TipoRodela.NombreTipoRodela,
                TipoRodela.Descripcion,
                TipoRodela.Activo,
                TipoRodela.StockMinimo,
                TipoRodela.StockPreventivo,
            )
            .order_by(TipoRodela.IdTipoRodela)
        )
        return self.caller.Consultar(consulta)

    def VerDetalleInventarioRodela(self, id_tipo_rodela: int) -> list[dict]:
        consulta = (
            select(
                Rodela.IdRodela,
                Rodela.CodigoRodela,
                func.concat("L-", func.lpad(cast(LoteRodela.IdLoteRodela, Text), 4, "0")).label(
                    "CodigoLote"
                ),
                LoteRodela.FechaRecepcion,
                Proveedor.NombreProveedor,
                EstadoMateriaPrima.TipoEstado,
            )
            .join(LoteRodela, LoteRodela.IdLoteRodela == Rodela.IdLoteRodela)
            .join(Proveedor, Proveedor.IdProveedor == LoteRodela.IdProveedor)
            .join(
                EstadoMateriaPrima,
                EstadoMateriaPrima.IdEstadoMateriaPrima == Rodela.IdEstadoMateriaPrima,
            )
            .where(
                Rodela.IdTipoRodela == id_tipo_rodela,
                Rodela.IdEstadoMateriaPrima.in_(
                    [ESTADO_MATERIA_PRIMA_EN_ALMACEN, ESTADO_MATERIA_PRIMA_ABIERTA]
                ),
            )
            .order_by(LoteRodela.FechaRecepcion.desc(), Rodela.CodigoRodela)
        )
        return self.caller.Consultar(consulta)

    def ListarRodelasEnAlmacen(self, id_tipo_rodela: int) -> list[dict]:
        consulta = (
            select(Rodela.IdRodela, Rodela.CodigoRodela)
            .where(
                Rodela.IdTipoRodela == id_tipo_rodela,
                Rodela.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN,
            )
            .order_by(Rodela.CodigoRodela)
        )
        return self.caller.Consultar(consulta)

    def ListarRodelasReingresables(self) -> list[dict]:
        ultimo_traslado = (
            select(
                MovimientoRodela.IdRodela,
                func.max(MovimientoRodela.FechaMovimiento).label("FechaTraslado"),
            )
            .where(MovimientoRodela.IdTipoMovimiento == MOVIMIENTO_MATERIA_PRIMA_TRASLADO)
            .group_by(MovimientoRodela.IdRodela)
            .subquery()
        )
        limite = ultimo_traslado.c.FechaTraslado + VENTANA_DESHACER_TRASLADO
        consulta = (
            select(
                Rodela.IdRodela,
                Rodela.CodigoRodela,
                Rodela.IdTipoRodela,
                TipoRodela.NombreTipoRodela,
                LoteRodela.FechaRecepcion,
                Proveedor.NombreProveedor,
                ultimo_traslado.c.FechaTraslado,
                cast(
                    func.greatest(
                        0, func.ceil(func.extract("epoch", limite - func.now()) / 60.0)
                    ),
                    Integer,
                ).label("MinutosRestantes"),
            )
            .join(ultimo_traslado, ultimo_traslado.c.IdRodela == Rodela.IdRodela)
            .join(TipoRodela, TipoRodela.IdTipoRodela == Rodela.IdTipoRodela)
            .join(LoteRodela, LoteRodela.IdLoteRodela == Rodela.IdLoteRodela)
            .join(Proveedor, Proveedor.IdProveedor == LoteRodela.IdProveedor)
            .where(
                Rodela.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_ABIERTA,
                limite >= func.now(),
            )
            .order_by(ultimo_traslado.c.FechaTraslado)
        )
        return self.caller.Consultar(consulta)

    def ObtenerRodelaBloqueada(self, id_rodela: int) -> Rodela | None:
        try:
            return self.db.scalars(
                select(Rodela).where(Rodela.IdRodela == id_rodela).with_for_update()
            ).first()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener la rodela",
            )

    def UltimoTraslado(self, id_rodela: int) -> datetime | None:
        try:
            return self.db.scalar(
                select(func.max(MovimientoRodela.FechaMovimiento)).where(
                    MovimientoRodela.IdRodela == id_rodela,
                    MovimientoRodela.IdTipoMovimiento == MOVIMIENTO_MATERIA_PRIMA_TRASLADO,
                )
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener el traslado de la rodela",
            )

    def CodigoEnUso(self, codigo: str, id_rodela: int) -> bool:
        filas = self.caller.Consultar(
            select(Rodela.IdRodela).where(
                Rodela.CodigoRodela == codigo, Rodela.IdRodela != id_rodela
            )
        )
        return bool(filas)

    def RegistrarMovimiento(
        self,
        rodela: Rodela,
        movimiento: MovimientoRodela,
        id_estado: int | None = None,
        codigo: str | None = None,
    ) -> MovimientoRodela:
        try:
            if id_estado is not None:
                rodela.IdEstadoMateriaPrima = id_estado
            if codigo is not None:
                rodela.CodigoRodela = codigo
            self.db.add(movimiento)
            self.db.commit()
            self.db.refresh(movimiento)
            self.db.refresh(rodela)
            return movimiento
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una rodela registrada con ese código",
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el movimiento de la rodela",
            )

    def Revertir(self) -> None:
        self.db.rollback()
