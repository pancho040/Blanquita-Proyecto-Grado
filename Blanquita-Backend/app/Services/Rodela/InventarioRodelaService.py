from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Cantidades import (
    MINUTOS_DESHACER_TRASLADO_RODELA,
    OBSERVACION_RODELA_MAX,
    OBSERVACION_RODELA_MIN,
)
from app.Constants.Estados import (
    ESTADO_MATERIA_PRIMA_ABIERTA,
    ESTADO_MATERIA_PRIMA_EN_ALMACEN,
    MOVIMIENTO_MATERIA_PRIMA_CORRECCION,
    MOVIMIENTO_MATERIA_PRIMA_DEVOLUCION,
    MOVIMIENTO_MATERIA_PRIMA_REINGRESO,
    MOVIMIENTO_MATERIA_PRIMA_TRASLADO,
)
from app.Models.Rodela.InventarioRodela import (
    CorregirTrasladoRodelaRequest,
    CorregirTrasladoRodelaResponse,
    DeshacerTrasladoRodelaRequest,
    DeshacerTrasladoRodelaResponse,
    DetalleInventarioRodelaRequest,
    DetalleInventarioRodelaResponse,
    EditarRodelaRequest,
    EditarRodelaResponse,
    ResumenInventarioRodelaResponse,
    RodelaEnAlmacenResponse,
    RodelaReingresableResponse,
    TrasladarRodelaRequest,
    TrasladarRodelaResponse,
)
from app.Repository.Rodela.InventarioRodela import InventarioRodelaRepository
from app.Schemas.Rodela import MovimientoRodela, Rodela
from app.utils.validators import CodigoMateriaPrima, REGLA_CARACTERES_OBSERVACION, ValidarTexto

OBSERVACION_TRASLADO_RODELA = "Traslado a producción - apertura de paquete de rodelas"
OBSERVACION_CORRECCION_TRASLADO_RODELA = "Corrección por error humano - reingreso a almacén"


