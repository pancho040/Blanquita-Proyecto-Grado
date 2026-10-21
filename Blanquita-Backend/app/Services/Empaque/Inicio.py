from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.Constants.AlertaStock import (
    DOMINIO_STOCK_BOLSA_JAVA,
    DOMINIO_STOCK_EMPAQUE_BOBINA,
    DOMINIO_STOCK_EMPAQUE_BOLSA,
    NIVELES_STOCK_ALERTA,
)
from app.Constants.Cantidades import MINUTOS_REINGRESO_EMPAQUE_BOBINA, MOVIMIENTOS_RECIENTES_INICIO
from app.Constants.Estados import (
    MOVIMIENTO_MATERIA_PRIMA_DEVOLUCION,
    MOVIMIENTO_MATERIA_PRIMA_INGRESO,
    MOVIMIENTO_MATERIA_PRIMA_REINGRESO,
    MOVIMIENTO_MATERIA_PRIMA_TRASLADO,
)
from app.Models.Empaque.EmpaqueBobina import EmpaqueReingresableResponse
from app.Models.Empaque.Inicio import (
    IndicadoresSemanaEmpaque,
    InicioEmpaqueResponse,
    MovimientoDiaEmpaque,
    MovimientoRecienteEmpaque,
    MovimientoTipoEmpaque,
    StockTipoEmpaque,
    UltimoLoteInicioEmpaque,
)
from app.Models.Empaque.Reporte import ClaseEmpaque
from app.Repository.AlertaStock.AlertaStock import AlertaStockRepository
from app.Repository.Consultas import ZONA_HORARIA
from app.Repository.Empaque.EmpaqueBobina import EmpaqueBobinaRepository
from app.Repository.Empaque.Inicio import InicioEmpaqueRepository
from app.Repository.Empaque.Reporte import ReporteEmpaqueRepository
from app.utils.inicio import semana_inicio

DOMINIO_POR_CLASE = {
    ClaseEmpaque.bobina: DOMINIO_STOCK_EMPAQUE_BOBINA,
    ClaseEmpaque.bolsa: DOMINIO_STOCK_EMPAQUE_BOLSA,
    ClaseEmpaque.jaba: DOMINIO_STOCK_BOLSA_JAVA,
}

MOVIMIENTOS_REINGRESO = (MOVIMIENTO_MATERIA_PRIMA_DEVOLUCION, MOVIMIENTO_MATERIA_PRIMA_REINGRESO)

NOMBRE_SALIDA_CONTEO = "Salida"


def _total(filas: list[dict], *tipos: int) -> int:
    return sum(int(fila["Cantidad"] or 0) for fila in filas if fila["IdTipoMovimiento"] in tipos)


def _tipos(filas: list[dict]) -> list[MovimientoTipoEmpaque]:
    tipos: dict[int, dict] = {}
    for fila in filas:
        if fila["IdTipoMovimiento"] == MOVIMIENTO_MATERIA_PRIMA_INGRESO:
            campo = "Ingresos"
        elif fila["IdTipoMovimiento"] == MOVIMIENTO_MATERIA_PRIMA_TRASLADO:
            campo = "Salidas"
        else:
            continue
        tipo = tipos.setdefault(
            fila["IdTipo"],
            {"IdTipo": fila["IdTipo"], "NombreTipo": fila["NombreTipo"], "Ingresos": 0, "Salidas": 0},
        )
        tipo[campo] += int(fila["Cantidad"] or 0)
    return sorted(
        (MovimientoTipoEmpaque(**tipo) for tipo in tipos.values()),
        key=lambda tipo: (-tipo.Salidas, -tipo.Ingresos, tipo.NombreTipo),
    )


