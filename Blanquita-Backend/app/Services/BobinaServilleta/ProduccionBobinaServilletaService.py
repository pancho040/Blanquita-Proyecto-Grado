from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Cantidades import LONGITUD_MAXIMA_DESCRIPCION, LONGITUD_MINIMA_DESCRIPCION
from app.Constants.Estados import (
    ESTADO_MATERIA_PRIMA_ABIERTA,
    ESTADO_MATERIA_PRIMA_AGOTADO,
    ESTADO_MATERIA_PRIMA_EN_ALMACEN,
    ESTADO_MATERIA_PRIMA_EN_PRODUCCION,
    ESTADO_MATERIA_PRIMA_FUERA_INVENTARIO,
    ESTADO_PRODUCCION_CANCELADA,
    ESTADO_PRODUCCION_EN_PRODUCCION,
    ESTADO_PRODUCCION_FINALIZADO,
    ESTADO_PRODUCCION_PAUSA,
    MOVIMIENTO_MATERIA_PRIMA_INGRESO,
    MOVIMIENTO_MATERIA_PRIMA_PRODUCCION_TERMINADA,
    MOVIMIENTO_MATERIA_PRIMA_RETIRO_FALLA,
    MOVIMIENTO_MATERIA_PRIMA_TRASLADO,
)
from app.Models.BobinaServilleta.ProduccionBobinaServilleta import (
    AbrirBobinaServilletaRequest,
    AbrirBobinaServilletaResponse,
    SubBobinasMedidaResponse,
    CancelarProduccionServilletaRequest,
    CancelarProduccionServilletaResponse,
    FinalizarProduccionServilletaRequest,
    FinalizarProduccionServilletaResponse,
    IniciarProduccionServilletaRequest,
    IniciarProduccionServilletaResponse,
    PausaProduccionServilletaRequest,
    PausaProduccionServilletaResponse,
    ReanudarProduccionServilletaRequest,
    ReanudarProduccionServilletaResponse,
    VerPausasProduccionServilletaActivasResponse,
    VerProduccionServilletaActivasRequest,
    VerProduccionServilletaActivasResponse,
)
from app.Repository.BobinaServilleta.ProduccionBobinaServilleta import (
    ProduccionBobinaServilletaRepository,
)
from app.Schemas.BobinaServilleta import (
    MovimientoBobinaServilleta,
    MovimientoSubBobina,
    SubBobinaServilleta,
)
from app.Schemas.Produccion import (
    CancelacionProduccionServilleta,
    PausaProduccionServilleta,
    ProduccionServilleta,
)
from app.utils.validators import REGLA_CARACTERES_OBSERVACION, ValidarTexto

def _ahora() -> datetime:
    return datetime.now(timezone.utc)


