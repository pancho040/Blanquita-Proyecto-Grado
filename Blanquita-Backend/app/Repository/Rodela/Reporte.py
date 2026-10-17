from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.Constants.Estados import ESTADO_MATERIA_PRIMA_EN_ALMACEN
from app.Repository.DbCaller import DbCaller
from app.Schemas.MateriaPrima import EstadoMateriaPrima, TipoMovimientoMateriaPrima
from app.Schemas.Proveedor import Proveedor
from app.Schemas.Rodela import LoteRodela, MovimientoRodela, Rodela, TipoRodela
from app.Schemas.Usuario import Rol, Usuario


class ReporteRodelaRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def VerRodelas(self, params: dict) -> list[dict]:
        consulta = (
            select(
                Rodela.IdRodela,
                Rodela.CodigoRodela,
                EstadoMateriaPrima.TipoEstado,
                TipoRodela.NombreTipoRodela,
                Proveedor.NombreProveedor,
                LoteRodela.FechaRecepcion,
                LoteRodela.IdLoteRodela,
            )
            .join(
                EstadoMateriaPrima,
                EstadoMateriaPrima.IdEstadoMateriaPrima == Rodela.IdEstadoMateriaPrima,
            )
            .join(TipoRodela, TipoRodela.IdTipoRodela == Rodela.IdTipoRodela)
            .join(LoteRodela, LoteRodela.IdLoteRodela == Rodela.IdLoteRodela)
            .join(Proveedor, Proveedor.IdProveedor == LoteRodela.IdProveedor)
            .order_by(LoteRodela.FechaRecepcion.desc(), Rodela.CodigoRodela)
        )

        if params.get("p_CodigoRodela") is not None:
            consulta = consulta.where(Rodela.CodigoRodela == params["p_CodigoRodela"])
        if params.get("p_IdProveedor") is not None:
            consulta = consulta.where(LoteRodela.IdProveedor == params["p_IdProveedor"])
        if params.get("p_IdsTipoRodela"):
            consulta = consulta.where(Rodela.IdTipoRodela.in_(params["p_IdsTipoRodela"]))
        if params.get("p_IdEstadoMateriaPrima") is not None:
            consulta = consulta.where(
                Rodela.IdEstadoMateriaPrima == params["p_IdEstadoMateriaPrima"]
            )
        if params.get("p_IdRodela") is not None:
            consulta = consulta.where(Rodela.IdRodela == params["p_IdRodela"])
        if params.get("p_IdLoteRodela") is not None:
            consulta = consulta.where(Rodela.IdLoteRodela == params["p_IdLoteRodela"])

        return self.caller.Consultar(consulta)

    def ReporteInventario(self, params: dict) -> list[dict]:
        consulta = (
            select(
                TipoRodela.IdTipoRodela,
                TipoRodela.NombreTipoRodela,
                Rodela.IdRodela,
                Rodela.CodigoRodela,
                LoteRodela.IdLoteRodela,
                LoteRodela.FechaRecepcion,
                Proveedor.NombreProveedor,
            )
            .join(TipoRodela, TipoRodela.IdTipoRodela == Rodela.IdTipoRodela)
            .join(LoteRodela, LoteRodela.IdLoteRodela == Rodela.IdLoteRodela)
            .join(Proveedor, Proveedor.IdProveedor == LoteRodela.IdProveedor)
            .where(Rodela.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN)
            .order_by(TipoRodela.NombreTipoRodela, LoteRodela.FechaRecepcion, Rodela.CodigoRodela)
        )

        if params.get("p_IdsTipoRodela"):
            consulta = consulta.where(Rodela.IdTipoRodela.in_(params["p_IdsTipoRodela"]))

        return self.caller.Consultar(consulta)

    def ReporteHistorialMovimientosRodela(self, params: dict) -> list[dict]:
        consulta = (
            select(
                MovimientoRodela.IdMovimientoRodela,
                TipoMovimientoMateriaPrima.NombreMovimiento,
                MovimientoRodela.FechaMovimiento,
                MovimientoRodela.Observacion,
                Usuario.Ci,
                Usuario.PrimerNombre,
                Usuario.ApellidoPaterno,
                Rol.NombreRol,
            )
            .join(
                TipoMovimientoMateriaPrima,
                TipoMovimientoMateriaPrima.IdTipoMovimiento == MovimientoRodela.IdTipoMovimiento,
            )
            .join(Usuario, Usuario.IdUsuario == MovimientoRodela.IdUsuario)
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .where(MovimientoRodela.IdRodela == params["p_IdRodela"])
            .order_by(MovimientoRodela.FechaMovimiento)
        )
        return self.caller.Consultar(consulta)

    def VerLotesRodela(self, params: dict) -> list[dict]:
        condiciones_rodela = [Rodela.IdLoteRodela == LoteRodela.IdLoteRodela]
        if params.get("p_IdsTipoRodela"):
            condiciones_rodela.append(Rodela.IdTipoRodela.in_(params["p_IdsTipoRodela"]))

        cantidad = func.count(Rodela.IdRodela)
        consulta = (
            select(
                LoteRodela.IdLoteRodela,
                LoteRodela.FechaRecepcion,
                Proveedor.NombreProveedor,
                cantidad.label("CantidadRodelas"),
            )
            .join(Proveedor, Proveedor.IdProveedor == LoteRodela.IdProveedor)
            .outerjoin(Rodela, and_(*condiciones_rodela))
            .group_by(LoteRodela.IdLoteRodela, LoteRodela.FechaRecepcion, Proveedor.NombreProveedor)
            .order_by(LoteRodela.FechaRecepcion.desc())
        )

        if params.get("p_FechaInicio") is not None:
            consulta = consulta.where(LoteRodela.FechaRecepcion >= params["p_FechaInicio"])
        if params.get("p_FechaFin") is not None:
            consulta = consulta.where(LoteRodela.FechaRecepcion <= params["p_FechaFin"])
        if params.get("p_IdProveedor") is not None:
            consulta = consulta.where(LoteRodela.IdProveedor == params["p_IdProveedor"])
        if params.get("p_IdsTipoRodela"):
            consulta = consulta.having(cantidad > 0)

        return self.caller.Consultar(consulta)

    def ReporteLoteRodelaDetalle(self, params: dict) -> list[dict]:
        consulta = (
            select(
                Rodela.CodigoRodela,
                TipoRodela.NombreTipoRodela,
                EstadoMateriaPrima.TipoEstado,
                LoteRodela.FechaRecepcion,
                Proveedor.NombreProveedor,
                func.count().over().label("CantidadRodelas"),
            )
            .join(LoteRodela, LoteRodela.IdLoteRodela == Rodela.IdLoteRodela)
            .join(Proveedor, Proveedor.IdProveedor == LoteRodela.IdProveedor)
            .join(TipoRodela, TipoRodela.IdTipoRodela == Rodela.IdTipoRodela)
            .join(
                EstadoMateriaPrima,
                EstadoMateriaPrima.IdEstadoMateriaPrima == Rodela.IdEstadoMateriaPrima,
            )
            .where(Rodela.IdLoteRodela == params["p_IdLoteRodela"])
            .order_by(TipoRodela.NombreTipoRodela, Rodela.CodigoRodela)
        )
        return self.caller.Consultar(consulta)
