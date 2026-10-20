from datetime import date

from sqlalchemy import Text, cast, func, select
from sqlalchemy.orm import Session

from app.Constants.Estados import ESTADO_MATERIA_PRIMA_ABIERTA, MOVIMIENTO_MATERIA_PRIMA_TRASLADO
from app.Repository.Consultas import ZONA_HORARIA, filtro_rango, nombre_operador
from app.Repository.DbCaller import DbCaller
from app.Schemas.MateriaPrima import TipoMovimientoMateriaPrima
from app.Schemas.Proveedor import Proveedor
from app.Schemas.Rodela import LoteRodela, MovimientoRodela, Rodela, TipoRodela
from app.Schemas.Usuario import Usuario


class InicioRodelaRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def MovimientosPorDia(self, fecha_inicio: date, fecha_fin: date) -> list[dict]:
        dia = func.date(func.timezone(ZONA_HORARIA, MovimientoRodela.FechaMovimiento))
        consulta = (
            select(
                dia.label("Fecha"),
                TipoRodela.IdTipoRodela,
                TipoRodela.NombreTipoRodela,
                MovimientoRodela.IdTipoMovimiento,
                func.count(MovimientoRodela.IdMovimientoRodela).label("Cantidad"),
            )
            .join(Rodela, Rodela.IdRodela == MovimientoRodela.IdRodela)
            .join(TipoRodela, TipoRodela.IdTipoRodela == Rodela.IdTipoRodela)
            .where(*filtro_rango(MovimientoRodela.FechaMovimiento, fecha_inicio, fecha_fin))
            .group_by(
                dia,
                TipoRodela.IdTipoRodela,
                TipoRodela.NombreTipoRodela,
                MovimientoRodela.IdTipoMovimiento,
            )
        )
        return self.caller.Consultar(consulta)

    def EnProduccion(self, limite: int) -> list[dict]:
        ultimo_traslado = (
            select(
                MovimientoRodela.IdRodela,
                func.max(MovimientoRodela.FechaMovimiento).label("FechaTraslado"),
            )
            .where(MovimientoRodela.IdTipoMovimiento == MOVIMIENTO_MATERIA_PRIMA_TRASLADO)
            .group_by(MovimientoRodela.IdRodela)
            .subquery()
        )
        consulta = (
            select(
                Rodela.IdRodela,
                Rodela.CodigoRodela,
                TipoRodela.NombreTipoRodela,
                ultimo_traslado.c.FechaTraslado,
            )
            .join(TipoRodela, TipoRodela.IdTipoRodela == Rodela.IdTipoRodela)
            .outerjoin(ultimo_traslado, ultimo_traslado.c.IdRodela == Rodela.IdRodela)
            .where(Rodela.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_ABIERTA)
            .order_by(ultimo_traslado.c.FechaTraslado.desc().nulls_last())
            .limit(limite)
        )
        return self.caller.Consultar(consulta)

    def UltimosMovimientos(self, limite: int) -> list[dict]:
        consulta = (
            select(
                MovimientoRodela.IdMovimientoRodela,
                Rodela.CodigoRodela,
                TipoRodela.NombreTipoRodela,
                MovimientoRodela.IdTipoMovimiento,
                TipoMovimientoMateriaPrima.NombreMovimiento,
                nombre_operador(Usuario).label("Usuario"),
                MovimientoRodela.FechaMovimiento,
                MovimientoRodela.Observacion,
            )
            .join(Rodela, Rodela.IdRodela == MovimientoRodela.IdRodela)
            .join(TipoRodela, TipoRodela.IdTipoRodela == Rodela.IdTipoRodela)
            .join(
                TipoMovimientoMateriaPrima,
                TipoMovimientoMateriaPrima.IdTipoMovimiento == MovimientoRodela.IdTipoMovimiento,
            )
            .join(Usuario, Usuario.IdUsuario == MovimientoRodela.IdUsuario)
            .order_by(MovimientoRodela.FechaMovimiento.desc(), MovimientoRodela.IdMovimientoRodela.desc())
            .limit(limite)
        )
        return self.caller.Consultar(consulta)

    def UltimoLote(self) -> dict | None:
        consulta = (
            select(
                LoteRodela.IdLoteRodela,
                func.concat("L-", func.lpad(cast(LoteRodela.IdLoteRodela, Text), 4, "0")).label("CodigoLote"),
                LoteRodela.FechaRecepcion,
                Proveedor.NombreProveedor,
                func.min(TipoRodela.NombreTipoRodela).label("NombreTipoRodela"),
                func.count(Rodela.IdRodela).label("CantidadRodelas"),
            )
            .join(Proveedor, Proveedor.IdProveedor == LoteRodela.IdProveedor)
            .outerjoin(Rodela, Rodela.IdLoteRodela == LoteRodela.IdLoteRodela)
            .outerjoin(TipoRodela, TipoRodela.IdTipoRodela == Rodela.IdTipoRodela)
            .group_by(LoteRodela.IdLoteRodela, LoteRodela.FechaRecepcion, Proveedor.NombreProveedor)
            .order_by(LoteRodela.FechaRecepcion.desc(), LoteRodela.IdLoteRodela.desc())
            .limit(1)
        )
        filas = self.caller.Consultar(consulta)
        return filas[0] if filas else None
