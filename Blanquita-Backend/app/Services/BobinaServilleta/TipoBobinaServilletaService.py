from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.AlertaStock import DOMINIO_STOCK_BOBINA_SERVILLETA
from app.Models.BobinaServilleta.BobinaServilleta import FormatoSubBobinaResponse
from app.Models.BobinaServilleta.TipoBobinaServilleta import (
    CrearTipoBobinaServilletaRequest,
    EditarTipoBobinaServilletaRequest,
    TipoBobinaServilletaAdminItem,
)
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CambiarEstadoTipoRequest,
    CambiarEstadoTipoResponse,
    ProductoDisponible,
)
from app.Repository.AlertaStock.AlertaStock import AlertaStockRepository
from app.Repository.BobinaServilleta.TipoBobinaServilleta import TipoBobinaServilletaRepository
from app.Schemas.BobinaServilleta import TipoBobinaServilleta, TipoBobinaServilletaFormato
from app.Schemas.Producto import Producto
from app.Services.AlertaStock.AlertaStock import mostrar_umbral, validar_umbral_stock
from app.Services.MateriaPrima.TipoMateriaPrima import (
    asignar_productos,
    cambiar_estado,
    cambios_campos,
    detalle_cambios,
    detalle_campos,
    mostrar,
    preparar_productos,
    validar_descripcion,
    validar_ids_unicos,
    validar_nombre,
)

ETIQUETA = "tipo de bobina servilleta"
CAMPO_TIPO = "IdTipoBobinaServilleta"
CAMPO_OTRO_TIPO = "IdTipoBobina"

ETIQUETAS_CAMPOS = {
    "DiametroMm": "diámetro (mm)",
    "CrepadoPorcentaje": "crepado (%)",
    "ResistenciaKgf": "resistencia (kgf)",
    "CantidadUnidades": "unidades por bobina",
    "Descripcion": "descripción",
}