class InicioEmpaqueService:
    def __init__(self, db: Session):
        self.repository = InicioEmpaqueRepository(db)
        self.reporte = ReporteEmpaqueRepository(db)
        self.alertas = AlertaStockRepository(db)
        self.bobina = EmpaqueBobinaRepository(db)

    def _movimientos(self, clase: ClaseEmpaque, fecha_inicio, fecha_fin) -> list[dict]:
        return self.reporte.Movimientos(clase, {"p_FechaInicio": fecha_inicio, "p_FechaFin": fecha_fin})

    def _reciente(self, clase: ClaseEmpaque, fila: dict) -> MovimientoRecienteEmpaque:
        nombre = fila["NombreMovimiento"]
        if clase != ClaseEmpaque.bobina and fila["IdTipoMovimiento"] == MOVIMIENTO_MATERIA_PRIMA_TRASLADO:
            nombre = NOMBRE_SALIDA_CONTEO
        return MovimientoRecienteEmpaque(
            IdMovimiento=fila["IdMovimiento"],
            NombreTipo=fila["NombreTipo"],
            IdTipoMovimiento=fila["IdTipoMovimiento"],
            NombreMovimiento=nombre,
            Cantidad=int(fila["Cantidad"] or 0),
            CodigoEmpaque=fila["CodigoEmpaque"],
            Usuario=f"{fila['PrimerNombre']} {fila['ApellidoPaterno']}",
            FechaMovimiento=fila["FechaMovimiento"],
            Observacion=fila["Observacion"],
        )

    def VerInicio(self, clase: ClaseEmpaque) -> InicioEmpaqueResponse:
        semana = semana_inicio()
        zona = ZoneInfo(ZONA_HORARIA)

        movimientos = self._movimientos(clase, semana.lunes, semana.hoy)
        anteriores = self._movimientos(clase, semana.lunes_anterior, semana.hoy_anterior)

        stock = [
            StockTipoEmpaque(
                IdTipo=fila["Id"],
                NombreTipo=fila["Nombre"],
                Activo=fila["Activo"],
                CantidadActual=int(fila["CantidadActual"] or 0),
                StockMinimo=fila["StockMinimo"],
                StockPreventivo=fila["StockPreventivo"],
                NivelStock=fila["NivelStock"],
            )
            for fila in self.alertas.ListarStock(DOMINIO_POR_CLASE[clase], solo_visibles=True)
        ]

        indicadores = IndicadoresSemanaEmpaque(
            Ingresos=_total(movimientos, MOVIMIENTO_MATERIA_PRIMA_INGRESO),
            IngresosSemanaAnterior=_total(anteriores, MOVIMIENTO_MATERIA_PRIMA_INGRESO),
            Salidas=_total(movimientos, MOVIMIENTO_MATERIA_PRIMA_TRASLADO),
            SalidasSemanaAnterior=_total(anteriores, MOVIMIENTO_MATERIA_PRIMA_TRASLADO),
            Reingresos=_total(movimientos, *MOVIMIENTOS_REINGRESO),
            ReingresosSemanaAnterior=_total(anteriores, *MOVIMIENTOS_REINGRESO),
            StockTotal=sum(tipo.CantidadActual for tipo in stock if tipo.Activo),
            TiposEnAlerta=sum(1 for tipo in stock if tipo.Activo and tipo.NivelStock in NIVELES_STOCK_ALERTA),
        )

        dias = []
        for fecha in semana.dias():
            del_dia = [fila for fila in movimientos if fila["FechaMovimiento"].astimezone(zona).date() == fecha]
            dias.append(
                MovimientoDiaEmpaque(
                    Fecha=fecha,
                    Ingresos=_total(del_dia, MOVIMIENTO_MATERIA_PRIMA_INGRESO),
                    Salidas=_total(del_dia, MOVIMIENTO_MATERIA_PRIMA_TRASLADO),
                    Tipos=_tipos(del_dia),
                )
            )

        es_bobina = clase == ClaseEmpaque.bobina
        ultimo_lote = self.repository.UltimoLote(clase)

        return InicioEmpaqueResponse(
            Clase=clase,
            FechaInicio=semana.lunes,
            FechaFin=semana.hoy,
            MinutosReingreso=MINUTOS_REINGRESO_EMPAQUE_BOBINA if es_bobina else None,
            Indicadores=indicadores,
            Dias=dias,
            Tipos=_tipos(movimientos),
            Stock=stock,
            Reingresables=(
                [EmpaqueReingresableResponse(**fila) for fila in self.bobina.ListarEmpaquesReingresables()]
                if es_bobina
                else []
            ),
            UltimosMovimientos=[
                self._reciente(clase, fila) for fila in movimientos[:MOVIMIENTOS_RECIENTES_INICIO]
            ],
            UltimoLote=UltimoLoteInicioEmpaque(**ultimo_lote) if ultimo_lote else None,
        )
