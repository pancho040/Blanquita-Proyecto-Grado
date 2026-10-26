from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.Repository.InventarioFinal.Conteo import ConteoProductoTerminadoRepository
from app.Repository.InventarioFinal.ProductoFinal import ProductoFinalRepository
from app.Constants.Cantidades import (
    CANTIDAD_INGRESO_PRODUCTO_TERMINADO,
    CANTIDAD_CORRECCION_PRODUCTO_TERMINADO,
    CANTIDAD_AJUSTE_PRODUCTO_TERMINADO,
    CANTIDAD_SALIDA_PRODUCTO_TERMINADO,
    LONGITUD_MINIMA_DESCRIPCION,
    LONGITUD_MAXIMA_DESCRIPCION,
)
from app.utils.dates import ZONA_BOLIVIA
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
      ProductoResponse,
      BloqueoProductoTerminadoRequest,
      EstadoBloqueoProductoTerminadoResponse
)

from app.Schemas.Producto import InventarioProductoTerminado, MovimientoProductoTerminado

ID_TIPO_MOVIMIENTO_ENTRADA = 1
ID_TIPO_MOVIMIENTO_SALIDA = 2
ID_TIPO_MOVIMIENTO_DESCUENTO = 3
ID_TIPO_MOVIMIENTO_AUMENTO = 4
ID_TIPO_MOVIMIENTO_AJUSTE_POSITIVO = 5
ID_TIPO_MOVIMIENTO_AJUSTE_NEGATIVO = 6

MOVIMIENTOS_QUE_RESTAN = {ID_TIPO_MOVIMIENTO_DESCUENTO, ID_TIPO_MOVIMIENTO_AJUSTE_NEGATIVO}

OBSERVACION_INGRESO_PRODUCTO = "Ingreso al inventario de producto terminado"

BLOQUEO_INGRESO = ("BloqueaIngreso", "Los ingresos de producto terminado están bloqueados")
BLOQUEO_CORRECCION = ("BloqueaCorreccion", "Las correcciones de producto terminado están bloqueadas")
BLOQUEO_SALIDA = ("BloqueaSalida", "Las salidas de producto terminado están bloqueadas")
BLOQUEO_AJUSTE = "Los ajustes de producto terminado están bloqueados"


def estado_bloqueo(fila: dict | None) -> EstadoBloqueoProductoTerminadoResponse:
    if fila is None:
        return EstadoBloqueoProductoTerminadoResponse(Bloqueado=False)
    return EstadoBloqueoProductoTerminadoResponse(Bloqueado=True, **fila)


