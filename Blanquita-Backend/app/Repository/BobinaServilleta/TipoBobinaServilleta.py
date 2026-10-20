from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.Repository.BobinaServilleta.Unidades import detalle_de_formatos, formatos_permitidos
from app.Repository.MateriaPrima.TipoMateriaPrima import TipoMateriaPrimaRepository
from app.Schemas.BobinaServilleta import (
    FormatoSubBobina,
    TipoBobinaServilleta,
    TipoBobinaServilletaFormato,
)


class TipoBobinaServilletaRepository(TipoMateriaPrimaRepository):
    def __init__(self, db: Session):
        super().__init__(
            db,
            TipoBobinaServilleta,
            TipoBobinaServilleta.IdTipoBobinaServilleta,
            TipoBobinaServilleta.NombreTipoBobinaServilleta,
        )

    def ListarTipos(self, id_tipo: int | None = None) -> list[dict]:
        consulta = select(
            TipoBobinaServilleta.IdTipoBobinaServilleta,
            TipoBobinaServilleta.NombreTipoBobinaServilleta,
            TipoBobinaServilleta.DiametroMm,
            TipoBobinaServilleta.CrepadoPorcentaje,
            TipoBobinaServilleta.ResistenciaKgf,
            TipoBobinaServilleta.Descripcion,
            TipoBobinaServilleta.CantidadUnidades,
            TipoBobinaServilleta.Activo,
            TipoBobinaServilleta.StockMinimo,
            TipoBobinaServilleta.StockPreventivo,
        ).order_by(TipoBobinaServilleta.IdTipoBobinaServilleta)
        if id_tipo is not None:
            consulta = consulta.where(TipoBobinaServilleta.IdTipoBobinaServilleta == id_tipo)
        return self.caller.Consultar(consulta)

    def FormatosDeTipos(self, ids_tipo: list[int]) -> dict[int, list[dict]]:
        return formatos_permitidos(self.caller, ids_tipo)

    def ListarFormatos(self) -> list[dict]:
        formatos = self.caller.Consultar(
            select(
                FormatoSubBobina.IdFormatoSubBobina,
                FormatoSubBobina.DescripcionFormato,
                FormatoSubBobina.Activo,
            ).order_by(FormatoSubBobina.IdFormatoSubBobina)
        )
        detalle = detalle_de_formatos(
            self.caller, [formato["IdFormatoSubBobina"] for formato in formatos]
        )
        return [
            {**formato, "Detalle": detalle.get(formato["IdFormatoSubBobina"], [])}
            for formato in formatos
        ]

    def ObtenerFormatos(self, ids_formato: list[int]) -> dict[int, dict]:
        if not ids_formato:
            return {}
        filas = self.caller.Consultar(
            select(
                FormatoSubBobina.IdFormatoSubBobina,
                FormatoSubBobina.DescripcionFormato,
                FormatoSubBobina.Activo,
            ).where(FormatoSubBobina.IdFormatoSubBobina.in_(ids_formato))
        )
        return {fila["IdFormatoSubBobina"]: fila for fila in filas}

    def ObtenerAsignacionesBloqueadas(self, id_tipo: int) -> dict[int, TipoBobinaServilletaFormato]:
        try:
            filas = self.db.execute(
                select(TipoBobinaServilletaFormato)
                .where(TipoBobinaServilletaFormato.IdTipoBobinaServilleta == id_tipo)
                .with_for_update()
            ).scalars().all()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener los formatos del tipo de bobina servilleta",
            )
        return {fila.IdFormatoSubBobina: fila for fila in filas}
