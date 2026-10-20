from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.Repository.BobinaServilleta.Unidades import detalle_de_formatos
from app.Repository.MateriaPrima.TipoMateriaPrima import TipoMateriaPrimaRepository
from app.Schemas.BobinaServilleta import (
    FormatoSubBobina,
    FormatoSubBobinaDetalle,
    TipoBobinaServilleta,
    TipoBobinaServilletaFormato,
    TipoMedidaSubBobina,
    UnidadBobinaServilleta,
)
from app.Schemas.HistorialAdmin import HistorialAdmin


class FormatoSubBobinaRepository(TipoMateriaPrimaRepository):
    def __init__(self, db: Session):
        super().__init__(
            db,
            FormatoSubBobina,
            FormatoSubBobina.IdFormatoSubBobina,
            FormatoSubBobina.DescripcionFormato,
        )

    def ListarFormatos(self, id_formato: int | None = None) -> list[dict]:
        unidades = (
            select(
                UnidadBobinaServilleta.IdFormatoSubBobina,
                func.count(UnidadBobinaServilleta.IdUnidadBobinaServilleta).label("CantidadUnidades"),
            )
            .group_by(UnidadBobinaServilleta.IdFormatoSubBobina)
            .subquery()
        )
        consulta = (
            select(
                FormatoSubBobina.IdFormatoSubBobina,
                FormatoSubBobina.DescripcionFormato,
                FormatoSubBobina.Activo,
                func.coalesce(unidades.c.CantidadUnidades, 0).label("CantidadUnidades"),
            )
            .outerjoin(unidades, unidades.c.IdFormatoSubBobina == FormatoSubBobina.IdFormatoSubBobina)
            .order_by(FormatoSubBobina.IdFormatoSubBobina)
        )
        if id_formato is not None:
            consulta = consulta.where(FormatoSubBobina.IdFormatoSubBobina == id_formato)
        formatos = self.caller.Consultar(consulta)

        ids = [formato["IdFormatoSubBobina"] for formato in formatos]
        detalle = detalle_de_formatos(self.caller, ids)
        tipos = self.TiposDeFormatos(ids)
        return [
            {
                **formato,
                "Detalle": detalle.get(formato["IdFormatoSubBobina"], []),
                "Tipos": tipos.get(formato["IdFormatoSubBobina"], []),
            }
            for formato in formatos
        ]

    def TiposDeFormatos(self, ids_formato: list[int]) -> dict[int, list[dict]]:
        if not ids_formato:
            return {}

        filas = self.caller.Consultar(
            select(
                TipoBobinaServilletaFormato.IdFormatoSubBobina,
                TipoBobinaServilleta.IdTipoBobinaServilleta,
                TipoBobinaServilleta.NombreTipoBobinaServilleta,
                TipoBobinaServilleta.Activo,
            )
            .join(
                TipoBobinaServilleta,
                TipoBobinaServilleta.IdTipoBobinaServilleta
                == TipoBobinaServilletaFormato.IdTipoBobinaServilleta,
            )
            .where(TipoBobinaServilletaFormato.IdFormatoSubBobina.in_(ids_formato))
            .order_by(TipoBobinaServilleta.NombreTipoBobinaServilleta)
        )

        tipos: dict[int, list[dict]] = {}
        for fila in filas:
            id_formato = fila.pop("IdFormatoSubBobina")
            tipos.setdefault(id_formato, []).append(fila)
        return tipos

    def TiposSinOtroFormatoActivo(self, id_formato: int) -> list[str]:
        otros_activos = (
            select(TipoBobinaServilletaFormato.IdTipoBobinaServilleta)
            .join(
                FormatoSubBobina,
                FormatoSubBobina.IdFormatoSubBobina == TipoBobinaServilletaFormato.IdFormatoSubBobina,
            )
            .where(
                FormatoSubBobina.Activo,
                TipoBobinaServilletaFormato.IdFormatoSubBobina != id_formato,
            )
        )
        filas = self.caller.Consultar(
            select(TipoBobinaServilleta.NombreTipoBobinaServilleta)
            .join(
                TipoBobinaServilletaFormato,
                TipoBobinaServilletaFormato.IdTipoBobinaServilleta
                == TipoBobinaServilleta.IdTipoBobinaServilleta,
            )
            .where(
                TipoBobinaServilletaFormato.IdFormatoSubBobina == id_formato,
                TipoBobinaServilleta.Activo,
                TipoBobinaServilleta.IdTipoBobinaServilleta.not_in(otros_activos),
            )
            .order_by(TipoBobinaServilleta.NombreTipoBobinaServilleta)
        )
        return [fila["NombreTipoBobinaServilleta"] for fila in filas]

    def ObtenerMedidasBloqueadas(self, medidas_mm: list[int]) -> dict[int, TipoMedidaSubBobina]:
        try:
            medidas = self.db.execute(
                select(TipoMedidaSubBobina)
                .where(TipoMedidaSubBobina.MedidaMm.in_(medidas_mm))
                .order_by(TipoMedidaSubBobina.MedidaMm)
                .with_for_update()
            ).scalars().all()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener las medidas de sub-bobina",
            )
        return {medida.MedidaMm: medida for medida in medidas}

    def CrearFormato(
        self,
        formato: FormatoSubBobina,
        medidas: dict[int, TipoMedidaSubBobina],
        detalle: list[tuple[int, int]],
        observacion,
        id_admin: int,
    ) -> FormatoSubBobina:
        try:
            self.db.add(formato)
            for medida in medidas.values():
                self.db.add(medida)
            self.db.flush()

            for medida_mm, cantidad in detalle:
                self.db.add(
                    FormatoSubBobinaDetalle(
                        IdFormatoSubBobina=formato.IdFormatoSubBobina,
                        IdTipoMedidaSubBobina=medidas[medida_mm].IdTipoMedidaSubBobina,
                        Cantidad=cantidad,
                    )
                )
            self.db.add(HistorialAdmin(IdUsuario=id_admin, Observacion=observacion(formato)))
            self.db.commit()
            self.db.refresh(formato)
            return formato
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe el formato {formato.DescripcionFormato} o una de sus medidas",
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo crear el formato de sub-bobina",
            )
