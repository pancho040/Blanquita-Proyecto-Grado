from sqlalchemy import Text, and_, case, cast, func, or_, select
from sqlalchemy.orm import Session, aliased

from app.Repository.DbCaller import DbCaller
from app.Repository.Consultas import (
    filtro_rango as _filtro_rango,
    nombre_operador as _nombre_operador,
)
from app.Constants.Estados import ESTADO_MATERIA_PRIMA_EN_ALMACEN
from app.Schemas.BobinaPapel import BobinaPapel, LoteBobina, MovimientoBobina, TipoBobina
from app.Schemas.MateriaPrima import EstadoMateriaPrima, TipoMovimientoMateriaPrima
from app.Schemas.Produccion import (
    CancelacionProduccionBobinaTubo,
    EstadoProduccion,
    MovimientoOperadorLogs,
    PausaProduccionBobinaTubo,
    ProduccionBobinaTubo,
    TipoMovimientoOperadorLogs,
    Turno,
)
from app.Schemas.Producto import Producto
from app.Schemas.Proveedor import Proveedor
from app.Schemas.Usuario import Rol, Usuario


class ReporteBobinaPapelRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def ReporteInventario(self, params: dict) -> list[dict]:
        por_tipo = {"partition_by": BobinaPapel.IdTipoBobina}
        consulta = (
            select(
                func.now().label("FechaGeneracion"),
                func.count().over().label("TotalBobinasInforme"),
                func.coalesce(func.sum(BobinaPapel.PesoNetoKg).over(), 0).label("PesoNetoGeneralKg"),
                TipoBobina.IdTipoBobina,
                TipoBobina.NombreTipoBobina,
                func.count().over(**por_tipo).label("CantidadBobinasTipo"),
                func.coalesce(func.sum(BobinaPapel.PesoNetoKg).over(**por_tipo), 0).label(
                    "PesoNetoTotalTipoKg"
                ),
                func.coalesce(func.round(func.avg(BobinaPapel.Gramaje).over(**por_tipo), 2), 0).label(
                    "GramajePromedioTipo"
                ),
                func.min(LoteBobina.FechaRecepcion).over(**por_tipo).label("RecepcionMasAntiguaTipo"),
                func.max(LoteBobina.FechaRecepcion).over(**por_tipo).label("RecepcionMasRecienteTipo"),
                BobinaPapel.IdBobinaPapel,
                BobinaPapel.CodigoBobina,
                cast(LoteBobina.IdLoteBobina, Text).label("CodigoLote"),
                LoteBobina.FechaRecepcion,
                Proveedor.NombreProveedor,
                BobinaPapel.PesoBrutoKg,
                BobinaPapel.PesoNetoKg,
                BobinaPapel.Gramaje,
            )
            .join(TipoBobina, TipoBobina.IdTipoBobina == BobinaPapel.IdTipoBobina)
            .join(LoteBobina, LoteBobina.IdLoteBobina == BobinaPapel.IdLoteBobina)
            .join(Proveedor, Proveedor.IdProveedor == LoteBobina.IdProveedor)
            .where(BobinaPapel.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN)
            .order_by(TipoBobina.NombreTipoBobina, LoteBobina.FechaRecepcion, BobinaPapel.CodigoBobina)
        )

        if params.get("p_IdsTipoBobina"):
            consulta = consulta.where(BobinaPapel.IdTipoBobina.in_(params["p_IdsTipoBobina"]))

        return self.caller.Consultar(consulta)

    def VerProduccionesBobinaTubo(self, params: dict) -> list[dict]:
        pb = ProduccionBobinaTubo
        b1 = aliased(BobinaPapel)
        b2 = aliased(BobinaPapel)
        misma_cargada = aliased(ProduccionBobinaTubo)
        fecha_referencia = func.coalesce(pb.FechaFinProduccion, pb.FechaInicioProduccion)

        cantidad_cargada = (
            select(func.count())
            .where(
                misma_cargada.IdBobina_1 == pb.IdBobina_1,
                misma_cargada.IdBobina_2 == pb.IdBobina_2,
            )
            .correlate(pb)
            .scalar_subquery()
            .label("CantidadCargada")
        )

        consulta = (
            select(
                pb.IdProduccionBobinaTubo,
                EstadoProduccion.NombreEstadoProduccion,
                Turno.NombreTurno,
                _nombre_operador(Usuario).label("Operador"),
                Usuario.Ci,
                Rol.NombreRol,
                Producto.IdProducto,
                Producto.NombreProducto,
                b1.CodigoBobina.label("CodigoBobina1"),
                b2.CodigoBobina.label("CodigoBobina2"),
                pb.FechaInicioProduccion,
                pb.FechaFinProduccion,
                (pb.FechaFinProduccion - pb.FechaInicioProduccion).label("DuracionTotal"),
                pb.CantidadLogsActual,
                cantidad_cargada,
            )
            .join(b1, b1.IdBobinaPapel == pb.IdBobina_1)
            .join(b2, b2.IdBobinaPapel == pb.IdBobina_2)
            .join(Producto, Producto.IdProducto == pb.IdProducto)
            .join(Turno, Turno.IdTurno == pb.IdTurno)
            .join(EstadoProduccion, EstadoProduccion.IdEstadoProduccion == pb.IdEstadoProduccion)
            .join(Usuario, Usuario.IdUsuario == pb.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .where(
                *_filtro_rango(
                    fecha_referencia, params.get("p_FechaInicio"), params.get("p_FechaFin")
                )
            )
            .order_by(pb.FechaInicioProduccion.desc(), pb.IdProduccionBobinaTubo.desc())
        )

        if params.get("p_IdsEstadoProduccion"):
            consulta = consulta.where(
                pb.IdEstadoProduccion.in_(params["p_IdsEstadoProduccion"])
            )

        if params.get("p_IdTurno") is not None:
            consulta = consulta.where(pb.IdTurno == params["p_IdTurno"])

        if params.get("p_IdsProducto"):
            consulta = consulta.where(pb.IdProducto.in_(params["p_IdsProducto"]))

        codigo = params.get("p_CodigoBobina")
        if codigo:
            consulta = consulta.where(or_(func.upper(b1.CodigoBobina) == codigo, func.upper(b2.CodigoBobina) == codigo))

        operador = params.get("p_Operador")
        if operador:
            consulta = consulta.where(
                or_(
                    Usuario.Ci == operador,
                    _nombre_operador(Usuario).ilike(f"%{operador}%"),
                )
            )

        if params.get("p_IdEstadoProduccion") is not None:
            consulta = consulta.where(pb.IdEstadoProduccion == params["p_IdEstadoProduccion"])

        return self.caller.Consultar(consulta)

    def ReporteProduccionBobinaTuboDetalle(self, params: dict) -> dict | None:
        pb = ProduccionBobinaTubo
        b1 = aliased(BobinaPapel)
        b2 = aliased(BobinaPapel)
        lote1 = aliased(LoteBobina)
        lote2 = aliased(LoteBobina)
        prov1 = aliased(Proveedor)
        prov2 = aliased(Proveedor)

        consulta = (
            select(
                pb.IdProduccionBobinaTubo,
                pb.IdBobina_1.label("IdBobina1"),
                pb.IdBobina_2.label("IdBobina2"),
                EstadoProduccion.NombreEstadoProduccion,
                Turno.NombreTurno,
                _nombre_operador(Usuario).label("Operador"),
                Usuario.Ci,
                Rol.NombreRol,
                Producto.IdProducto,
                Producto.NombreProducto,
                TipoBobina.NombreTipoBobina.label("TipoBobina"),
                b1.CodigoBobina.label("CodigoBobina1"),
                b1.PesoNetoKg.label("PesoNeto1"),
                b1.Gramaje.label("Gramaje1"),
                prov1.NombreProveedor.label("Proveedor1"),
                lote1.FechaRecepcion.label("Recepcion1"),
                b2.CodigoBobina.label("CodigoBobina2"),
                b2.PesoNetoKg.label("PesoNeto2"),
                b2.Gramaje.label("Gramaje2"),
                prov2.NombreProveedor.label("Proveedor2"),
                lote2.FechaRecepcion.label("Recepcion2"),
                pb.FechaInicioProduccion,
                pb.FechaFinProduccion,
                (pb.FechaFinProduccion - pb.FechaInicioProduccion).label("DuracionTotal"),
                pb.CantidadLogsActual,
            )
            .join(b1, b1.IdBobinaPapel == pb.IdBobina_1)
            .join(b2, b2.IdBobinaPapel == pb.IdBobina_2)
            .join(TipoBobina, TipoBobina.IdTipoBobina == b1.IdTipoBobina)
            .join(lote1, lote1.IdLoteBobina == b1.IdLoteBobina)
            .join(lote2, lote2.IdLoteBobina == b2.IdLoteBobina)
            .join(prov1, prov1.IdProveedor == lote1.IdProveedor)
            .join(prov2, prov2.IdProveedor == lote2.IdProveedor)
            .join(Producto, Producto.IdProducto == pb.IdProducto)
            .join(Turno, Turno.IdTurno == pb.IdTurno)
            .join(EstadoProduccion, EstadoProduccion.IdEstadoProduccion == pb.IdEstadoProduccion)
            .join(Usuario, Usuario.IdUsuario == pb.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .where(pb.IdProduccionBobinaTubo == params["p_IdProduccion"])
        )

        filas = self.caller.Consultar(consulta)
        return filas[0] if filas else None

    def ProduccionesDeCargada(self, params: dict) -> list[dict]:
        pb = ProduccionBobinaTubo

        consulta = (
            select(
                pb.IdProduccionBobinaTubo,
                Producto.NombreProducto,
                EstadoProduccion.NombreEstadoProduccion,
                Turno.NombreTurno,
                _nombre_operador(Usuario).label("Operador"),
                pb.FechaInicioProduccion,
                pb.FechaFinProduccion,
                (pb.FechaFinProduccion - pb.FechaInicioProduccion).label("DuracionTotal"),
                pb.CantidadLogsActual,
            )
            .join(Producto, Producto.IdProducto == pb.IdProducto)
            .join(Turno, Turno.IdTurno == pb.IdTurno)
            .join(EstadoProduccion, EstadoProduccion.IdEstadoProduccion == pb.IdEstadoProduccion)
            .join(Usuario, Usuario.IdUsuario == pb.IdUsuario)
            .where(
                pb.IdBobina_1 == params["p_IdBobina1"],
                pb.IdBobina_2 == params["p_IdBobina2"],
            )
            .order_by(pb.FechaInicioProduccion)
        )

        return self.caller.Consultar(consulta)

    def ReportePausasProduccionBobinaTubo(self, params: dict) -> list[dict]:
        pausa = PausaProduccionBobinaTubo
        pb = ProduccionBobinaTubo
        b1 = aliased(BobinaPapel)
        b2 = aliased(BobinaPapel)

        consulta = (
            select(
                pausa.IdPausaProduccionBobinaTubo,
                pausa.IdProduccionBobinaTubo,
                Producto.NombreProducto,
                b1.CodigoBobina.label("CodigoBobina1"),
                b2.CodigoBobina.label("CodigoBobina2"),
                Turno.NombreTurno,
                pausa.FechaHoraPausa,
                pausa.MotivoPausaProduccion,
                pausa.FechaHoraReanudacion,
                pausa.MotivoReanudacion,
                (pausa.FechaHoraReanudacion - pausa.FechaHoraPausa).label("DuracionPausa"),
                _nombre_operador(Usuario).label("OperadorPausa"),
                Rol.NombreRol.label("RolPausa"),
                case(
                    (pausa.FechaHoraReanudacion.is_(None), "Abierta"),
                    else_="Cerrada",
                ).label("EstadoPausa"),
            )
            .join(pb, pb.IdProduccionBobinaTubo == pausa.IdProduccionBobinaTubo)
            .join(b1, b1.IdBobinaPapel == pb.IdBobina_1)
            .join(b2, b2.IdBobinaPapel == pb.IdBobina_2)
            .join(Producto, Producto.IdProducto == pb.IdProducto)
            .join(Turno, Turno.IdTurno == pb.IdTurno)
            .join(Usuario, Usuario.IdUsuario == pausa.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .where(
                *_filtro_rango(
                    pausa.FechaHoraPausa, params.get("p_FechaInicio"), params.get("p_FechaFin")
                )
            )
            .order_by(pausa.FechaHoraPausa.desc())
        )

        if params.get("p_IdProduccion") is not None:
            consulta = consulta.where(pausa.IdProduccionBobinaTubo == params["p_IdProduccion"])

        if params.get("p_IdTurno") is not None:
            consulta = consulta.where(pb.IdTurno == params["p_IdTurno"])

        solo_abiertas = params.get("p_SoloAbiertas")
        if solo_abiertas is True:
            consulta = consulta.where(pausa.FechaHoraReanudacion.is_(None))
        elif solo_abiertas is False:
            consulta = consulta.where(pausa.FechaHoraReanudacion.is_not(None))

        return self.caller.Consultar(consulta)

    def ReporteMovimientosOperadorLogs(self, params: dict) -> list[dict]:
        mol = MovimientoOperadorLogs

        consulta = (
            select(
                mol.IdMovimientoOperadorLogs,
                mol.IdProduccionBobinaTubo,
                mol.CantidadLogs,
                mol.FechaMovimiento,
                mol.Observacion,
                TipoMovimientoOperadorLogs.NombreMovimiento,
                Usuario.Ci,
                Usuario.PrimerNombre,
                Usuario.ApellidoPaterno,
                Rol.NombreRol,
            )
            .join(
                TipoMovimientoOperadorLogs,
                TipoMovimientoOperadorLogs.IdTipoMovimientoOperadorLogs
                == mol.IdTipoMovimientoOperadorLogs,
            )
            .join(Usuario, Usuario.IdUsuario == mol.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .where(mol.IdProduccionBobinaTubo == params["p_IdProduccion"])
            .order_by(mol.FechaMovimiento)
        )

        return self.caller.Consultar(consulta)

    def ReporteCancelacionProduccionBobinaTubo(self, params: dict) -> dict | None:
        cancelacion = CancelacionProduccionBobinaTubo

        consulta = (
            select(
                cancelacion.FechaHoraCancelacion,
                cancelacion.MotivoCancelacion,
                Usuario.Ci,
                _nombre_operador(Usuario).label("Operador"),
                Rol.NombreRol,
            )
            .join(Usuario, Usuario.IdUsuario == cancelacion.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .where(cancelacion.IdProduccionBobinaTubo == params["p_IdProduccion"])
            .order_by(cancelacion.FechaHoraCancelacion.desc())
            .limit(1)
        )

        filas = self.caller.Consultar(consulta)
        return filas[0] if filas else None

    def VerCancelacionesProduccionBobinaTubo(self, params: dict) -> list[dict]:
        cancelacion = CancelacionProduccionBobinaTubo
        pb = ProduccionBobinaTubo

        consulta = (
            select(
                cancelacion.IdProduccionBobinaTubo,
                Producto.NombreProducto,
                cancelacion.FechaHoraCancelacion,
                cancelacion.MotivoCancelacion,
                Usuario.Ci,
                Usuario.PrimerNombre,
                Usuario.ApellidoPaterno,
                Rol.NombreRol,
            )
            .join(pb, pb.IdProduccionBobinaTubo == cancelacion.IdProduccionBobinaTubo)
            .join(Producto, Producto.IdProducto == pb.IdProducto)
            .join(Usuario, Usuario.IdUsuario == cancelacion.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .where(
                *_filtro_rango(
                    cancelacion.FechaHoraCancelacion,
                    params.get("p_FechaInicio"),
                    params.get("p_FechaFin"),
                )
            )
            .order_by(cancelacion.FechaHoraCancelacion.desc())
        )

        return self.caller.Consultar(consulta)

    def VerLotesBobinaPapel(self, params: dict) -> list[dict]:
        condiciones_bobina = [BobinaPapel.IdLoteBobina == LoteBobina.IdLoteBobina]
        if params.get("p_IdsTipoBobina"):
            condiciones_bobina.append(BobinaPapel.IdTipoBobina.in_(params["p_IdsTipoBobina"]))

        cantidad = func.count(BobinaPapel.IdBobinaPapel)
        consulta = (
            select(
                LoteBobina.IdLoteBobina,
                LoteBobina.FechaRecepcion,
                Proveedor.NombreProveedor,
                cantidad.label("CantidadBobinas"),
            )
            .join(Proveedor, Proveedor.IdProveedor == LoteBobina.IdProveedor)
            .outerjoin(BobinaPapel, and_(*condiciones_bobina))
            .group_by(LoteBobina.IdLoteBobina, LoteBobina.FechaRecepcion, Proveedor.NombreProveedor)
            .order_by(LoteBobina.FechaRecepcion.desc())
        )

        if params.get("p_FechaInicio") is not None:
            consulta = consulta.where(LoteBobina.FechaRecepcion >= params["p_FechaInicio"])
        if params.get("p_FechaFin") is not None:
            consulta = consulta.where(LoteBobina.FechaRecepcion <= params["p_FechaFin"])
        if params.get("p_IdProveedor") is not None:
            consulta = consulta.where(LoteBobina.IdProveedor == params["p_IdProveedor"])
        if params.get("p_IdsTipoBobina"):
            consulta = consulta.having(cantidad > 0)

        return self.caller.Consultar(consulta)

    def ReporteLoteBobinaPapelDetalle(self, params: dict) -> list[dict]:
        consulta = (
            select(
                BobinaPapel.CodigoBobina,
                TipoBobina.NombreTipoBobina,
                BobinaPapel.PesoBrutoKg,
                BobinaPapel.Gramaje,
                BobinaPapel.PesoNetoKg,
                LoteBobina.FechaRecepcion,
                Proveedor.NombreProveedor,
                func.count().over().label("CantidadBobinas"),
                Usuario.Ci,
                Usuario.PrimerNombre,
                Usuario.ApellidoPaterno,
                Rol.NombreRol,
            )
            .join(LoteBobina, LoteBobina.IdLoteBobina == BobinaPapel.IdLoteBobina)
            .join(Proveedor, Proveedor.IdProveedor == LoteBobina.IdProveedor)
            .join(TipoBobina, TipoBobina.IdTipoBobina == BobinaPapel.IdTipoBobina)
            .join(Usuario, Usuario.IdUsuario == LoteBobina.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .where(BobinaPapel.IdLoteBobina == params["p_IdLoteBobina"])
            .order_by(TipoBobina.NombreTipoBobina, BobinaPapel.CodigoBobina)
        )
        return self.caller.Consultar(consulta)

    def VerBobinasPapel(self, params: dict) -> list[dict]:
        consulta = (
            select(
                BobinaPapel.IdBobinaPapel,
                BobinaPapel.CodigoBobina,
                BobinaPapel.PesoBrutoKg,
                BobinaPapel.Gramaje,
                TipoBobina.NombreTipoBobina,
                EstadoMateriaPrima.TipoEstado,
                Proveedor.NombreProveedor,
            )
            .join(TipoBobina, TipoBobina.IdTipoBobina == BobinaPapel.IdTipoBobina)
            .join(
                EstadoMateriaPrima,
                EstadoMateriaPrima.IdEstadoMateriaPrima == BobinaPapel.IdEstadoMateriaPrima,
            )
            .join(LoteBobina, LoteBobina.IdLoteBobina == BobinaPapel.IdLoteBobina)
            .join(Proveedor, Proveedor.IdProveedor == LoteBobina.IdProveedor)
            .order_by(BobinaPapel.CodigoBobina)
        )

        if params.get("p_CodigoBobina") is not None:
            consulta = consulta.where(func.upper(BobinaPapel.CodigoBobina) == params["p_CodigoBobina"])
        if params.get("p_IdProveedor") is not None:
            consulta = consulta.where(LoteBobina.IdProveedor == params["p_IdProveedor"])
        if params.get("p_IdsTipoBobina"):
            consulta = consulta.where(BobinaPapel.IdTipoBobina.in_(params["p_IdsTipoBobina"]))
        if params.get("p_IdEstadoMateriaPrima") is not None:
            consulta = consulta.where(
                BobinaPapel.IdEstadoMateriaPrima == params["p_IdEstadoMateriaPrima"]
            )
        if params.get("p_IdBobinaPapel") is not None:
            consulta = consulta.where(BobinaPapel.IdBobinaPapel == params["p_IdBobinaPapel"])

        return self.caller.Consultar(consulta)

    def ReporteHistorialMovimientosBobina(self, params: dict) -> list[dict]:
        consulta = (
            select(
                MovimientoBobina.IdMovimientoBobina,
                TipoMovimientoMateriaPrima.NombreMovimiento,
                MovimientoBobina.FechaMovimiento,
                MovimientoBobina.Observacion,
                Usuario.Ci,
                Usuario.PrimerNombre,
                Usuario.ApellidoPaterno,
                Rol.NombreRol,
            )
            .join(
                TipoMovimientoMateriaPrima,
                TipoMovimientoMateriaPrima.IdTipoMovimiento == MovimientoBobina.IdTipoMovimiento,
            )
            .join(Usuario, Usuario.IdUsuario == MovimientoBobina.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .where(MovimientoBobina.IdBobinaPapel == params["p_IdBobinaPapel"])
            .order_by(MovimientoBobina.FechaMovimiento)
        )
        return self.caller.Consultar(consulta)
