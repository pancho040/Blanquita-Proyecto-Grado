from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.Constants.Estados import MOVIMIENTO_MATERIA_PRIMA_INGRESO
from app.Repository.DbCaller import DbCaller
from app.Schemas.Proveedor import Proveedor
from app.Schemas.Rodela import LoteRodela, MovimientoRodela, Rodela, TipoRodela


class RodelaRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def ObtenerTipoRodela(self) -> list[dict]:
        consulta = select(
            TipoRodela.IdTipoRodela,
            TipoRodela.NombreTipoRodela,
            TipoRodela.Descripcion,
            TipoRodela.Activo,
        ).order_by(TipoRodela.IdTipoRodela)
        return self.caller.Consultar(consulta)

    def ObtenerTipo(self, id_tipo_rodela: int) -> dict | None:
        filas = self.caller.Consultar(
            select(
                TipoRodela.IdTipoRodela,
                TipoRodela.NombreTipoRodela,
                TipoRodela.Activo,
            ).where(TipoRodela.IdTipoRodela == id_tipo_rodela)
        )
        return filas[0] if filas else None

    def ObtenerProveedor(self, id_proveedor: int) -> dict | None:
        filas = self.caller.Consultar(
            select(
                Proveedor.IdProveedor,
                Proveedor.NombreProveedor,
                Proveedor.IdEstadoProveedor,
            ).where(Proveedor.IdProveedor == id_proveedor)
        )
        return filas[0] if filas else None

    def CodigosRegistrados(self, codigos: list[str]) -> list[str]:
        filas = self.caller.Consultar(
            select(Rodela.CodigoRodela).where(Rodela.CodigoRodela.in_(codigos))
        )
        return [fila["CodigoRodela"] for fila in filas]

    def RegistrarLote(
        self, lote: LoteRodela, rodelas: list[Rodela], id_usuario: int, observacion: str
    ) -> LoteRodela:
        try:
            self.db.add(lote)
            self.db.flush()

            for rodela in rodelas:
                rodela.IdLoteRodela = lote.IdLoteRodela
                self.db.add(rodela)
            self.db.flush()

            for rodela in rodelas:
                self.db.add(
                    MovimientoRodela(
                        IdRodela=rodela.IdRodela,
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
                detail="Ya existe una rodela registrada con ese código",
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el lote de rodelas",
            )
