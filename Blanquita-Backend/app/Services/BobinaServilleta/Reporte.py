from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException, status

from app.Models.BobinaServilleta.Reporte import (
    ReporteInventarioBobinaServilletaRequest,
    ReporteInventarioBobinaServilletaResponse,
    ReporteInventarioResumenTipoServilletaResponse,
    ReporteInventarioBobinaServilletaDetalleResponse,
    VerBobinasServilletaRequest,
    VerBobinasServilletaResponse,
    BobinaServilletaCatalogoResponse,
    VerSubBobinasServilletaRequest,
    VerSubBobinasServilletaResponse,
    SubBobinaServilletaCatalogoResponse,
    ReporteInventarioResumenMedidaResponse,
    ReporteInventarioSubBobinaServilletaResponse,
    ReporteInventarioCompletoServilletaResponse,
    ReporteHistorialMovimientosUnidadServilletaRequest,
    ReporteHistorialMovimientosUnidadServilletaResponse,
    MovimientoSubBobinaHistorialResponse,
    ReporteDetalleBobinaServilletaRequest,
    ReporteDetalleBobinaServilletaResponse,
    UnidadDetalleBobinaServilletaResponse,
    MovimientoBobinaServilletaResponse,
    VerLotesBobinaServilletaRequest,
    VerLotesBobinaServilletaResponse,
    LoteBobinaServilletaCatalogoResponse,
    ReporteLoteBobinaServilletaDetalleRequest,
    ReporteLoteBobinaServilletaDetalleResponse,
    BobinaLoteServilletaDetalleResponse,
    ReporteLotesServilletaPorPeriodoRequest,
    ReporteLotesServilletaPorPeriodoResponse,
    VerProduccionesServilletaRequest,
    VerProduccionesServilletaResponse,
    ProduccionServilletaCatalogoResponse,
    ReporteProduccionServilletaDetalleRequest,
    ReporteProduccionServilletaDetalleResponse,
    PausaProduccionServilletaResponse,
    ReporteCancelacionProduccionServilletaRequest,
    ReporteCancelacionProduccionServilletaResponse,
    CancelacionProduccionServilletaResponse,
    ReporteProduccionServilletaPorPeriodoRequest,
    ReporteProduccionServilletaPorPeriodoResponse,
    PausaServilletaPorMotivoResponse,
    CancelacionServilletaPeriodoResponse,
)
from app.Repository.BobinaServilleta.Reporte import ReporteBobinaServilletaRepository
from app.utils.dates import ZONA_BOLIVIA


def _peso_bobina(bobina) -> Decimal:
    return sum((u.PesoBrutoKg or Decimal(0)) for u in bobina.Unidades)


def _gramaje_bobina(bobina) -> Decimal | None:
    return _promedio([u.GramajeGr for u in bobina.Unidades if u.GramajeGr is not None], None)


