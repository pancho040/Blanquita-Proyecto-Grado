from sqlalchemy.orm import Session

from app.Constants.AlertaStock import DOMINIOS_STOCK_NOTIFICACION, NIVEL_STOCK_CRITICO
from app.Constants.Cantidades import HORAS_ALERTA_PAUSA_ABIERTA
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION
from app.Models.BobinaPapel.Inicio import (
    PausaAbiertaInicioBobinaPapel,
    ProduccionActivaInicioBobinaPapel,
)
from app.Models.BobinaServilleta.Inicio import (
    PausaAbiertaInicioBobinaServilleta,
    ProduccionActivaInicioBobinaServilleta,
)
from app.Models.Notificacion.Notificacion import (
    NotificacionesResponse,
    ProduccionBobinaPapelNotificaciones,
    ProduccionBobinaServilletaNotificaciones,
    StockNotificaciones,
)
from app.Repository.AlertaStock.AlertaStock import AlertaStockRepository
from app.Repository.BobinaPapel.Inicio import InicioBobinaPapelRepository
from app.Repository.BobinaServilleta.Inicio import InicioBobinaServilletaRepository
from app.Services.AlertaStock.AlertaStock import _item
from app.utils.inicio import semana_inicio


class NotificacionService:
    def __init__(self, db: Session):
        self.alertas = AlertaStockRepository(db)
        self.bobina_papel = InicioBobinaPapelRepository(db)
        self.bobina_servilleta = InicioBobinaServilletaRepository(db)

    def _Stock(self) -> StockNotificaciones:
        criticos = [
            _item(fila)
            for dominio in DOMINIOS_STOCK_NOTIFICACION
            for fila in self.alertas.ListarStock(dominio=dominio, solo_alertas=True)
            if fila["NivelStock"] == NIVEL_STOCK_CRITICO
        ]
        return StockNotificaciones(
            SinStock=[alerta for alerta in criticos if alerta.CantidadActual <= 0],
            Criticos=[alerta for alerta in criticos if alerta.CantidadActual > 0],
        )

    def VerNotificaciones(self, id_rol: int) -> NotificacionesResponse:
        semana = semana_inicio()

        bobina_papel = ProduccionBobinaPapelNotificaciones(
            Activas=[
                ProduccionActivaInicioBobinaPapel(
                    **fila, Atrasada=semana.produccion_atrasada(fila["FechaInicioProduccion"])
                )
                for fila in self.bobina_papel.Activas()
            ],
            Pausadas=[
                PausaAbiertaInicioBobinaPapel(**fila, Atrasada=semana.pausa_atrasada(fila["FechaHoraPausa"]))
                for fila in self.bobina_papel.PausasAbiertas()
            ],
        )
        bobina_servilleta = ProduccionBobinaServilletaNotificaciones(
            Activas=[
                ProduccionActivaInicioBobinaServilleta(
                    **fila, Atrasada=semana.produccion_atrasada(fila["FechaInicioProduccion"])
                )
                for fila in self.bobina_servilleta.Activas()
            ],
            Pausadas=[
                PausaAbiertaInicioBobinaServilleta(
                    **fila, Atrasada=semana.pausa_atrasada(fila["FechaHoraPausa"])
                )
                for fila in self.bobina_servilleta.PausasAbiertas()
            ],
        )
        stock = self._Stock() if id_rol == ROL_LIDER_INVENTARIO_PRODUCCION else None

        producciones = [
            *bobina_papel.Activas,
            *bobina_papel.Pausadas,
            *bobina_servilleta.Activas,
            *bobina_servilleta.Pausadas,
        ]
        total_stock = len(stock.SinStock) + len(stock.Criticos) if stock else 0

        return NotificacionesResponse(
            Stock=stock,
            BobinaPapel=bobina_papel,
            BobinaServilleta=bobina_servilleta,
            HorasAlertaPausa=HORAS_ALERTA_PAUSA_ABIERTA,
            Atrasadas=sum(1 for produccion in producciones if produccion.Atrasada),
            Total=total_stock + len(producciones),
        )
