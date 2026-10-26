from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Cantidades import (
    CANTIDAD_MOVIMIENTO_EMPAQUE_BOLSA,
    CANTIDAD_REINGRESO_EMPAQUE,
    LONGITUD_MAXIMA_DESCRIPCION,
    LONGITUD_MINIMA_DESCRIPCION,
)
from app.Models.Empaque.EmpaqueBolsa import (
    IngresoEmpaqueBolsaItemResponse,
    IngresoEmpaqueBolsaRequest,
    IngresoEmpaqueBolsaResponse,
    InventarioEmpaqueBolsaResponse,
    ReingresoEmpaqueBolsaRequest,
    ReingresoEmpaqueBolsaResponse,
    SalidaEmpaqueBolsaRequest,
    SalidaEmpaqueBolsaResponse,
)
from app.Repository.Empaque.EmpaqueBolsa import EmpaqueBolsaRepository
from app.Constants.Estados import MOVIMIENTO_MATERIA_PRIMA_REINGRESO
from app.Schemas.Empaque import (
    InventarioEmpaqueBolsa,
    LoteEmpaque,
    MovimientoEmpaqueBolsa,
    TipoEmpaqueBolsa,
)
from app.utils.dates import ZONA_BOLIVIA
from app.utils.validators import (
    EsCantidadValida,
    REGLA_CARACTERES_OBSERVACION,
    ToneladasPedidas,
    ValidarTexto,
)

ID_TIPO_MOVIMIENTO_INGRESO = 1
ID_TIPO_MOVIMIENTO_SALIDA = 2


