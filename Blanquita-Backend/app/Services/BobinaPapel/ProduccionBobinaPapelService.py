from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException, status
from app.Repository.BobinaPapel.ProduccionBobinaPapel import (
    ProduccionBobinaPapelRepository,
)
from app.Models.BobinaPapel.ProduccionBobinaPapel import (
    IniciarProduccionBobinaTuboRequest,
    IniciarProduccionBobinaTuboResponse,
    CambiarLineaProduccionBobinaTuboRequest,
    CambiarLineaProduccionBobinaTuboResponse,
    FinalizarProduccionBobinaTuboRequest,
    FinalizarProduccionBobinaTuboResponse,
    PausarProduccionBobinaTuboRequest,
    PausarProduccionBobinaTuboResponse,
    ReanudarProduccionBobinaTuboRequest,
    ReanudarProduccionBobinaTuboResponse,
    CancelarProduccionBobinaTuboRequest,
    CancelarProduccionBobinaTuboResponse,
    InsertarMovimientoOperadorLogsRequest,
    InsertarMovimientoOperadorLogsResponse,
    VerProduccionBobinaTuboRequest,
    VerProduccionBobinaTuboResponse,
    VerPausasProduccionBobinaTuboActivasRequest,
    VerPausasProduccionBobinaTuboActivasResponse,
)
from app.utils.validators import EsCantidadValida,ValidarTexto, REGLA_CARACTERES_OBSERVACION
from app.Constants.Cantidades import (
    CANTIDAD_INGRESO_LOGS,
    LONGITUD_MAXIMA_DESCRIPCION,
    LONGITUD_MINIMA_DESCRIPCION,
    TIPO_BOBINA_HIGIENICO
)



