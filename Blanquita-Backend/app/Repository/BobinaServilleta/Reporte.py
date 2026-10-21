from sqlalchemy import Text, and_, case, cast, func, or_, select
from sqlalchemy.orm import Session

from app.Constants.Estados import ESTADO_MATERIA_PRIMA_EN_ALMACEN
from app.Repository.BobinaServilleta.Unidades import con_unidades
from app.Repository.DbCaller import DbCaller
from app.Repository.Consultas import filtro_rango, nombre_operador
from app.Schemas.BobinaServilleta import (
    BobinaServilleta,
    FormatoSubBobina,
    LoteBobinaServilleta,
    MovimientoBobinaServilleta,
    MovimientoSubBobina,
    SubBobinaServilleta,
    TipoBobinaServilleta,
    TipoMedidaSubBobina,
    UnidadBobinaServilleta,
)
from app.Schemas.MateriaPrima import EstadoMateriaPrima, TipoMovimientoMateriaPrima
from app.Schemas.Produccion import (
    CancelacionProduccionServilleta,
    EstadoProduccion,
    PausaProduccionServilleta,
    ProduccionServilleta,
    Turno,
)
from app.Schemas.Proveedor import Proveedor
from app.Schemas.Usuario import Rol, Usuario


class ReporteBobinaServilletaRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def _ConsultaBobinas(self):
        return (
            select(
                BobinaServilleta.IdBobinaServilleta,
                BobinaServilleta.IdTipoBobinaServilleta,
                TipoBobinaServilleta.NombreTipoBobinaServilleta,
                EstadoMateriaPrima.TipoEstado,
                cast(LoteBobinaServilleta.IdLoteBobinaServilleta, Text).label("CodigoLote"),
                LoteBobinaServilleta.FechaRecepcion,
                Proveedor.NombreProveedor,
            )
            .join(
                EstadoMateriaPrima,
                EstadoMateriaPrima.IdEstadoMateriaPrima == BobinaServilleta.IdEstadoMateriaPrima,
            )
            .join(
                TipoBobinaServilleta,
                TipoBobinaServilleta.IdTipoBobinaServilleta == BobinaServilleta.IdTipoBobinaServilleta,
            )
            .join(
                LoteBobinaServilleta,
                LoteBobinaServilleta.IdLoteBobinaServilleta == BobinaServilleta.IdLoteBobinaServilleta,
            )
            .join(Proveedor, Proveedor.IdProveedor == LoteBobinaServilleta.IdProveedor)
        )

    def ReporteInventario(self, params: dict) -> list[dict]:
        consulta = (
            self._ConsultaBobinas()
            .where(BobinaServilleta.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN)
            .order_by(
                TipoBobinaServilleta.NombreTipoBobinaServilleta,
                LoteBobinaServilleta.FechaRecepcion,
                BobinaServilleta.IdBobinaServilleta,
            )
        )
        if params.get("p_IdsTipoBobinaServilleta"):
            consulta = consulta.where(
                BobinaServilleta.IdTipoBobinaServilleta.in_(params["p_IdsTipoBobinaServilleta"])
            )
        return con_unidades(self.caller, self.caller.Consultar(consulta))

    def VerBobinasServilleta(self, params: dict) -> list[dict]:
        consulta = self._ConsultaBobinas().order_by(
            LoteBobinaServilleta.FechaRecepcion.desc(), BobinaServilleta.IdBobinaServilleta
        )

        if params.get("p_CodigoBobina") is not None:
            consulta = consulta.where(
                select(UnidadBobinaServilleta.IdUnidadBobinaServilleta)
                .where(
                    UnidadBobinaServilleta.IdBobinaServilleta == BobinaServilleta.IdBobinaServilleta,
                    UnidadBobinaServilleta.CodigoBobina == params["p_CodigoBobina"],
                )
                .exists()
            )
        if params.get("p_IdProveedor") is not None:
            consulta = consulta.where(LoteBobinaServilleta.IdProveedor == params["p_IdProveedor"])
        if params.get("p_IdTipoBobinaServilleta") is not None:
            consulta = consulta.where(
                BobinaServilleta.IdTipoBobinaServilleta == params["p_IdTipoBobinaServilleta"]
            )
        if params.get("p_IdEstadoMateriaPrima") is not None:
            consulta = consulta.where(
                BobinaServilleta.IdEstadoMateriaPrima == params["p_IdEstadoMateriaPrima"]
            )
        if params.get("p_IdBobinaServilleta") is not None:
            consulta = consulta.where(
                BobinaServilleta.IdBobinaServilleta == params["p_IdBobinaServilleta"]
            )

        return con_unidades(self.caller, self.caller.Consultar(consulta))

    def VerResumenSubBobinas(self) -> list[dict]:
        consulta = (
            select(
                TipoMedidaSubBobina.IdTipoMedidaSubBobina,
                TipoMedidaSubBobina.Descripcion.label("NombreTipoMedida"),
                func.count(SubBobinaServilleta.IdSubBobinaServilleta).label("CantidadSubBobinas"),
            )
            .outerjoin(
                SubBobinaServilleta,
                and_(
                    SubBobinaServilleta.IdTipoMedidaSubBobina
                    == TipoMedidaSubBobina.IdTipoMedidaSubBobina,
                    SubBobinaServilleta.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN,
                ),
            )
            .group_by(TipoMedidaSubBobina.IdTipoMedidaSubBobina, TipoMedidaSubBobina.Descripcion)
            .order_by(TipoMedidaSubBobina.IdTipoMedidaSubBobina)
        )
        return self.caller.Consultar(consulta)

    def VerSubBobinasServilleta(self, params: dict) -> list[dict]:
        consulta = (
            select(
                SubBobinaServilleta.IdSubBobinaServilleta,
                EstadoMateriaPrima.TipoEstado,
                TipoMedidaSubBobina.IdTipoMedidaSubBobina,
                TipoMedidaSubBobina.Descripcion.label("DescripcionMedida"),
                func.count()
                .over(partition_by=TipoMedidaSubBobina.IdTipoMedidaSubBobina)
                .label("CantidadPorMedida"),
                UnidadBobinaServilleta.CodigoBobina,
                BobinaServilleta.IdBobinaServilleta,
                TipoBobinaServilleta.NombreTipoBobinaServilleta,
                cast(LoteBobinaServilleta.IdLoteBobinaServilleta, Text).label("CodigoLote"),
                LoteBobinaServilleta.FechaRecepcion,
                Proveedor.NombreProveedor,
            )
            .join(
                UnidadBobinaServilleta,
                UnidadBobinaServilleta.IdUnidadBobinaServilleta
                == SubBobinaServilleta.IdUnidadBobinaServilleta,
            )
            .join(
                EstadoMateriaPrima,
                EstadoMateriaPrima.IdEstadoMateriaPrima == SubBobinaServilleta.IdEstadoMateriaPrima,
            )
            .join(
                TipoMedidaSubBobina,
                TipoMedidaSubBobina.IdTipoMedidaSubBobina == SubBobinaServilleta.IdTipoMedidaSubBobina,
            )
            .join(
                BobinaServilleta,
                BobinaServilleta.IdBobinaServilleta == UnidadBobinaServilleta.IdBobinaServilleta,
            )
            .join(
                TipoBobinaServilleta,
                TipoBobinaServilleta.IdTipoBobinaServilleta == BobinaServilleta.IdTipoBobinaServilleta,
            )
            .join(
                LoteBobinaServilleta,
                LoteBobinaServilleta.IdLoteBobinaServilleta == BobinaServilleta.IdLoteBobinaServilleta,
            )
            .join(Proveedor, Proveedor.IdProveedor == LoteBobinaServilleta.IdProveedor)
            .order_by(
                TipoMedidaSubBobina.Descripcion,
                UnidadBobinaServilleta.CodigoBobina,
                SubBobinaServilleta.IdSubBobinaServilleta,
            )
        )

        if params.get("p_CodigoBobina") is not None:
            consulta = consulta.where(UnidadBobinaServilleta.CodigoBobina == params["p_CodigoBobina"])
        if params.get("p_IdProveedor") is not None:
            consulta = consulta.where(LoteBobinaServilleta.IdProveedor == params["p_IdProveedor"])
        if params.get("p_IdTipoBobinaServilleta") is not None:
            consulta = consulta.where(
                BobinaServilleta.IdTipoBobinaServilleta == params["p_IdTipoBobinaServilleta"]
            )
        if params.get("p_IdsTipoMedidaSubBobina"):
            consulta = consulta.where(
                SubBobinaServilleta.IdTipoMedidaSubBobina.in_(params["p_IdsTipoMedidaSubBobina"])
            )
        if params.get("p_IdEstadoMateriaPrima") is not None:
            consulta = consulta.where(
                SubBobinaServilleta.IdEstadoMateriaPrima == params["p_IdEstadoMateriaPrima"]
            )
        if params.get("p_IdBobinaServilleta") is not None:
            consulta = consulta.where(
                BobinaServilleta.IdBobinaServilleta == params["p_IdBobinaServilleta"]
            )
        if params.get("p_IdSubBobinaServilleta") is not None:
            consulta = consulta.where(
                SubBobinaServilleta.IdSubBobinaServilleta == params["p_IdSubBobinaServilleta"]
            )

        return self.caller.Consultar(consulta)

    def _MovimientosSubBobinas(self, *columnas):
        return (
            select(
                *columnas,
                MovimientoSubBobina.IdMovimientoSubBobina,
                SubBobinaServilleta.IdSubBobinaServilleta,
                TipoMedidaSubBobina.Descripcion.label("NombreTipoMedida"),
                TipoMovimientoMateriaPrima.NombreMovimiento,
                MovimientoSubBobina.FechaMovimiento,
                MovimientoSubBobina.Observacion,
                Usuario.Ci,
                Usuario.PrimerNombre,
                Usuario.ApellidoPaterno,
                Rol.NombreRol,
            )
            .select_from(UnidadBobinaServilleta)
            .join(
                BobinaServilleta,
                BobinaServilleta.IdBobinaServilleta == UnidadBobinaServilleta.IdBobinaServilleta,
            )
            .join(
                TipoBobinaServilleta,
                TipoBobinaServilleta.IdTipoBobinaServilleta == BobinaServilleta.IdTipoBobinaServilleta,
            )
            .join(
                EstadoMateriaPrima,
                EstadoMateriaPrima.IdEstadoMateriaPrima == BobinaServilleta.IdEstadoMateriaPrima,
            )
            .join(
                FormatoSubBobina,
                FormatoSubBobina.IdFormatoSubBobina == UnidadBobinaServilleta.IdFormatoSubBobina,
            )
            .outerjoin(
                SubBobinaServilleta,
                SubBobinaServilleta.IdUnidadBobinaServilleta
                == UnidadBobinaServilleta.IdUnidadBobinaServilleta,
            )
            .outerjoin(
                TipoMedidaSubBobina,
                TipoMedidaSubBobina.IdTipoMedidaSubBobina == SubBobinaServilleta.IdTipoMedidaSubBobina,
            )
            .outerjoin(
                MovimientoSubBobina,
                MovimientoSubBobina.IdSubBobinaServilleta == SubBobinaServilleta.IdSubBobinaServilleta,
            )
            .outerjoin(
                TipoMovimientoMateriaPrima,
                TipoMovimientoMateriaPrima.IdTipoMovimiento == MovimientoSubBobina.IdTipoMovimiento,
            )
            .outerjoin(Usuario, Usuario.IdUsuario == MovimientoSubBobina.IdUsuario)
            .outerjoin(Rol, Rol.IdRol == Usuario.IdRol)
        )

    def ReporteHistorialMovimientosUnidadServilleta(self, params: dict) -> list[dict]:
        consulta = (
            self._MovimientosSubBobinas(
                UnidadBobinaServilleta.IdUnidadBobinaServilleta,
                UnidadBobinaServilleta.CodigoBobina,
                FormatoSubBobina.DescripcionFormato,
                UnidadBobinaServilleta.PesoBrutoKg,
                UnidadBobinaServilleta.GramajeGr,
                BobinaServilleta.IdBobinaServilleta,
                TipoBobinaServilleta.NombreTipoBobinaServilleta,
                EstadoMateriaPrima.TipoEstado,
            )
            .where(
                UnidadBobinaServilleta.IdUnidadBobinaServilleta
                == params["p_IdUnidadBobinaServilleta"]
            )
            .order_by(MovimientoSubBobina.FechaMovimiento.asc().nulls_last())
        )
        return self.caller.Consultar(consulta)

    def ReporteDetalleBobinaServilleta(self, params: dict) -> list[dict]:
        consulta = (
            self._MovimientosSubBobinas(
                BobinaServilleta.IdBobinaServilleta,
                TipoBobinaServilleta.NombreTipoBobinaServilleta,
                EstadoMateriaPrima.TipoEstado,
                cast(LoteBobinaServilleta.IdLoteBobinaServilleta, Text).label("CodigoLote"),
                LoteBobinaServilleta.FechaRecepcion,
                Proveedor.NombreProveedor,
                UnidadBobinaServilleta.IdUnidadBobinaServilleta,
                UnidadBobinaServilleta.CodigoBobina.label("CodigoUnidad"),
                FormatoSubBobina.DescripcionFormato,
                UnidadBobinaServilleta.PesoBrutoKg,
                UnidadBobinaServilleta.GramajeGr,
            )
            .join(
                LoteBobinaServilleta,
                LoteBobinaServilleta.IdLoteBobinaServilleta == BobinaServilleta.IdLoteBobinaServilleta,
            )
            .join(Proveedor, Proveedor.IdProveedor == LoteBobinaServilleta.IdProveedor)
            .where(BobinaServilleta.IdBobinaServilleta == params["p_IdBobinaServilleta"])
            .order_by(
                UnidadBobinaServilleta.IdUnidadBobinaServilleta,
                MovimientoSubBobina.FechaMovimiento.asc().nulls_last(),
            )
        )
        return self.caller.Consultar(consulta)

    def ReporteHistorialMovimientosBobinaServilleta(self, params: dict) -> list[dict]:
        consulta = (
            select(
                MovimientoBobinaServilleta.IdMovimientoBobinaServilleta,
                TipoMovimientoMateriaPrima.NombreMovimiento,
                MovimientoBobinaServilleta.FechaMovimiento,
                MovimientoBobinaServilleta.Observacion,
                Usuario.Ci,
                Usuario.PrimerNombre,
                Usuario.ApellidoPaterno,
                Rol.NombreRol,
            )
            .join(
                TipoMovimientoMateriaPrima,
                TipoMovimientoMateriaPrima.IdTipoMovimiento
                == MovimientoBobinaServilleta.IdTipoMovimiento,
            )
            .join(Usuario, Usuario.IdUsuario == MovimientoBobinaServilleta.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .where(MovimientoBobinaServilleta.IdBobinaServilleta == params["p_IdBobinaServilleta"])
            .order_by(MovimientoBobinaServilleta.FechaMovimiento)
        )
        return self.caller.Consultar(consulta)

    def VerLotesBobinaServilleta(self, params: dict) -> list[dict]:
        condiciones_bobina = [
            BobinaServilleta.IdLoteBobinaServilleta == LoteBobinaServilleta.IdLoteBobinaServilleta
        ]
        if params.get("p_IdsTipoBobinaServilleta"):
            condiciones_bobina.append(
                BobinaServilleta.IdTipoBobinaServilleta.in_(params["p_IdsTipoBobinaServilleta"])
            )

        cantidad = func.count(BobinaServilleta.IdBobinaServilleta)
        consulta = (
            select(
                LoteBobinaServilleta.IdLoteBobinaServilleta,
                LoteBobinaServilleta.FechaRecepcion,
                Proveedor.NombreProveedor,
                cantidad.label("CantidadBobinas"),
            )
            .join(Proveedor, Proveedor.IdProveedor == LoteBobinaServilleta.IdProveedor)
            .outerjoin(BobinaServilleta, and_(*condiciones_bobina))
            .group_by(
                LoteBobinaServilleta.IdLoteBobinaServilleta,
                LoteBobinaServilleta.FechaRecepcion,
                Proveedor.NombreProveedor,
            )
            .order_by(LoteBobinaServilleta.FechaRecepcion.desc())
        )

        if params.get("p_FechaInicio") is not None:
            consulta = consulta.where(LoteBobinaServilleta.FechaRecepcion >= params["p_FechaInicio"])
        if params.get("p_FechaFin") is not None:
            consulta = consulta.where(LoteBobinaServilleta.FechaRecepcion <= params["p_FechaFin"])
        if params.get("p_IdProveedor") is not None:
            consulta = consulta.where(LoteBobinaServilleta.IdProveedor == params["p_IdProveedor"])
        if params.get("p_IdsTipoBobinaServilleta"):
            consulta = consulta.having(cantidad > 0)

        return self.caller.Consultar(consulta)

    def ReporteLoteBobinaServilletaDetalle(self, params: dict) -> list[dict]:
        consulta = (
            self._ConsultaBobinas()
            .where(BobinaServilleta.IdLoteBobinaServilleta == params["p_IdLoteBobinaServilleta"])
            .order_by(
                TipoBobinaServilleta.NombreTipoBobinaServilleta, BobinaServilleta.IdBobinaServilleta
            )
        )
        return con_unidades(self.caller, self.caller.Consultar(consulta))

    def VerProduccionesServilleta(self, params: dict) -> list[dict]:
        ps = ProduccionServilleta
        fecha_referencia = func.coalesce(ps.FechaFinProduccion, ps.FechaInicioProduccion)

        consulta = (
            select(
                ps.IdProduccionServilleta,
                EstadoProduccion.NombreEstadoProduccion,
                Turno.NombreTurno,
                nombre_operador(Usuario).label("Operador"),
                Usuario.Ci,
                Rol.NombreRol,
                TipoBobinaServilleta.NombreTipoBobinaServilleta,
                UnidadBobinaServilleta.CodigoBobina,
                TipoMedidaSubBobina.Descripcion.label("DescripcionMedida"),
                FormatoSubBobina.DescripcionFormato,
                SubBobinaServilleta.IdSubBobinaServilleta,
                ps.FechaInicioProduccion,
                ps.FechaFinProduccion,
                (ps.FechaFinProduccion - ps.FechaInicioProduccion).label("DuracionTotal"),
            )
            .join(EstadoProduccion, EstadoProduccion.IdEstadoProduccion == ps.IdEstadoProduccion)
            .join(Turno, Turno.IdTurno == ps.IdTurno)
            .join(SubBobinaServilleta, SubBobinaServilleta.IdSubBobinaServilleta == ps.IdSubBobina)
            .join(
                TipoMedidaSubBobina,
                TipoMedidaSubBobina.IdTipoMedidaSubBobina == SubBobinaServilleta.IdTipoMedidaSubBobina,
            )
            .join(
                UnidadBobinaServilleta,
                UnidadBobinaServilleta.IdUnidadBobinaServilleta
                == SubBobinaServilleta.IdUnidadBobinaServilleta,
            )
            .join(
                FormatoSubBobina,
                FormatoSubBobina.IdFormatoSubBobina == UnidadBobinaServilleta.IdFormatoSubBobina,
            )
            .join(
                BobinaServilleta,
                BobinaServilleta.IdBobinaServilleta == UnidadBobinaServilleta.IdBobinaServilleta,
            )
            .join(
                TipoBobinaServilleta,
                TipoBobinaServilleta.IdTipoBobinaServilleta == BobinaServilleta.IdTipoBobinaServilleta,
            )
            .join(Usuario, Usuario.IdUsuario == ps.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .where(
                *filtro_rango(
                    fecha_referencia, params.get("p_FechaInicio"), params.get("p_FechaFin")
                )
            )
            .order_by(ps.FechaInicioProduccion.desc(), ps.IdProduccionServilleta.desc())
        )

        if params.get("p_IdTurno") is not None:
            consulta = consulta.where(ps.IdTurno == params["p_IdTurno"])

        if params.get("p_IdsTipoBobinaServilleta"):
            consulta = consulta.where(
                BobinaServilleta.IdTipoBobinaServilleta.in_(params["p_IdsTipoBobinaServilleta"])
            )

        if params.get("p_CodigoBobina"):
            consulta = consulta.where(UnidadBobinaServilleta.CodigoBobina == params["p_CodigoBobina"])

        operador = params.get("p_Operador")
        if operador:
            consulta = consulta.where(
                or_(
                    Usuario.Ci == operador,
                    nombre_operador(Usuario).ilike(f"%{operador}%"),
                )
            )

        if params.get("p_IdEstadoProduccion") is not None:
            consulta = consulta.where(ps.IdEstadoProduccion == params["p_IdEstadoProduccion"])

        if params.get("p_IdsEstadoProduccion"):
            consulta = consulta.where(ps.IdEstadoProduccion.in_(params["p_IdsEstadoProduccion"]))

        return self.caller.Consultar(consulta)

    def ReporteProduccionServilletaDetalle(self, params: dict) -> dict | None:
        ps = ProduccionServilleta
        consulta = (
            select(
                ps.IdProduccionServilleta,
                EstadoProduccion.NombreEstadoProduccion,
                Turno.NombreTurno,
                nombre_operador(Usuario).label("Operador"),
                Usuario.Ci,
                Rol.NombreRol,
                TipoBobinaServilleta.NombreTipoBobinaServilleta,
                UnidadBobinaServilleta.CodigoBobina,
                TipoMedidaSubBobina.Descripcion.label("DescripcionMedida"),
                FormatoSubBobina.DescripcionFormato,
                SubBobinaServilleta.IdSubBobinaServilleta,
                UnidadBobinaServilleta.PesoBrutoKg,
                UnidadBobinaServilleta.GramajeGr,
                Proveedor.NombreProveedor,
                LoteBobinaServilleta.FechaRecepcion,
                ps.FechaInicioProduccion,
                ps.FechaFinProduccion,
                (ps.FechaFinProduccion - ps.FechaInicioProduccion).label("DuracionTotal"),
            )
            .join(EstadoProduccion, EstadoProduccion.IdEstadoProduccion == ps.IdEstadoProduccion)
            .join(Turno, Turno.IdTurno == ps.IdTurno)
            .join(SubBobinaServilleta, SubBobinaServilleta.IdSubBobinaServilleta == ps.IdSubBobina)
            .join(
                TipoMedidaSubBobina,
                TipoMedidaSubBobina.IdTipoMedidaSubBobina == SubBobinaServilleta.IdTipoMedidaSubBobina,
            )
            .join(
                UnidadBobinaServilleta,
                UnidadBobinaServilleta.IdUnidadBobinaServilleta
                == SubBobinaServilleta.IdUnidadBobinaServilleta,
            )
            .join(
                FormatoSubBobina,
                FormatoSubBobina.IdFormatoSubBobina == UnidadBobinaServilleta.IdFormatoSubBobina,
            )
            .join(
                BobinaServilleta,
                BobinaServilleta.IdBobinaServilleta == UnidadBobinaServilleta.IdBobinaServilleta,
            )
            .join(
                TipoBobinaServilleta,
                TipoBobinaServilleta.IdTipoBobinaServilleta == BobinaServilleta.IdTipoBobinaServilleta,
            )
            .join(
                LoteBobinaServilleta,
                LoteBobinaServilleta.IdLoteBobinaServilleta == BobinaServilleta.IdLoteBobinaServilleta,
            )
            .join(Proveedor, Proveedor.IdProveedor == LoteBobinaServilleta.IdProveedor)
            .join(Usuario, Usuario.IdUsuario == ps.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .where(ps.IdProduccionServilleta == params["p_IdProduccion"])
        )
        filas = self.caller.Consultar(consulta)
        return filas[0] if filas else None

    def ReportePausasProduccionServilleta(self, params: dict) -> list[dict]:
        pausa = PausaProduccionServilleta
        ps = ProduccionServilleta

        consulta = (
            select(
                pausa.IdPausaProduccionServilleta,
                pausa.IdProduccionServilleta,
                UnidadBobinaServilleta.CodigoBobina,
                Turno.NombreTurno,
                pausa.FechaHoraPausa,
                pausa.MotivoPausaProduccion,
                pausa.FechaHoraReanudacion,
                pausa.MotivoReanudacion,
                (pausa.FechaHoraReanudacion - pausa.FechaHoraPausa).label("DuracionPausa"),
                nombre_operador(Usuario).label("OperadorPausa"),
                Rol.NombreRol.label("RolPausa"),
                case(
                    (pausa.FechaHoraReanudacion.is_(None), "Abierta"),
                    else_="Cerrada",
                ).label("EstadoPausa"),
            )
            .join(ps, ps.IdProduccionServilleta == pausa.IdProduccionServilleta)
            .join(SubBobinaServilleta, SubBobinaServilleta.IdSubBobinaServilleta == ps.IdSubBobina)
            .join(
                UnidadBobinaServilleta,
                UnidadBobinaServilleta.IdUnidadBobinaServilleta
                == SubBobinaServilleta.IdUnidadBobinaServilleta,
            )
            .join(Turno, Turno.IdTurno == ps.IdTurno)
            .join(Usuario, Usuario.IdUsuario == pausa.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .where(
                *filtro_rango(
                    pausa.FechaHoraPausa, params.get("p_FechaInicio"), params.get("p_FechaFin")
                )
            )
            .order_by(pausa.FechaHoraPausa.desc())
        )

        if params.get("p_IdProduccion") is not None:
            consulta = consulta.where(pausa.IdProduccionServilleta == params["p_IdProduccion"])

        if params.get("p_IdTurno") is not None:
            consulta = consulta.where(ps.IdTurno == params["p_IdTurno"])

        solo_abiertas = params.get("p_SoloAbiertas")
        if solo_abiertas is True:
            consulta = consulta.where(pausa.FechaHoraReanudacion.is_(None))
        elif solo_abiertas is False:
            consulta = consulta.where(pausa.FechaHoraReanudacion.is_not(None))

        return self.caller.Consultar(consulta)

    def VerCancelacionesProduccionServilleta(self, params: dict) -> list[dict]:
        cancelacion = CancelacionProduccionServilleta

        consulta = (
            select(
                cancelacion.IdProduccionServilleta,
                cancelacion.FechaHoraCancelacion,
                cancelacion.MotivoCancelacion,
                Usuario.Ci,
                Usuario.PrimerNombre,
                Usuario.ApellidoPaterno,
                Rol.NombreRol,
            )
            .join(Usuario, Usuario.IdUsuario == cancelacion.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .where(
                *filtro_rango(
                    cancelacion.FechaHoraCancelacion,
                    params.get("p_FechaInicio"),
                    params.get("p_FechaFin"),
                )
            )
            .order_by(cancelacion.FechaHoraCancelacion.desc())
        )

        return self.caller.Consultar(consulta)

    def ReporteCancelacionProduccionServilleta(self, params: dict) -> dict | None:
        consulta = (
            select(
                CancelacionProduccionServilleta.FechaHoraCancelacion,
                CancelacionProduccionServilleta.MotivoCancelacion,
                Usuario.Ci,
                nombre_operador(Usuario).label("Operador"),
                Rol.NombreRol,
            )
            .join(Usuario, Usuario.IdUsuario == CancelacionProduccionServilleta.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .where(CancelacionProduccionServilleta.IdProduccionServilleta == params["p_IdProduccion"])
            .order_by(CancelacionProduccionServilleta.FechaHoraCancelacion.desc())
            .limit(1)
        )
        filas = self.caller.Consultar(consulta)
        return filas[0] if filas else None