class ProductoFinalService:
    def __init__(self, db: Session):
            self.repository = ProductoFinalRepository(db)
            self.conteo_repository = ConteoProductoTerminadoRepository(db)

    def _ValidarSinConteo(self, mensaje: str) -> None:
        conteo = self.conteo_repository.ObtenerConteoAbierto()
        if conteo is not None:
            inicio = conteo["FechaHoraInicio"].astimezone(ZONA_BOLIVIA)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{mensaje}: hay un conteo físico en curso, iniciado por {conteo['UsuarioInicio']} a las {inicio:%H:%M}",
            )

    def _ValidarSinBloqueo(self, movimiento: tuple[str, str]) -> None:
        campo, mensaje = movimiento
        self._ValidarSinConteo(mensaje)
        bloqueo = self.repository.ObtenerBloqueoActivo()
        if bloqueo is not None and bloqueo[campo]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{mensaje} por {bloqueo['UsuarioBloqueo']}. Motivo: {bloqueo['MotivoBloqueo']}",
            )

    def VerBloqueo(self) -> EstadoBloqueoProductoTerminadoResponse:
        conteo = self.conteo_repository.ObtenerConteoAbierto()
        if conteo is not None:
            return EstadoBloqueoProductoTerminadoResponse(
                Bloqueado=True,
                IdConteoProductoTerminado=conteo["IdConteoProductoTerminado"],
                UsuarioBloqueo=conteo["UsuarioInicio"],
                FechaHoraBloqueo=conteo["FechaHoraInicio"],
                MotivoBloqueo=f"Conteo físico N° {conteo['IdConteoProductoTerminado']}: {conteo['MotivoInicio']}",
                BloqueaIngreso=True,
                BloqueaCorreccion=True,
                BloqueaSalida=True,
            )
        return estado_bloqueo(self.repository.ObtenerBloqueoActivo())

    def BloquearMovimientos(
        self, data: BloqueoProductoTerminadoRequest, id_usuario: int
    ) -> EstadoBloqueoProductoTerminadoResponse:
        motivo = (data.Motivo or "").strip()
        if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, motivo):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El motivo es obligatorio, debe tener entre {LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, {REGLA_CARACTERES_OBSERVACION}",
            )
        self._ValidarSinConteo("No se puede bloquear los movimientos de producto terminado")
        if not (data.BloqueaIngreso or data.BloqueaCorreccion or data.BloqueaSalida):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Debe seleccionar al menos un movimiento para bloquear",
            )

        self.repository.RegistrarBloqueo(
            id_usuario, motivo, data.BloqueaIngreso, data.BloqueaCorreccion, data.BloqueaSalida
        )
        return self.VerBloqueo()

    def DesbloquearMovimientos(self, id_usuario: int) -> EstadoBloqueoProductoTerminadoResponse:
        if not self.repository.CerrarBloqueoActivo(id_usuario):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No hay un bloqueo activo de movimientos de producto terminado",
            )
        return self.VerBloqueo()

    def InsertarIngresoProductoTerminado(
        self, data: IngresoProductoTerminadoRequest, id_usuario: int
    ) -> list[IngresoProductoTerminadoResponse]:
        self._ValidarSinBloqueo(BLOQUEO_INGRESO)

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

        ids_presentacion = [item.IdPresentacion for item in data.Presentaciones]
        if len(set(ids_presentacion)) != len(ids_presentacion):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Hay presentaciones repetidas en el ingreso",
            )

        presentaciones = self.repository.ObtenerPresentaciones(ids_presentacion)
        faltantes = [str(i) for i in ids_presentacion if i not in presentaciones]
        if faltantes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Las presentaciones {', '.join(faltantes)} no existen",
            )

        inactivas = [
            presentacion.CodigoPresentacion
            for presentacion, producto in presentaciones.values()
            if not (presentacion.Activo and producto.Activo)
        ]
        if inactivas:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Las presentaciones {', '.join(inactivas)} están inactivas, no se puede registrar el ingreso",
            )

        inventarios = self.repository.ObtenerInventariosBloqueados(sorted(ids_presentacion))

        id_turno = self.repository.IdTurnoActual()
        registros = []
        for item in data.Presentaciones:
            inventario = (
                inventarios[item.IdPresentacion][0]
                if item.IdPresentacion in inventarios
                else InventarioProductoTerminado(IdPresentacion=item.IdPresentacion, CantidadActual=0)
            )
            registros.append(
                (
                    inventario,
                    MovimientoProductoTerminado(
                        IdTipoMovimientoInventario=ID_TIPO_MOVIMIENTO_ENTRADA,
                        IdPresentacion=item.IdPresentacion,
                        IdUsuario=id_usuario,
                        IdTurno=id_turno,
                        CantidadIngresoInventario=item.Cantidad,
                        Observacion=(item.Observacion or "").strip() or OBSERVACION_INGRESO_PRODUCTO,
                    ),
                    int(inventario.CantidadActual) + item.Cantidad,
                )
            )

        self.repository.RegistrarMovimientos(
            registros, "No se pudo registrar el ingreso de producto terminado"
        )

        return [
            IngresoProductoTerminadoResponse(
                IdPresentacion=movimiento.IdPresentacion,
                CodigoPresentacion=presentaciones[movimiento.IdPresentacion][0].CodigoPresentacion,
                NombreProducto=presentaciones[movimiento.IdPresentacion][1].NombreProducto,
                CantidadIngresada=int(movimiento.CantidadIngresoInventario),
                CantidadActual=cantidad_nueva,
            )
            for _, movimiento, cantidad_nueva in registros
        ]

    def InsertarSalidaProductoTerminado(
        self, data: SalidaProductoTerminadoRequest, id_usuario: int
    ) -> SalidaProductoTerminadoResponse:
        self._ValidarSinBloqueo(BLOQUEO_SALIDA)

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

        id_turno = self.repository.IdTurnoActual()
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
                        IdTurno=id_turno,
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

        movimientos = self.repository.RegistrarMovimientos(
            registros, "No se pudo registrar la salida de producto terminado"
        )

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
        self._ValidarSinConteo(BLOQUEO_AJUSTE)
        return self._RegistrarCorreccion(
            data, id_usuario, ID_TIPO_MOVIMIENTO_AJUSTE_POSITIVO, CANTIDAD_AJUSTE_PRODUCTO_TERMINADO
        )

    def AjusteNegativoInventarioProductoTerminado(
        self, data: CorreccionProductoTerminadoRequest, id_usuario: int
    ) -> CorreccionProductoTerminadoResponse:
        self._ValidarSinConteo(BLOQUEO_AJUSTE)
        return self._RegistrarCorreccion(
            data, id_usuario, ID_TIPO_MOVIMIENTO_AJUSTE_NEGATIVO, CANTIDAD_AJUSTE_PRODUCTO_TERMINADO
        )

    def CorregirInventarioProductoTerminado(
        self, data: CorreccionProductoTerminadoRequest, id_usuario: int
    ) -> CorreccionProductoTerminadoResponse:
        self._ValidarSinBloqueo(BLOQUEO_CORRECCION)
        return self._RegistrarCorreccion(
            data, id_usuario, ID_TIPO_MOVIMIENTO_DESCUENTO, CANTIDAD_CORRECCION_PRODUCTO_TERMINADO
        )

    def AumentarInventarioProductoTerminado(
        self, data: CorreccionProductoTerminadoRequest, id_usuario: int
    ) -> CorreccionProductoTerminadoResponse:
        self._ValidarSinBloqueo(BLOQUEO_CORRECCION)
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

        encontrado = self.repository.ObtenerInventariosBloqueados([data.IdPresentacion]).get(
            data.IdPresentacion
        )
        if encontrado is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No existe inventario registrado para la presentación {data.IdPresentacion}",
            )

        inventario, presentacion, producto = encontrado
        disponible = int(inventario.CantidadActual)

        if id_tipo_movimiento in MOVIMIENTOS_QUE_RESTAN:
            if data.Cantidad > disponible:
                self.repository.Revertir()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Stock insuficiente para {presentacion.CodigoPresentacion} (disponible {disponible}, solicitado {data.Cantidad})",
                )
            cantidad_nueva = disponible - data.Cantidad
        else:
            cantidad_nueva = disponible + data.Cantidad

        id_turno = self.repository.IdTurnoActual()
        self.repository.RegistrarMovimientos(
            [
                (
                    inventario,
                    MovimientoProductoTerminado(
                        IdTipoMovimientoInventario=id_tipo_movimiento,
                        IdPresentacion=data.IdPresentacion,
                        IdUsuario=id_usuario,
                        IdTurno=id_turno,
                        CantidadIngresoInventario=data.Cantidad,
                        Observacion=observacion,
                    ),
                    cantidad_nueva,
                )
            ],
            "No se pudo registrar la corrección de producto terminado",
        )

        return CorreccionProductoTerminadoResponse(
            IdPresentacion=presentacion.IdPresentacion,
            CodigoPresentacion=presentacion.CodigoPresentacion,
            NombreProducto=producto.NombreProducto,
            NombreTipoMovimientoInventario=self.repository.NombreTipoMovimiento(id_tipo_movimiento),
            CantidadAplicada=data.Cantidad,
            CantidadActual=cantidad_nueva,
        )

    def VerInventarioProductoTerminado(
        self, id_producto: int | None
    ) -> list[VerInventarioProductoTerminadoResponse]:
        filas = self.repository.VerInventarioProductoTerminado(id_producto)

        return [VerInventarioProductoTerminadoResponse(**fila) for fila in filas]

    def ObtenerProductos(self) -> list[ProductoResponse]:
        filas = self.repository.ObtenerProductos()

        return [ProductoResponse(**fila) for fila in filas]