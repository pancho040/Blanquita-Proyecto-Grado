from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.AlertaStock import (
    DOMINIOS_STOCK,
    NIVEL_STOCK_BAJO,
    NIVEL_STOCK_CRITICO,
    NOMBRES_DOMINIO_STOCK,
)
from app.Constants.Cantidades import STOCK_UMBRAL_MAXIMO
from app.Models.AlertaStock.AlertaStock import (
    EditarUmbralStockRequest,
    ResumenAlertaStockResponse,
    UmbralStockItem,
)
from app.Repository.AlertaStock.AlertaStock import AlertaStockRepository


def _item(fila: dict) -> UmbralStockItem:
    return UmbralStockItem(**fila, NombreDominio=NOMBRES_DOMINIO_STOCK[fila["Dominio"]])


def mostrar_umbral(stock_minimo: int | None, stock_preventivo: int | None) -> str:
    if stock_minimo is None:
        return "sin umbral"
    return f"mínimo {stock_minimo}, preventivo {stock_preventivo}"


def validar_umbral_stock(stock_minimo: int | None, stock_preventivo: int | None) -> None:
    if (stock_minimo is None) != (stock_preventivo is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="El stock mínimo y el preventivo se registran juntos o se quitan juntos",
        )

    if stock_minimo is None:
        return

    if stock_preventivo <= stock_minimo:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="El stock preventivo debe ser mayor al stock mínimo",
        )

    if stock_preventivo > STOCK_UMBRAL_MAXIMO:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"El stock preventivo no puede superar {STOCK_UMBRAL_MAXIMO}",
        )


class AlertaStockService:
    def __init__(self, db: Session):
        self.repository = AlertaStockRepository(db)

    def VerAlertas(self) -> ResumenAlertaStockResponse:
        alertas = [_item(fila) for fila in self.repository.ListarStock(solo_alertas=True)]
        criticos = sum(1 for alerta in alertas if alerta.NivelStock == NIVEL_STOCK_CRITICO)
        bajos = sum(1 for alerta in alertas if alerta.NivelStock == NIVEL_STOCK_BAJO)

        return ResumenAlertaStockResponse(
            Criticos=criticos,
            Bajos=bajos,
            Total=len(alertas),
            Alertas=alertas,
        )

    def ListarUmbrales(self, dominio: str | None) -> list[UmbralStockItem]:
        if dominio is not None:
            self._ValidarDominio(dominio)
        return [_item(fila) for fila in self.repository.ListarStock(dominio=dominio)]

    def EditarUmbral(self, data: EditarUmbralStockRequest, id_admin: int) -> UmbralStockItem:
        self._ValidarDominio(data.Dominio)
        validar_umbral_stock(data.StockMinimo, data.StockPreventivo)

        registro = self.repository.ObtenerRegistroBloqueado(data.Dominio, data.Id)
        if registro is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No existe el registro #{data.Id} en {NOMBRES_DOMINIO_STOCK[data.Dominio]}",
            )

        anterior = (registro.StockMinimo, registro.StockPreventivo)
        nuevo = (data.StockMinimo, data.StockPreventivo)
        if anterior == nuevo:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No hay cambios para guardar",
            )

        nombre = self.repository.ListarStock(dominio=data.Dominio, id_item=data.Id)[0]["Nombre"]
        observacion = (
            f"Umbral de stock · {NOMBRES_DOMINIO_STOCK[data.Dominio]} #{data.Id} {nombre}: "
            f"{mostrar_umbral(*anterior)} → {mostrar_umbral(*nuevo)}"
        )
        self.repository.GuardarUmbral(registro, data.StockMinimo, data.StockPreventivo, observacion, id_admin)

        return _item(self.repository.ListarStock(dominio=data.Dominio, id_item=data.Id)[0])

    def _ValidarDominio(self, dominio: str) -> None:
        if dominio not in DOMINIOS_STOCK:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El dominio debe ser uno de: {', '.join(DOMINIOS_STOCK)}",
            )
