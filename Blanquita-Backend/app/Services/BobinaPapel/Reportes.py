from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException, status

from app.Models.BobinaPapel.Reportes import (
    ReporteInventarioBobinaPapelRequest,
    ReporteInventarioBobinaPapelResponse,
    ReporteInventarioResumenTipoResponse,
    ReporteInventarioBobinaResponse,
    VerProduccionesBobinaTuboRequest,
    VerProduccionesBobinaTuboResponse,
    ProduccionBobinaTuboCatalogoResponse,
    ReporteProduccionBobinaTuboDetalleRequest,
    ReporteProduccionBobinaTuboDetalleResponse,
    PausaProduccionBobinaTuboResponse,
    MovimientoOperadorLogsResponse,
    VerLotesBobinaPapelRequest,
    VerLotesBobinaPapelResponse,
    LoteBobinaPapelCatalogoResponse,
    ReporteLoteBobinaPapelDetalleRequest,
    ReporteLoteBobinaPapelDetalleResponse,
    BobinaLoteDetalleResponse,
    ReporteLotesPorPeriodoRequest,
    ReporteLotesPorPeriodoResponse,
    ReporteCancelacionProduccionBobinaTuboRequest,
    ReporteCancelacionProduccionBobinaTuboResponse,
    CancelacionProduccionBobinaTuboResponse,
    ReporteProduccionPorPeriodoRequest,
    ReporteProduccionPorPeriodoResponse,
    PausaPorMotivoResponse,
    CancelacionPeriodoResponse,
    VerBobinasPapelRequest,
    VerBobinasPapelResponse,
    BobinaPapelCatalogoResponse,
    ReporteHistorialMovimientosBobinaRequest,
    ReporteHistorialMovimientosBobinaResponse,
    MovimientoBobinaResponse,
    ProduccionCargadaResponse,
    ResumenProductoPeriodoResponse,
)
from app.Repository.BobinaPapel.Reportes import ReporteBobinaPapelRepository
from app.utils.validators import CodigoBusqueda

ESTADO_CANCELADA = "Cancelada"
ESTADOS_CERRADOS_RESUMEN = {"Finalizado", "Cambio de línea"}


