from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.Repository.Consultas import filtro_rango
from app.Repository.DbCaller import DbCaller
from app.Schemas.RegistroIngreso import RegistroIngreso
from app.Schemas.Usuario import EstadoUsuario, Rol, Usuario


class RegistroIngresoRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def _Ci(self):
        return func.coalesce(Usuario.Ci, RegistroIngreso.CiIntentado)

    def _Filtrar(self, consulta: Select, params: dict) -> Select:
        consulta = consulta.where(
            *filtro_rango(
                RegistroIngreso.FechaRegistro,
                params.get("p_FechaInicio"),
                params.get("p_FechaFin"),
            )
        )

        if params.get("p_Registro"):
            consulta = consulta.where(RegistroIngreso.Registro == params["p_Registro"])

        if params.get("p_Ci"):
            if params.get("p_CiExacto"):
                consulta = consulta.where(self._Ci() == params["p_Ci"])
            else:
                consulta = consulta.where(self._Ci().contains(params["p_Ci"], autoescape=True))

        return consulta

    def _ConsultaRegistros(self, params: dict) -> Select:
        ri = RegistroIngreso

        consulta = (
            select(
                ri.IdRegistroIngreso,
                ri.Registro,
                ri.IdUsuario,
                self._Ci().label("Ci"),
                Usuario.PrimerNombre,
                Usuario.ApellidoPaterno,
                Usuario.ApellidoMaterno,
                Rol.NombreRol,
                ri.Detalle,
                ri.DireccionIp,
                ri.UserAgent,
                ri.FechaRegistro,
            )
            .select_from(ri)
            .outerjoin(Usuario, ri.IdUsuario == Usuario.IdUsuario)
            .outerjoin(Rol, Usuario.IdRol == Rol.IdRol)
        )

        return self._Filtrar(consulta, params)

    def _Ordenar(self, consulta: Select) -> Select:
        return consulta.order_by(
            RegistroIngreso.FechaRegistro.desc(), RegistroIngreso.IdRegistroIngreso.desc()
        )

    def ListarRegistros(self, params: dict) -> tuple[int, list[dict]]:
        consulta = self._ConsultaRegistros(params)

        total = self.caller.Consultar(
            select(func.count().label("Total")).select_from(consulta.subquery())
        )[0]["Total"]

        pagina = (
            self._Ordenar(consulta)
            .limit(params["TamanoPagina"])
            .offset((params["Pagina"] - 1) * params["TamanoPagina"])
        )

        return total, self.caller.Consultar(pagina)

    def ObtenerRegistros(self, params: dict) -> list[dict]:
        return self.caller.Consultar(self._Ordenar(self._ConsultaRegistros(params)))

    def ContarPorRegistro(self, params: dict) -> list[dict]:
        consulta = (
            select(
                RegistroIngreso.Registro,
                func.count().label("Cantidad"),
            )
            .select_from(RegistroIngreso)
            .outerjoin(Usuario, RegistroIngreso.IdUsuario == Usuario.IdUsuario)
            .group_by(RegistroIngreso.Registro)
        )
        return self.caller.Consultar(self._Filtrar(consulta, params))

    def ContarCisDistintos(self, params: dict) -> int:
        consulta = (
            select(func.count(func.distinct(self._Ci())).label("Cantidad"))
            .select_from(RegistroIngreso)
            .outerjoin(Usuario, RegistroIngreso.IdUsuario == Usuario.IdUsuario)
        )
        return self.caller.Consultar(self._Filtrar(consulta, params))[0]["Cantidad"]

    def UltimaFecha(self, params: dict):
        consulta = (
            select(func.max(RegistroIngreso.FechaRegistro).label("Ultima"))
            .select_from(RegistroIngreso)
            .outerjoin(Usuario, RegistroIngreso.IdUsuario == Usuario.IdUsuario)
        )
        return self.caller.Consultar(self._Filtrar(consulta, params))[0]["Ultima"]

    def ObtenerUsuarioPorCi(self, ci: str) -> dict | None:
        consulta = (
            select(
                Usuario.IdUsuario,
                Usuario.Ci,
                Usuario.PrimerNombre,
                Usuario.SegundoNombre,
                Usuario.ApellidoPaterno,
                Usuario.ApellidoMaterno,
                Rol.NombreRol,
                EstadoUsuario.NombreEstadoUsuario,
            )
            .join(Rol, Usuario.IdRol == Rol.IdRol)
            .join(EstadoUsuario, Usuario.IdEstadoUsuario == EstadoUsuario.IdEstadoUsuario)
            .where(Usuario.Ci == ci)
            .limit(1)
        )
        filas = self.caller.Consultar(consulta)
        return filas[0] if filas else None
