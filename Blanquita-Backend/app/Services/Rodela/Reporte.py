from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException, status

from app.Models.Rodela.Reporte import (
    VerRodelasRequest,
    VerRodelasResponse,
    RodelaCatalogoResponse,
    ReporteInventarioRodelaRequest,
    ReporteInventarioRodelaResponse,
    ReporteInventarioResumenTipoRodelaResponse,
    ReporteInventarioRodelaDetalleResponse,
    ReporteHistorialMovimientosRodelaRequest,
    ReporteHistorialMovimientosRodelaResponse,
    MovimientoRodelaResponse,
    VerLotesRodelaRequest,
    VerLotesRodelaResponse,
    LoteRodelaCatalogoResponse,
    ReporteLoteRodelaDetalleRequest,
    ReporteLoteRodelaDetalleResponse,
    RodelaLoteDetalleResponse,
    ReporteLotesRodelaPorPeriodoRequest,
    ReporteLotesRodelaPorPeriodoResponse,
)
from app.Repository.Rodela.Reporte import ReporteRodelaRepository


class ReporteRodelaService:
    def __init__(self, db: Session):
        self.repository = ReporteRodelaRepository(db)

    def VerRodelas(self, data: VerRodelasRequest) -> VerRodelasResponse:
        params = {
            "p_CodigoRodela": data.CodigoRodela,
            "p_IdProveedor": data.IdProveedor,
            "p_IdsTipoRodela": data.IdsTipoRodela or None,
            "p_IdEstadoMateriaPrima": data.IdEstadoMateriaPrima,
            "p_IdRodela": data.IdRodela,
            "p_IdLoteRodela": data.IdLoteRodela,
        }

        try:
            filas = self.repository.VerRodelas(params)
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el catálogo de rodelas, verifica los datos ingresados",
            )

        total = len(filas)
        inicio = (data.Pagina - 1) * data.TamanoPagina
        fin = inicio + data.TamanoPagina
        filas_pagina = filas[inicio:fin]

        rodelas = [RodelaCatalogoResponse(**fila) for fila in filas_pagina]

        return VerRodelasResponse(
            Total=total,
            Pagina=data.Pagina,
            TamanoPagina=data.TamanoPagina,
            Rodelas=rodelas,
        )

    def ReporteInventario(
        self, data: ReporteInventarioRodelaRequest
    ) -> ReporteInventarioRodelaResponse:
        params = {
            "p_IdsTipoRodela": data.IdsTipoRodela or None,
        }

        try:
            filas = self.repository.ReporteInventario(params)
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo generar el informe de inventario de rodelas, verifica los datos ingresados",
            )

        if not filas:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No hay rodelas en almacén para el informe solicitado",
            )

        por_tipo: dict[int, list[dict]] = {}
        rodelas: list[ReporteInventarioRodelaDetalleResponse] = []

        for fila in filas:
            id_tipo = fila["IdTipoRodela"]
            por_tipo.setdefault(id_tipo, []).append(fila)

            rodelas.append(
                ReporteInventarioRodelaDetalleResponse(
                    IdTipoRodela=id_tipo,
                    NombreTipoRodela=fila["NombreTipoRodela"],
                    IdRodela=fila["IdRodela"],
                    CodigoRodela=fila["CodigoRodela"],
                    IdLoteRodela=fila["IdLoteRodela"],
                    FechaRecepcion=fila["FechaRecepcion"],
                    NombreProveedor=fila["NombreProveedor"],
                )
            )

        resumen = [
            ReporteInventarioResumenTipoRodelaResponse(
                IdTipoRodela=id_tipo,
                NombreTipoRodela=filas_tipo[0]["NombreTipoRodela"],
                CantidadRodelas=len(filas_tipo),
                RecepcionMasAntigua=min(fila["FechaRecepcion"] for fila in filas_tipo),
                RecepcionMasReciente=max(fila["FechaRecepcion"] for fila in filas_tipo),
            )
            for id_tipo, filas_tipo in por_tipo.items()
        ]

        return ReporteInventarioRodelaResponse(
            FechaGeneracion=datetime.now(timezone.utc),
            TotalRodelas=len(filas),
            Resumen=resumen,
            Rodelas=rodelas,
        )

    def ReporteHistorialMovimientosRodela(
        self, data: ReporteHistorialMovimientosRodelaRequest
    ) -> ReporteHistorialMovimientosRodelaResponse:
        try:
            filas_rodela = self.repository.VerRodelas(
                {
                    "p_CodigoRodela": None,
                    "p_IdProveedor": None,
                    "p_IdsTipoRodela": None,
                    "p_IdEstadoMateriaPrima": None,
                    "p_IdRodela": data.IdRodela,
                    "p_IdLoteRodela": None,
                }
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener la información de la rodela, verifica los datos ingresados",
            )

        if not filas_rodela:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró la rodela solicitada",
            )

        rodela = filas_rodela[0]

        try:
            filas = self.repository.ReporteHistorialMovimientosRodela(
                {"p_IdRodela": data.IdRodela}
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el historial de movimientos, verifica los datos ingresados",
            )

        if not filas:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró historial de movimientos para esta rodela",
            )

        movimientos = [MovimientoRodelaResponse(**fila) for fila in filas]

        return ReporteHistorialMovimientosRodelaResponse(
            IdRodela=data.IdRodela,
            CodigoRodela=rodela["CodigoRodela"],
            NombreTipoRodela=rodela["NombreTipoRodela"],
            TipoEstado=rodela["TipoEstado"],
            Movimientos=movimientos,
        )

    def VerLotesRodela(self, data: VerLotesRodelaRequest) -> VerLotesRodelaResponse:
        params = {
            "p_FechaInicio": data.FechaInicio,
            "p_FechaFin": data.FechaFin,
            "p_IdProveedor": data.IdProveedor,
            "p_IdsTipoRodela": data.IdsTipoRodela or None,
        }

        try:
            filas = self.repository.VerLotesRodela(params)
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el catálogo de lotes, verifica los datos ingresados",
            )

        total = len(filas)
        inicio = (data.Pagina - 1) * data.TamanoPagina
        fin = inicio + data.TamanoPagina
        filas_pagina = filas[inicio:fin]

        lotes = [LoteRodelaCatalogoResponse(**fila) for fila in filas_pagina]

        return VerLotesRodelaResponse(
            Total=total,
            Pagina=data.Pagina,
            TamanoPagina=data.TamanoPagina,
            Lotes=lotes,
        )

    def _ObtenerDetalleLote(
        self, id_lote_rodela: int
    ) -> ReporteLoteRodelaDetalleResponse | None:
        try:
            filas = self.repository.ReporteLoteRodelaDetalle(
                {"p_IdLoteRodela": id_lote_rodela}
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el detalle del lote, verifica los datos ingresados",
            )

        if not filas:
            return None

        primera = filas[0]
        rodelas = [RodelaLoteDetalleResponse(**fila) for fila in filas]

        return ReporteLoteRodelaDetalleResponse(
            IdLoteRodela=id_lote_rodela,
            FechaRecepcion=primera["FechaRecepcion"],
            NombreProveedor=primera["NombreProveedor"],
            CantidadRodelas=primera["CantidadRodelas"],
            Rodelas=rodelas,
        )

    def ReporteLoteRodelaDetalle(
        self, data: ReporteLoteRodelaDetalleRequest
    ) -> ReporteLoteRodelaDetalleResponse:
        detalle = self._ObtenerDetalleLote(data.IdLoteRodela)

        if detalle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró el lote solicitado",
            )

        return detalle

    def ReporteLotesPorPeriodo(
        self, data: ReporteLotesRodelaPorPeriodoRequest
    ) -> ReporteLotesRodelaPorPeriodoResponse:
        try:
            filas_lotes = self.repository.VerLotesRodela(
                {
                    "p_FechaInicio": data.FechaInicio,
                    "p_FechaFin": data.FechaFin,
                    "p_IdProveedor": None,
                    "p_IdsTipoRodela": None,
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
            if (detalle := self._ObtenerDetalleLote(fila["IdLoteRodela"])) is not None
        ]
        total_rodelas = sum(lote.CantidadRodelas for lote in lotes)

        return ReporteLotesRodelaPorPeriodoResponse(
            PeriodoInicio=data.FechaInicio,
            PeriodoFin=data.FechaFin,
            TotalLotes=len(lotes),
            TotalRodelas=total_rodelas,
            Lotes=lotes,
        )