class InventarioRodelaService:
    def __init__(self, db: Session):
        self.repository = InventarioRodelaRepository(db)

    def VerResumenInventarioRodela(self) -> list[ResumenInventarioRodelaResponse]:
        return [
            ResumenInventarioRodelaResponse(**fila)
            for fila in self.repository.VerResumenInventarioRodela()
        ]

    def VerDetalleInventarioRodela(
        self, data: DetalleInventarioRodelaRequest
    ) -> list[DetalleInventarioRodelaResponse]:
        return [
            DetalleInventarioRodelaResponse(**fila)
            for fila in self.repository.VerDetalleInventarioRodela(data.IdTipoRodela)
        ]

    def ListarRodelasEnAlmacen(self, id_tipo_rodela: int) -> list[RodelaEnAlmacenResponse]:
        return [
            RodelaEnAlmacenResponse(**fila)
            for fila in self.repository.ListarRodelasEnAlmacen(id_tipo_rodela)
        ]

    def ListarRodelasReingresables(self) -> list[RodelaReingresableResponse]:
        return [
            RodelaReingresableResponse(**fila)
            for fila in self.repository.ListarRodelasReingresables()
        ]

    def TrasladarRodelaAProduccion(
        self, data: TrasladarRodelaRequest, id_usuario: int
    ) -> TrasladarRodelaResponse:
        rodela = self._ObtenerRodela(data.IdRodela)

        if rodela.IdEstadoMateriaPrima != ESTADO_MATERIA_PRIMA_EN_ALMACEN:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La rodela indicada no está disponible en almacén",
            )

        movimiento = self.repository.RegistrarMovimiento(
            rodela,
            MovimientoRodela(
                IdRodela=rodela.IdRodela,
                IdTipoMovimiento=MOVIMIENTO_MATERIA_PRIMA_TRASLADO,
                IdUsuario=id_usuario,
                Observacion=data.Observacion or OBSERVACION_TRASLADO_RODELA,
            ),
            ESTADO_MATERIA_PRIMA_ABIERTA,
        )

        return TrasladarRodelaResponse(**self._Respuesta(rodela, movimiento))

    def CorregirTrasladoRodela(
        self, data: CorregirTrasladoRodelaRequest, id_usuario: int
    ) -> CorregirTrasladoRodelaResponse:
        rodela = self._ObtenerRodela(data.IdRodela)

        if rodela.IdEstadoMateriaPrima != ESTADO_MATERIA_PRIMA_ABIERTA:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La rodela indicada no está Abierta, no puede corregirse el traslado",
            )

        movimiento = self.repository.RegistrarMovimiento(
            rodela,
            MovimientoRodela(
                IdRodela=rodela.IdRodela,
                IdTipoMovimiento=MOVIMIENTO_MATERIA_PRIMA_REINGRESO,
                IdUsuario=id_usuario,
                Observacion=data.Observacion or OBSERVACION_CORRECCION_TRASLADO_RODELA,
            ),
            ESTADO_MATERIA_PRIMA_EN_ALMACEN,
        )

        return CorregirTrasladoRodelaResponse(**self._Respuesta(rodela, movimiento))

    def DeshacerTrasladoRodela(
        self, data: DeshacerTrasladoRodelaRequest, id_usuario: int
    ) -> DeshacerTrasladoRodelaResponse:
        observacion = self._ValidarObservacion(
            data.Observacion, "La observación es obligatoria"
        )

        rodela = self._ObtenerRodela(data.IdRodela)

        if rodela.IdEstadoMateriaPrima != ESTADO_MATERIA_PRIMA_ABIERTA:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La rodela indicada no está Abierta, no puede deshacerse el traslado",
            )

        fecha_traslado = self.repository.UltimoTraslado(rodela.IdRodela)
        if fecha_traslado is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La rodela indicada no tiene un traslado a producción registrado",
            )

        if datetime.now(timezone.utc) - fecha_traslado > timedelta(
            minutes=MINUTOS_DESHACER_TRASLADO_RODELA
        ):
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Pasaron más de {MINUTOS_DESHACER_TRASLADO_RODELA} minutos desde el traslado; la rodela ya no puede reingresarse al almacén",
            )

        movimiento = self.repository.RegistrarMovimiento(
            rodela,
            MovimientoRodela(
                IdRodela=rodela.IdRodela,
                IdTipoMovimiento=MOVIMIENTO_MATERIA_PRIMA_DEVOLUCION,
                IdUsuario=id_usuario,
                Observacion=observacion,
            ),
            ESTADO_MATERIA_PRIMA_EN_ALMACEN,
        )

        return DeshacerTrasladoRodelaResponse(**self._Respuesta(rodela, movimiento))

    def EditarRodela(self, data: EditarRodelaRequest, id_usuario: int) -> EditarRodelaResponse:
        codigo = CodigoMateriaPrima(data.CodigoRodela, "de la rodela")

        observacion = self._ValidarObservacion(
            data.Observacion, "El motivo de la corrección es obligatorio"
        )

        rodela = self._ObtenerRodela(data.IdRodela)
        codigo_anterior = rodela.CodigoRodela

        if codigo_anterior == codigo:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No hay cambios para guardar",
            )

        if self.repository.CodigoEnUso(codigo, rodela.IdRodela):
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una rodela registrada con el código {codigo}",
            )

        movimiento = self.repository.RegistrarMovimiento(
            rodela,
            MovimientoRodela(
                IdRodela=rodela.IdRodela,
                IdTipoMovimiento=MOVIMIENTO_MATERIA_PRIMA_CORRECCION,
                IdUsuario=id_usuario,
                Observacion=f"Código: {codigo_anterior} → {codigo} · Motivo: {observacion}",
            ),
            codigo=codigo,
        )

        return EditarRodelaResponse(
            CodigoAnterior=codigo_anterior,
            **self._Respuesta(rodela, movimiento),
        )

    def _ObtenerRodela(self, id_rodela: int) -> Rodela:
        rodela = self.repository.ObtenerRodelaBloqueada(id_rodela)
        if rodela is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No existe la rodela con id {id_rodela}",
            )
        return rodela

    def _ValidarObservacion(self, observacion: str | None, mensaje: str) -> str:
        observacion = (observacion or "").strip()
        if not ValidarTexto(OBSERVACION_RODELA_MIN, OBSERVACION_RODELA_MAX, observacion):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=(
                    f"{mensaje}, debe tener entre {OBSERVACION_RODELA_MIN} y "
                    f"{OBSERVACION_RODELA_MAX} caracteres, {REGLA_CARACTERES_OBSERVACION}"
                ),
            )
        return observacion

    def _Respuesta(self, rodela: Rodela, movimiento: MovimientoRodela) -> dict:
        return {
            "IdRodela": rodela.IdRodela,
            "CodigoRodela": rodela.CodigoRodela,
            "IdEstadoMateriaPrima": rodela.IdEstadoMateriaPrima,
            "FechaMovimiento": movimiento.FechaMovimiento,
        }
