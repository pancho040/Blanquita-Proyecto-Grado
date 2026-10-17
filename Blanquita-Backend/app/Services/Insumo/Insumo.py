import re

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Cantidades import (
    CANTIDAD_MOVIMIENTO_INSUMO,
    LONGITUD_MAXIMA_DESCRIPCION,
    LONGITUD_MAXIMA_DESCRIPCION_INSUMO,
    LONGITUD_MINIMA_DESCRIPCION,
    LONGITUD_MINIMA_DESCRIPCION_INSUMO,
)
from app.Models.Insumo.Insumo import (
    CatalogoInsumoResponse,
    CrearInsumoRequest,
    EditarInsumoRequest,
    InsumoItem,
    InsumoResponse,
    ListarInsumosRequest,
    ListarInsumosResponse,
    MovimientoInsumoRequest,
    MovimientoInsumoResponse,
)
from app.Repository.Insumo.Insumo import InsumoRepository
from app.Schemas.Insumo import MovimientoInsumo, TipoInsumo
from app.utils.validators import EsCantidadValida, REGLA_CARACTERES_OBSERVACION, ValidarTexto

ID_TIPO_MOVIMIENTO_INGRESO = 1
ID_TIPO_MOVIMIENTO_SALIDA = 2

NOMBRE_MOVIMIENTO = {
    ID_TIPO_MOVIMIENTO_INGRESO: "Ingreso",
    ID_TIPO_MOVIMIENTO_SALIDA: "Salida",
}

PATRON_NOMBRE_INSUMO = r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,()/-]+$"


def _limpiar(texto: str) -> str:
    return " ".join(texto.split())


def _mostrar(valor: str | None) -> str:
    return valor if valor else "sin dato"


