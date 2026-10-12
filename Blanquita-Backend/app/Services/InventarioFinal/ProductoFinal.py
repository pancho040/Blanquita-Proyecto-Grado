import json

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException, status
from app.Repository.InventarioFinal.ProductoFinal import ProductoFinalRepository
from app.Constants.Cantidades import (
    CANTIDAD_INGRESO_PRODUCTO_TERMINADO,
    CANTIDAD_CORRECCION_PRODUCTO_TERMINADO,
    CANTIDAD_AJUSTE_PRODUCTO_TERMINADO,
    CANTIDAD_SALIDA_PRODUCTO_TERMINADO,
    LONGITUD_MINIMA_DESCRIPCION,
    LONGITUD_MAXIMA_DESCRIPCION,
)
from app.utils.validators import EsCantidadValida, ValidarTexto, REGLA_CARACTERES_OBSERVACION
from app.Models.InventarioFinal.ProductoFinal import(
      IngresoProductoTerminadoRequest,
      IngresoProductoTerminadoResponse,
      SalidaProductoTerminadoRequest,
      SalidaProductoTerminadoResponse,
      SalidaProductoTerminadoItemResponse,
      CorreccionProductoTerminadoRequest,
      CorreccionProductoTerminadoResponse,
      VerInventarioProductoTerminadoRequest,
      VerInventarioProductoTerminadoResponse,
      ProductoResponse
)

from app.Schemas.Producto import MovimientoProductoTerminado

ID_TIPO_MOVIMIENTO_SALIDA = 2
ID_TIPO_MOVIMIENTO_DESCUENTO = 3
ID_TIPO_MOVIMIENTO_AUMENTO = 4
ID_TIPO_MOVIMIENTO_AJUSTE_POSITIVO = 5
ID_TIPO_MOVIMIENTO_AJUSTE_NEGATIVO = 6

