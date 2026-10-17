from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Cantidades import LONGITUD_MAXIMA_DESCRIPCION, LONGITUD_MINIMA_DESCRIPCION
from app.Constants.Estados import (
    ESTADO_MATERIA_PRIMA_EN_ALMACEN,
    ESTADO_MATERIA_PRIMA_FUERA_INVENTARIO,
    MOVIMIENTO_MATERIA_PRIMA_REINGRESO,
)
from app.Models.BobinaPapel.InventarioBobinaPapel import (
    ReingresarBobinaAInventarioRequest,
    ReingresarBobinaAInventarioResponse,
    VerBobinasPapelFueraInventarioResponse,
    VerDetalleInventarioBobinaPapelRequest,
    VerDetalleInventarioBobinaPapelResponse,
    VerResumenInventarioBobinaPapelResponse,
)
from app.Repository.BobinaPapel.InventarioBobinaPapel import InventarioBobinaPapelRepository
from app.Schemas.BobinaPapel import MovimientoBobina
from app.utils.validators import REGLA_CARACTERES_OBSERVACION, ValidarTexto


class InventarioBobinaPapelService:
    def __init__(self, db: Session):
        self.repository = InventarioBobinaPapelRepository(db)

    def VerResumen(self) -> list[VerResumenInventarioBobinaPapelResponse]:
        resultado = self.repository.VerResumen()

        if not resultado:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo obtener el resumen del inventario de bobinas de papel",
            )

        return [VerResumenInventarioBobinaPapelResponse(**fila) for fila in resultado]

    def VerDetalle(
        self, data: VerDetalleInventarioBobinaPapelRequest
    ) -> list[VerDetalleInventarioBobinaPapelResponse]:
        resultado = self.repository.VerDetalle(data.IdTipoBobina)

        if not resultado:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No hay bobinas en almacén.",
            )

        return [VerDetalleInventarioBobinaPapelResponse(**fila) for fila in resultado]

    def ReingresarBobinaInventario(
        self, data: ReingresarBobinaAInventarioRequest, id_usuario: int
    ) -> ReingresarBobinaAInventarioResponse:
        observacion = (data.Observacion or "").strip()
        if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, observacion):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La observación es obligatoria, debe tener entre {LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, {REGLA_CARACTERES_OBSERVACION}",
            )

        bobina = self.repository.ObtenerBobinaBloqueada(data.IdBobinaPapel)
        if bobina is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"La bobina de papel con id {data.IdBobinaPapel} no existe",
            )

        if bobina.IdEstadoMateriaPrima != ESTADO_MATERIA_PRIMA_FUERA_INVENTARIO:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"La bobina {bobina.CodigoBobina} no está Fuera de Inventario, no puede reingresarse",
            )

        movimiento = self.repository.RegistrarMovimiento(
            bobina,
            MovimientoBobina(
                IdBobinaPapel=bobina.IdBobinaPapel,
                IdTipoMovimiento=MOVIMIENTO_MATERIA_PRIMA_REINGRESO,
                IdUsuario=id_usuario,
                Observacion=observacion,
            ),
            ESTADO_MATERIA_PRIMA_EN_ALMACEN,
        )

        return ReingresarBobinaAInventarioResponse(
            IdBobinaPapel=data.IdBobinaPapel,
            IdEstadoMateriaPrima=ESTADO_MATERIA_PRIMA_EN_ALMACEN,
            FechaMovimiento=movimiento.FechaMovimiento,
        )

    def VerBobinasFueraInventario(self) -> list[VerBobinasPapelFueraInventarioResponse]:
        resultado = self.repository.VerBobinasFueraInventario()

        if not resultado:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No hay bobinas fuera de inventario",
            )

        return [VerBobinasPapelFueraInventarioResponse(**fila) for fila in resultado]
