from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.Constants.Estados import ESTADO_PRODUCCION_EN_PRODUCCION, ESTADO_PRODUCCION_PAUSA
from app.Repository.Consultas import turno_actual
from app.Repository.DbCaller import DbCaller
from app.Schemas.BobinaServilleta import (
    BobinaServilleta,
    FormatoSubBobinaDetalle,
    SubBobinaServilleta,
    TipoMedidaSubBobina,
    UnidadBobinaServilleta,
)
from app.Schemas.Produccion import (
    EstadoProduccion,
    PausaProduccionServilleta,
    ProduccionServilleta,
    Turno,
)


class ProduccionBobinaServilletaRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def _Bloquear(self, consulta, mensaje: str):
        try:
            return self.db.scalars(consulta.with_for_update()).first()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=mensaje,
            )

    def ObtenerBobinaBloqueada(self, id_bobina: int) -> BobinaServilleta | None:
        return self._Bloquear(
            select(BobinaServilleta).where(BobinaServilleta.IdBobinaServilleta == id_bobina),
            "Error al obtener la bobina servilleta",
        )

    def ObtenerSubBobinaBloqueada(self, id_sub_bobina: int) -> SubBobinaServilleta | None:
        return self._Bloquear(
            select(SubBobinaServilleta).where(
                SubBobinaServilleta.IdSubBobinaServilleta == id_sub_bobina
            ),
            "Error al obtener la sub-bobina",
        )

    def ObtenerProduccionBloqueada(self, id_produccion: int) -> ProduccionServilleta | None:
        return self._Bloquear(
            select(ProduccionServilleta).where(
                ProduccionServilleta.IdProduccionServilleta == id_produccion
            ),
            "Error al obtener la producción",
        )

    def ObtenerPausaActiva(self, id_produccion: int) -> PausaProduccionServilleta | None:
        return self._Bloquear(
            select(PausaProduccionServilleta)
            .where(
                PausaProduccionServilleta.IdProduccionServilleta == id_produccion,
                PausaProduccionServilleta.FechaHoraReanudacion.is_(None),
            )
            .order_by(PausaProduccionServilleta.FechaHoraPausa.desc())
            .limit(1),
            "Error al obtener la pausa de la producción",
        )

    def SubBobinasPorUnidad(self, id_bobina: int) -> list[dict]:
        return self.caller.Consultar(
            select(
                UnidadBobinaServilleta.IdUnidadBobinaServilleta,
                TipoMedidaSubBobina.IdTipoMedidaSubBobina,
                TipoMedidaSubBobina.MedidaMm,
                FormatoSubBobinaDetalle.Cantidad,
            )
            .join(
                FormatoSubBobinaDetalle,
                FormatoSubBobinaDetalle.IdFormatoSubBobina == UnidadBobinaServilleta.IdFormatoSubBobina,
            )
            .join(
                TipoMedidaSubBobina,
                TipoMedidaSubBobina.IdTipoMedidaSubBobina == FormatoSubBobinaDetalle.IdTipoMedidaSubBobina,
            )
            .where(UnidadBobinaServilleta.IdBobinaServilleta == id_bobina)
            .order_by(
                UnidadBobinaServilleta.IdUnidadBobinaServilleta,
                TipoMedidaSubBobina.MedidaMm.desc(),
            )
        )

    def TurnoActual(self) -> dict | None:
        return turno_actual(self.caller)

    def NombreEstadoProduccion(self, id_estado: int) -> str:
        filas = self.caller.Consultar(
            select(EstadoProduccion.NombreEstadoProduccion).where(
                EstadoProduccion.IdEstadoProduccion == id_estado
            )
        )
        return filas[0]["NombreEstadoProduccion"] if filas else ""

    def Agregar(self, *registros) -> None:
        try:
            self.db.add_all(registros)
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

    def VerProduccionServilletaActivas(self, id_tipo_medida: int | None) -> list[dict]:
        consulta = (
            select(
                ProduccionServilleta.IdProduccionServilleta,
                EstadoProduccion.NombreEstadoProduccion,
                SubBobinaServilleta.IdSubBobinaServilleta.label("IdSubBobina"),
                UnidadBobinaServilleta.CodigoBobina.label("CodigoUnidadOrigen"),
                SubBobinaServilleta.IdTipoMedidaSubBobina,
                Turno.NombreTurno,
                ProduccionServilleta.FechaInicioProduccion,
            )
            .join(
                EstadoProduccion,
                EstadoProduccion.IdEstadoProduccion == ProduccionServilleta.IdEstadoProduccion,
            )
            .join(
                SubBobinaServilleta,
                SubBobinaServilleta.IdSubBobinaServilleta == ProduccionServilleta.IdSubBobina,
            )
            .join(
                UnidadBobinaServilleta,
                UnidadBobinaServilleta.IdUnidadBobinaServilleta
                == SubBobinaServilleta.IdUnidadBobinaServilleta,
            )
            .join(Turno, Turno.IdTurno == ProduccionServilleta.IdTurno)
            .where(ProduccionServilleta.IdEstadoProduccion == ESTADO_PRODUCCION_EN_PRODUCCION)
            .order_by(ProduccionServilleta.FechaInicioProduccion.desc())
        )
        if id_tipo_medida is not None:
            consulta = consulta.where(SubBobinaServilleta.IdTipoMedidaSubBobina == id_tipo_medida)
        return self.caller.Consultar(consulta)

    def VerPausasProduccionServilletaActivas(self) -> list[dict]:
        consulta = (
            select(
                PausaProduccionServilleta.IdPausaProduccionServilleta,
                PausaProduccionServilleta.IdProduccionServilleta,
                SubBobinaServilleta.IdSubBobinaServilleta.label("IdSubBobina"),
                UnidadBobinaServilleta.CodigoBobina.label("CodigoUnidadOrigen"),
                PausaProduccionServilleta.FechaHoraPausa,
                EstadoProduccion.NombreEstadoProduccion,
            )
            .join(
                ProduccionServilleta,
                ProduccionServilleta.IdProduccionServilleta
                == PausaProduccionServilleta.IdProduccionServilleta,
            )
            .join(
                EstadoProduccion,
                EstadoProduccion.IdEstadoProduccion == ProduccionServilleta.IdEstadoProduccion,
            )
            .join(
                SubBobinaServilleta,
                SubBobinaServilleta.IdSubBobinaServilleta == ProduccionServilleta.IdSubBobina,
            )
            .join(
                UnidadBobinaServilleta,
                UnidadBobinaServilleta.IdUnidadBobinaServilleta
                == SubBobinaServilleta.IdUnidadBobinaServilleta,
            )
            .where(
                ProduccionServilleta.IdEstadoProduccion == ESTADO_PRODUCCION_PAUSA,
                PausaProduccionServilleta.FechaHoraReanudacion.is_(None),
            )
        )
        return self.caller.Consultar(consulta)
