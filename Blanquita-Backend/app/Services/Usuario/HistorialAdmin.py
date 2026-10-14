from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Cantidades import DIAS_MAXIMOS_REPORTE_PRODUCCION
from app.Constants.HistorialAdmin import MODULO_OTROS, MODULOS_HISTORIAL_ADMIN, SEPARADOR_ACCION
from app.Models.Usuario.HistorialAdmin import (
    FiltroHistorialAdminRequest,
    HistorialAdminItem,
    ListarHistorialAdminRequest,
    ListarHistorialAdminResponse,
    ReporteHistorialAdminResponse,
    ReporteUsuarioHistorialAdminRequest,
    ReporteUsuarioHistorialAdminResponse,
    ResumenHistorialAdminResponse,
    ResumenModuloHistorialAdminResponse,
)
from app.Models.Usuario.RegistroIngreso import UsuarioRegistroIngresoResponse
from app.Repository.Usuario.HistorialAdmin import HistorialAdminRepository
from app.Repository.Usuario.RegistroIngreso import RegistroIngresoRepository


class HistorialAdminService:
    def __init__(self, db: Session):
        self.repository = HistorialAdminRepository(db)
        self.usuarios = RegistroIngresoRepository(db)

    def _ValidarFiltro(
        self, data: FiltroHistorialAdminRequest | ReporteUsuarioHistorialAdminRequest
    ) -> None:
        if data.FechaInicio > data.FechaFin:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="La fecha de inicio no puede ser posterior a la fecha de fin",
            )

        dias_periodo = (data.FechaFin - data.FechaInicio).days + 1
        if dias_periodo > DIAS_MAXIMOS_REPORTE_PRODUCCION:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El rango de fechas no puede superar los {DIAS_MAXIMOS_REPORTE_PRODUCCION} días",
            )

        if data.Modulo is not None and data.Modulo not in MODULOS_HISTORIAL_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El módulo debe ser uno de: {', '.join(MODULOS_HISTORIAL_ADMIN)}",
            )

    def _Params(self, data, ci_exacto: bool) -> dict:
        busqueda = (data.Busqueda or "").strip()
        return {
            "p_FechaInicio": data.FechaInicio,
            "p_FechaFin": data.FechaFin,
            "p_Modulo": data.Modulo,
            "p_Ci": data.Ci,
            "p_CiExacto": ci_exacto,
            "p_Busqueda": busqueda or None,
        }

    def _Item(self, fila: dict) -> HistorialAdminItem:
        accion, _, detalle = fila["Observacion"].partition(SEPARADOR_ACCION)
        return HistorialAdminItem(**fila, Accion=accion.strip(), Detalle=detalle.strip() or None)

    def _Resumen(self, params: dict) -> ResumenHistorialAdminResponse:
        conteos = {f["Modulo"]: f["Cantidad"] for f in self.repository.ContarPorModulo(params)}

        return ResumenHistorialAdminResponse(
            Total=sum(conteos.values()),
            AdministradoresDistintos=self.repository.ContarAdministradoresDistintos(params),
            Modulos=[
                ResumenModuloHistorialAdminResponse(Modulo=modulo, Cantidad=conteos.get(modulo, 0))
                for modulo in MODULOS_HISTORIAL_ADMIN
                if modulo != MODULO_OTROS or conteos.get(modulo)
            ],
        )

    def ListarAcciones(self, data: ListarHistorialAdminRequest) -> ListarHistorialAdminResponse:
        self._ValidarFiltro(data)
        params = self._Params(data, ci_exacto=False)
        total, filas = self.repository.ListarAcciones(
            {**params, "Pagina": data.Pagina, "TamanoPagina": data.TamanoPagina}
        )

        return ListarHistorialAdminResponse(
            Total=total,
            Pagina=data.Pagina,
            TamanoPagina=data.TamanoPagina,
            Resumen=self._Resumen(params),
            Acciones=[self._Item(fila) for fila in filas],
        )

    def ReporteGeneral(self, data: FiltroHistorialAdminRequest) -> ReporteHistorialAdminResponse:
        self._ValidarFiltro(data)
        params = self._Params(data, ci_exacto=False)
        acciones = [self._Item(fila) for fila in self.repository.ObtenerAcciones(params)]

        if not acciones:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No hay acciones de administrador en el período y los filtros seleccionados",
            )

        return ReporteHistorialAdminResponse(
            PeriodoInicio=data.FechaInicio,
            PeriodoFin=data.FechaFin,
            Modulo=data.Modulo,
            Ci=data.Ci,
            Busqueda=params["p_Busqueda"],
            Resumen=self._Resumen(params),
            Acciones=acciones,
        )

    def ResumenUsuario(
        self, data: ReporteUsuarioHistorialAdminRequest
    ) -> ReporteUsuarioHistorialAdminResponse:
        self._ValidarFiltro(data)
        params = self._Params(data, ci_exacto=True)
        acciones = [self._Item(fila) for fila in self.repository.ObtenerAcciones(params)]
        usuario = self.usuarios.ObtenerUsuarioPorCi(data.Ci)

        return ReporteUsuarioHistorialAdminResponse(
            PeriodoInicio=data.FechaInicio,
            PeriodoFin=data.FechaFin,
            Ci=data.Ci,
            Modulo=data.Modulo,
            Busqueda=params["p_Busqueda"],
            Usuario=UsuarioRegistroIngresoResponse(**usuario) if usuario else None,
            Resumen=self._Resumen(params),
            UltimaAccion=acciones[0].FechaMovimiento if acciones else None,
            Acciones=acciones,
        )

    def ReporteUsuario(
        self, data: ReporteUsuarioHistorialAdminRequest
    ) -> ReporteUsuarioHistorialAdminResponse:
        resumen = self.ResumenUsuario(data)

        if not resumen.Acciones:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No hay acciones de administrador del CI {data.Ci} en el período seleccionado",
            )

        return resumen