class EmpaqueBolsaService:
    def __init__(self, db: Session):
        self.repository = EmpaqueBolsaRepository(db)

    def VerInventario(self, incluir_inactivos: bool = False) -> list[InventarioEmpaqueBolsaResponse]:
        return [InventarioEmpaqueBolsaResponse(**fila) for fila in self.repository.VerInventario(incluir_inactivos)]

    def InsertarEmpaqueBolsa(
        self, data: IngresoEmpaqueBolsaRequest, id_usuario: int
    ) -> IngresoEmpaqueBolsaResponse:
        self._ValidarItemsIngreso(data)
        toneladas = ToneladasPedidas(data.CantidadToneladasPedida, obligatorio=False)

        proveedor = self.repository.ObtenerProveedor(data.IdProveedor)
        if proveedor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El proveedor con id {data.IdProveedor} no existe",
            )

        if not proveedor["Activo"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El proveedor {proveedor['NombreProveedor']} está inactivo, no se puede registrar el lote",
            )

        ids_tipo = sorted(item.IdTipoEmpaqueBolsa for item in data.EmpaquesBolsa)
        inventarios = self.repository.ObtenerInventariosBloqueados(ids_tipo)

        faltantes = [str(id_tipo) for id_tipo in ids_tipo if id_tipo not in inventarios]
        if faltantes:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Los tipos de empaque bolsa {', '.join(faltantes)} no existen o no tienen inventario",
            )

        inactivos = [tipo.NombreEmpaqueBolsa for _, tipo in inventarios.values() if not tipo.Activo]
        if inactivos:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Los tipos de empaque bolsa {', '.join(inactivos)} están inactivos, no se puede registrar el lote",
            )

        registros = []
        for item in data.EmpaquesBolsa:
            inventario, _ = inventarios[item.IdTipoEmpaqueBolsa]
            registros.append(
                (
                    inventario,
                    MovimientoEmpaqueBolsa(
                        IdTipoEmpaqueBolsa=item.IdTipoEmpaqueBolsa,
                        IdTipoMovimiento=ID_TIPO_MOVIMIENTO_INGRESO,
                        IdUsuario=id_usuario,
                        CantidadMovimiento=item.Cantidad,
                    ),
                    int(inventario.CantidadActual) + item.Cantidad,
                )
            )

        lote = self.repository.RegistrarIngreso(
            LoteEmpaque(
                IdProveedor=data.IdProveedor,
                IdUsuario=id_usuario,
                FechaRecepcion=datetime.now(ZONA_BOLIVIA).date(),
                CantidadToneladasPedida=toneladas,
            ),
            registros,
            lambda l: f"Ingreso a almacén · Lote #{l.IdLoteEmpaque} de {proveedor['NombreProveedor']}",
        )

        empaques = [
            IngresoEmpaqueBolsaItemResponse(
                IdMovimientoEmpaqueBolsa=movimiento.IdMovimientoEmpaqueBolsa,
                IdTipoEmpaqueBolsa=movimiento.IdTipoEmpaqueBolsa,
                NombreEmpaqueBolsa=inventarios[movimiento.IdTipoEmpaqueBolsa][1].NombreEmpaqueBolsa,
                CantidadIngresada=int(movimiento.CantidadMovimiento),
                CantidadActual=cantidad_nueva,
                FechaMovimiento=movimiento.FechaMovimiento,
            )
            for _, movimiento, cantidad_nueva in registros
        ]

        return IngresoEmpaqueBolsaResponse(
            IdLoteEmpaque=lote.IdLoteEmpaque,
            IdProveedor=lote.IdProveedor,
            NombreProveedor=proveedor["NombreProveedor"],
            FechaRecepcion=lote.FechaRecepcion,
            CantidadToneladasPedida=lote.CantidadToneladasPedida,
            CantidadTotalIngresada=sum(e.CantidadIngresada for e in empaques),
            Empaques=empaques,
        )

    def SacarEmpaqueBolsa(
        self, data: SalidaEmpaqueBolsaRequest, id_usuario: int
    ) -> SalidaEmpaqueBolsaResponse:
        self._ValidarCantidad(data.Cantidad)
        observacion = self._ValidarObservacion(data.Observacion)
        inventario, tipo = self._ObtenerInventario(data.IdTipoEmpaqueBolsa)
        cantidad_actual = int(inventario.CantidadActual)

        if data.Cantidad > cantidad_actual:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"No hay suficiente {tipo.NombreEmpaqueBolsa} en almacén, disponible: {cantidad_actual}",
            )

        return self._RegistrarMovimiento(
            inventario,
            tipo,
            data,
            observacion,
            ID_TIPO_MOVIMIENTO_SALIDA,
            "Salida",
            cantidad_actual - data.Cantidad,
            id_usuario,
        )

    def ReingresarEmpaqueBolsa(
        self, data: ReingresoEmpaqueBolsaRequest, id_usuario: int
    ) -> ReingresoEmpaqueBolsaResponse:
        if data.Cantidad <= 0 or data.Cantidad > CANTIDAD_REINGRESO_EMPAQUE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La cantidad a reingresar debe estar entre 1 y {CANTIDAD_REINGRESO_EMPAQUE} paquetes",
            )

        observacion = self._ValidarObservacion(data.Observacion)
        inventario, tipo = self._ObtenerInventario(data.IdTipoEmpaqueBolsa)

        return self._RegistrarMovimiento(
            inventario,
            tipo,
            data,
            observacion,
            MOVIMIENTO_MATERIA_PRIMA_REINGRESO,
            "Reingreso",
            int(inventario.CantidadActual) + data.Cantidad,
            id_usuario,
        )

    def _ValidarObservacion(self, observacion: str | None) -> str:
        observacion = (observacion or "").strip()
        if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, observacion):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La observación es obligatoria, debe tener entre {LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, {REGLA_CARACTERES_OBSERVACION}",
            )
        return observacion

    def _ObtenerInventario(
        self, id_tipo_empaque_bolsa: int
    ) -> tuple[InventarioEmpaqueBolsa, TipoEmpaqueBolsa]:
        encontrado = self.repository.ObtenerInventariosBloqueados([id_tipo_empaque_bolsa]).get(
            id_tipo_empaque_bolsa
        )
        if encontrado is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El tipo de empaque bolsa con id {id_tipo_empaque_bolsa} no existe o no tiene inventario",
            )
        return encontrado

    def _RegistrarMovimiento(
        self,
        inventario: InventarioEmpaqueBolsa,
        tipo: TipoEmpaqueBolsa,
        data: SalidaEmpaqueBolsaRequest | ReingresoEmpaqueBolsaRequest,
        observacion: str,
        id_tipo_movimiento: int,
        nombre_movimiento: str,
        cantidad_nueva: int,
        id_usuario: int,
    ) -> SalidaEmpaqueBolsaResponse:
        movimiento = self.repository.RegistrarMovimiento(
            inventario,
            MovimientoEmpaqueBolsa(
                IdTipoEmpaqueBolsa=data.IdTipoEmpaqueBolsa,
                IdTipoMovimiento=id_tipo_movimiento,
                IdUsuario=id_usuario,
                CantidadMovimiento=data.Cantidad,
                Observacion=observacion,
            ),
            cantidad_nueva,
        )

        return SalidaEmpaqueBolsaResponse(
            IdMovimientoEmpaqueBolsa=movimiento.IdMovimientoEmpaqueBolsa,
            IdTipoEmpaqueBolsa=movimiento.IdTipoEmpaqueBolsa,
            NombreEmpaqueBolsa=tipo.NombreEmpaqueBolsa,
            NombreMovimiento=nombre_movimiento,
            CantidadMovimiento=data.Cantidad,
            CantidadActual=cantidad_nueva,
            FechaMovimiento=movimiento.FechaMovimiento,
        )

    def _ValidarCantidad(self, cantidad: int) -> None:
        if cantidad <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="La cantidad debe ser mayor a 0",
            )

        if not EsCantidadValida(cantidad, CANTIDAD_MOVIMIENTO_EMPAQUE_BOLSA):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La cantidad máxima por tipo de empaque es de {CANTIDAD_MOVIMIENTO_EMPAQUE_BOLSA}",
            )

    def _ValidarItemsIngreso(self, data: IngresoEmpaqueBolsaRequest) -> None:
        if not data.EmpaquesBolsa:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Debe ingresar al menos un tipo de empaque bolsa",
            )

        ids_vistos = set()
        for item in data.EmpaquesBolsa:
            self._ValidarCantidad(item.Cantidad)

            if item.IdTipoEmpaqueBolsa in ids_vistos:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"El tipo de empaque bolsa {item.IdTipoEmpaqueBolsa} está repetido en el lote",
                )
            ids_vistos.add(item.IdTipoEmpaqueBolsa)
