from sqlalchemy import Select, case, func, or_, select
from sqlalchemy.orm import Session

from app.Constants.HistorialAdmin import MODULO_OTROS, PREFIJOS_MODULO_HISTORIAL_ADMIN
from app.Repository.Consultas import filtro_rango
from app.Repository.DbCaller import DbCaller
from app.Schemas.HistorialAdmin import HistorialAdmin
from app.Schemas.Usuario import EstadoUsuario, Rol, Usuario


class HistorialAdminRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def _Modulo(self):
        return case(
            *[
                (
                    or_(
                        *[
                            HistorialAdmin.Observacion.startswith(prefijo, autoescape=True)
                            for prefijo in prefijos
                        ]
                    ),
                    modulo,
                )
                for modulo, prefijos in PREFIJOS_MODULO_HISTORIAL_ADMIN.items()
            ],
            else_=MODULO_OTROS,
        )

    def _Filtrar(self, consulta: Select, params: dict) -> Select:
        consulta = consulta.where(
            *filtro_rango(
                HistorialAdmin.FechaMovimiento,
                params.get("p_FechaInicio"),
                params.get("p_FechaFin"),
            )
        )

        if params.get("p_Modulo"):
            consulta = consulta.where(self._Modulo() == params["p_Modulo"])

        if params.get("p_Ci"):
            if params.get("p_CiExacto"):
                consulta = consulta.where(Usuario.Ci == params["p_Ci"])
            else:
                consulta = consulta.where(Usuario.Ci.contains(params["p_Ci"], autoescape=True))

        if params.get("p_Busqueda"):
            consulta = consulta.where(
                HistorialAdmin.Observacion.icontains(params["p_Busqueda"], autoescape=True)
            )

        return consulta

    def _ConsultaAcciones(self, params: dict) -> Select:
        ha = HistorialAdmin

        consulta = (
            select(
                ha.IdHistorialAdmin,
                self._Modulo().label("Modulo"),
                ha.Observacion,
                ha.FechaMovimiento,
                ha.IdUsuario,
                Usuario.Ci,
                Usuario.PrimerNombre,
                Usuario.ApellidoPaterno,
                Rol.NombreRol,
                EstadoUsuario.NombreEstadoUsuario,
            )
            .select_from(ha)
            .join(Usuario, ha.IdUsuario == Usuario.IdUsuario)
            .join(EstadoUsuario, Usuario.IdEstadoUsuario == EstadoUsuario.IdEstadoUsuario)
            .join(Rol, Usuario.IdRol == Rol.IdRol)
        )

        return self._Filtrar(consulta, params)

    def _Ordenar(self, consulta: Select) -> Select:
        return consulta.order_by(
            HistorialAdmin.FechaMovimiento.desc(), HistorialAdmin.IdHistorialAdmin.desc()
        )

    def ListarAcciones(self, params: dict) -> tuple[int, list[dict]]:
        consulta = self._ConsultaAcciones(params)

        total = self.caller.Consultar(
            select(func.count().label("Total")).select_from(consulta.subquery())
        )[0]["Total"]

        pagina = (
            self._Ordenar(consulta)
            .limit(params["TamanoPagina"])
            .offset((params["Pagina"] - 1) * params["TamanoPagina"])
        )

        return total, self.caller.Consultar(pagina)

    def ObtenerAcciones(self, params: dict) -> list[dict]:
        return self.caller.Consultar(self._Ordenar(self._ConsultaAcciones(params)))

    def ContarPorModulo(self, params: dict) -> list[dict]:
        modulo = self._Modulo().label("Modulo")
        consulta = (
            select(modulo, func.count().label("Cantidad"))
            .select_from(HistorialAdmin)
            .join(Usuario, HistorialAdmin.IdUsuario == Usuario.IdUsuario)
            .group_by(modulo)
        )
        return self.caller.Consultar(self._Filtrar(consulta, params))

    def ContarAdministradoresDistintos(self, params: dict) -> int:
        consulta = (
            select(func.count(func.distinct(HistorialAdmin.IdUsuario)).label("Cantidad"))
            .select_from(HistorialAdmin)
            .join(Usuario, HistorialAdmin.IdUsuario == Usuario.IdUsuario)
        )
        return self.caller.Consultar(self._Filtrar(consulta, params))[0]["Cantidad"]

    def UltimaFecha(self, params: dict):
        consulta = (
            select(func.max(HistorialAdmin.FechaMovimiento).label("Ultima"))
            .select_from(HistorialAdmin)
            .join(Usuario, HistorialAdmin.IdUsuario == Usuario.IdUsuario)
        )
        return self.caller.Consultar(self._Filtrar(consulta, params))[0]["Ultima"]
