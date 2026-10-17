from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, aliased

from app.Constants.Estados import (
    ESTADO_PRODUCCION_EN_PRODUCCION as ID_ESTADO_EN_PRODUCCION,
    ESTADO_PRODUCCION_PAUSA as ID_ESTADO_PAUSA,
)
from app.Repository.Consultas import turno_actual
from app.Repository.DbCaller import DbCaller
from app.Schemas.BobinaPapel import BobinaPapel, TipoBobina
from app.Schemas.Produccion import (
    EstadoProduccion,
    PausaProduccionBobinaTubo,
    ProduccionBobinaTubo,
    Turno,
)
from app.Schemas.Producto import Producto


class ProduccionBobinaPapelRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def ObtenerBobinasBloqueadas(self, ids_bobina: list[int]) -> dict[int, BobinaPapel]:
        try:
            bobinas = self.db.scalars(
                select(BobinaPapel)
                .where(BobinaPapel.IdBobinaPapel.in_(ids_bobina))
                .order_by(BobinaPapel.IdBobinaPapel)
                .with_for_update()
            ).all()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener las bobinas",
            )
        return {bobina.IdBobinaPapel: bobina for bobina in bobinas}

    def ObtenerProduccionBloqueada(self, id_produccion: int) -> ProduccionBobinaTubo | None:
        try:
            return self.db.scalars(
                select(ProduccionBobinaTubo)
                .where(ProduccionBobinaTubo.IdProduccionBobinaTubo == id_produccion)
                .with_for_update()
            ).first()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener la producción",
            )

    def ObtenerPausaActiva(self, id_produccion: int) -> PausaProduccionBobinaTubo | None:
        try:
            return self.db.scalars(
                select(PausaProduccionBobinaTubo)
                .where(
                    PausaProduccionBobinaTubo.IdProduccionBobinaTubo == id_produccion,
                    PausaProduccionBobinaTubo.FechaHoraReanudacion.is_(None),
                )
                .order_by(PausaProduccionBobinaTubo.FechaHoraPausa.desc())
                .limit(1)
                .with_for_update()
            ).first()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener la pausa de la producción",
            )

    def ProductosDelTipo(self, id_tipo_bobina: int) -> list[dict]:
        return self.caller.Consultar(
            select(Producto.IdProducto, Producto.NombreProducto, Producto.Activo)
            .where(Producto.IdTipoBobina == id_tipo_bobina)
            .order_by(Producto.IdProducto)
        )

    def ObtenerProducto(self, id_producto: int) -> dict | None:
        filas = self.caller.Consultar(
            select(
                Producto.IdProducto,
                Producto.NombreProducto,
                Producto.IdTipoBobina,
                Producto.Activo,
            ).where(Producto.IdProducto == id_producto)
        )
        return filas[0] if filas else None

    def ObtenerTurno(self, id_turno: int) -> dict | None:
        filas = self.caller.Consultar(
            select(Turno.IdTurno, Turno.NombreTurno).where(Turno.IdTurno == id_turno)
        )
        return filas[0] if filas else None

    def TurnoActual(self) -> dict | None:
        return turno_actual(self.caller)

    def NombreEstadoProduccion(self, id_estado: int) -> str:
        filas = self.caller.Consultar(
            select(EstadoProduccion.NombreEstadoProduccion).where(
                EstadoProduccion.IdEstadoProduccion == id_estado
            )
        )
        return filas[0]["NombreEstadoProduccion"] if filas else ""

    def Agregar(self, registro) -> None:
        try:
            self.db.add(registro)
            self.db.flush()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar la operación de producción",
            )

    def Guardar(self, *registros, mensaje_error: str) -> None:
        try:
            self.db.add_all(registros)
            self.db.commit()
            for registro in registros:
                self.db.refresh(registro)
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=mensaje_error,
            )

    def Revertir(self) -> None:
        self.db.rollback()

    def VerProduccionBobinaTubo(self, params: dict) -> list[dict]:
        pb = ProduccionBobinaTubo
        b1 = aliased(BobinaPapel)
        b2 = aliased(BobinaPapel)

        consulta = (
            select(
                pb.IdProduccionBobinaTubo,
                TipoBobina.IdTipoBobina,
                TipoBobina.NombreTipoBobina,
                Producto.IdProducto,
                Producto.NombreProducto,
                EstadoProduccion.NombreEstadoProduccion,
                b1.CodigoBobina.label("CodigoBobina1"),
                b2.CodigoBobina.label("CodigoBobina2"),
                Turno.NombreTurno,
                pb.FechaInicioProduccion,
                pb.CantidadLogsActual,
            )
            .join(EstadoProduccion, EstadoProduccion.IdEstadoProduccion == pb.IdEstadoProduccion)
            .join(b1, b1.IdBobinaPapel == pb.IdBobina_1)
            .join(b2, b2.IdBobinaPapel == pb.IdBobina_2)
            .join(TipoBobina, TipoBobina.IdTipoBobina == b1.IdTipoBobina)
            .join(Producto, Producto.IdProducto == pb.IdProducto)
            .join(Turno, Turno.IdTurno == pb.IdTurno)
            .where(pb.IdEstadoProduccion == ID_ESTADO_EN_PRODUCCION)
            .order_by(TipoBobina.NombreTipoBobina, pb.FechaInicioProduccion)
        )

        id_tipo = params.get("p_IdTipoBobina")
        if id_tipo is not None:
            consulta = consulta.where(
                or_(b1.IdTipoBobina == id_tipo, b2.IdTipoBobina == id_tipo)
            )

        id_producto = params.get("p_IdProducto")
        if id_producto is not None:
            consulta = consulta.where(pb.IdProducto == id_producto)

        return self.caller.Consultar(consulta)

    def VerPausasProduccionBobinaTuboActivas(self, params: dict) -> list[dict]:
        pausa = PausaProduccionBobinaTubo
        pb = ProduccionBobinaTubo
        b1 = aliased(BobinaPapel)
        b2 = aliased(BobinaPapel)

        consulta = (
            select(
                pausa.IdPausaProduccionBobinaTubo,
                pausa.IdProduccionBobinaTubo,
                Producto.IdProducto,
                Producto.NombreProducto,
                b1.CodigoBobina.label("CodigoBobina1"),
                b2.CodigoBobina.label("CodigoBobina2"),
                pausa.FechaHoraPausa,
                EstadoProduccion.NombreEstadoProduccion,
                pb.CantidadLogsActual,
            )
            .join(pb, pb.IdProduccionBobinaTubo == pausa.IdProduccionBobinaTubo)
            .join(EstadoProduccion, EstadoProduccion.IdEstadoProduccion == pb.IdEstadoProduccion)
            .join(b1, b1.IdBobinaPapel == pb.IdBobina_1)
            .join(b2, b2.IdBobinaPapel == pb.IdBobina_2)
            .join(Producto, Producto.IdProducto == pb.IdProducto)
            .where(
                pb.IdEstadoProduccion == ID_ESTADO_PAUSA,
                pausa.FechaHoraReanudacion.is_(None),
            )
            .order_by(pausa.FechaHoraPausa)
        )

        id_tipo = params.get("p_FiltroIdTipoBobina")
        if id_tipo is not None:
            consulta = consulta.where(
                or_(b1.IdTipoBobina == id_tipo, b2.IdTipoBobina == id_tipo)
            )

        id_producto = params.get("p_FiltroIdProducto")
        if id_producto is not None:
            consulta = consulta.where(pb.IdProducto == id_producto)

        return self.caller.Consultar(consulta)
