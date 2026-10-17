from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.Constants.Estados import MOVIMIENTO_MATERIA_PRIMA_INGRESO
from app.Repository.DbCaller import DbCaller
from app.Schemas.BobinaPapel import BobinaPapel, LoteBobina, MovimientoBobina, TipoBobina
from app.Schemas.Proveedor import Proveedor


class BobinaPapelRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def ObtenerTipoBobinaPapel(self) -> list[dict]:
        consulta = select(
            TipoBobina.IdTipoBobina,
            TipoBobina.NombreTipoBobina,
            TipoBobina.Activo,
        ).order_by(TipoBobina.NombreTipoBobina)
        return self.caller.Consultar(consulta)

    def ObtenerTipo(self, id_tipo_bobina: int) -> dict | None:
        filas = self.caller.Consultar(
            select(
                TipoBobina.IdTipoBobina,
                TipoBobina.NombreTipoBobina,
                TipoBobina.Activo,
            ).where(TipoBobina.IdTipoBobina == id_tipo_bobina)
        )
        return filas[0] if filas else None

    def ObtenerProveedor(self, id_proveedor: int) -> dict | None:
        filas = self.caller.Consultar(
            select(
                Proveedor.IdProveedor,
                Proveedor.NombreProveedor,
                Proveedor.Activo,
            ).where(Proveedor.IdProveedor == id_proveedor)
        )
        return filas[0] if filas else None

    def CodigosRegistrados(self, codigos: list[str], excluir_id: int | None = None) -> list[str]:
        consulta = select(BobinaPapel.CodigoBobina).where(BobinaPapel.CodigoBobina.in_(codigos))
        if excluir_id is not None:
            consulta = consulta.where(BobinaPapel.IdBobinaPapel != excluir_id)
        return [fila["CodigoBobina"] for fila in self.caller.Consultar(consulta)]

    def RegistrarLote(
        self, lote: LoteBobina, bobinas: list[BobinaPapel], id_usuario: int, observacion: str
    ) -> LoteBobina:
        try:
            self.db.add(lote)
            self.db.flush()

            for bobina in bobinas:
                bobina.IdLoteBobina = lote.IdLoteBobina
                self.db.add(bobina)
            self.db.flush()

            for bobina in bobinas:
                self.db.add(
                    MovimientoBobina(
                        IdBobinaPapel=bobina.IdBobinaPapel,
                        IdTipoMovimiento=MOVIMIENTO_MATERIA_PRIMA_INGRESO,
                        IdUsuario=id_usuario,
                        Observacion=observacion,
                    )
                )

            self.db.commit()
            self.db.refresh(lote)
            return lote
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una bobina registrada con ese código",
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el lote de bobinas",
            )

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

    def RegistrarCorreccion(
        self, bobina: BobinaPapel, cambios: dict, movimiento: MovimientoBobina
    ) -> MovimientoBobina:
        try:
            for campo, valor in cambios.items():
                setattr(bobina, campo, valor)
            self.db.add(movimiento)
            self.db.commit()
            self.db.refresh(movimiento)
            self.db.refresh(bobina)
            return movimiento
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una bobina registrada con ese código",
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo corregir la bobina",
            )

    def Revertir(self) -> None:
        self.db.rollback()