class TipoBobinaServilletaService:
    def __init__(self, db: Session):
        self.repository = TipoBobinaServilletaRepository(db)
        self.stock = AlertaStockRepository(db)

    def ListarTipos(self, id_tipo: int | None = None) -> list[TipoBobinaServilletaAdminItem]:
        tipos = self.repository.ListarTipos(id_tipo)
        ids = [tipo["IdTipoBobinaServilleta"] for tipo in tipos]
        productos = self.repository.ProductosDeTipos(Producto.IdTipoBobinaServilleta, ids)
        formatos = self.repository.FormatosDeTipos(ids)
        stock = {
            fila["Id"]: fila
            for fila in self.stock.ListarStock(dominio=DOMINIO_STOCK_BOBINA_SERVILLETA)
        }

        return [
            TipoBobinaServilletaAdminItem(
                **tipo,
                CantidadBobinas=stock[tipo["IdTipoBobinaServilleta"]]["CantidadActual"],
                NivelStock=stock[tipo["IdTipoBobinaServilleta"]]["NivelStock"],
                Formatos=formatos.get(tipo["IdTipoBobinaServilleta"], []),
                Productos=productos.get(tipo["IdTipoBobinaServilleta"], []),
            )
            for tipo in tipos
        ]

    def ListarFormatos(self) -> list[FormatoSubBobinaResponse]:
        return [FormatoSubBobinaResponse(**fila) for fila in self.repository.ListarFormatos()]

    def ProductosDisponibles(self) -> list[ProductoDisponible]:
        return [
            ProductoDisponible(**fila)
            for fila in self.repository.ProductosDisponibles(
                Producto.IdTipoBobinaServilleta, Producto.IdTipoBobina
            )
        ]

    def CrearTipo(
        self, data: CrearTipoBobinaServilletaRequest, id_admin: int
    ) -> TipoBobinaServilletaAdminItem:
        nombre = validar_nombre(self.repository, data.NombreTipoBobinaServilleta, ETIQUETA)
        descripcion = validar_descripcion(data.Descripcion)
        validar_umbral_stock(data.StockMinimo, data.StockPreventivo)
        ids_formato, formatos = self._ValidarFormatos(data.IdsFormato, set())

        agregados, _, _, nombres_productos = preparar_productos(
            self.repository, data.IdsProducto, None, CAMPO_TIPO, CAMPO_OTRO_TIPO, "bobina papel"
        )

        valores = {
            "DiametroMm": data.DiametroMm,
            "CrepadoPorcentaje": data.CrepadoPorcentaje,
            "ResistenciaKgf": data.ResistenciaKgf,
            "CantidadUnidades": data.CantidadUnidades,
            "Descripcion": descripcion,
        }

        def asociar(tipo: TipoBobinaServilleta) -> list:
            asignar_productos(agregados, [], CAMPO_TIPO, tipo.IdTipoBobinaServilleta)
            return [
                TipoBobinaServilletaFormato(
                    IdTipoBobinaServilleta=tipo.IdTipoBobinaServilleta,
                    IdFormatoSubBobina=id_formato,
                )
                for id_formato in ids_formato
            ]

        creado = self.repository.CrearTipo(
            TipoBobinaServilleta(
                NombreTipoBobinaServilleta=nombre,
                StockMinimo=data.StockMinimo,
                StockPreventivo=data.StockPreventivo,
                Activo=True,
                **valores,
            ),
            asociar,
            lambda t: (
                f"Crear tipo de bobina servilleta · #{t.IdTipoBobinaServilleta} {t.NombreTipoBobinaServilleta} "
                f"({detalle_campos(ETIQUETAS_CAMPOS, valores)}, "
                f"formatos: {mostrar(self._Nombres(formatos, ids_formato))}, "
                f"stock: {mostrar_umbral(data.StockMinimo, data.StockPreventivo)}, "
                f"productos: {mostrar(nombres_productos)})"
            ),
            id_admin,
            "No se pudo crear el tipo de bobina servilleta",
        )
        return self.ListarTipos(creado.IdTipoBobinaServilleta)[0]

    def EditarTipo(
        self, data: EditarTipoBobinaServilletaRequest, id_admin: int
    ) -> TipoBobinaServilletaAdminItem:
        descripcion = validar_descripcion(data.Descripcion)
        validar_umbral_stock(data.StockMinimo, data.StockPreventivo)

        tipo = self.repository.ObtenerTipoBloqueado(data.IdTipoBobinaServilleta)
        if tipo is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El {ETIQUETA} no existe",
            )

        cambios = cambios_campos(
            tipo,
            {
                "DiametroMm": data.DiametroMm,
                "CrepadoPorcentaje": data.CrepadoPorcentaje,
                "ResistenciaKgf": data.ResistenciaKgf,
                "CantidadUnidades": data.CantidadUnidades,
                "Descripcion": descripcion,
            },
        )
        detalle = detalle_cambios(ETIQUETAS_CAMPOS, tipo, cambios)

        stock_anterior = (tipo.StockMinimo, tipo.StockPreventivo)
        stock_nuevo = (data.StockMinimo, data.StockPreventivo)
        if stock_anterior != stock_nuevo:
            detalle.append(f"stock: {mostrar_umbral(*stock_anterior)} → {mostrar_umbral(*stock_nuevo)}")

        asignaciones = self.repository.ObtenerAsignacionesBloqueadas(tipo.IdTipoBobinaServilleta)
        ids_actuales = set(asignaciones)
        ids_formato, formatos = self._ValidarFormatos(data.IdsFormato, ids_actuales)
        nuevos_formatos = [
            TipoBobinaServilletaFormato(
                IdTipoBobinaServilleta=tipo.IdTipoBobinaServilleta,
                IdFormatoSubBobina=id_formato,
            )
            for id_formato in ids_formato
            if id_formato not in ids_actuales
        ]
        formatos_quitados = [
            asignacion
            for id_formato, asignacion in asignaciones.items()
            if id_formato not in ids_formato
        ]
        if nuevos_formatos or formatos_quitados:
            detalle.append(
                f"formatos: {mostrar(self._Nombres(formatos, sorted(ids_actuales)))} → "
                f"{mostrar(self._Nombres(formatos, ids_formato))}"
            )

        agregados, quitados, antes, despues = preparar_productos(
            self.repository,
            data.IdsProducto,
            tipo.IdTipoBobinaServilleta,
            CAMPO_TIPO,
            CAMPO_OTRO_TIPO,
            "bobina papel",
        )
        if agregados or quitados:
            detalle.append(f"productos: {mostrar(antes)} → {mostrar(despues)}")

        if not detalle:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No hay cambios para guardar",
            )

        for campo, valor in cambios.items():
            setattr(tipo, campo, valor)
        tipo.StockMinimo, tipo.StockPreventivo = stock_nuevo
        asignar_productos(agregados, quitados, CAMPO_TIPO, tipo.IdTipoBobinaServilleta)

        self.repository.Guardar(
            (
                f"Editar tipo de bobina servilleta · #{tipo.IdTipoBobinaServilleta} "
                f"{tipo.NombreTipoBobinaServilleta}: {'; '.join(detalle)}"
            ),
            id_admin,
            "No se pudo editar el tipo de bobina servilleta",
            nuevos=nuevos_formatos,
            eliminados=formatos_quitados,
        )
        return self.ListarTipos(data.IdTipoBobinaServilleta)[0]

    def CambiarEstado(self, data: CambiarEstadoTipoRequest, id_admin: int) -> CambiarEstadoTipoResponse:
        return cambiar_estado(
            self.repository, data, id_admin, ETIQUETA, "NombreTipoBobinaServilleta"
        )

    def _ValidarFormatos(self, ids: list[int], ids_actuales: set[int]) -> tuple[list[int], dict[int, dict]]:
        ids_formato = validar_ids_unicos(ids, "formatos")
        formatos = self.repository.ObtenerFormatos(sorted(set(ids_formato) | ids_actuales))

        faltantes = [i for i in ids_formato if i not in formatos]
        if faltantes:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No existen los formatos con id {', '.join(map(str, faltantes))}",
            )

        inactivos = [
            formatos[i]["DescripcionFormato"]
            for i in ids_formato
            if i not in ids_actuales and not formatos[i]["Activo"]
        ]
        if inactivos:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"No se pueden asignar formatos inactivos: {', '.join(inactivos)}",
            )

        return ids_formato, formatos

    def _Nombres(self, formatos: dict[int, dict], ids: list[int]) -> list[str]:
        return [formatos[i]["DescripcionFormato"] for i in ids]
