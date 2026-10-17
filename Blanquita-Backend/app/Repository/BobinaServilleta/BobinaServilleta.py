from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.Constants.Estados import MOVIMIENTO_MATERIA_PRIMA_INGRESO
from app.Repository.DbCaller import DbCaller
from app.Schemas.BobinaServilleta import (
    BobinaServilleta,
    FormatoSubBobina,
    LoteBobinaServilleta,
    MovimientoBobinaServilleta,
    TipoBobinaServilleta,
    UnidadBobinaServilleta,
)
from app.Schemas.Proveedor import Proveedor


class BobinaServilletaRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def ObtenerTipoBobinaServilleta(self) -> list[dict]:
        consulta = select(
            TipoBobinaServilleta.IdTipoBobinaServilleta,
            TipoBobinaServilleta.NombreTipoBobinaServilleta,
            TipoBobinaServilleta.Activo,
        ).order_by(TipoBobinaServilleta.IdTipoBobinaServilleta)
        return self.caller.Consultar(consulta)

    def ObtenerTipo(self, id_tipo: int) -> dict | None:
        filas = self.caller.Consultar(
            select(
                TipoBobinaServilleta.IdTipoBobinaServilleta,
                TipoBobinaServilleta.NombreTipoBobinaServilleta,
                TipoBobinaServilleta.Activo,
            ).where(TipoBobinaServilleta.IdTipoBobinaServilleta == id_tipo)
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

    def IdsFormatos(self, ids_formato: list[int]) -> set[int]:
        filas = self.caller.Consultar(
            select(FormatoSubBobina.IdFormatoSubBobina).where(
                FormatoSubBobina.IdFormatoSubBobina.in_(ids_formato)
            )
        )
        return {fila["IdFormatoSubBobina"] for fila in filas}

    def CodigosRegistrados(self, codigos: list[str]) -> list[str]:
        filas = self.caller.Consultar(
            select(UnidadBobinaServilleta.CodigoBobina).where(
                UnidadBobinaServilleta.CodigoBobina.in_(codigos)
            )
        )
        return [fila["CodigoBobina"] for fila in filas]

    def RegistrarLote(
        self,
        lote: LoteBobinaServilleta,
        bobinas: list[tuple[BobinaServilleta, list[UnidadBobinaServilleta]]],
        id_usuario: int,
    ) -> LoteBobinaServilleta:
        try:
            self.db.add(lote)
            self.db.flush()

            for bobina, _ in bobinas:
                bobina.IdLoteBobinaServilleta = lote.IdLoteBobinaServilleta
                self.db.add(bobina)
            self.db.flush()

            for bobina, unidades in bobinas:
                self.db.add(
                    MovimientoBobinaServilleta(
                        IdBobinaServilleta=bobina.IdBobinaServilleta,
                        IdTipoMovimiento=MOVIMIENTO_MATERIA_PRIMA_INGRESO,
                        IdUsuario=id_usuario,
                        Observacion=f"Ingreso a almacén - Lote #{lote.IdLoteBobinaServilleta}",
                    )
                )
                for unidad in unidades:
                    unidad.IdBobinaServilleta = bobina.IdBobinaServilleta
                    self.db.add(unidad)

            self.db.commit()
            self.db.refresh(lote)
            return lote
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
                detail="No se pudo registrar el ingreso de bobinas servilleta",
            )