class ProduccionBobinaPapelService:
    def __init__(self, db: Session):
        self.repository = ProduccionBobinaPapelRepository(db)

    def IniciarProduccionBobinaTubo(
        self, data: IniciarProduccionBobinaTuboRequest, id_usuario: int
    ) -> IniciarProduccionBobinaTuboResponse:
        params = {
            "p_IdBobina1": data.IdBobina1,
            "p_IdBobina2": data.IdBobina2,
            "p_IdUsuario": id_usuario,
            "p_IdProducto": data.IdProducto,
        }

        try:
            resultado = self.repository.IniciarProduccionBobinaTubo(params)
        except SQLAlchemyError as e:
            mensaje = str(e.orig) if hasattr(e, "orig") else str(e)
            if "no puede ser la misma bobina" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="IdBobina1 e IdBobina2 no pueden ser la misma bobina",
                )
            if "No existe la bobina" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Una de las bobinas indicadas no existe",
                )
            if "no está En almacén" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Una de las bobinas indicadas no está disponible en almacén",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo iniciar la producción de bobina tubo, verifica los datos ingresados",
            )

        if not resultado:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo iniciar la producción de bobina tubo",
            )

        return IniciarProduccionBobinaTuboResponse(**resultado)

    def FinalizarProduccion(
        self, data: FinalizarProduccionBobinaTuboRequest, id_usuario: int
    ) -> FinalizarProduccionBobinaTuboResponse:
        params = {
            "p_IdProduccionBobinaTubo": data.IdProduccionBobinaTubo,
            "p_IdUsuario": id_usuario,
        }

        try:
            resultado = self.repository.FinalizarProduccionBobinaTubo(params)
        except SQLAlchemyError as e:
            mensaje = str(e.orig) if hasattr(e, "orig") else str(e)
            if "No existe la producción" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No existe la producción con id {data.IdProduccionBobinaTubo}",
                )
            if "no se encuentra En Producción" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="La producción indicada no se encuentra En Producción, no puede finalizarse",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo finalizar la producción de bobina tubo, verifica los datos ingresados",
            )

        if not resultado:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo finalizar la producción de bobina tubo",
            )

        return FinalizarProduccionBobinaTuboResponse(**resultado)

    def CambiarLineaProduccion(
        self, data: CambiarLineaProduccionBobinaTuboRequest, id_usuario: int
    ) -> CambiarLineaProduccionBobinaTuboResponse:
        id_tipo_bobina = self.repository.ObtenerTipoBobinaProduccion(
            data.IdProduccionBobinaTubo
        )
        if id_tipo_bobina is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La producción de bobina tubo no existe",
            )
        if id_tipo_bobina != TIPO_BOBINA_HIGIENICO:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El cambio de línea solo está permitido en producciones de bobina Higiénico",
            )

        params = {
            "p_IdProduccionBobinaTubo": data.IdProduccionBobinaTubo,
            "p_IdProducto": data.IdProducto,
            "p_IdUsuario": id_usuario,
        }

        resultado = self.repository.CambiarLineaProduccionBobinaTubo(params)

        if not resultado:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo cambiar la línea de la producción de bobina tubo",
            )

        return CambiarLineaProduccionBobinaTuboResponse(**resultado)

    def PausarProduccion(
        self, data: PausarProduccionBobinaTuboRequest, id_usuario: int
    ) -> PausarProduccionBobinaTuboResponse:
        motivo = (data.MotivoPausaProduccion or "").strip()
        if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, motivo):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El motivo de la pausa es obligatorio, debe tener entre {LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, {REGLA_CARACTERES_OBSERVACION}",
            )

        params = {
            "p_IdProduccionBobinaTubo": data.IdProduccionBobinaTubo,
            "p_IdUsuario": id_usuario,
            "p_MotivoPausaProduccion": motivo,
        }

        try:
            resultado = self.repository.PausaProduccionBobinaTubo(params)
        except SQLAlchemyError as e:
            mensaje = str(e.orig) if hasattr(e, "orig") else str(e)
            if "No existe la producción" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No existe la producción con id {data.IdProduccionBobinaTubo}",
                )
            if "no se encuentra En Producción" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="La producción indicada no se encuentra En Producción, no puede pausarse",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo pausar la producción de bobina tubo, verifica los datos ingresados",
            )

        if not resultado:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo pausar la producción de bobina tubo",
            )

        return PausarProduccionBobinaTuboResponse(**resultado)

    def ReanudarProduccion(
        self, data: ReanudarProduccionBobinaTuboRequest, id_usuario: int
    ) -> ReanudarProduccionBobinaTuboResponse:
        params = {
            "p_IdProduccionBobinaTubo": data.IdProduccionBobinaTubo,
            "p_IdUsuario": id_usuario,
        }

        try:
            resultado = self.repository.ReanudarProduccionBobinaTubo(params)
        except SQLAlchemyError as e:
            mensaje = str(e.orig) if hasattr(e, "orig") else str(e)
            if "No existe la producción" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No existe la producción con id {data.IdProduccionBobinaTubo}",
                )
            if "No existe una pausa activa" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="No existe una pausa activa para la producción indicada",
                )
            if "no se encuentra en Pausa" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="La producción indicada no se encuentra en Pausa, no puede reanudarse",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo reanudar la producción de bobina tubo, verifica los datos ingresados",
            )

        if not resultado:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo reanudar la producción de bobina tubo",
            )

        return ReanudarProduccionBobinaTuboResponse(**resultado)

    def CancelarProduccion(
        self, data: CancelarProduccionBobinaTuboRequest, id_usuario: int
    ) -> CancelarProduccionBobinaTuboResponse:
        motivo = (data.MotivoCancelacion or "").strip()
        if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, motivo):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El motivo de cancelación es obligatorio, debe tener entre {LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, {REGLA_CARACTERES_OBSERVACION}",
            )
        params = {
            "p_id_produccion": data.IdProduccionBobinaTubo,
            "p_id_usuario": id_usuario,
            "p_motivo_cancelacion": motivo,
        }
        try:
            resultado = self.repository.CancelarProduccionBobinaTubo(params)
        except SQLAlchemyError as e:
            mensaje = str(e.orig) if hasattr(e, "orig") else str(e)
            if "No existe la producción" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No existe la producción con id {data.IdProduccionBobinaTubo}",
                )
            if "no está en Pausa" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="La producción indicada no está en Pausa, no se puede cancelar",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo cancelar la producción de bobina tubo, verifica los datos ingresados",
            )
        if not resultado:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo cancelar la producción de bobina tubo",
            )

        return CancelarProduccionBobinaTuboResponse(**resultado)

    def InsertarMovimientoOperadorLogs(
        self, data: InsertarMovimientoOperadorLogsRequest, id_usuario: int
    ) -> InsertarMovimientoOperadorLogsResponse:
        if not EsCantidadValida(data.CantidadLogs, CANTIDAD_INGRESO_LOGS):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La cantidad máxima de ingreso es de {CANTIDAD_INGRESO_LOGS}",
            )

        params = {
            "p_IdProduccionBobinaTubo": data.IdProduccionBobinaTubo,
            "p_IdTipoMovimientoOperadorLogs": data.IdTipoMovimientoOperadorLogs,
            "p_IdUsuario": id_usuario,
            "p_CantidadLogs": data.CantidadLogs,
            "p_Observacion": data.Observacion,
        }

        try:
            resultado = self.repository.InsertarMovimientoOperadorLogs(params)
        except SQLAlchemyError as e:
            mensaje = str(e.orig) if hasattr(e, "orig") else str(e)
            if "CantidadLogs debe ser un valor positivo" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="CantidadLogs debe ser un valor positivo",
                )
            if "máxima de ingreso" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"La cantidad máxima de ingreso es de {CANTIDAD_INGRESO_LOGS}",
                )
            if "No existe la producción" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No existe la producción con id {data.IdProduccionBobinaTubo}",
                )
            if "no se pueden registrar logs" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="La producción indicada no está En Producción ni en Pausa, no se pueden registrar logs",
                )
            if "No se puede descontar" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="La cantidad a descontar supera el total de logs registrados",
                )
            if "no es válido" in mensaje:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El tipo de movimiento {data.IdTipoMovimientoOperadorLogs} no es válido",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo registrar el movimiento de logs del operador, verifica los datos ingresados",
            )

        if not resultado:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el movimiento de logs del operador",
            )

        return InsertarMovimientoOperadorLogsResponse(**resultado)

    def VerProduccionBobinaTubo(
        self, data: VerProduccionBobinaTuboRequest
    ) -> list[VerProduccionBobinaTuboResponse]:
        params = {
            "p_IdTipoBobina": data.IdTipoBobina,
            "p_IdProducto": data.IdProducto,
        }

        resultados = self.repository.VerProduccionBobinaTubo(params)

        return [
            VerProduccionBobinaTuboResponse(**resultado) for resultado in resultados
        ]

    def VerPausasActivas(
        self, data: VerPausasProduccionBobinaTuboActivasRequest
    ) -> list[VerPausasProduccionBobinaTuboActivasResponse]:
        params = {
            "p_FiltroIdTipoBobina": data.FiltroIdTipoBobina,
            "p_FiltroIdProducto": data.FiltroIdProducto,
        }

        resultados = self.repository.VerPausasProduccionBobinaTuboActivas(params)

        return [
            VerPausasProduccionBobinaTuboActivasResponse(**resultado)
            for resultado in resultados
        ]