from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.AlertaStock import DOMINIO_STOCK_BOBINA_PAPEL
from app.Models.BobinaPapel.TipoBobina import (
    CrearTipoBobinaRequest,
    EditarTipoBobinaRequest,
    TipoBobinaAdminItem,
)
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CambiarEstadoTipoRequest,
    CambiarEstadoTipoResponse,
    ProductoDisponible,
)
from app.Repository.AlertaStock.AlertaStock import AlertaStockRepository
from app.Repository.BobinaPapel.TipoBobina import TipoBobinaRepository
from app.Schemas.BobinaPapel import TipoBobina
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
    validar_nombre,
)

ETIQUETA = "tipo de bobina papel"
CAMPO_TIPO = "IdTipoBobina"
CAMPO_OTRO_TIPO = "IdTipoBobinaServilleta"

ETIQUETAS_CAMPOS = {
    "DiametroMm": "diámetro (mm)",
    "Formato": "formato (mm)",
    "TaraKg": "tara (kg)",
    "Descripcion": "descripción",
}


class TipoBobinaService:
    def __init__(self, db: Session):
        self.repository = TipoBobinaRepository(db)
        self.stock = AlertaStockRepository(db)

    def ListarTipos(self, id_tipo: int | None = None) -> list[TipoBobinaAdminItem]:
        tipos = self.repository.ListarTipos(id_tipo)
        ids = [tipo["IdTipoBobina"] for tipo in tipos]
        productos = self.repository.ProductosDeTipos(Producto.IdTipoBobina, ids)
        stock = {
            fila["Id"]: fila
            for fila in self.stock.ListarStock(dominio=DOMINIO_STOCK_BOBINA_PAPEL)
        }

        return [
            TipoBobinaAdminItem(
                **tipo,
                CantidadBobinas=stock[tipo["IdTipoBobina"]]["CantidadActual"],
                NivelStock=stock[tipo["IdTipoBobina"]]["NivelStock"],
                Productos=productos.get(tipo["IdTipoBobina"], []),
            )
            for tipo in tipos
        ]

    def ProductosDisponibles(self) -> list[ProductoDisponible]:
        return [
            ProductoDisponible(**fila)
            for fila in self.repository.ProductosDisponibles(
                Producto.IdTipoBobina, Producto.IdTipoBobinaServilleta
            )
        ]

    def CrearTipo(self, data: CrearTipoBobinaRequest, id_admin: int) -> TipoBobinaAdminItem:
        nombre = validar_nombre(self.repository, data.NombreTipoBobina, ETIQUETA)
        descripcion = validar_descripcion(data.Descripcion)
        validar_umbral_stock(data.StockMinimo, data.StockPreventivo)

        agregados, _, _, nombres_productos = preparar_productos(
            self.repository, data.IdsProducto, None, CAMPO_TIPO, CAMPO_OTRO_TIPO, "bobina servilleta"
        )

        valores = {
            "DiametroMm": data.DiametroMm,
            "Formato": data.Formato,
            "TaraKg": data.TaraKg,
            "Descripcion": descripcion,
        }

        def asociar(tipo: TipoBobina) -> list:
            asignar_productos(agregados, [], CAMPO_TIPO, tipo.IdTipoBobina)
            return []

        creado = self.repository.CrearTipo(
            TipoBobina(
                NombreTipoBobina=nombre,
                StockMinimo=data.StockMinimo,
                StockPreventivo=data.StockPreventivo,
                Activo=True,
                **valores,
            ),
            asociar,
            lambda t: (
                f"Crear tipo de bobina papel · #{t.IdTipoBobina} {t.NombreTipoBobina} "
                f"({detalle_campos(ETIQUETAS_CAMPOS, valores)}, "
                f"stock: {mostrar_umbral(data.StockMinimo, data.StockPreventivo)}, "
                f"productos: {mostrar(nombres_productos)})"
            ),
            id_admin,
            "No se pudo crear el tipo de bobina papel",
        )
        return self.ListarTipos(creado.IdTipoBobina)[0]

    def EditarTipo(self, data: EditarTipoBobinaRequest, id_admin: int) -> TipoBobinaAdminItem:
        descripcion = validar_descripcion(data.Descripcion)
        validar_umbral_stock(data.StockMinimo, data.StockPreventivo)

        tipo = self.repository.ObtenerTipoBloqueado(data.IdTipoBobina)
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
                "Formato": data.Formato,
                "TaraKg": data.TaraKg,
                "Descripcion": descripcion,
            },
        )
        detalle = detalle_cambios(ETIQUETAS_CAMPOS, tipo, cambios)

        stock_anterior = (tipo.StockMinimo, tipo.StockPreventivo)
        stock_nuevo = (data.StockMinimo, data.StockPreventivo)
        if stock_anterior != stock_nuevo:
            detalle.append(f"stock: {mostrar_umbral(*stock_anterior)} → {mostrar_umbral(*stock_nuevo)}")

        agregados, quitados, antes, despues = preparar_productos(
            self.repository,
            data.IdsProducto,
            tipo.IdTipoBobina,
            CAMPO_TIPO,
            CAMPO_OTRO_TIPO,
            "bobina servilleta",
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
        asignar_productos(agregados, quitados, CAMPO_TIPO, tipo.IdTipoBobina)

        self.repository.Guardar(
            f"Editar tipo de bobina papel · #{tipo.IdTipoBobina} {tipo.NombreTipoBobina}: {'; '.join(detalle)}",
            id_admin,
            "No se pudo editar el tipo de bobina papel",
        )
        return self.ListarTipos(data.IdTipoBobina)[0]

    def CambiarEstado(self, data: CambiarEstadoTipoRequest, id_admin: int) -> CambiarEstadoTipoResponse:
        return cambiar_estado(self.repository, data, id_admin, ETIQUETA, "NombreTipoBobina")
