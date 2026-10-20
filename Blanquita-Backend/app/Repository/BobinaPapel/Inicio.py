from datetime import date

from sqlalchemy import Text, case, cast, exists, func, select
from sqlalchemy.orm import Session, aliased

from app.Constants.Estados import (
    ESTADO_PRODUCCION_CAMBIO_LINEA,
    ESTADO_PRODUCCION_CANCELADA,
    ESTADO_PRODUCCION_EN_PRODUCCION,
    ESTADO_PRODUCCION_FINALIZADO,
    ESTADO_PRODUCCION_PAUSA,
    MOVIMIENTO_LOGS_DESCUENTO,
    MOVIMIENTO_LOGS_INGRESO,
)
from app.Repository.Consultas import ZONA_HORARIA, filtro_rango, nombre_operador
from app.Repository.DbCaller import DbCaller
from app.Schemas.BobinaPapel import BobinaPapel, LoteBobina, TipoBobina
from app.Schemas.Produccion import (
    MovimientoOperadorLogs,
    PausaProduccionBobinaTubo,
    ProduccionBobinaTubo,
    Turno,
)
from app.Schemas.Producto import Producto
from app.Schemas.Proveedor import Proveedor
from app.Schemas.Usuario import Usuario


def _dia(columna):
    return func.date(func.timezone(ZONA_HORARIA, columna))


class InicioBobinaPapelRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def LogsPorDia(self, fecha_inicio: date, fecha_fin: date) -> list[dict]:
        mol = MovimientoOperadorLogs
        pb = ProduccionBobinaTubo
        dia = _dia(mol.FechaMovimiento)
        cantidad = case(
            (mol.IdTipoMovimientoOperadorLogs == MOVIMIENTO_LOGS_INGRESO, mol.CantidadLogs),
            (mol.IdTipoMovimientoOperadorLogs == MOVIMIENTO_LOGS_DESCUENTO, -mol.CantidadLogs),
            else_=0,
        )
        consulta = (
            select(
                dia.label("Fecha"),
                Producto.IdProducto,
                Producto.NombreProducto,
                func.coalesce(func.sum(cantidad), 0).label("Logs"),
            )
            .select_from(mol)
            .join(pb, pb.IdProduccionBobinaTubo == mol.IdProduccionBobinaTubo)
            .join(Producto, Producto.IdProducto == pb.IdProducto)
            .where(*filtro_rango(mol.FechaMovimiento, fecha_inicio, fecha_fin))
            .group_by(dia, Producto.IdProducto, Producto.NombreProducto)
        )
        return self.caller.Consultar(consulta)

    def CargadasPorDia(self, fecha_inicio: date, fecha_fin: date) -> list[dict]:
        pb = ProduccionBobinaTubo
        anterior = aliased(ProduccionBobinaTubo)
        dia = _dia(pb.FechaInicioProduccion)
        viene_de_cambio_linea = exists().where(
            anterior.IdBobina_1 == pb.IdBobina_1,
            anterior.IdBobina_2 == pb.IdBobina_2,
            anterior.IdProduccionBobinaTubo < pb.IdProduccionBobinaTubo,
            anterior.IdEstadoProduccion == ESTADO_PRODUCCION_CAMBIO_LINEA,
        )
        consulta = (
            select(
                dia.label("Fecha"),
                Producto.IdProducto,
                Producto.NombreProducto,
                func.count(pb.IdProduccionBobinaTubo).label("Cargadas"),
            )
            .join(Producto, Producto.IdProducto == pb.IdProducto)
            .where(
                *filtro_rango(pb.FechaInicioProduccion, fecha_inicio, fecha_fin),
                ~viene_de_cambio_linea,
            )
            .group_by(dia, Producto.IdProducto, Producto.NombreProducto)
        )
        return self.caller.Consultar(consulta)

    def CierresPorEstado(self, fecha_inicio: date, fecha_fin: date) -> list[dict]:
        pb = ProduccionBobinaTubo
        consulta = (
            select(
                pb.IdEstadoProduccion,
                func.count(pb.IdProduccionBobinaTubo).label("Cantidad"),
            )
            .where(
                pb.IdEstadoProduccion.in_(
                    (
                        ESTADO_PRODUCCION_FINALIZADO,
                        ESTADO_PRODUCCION_CANCELADA,
                        ESTADO_PRODUCCION_CAMBIO_LINEA,
                    )
                ),
                *filtro_rango(pb.FechaFinProduccion, fecha_inicio, fecha_fin),
            )
            .group_by(pb.IdEstadoProduccion)
        )
        return self.caller.Consultar(consulta)

    def Pausas(self, fecha_inicio: date, fecha_fin: date) -> list[dict]:
        pausa = PausaProduccionBobinaTubo
        consulta = select(
            pausa.MotivoPausaProduccion,
            pausa.FechaHoraPausa,
            pausa.FechaHoraReanudacion,
        ).where(*filtro_rango(pausa.FechaHoraPausa, fecha_inicio, fecha_fin))
        return self.caller.Consultar(consulta)

    def Activas(self) -> list[dict]:
        pb = ProduccionBobinaTubo
        b1 = aliased(BobinaPapel)
        b2 = aliased(BobinaPapel)
        consulta = (
            select(
                pb.IdProduccionBobinaTubo,
                TipoBobina.NombreTipoBobina,
                Producto.NombreProducto,
                b1.CodigoBobina.label("CodigoBobina1"),
                b2.CodigoBobina.label("CodigoBobina2"),
                Turno.NombreTurno,
                nombre_operador(Usuario).label("Operador"),
                pb.FechaInicioProduccion,
                pb.CantidadLogsActual,
            )
            .join(b1, b1.IdBobinaPapel == pb.IdBobina_1)
            .join(b2, b2.IdBobinaPapel == pb.IdBobina_2)
            .join(TipoBobina, TipoBobina.IdTipoBobina == b1.IdTipoBobina)
            .join(Producto, Producto.IdProducto == pb.IdProducto)
            .join(Turno, Turno.IdTurno == pb.IdTurno)
            .join(Usuario, Usuario.IdUsuario == pb.IdUsuario)
            .where(pb.IdEstadoProduccion == ESTADO_PRODUCCION_EN_PRODUCCION)
            .order_by(pb.FechaInicioProduccion)
        )
        return self.caller.Consultar(consulta)

    def PausasAbiertas(self) -> list[dict]:
        pausa = PausaProduccionBobinaTubo
        pb = ProduccionBobinaTubo
        b1 = aliased(BobinaPapel)
        b2 = aliased(BobinaPapel)
        consulta = (
            select(
                pausa.IdPausaProduccionBobinaTubo,
                pausa.IdProduccionBobinaTubo,
                TipoBobina.NombreTipoBobina,
                Producto.NombreProducto,
                b1.CodigoBobina.label("CodigoBobina1"),
                b2.CodigoBobina.label("CodigoBobina2"),
                pausa.MotivoPausaProduccion,
                nombre_operador(Usuario).label("Operador"),
                pausa.FechaHoraPausa,
                pb.CantidadLogsActual,
            )
            .join(pb, pb.IdProduccionBobinaTubo == pausa.IdProduccionBobinaTubo)
            .join(b1, b1.IdBobinaPapel == pb.IdBobina_1)
            .join(b2, b2.IdBobinaPapel == pb.IdBobina_2)
            .join(TipoBobina, TipoBobina.IdTipoBobina == b1.IdTipoBobina)
            .join(Producto, Producto.IdProducto == pb.IdProducto)
            .join(Usuario, Usuario.IdUsuario == pausa.IdUsuario)
            .where(
                pb.IdEstadoProduccion == ESTADO_PRODUCCION_PAUSA,
                pausa.FechaHoraReanudacion.is_(None),
            )
            .order_by(pausa.FechaHoraPausa)
        )
        return self.caller.Consultar(consulta)

    def UltimoLote(self) -> dict | None:
        consulta = (
            select(
                LoteBobina.IdLoteBobina,
                func.concat("L-", func.lpad(cast(LoteBobina.IdLoteBobina, Text), 4, "0")).label(
                    "CodigoLote"
                ),
                LoteBobina.FechaRecepcion,
                Proveedor.NombreProveedor,
                func.min(TipoBobina.NombreTipoBobina).label("NombreTipoBobina"),
                func.count(BobinaPapel.IdBobinaPapel).label("CantidadBobinas"),
                func.coalesce(func.sum(BobinaPapel.PesoNetoKg), 0).label("PesoNetoTotalKg"),
            )
            .join(Proveedor, Proveedor.IdProveedor == LoteBobina.IdProveedor)
            .outerjoin(BobinaPapel, BobinaPapel.IdLoteBobina == LoteBobina.IdLoteBobina)
            .outerjoin(TipoBobina, TipoBobina.IdTipoBobina == BobinaPapel.IdTipoBobina)
            .group_by(
                LoteBobina.IdLoteBobina,
                LoteBobina.FechaRecepcion,
                Proveedor.NombreProveedor,
            )
            .order_by(LoteBobina.FechaRecepcion.desc(), LoteBobina.IdLoteBobina.desc())
            .limit(1)
        )
        filas = self.caller.Consultar(consulta)
        return filas[0] if filas else None