class ProduccionBobinaServilletaService:
    def __init__(self, db: Session):
        self.repository = ProduccionBobinaServilletaRepository(db)

    def AbrirBobinaServilleta(
        self, data: AbrirBobinaServilletaRequest, id_usuario: int
    ) -> AbrirBobinaServilletaResponse:
        bobina = self.repository.ObtenerBobinaBloqueada(data.IdBobinaServilleta)
        if bobina is None:
            self._Revertir(
                status.HTTP_404_NOT_FOUND,
                f"No existe la bobina servilleta con id {data.IdBobinaServilleta}",
            )

        if bobina.IdEstadoMateriaPrima != ESTADO_MATERIA_PRIMA_EN_ALMACEN:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                f"La bobina servilleta {data.IdBobinaServilleta} no está En almacén, no puede abrirse",
            )

        composicion = self.repository.SubBobinasPorUnidad(bobina.IdBobinaServilleta)
        if not composicion:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "Los formatos de la bobina servilleta no tienen sub-bobinas configuradas",
            )

        sub_bobinas = [
            SubBobinaServilleta(
                IdUnidadBobinaServilleta=fila["IdUnidadBobinaServilleta"],
                IdTipoMedidaSubBobina=fila["IdTipoMedidaSubBobina"],
                IdEstadoMateriaPrima=ESTADO_MATERIA_PRIMA_EN_ALMACEN,
            )
            for fila in composicion
            for _ in range(fila["Cantidad"])
        ]

        self.repository.Agregar(*sub_bobinas)

        bobina.IdEstadoMateriaPrima = ESTADO_MATERIA_PRIMA_ABIERTA
        observacion_sub = (
            data.Observacion
            or f"Generada por apertura de BobinaServilleta #{bobina.IdBobinaServilleta}"
        )
        self.repository.Guardar(
            bobina,
            MovimientoBobinaServilleta(
                IdBobinaServilleta=bobina.IdBobinaServilleta,
                IdTipoMovimiento=MOVIMIENTO_MATERIA_PRIMA_TRASLADO,
                IdUsuario=id_usuario,
                Observacion=data.Observacion
                or f"Apertura de BobinaServilleta #{bobina.IdBobinaServilleta}",
            ),
            *[
                MovimientoSubBobina(
                    IdSubBobinaServilleta=sub.IdSubBobinaServilleta,
                    IdTipoMovimiento=MOVIMIENTO_MATERIA_PRIMA_INGRESO,
                    IdUsuario=id_usuario,
                    Observacion=observacion_sub,
                )
                for sub in sub_bobinas
            ],
            mensaje_error="No se pudo abrir la bobina servilleta",
        )

        por_medida: dict[int, dict] = {}
        for fila in composicion:
            medida = por_medida.setdefault(
                fila["IdTipoMedidaSubBobina"],
                {
                    "IdTipoMedidaSubBobina": fila["IdTipoMedidaSubBobina"],
                    "MedidaMm": fila["MedidaMm"],
                    "Cantidad": 0,
                },
            )
            medida["Cantidad"] += fila["Cantidad"]

        return AbrirBobinaServilletaResponse(
            IdBobinaServilleta=bobina.IdBobinaServilleta,
            IdEstadoMateriaPrima=ESTADO_MATERIA_PRIMA_ABIERTA,
            SubBobinas=[SubBobinasMedidaResponse(**medida) for medida in por_medida.values()],
            CantidadSubBobinasTotal=len(sub_bobinas),
        )

    def IniciarProduccionServilleta(
        self, data: IniciarProduccionServilletaRequest, id_usuario: int
    ) -> IniciarProduccionServilletaResponse:
        sub_bobina = self.repository.ObtenerSubBobinaBloqueada(data.IdSubBobina)
        if sub_bobina is None:
            self._Revertir(
                status.HTTP_404_NOT_FOUND,
                f"No existe la sub-bobina con id {data.IdSubBobina}",
            )

        if sub_bobina.IdEstadoMateriaPrima != ESTADO_MATERIA_PRIMA_EN_ALMACEN:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                f"La sub-bobina {data.IdSubBobina} no está En almacén, no puede ingresar a producción",
            )

        turno = self.repository.TurnoActual()
        if turno is None:
            self._Revertir(status.HTTP_409_CONFLICT, "No hay turnos configurados")

        produccion = ProduccionServilleta(
            IdEstadoProduccion=ESTADO_PRODUCCION_EN_PRODUCCION,
            IdUsuario=id_usuario,
            IdSubBobina=sub_bobina.IdSubBobinaServilleta,
            IdTurno=turno["IdTurno"],
            FechaInicioProduccion=_ahora(),
        )
        sub_bobina.IdEstadoMateriaPrima = ESTADO_MATERIA_PRIMA_EN_PRODUCCION
        self.repository.Guardar(
            produccion,
            sub_bobina,
            MovimientoSubBobina(
                IdSubBobinaServilleta=sub_bobina.IdSubBobinaServilleta,
                IdTipoMovimiento=MOVIMIENTO_MATERIA_PRIMA_TRASLADO,
                IdUsuario=id_usuario,
                Observacion="Traslado a producción - Producción Servilleta",
            ),
            mensaje_error="No se pudo iniciar la producción de servilleta",
        )

        return IniciarProduccionServilletaResponse(
            IdProduccionServilleta=produccion.IdProduccionServilleta,
            FechaInicioProduccion=produccion.FechaInicioProduccion,
            IdTurno=turno["IdTurno"],
            NombreTurno=turno["NombreTurno"],
        )

    def PausaProduccionServilleta(
        self, data: PausaProduccionServilletaRequest, id_usuario: int
    ) -> PausaProduccionServilletaResponse:
        motivo = self._ValidarTexto(data.MotivoPausaProduccion, "El motivo de la pausa es obligatorio")

        produccion = self._ObtenerProduccion(data.IdProduccionServilleta)
        if produccion.IdEstadoProduccion != ESTADO_PRODUCCION_EN_PRODUCCION:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "La producción indicada no se encuentra En Producción, no puede pausarse",
            )

        produccion.IdEstadoProduccion = ESTADO_PRODUCCION_PAUSA
        pausa = PausaProduccionServilleta(
            IdProduccionServilleta=produccion.IdProduccionServilleta,
            IdUsuario=id_usuario,
            FechaHoraPausa=_ahora(),
            MotivoPausaProduccion=motivo,
        )
        self.repository.Guardar(
            produccion,
            pausa,
            mensaje_error="No se pudo pausar la producción de servilleta",
        )

        return PausaProduccionServilletaResponse(
            IdPausaProduccionServilleta=pausa.IdPausaProduccionServilleta,
            IdProduccionServilleta=pausa.IdProduccionServilleta,
            FechaHoraPausa=pausa.FechaHoraPausa,
            MotivoPausaProduccion=pausa.MotivoPausaProduccion,
            FechaHoraReanudacion=None,
            IdEstadoProduccion=ESTADO_PRODUCCION_PAUSA,
        )

    def ReanudarProduccionServilleta(
        self, data: ReanudarProduccionServilletaRequest, id_usuario: int
    ) -> ReanudarProduccionServilletaResponse:
        produccion = self._ObtenerProduccion(data.IdProduccionServilleta)
        if produccion.IdEstadoProduccion != ESTADO_PRODUCCION_PAUSA:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "La producción indicada no se encuentra en Pausa, no puede reanudarse",
            )

        pausa = self.repository.ObtenerPausaActiva(produccion.IdProduccionServilleta)
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
            mensaje_error="No se pudo reanudar la producción de servilleta",
        )

        return ReanudarProduccionServilletaResponse(
            IdPausaProduccionServilleta=pausa.IdPausaProduccionServilleta,
            IdProduccionServilleta=pausa.IdProduccionServilleta,
            FechaHoraPausa=pausa.FechaHoraPausa,
            MotivoPausaProduccion=pausa.MotivoPausaProduccion,
            FechaHoraReanudacion=pausa.FechaHoraReanudacion,
            IdEstadoProduccion=ESTADO_PRODUCCION_EN_PRODUCCION,
        )

    def FinalizarProduccionServilleta(
        self, data: FinalizarProduccionServilletaRequest, id_usuario: int
    ) -> FinalizarProduccionServilletaResponse:
        produccion = self._ObtenerProduccion(data.IdProduccionServilleta)
        if produccion.IdEstadoProduccion != ESTADO_PRODUCCION_EN_PRODUCCION:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "La producción indicada no se encuentra En Producción, no puede finalizarse",
            )

        produccion.IdEstadoProduccion = ESTADO_PRODUCCION_FINALIZADO
        produccion.FechaFinProduccion = _ahora()
        movimiento = self._MoverSubBobina(
            produccion,
            ESTADO_MATERIA_PRIMA_AGOTADO,
            MOVIMIENTO_MATERIA_PRIMA_PRODUCCION_TERMINADA,
            id_usuario,
            f"Producción terminada - Producción Servilleta #{produccion.IdProduccionServilleta}",
        )
        self.repository.Guardar(
            produccion,
            *movimiento,
            mensaje_error="No se pudo finalizar la producción de servilleta",
        )

        return FinalizarProduccionServilletaResponse(
            IdProduccionServilleta=produccion.IdProduccionServilleta,
            FechaFinProduccion=produccion.FechaFinProduccion,
            IdEstadoProduccion=ESTADO_PRODUCCION_FINALIZADO,
            NombreEstadoProduccion=self.repository.NombreEstadoProduccion(
                ESTADO_PRODUCCION_FINALIZADO
            ),
        )

    def CancelarProduccionServilleta(
        self, data: CancelarProduccionServilletaRequest, id_usuario: int
    ) -> CancelarProduccionServilletaResponse:
        motivo = self._ValidarTexto(data.MotivoCancelacion, "El motivo de cancelación es obligatorio")

        produccion = self._ObtenerProduccion(data.IdProduccionServilleta)
        if produccion.IdEstadoProduccion != ESTADO_PRODUCCION_PAUSA:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "La producción indicada no está en Pausa, no se puede cancelar",
            )

        produccion.IdEstadoProduccion = ESTADO_PRODUCCION_CANCELADA
        produccion.FechaFinProduccion = _ahora()
        movimiento = self._MoverSubBobina(
            produccion,
            ESTADO_MATERIA_PRIMA_FUERA_INVENTARIO,
            MOVIMIENTO_MATERIA_PRIMA_RETIRO_FALLA,
            id_usuario,
            f"Retiro por cancelación de producción - Servilleta #{produccion.IdProduccionServilleta}",
        )
        cancelacion = CancelacionProduccionServilleta(
            IdProduccionServilleta=produccion.IdProduccionServilleta,
            IdUsuario=id_usuario,
            MotivoCancelacion=motivo,
        )
        self.repository.Guardar(
            produccion,
            cancelacion,
            *movimiento,
            mensaje_error="No se pudo cancelar la producción de servilleta",
        )

        return CancelarProduccionServilletaResponse(
            IdCancelacionProduccionServilleta=cancelacion.IdCancelacionProduccionServilleta,
            IdProduccionServilleta=produccion.IdProduccionServilleta,
            FechaHoraCancelacion=cancelacion.FechaHoraCancelacion,
            MotivoCancelacion=cancelacion.MotivoCancelacion,
            IdEstadoProduccion=ESTADO_PRODUCCION_CANCELADA,
        )

    def VerProduccionServilletaActivas(
        self, data: VerProduccionServilletaActivasRequest
    ) -> list[VerProduccionServilletaActivasResponse]:
        return [
            VerProduccionServilletaActivasResponse(**fila)
            for fila in self.repository.VerProduccionServilletaActivas(data.IdTipoMedidaSubBobina)
        ]

    def VerPausasProduccionServilletaActivas(
        self,
    ) -> list[VerPausasProduccionServilletaActivasResponse]:
        return [
            VerPausasProduccionServilletaActivasResponse(**fila)
            for fila in self.repository.VerPausasProduccionServilletaActivas()
        ]

    def _MoverSubBobina(
        self,
        produccion: ProduccionServilleta,
        id_estado: int,
        id_tipo_movimiento: int,
        id_usuario: int,
        observacion: str,
    ) -> list:
        sub_bobina = self.repository.ObtenerSubBobinaBloqueada(produccion.IdSubBobina)
        sub_bobina.IdEstadoMateriaPrima = id_estado
        return [
            sub_bobina,
            MovimientoSubBobina(
                IdSubBobinaServilleta=sub_bobina.IdSubBobinaServilleta,
                IdTipoMovimiento=id_tipo_movimiento,
                IdUsuario=id_usuario,
                Observacion=observacion,
            ),
        ]

    def _ObtenerProduccion(self, id_produccion: int) -> ProduccionServilleta:
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
                detail=(
                    f"{mensaje}, debe tener entre {LONGITUD_MINIMA_DESCRIPCION} y "
                    f"{LONGITUD_MAXIMA_DESCRIPCION} caracteres, {REGLA_CARACTERES_OBSERVACION}"
                ),
            )
        return texto

    def _Revertir(self, codigo: int, mensaje: str) -> None:
        self.repository.Revertir()
        raise HTTPException(status_code=codigo, detail=mensaje)
