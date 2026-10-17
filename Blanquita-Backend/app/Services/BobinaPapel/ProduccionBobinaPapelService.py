from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Cantidades import (
    CANTIDAD_INGRESO_LOGS,
    LONGITUD_MAXIMA_DESCRIPCION,
    LONGITUD_MINIMA_DESCRIPCION,
)
from app.Constants.Estados import (
    ESTADO_MATERIA_PRIMA_AGOTADO,
    ESTADO_MATERIA_PRIMA_EN_ALMACEN,
    ESTADO_MATERIA_PRIMA_EN_PRODUCCION,
    ESTADO_MATERIA_PRIMA_FUERA_INVENTARIO,
    ESTADO_PRODUCCION_CAMBIO_LINEA,
    ESTADO_PRODUCCION_CANCELADA,
    ESTADO_PRODUCCION_EN_PRODUCCION,
    ESTADO_PRODUCCION_FINALIZADO,
    ESTADO_PRODUCCION_PAUSA,
    MOVIMIENTO_MATERIA_PRIMA_CAMBIO_LINEA,
    MOVIMIENTO_MATERIA_PRIMA_PRODUCCION_TERMINADA,
    MOVIMIENTO_MATERIA_PRIMA_RETIRO_FALLA,
    MOVIMIENTO_MATERIA_PRIMA_TRASLADO,
)
from app.Models.BobinaPapel.ProduccionBobinaPapel import (
    CambiarLineaProduccionBobinaTuboRequest,
    CambiarLineaProduccionBobinaTuboResponse,
    CancelarProduccionBobinaTuboRequest,
    CancelarProduccionBobinaTuboResponse,
    FinalizarProduccionBobinaTuboRequest,
    FinalizarProduccionBobinaTuboResponse,
    IniciarProduccionBobinaTuboRequest,
    IniciarProduccionBobinaTuboResponse,
    InsertarMovimientoOperadorLogsRequest,
    InsertarMovimientoOperadorLogsResponse,
    PausarProduccionBobinaTuboRequest,
    PausarProduccionBobinaTuboResponse,
    ReanudarProduccionBobinaTuboRequest,
    ReanudarProduccionBobinaTuboResponse,
    VerPausasProduccionBobinaTuboActivasRequest,
    VerPausasProduccionBobinaTuboActivasResponse,
    VerProduccionBobinaTuboRequest,
    VerProduccionBobinaTuboResponse,
)
from app.Repository.BobinaPapel.ProduccionBobinaPapel import ProduccionBobinaPapelRepository
from app.Schemas.BobinaPapel import MovimientoBobina
from app.Schemas.Produccion import (
    CancelacionProduccionBobinaTubo,
    MovimientoOperadorLogs,
    PausaProduccionBobinaTubo,
    ProduccionBobinaTubo,
)
from app.utils.validators import EsCantidadValida, REGLA_CARACTERES_OBSERVACION, ValidarTexto

TIPO_LOG_INGRESO = 1
TIPO_LOG_DESCUENTO = 2


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