def _promedio(valores: list[Decimal], vacio=Decimal(0)) -> Decimal | None:
    if not valores:
        return vacio
    return (sum(valores) / len(valores)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class ReporteBobinaServilletaService:
    def __init__(self, db: Session):
        self.repository = ReporteBobinaServilletaRepository(db)

    def _ObtenerInventarioBobinas(
        self, ids_tipo: list[int] | None
    ) -> ReporteInventarioBobinaServilletaResponse | None:
        try:
            filas = self.repository.ReporteInventario(
                {"p_IdsTipoBobinaServilleta": ids_tipo}
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo generar el informe de inventario de bobinas de servilleta, verifica los datos ingresados",
            )

        if not filas:
            return None

        bobinas = [ReporteInventarioBobinaServilletaDetalleResponse(**fila) for fila in filas]

        por_tipo: dict[int, list[ReporteInventarioBobinaServilletaDetalleResponse]] = {}
        for bobina in bobinas:
            por_tipo.setdefault(bobina.IdTipoBobinaServilleta, []).append(bobina)

        resumen = [
            ReporteInventarioResumenTipoServilletaResponse(
                IdTipoBobinaServilleta=id_tipo,
                NombreTipoBobinaServilleta=bobinas_tipo[0].NombreTipoBobinaServilleta,
                CantidadBobinas=len(bobinas_tipo),
                PesoBrutoTotalKg=sum(_peso_bobina(b) for b in bobinas_tipo),
                GramajePromedio=_promedio(
                    [g for b in bobinas_tipo if (g := _gramaje_bobina(b)) is not None]
                ),
                RecepcionMasAntigua=min(b.FechaRecepcion for b in bobinas_tipo),
                RecepcionMasReciente=max(b.FechaRecepcion for b in bobinas_tipo),
            )
            for id_tipo, bobinas_tipo in por_tipo.items()
        ]

        return ReporteInventarioBobinaServilletaResponse(
            FechaGeneracion=datetime.now(timezone.utc),
            TotalBobinas=len(bobinas),
            PesoBrutoGeneralKg=sum(_peso_bobina(b) for b in bobinas),
            Resumen=resumen,
            Bobinas=bobinas,
        )

    def ReporteInventario(
        self, data: ReporteInventarioBobinaServilletaRequest
    ) -> ReporteInventarioBobinaServilletaResponse:
        resultado = self._ObtenerInventarioBobinas(data.IdsTipoBobinaServilleta or None)

        if resultado is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No hay bobinas de servilleta en almacén para el informe solicitado",
            )

        return resultado

    def VerBobinasServilleta(
        self, data: VerBobinasServilletaRequest
    ) -> VerBobinasServilletaResponse:
        params = {
            "p_CodigoBobina": data.CodigoBobina,
            "p_IdProveedor": data.IdProveedor,
            "p_IdTipoBobinaServilleta": data.IdTipoBobinaServilleta,
            "p_IdEstadoMateriaPrima": data.IdEstadoMateriaPrima,
            "p_IdBobinaServilleta": data.IdBobinaServilleta,
        }

        try:
            filas = self.repository.VerBobinasServilleta(params)
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el catálogo de bobinas de servilleta, verifica los datos ingresados",
            )

        total = len(filas)
        inicio = (data.Pagina - 1) * data.TamanoPagina
        fin = inicio + data.TamanoPagina
        filas_pagina = filas[inicio:fin]

        bobinas = [BobinaServilletaCatalogoResponse(**fila) for fila in filas_pagina]

        return VerBobinasServilletaResponse(
            Total=total,
            Pagina=data.Pagina,
            TamanoPagina=data.TamanoPagina,
            Bobinas=bobinas,
        )

    def VerSubBobinasServilleta(
        self, data: VerSubBobinasServilletaRequest
    ) -> VerSubBobinasServilletaResponse:
        params = {
            "p_CodigoBobina": data.CodigoBobina,
            "p_IdProveedor": data.IdProveedor,
            "p_IdTipoBobinaServilleta": data.IdTipoBobinaServilleta,
            "p_IdsTipoMedidaSubBobina": data.IdsTipoMedidaSubBobina or None,
            "p_IdEstadoMateriaPrima": data.IdEstadoMateriaPrima,
            "p_IdBobinaServilleta": data.IdBobinaServilleta,
            "p_IdSubBobinaServilleta": data.IdSubBobinaServilleta,
        }

        try:
            filas = self.repository.VerSubBobinasServilleta(params)
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el catálogo de sub-bobinas de servilleta, verifica los datos ingresados",
            )

        total = len(filas)
        inicio = (data.Pagina - 1) * data.TamanoPagina
        fin = inicio + data.TamanoPagina
        filas_pagina = filas[inicio:fin]

        sub_bobinas = [
            SubBobinaServilletaCatalogoResponse(**fila) for fila in filas_pagina
        ]

        return VerSubBobinasServilletaResponse(
            Total=total,
            Pagina=data.Pagina,
            TamanoPagina=data.TamanoPagina,
            SubBobinas=sub_bobinas,
        )

    def _ObtenerInventarioSubBobinas(
        self,
    ) -> ReporteInventarioSubBobinaServilletaResponse | None:
        try:
            filas_resumen = self.repository.VerResumenSubBobinas()
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo generar el resumen de sub-bobinas de servilleta",
            )

        resumen = [
            ReporteInventarioResumenMedidaResponse(**fila) for fila in filas_resumen
        ]
        total = sum(r.CantidadSubBobinas for r in resumen)

        if total == 0:
            return None

        try:
            filas_detalle = self.repository.VerSubBobinasServilleta(
                {
                    "p_CodigoBobina": None,
                    "p_IdProveedor": None,
                    "p_IdTipoBobinaServilleta": None,
                    "p_IdsTipoMedidaSubBobina": None,
                    "p_IdEstadoMateriaPrima": 1,
                    "p_IdBobinaServilleta": None,
                    "p_IdSubBobinaServilleta": None,
                }
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el detalle de sub-bobinas de servilleta",
            )

        sub_bobinas = [
            SubBobinaServilletaCatalogoResponse(**fila) for fila in filas_detalle
        ]

        return ReporteInventarioSubBobinaServilletaResponse(
            FechaGeneracion=datetime.now(ZONA_BOLIVIA),
            TotalSubBobinas=total,
            Resumen=resumen,
            SubBobinas=sub_bobinas,
        )

    def ReporteInventarioSubBobina(self) -> ReporteInventarioSubBobinaServilletaResponse:
        resultado = self._ObtenerInventarioSubBobinas()

        if resultado is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No hay sub-bobinas de servilleta en almacén para el informe solicitado",
            )

        return resultado

    def ReporteInventarioCompleto(self) -> ReporteInventarioCompletoServilletaResponse:
        bobinas = self._ObtenerInventarioBobinas(None)
        sub_bobinas = self._ObtenerInventarioSubBobinas()

        if bobinas is None and sub_bobinas is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No hay bobinas ni sub-bobinas de servilleta en almacén para el informe solicitado",
            )

        return ReporteInventarioCompletoServilletaResponse(
            Bobinas=bobinas,
            SubBobinas=sub_bobinas,
        )

    def ReporteHistorialMovimientosUnidad(
        self, data: ReporteHistorialMovimientosUnidadServilletaRequest
    ) -> ReporteHistorialMovimientosUnidadServilletaResponse:
        try:
            filas = self.repository.ReporteHistorialMovimientosUnidadServilleta(
                {"p_IdUnidadBobinaServilleta": data.IdUnidadBobinaServilleta}
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el historial de movimientos de la unidad, verifica los datos ingresados",
            )

        if not filas:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró la unidad de bobina de servilleta solicitada",
            )

        primera = filas[0]

        movimientos = [
            MovimientoSubBobinaHistorialResponse(**fila)
            for fila in filas
            if fila["IdMovimientoSubBobina"] is not None
        ]

        return ReporteHistorialMovimientosUnidadServilletaResponse(
            IdUnidadBobinaServilleta=primera["IdUnidadBobinaServilleta"],
            CodigoBobina=primera["CodigoBobina"],
            DescripcionFormato=primera["DescripcionFormato"],
            PesoBrutoKg=primera["PesoBrutoKg"],
            GramajeGr=primera["GramajeGr"],
            IdBobinaServilleta=primera["IdBobinaServilleta"],
            NombreTipoBobinaServilleta=primera["NombreTipoBobinaServilleta"],
            TipoEstado=primera["TipoEstado"],
            Movimientos=movimientos,
        )

    def ReporteDetalleBobinaServilleta(
        self, data: ReporteDetalleBobinaServilletaRequest
    ) -> ReporteDetalleBobinaServilletaResponse:
        try:
            filas = self.repository.ReporteDetalleBobinaServilleta(
                {"p_IdBobinaServilleta": data.IdBobinaServilleta}
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el detalle de la bobina de servilleta, verifica los datos ingresados",
            )

        if not filas:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró la bobina de servilleta solicitada",
            )

        primera = filas[0]

        unidades: dict[int, UnidadDetalleBobinaServilletaResponse] = {}

        for fila in filas:
            id_unidad = fila["IdUnidadBobinaServilleta"]

            if id_unidad not in unidades:
                unidades[id_unidad] = UnidadDetalleBobinaServilletaResponse(
                    IdUnidadBobinaServilleta=id_unidad,
                    CodigoUnidad=fila["CodigoUnidad"],
                    DescripcionFormato=fila["DescripcionFormato"],
                    PesoBrutoKg=fila["PesoBrutoKg"],
                    GramajeGr=fila["GramajeGr"],
                    Movimientos=[],
                )

            if fila["IdMovimientoSubBobina"] is not None:
                unidades[id_unidad].Movimientos.append(
                    MovimientoSubBobinaHistorialResponse(**fila)
                )

        try:
            filas_movimientos_bobina = (
                self.repository.ReporteHistorialMovimientosBobinaServilleta(
                    {"p_IdBobinaServilleta": data.IdBobinaServilleta}
                )
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el historial de movimientos de la bobina, verifica los datos ingresados",
            )

        movimientos_bobina = [
            MovimientoBobinaServilletaResponse(**fila_movimiento)
            for fila_movimiento in filas_movimientos_bobina
        ]

        return ReporteDetalleBobinaServilletaResponse(
            IdBobinaServilleta=primera["IdBobinaServilleta"],
            NombreTipoBobinaServilleta=primera["NombreTipoBobinaServilleta"],
            TipoEstado=primera["TipoEstado"],
            CodigoLote=primera["CodigoLote"],
            FechaRecepcion=primera["FechaRecepcion"],
            NombreProveedor=primera["NombreProveedor"],
            MovimientosBobina=movimientos_bobina,
            Unidades=list(unidades.values()),
        )

    def VerLotesBobinaServilleta(
        self, data: VerLotesBobinaServilletaRequest
    ) -> VerLotesBobinaServilletaResponse:
        params = {
            "p_FechaInicio": data.FechaInicio,
            "p_FechaFin": data.FechaFin,
            "p_IdProveedor": data.IdProveedor,
            "p_IdsTipoBobinaServilleta": data.IdsTipoBobinaServilleta or None,
        }

        try:
            filas = self.repository.VerLotesBobinaServilleta(params)
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el catálogo de lotes, verifica los datos ingresados",
            )

        total = len(filas)
        inicio = (data.Pagina - 1) * data.TamanoPagina
        fin = inicio + data.TamanoPagina
        filas_pagina = filas[inicio:fin]

        lotes = [
            LoteBobinaServilletaCatalogoResponse(**fila) for fila in filas_pagina
        ]

        return VerLotesBobinaServilletaResponse(
            Total=total,
            Pagina=data.Pagina,
            TamanoPagina=data.TamanoPagina,
            Lotes=lotes,
        )

    def _ObtenerDetalleLoteServilleta(
        self, id_lote_bobina_servilleta: int
    ) -> ReporteLoteBobinaServilletaDetalleResponse | None:
        try:
            filas = self.repository.ReporteLoteBobinaServilletaDetalle(
                {"p_IdLoteBobinaServilleta": id_lote_bobina_servilleta}
            )
        except SQLAlchemyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener el detalle del lote, verifica los datos ingresados",
            )

        if not filas:
            return None

        primera = filas[0]
        bobinas = [BobinaLoteServilletaDetalleResponse(**fila) for fila in filas]

        return ReporteLoteBobinaServilletaDetalleResponse(
            IdLoteBobinaServilleta=id_lote_bobina_servilleta,
            FechaRecepcion=primera["FechaRecepcion"],
            NombreProveedor=primera["NombreProveedor"],
            CantidadBobinas=len(bobinas),
            Bobinas=bobinas,
        )

    def ReporteLoteBobinaServilletaDetalle(
        self, data: ReporteLoteBobinaServilletaDetalleRequest
    ) -> ReporteLoteBobinaServilletaDetalleResponse:
        detalle = self._ObtenerDetalleLoteServilleta(data.IdLoteBobinaServilleta)

        if detalle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró el lote solicitado",
            )

        return detalle

    def ReporteLotesServilletaPorPeriodo(
        self, data: ReporteLotesServilletaPorPeriodoRequest
    ) -> ReporteLotesServilletaPorPeriodoResponse:
        try:
            filas_lotes = self.repository.VerLotesBobinaServilleta(
                {
                    "p_FechaInicio": data.FechaInicio,
                    "p_FechaFin": data.FechaFin,
                    "p_IdProveedor": None,
                    "p_IdsTipoBobinaServilleta": None,
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
            if (
                detalle := self._ObtenerDetalleLoteServilleta(
                    fila["IdLoteBobinaServilleta"]
                )
            )
            is not None
        ]
        total_bobinas = sum(lote.CantidadBobinas for lote in lotes)

        return ReporteLotesServilletaPorPeriodoResponse(
            PeriodoInicio=data.FechaInicio,
            PeriodoFin=data.FechaFin,
            TotalLotes=len(lotes),
            TotalBobinas=total_bobinas,
            Lotes=lotes,
        )

    def VerProduccionesServilleta(
        self, data: VerProduccionesServilletaRequest
    ) -> VerProduccionesServilletaResponse:
        params = {
            "p_FechaInicio": data.FechaInicio,
            "p_FechaFin": data.FechaFin,
            "p_IdTurno": data.IdTurno,
            "p_IdsTipoBobinaServilleta": data.IdsTipoBobinaServilleta or None,
            "p_CodigoBobina": data.CodigoBobina,
            "p_Operador": data.Operador,
            "p_IdEstadoProduccion": data.IdEstadoProduccion,
            "p_IdsEstadoProduccion": data.IdsEstadoProduccion or None,
        }

        try:
            filas = self.repository.VerProduccionesServilleta(params)
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
            ProduccionServilletaCatalogoResponse(**fila) for fila in filas_pagina
        ]

        return VerProduccionesServilletaResponse(
            Total=total,
            Pagina=data.Pagina,
            TamanoPagina=data.TamanoPagina,
            Producciones=producciones,
        )

    def ReporteDetalleProduccion(
        self, data: ReporteProduccionServilletaDetalleRequest
    ) -> ReporteProduccionServilletaDetalleResponse:
        try:
            fila = self.repository.ReporteProduccionServilletaDetalle(
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
                filas_pausas = self.repository.ReportePausasProduccionServilleta(
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
                PausaProduccionServilletaResponse(**fila_pausa)
                for fila_pausa in filas_pausas
            ]
            total_tiempo_pausado = sum(
                (p.DuracionPausa for p in pausas if p.DuracionPausa is not None),
                timedelta(),
            )

        return ReporteProduccionServilletaDetalleResponse(
            **fila,
            Pausas=pausas,
            TotalTiempoPausado=total_tiempo_pausado,
        )

    def ReporteCancelacionProduccion(
        self, data: ReporteCancelacionProduccionServilletaRequest
    ) -> ReporteCancelacionProduccionServilletaResponse:
        try:
            fila = self.repository.ReporteProduccionServilletaDetalle(
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
            filas_pausas = self.repository.ReportePausasProduccionServilleta(
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
            PausaProduccionServilletaResponse(**fila_pausa)
            for fila_pausa in filas_pausas
        ]
        total_tiempo_pausado = sum(
            (p.DuracionPausa for p in pausas if p.DuracionPausa is not None),
            timedelta(),
        )

        try:
            fila_cancelacion = self.repository.ReporteCancelacionProduccionServilleta(
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

        cancelacion = CancelacionProduccionServilletaResponse(**fila_cancelacion)

        return ReporteCancelacionProduccionServilletaResponse(
            **fila,
            Pausas=pausas,
            TotalTiempoPausado=total_tiempo_pausado,
            Cancelacion=cancelacion,
        )

    def ReporteProduccionPorPeriodo(
        self, data: ReporteProduccionServilletaPorPeriodoRequest
    ) -> ReporteProduccionServilletaPorPeriodoResponse:
        try:
            filas_producciones = self.repository.VerProduccionesServilleta(
                {
                    "p_FechaInicio": data.FechaInicio,
                    "p_FechaFin": data.FechaFin,
                    "p_IdTurno": None,
                    "p_IdsTipoBobinaServilleta": None,
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
            ProduccionServilletaCatalogoResponse(**fila) for fila in filas_producciones
        ]

        try:
            filas_pausas = self.repository.ReportePausasProduccionServilleta(
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

        pausas_por_motivo: dict[str, dict] = {}
        for fila_pausa in filas_pausas:
            motivo = fila_pausa["MotivoPausaProduccion"] or "Sin motivo especificado"
            duracion = fila_pausa["DuracionPausa"] or timedelta()

            if motivo not in pausas_por_motivo:
                pausas_por_motivo[motivo] = {
                    "CantidadPausas": 0,
                    "TiempoTotal": timedelta(),
                }

            pausas_por_motivo[motivo]["CantidadPausas"] += 1
            pausas_por_motivo[motivo]["TiempoTotal"] += duracion

        pausas_agrupadas = [
            PausaServilletaPorMotivoResponse(
                Motivo=motivo,
                CantidadPausas=datos["CantidadPausas"],
                TiempoTotal=datos["TiempoTotal"],
            )
            for motivo, datos in pausas_por_motivo.items()
        ]
        total_tiempo_pausado = sum(
            (p.TiempoTotal for p in pausas_agrupadas), timedelta()
        )

        cancelaciones = None

        if data.VerCancelaciones:
            try:
                filas_cancelaciones = (
                    self.repository.VerCancelacionesProduccionServilleta(
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
                CancelacionServilletaPeriodoResponse(**fila)
                for fila in filas_cancelaciones
            ]

        return ReporteProduccionServilletaPorPeriodoResponse(
            PeriodoInicio=data.FechaInicio,
            PeriodoFin=data.FechaFin,
            TotalProducciones=len(producciones),
            Producciones=producciones,
            PausasPorMotivo=pausas_agrupadas,
            TotalPausas=len(filas_pausas),
            TotalTiempoPausado=total_tiempo_pausado,
            Cancelaciones=cancelaciones,
        )