class ProductoFinalService:
    def __init__(self, db: Session):
            self.repository = ProductoFinalRepository(db)

    def InsertarIngresoProductoTerminado(
        self, data: IngresoProductoTerminadoRequest, id_usuario: int
    ) -> list[IngresoProductoTerminadoResponse]:
        if not data.Presentaciones:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe incluir al menos una presentación."
            )

        for item in data.Presentaciones:
            if item.Cantidad <= 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="La cantidad de ingreso debe ser mayor a 0",
                )
            if not EsCantidadValida(item.Cantidad, CANTIDAD_INGRESO_PRODUCTO_TERMINADO):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"La cantidad máxima de ingreso por presentación es de {CANTIDAD_INGRESO_PRODUCTO_TERMINADO}",
                )

        params = {
            "p_IdUsuario": id_usuario,
            "p_Presentaciones": json.dumps(
                [e.model_dump() for e in data.Presentaciones]
            )
        }

        filas = self.repository.InsertarIngresoProductoTerminado(params)

        return [IngresoProductoTerminadoResponse(**fila) for fila in filas]

    def InsertarSalidaProductoTerminado(
        self, data: SalidaProductoTerminadoRequest, id_usuario: int
    ) -> SalidaProductoTerminadoResponse:
        observacion = (data.Observacion or "").strip()
        if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, observacion):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La observación es obligatoria, debe tener entre {LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, {REGLA_CARACTERES_OBSERVACION}",
            )

        if not data.Presentaciones:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Debe incluir al menos una presentación",
            )

        ids_vistos = set()
        for item in data.Presentaciones:
            if item.Cantidad <= 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="La cantidad de salida debe ser mayor a 0",
                )
            if not EsCantidadValida(item.Cantidad, CANTIDAD_SALIDA_PRODUCTO_TERMINADO):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"La cantidad máxima de salida por presentación es de {CANTIDAD_SALIDA_PRODUCTO_TERMINADO}",
                )
            if item.IdPresentacion in ids_vistos:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"La presentación {item.IdPresentacion} está repetida en la salida",
                )
            ids_vistos.add(item.IdPresentacion)

        inventarios = self.repository.ObtenerInventariosBloqueados(sorted(ids_vistos))

        faltantes = [str(i) for i in sorted(ids_vistos) if i not in inventarios]
        if faltantes:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Las presentaciones {', '.join(faltantes)} no existen o no tienen inventario",
            )

        insuficientes = []
        registros = []
        for item in data.Presentaciones:
            inventario, presentacion, _ = inventarios[item.IdPresentacion]
            disponible = int(inventario.CantidadActual)
            if item.Cantidad > disponible:
                insuficientes.append(
                    f"{presentacion.CodigoPresentacion} (disponible {disponible}, solicitado {item.Cantidad})"
                )
                continue
            registros.append(
                (
                    inventario,
                    MovimientoProductoTerminado(
                        IdTipoMovimientoInventario=ID_TIPO_MOVIMIENTO_SALIDA,
                        IdPresentacion=item.IdPresentacion,
                        IdUsuario=id_usuario,
                        CantidadIngresoInventario=item.Cantidad,
                        Observacion=observacion,
                    ),
                    disponible - item.Cantidad,
                )
            )

        if insuficientes:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Stock insuficiente: {'; '.join(insuficientes)}",
            )

        movimientos = self.repository.RegistrarSalida(registros)

        presentaciones = [
            SalidaProductoTerminadoItemResponse(
                IdMovimientoProductoTerminado=movimiento.IdMovimientoProductoTerminado,
                IdPresentacion=movimiento.IdPresentacion,
                CodigoPresentacion=inventarios[movimiento.IdPresentacion][1].CodigoPresentacion,
                NombreProducto=inventarios[movimiento.IdPresentacion][2].NombreProducto,
                CantidadSalida=int(movimiento.CantidadIngresoInventario),
                CantidadActual=cantidad_nueva,
            )
            for _, movimiento, cantidad_nueva in registros
        ]

        return SalidaProductoTerminadoResponse(
            FechaMovimiento=movimientos[0].FechaMovimiento,
            Observacion=observacion,
            CantidadTotal=sum(p.CantidadSalida for p in presentaciones),
            Presentaciones=presentaciones,
        )


    def AjustePositivoInventarioProductoTerminado(
        self, data: CorreccionProductoTerminadoRequest, id_usuario: int
    ) -> CorreccionProductoTerminadoResponse:
        return self._RegistrarCorreccion(
            data, id_usuario, ID_TIPO_MOVIMIENTO_AJUSTE_POSITIVO, CANTIDAD_AJUSTE_PRODUCTO_TERMINADO
        )

    def AjusteNegativoInventarioProductoTerminado(
        self, data: CorreccionProductoTerminadoRequest, id_usuario: int
    ) -> CorreccionProductoTerminadoResponse:
        return self._RegistrarCorreccion(
            data, id_usuario, ID_TIPO_MOVIMIENTO_AJUSTE_NEGATIVO, CANTIDAD_AJUSTE_PRODUCTO_TERMINADO
        )

    def CorregirInventarioProductoTerminado(
        self, data: CorreccionProductoTerminadoRequest, id_usuario: int
    ) -> CorreccionProductoTerminadoResponse:
        return self._RegistrarCorreccion(
            data, id_usuario, ID_TIPO_MOVIMIENTO_DESCUENTO, CANTIDAD_CORRECCION_PRODUCTO_TERMINADO
        )

    def AumentarInventarioProductoTerminado(
        self, data: CorreccionProductoTerminadoRequest, id_usuario: int
    ) -> CorreccionProductoTerminadoResponse:
        return self._RegistrarCorreccion(
            data, id_usuario, ID_TIPO_MOVIMIENTO_AUMENTO, CANTIDAD_CORRECCION_PRODUCTO_TERMINADO
        )

    def _RegistrarCorreccion(
        self,
        data: CorreccionProductoTerminadoRequest,
        id_usuario: int,
        id_tipo_movimiento: int,
        cantidad_maxima: int,
    ) -> CorreccionProductoTerminadoResponse:
        if data.Cantidad <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="La cantidad debe ser mayor a 0",
            )
        if not EsCantidadValida(data.Cantidad, cantidad_maxima):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La cantidad máxima por presentación es de {cantidad_maxima}",
            )

        observacion = (data.Observacion or "").strip()
        if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, observacion):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La observación es obligatoria, debe tener entre {LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, {REGLA_CARACTERES_OBSERVACION}",
            )

        params = {
            "p_IdTipoMovimientoInventario": id_tipo_movimiento,
            "p_IdPresentacion": data.IdPresentacion,
            "p_IdUsuario": id_usuario,
            "p_Cantidad": data.Cantidad,
            "p_Observacion": observacion,
        }

        fila = self.repository.CorregirInventarioProductoTerminado(params)

        if not fila:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar la corrección de producto terminado",
            )

        return CorreccionProductoTerminadoResponse(**fila)

    def VerInventarioProductoTerminado(
        self, id_producto: int | None
    ) -> list[VerInventarioProductoTerminadoResponse]:
        params = {"p_IdProducto": id_producto}

        filas = self.repository.VerInventarioProductoTerminado(params)

        return [VerInventarioProductoTerminadoResponse(**fila) for fila in filas]

    def ObtenerProductos(self) -> list[ProductoResponse]:
        filas = self.repository.ObtenerProductos()

        return [ProductoResponse(**fila) for fila in filas]