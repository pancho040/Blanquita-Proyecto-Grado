from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Cantidades import (
    CANTIDAD_MOVIMIENTO_BOLSA_JAVA,
    CANTIDAD_REINGRESO_EMPAQUE,
    LONGITUD_MAXIMA_DESCRIPCION,
    LONGITUD_MINIMA_DESCRIPCION,
)
from app.Models.Empaque.BolsaJava import (
    IngresoBolsaJavaItemResponse,
    IngresoBolsaJavaRequest,
    IngresoBolsaJavaResponse,
    InventarioBolsaJavaResponse,
    ReingresoBolsaJavaRequest,
    ReingresoBolsaJavaResponse,
    SalidaBolsaJavaRequest,
    SalidaBolsaJavaResponse,
)
from app.Repository.Empaque.BolsaJava import BolsaJavaRepository
from app.Constants.Estados import MOVIMIENTO_MATERIA_PRIMA_REINGRESO
from app.Schemas.Empaque import (
    InventarioBolsaJava,
    LoteEmpaque,
    MovimientoBolsaJava,
    TipoBolsaJava,
)
from app.utils.dates import ZONA_BOLIVIA
from app.utils.validators import EsCantidadValida, REGLA_CARACTERES_OBSERVACION, ValidarTexto

ID_TIPO_MOVIMIENTO_INGRESO = 1
ID_TIPO_MOVIMIENTO_SALIDA = 2


class BolsaJavaService:
    def __init__(self, db: Session):
        self.repository = BolsaJavaRepository(db)

    def VerInventario(self) -> list[InventarioBolsaJavaResponse]:
        return [InventarioBolsaJavaResponse(**fila) for fila in self.repository.VerInventario()]

    def InsertarBolsaJava(
        self, data: IngresoBolsaJavaRequest, id_usuario: int
    ) -> IngresoBolsaJavaResponse:
        self._ValidarItemsIngreso(data)

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

        ids_tipo = sorted(item.IdTipoBolsaJava for item in data.BolsasJava)
        inventarios = self.repository.ObtenerInventariosBloqueados(ids_tipo)

        faltantes = [str(id_tipo) for id_tipo in ids_tipo if id_tipo not in inventarios]
        if faltantes:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Los tipos de bolsa de jaba {', '.join(faltantes)} no existen o no tienen inventario",
            )

        inactivos = [tipo.NombreBolsaJava for _, tipo in inventarios.values() if not tipo.Activo]
        if inactivos:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Los tipos de bolsa de jaba {', '.join(inactivos)} están inactivos, no se puede registrar el lote",
            )

        registros = []
        for item in data.BolsasJava:
            inventario, _ = inventarios[item.IdTipoBolsaJava]
            registros.append(
                (
                    inventario,
                    MovimientoBolsaJava(
                        IdTipoBolsaJava=item.IdTipoBolsaJava,
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
                CantidadToneladasPedida=data.CantidadToneladasPedida,
            ),
            registros,
            lambda l: f"Ingreso a almacén · Lote #{l.IdLoteEmpaque} de {proveedor['NombreProveedor']}",
        )

        bolsas = [
            IngresoBolsaJavaItemResponse(
                IdMovimientoBolsaJava=movimiento.IdMovimientoBolsaJava,
                IdTipoBolsaJava=movimiento.IdTipoBolsaJava,
                NombreBolsaJava=inventarios[movimiento.IdTipoBolsaJava][1].NombreBolsaJava,
                CantidadIngresada=int(movimiento.CantidadMovimiento),
                CantidadActual=cantidad_nueva,
                FechaMovimiento=movimiento.FechaMovimiento,
            )
            for _, movimiento, cantidad_nueva in registros
        ]

        return IngresoBolsaJavaResponse(
            IdLoteEmpaque=lote.IdLoteEmpaque,
            IdProveedor=lote.IdProveedor,
            NombreProveedor=proveedor["NombreProveedor"],
            FechaRecepcion=lote.FechaRecepcion,
            CantidadToneladasPedida=lote.CantidadToneladasPedida,
            CantidadTotalIngresada=sum(b.CantidadIngresada for b in bolsas),
            BolsasJava=bolsas,
        )

    def SacarBolsaJava(
        self, data: SalidaBolsaJavaRequest, id_usuario: int
    ) -> SalidaBolsaJavaResponse:
        self._ValidarCantidad(data.Cantidad)
        observacion = self._ValidarObservacion(data.Observacion)
        inventario, tipo = self._ObtenerInventario(data.IdTipoBolsaJava)
        cantidad_actual = int(inventario.CantidadActual)

        if data.Cantidad > cantidad_actual:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"No hay suficiente {tipo.NombreBolsaJava} en almacén, disponible: {cantidad_actual}",
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

    def ReingresarBolsaJava(
        self, data: ReingresoBolsaJavaRequest, id_usuario: int
    ) -> ReingresoBolsaJavaResponse:
        if data.Cantidad <= 0 or data.Cantidad > CANTIDAD_REINGRESO_EMPAQUE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La cantidad a reingresar debe estar entre 1 y {CANTIDAD_REINGRESO_EMPAQUE} paquetes",
            )

        observacion = self._ValidarObservacion(data.Observacion)
        inventario, tipo = self._ObtenerInventario(data.IdTipoBolsaJava)

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
        self, id_tipo_bolsa_java: int
    ) -> tuple[InventarioBolsaJava, TipoBolsaJava]:
        encontrado = self.repository.ObtenerInventariosBloqueados([id_tipo_bolsa_java]).get(
            id_tipo_bolsa_java
        )
        if encontrado is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El tipo de bolsa de jaba con id {id_tipo_bolsa_java} no existe o no tiene inventario",
            )
        return encontrado

    def _RegistrarMovimiento(
        self,
        inventario: InventarioBolsaJava,
        tipo: TipoBolsaJava,
        data: SalidaBolsaJavaRequest | ReingresoBolsaJavaRequest,
        observacion: str,
        id_tipo_movimiento: int,
        nombre_movimiento: str,
        cantidad_nueva: int,
        id_usuario: int,
    ) -> SalidaBolsaJavaResponse:
        movimiento = self.repository.RegistrarMovimiento(
            inventario,
            MovimientoBolsaJava(
                IdTipoBolsaJava=data.IdTipoBolsaJava,
                IdTipoMovimiento=id_tipo_movimiento,
                IdUsuario=id_usuario,
                CantidadMovimiento=data.Cantidad,
                Observacion=observacion,
            ),
            cantidad_nueva,
        )

        return SalidaBolsaJavaResponse(
            IdMovimientoBolsaJava=movimiento.IdMovimientoBolsaJava,
            IdTipoBolsaJava=movimiento.IdTipoBolsaJava,
            NombreBolsaJava=tipo.NombreBolsaJava,
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

        if not EsCantidadValida(cantidad, CANTIDAD_MOVIMIENTO_BOLSA_JAVA):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La cantidad máxima por tipo de bolsa de jaba es de {CANTIDAD_MOVIMIENTO_BOLSA_JAVA}",
            )

    def _ValidarItemsIngreso(self, data: IngresoBolsaJavaRequest) -> None:
        if not data.BolsasJava:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Debe ingresar al menos un tipo de bolsa de jaba",
            )

        ids_vistos = set()
        for item in data.BolsasJava:
            self._ValidarCantidad(item.Cantidad)

            if item.IdTipoBolsaJava in ids_vistos:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"El tipo de bolsa de jaba {item.IdTipoBolsaJava} está repetido en el lote",
                )
            ids_vistos.add(item.IdTipoBolsaJava)