class ProduccionBobinaPapelService:
    def __init__(self, db: Session):
        self.repository = ProduccionBobinaPapelRepository(db)

    def IniciarProduccionBobinaTubo(
        self, data: IniciarProduccionBobinaTuboRequest, id_usuario: int
    ) -> IniciarProduccionBobinaTuboResponse:
        if data.IdBobina1 == data.IdBobina2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="IdBobina1 e IdBobina2 no pueden ser la misma bobina",
            )

        bobinas = self.repository.ObtenerBobinasBloqueadas([data.IdBobina1, data.IdBobina2])
        if len(bobinas) != 2:
            self._Revertir(status.HTTP_404_NOT_FOUND, "Una de las bobinas indicadas no existe")

        bobina1, bobina2 = bobinas[data.IdBobina1], bobinas[data.IdBobina2]

        if any(b.IdEstadoMateriaPrima != ESTADO_MATERIA_PRIMA_EN_ALMACEN for b in (bobina1, bobina2)):
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "Una de las bobinas indicadas no está disponible en almacén",
            )

        if bobina1.IdTipoBobina != bobina2.IdTipoBobina:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "Las bobinas deben ser del mismo tipo para iniciar la producción",
            )

        producto = self._ResolverProducto(bobina1.IdTipoBobina, data.IdProducto)

        turno = self.repository.TurnoActual()
        if turno is None:
            self._Revertir(status.HTTP_409_CONFLICT, "No hay turnos configurados")

        produccion = ProduccionBobinaTubo(
            IdEstadoProduccion=ESTADO_PRODUCCION_EN_PRODUCCION,
            IdUsuario=id_usuario,
            IdBobina_1=bobina1.IdBobinaPapel,
            IdBobina_2=bobina2.IdBobinaPapel,
            IdTurno=turno["IdTurno"],
            IdProducto=producto["IdProducto"],
            FechaInicioProduccion=_ahora(),
            CantidadLogsActual=0,
        )
        self.repository.Agregar(produccion)

        movimientos = self._MoverBobinas(
            (bobina1, bobina2),
            ESTADO_MATERIA_PRIMA_EN_PRODUCCION,
            MOVIMIENTO_MATERIA_PRIMA_TRASLADO,
            id_usuario,
            f"Traslado a producción - Producción Bobina Tubo #{produccion.IdProduccionBobinaTubo}",
        )
        self.repository.Guardar(
            produccion,
            *movimientos,
            mensaje_error="No se pudo iniciar la producción de bobina tubo",
        )

        return IniciarProduccionBobinaTuboResponse(
            IdProduccionBobinaTubo=produccion.IdProduccionBobinaTubo,
            FechaInicioProduccion=produccion.FechaInicioProduccion,
            IdTurno=turno["IdTurno"],
            NombreTurno=turno["NombreTurno"],
            IdProducto=producto["IdProducto"],
            NombreProducto=producto["NombreProducto"],
        )

    def CambiarLineaProduccion(
        self, data: CambiarLineaProduccionBobinaTuboRequest, id_usuario: int
    ) -> CambiarLineaProduccionBobinaTuboResponse:
        anterior = self._ObtenerProduccion(data.IdProduccionBobinaTubo)

        if anterior.IdEstadoProduccion != ESTADO_PRODUCCION_EN_PRODUCCION:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "La producción indicada no se encuentra En Producción, no puede cambiar de línea",
            )

        if anterior.IdProducto == data.IdProducto:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "La producción ya se encuentra en la línea indicada",
            )

        bobinas = self.repository.ObtenerBobinasBloqueadas(
            [anterior.IdBobina_1, anterior.IdBobina_2]
        )
        id_tipo_bobina = bobinas[anterior.IdBobina_1].IdTipoBobina

        activos = [p for p in self.repository.ProductosDelTipo(id_tipo_bobina) if p["Activo"]]
        if len(activos) < 2:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "El cambio de línea solo está permitido en tipos de bobina con más de un producto activo",
            )

        producto = self._ResolverProducto(id_tipo_bobina, data.IdProducto)

        turno = self.repository.TurnoActual()
        if turno is None:
            self._Revertir(status.HTTP_409_CONFLICT, "No hay turnos configurados")

        ahora = _ahora()
        anterior.IdEstadoProduccion = ESTADO_PRODUCCION_CAMBIO_LINEA
        anterior.FechaFinProduccion = ahora

        nueva = ProduccionBobinaTubo(
            IdEstadoProduccion=ESTADO_PRODUCCION_EN_PRODUCCION,
            IdUsuario=id_usuario,
            IdBobina_1=anterior.IdBobina_1,
            IdBobina_2=anterior.IdBobina_2,
            IdTurno=turno["IdTurno"],
            IdProducto=producto["IdProducto"],
            FechaInicioProduccion=ahora,
            CantidadLogsActual=0,
        )
        self.repository.Agregar(nueva)

        movimientos = self._MoverBobinas(
            bobinas.values(),
            ESTADO_MATERIA_PRIMA_EN_PRODUCCION,
            MOVIMIENTO_MATERIA_PRIMA_CAMBIO_LINEA,
            id_usuario,
            (
                f"Cambio de línea - Producción Bobina Tubo #{anterior.IdProduccionBobinaTubo} "
                f"→ #{nueva.IdProduccionBobinaTubo} ({producto['NombreProducto']})"
            ),
        )
        self.repository.Guardar(
            anterior,
            nueva,
            *movimientos,
            mensaje_error="No se pudo cambiar la línea de la producción de bobina tubo",
        )

        return CambiarLineaProduccionBobinaTuboResponse(
            IdProduccionAnterior=anterior.IdProduccionBobinaTubo,
            IdProduccionBobinaTubo=nueva.IdProduccionBobinaTubo,
            FechaInicioProduccion=nueva.FechaInicioProduccion,
            IdTurno=turno["IdTurno"],
            NombreTurno=turno["NombreTurno"],
            IdProducto=producto["IdProducto"],
            NombreProducto=producto["NombreProducto"],
        )

    def FinalizarProduccion(
        self, data: FinalizarProduccionBobinaTuboRequest, id_usuario: int
    ) -> FinalizarProduccionBobinaTuboResponse:
        produccion = self._ObtenerProduccion(data.IdProduccionBobinaTubo)

        if produccion.IdEstadoProduccion != ESTADO_PRODUCCION_EN_PRODUCCION:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "La producción indicada no se encuentra En Producción, no puede finalizarse",
            )

        produccion.IdEstadoProduccion = ESTADO_PRODUCCION_FINALIZADO
        produccion.FechaFinProduccion = _ahora()

        bobinas = self.repository.ObtenerBobinasBloqueadas(
            [produccion.IdBobina_1, produccion.IdBobina_2]
        )
        movimientos = self._MoverBobinas(
            bobinas.values(),
            ESTADO_MATERIA_PRIMA_AGOTADO,
            MOVIMIENTO_MATERIA_PRIMA_PRODUCCION_TERMINADA,
            id_usuario,
            f"Producción terminada - Bobina Tubo #{produccion.IdProduccionBobinaTubo}",
        )
        self.repository.Guardar(
            produccion,
            *movimientos,
            mensaje_error="No se pudo finalizar la producción de bobina tubo",
        )

        return FinalizarProduccionBobinaTuboResponse(
            IdProduccionBobinaTubo=produccion.IdProduccionBobinaTubo,
            FechaFinProduccion=produccion.FechaFinProduccion,
            IdEstadoProduccion=ESTADO_PRODUCCION_FINALIZADO,
            NombreEstadoProduccion=self.repository.NombreEstadoProduccion(
                ESTADO_PRODUCCION_FINALIZADO
            ),
        )

    def PausarProduccion(
        self, data: PausarProduccionBobinaTuboRequest, id_usuario: int
    ) -> PausarProduccionBobinaTuboResponse:
        motivo = self._ValidarTexto(data.MotivoPausaProduccion, "El motivo de la pausa es obligatorio")

        produccion = self._ObtenerProduccion(data.IdProduccionBobinaTubo)

        if produccion.IdEstadoProduccion != ESTADO_PRODUCCION_EN_PRODUCCION:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "La producción indicada no se encuentra En Producción, no puede pausarse",
            )

        produccion.IdEstadoProduccion = ESTADO_PRODUCCION_PAUSA
        pausa = PausaProduccionBobinaTubo(
            IdProduccionBobinaTubo=produccion.IdProduccionBobinaTubo,
            IdUsuario=id_usuario,
            FechaHoraPausa=_ahora(),
            MotivoPausaProduccion=motivo,
        )
        self.repository.Guardar(
            produccion,
            pausa,
            mensaje_error="No se pudo pausar la producción de bobina tubo",
        )

        return PausarProduccionBobinaTuboResponse(
            IdPausaProduccionBobinaTubo=pausa.IdPausaProduccionBobinaTubo,
            IdProduccionBobinaTubo=pausa.IdProduccionBobinaTubo,
            FechaHoraPausa=pausa.FechaHoraPausa,
            MotivoPausaProduccion=pausa.MotivoPausaProduccion,
            FechaHoraReanudacion=None,
            IdEstadoProduccion=ESTADO_PRODUCCION_PAUSA,
        )

    def ReanudarProduccion(
        self, data: ReanudarProduccionBobinaTuboRequest, id_usuario: int
    ) -> ReanudarProduccionBobinaTuboResponse:
        produccion = self._ObtenerProduccion(data.IdProduccionBobinaTubo)

        if produccion.IdEstadoProduccion != ESTADO_PRODUCCION_PAUSA:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "La producción indicada no se encuentra en Pausa, no puede reanudarse",
            )

        pausa = self.repository.ObtenerPausaActiva(produccion.IdProduccionBobinaTubo)
        if pausa is None:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "No existe una pausa activa para la producción indicada",
            )

        pausa.FechaHoraReanudacion = _ahora()
        produccion.IdEstadoProduccion = ESTADO_PRODUCCION_EN_PRODUCCION
        self.repository.Guardar(
            produccion,
            pausa,
            mensaje_error="No se pudo reanudar la producción de bobina tubo",
        )

        return ReanudarProduccionBobinaTuboResponse(
            IdPausaProduccionBobinaTubo=pausa.IdPausaProduccionBobinaTubo,
            IdProduccionBobinaTubo=pausa.IdProduccionBobinaTubo,
            FechaHoraPausa=pausa.FechaHoraPausa,
            MotivoPausaProduccion=pausa.MotivoPausaProduccion,
            FechaHoraReanudacion=pausa.FechaHoraReanudacion,
            IdEstadoProduccion=ESTADO_PRODUCCION_EN_PRODUCCION,
        )

    def CancelarProduccion(
        self, data: CancelarProduccionBobinaTuboRequest, id_usuario: int
    ) -> CancelarProduccionBobinaTuboResponse:
        motivo = self._ValidarTexto(data.MotivoCancelacion, "El motivo de cancelación es obligatorio")

        produccion = self._ObtenerProduccion(data.IdProduccionBobinaTubo)

        if produccion.IdEstadoProduccion != ESTADO_PRODUCCION_PAUSA:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "La producción indicada no está en Pausa, no se puede cancelar",
            )

        produccion.IdEstadoProduccion = ESTADO_PRODUCCION_CANCELADA
        produccion.FechaFinProduccion = _ahora()

        bobinas = self.repository.ObtenerBobinasBloqueadas(
            [produccion.IdBobina_1, produccion.IdBobina_2]
        )
        movimientos = self._MoverBobinas(
            bobinas.values(),
            ESTADO_MATERIA_PRIMA_FUERA_INVENTARIO,
            MOVIMIENTO_MATERIA_PRIMA_RETIRO_FALLA,
            id_usuario,
            f"Retiro por cancelación de producción - Bobina Tubo #{produccion.IdProduccionBobinaTubo}",
        )
        cancelacion = CancelacionProduccionBobinaTubo(
            IdProduccionBobinaTubo=produccion.IdProduccionBobinaTubo,
            IdUsuario=id_usuario,
            MotivoCancelacion=motivo,
        )
        self.repository.Guardar(
            produccion,
            cancelacion,
            *movimientos,
            mensaje_error="No se pudo cancelar la producción de bobina tubo",
        )

        return CancelarProduccionBobinaTuboResponse(
            IdCancelacionProduccionBobinaTubo=cancelacion.IdCancelacionProduccionBobinaTubo,
            IdProduccionBobinaTubo=produccion.IdProduccionBobinaTubo,
            FechaHoraCancelacion=cancelacion.FechaHoraCancelacion,
            MotivoCancelacion=cancelacion.MotivoCancelacion,
            IdEstadoProduccion=ESTADO_PRODUCCION_CANCELADA,
        )

    def InsertarMovimientoOperadorLogs(
        self, data: InsertarMovimientoOperadorLogsRequest, id_usuario: int
    ) -> InsertarMovimientoOperadorLogsResponse:
        if not EsCantidadValida(data.CantidadLogs, CANTIDAD_INGRESO_LOGS):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La cantidad máxima de ingreso es de {CANTIDAD_INGRESO_LOGS}",
            )

        if data.IdTipoMovimientoOperadorLogs not in (TIPO_LOG_INGRESO, TIPO_LOG_DESCUENTO):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El tipo de movimiento {data.IdTipoMovimientoOperadorLogs} no es válido",
            )

        produccion = self._ObtenerProduccion(data.IdProduccionBobinaTubo)

        if produccion.IdEstadoProduccion not in (ESTADO_PRODUCCION_EN_PRODUCCION, ESTADO_PRODUCCION_PAUSA):
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "La producción indicada no está En Producción ni en Pausa, no se pueden registrar logs",
            )

        if data.IdTipoMovimientoOperadorLogs == TIPO_LOG_DESCUENTO:
            if data.CantidadLogs > produccion.CantidadLogsActual:
                self._Revertir(
                    status.HTTP_409_CONFLICT,
                    "La cantidad a descontar supera el total de logs registrados",
                )
            produccion.CantidadLogsActual -= data.CantidadLogs
        else:
            produccion.CantidadLogsActual += data.CantidadLogs

        movimiento = MovimientoOperadorLogs(
            IdProduccionBobinaTubo=produccion.IdProduccionBobinaTubo,
            IdTipoMovimientoOperadorLogs=data.IdTipoMovimientoOperadorLogs,
            IdUsuario=id_usuario,
            CantidadLogs=data.CantidadLogs,
            Observacion=data.Observacion,
        )
        self.repository.Guardar(
            produccion,
            movimiento,
            mensaje_error="No se pudo registrar el movimiento de logs del operador",
        )

        return InsertarMovimientoOperadorLogsResponse(
            IdMovimientoOperadorLogs=movimiento.IdMovimientoOperadorLogs,
            IdProduccionBobinaTubo=produccion.IdProduccionBobinaTubo,
            IdTipoMovimientoOperadorLogs=movimiento.IdTipoMovimientoOperadorLogs,
            CantidadLogs=movimiento.CantidadLogs,
            CantidadTotalActual=produccion.CantidadLogsActual,
            FechaMovimiento=movimiento.FechaMovimiento,
        )

    def VerProduccionBobinaTubo(
        self, data: VerProduccionBobinaTuboRequest
    ) -> list[VerProduccionBobinaTuboResponse]:
        params = {
            "p_IdTipoBobina": data.IdTipoBobina,
            "p_IdProducto": data.IdProducto,
        }

        return [
            VerProduccionBobinaTuboResponse(**resultado)
            for resultado in self.repository.VerProduccionBobinaTubo(params)
        ]

    def VerPausasActivas(
        self, data: VerPausasProduccionBobinaTuboActivasRequest
    ) -> list[VerPausasProduccionBobinaTuboActivasResponse]:
        params = {
            "p_FiltroIdTipoBobina": data.FiltroIdTipoBobina,
            "p_FiltroIdProducto": data.FiltroIdProducto,
        }

        return [
            VerPausasProduccionBobinaTuboActivasResponse(**resultado)
            for resultado in self.repository.VerPausasProduccionBobinaTuboActivas(params)
        ]

    def _ResolverProducto(self, id_tipo_bobina: int, id_producto: int | None) -> dict:
        productos = self.repository.ProductosDelTipo(id_tipo_bobina)
        activos = [producto for producto in productos if producto["Activo"]]

        if id_producto is None:
            if len(activos) == 1:
                return activos[0]
            if not activos:
                self._Revertir(
                    status.HTTP_409_CONFLICT,
                    "El tipo de bobina no tiene productos activos asociados",
                )
            self._Revertir(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Debe seleccionar el producto para la producción",
            )

        producto = next((p for p in productos if p["IdProducto"] == id_producto), None)
        if producto is None:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                f"El producto {id_producto} no es válido para este tipo de bobina",
            )

        if not producto["Activo"]:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                f"El producto {producto['NombreProducto']} está inactivo, no puede usarse en una producción",
            )

        return producto

    def _MoverBobinas(
        self,
        bobinas,
        id_estado: int,
        id_tipo_movimiento: int,
        id_usuario: int,
        observacion: str,
    ) -> list[MovimientoBobina]:
        movimientos = []
        for bobina in bobinas:
            bobina.IdEstadoMateriaPrima = id_estado
            movimientos.append(
                MovimientoBobina(
                    IdBobinaPapel=bobina.IdBobinaPapel,
                    IdTipoMovimiento=id_tipo_movimiento,
                    IdUsuario=id_usuario,
                    Observacion=observacion,
                )
            )
        return movimientos

    def _ObtenerProduccion(self, id_produccion: int) -> ProduccionBobinaTubo:
        produccion = self.repository.ObtenerProduccionBloqueada(id_produccion)
        if produccion is None:
            self._Revertir(
                status.HTTP_404_NOT_FOUND,
                f"No existe la producción con id {id_produccion}",
            )
        return produccion

    def _ValidarTexto(self, texto: str | None, mensaje: str) -> str:
        texto = (texto or "").strip()
        if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, texto):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{mensaje}, debe tener entre {LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, {REGLA_CARACTERES_OBSERVACION}",
            )
        return texto

    def _Revertir(self, codigo: int, mensaje: str) -> None:
        self.repository.Revertir()
        raise HTTPException(status_code=codigo, detail=mensaje)
