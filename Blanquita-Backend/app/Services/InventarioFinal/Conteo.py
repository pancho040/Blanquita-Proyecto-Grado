from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.Constants.Cantidades import (
    CANTIDAD_MAXIMA_CONTEO_PRODUCTO_TERMINADO,
    DIAS_MAXIMOS_REPORTE_PRODUCCION,
    HORAS_ALERTA_CONTEO_ABIERTO,
    LONGITUD_MAXIMA_DESCRIPCION,
    LONGITUD_MINIMA_DESCRIPCION,
)
from app.Constants.Estados import (
    ESTADO_CONTEO_ABIERTO,
    ESTADO_CONTEO_ANULADO,
    ESTADO_CONTEO_CERRADO,
    ESTADOS_CONTEO,
    MOVIMIENTO_PT_AJUSTE_NEGATIVO,
    MOVIMIENTO_PT_AJUSTE_POSITIVO,
)
from app.Constants.Horario import HORA_LIMITE_INICIO_CONTEO
from app.Models.InventarioFinal.Conteo import (
    ActaConteoProductoTerminadoResponse,
    AjusteManualConteoResponse,
    AnularConteoProductoTerminadoRequest,
    DiferenciaPresentacionConteoResponse,
    CerrarConteoProductoTerminadoRequest,
    ConteoProductoTerminadoResponse,
    DetalleConteoProductoTerminadoResponse,
    EstadoConteoProductoTerminadoResponse,
    HojaConteoPresentacionResponse,
    HojaConteoProductoTerminadoResponse,
    IniciarConteoProductoTerminadoRequest,
    RegistrarCantidadesConteoRequest,
    ReporteConteosProductoTerminadoResponse,
    ResumenConteoProductoTerminadoResponse,
)
from app.Repository.InventarioFinal.Conteo import ConteoProductoTerminadoRepository
from app.Repository.InventarioFinal.ProductoFinal import ProductoFinalRepository
from app.Schemas.Producto import InventarioProductoTerminado, MovimientoProductoTerminado
from app.Services.InventarioFinal.Reporte import _nombre_presentacion, _unidad_linea
from app.utils.dates import ZONA_BOLIVIA
from app.utils.validators import REGLA_CARACTERES_OBSERVACION, ValidarTexto


def conteo_atrasado(fila: dict) -> bool:
    return fila["Estado"] == ESTADO_CONTEO_ABIERTO and datetime.now(timezone.utc) - fila[
        "FechaHoraInicio"
    ] > timedelta(hours=HORAS_ALERTA_CONTEO_ABIERTO)


def resumen_conteo(fila: dict) -> ResumenConteoProductoTerminadoResponse:
    return ResumenConteoProductoTerminadoResponse(**fila, Atrasado=conteo_atrasado(fila))


def _datos_presentacion(fila: dict) -> dict:
    return {
        **fila,
        "NombrePresentacion": _nombre_presentacion(fila["NombreProducto"], fila["CantidadRollosUnidades"]),
        "Unidad": _unidad_linea(fila["IdProducto"]),
    }


def _validar_motivo(texto: str | None, campo: str) -> str:
    motivo = (texto or "").strip()
    if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, motivo):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"{campo} es obligatorio, debe tener entre {LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, {REGLA_CARACTERES_OBSERVACION}",
        )
    return motivo


def _validar_confirmacion(confirmado: bool, accion: str) -> None:
    if not confirmado:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Debe confirmar que desea {accion} el conteo físico",
        )