class InsumoService:
    def __init__(self, db: Session):
        self.repository = InsumoRepository(db)

    def VerCatalogoInsumo(self) -> list[CatalogoInsumoResponse]:
        return [CatalogoInsumoResponse(**fila) for fila in self.repository.VerCatalogoInsumo()]

    def IngresarInsumo(self, data: MovimientoInsumoRequest, id_usuario: int) -> MovimientoInsumoResponse:
        return self._RegistrarMovimiento(data, id_usuario, ID_TIPO_MOVIMIENTO_INGRESO)

    def SacarInsumo(self, data: MovimientoInsumoRequest, id_usuario: int) -> MovimientoInsumoResponse:
        return self._RegistrarMovimiento(data, id_usuario, ID_TIPO_MOVIMIENTO_SALIDA)

    def ListarInsumos(self, data: ListarInsumosRequest) -> ListarInsumosResponse:
        total, filas = self.repository.ListarInsumos(data.model_dump())

        return ListarInsumosResponse(
            Total=total,
            Pagina=data.Pagina,
            TamanoPagina=data.TamanoPagina,
            Insumos=[InsumoItem(**fila) for fila in filas],
        )

    def CrearInsumo(self, datos: CrearInsumoRequest, id_admin: int) -> InsumoResponse:
        nombre = self._ValidarNombre(datos.NombreInsumo)
        descripcion = self._ValidarDescripcion(datos.DescripcionInsumo)

        creado = self.repository.CrearInsumo(
            TipoInsumo(NombreInsumo=nombre, DescripcionInsumo=descripcion),
            lambda t: (
                f"Crear insumo · #{t.IdTipoInsumo} {t.NombreInsumo} "
                f"(descripción: {_mostrar(t.DescripcionInsumo)}), inventario inicial 0"
            ),
            id_admin,
        )

        return InsumoResponse(
            IdTipoInsumo=creado.IdTipoInsumo,
            NombreInsumo=creado.NombreInsumo,
            DescripcionInsumo=creado.DescripcionInsumo,
            CantidadActual=0,
        )

    def EditarInsumo(self, datos: EditarInsumoRequest, id_admin: int) -> InsumoResponse:
        descripcion = self._ValidarDescripcion(datos.DescripcionInsumo)

        tipo = self.repository.ObtenerTipoInsumoBloqueado(datos.IdTipoInsumo)
        if tipo is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El insumo no existe",
            )

        anterior = tipo.DescripcionInsumo
        if anterior == descripcion:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No hay cambios para guardar",
            )

        observacion = (
            f"Editar insumo · #{tipo.IdTipoInsumo} {tipo.NombreInsumo}: "
            f"descripción: {_mostrar(anterior)} → {descripcion}"
        )
        editado = self.repository.EditarDescripcion(tipo, descripcion, observacion, id_admin)

        return InsumoResponse(
            IdTipoInsumo=editado.IdTipoInsumo,
            NombreInsumo=editado.NombreInsumo,
            DescripcionInsumo=editado.DescripcionInsumo,
            CantidadActual=self.repository.CantidadActual(editado.IdTipoInsumo),
        )

    def _ValidarNombre(self, nombre: str) -> str:
        nombre = _limpiar(nombre)
        if not re.fullmatch(PATRON_NOMBRE_INSUMO, nombre):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="El nombre del insumo solo puede tener letras, números, espacios y . , ( ) / -",
            )

        if self.repository.NombreEnUso(nombre):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un insumo llamado {nombre}",
            )

        return nombre

    def _ValidarDescripcion(self, descripcion: str | None) -> str:
        descripcion = _limpiar(descripcion or "")
        if not ValidarTexto(
            LONGITUD_MINIMA_DESCRIPCION_INSUMO, LONGITUD_MAXIMA_DESCRIPCION_INSUMO, descripcion
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=(
                    "La descripción es obligatoria, debe tener entre "
                    f"{LONGITUD_MINIMA_DESCRIPCION_INSUMO} y {LONGITUD_MAXIMA_DESCRIPCION_INSUMO} caracteres, "
                    f"{REGLA_CARACTERES_OBSERVACION}"
                ),
            )
        return descripcion

    def _RegistrarMovimiento(
        self, data: MovimientoInsumoRequest, id_usuario: int, id_tipo_movimiento: int
    ) -> MovimientoInsumoResponse:
        if data.Cantidad <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="La cantidad debe ser mayor a 0",
            )

        if not EsCantidadValida(data.Cantidad, CANTIDAD_MOVIMIENTO_INSUMO):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La cantidad máxima por movimiento es de {CANTIDAD_MOVIMIENTO_INSUMO}",
            )

        observacion = (data.Observacion or "").strip()
        if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, observacion):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La observación es obligatoria, debe tener entre {LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, {REGLA_CARACTERES_OBSERVACION}",
            )

        encontrado = self.repository.ObtenerInventarioBloqueado(data.IdTipoInsumo)
        if encontrado is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El insumo con id {data.IdTipoInsumo} no existe o no tiene inventario",
            )

        inventario, tipo = encontrado
        cantidad_actual = int(inventario.CantidadActual)

        if id_tipo_movimiento == ID_TIPO_MOVIMIENTO_INGRESO and not tipo.Activo:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El insumo {tipo.NombreInsumo} está inactivo, no se puede registrar el ingreso",
            )

        if id_tipo_movimiento == ID_TIPO_MOVIMIENTO_SALIDA:
            if data.Cantidad > cantidad_actual:
                self.repository.Revertir()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"No hay suficiente {tipo.NombreInsumo} en almacén, disponible: {cantidad_actual}",
                )
            cantidad_nueva = cantidad_actual - data.Cantidad
        else:
            cantidad_nueva = cantidad_actual + data.Cantidad

        movimiento = self.repository.RegistrarMovimiento(
            inventario,
            MovimientoInsumo(
                IdTipoInsumo=data.IdTipoInsumo,
                IdTipoMovimiento=id_tipo_movimiento,
                IdUsuario=id_usuario,
                CantidadMovimiento=data.Cantidad,
                Observacion=observacion,
            ),
            cantidad_nueva,
        )

        return MovimientoInsumoResponse(
            IdMovimientoInsumo=movimiento.IdMovimientoInsumo,
            IdTipoInsumo=movimiento.IdTipoInsumo,
            NombreInsumo=tipo.NombreInsumo,
            NombreMovimiento=NOMBRE_MOVIMIENTO[id_tipo_movimiento],
            CantidadMovimiento=data.Cantidad,
            CantidadActual=cantidad_nueva,
            FechaMovimiento=movimiento.FechaMovimiento,
        )