class ReporteBobinaPapelService:
    def __init__(self, db: Session):
        self.repository = ReporteBobinaPapelRepository(db)

    def ReporteInventario(
        self, data: ReporteInventarioBobinaPapelRequest
    ) -> ReporteInventarioBobinaPapelResponse:
        params = {
            "p_IdsTipoBobina": data.IdsTipoBobina or None,
        }

        try:
            filas = self.repository.ReporteInventario(params)
        except SQLAlchemyError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo generar el informe de inventario de bobinas de papel, verifica los datos ingresados",
            )

        if not filas:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No hay bobinas en almacén para el informe solicitado",
            )

        primera = filas[0]

        resumen: dict[int, ReporteInventarioResumenTipoResponse] = {}
        bobinas: list[ReporteInventarioBobinaResponse] = []

        for fila in filas:
            id_tipo = fila["IdTipoBobina"]

            if id_tipo not in resumen:
                resumen[id_tipo] = ReporteInventarioResumenTipoResponse(
                    IdTipoBobina=id_tipo,
                    NombreTipoBobina=fila["NombreTipoBobina"],
                    CantidadBobinas=fila["CantidadBobinasTipo"],
                    PesoNetoTotalKg=fila["PesoNetoTotalTipoKg"],
                    GramajePromedio=fila["GramajePromedioTipo"],
                    RecepcionMasAntigua=fila["RecepcionMasAntiguaTipo"],
                    RecepcionMasReciente=fila["RecepcionMasRecienteTipo"],
                )

            bobinas.append(
                ReporteInventarioBobinaResponse(
                    IdTipoBobina=id_tipo,
                    NombreTipoBobina=fila["NombreTipoBobina"],
                    IdBobinaPapel=fila["IdBobinaPapel"],
                    CodigoBobina=fila["CodigoBobina"],
                    CodigoLote=fila["CodigoLote"],
                    FechaRecepcion=fila["FechaRecepcion"],
                    NombreProveedor=fila["NombreProveedor"],
                    PesoBrutoKg=fila["PesoBrutoKg"],
                    PesoNetoKg=fila["PesoNetoKg"],
                    Gramaje=fila["Gramaje"],
                )
            )

        return ReporteInventarioBobinaPapelResponse(
            FechaGeneracion=primera["FechaGeneracion"],
            TotalBobinas=primera["TotalBobinasInforme"],
            PesoNetoGeneralKg=primera["PesoNetoGeneralKg"],
            Resumen=list(resumen.values()),
            Bobinas=bobinas,
        )

    def VerProduccionesBobinaTubo(
        self, data: VerProduccionesBobinaTuboRequest
    ) -> VerProduccionesBobinaTuboResponse:
        params = {
            "p_FechaInicio": data.FechaInicio,
            "p_FechaFin": data.FechaFin,
            "p_IdTurno": data.IdTurno,
            "p_IdsProducto": data.IdsProducto or None,
            "p_CodigoBobina": CodigoBusqueda(data.CodigoBobina),
            "p_Operador": data.Operador,
            "p_IdEstadoProduccion": data.IdEstadoProduccion,
            "p_IdsEstadoProduccion": data.IdsEstadoProduccion or None,
        }

        try:
            filas = self.repository.VerProduccionesBobinaTubo(params)
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el catálogo de producciones, verifica los datos ingresados",
            )

        total = len(filas)
        inicio = (data.Pagina - 1) * data.TamanoPagina
        fin = inicio + data.TamanoPagina
        filas_pagina = filas[inicio:fin]

        producciones = [
            ProduccionBobinaTuboCatalogoResponse(**fila) for fila in filas_pagina
        ]

        return VerProduccionesBobinaTuboResponse(
            Total=total,
            Pagina=data.Pagina,
            TamanoPagina=data.TamanoPagina,
            Producciones=producciones,
        )

    def _ObtenerMovimientosLogs(
        self, id_produccion: int
    ) -> list[MovimientoOperadorLogsResponse]:
        try:
            filas_movimientos = self.repository.ReporteMovimientosOperadorLogs(
                {"p_IdProduccion": id_produccion}
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudieron obtener los movimientos de logs de la producción",
            )

        return [
            MovimientoOperadorLogsResponse(**fila_movimiento)
            for fila_movimiento in filas_movimientos
        ]

    def _ObtenerCargada(self, fila: dict) -> list[ProduccionCargadaResponse]:
        filas_cargada = self.repository.ProduccionesDeCargada(
            {"p_IdBobina1": fila["IdBobina1"], "p_IdBobina2": fila["IdBobina2"]}
        )
        return [ProduccionCargadaResponse(**f) for f in filas_cargada]

    def _ResumenPorProducto(
        self, producciones: list[ProduccionBobinaTuboCatalogoResponse]
    ) -> list[ResumenProductoPeriodoResponse]:
        resumen: dict[str, dict] = {}
        for p in producciones:
            datos = resumen.setdefault(
                p.NombreProducto,
                {"CantidadProducciones": 0, "TotalLogs": 0, "CantidadCanceladas": 0},
            )
            if p.NombreEstadoProduccion in ESTADOS_CERRADOS_RESUMEN:
                datos["CantidadProducciones"] += 1
                datos["TotalLogs"] += p.CantidadLogsActual
            elif p.NombreEstadoProduccion == ESTADO_CANCELADA:
                datos["CantidadCanceladas"] += 1

        return [
            ResumenProductoPeriodoResponse(
                NombreProducto=nombre,
                CantidadProducciones=datos["CantidadProducciones"],
                TotalLogs=datos["TotalLogs"],
                PromedioLogs=(
                    (Decimal(datos["TotalLogs"]) / datos["CantidadProducciones"]).quantize(
                        Decimal("0.01"), rounding=ROUND_HALF_UP
                    )
                    if datos["CantidadProducciones"]
                    else None
                ),
                CantidadCanceladas=datos["CantidadCanceladas"],
            )
            for nombre, datos in sorted(resumen.items())
        ]

    def ReporteDetalleProduccion(
        self, data: ReporteProduccionBobinaTuboDetalleRequest
    ) -> ReporteProduccionBobinaTuboDetalleResponse:
        try:
            fila = self.repository.ReporteProduccionBobinaTuboDetalle(
                {"p_IdProduccion": data.IdProduccion}
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el detalle de la producción, verifica los datos ingresados",
            )

        if not fila:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró la producción solicitada",
            )

        pausas = None
        total_tiempo_pausado = None

        if data.VerPausas:
            try:
                filas_pausas = self.repository.ReportePausasProduccionBobinaTubo(
                    {
                        "p_IdProduccion": data.IdProduccion,
                        "p_FechaInicio": None,
                        "p_FechaFin": None,
                        "p_IdTurno": None,
                        "p_SoloAbiertas": None,
                    }
                )
            except SQLAlchemyError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No se pudieron obtener las pausas de la producción",
                )

            pausas = [
                PausaProduccionBobinaTuboResponse(**fila_pausa)
                for fila_pausa in filas_pausas
            ]
            total_tiempo_pausado = sum(
                (p.DuracionPausa for p in pausas if p.DuracionPausa is not None),
                timedelta(),
            )

        movimientos = (
            self._ObtenerMovimientosLogs(data.IdProduccion)
            if data.VerMovimientos
            else None
        )

        return ReporteProduccionBobinaTuboDetalleResponse(
            **fila,
            Cargada=self._ObtenerCargada(fila),
            Pausas=pausas,
            TotalTiempoPausado=total_tiempo_pausado,
            Movimientos=movimientos,
        )

    def VerLotesBobinaPapel(
        self, data: VerLotesBobinaPapelRequest
    ) -> VerLotesBobinaPapelResponse:
        params = {
            "p_FechaInicio": data.FechaInicio,
            "p_FechaFin": data.FechaFin,
            "p_IdProveedor": data.IdProveedor,
            "p_IdsTipoBobina": data.IdsTipoBobina or None,
        }

        try:
            filas = self.repository.VerLotesBobinaPapel(params)
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el catálogo de lotes, verifica los datos ingresados",
            )

        total = len(filas)
        inicio = (data.Pagina - 1) * data.TamanoPagina
        fin = inicio + data.TamanoPagina
        filas_pagina = filas[inicio:fin]

        lotes = [LoteBobinaPapelCatalogoResponse(**fila) for fila in filas_pagina]

        return VerLotesBobinaPapelResponse(
            Total=total,
            Pagina=data.Pagina,
            TamanoPagina=data.TamanoPagina,
            Lotes=lotes,
        )

    def _ObtenerDetalleLote(
        self, id_lote_bobina: int
    ) -> ReporteLoteBobinaPapelDetalleResponse | None:
        try:
            filas = self.repository.ReporteLoteBobinaPapelDetalle(
                {"p_IdLoteBobina": id_lote_bobina}
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el detalle del lote, verifica los datos ingresados",
            )

        if not filas:
            return None

        primera = filas[0]
        bobinas = [BobinaLoteDetalleResponse(**fila) for fila in filas]

        return ReporteLoteBobinaPapelDetalleResponse(
            IdLoteBobina=id_lote_bobina,
            FechaRecepcion=primera["FechaRecepcion"],
            NombreProveedor=primera["NombreProveedor"],
            CantidadBobinas=primera["CantidadBobinas"],
            Ci=primera["Ci"],
            PrimerNombre=primera["PrimerNombre"],
            ApellidoPaterno=primera["ApellidoPaterno"],
            NombreRol=primera["NombreRol"],
            Bobinas=bobinas,
        )

    def ReporteLoteBobinaPapelDetalle(
        self, data: ReporteLoteBobinaPapelDetalleRequest
    ) -> ReporteLoteBobinaPapelDetalleResponse:
        detalle = self._ObtenerDetalleLote(data.IdLoteBobina)

        if detalle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró el lote solicitado",
            )

        return detalle

    def ReporteLotesPorPeriodo(
        self, data: ReporteLotesPorPeriodoRequest
    ) -> ReporteLotesPorPeriodoResponse:
        try:
            filas_lotes = self.repository.VerLotesBobinaPapel(
                {
                    "p_FechaInicio": data.FechaInicio,
                    "p_FechaFin": data.FechaFin,
                    "p_IdProveedor": None,
                    "p_IdsTipoBobina": None,
                }
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudieron obtener los lotes del período, verifica los datos ingresados",
            )

        lotes = [
            detalle
            for fila in filas_lotes
            if (detalle := self._ObtenerDetalleLote(fila["IdLoteBobina"])) is not None
        ]
        total_bobinas = sum(lote.CantidadBobinas for lote in lotes)

        return ReporteLotesPorPeriodoResponse(
            PeriodoInicio=data.FechaInicio,
            PeriodoFin=data.FechaFin,
            TotalLotes=len(lotes),
            TotalBobinas=total_bobinas,
            Lotes=lotes,
        )

    def ReporteCancelacionProduccion(
        self, data: ReporteCancelacionProduccionBobinaTuboRequest
    ) -> ReporteCancelacionProduccionBobinaTuboResponse:
        try:
            fila = self.repository.ReporteProduccionBobinaTuboDetalle(
                {"p_IdProduccion": data.IdProduccion}
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el detalle de la producción, verifica los datos ingresados",
            )

        if not fila:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró la producción solicitada",
            )

        if fila["NombreEstadoProduccion"] != "Cancelada":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La producción solicitada no está cancelada",
            )

        try:
            filas_pausas = self.repository.ReportePausasProduccionBobinaTubo(
                {
                    "p_IdProduccion": data.IdProduccion,
                    "p_FechaInicio": None,
                    "p_FechaFin": None,
                    "p_IdTurno": None,
                    "p_SoloAbiertas": None,
                }
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudieron obtener las pausas de la producción",
            )

        pausas = [
            PausaProduccionBobinaTuboResponse(**fila_pausa)
            for fila_pausa in filas_pausas
        ]
        total_tiempo_pausado = sum(
            (p.DuracionPausa for p in pausas if p.DuracionPausa is not None),
            timedelta(),
        )

        try:
            fila_cancelacion = self.repository.ReporteCancelacionProduccionBobinaTubo(
                {"p_IdProduccion": data.IdProduccion}
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener la información de cancelación de la producción",
            )

        if not fila_cancelacion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró el registro de cancelación de la producción",
            )

        cancelacion = CancelacionProduccionBobinaTuboResponse(**fila_cancelacion)
        movimientos = self._ObtenerMovimientosLogs(data.IdProduccion)

        return ReporteCancelacionProduccionBobinaTuboResponse(
            **fila,
            Cargada=self._ObtenerCargada(fila),
            Pausas=pausas,
            TotalTiempoPausado=total_tiempo_pausado,
            Movimientos=movimientos,
            Cancelacion=cancelacion,
        )

    def ReporteProduccionPorPeriodo(
        self, data: ReporteProduccionPorPeriodoRequest
    ) -> ReporteProduccionPorPeriodoResponse:
        try:
            filas_producciones = self.repository.VerProduccionesBobinaTubo(
                {
                    "p_FechaInicio": data.FechaInicio,
                    "p_FechaFin": data.FechaFin,
                    "p_IdTurno": None,
                    "p_IdsProducto": None,
                    "p_CodigoBobina": None,
                    "p_Operador": None,
                    "p_IdEstadoProduccion": None,
                }
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudieron obtener las producciones del período, verifica los datos ingresados",
            )

        producciones = [
            ProduccionBobinaTuboCatalogoResponse(**fila) for fila in filas_producciones
        ]
        total_logs = sum(p.CantidadLogsActual for p in producciones)

        try:
            filas_pausas = self.repository.ReportePausasProduccionBobinaTubo(
                {
                    "p_IdProduccion": None,
                    "p_FechaInicio": data.FechaInicio,
                    "p_FechaFin": data.FechaFin,
                    "p_IdTurno": None,
                    "p_SoloAbiertas": None,
                }
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudieron obtener las pausas del período",
            )

        pausas_por_motivo: dict[tuple[str, str], dict] = {}
        for fila_pausa in filas_pausas:
            clave = (
                fila_pausa["NombreProducto"],
                fila_pausa["MotivoPausaProduccion"] or "Sin motivo especificado",
            )
            duracion = fila_pausa["DuracionPausa"] or timedelta()

            datos = pausas_por_motivo.setdefault(
                clave, {"CantidadPausas": 0, "TiempoTotal": timedelta()}
            )
            datos["CantidadPausas"] += 1
            datos["TiempoTotal"] += duracion

        pausas_agrupadas = [
            PausaPorMotivoResponse(
                NombreProducto=producto,
                Motivo=motivo,
                CantidadPausas=datos["CantidadPausas"],
                TiempoTotal=datos["TiempoTotal"],
            )
            for (producto, motivo), datos in sorted(pausas_por_motivo.items())
        ]
        total_tiempo_pausado = sum(
            (p.TiempoTotal for p in pausas_agrupadas), timedelta()
        )

        cancelaciones = None

        if data.VerCancelaciones:
            try:
                filas_cancelaciones = (
                    self.repository.VerCancelacionesProduccionBobinaTubo(
                        {
                            "p_FechaInicio": data.FechaInicio,
                            "p_FechaFin": data.FechaFin,
                        }
                    )
                )
            except SQLAlchemyError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No se pudieron obtener las cancelaciones del período",
                )

            cancelaciones = [
                CancelacionPeriodoResponse(**fila) for fila in filas_cancelaciones
            ]

        return ReporteProduccionPorPeriodoResponse(
            PeriodoInicio=data.FechaInicio,
            PeriodoFin=data.FechaFin,
            TotalProducciones=len(producciones),
            TotalLogs=total_logs,
            ResumenPorProducto=self._ResumenPorProducto(producciones),
            Producciones=producciones,
            PausasPorMotivo=pausas_agrupadas,
            TotalPausas=len(filas_pausas),
            TotalTiempoPausado=total_tiempo_pausado,
            Cancelaciones=cancelaciones,
        )

    def VerBobinasPapel(
        self, data: VerBobinasPapelRequest
    ) -> VerBobinasPapelResponse:
        params = {
            "p_CodigoBobina": CodigoBusqueda(data.CodigoBobina),
            "p_IdProveedor": data.IdProveedor,
            "p_IdsTipoBobina": data.IdsTipoBobina or None,
            "p_IdEstadoMateriaPrima": data.IdEstadoMateriaPrima,
            "p_IdBobinaPapel": data.IdBobinaPapel,
        }

        try:
            filas = self.repository.VerBobinasPapel(params)
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el catálogo de bobinas, verifica los datos ingresados",
            )

        total = len(filas)
        inicio = (data.Pagina - 1) * data.TamanoPagina
        fin = inicio + data.TamanoPagina
        filas_pagina = filas[inicio:fin]

        bobinas = [BobinaPapelCatalogoResponse(**fila) for fila in filas_pagina]

        return VerBobinasPapelResponse(
            Total=total,
            Pagina=data.Pagina,
            TamanoPagina=data.TamanoPagina,
            Bobinas=bobinas,
        )

    def ReporteHistorialMovimientosBobina(
        self, data: ReporteHistorialMovimientosBobinaRequest
    ) -> ReporteHistorialMovimientosBobinaResponse:
        try:
            filas_bobina = self.repository.VerBobinasPapel(
                {
                    "p_CodigoBobina": None,
                    "p_IdProveedor": None,
                    "p_IdsTipoBobina": None,
                    "p_IdEstadoMateriaPrima": None,
                    "p_IdBobinaPapel": data.IdBobinaPapel,
                }
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener la información de la bobina, verifica los datos ingresados",
            )

        if not filas_bobina:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró la bobina solicitada",
            )

        bobina = filas_bobina[0]

        try:
            filas = self.repository.ReporteHistorialMovimientosBobina(
                {"p_IdBobinaPapel": data.IdBobinaPapel}
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el historial de movimientos, verifica los datos ingresados",
            )

        if not filas:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró historial de movimientos para esta bobina",
            )

        movimientos = [MovimientoBobinaResponse(**fila) for fila in filas]

        return ReporteHistorialMovimientosBobinaResponse(
            IdBobinaPapel=data.IdBobinaPapel,
            CodigoBobina=bobina["CodigoBobina"],
            NombreTipoBobina=bobina["NombreTipoBobina"],
            TipoEstado=bobina["TipoEstado"],
            Movimientos=movimientos,
        )
