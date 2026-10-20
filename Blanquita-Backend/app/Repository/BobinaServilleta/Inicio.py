from datetime import date

from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from app.Constants.Estados import (
    ESTADO_PRODUCCION_CANCELADA,
    ESTADO_PRODUCCION_EN_PRODUCCION,
    ESTADO_PRODUCCION_FINALIZADO,
    ESTADO_PRODUCCION_PAUSA,
    MOVIMIENTO_MATERIA_PRIMA_TRASLADO,
)
from app.Repository.Consultas import ZONA_HORARIA, filtro_rango, nombre_operador
from app.Repository.DbCaller import DbCaller
from app.Schemas.BobinaServilleta import (
    BobinaServilleta,
    LoteBobinaServilleta,
    MovimientoBobinaServilleta,
    SubBobinaServilleta,
    TipoBobinaServilleta,
    TipoMedidaSubBobina,
    UnidadBobinaServilleta,
)
from app.Schemas.Produccion import PausaProduccionServilleta, ProduccionServilleta, Turno
from app.Schemas.Proveedor import Proveedor
from app.Schemas.Usuario import Usuario


def _dia(columna):
    return func.date(func.timezone(ZONA_HORARIA, columna))


def _con_origen(consulta):
    return (
        consulta.join(
            SubBobinaServilleta,
            SubBobinaServilleta.IdSubBobinaServilleta == ProduccionServilleta.IdSubBobina,
        )
        .join(
            TipoMedidaSubBobina,
            TipoMedidaSubBobina.IdTipoMedidaSubBobina == SubBobinaServilleta.IdTipoMedidaSubBobina,
        )
        .join(
            UnidadBobinaServilleta,
            UnidadBobinaServilleta.IdUnidadBobinaServilleta == SubBobinaServilleta.IdUnidadBobinaServilleta,
        )
        .join(
            BobinaServilleta,
            BobinaServilleta.IdBobinaServilleta == UnidadBobinaServilleta.IdBobinaServilleta,
        )
        .join(
            TipoBobinaServilleta,
            TipoBobinaServilleta.IdTipoBobinaServilleta == BobinaServilleta.IdTipoBobinaServilleta,
        )
    )


class InicioBobinaServilletaRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def _ProduccionesPorDia(self, columna, fecha_inicio: date, fecha_fin: date, *condiciones) -> list[dict]:
        ps = ProduccionServilleta
        dia = _dia(columna)
        consulta = (
            select(
                dia.label("Fecha"),
                TipoMedidaSubBobina.IdTipoMedidaSubBobina,
                TipoMedidaSubBobina.MedidaMm,
                func.count(ps.IdProduccionServilleta).label("Cantidad"),
            )
            .select_from(ps)
            .join(SubBobinaServilleta, SubBobinaServilleta.IdSubBobinaServilleta == ps.IdSubBobina)
            .join(
                TipoMedidaSubBobina,
                TipoMedidaSubBobina.IdTipoMedidaSubBobina == SubBobinaServilleta.IdTipoMedidaSubBobina,
            )
            .where(*filtro_rango(columna, fecha_inicio, fecha_fin), *condiciones)
            .group_by(dia, TipoMedidaSubBobina.IdTipoMedidaSubBobina, TipoMedidaSubBobina.MedidaMm)
        )
        return self.caller.Consultar(consulta)

    def IniciadasPorDia(self, fecha_inicio: date, fecha_fin: date) -> list[dict]:
        return self._ProduccionesPorDia(ProduccionServilleta.FechaInicioProduccion, fecha_inicio, fecha_fin)

    def FinalizadasPorDia(self, fecha_inicio: date, fecha_fin: date) -> list[dict]:
        return self._ProduccionesPorDia(
            ProduccionServilleta.FechaFinProduccion,
            fecha_inicio,
            fecha_fin,
            ProduccionServilleta.IdEstadoProduccion == ESTADO_PRODUCCION_FINALIZADO,
        )

    def Canceladas(self, fecha_inicio: date, fecha_fin: date) -> int:
        ps = ProduccionServilleta
        filas = self.caller.Consultar(
            select(func.count(ps.IdProduccionServilleta).label("Cantidad")).where(
                ps.IdEstadoProduccion == ESTADO_PRODUCCION_CANCELADA,
                *filtro_rango(ps.FechaFinProduccion, fecha_inicio, fecha_fin),
            )
        )
        return int(filas[0]["Cantidad"]) if filas else 0

    def BobinasAbiertas(self, fecha_inicio: date, fecha_fin: date) -> int:
        movimiento = MovimientoBobinaServilleta
        filas = self.caller.Consultar(
            select(func.count(distinct(movimiento.IdBobinaServilleta)).label("Cantidad")).where(
                movimiento.IdTipoMovimiento == MOVIMIENTO_MATERIA_PRIMA_TRASLADO,
                *filtro_rango(movimiento.FechaMovimiento, fecha_inicio, fecha_fin),
            )
        )
        return int(filas[0]["Cantidad"]) if filas else 0

    def Pausas(self, fecha_inicio: date, fecha_fin: date) -> list[dict]:
        pausa = PausaProduccionServilleta
        consulta = select(
            pausa.MotivoPausaProduccion,
            pausa.FechaHoraPausa,
            pausa.FechaHoraReanudacion,
        ).where(*filtro_rango(pausa.FechaHoraPausa, fecha_inicio, fecha_fin))
        return self.caller.Consultar(consulta)

    def Activas(self) -> list[dict]:
        ps = ProduccionServilleta
        consulta = _con_origen(
            select(
                ps.IdProduccionServilleta,
                TipoMedidaSubBobina.MedidaMm,
                UnidadBobinaServilleta.CodigoBobina.label("CodigoUnidadOrigen"),
                TipoBobinaServilleta.NombreTipoBobinaServilleta,
                Turno.NombreTurno,
                nombre_operador(Usuario).label("Operador"),
                ps.FechaInicioProduccion,
            ).select_from(ps)
        )
        consulta = (
            consulta.join(Turno, Turno.IdTurno == ps.IdTurno)
            .join(Usuario, Usuario.IdUsuario == ps.IdUsuario)
            .where(ps.IdEstadoProduccion == ESTADO_PRODUCCION_EN_PRODUCCION)
            .order_by(ps.FechaInicioProduccion)
        )
        return self.caller.Consultar(consulta)

    def PausasAbiertas(self) -> list[dict]:
        ps = ProduccionServilleta
        pausa = PausaProduccionServilleta
        consulta = _con_origen(
            select(
                pausa.IdPausaProduccionServilleta,
                pausa.IdProduccionServilleta,
                TipoMedidaSubBobina.MedidaMm,
                UnidadBobinaServilleta.CodigoBobina.label("CodigoUnidadOrigen"),
                TipoBobinaServilleta.NombreTipoBobinaServilleta,
                pausa.MotivoPausaProduccion,
                nombre_operador(Usuario).label("Operador"),
                pausa.FechaHoraPausa,
            )
            .select_from(pausa)
            .join(ps, ps.IdProduccionServilleta == pausa.IdProduccionServilleta)
        )
        consulta = (
            consulta.join(Usuario, Usuario.IdUsuario == pausa.IdUsuario)
            .where(
                ps.IdEstadoProduccion == ESTADO_PRODUCCION_PAUSA,
                pausa.FechaHoraReanudacion.is_(None),
            )
            .order_by(pausa.FechaHoraPausa)
        )
        return self.caller.Consultar(consulta)

    def UltimoLote(self) -> dict | None:
        lote = LoteBobinaServilleta
        consulta = (
            select(
                lote.IdLoteBobinaServilleta,
                lote.FechaRecepcion,
                Proveedor.NombreProveedor,
                func.min(TipoBobinaServilleta.NombreTipoBobinaServilleta).label("NombreTipoBobinaServilleta"),
                func.count(distinct(BobinaServilleta.IdBobinaServilleta)).label("CantidadBobinas"),
                func.coalesce(func.sum(UnidadBobinaServilleta.PesoBrutoKg), 0).label("PesoBrutoTotalKg"),
            )
            .join(Proveedor, Proveedor.IdProveedor == lote.IdProveedor)
            .outerjoin(BobinaServilleta, BobinaServilleta.IdLoteBobinaServilleta == lote.IdLoteBobinaServilleta)
            .outerjoin(
                TipoBobinaServilleta,
                TipoBobinaServilleta.IdTipoBobinaServilleta == BobinaServilleta.IdTipoBobinaServilleta,
            )
            .outerjoin(
                UnidadBobinaServilleta,
                UnidadBobinaServilleta.IdBobinaServilleta == BobinaServilleta.IdBobinaServilleta,
            )
            .group_by(lote.IdLoteBobinaServilleta, lote.FechaRecepcion, Proveedor.NombreProveedor)
            .order_by(lote.FechaRecepcion.desc(), lote.IdLoteBobinaServilleta.desc())
            .limit(1)
        )
        filas = self.caller.Consultar(consulta)
        return filas[0] if filas else None
