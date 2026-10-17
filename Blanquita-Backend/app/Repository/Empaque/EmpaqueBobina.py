from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.Constants.Estados import ESTADO_MATERIA_PRIMA_EN_ALMACEN, MOVIMIENTO_MATERIA_PRIMA_INGRESO
from app.Repository.DbCaller import DbCaller
from app.Schemas.Empaque import Empaque, LoteEmpaque, MovimientoEmpaque, TipoEmpaque
from app.Schemas.Proveedor import Proveedor


class EmpaqueBobinaRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def VerResumenInventarioEmpaque(self) -> list[dict]:
        consulta = (
            select(
                TipoEmpaque.IdTipoEmpaque,
                TipoEmpaque.NombreTipoEmpaque,
                TipoEmpaque.Activo,
                func.count(Empaque.IdEmpaque).label("CantidadEmpaques"),
            )
            .outerjoin(
                Empaque,
                and_(
                    Empaque.IdTipoEmpaque == TipoEmpaque.IdTipoEmpaque,
                    Empaque.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN,
                ),
            )
            .group_by(TipoEmpaque.IdTipoEmpaque, TipoEmpaque.NombreTipoEmpaque, TipoEmpaque.Activo)
            .order_by(TipoEmpaque.IdTipoEmpaque)
        )
        return self.caller.Consultar(consulta)

    def VerDetalleInventarioEmpaque(self, id_tipo_empaque: int) -> list[dict]:
        consulta = (
            select(
                Empaque.IdEmpaque,
                Empaque.CodigoEmpaque,
                Empaque.PesoKg,
                LoteEmpaque.FechaRecepcion,
                Proveedor.NombreProveedor,
            )
            .join(LoteEmpaque, LoteEmpaque.IdLoteEmpaque == Empaque.IdLoteEmpaque)
            .join(Proveedor, Proveedor.IdProveedor == LoteEmpaque.IdProveedor)
            .where(
                Empaque.IdTipoEmpaque == id_tipo_empaque,
                Empaque.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN,
            )
            .order_by(LoteEmpaque.FechaRecepcion)
        )
        return self.caller.Consultar(consulta)

    def ObtenerTipoEmpaque(self) -> list[dict]:
        consulta = select(
            TipoEmpaque.IdTipoEmpaque,
            TipoEmpaque.NombreTipoEmpaque,
            TipoEmpaque.Activo,
        ).order_by(TipoEmpaque.IdTipoEmpaque)
        return self.caller.Consultar(consulta)

    def ObtenerProveedor(self, id_proveedor: int) -> dict | None:
        filas = self.caller.Consultar(
            select(
                Proveedor.IdProveedor,
                Proveedor.NombreProveedor,
                Proveedor.IdEstadoProveedor,
            ).where(Proveedor.IdProveedor == id_proveedor)
        )
        return filas[0] if filas else None

    def ObtenerTipos(self, ids_tipo_empaque: list[int]) -> dict[int, dict]:
        filas = self.caller.Consultar(
            select(
                TipoEmpaque.IdTipoEmpaque,
                TipoEmpaque.NombreTipoEmpaque,
                TipoEmpaque.Activo,
            ).where(TipoEmpaque.IdTipoEmpaque.in_(ids_tipo_empaque))
        )
        return {fila["IdTipoEmpaque"]: fila for fila in filas}

    def CodigosRegistrados(self, codigos: list[str]) -> list[str]:
        filas = self.caller.Consultar(
            select(Empaque.CodigoEmpaque).where(Empaque.CodigoEmpaque.in_(codigos))
        )
        return [fila["CodigoEmpaque"] for fila in filas]

    def RegistrarLote(
        self, lote: LoteEmpaque, empaques: list[Empaque], id_usuario: int, observacion: str
    ) -> LoteEmpaque:
        try:
            self.db.add(lote)
            self.db.flush()

            for empaque in empaques:
                empaque.IdLoteEmpaque = lote.IdLoteEmpaque
                self.db.add(empaque)
            self.db.flush()

            for empaque in empaques:
                self.db.add(
                    MovimientoEmpaque(
                        IdEmpaque=empaque.IdEmpaque,
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
                detail="Ya existe un empaque registrado con ese código",
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el lote de empaques",
            )

    def ObtenerEmpaquesBloqueados(self, ids_empaque: list[int]) -> dict[int, Empaque]:
        try:
            empaques = self.db.scalars(
                select(Empaque)
                .where(Empaque.IdEmpaque.in_(ids_empaque))
                .order_by(Empaque.IdEmpaque)
                .with_for_update()
            ).all()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener los empaques",
            )
        return {empaque.IdEmpaque: empaque for empaque in empaques}

    def RegistrarTraslado(
        self, empaques: list[Empaque], movimientos: list[MovimientoEmpaque], id_estado: int
    ) -> list[MovimientoEmpaque]:
        try:
            for empaque in empaques:
                empaque.IdEstadoMateriaPrima = id_estado
            self.db.add_all(movimientos)
            self.db.commit()
            for movimiento in movimientos:
                self.db.refresh(movimiento)
            return movimientos
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo trasladar los empaques a producción",
            )

    def Revertir(self) -> None:
        self.db.rollback()
