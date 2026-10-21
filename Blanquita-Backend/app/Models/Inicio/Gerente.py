from datetime import date
from enum import Enum

from pydantic import BaseModel

from app.Models.AlertaStock.AlertaStock import UmbralStockItem
from app.Models.Inicio.Inicio import MotivoPausaInicio
from app.Models.InventarioFinal.Inicio import (
    AlertasStockInicio,
    DespachoInicio,
    LineaSemanaInicio,
    LineaStockInicio,
)
from app.Models.Notificacion.Notificacion import (
    ProduccionBobinaPapelNotificaciones,
    ProduccionBobinaServilletaNotificaciones,
)


class PeriodoInicio(str, Enum):
    semana = "semana"
    mes = "mes"


class TramoInicioGerente(BaseModel):
    FechaInicio: date
    FechaFin: date
    Unidades: int
    Contenedores: int
    Lineas: list[LineaSemanaInicio]


class PlantaInicioGerente(BaseModel):
    BobinaPapel: ProduccionBobinaPapelNotificaciones
    BobinaServilleta: ProduccionBobinaServilletaNotificaciones
    HorasAlertaPausa: int


class StockInicioGerente(BaseModel):
    UnidadesTotales: int
    Alertas: AlertasStockInicio
    Lineas: list[LineaStockInicio]


class ProduccionInicioGerente(BaseModel):
    Unidades: int
    Contenedores: int
    Ingresos: int
    DiasConProduccion: int
    Lineas: list[LineaSemanaInicio]
    Tramos: list[TramoInicioGerente]


class SalidasInicioGerente(BaseModel):
    Despachos: int
    Unidades: int
    Contenedores: int
    Lineas: list[LineaSemanaInicio]
    Tramos: list[TramoInicioGerente]
    UltimosDespachos: list[DespachoInicio]


class PausasAreaInicioGerente(BaseModel):
    Pausas: int
    Segundos: int
    Motivos: list[MotivoPausaInicio]


class PausasInicioGerente(BaseModel):
    BobinaPapel: PausasAreaInicioGerente
    BobinaServilleta: PausasAreaInicioGerente


class MateriaPrimaInicioGerente(BaseModel):
    Dominio: str
    NombreDominio: str
    Cantidad: int
    Alertas: int
    Criticas: int
    Items: list[UmbralStockItem]


class InicioGerenteResponse(BaseModel):
    Periodo: PeriodoInicio
    FechaInicio: date
    FechaFin: date
    Planta: PlantaInicioGerente
    Stock: StockInicioGerente
    Produccion: ProduccionInicioGerente
    Salidas: SalidasInicioGerente
    Pausas: PausasInicioGerente
    MateriaPrima: list[MateriaPrimaInicioGerente]