class ConteoProductoTerminadoService:
    def __init__(self, db: Session):
        self.repository = ConteoProductoTerminadoRepository(db)
        self.producto_repository = ProductoFinalRepository(db)

    def VerActivo(self) -> EstadoConteoProductoTerminadoResponse:
        fila = self.repository.ObtenerConteoAbierto()
        if fila is None:
            return EstadoConteoProductoTerminadoResponse(
                Abierto=False, HorasAlerta=HORAS_ALERTA_CONTEO_ABIERTO
            )
        return EstadoConteoProductoTerminadoResponse(
            Abierto=True,
            HorasAlerta=HORAS_ALERTA_CONTEO_ABIERTO,
            Conteo=self._Conteo(fila),
        )

    def VerConteo(self, id_conteo: int) -> ConteoProductoTerminadoResponse:
        fila = self.repository.ObtenerConteo(id_conteo)
        if fila is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No existe el conteo físico N° {id_conteo}",
            )
        return self._Conteo(fila)

    def Listar(
        self, fecha_inicio: date | None, fecha_fin: date | None, estados: list[str] | None = None
    ) -> list[ResumenConteoProductoTerminadoResponse]:
        if fecha_inicio and fecha_fin and fecha_inicio > fecha_fin:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="La fecha de inicio no puede ser posterior a la fecha de fin",
            )
        invalidos = [estado for estado in estados or [] if estado not in ESTADOS_CONTEO]
        if invalidos:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Estados de conteo no válidos: {', '.join(invalidos)}",
            )
        return [
            resumen_conteo(fila)
            for fila in self.repository.ListarConteos(fecha_inicio, fecha_fin, estados)
        ]

    def Reporte(
        self, fecha_inicio: date, fecha_fin: date, estados: list[str] | None
    ) -> ReporteConteosProductoTerminadoResponse:
        if (fecha_fin - fecha_inicio).days + 1 > DIAS_MAXIMOS_REPORTE_PRODUCCION:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El rango de fechas no puede superar los {DIAS_MAXIMOS_REPORTE_PRODUCCION} días",
            )
        conteos = self.Listar(fecha_inicio, fecha_fin, estados)
        if not conteos:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No hay conteos físicos en el período y los estados seleccionados",
            )

        incluye_cerrados = not estados or ESTADO_CONTEO_CERRADO in estados
        presentaciones = (
            [
                DiferenciaPresentacionConteoResponse(**_datos_presentacion(fila))
                for fila in self.repository.DiferenciasPorPresentacion(fecha_inicio, fecha_fin)
            ]
            if incluye_cerrados
            else []
        )

        return ReporteConteosProductoTerminadoResponse(
            PeriodoInicio=fecha_inicio,
            PeriodoFin=fecha_fin,
            Estados=list(estados or ESTADOS_CONTEO),
            Conteos=conteos,
            Presentaciones=presentaciones,
        )

    def Iniciar(
        self, data: IniciarConteoProductoTerminadoRequest, id_usuario: int
    ) -> ConteoProductoTerminadoResponse:
        motivo = _validar_motivo(data.Motivo, "El motivo")

        if datetime.now(ZONA_BOLIVIA).time() >= HORA_LIMITE_INICIO_CONTEO:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"No se puede iniciar un conteo físico después de las {HORA_LIMITE_INICIO_CONTEO:%H:%M}",
            )

        bloqueo = self.producto_repository.ObtenerBloqueoActivo()
        if bloqueo is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Hay un bloqueo manual activo de producto terminado por {bloqueo['UsuarioBloqueo']}, debe desbloquearse antes de iniciar el conteo físico",
            )

        if self.repository.ObtenerConteoAbierto() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya hay un conteo físico de producto terminado en curso",
            )

        return self.VerConteo(self.repository.IniciarConteo(id_usuario, motivo))

    def RegistrarCantidades(
        self, id_conteo: int, data: RegistrarCantidadesConteoRequest, id_usuario: int
    ) -> ConteoProductoTerminadoResponse:
        if not data.Cantidades:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Debe incluir al menos una cantidad contada",
            )

        ids_presentacion = [item.IdPresentacion for item in data.Cantidades]
        if len(set(ids_presentacion)) != len(ids_presentacion):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Hay presentaciones repetidas en el conteo",
            )

        for item in data.Cantidades:
            if not 0 <= item.CantidadFisica <= CANTIDAD_MAXIMA_CONTEO_PRODUCTO_TERMINADO:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"La cantidad física debe estar entre 0 y {CANTIDAD_MAXIMA_CONTEO_PRODUCTO_TERMINADO}",
                )

        self._BloquearConteoAbierto(id_conteo)
        detalles = self.repository.DetallesBloqueados(id_conteo)

        ajenas = [str(i) for i in ids_presentacion if i not in detalles]
        if ajenas:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Las presentaciones {', '.join(ajenas)} no forman parte del conteo físico",
            )

        for item in data.Cantidades:
            detalle = detalles[item.IdPresentacion]
            detalle.CantidadFisica = item.CantidadFisica
            detalle.IdUsuarioConteo = id_usuario
            detalle.FechaHoraConteo = func.now()

        self.repository.Guardar("No se pudo registrar las cantidades del conteo físico")
        return self.VerConteo(id_conteo)

    def Cerrar(
        self, id_conteo: int, data: CerrarConteoProductoTerminadoRequest, id_usuario: int
    ) -> ConteoProductoTerminadoResponse:
        _validar_confirmacion(data.Confirmado, "cerrar")

        motivos: dict[int, str] = {}
        for item in data.Motivos:
            if item.IdPresentacion in motivos:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Hay presentaciones repetidas en los motivos",
                )
            motivos[item.IdPresentacion] = (item.Motivo or "").strip()

        conteo = self._BloquearConteoAbierto(id_conteo)
        detalles = self.repository.DetallesBloqueados(id_conteo)

        sin_contar = [d for d in detalles.values() if d.CantidadFisica is None]
        if sin_contar:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Faltan {len(sin_contar)} presentaciones por contar antes de cerrar el conteo",
            )

        con_diferencia = [
            d for d in detalles.values() if int(d.CantidadFisica) != int(d.CantidadSistema)
        ]
        codigos = {
            id_presentacion: presentacion.CodigoPresentacion
            for id_presentacion, (presentacion, _) in self.producto_repository.ObtenerPresentaciones(
                list(detalles)
            ).items()
        }

        sin_motivo = [
            codigos[d.IdPresentacion]
            for d in con_diferencia
            if not ValidarTexto(
                LONGITUD_MINIMA_DESCRIPCION,
                LONGITUD_MAXIMA_DESCRIPCION,
                motivos.get(d.IdPresentacion, ""),
            )
        ]
        if sin_motivo:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El motivo de la diferencia es obligatorio, debe tener entre {LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, {REGLA_CARACTERES_OBSERVACION}. Revise: {', '.join(sin_motivo)}",
            )

        inventarios = self.repository.InventariosBloqueados(list(detalles))
        cambiadas = [
            codigos[d.IdPresentacion]
            for d in detalles.values()
            if (
                int(inventarios[d.IdPresentacion].CantidadActual)
                if d.IdPresentacion in inventarios
                else 0
            )
            != int(d.CantidadSistema)
        ]
        if cambiadas:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El stock de {', '.join(cambiadas)} cambió durante el conteo, anule este conteo e inicie uno nuevo",
            )

        ajustes = []
        for detalle in con_diferencia:
            diferencia = int(detalle.CantidadFisica) - int(detalle.CantidadSistema)
            inventario = inventarios.get(detalle.IdPresentacion) or InventarioProductoTerminado(
                IdPresentacion=detalle.IdPresentacion, CantidadActual=0
            )
            inventario.CantidadActual = detalle.CantidadFisica
            movimiento = MovimientoProductoTerminado(
                IdTipoMovimientoInventario=(
                    MOVIMIENTO_PT_AJUSTE_POSITIVO if diferencia > 0 else MOVIMIENTO_PT_AJUSTE_NEGATIVO
                ),
                IdPresentacion=detalle.IdPresentacion,
                IdUsuario=id_usuario,
                CantidadIngresoInventario=abs(diferencia),
                Observacion=f"Conteo físico N° {id_conteo}: {motivos[detalle.IdPresentacion]}",
            )
            self.repository.Agregar(inventario)
            self.repository.Agregar(movimiento)
            ajustes.append((detalle, movimiento))

        self.repository.Enlazar()

        for detalle, movimiento in ajustes:
            detalle.IdMovimientoProductoTerminado = movimiento.IdMovimientoProductoTerminado
            detalle.MotivoDiferencia = motivos[detalle.IdPresentacion]

        conteo.Estado = ESTADO_CONTEO_CERRADO
        conteo.IdUsuarioCierre = id_usuario
        conteo.FechaHoraCierre = func.now()

        self.repository.Guardar("No se pudo cerrar el conteo físico de producto terminado")
        return self.VerConteo(id_conteo)

    def Anular(
        self, id_conteo: int, data: AnularConteoProductoTerminadoRequest, id_usuario: int
    ) -> ConteoProductoTerminadoResponse:
        _validar_confirmacion(data.Confirmado, "anular")
        motivo = _validar_motivo(data.Motivo, "El motivo de anulación")

        conteo = self._BloquearConteoAbierto(id_conteo)
        conteo.Estado = ESTADO_CONTEO_ANULADO
        conteo.MotivoAnulacion = motivo
        conteo.IdUsuarioCierre = id_usuario
        conteo.FechaHoraCierre = func.now()

        self.repository.Guardar("No se pudo anular el conteo físico de producto terminado")
        return self.VerConteo(id_conteo)

    def Acta(self, id_conteo: int) -> ActaConteoProductoTerminadoResponse:
        conteo = self.VerConteo(id_conteo)
        if conteo.Estado == ESTADO_CONTEO_ABIERTO:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El acta se genera cuando el conteo físico se cierra o se anula",
            )

        desde = self.repository.FechaCierreAnterior(id_conteo, conteo.FechaHoraInicio)
        ajustes = [
            AjusteManualConteoResponse(
                **fila,
                NombrePresentacion=_nombre_presentacion(fila["NombreProducto"], fila["CantidadRollosUnidades"]),
            )
            for fila in self.repository.AjustesManuales(desde, conteo.FechaHoraInicio)
        ]

        return ActaConteoProductoTerminadoResponse(
            **conteo.model_dump(), AjustesManualesDesde=desde, AjustesManuales=ajustes
        )

    def Hoja(self) -> HojaConteoProductoTerminadoResponse:
        abierto = self.repository.ObtenerConteoAbierto()
        filas = (
            self.repository.ObtenerDetalle(abierto["IdConteoProductoTerminado"])
            if abierto
            else self.repository.PresentacionesParaConteo()
        )
        if not filas:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No hay presentaciones de producto terminado para contar",
            )

        return HojaConteoProductoTerminadoResponse(
            FechaGeneracion=datetime.now(ZONA_BOLIVIA),
            IdConteoProductoTerminado=abierto["IdConteoProductoTerminado"] if abierto else None,
            FechaHoraInicio=abierto["FechaHoraInicio"] if abierto else None,
            Presentaciones=[HojaConteoPresentacionResponse(**_datos_presentacion(fila)) for fila in filas],
        )

    def _Conteo(self, fila: dict) -> ConteoProductoTerminadoResponse:
        detalle = [
            DetalleConteoProductoTerminadoResponse(
                **_datos_presentacion(item),
                Diferencia=(
                    int(item["CantidadFisica"]) - int(item["CantidadSistema"])
                    if item["CantidadFisica"] is not None
                    else None
                ),
            )
            for item in self.repository.ObtenerDetalle(fila["IdConteoProductoTerminado"])
        ]
        return ConteoProductoTerminadoResponse(
            **resumen_conteo(fila).model_dump(), Detalle=detalle
        )

    def _BloquearConteoAbierto(self, id_conteo: int):
        conteo = self.repository.BloquearConteo(id_conteo)
        if conteo is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No existe el conteo físico N° {id_conteo}",
            )
        if conteo.Estado != ESTADO_CONTEO_ABIERTO:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El conteo físico N° {id_conteo} ya está {conteo.Estado.lower()}",
            )
        return conteo
