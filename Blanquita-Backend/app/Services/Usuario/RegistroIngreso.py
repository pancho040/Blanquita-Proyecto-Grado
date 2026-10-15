from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Cantidades import DIAS_MAXIMOS_REPORTE_PRODUCCION
from app.Constants.RegistroIngreso import (
    REGISTRO_INGRESO,
    REGISTRO_INTENTO_FALLIDO,
    REGISTRO_SALIDA,
    REGISTROS_INGRESO,
)
from app.Models.Usuario.RegistroIngreso import (
    FiltroRegistroIngresoRequest,
    ListarRegistroIngresoRequest,
    ListarRegistroIngresoResponse,
    RegistroIngresoItem,
    ReporteRegistroIngresoResponse,
    ReporteUsuarioRegistroIngresoRequest,
    ReporteUsuarioRegistroIngresoResponse,
    ResumenRegistroIngresoResponse,
    UsuarioRegistroIngresoResponse,
)
from app.Repository.Usuario.RegistroIngreso import RegistroIngresoRepository

NAVEGADORES = (
    ("Edg", "Edge"),
    ("OPR", "Opera"),
    ("SamsungBrowser", "Samsung Internet"),
    ("Firefox", "Firefox"),
    ("Chrome", "Chrome"),
    ("Safari", "Safari"),
)

SISTEMAS = (
    ("Android", "Android"),
    ("iPhone", "iOS"),
    ("iPad", "iPadOS"),
    ("Windows", "Windows"),
    ("Mac OS", "macOS"),
    ("Linux", "Linux"),
)


def _Buscar(texto: str, opciones: tuple) -> str | None:
    return next((nombre for clave, nombre in opciones if clave in texto), None)


def ResumirUserAgent(user_agent: str | None) -> str:
    if not user_agent:
        return "Desconocido"
    partes = [p for p in (_Buscar(user_agent, NAVEGADORES), _Buscar(user_agent, SISTEMAS)) if p]
    return " · ".join(partes) if partes else "Otro"


class RegistroIngresoService:
    def __init__(self, db: Session):
        self.repository = RegistroIngresoRepository(db)

    def _ValidarFiltro(self, data: FiltroRegistroIngresoRequest | ReporteUsuarioRegistroIngresoRequest) -> None:
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

        if data.Registro is not None and data.Registro not in REGISTROS_INGRESO:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El registro debe ser uno de: {', '.join(REGISTROS_INGRESO)}",
            )

    def _Params(self, data, ci_exacto: bool) -> dict:
        return {
            "p_FechaInicio": data.FechaInicio,
            "p_FechaFin": data.FechaFin,
            "p_Registro": data.Registro,
            "p_Ci": data.Ci,
            "p_CiExacto": ci_exacto,
        }

    def _Item(self, fila: dict) -> RegistroIngresoItem:
        return RegistroIngresoItem(**fila, Dispositivo=ResumirUserAgent(fila["UserAgent"]))

    def _Resumen(self, params: dict) -> ResumenRegistroIngresoResponse:
        conteos = {f["Registro"]: f["Cantidad"] for f in self.repository.ContarPorRegistro(params)}

        return ResumenRegistroIngresoResponse(
            Ingresos=conteos.get(REGISTRO_INGRESO, 0),
            Salidas=conteos.get(REGISTRO_SALIDA, 0),
            IntentosFallidos=conteos.get(REGISTRO_INTENTO_FALLIDO, 0),
            Total=sum(conteos.values()),
            CisDistintos=self.repository.ContarCisDistintos(params),
        )

    def ListarRegistros(self, data: ListarRegistroIngresoRequest) -> ListarRegistroIngresoResponse:
        self._ValidarFiltro(data)
        params = self._Params(data, ci_exacto=False)
        total, filas = self.repository.ListarRegistros(
            {**params, "Pagina": data.Pagina, "TamanoPagina": data.TamanoPagina}
        )

        return ListarRegistroIngresoResponse(
            Total=total,
            Pagina=data.Pagina,
            TamanoPagina=data.TamanoPagina,
            Resumen=self._Resumen(params),
            Registros=[self._Item(fila) for fila in filas],
        )

    def ReporteGeneral(self, data: FiltroRegistroIngresoRequest) -> ReporteRegistroIngresoResponse:
        self._ValidarFiltro(data)
        params = self._Params(data, ci_exacto=False)
        registros = [self._Item(fila) for fila in self.repository.ObtenerRegistros(params)]

        if not registros:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No hay registros de acceso en el período y los filtros seleccionados",
            )

        return ReporteRegistroIngresoResponse(
            PeriodoInicio=data.FechaInicio,
            PeriodoFin=data.FechaFin,
            Registro=data.Registro,
            Ci=data.Ci,
            Resumen=self._Resumen(params),
            Registros=registros,
        )

    def ResumenUsuario(
        self, data: ReporteUsuarioRegistroIngresoRequest
    ) -> ReporteUsuarioRegistroIngresoResponse:
        self._ValidarFiltro(data)
        params = self._Params(data, ci_exacto=True)
        registros = [self._Item(fila) for fila in self.repository.ObtenerRegistros(params)]
        usuario = self.repository.ObtenerUsuarioPorCi(data.Ci)

        return ReporteUsuarioRegistroIngresoResponse(
            PeriodoInicio=data.FechaInicio,
            PeriodoFin=data.FechaFin,
            Ci=data.Ci,
            Registro=data.Registro,
            Usuario=UsuarioRegistroIngresoResponse(**usuario) if usuario else None,
            Resumen=self._Resumen(params),
            UltimoIngreso=self._Ultimo(registros, REGISTRO_INGRESO),
            UltimoIntentoFallido=self._Ultimo(registros, REGISTRO_INTENTO_FALLIDO),
            Registros=registros,
        )

    def ReporteUsuario(
        self, data: ReporteUsuarioRegistroIngresoRequest
    ) -> ReporteUsuarioRegistroIngresoResponse:
        resumen = self.ResumenUsuario(data)

        if not resumen.Registros:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No hay registros de acceso del CI {data.Ci} en el período seleccionado",
            )

        return resumen

    def _Ultimo(self, registros: list[RegistroIngresoItem], registro: str):
        return next((r.FechaRegistro for r in registros if r.Registro == registro), None)
