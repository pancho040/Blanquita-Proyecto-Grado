from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.AlertaStock import DOMINIO_STOCK_RODELA
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CambiarEstadoTipoRequest,
    CambiarEstadoTipoResponse,
)
from app.Models.Rodela.TipoRodela import (
    CrearTipoRodelaRequest,
    EditarTipoRodelaRequest,
    TipoRodelaAdminItem,
)
from app.Repository.AlertaStock.AlertaStock import AlertaStockRepository
from app.Repository.Rodela.TipoRodela import TipoRodelaRepository
from app.Schemas.Rodela import TipoRodela
from app.Services.AlertaStock.AlertaStock import mostrar_umbral, validar_umbral_stock
from app.Services.MateriaPrima.TipoMateriaPrima import (
    cambiar_estado,
    detalle_cambios,
    mostrar,
    validar_descripcion,
    validar_nombre,
)

ETIQUETA = "tipo de rodela"

ETIQUETAS_CAMPOS = {
    "Descripcion": "descripción",
}


class TipoRodelaService:
    def __init__(self, db: Session):
        self.repository = TipoRodelaRepository(db)
        self.stock = AlertaStockRepository(db)

    def ListarTipos(self, id_tipo: int | None = None) -> list[TipoRodelaAdminItem]:
        stock = {
            fila["Id"]: fila
            for fila in self.stock.ListarStock(dominio=DOMINIO_STOCK_RODELA)
        }
        return [
            TipoRodelaAdminItem(
                **tipo,
                CantidadEnAlmacen=stock[tipo["IdTipoRodela"]]["CantidadActual"],
                NivelStock=stock[tipo["IdTipoRodela"]]["NivelStock"],
            )
            for tipo in self.repository.ListarTipos(id_tipo)
        ]

    def CrearTipo(self, data: CrearTipoRodelaRequest, id_admin: int) -> TipoRodelaAdminItem:
        nombre = validar_nombre(self.repository, data.NombreTipoRodela, ETIQUETA)
        descripcion = validar_descripcion(data.Descripcion)
        validar_umbral_stock(data.StockMinimo, data.StockPreventivo)

        creado = self.repository.CrearTipo(
            TipoRodela(
                NombreTipoRodela=nombre,
                Descripcion=descripcion,
                StockMinimo=data.StockMinimo,
                StockPreventivo=data.StockPreventivo,
                Activo=True,
            ),
            lambda tipo: [],
            lambda t: (
                f"Crear tipo de rodela · #{t.IdTipoRodela} {t.NombreTipoRodela} "
                f"(descripción: {mostrar(t.Descripcion)}, "
                f"stock: {mostrar_umbral(data.StockMinimo, data.StockPreventivo)})"
            ),
            id_admin,
            "No se pudo crear el tipo de rodela",
        )
        return self.ListarTipos(creado.IdTipoRodela)[0]

    def EditarTipo(self, data: EditarTipoRodelaRequest, id_admin: int) -> TipoRodelaAdminItem:
        descripcion = validar_descripcion(data.Descripcion)
        validar_umbral_stock(data.StockMinimo, data.StockPreventivo)

        tipo = self.repository.ObtenerTipoBloqueado(data.IdTipoRodela)
        if tipo is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El {ETIQUETA} no existe",
            )

        cambios = {"Descripcion": descripcion} if tipo.Descripcion != descripcion else {}
        detalle = detalle_cambios(ETIQUETAS_CAMPOS, tipo, cambios)

        stock_anterior = (tipo.StockMinimo, tipo.StockPreventivo)
        stock_nuevo = (data.StockMinimo, data.StockPreventivo)
        if stock_anterior != stock_nuevo:
            detalle.append(f"stock: {mostrar_umbral(*stock_anterior)} → {mostrar_umbral(*stock_nuevo)}")

        if not detalle:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No hay cambios para guardar",
            )

        tipo.Descripcion = descripcion
        tipo.StockMinimo, tipo.StockPreventivo = stock_nuevo

        self.repository.Guardar(
            f"Editar tipo de rodela · #{tipo.IdTipoRodela} {tipo.NombreTipoRodela}: {'; '.join(detalle)}",
            id_admin,
            "No se pudo editar el tipo de rodela",
        )
        return self.ListarTipos(data.IdTipoRodela)[0]

    def CambiarEstado(self, data: CambiarEstadoTipoRequest, id_admin: int) -> CambiarEstadoTipoResponse:
        return cambiar_estado(self.repository, data, id_admin, ETIQUETA, "NombreTipoRodela")
