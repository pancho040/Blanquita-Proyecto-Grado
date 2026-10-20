from sqlalchemy import Integer, distinct, func, select
from sqlalchemy.orm import Session

from app.Constants.Estados import MOVIMIENTO_MATERIA_PRIMA_INGRESO
from app.Models.Empaque.Reporte import ClaseEmpaque
from app.Repository.DbCaller import DbCaller
from app.Repository.Empaque.Reporte import TABLAS_CONTEO
from app.Schemas.Empaque import Empaque, LoteEmpaque, TipoEmpaque
from app.Schemas.Proveedor import Proveedor


class InicioEmpaqueRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def UltimoLote(self, clase: ClaseEmpaque) -> dict | None:
        if clase == ClaseEmpaque.bobina:
            consulta = (
                select(
                    LoteEmpaque.IdLoteEmpaque,
                    LoteEmpaque.FechaRecepcion,
                    LoteEmpaque.CantidadToneladasPedida,
                    Proveedor.NombreProveedor,
                    func.string_agg(distinct(TipoEmpaque.NombreTipoEmpaque), ", ").label("Tipos"),
                    func.count(Empaque.IdEmpaque).label("Cantidad"),
                    func.coalesce(func.sum(Empaque.PesoKg), 0).label("PesoKg"),
                )
                .join(Empaque, Empaque.IdLoteEmpaque == LoteEmpaque.IdLoteEmpaque)
                .join(TipoEmpaque, TipoEmpaque.IdTipoEmpaque == Empaque.IdTipoEmpaque)
            )
        else:
            tablas = TABLAS_CONTEO[clase]
            movimiento = tablas["movimiento"]
            consulta = (
                select(
                    LoteEmpaque.IdLoteEmpaque,
                    LoteEmpaque.FechaRecepcion,
                    LoteEmpaque.CantidadToneladasPedida,
                    Proveedor.NombreProveedor,
                    func.string_agg(distinct(tablas["nombre_tipo"]), ", ").label("Tipos"),
                    func.coalesce(func.sum(movimiento.CantidadMovimiento), 0).cast(Integer).label("Cantidad"),
                )
                .join(movimiento, movimiento.IdLoteEmpaque == LoteEmpaque.IdLoteEmpaque)
                .join(tablas["tipo"], tablas["id_tipo"] == tablas["id_tipo_movimiento"])
                .where(movimiento.IdTipoMovimiento == MOVIMIENTO_MATERIA_PRIMA_INGRESO)
            )

        consulta = (
            consulta.join(Proveedor, Proveedor.IdProveedor == LoteEmpaque.IdProveedor)
            .group_by(
                LoteEmpaque.IdLoteEmpaque,
                LoteEmpaque.FechaRecepcion,
                LoteEmpaque.CantidadToneladasPedida,
                Proveedor.NombreProveedor,
            )
            .order_by(LoteEmpaque.FechaRecepcion.desc(), LoteEmpaque.IdLoteEmpaque.desc())
            .limit(1)
        )
        filas = self.caller.Consultar(consulta)
        return filas[0] if filas else None
