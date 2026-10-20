from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Cantidades import DIAS_MAXIMOS_REPORTE_PRODUCCION
from app.Models.Empaque.Reporte import (
    ClaseEmpaque,
    InventarioTipoEmpaqueResponse,
    ItemLoteEmpaqueResponse,
    LoteEmpaqueReporteResponse,
    MovimientoEmpaqueReporteResponse,
    ReporteEmpaqueRequest,
    ReporteInventarioEmpaqueResponse,
    ReporteLotesEmpaqueResponse,
    ReporteMovimientosEmpaqueResponse,
    ResumenLotesTipoEmpaqueResponse,
    ResumenTipoEmpaqueResponse,
    UnidadEmpaqueInventarioResponse,
)
from app.Repository.Empaque.Reporte import ReporteEmpaqueRepository
from app.utils.dates import ZONA_BOLIVIA

ID_TIPO_MOVIMIENTO_INGRESO = 1
ID_TIPO_MOVIMIENTO_SALIDA = 2
ID_TIPO_MOVIMIENTO_REINGRESO = 6
TIPOS_MOVIMIENTO_ENTRADA = {ID_TIPO_MOVIMIENTO_INGRESO, ID_TIPO_MOVIMIENTO_REINGRESO}

CLASES = {
    ClaseEmpaque.bobina: {"nombre": "Empaque en bobina", "unidad": "bobinas"},
    ClaseEmpaque.bolsa: {"nombre": "Empaque en bolsa", "unidad": "paquetes"},
    ClaseEmpaque.jaba: {"nombre": "Bolsas de jaba", "unidad": "paquetes"},
}

NOMBRES_MOVIMIENTO_CONTEO = {
    ID_TIPO_MOVIMIENTO_INGRESO: "Ingreso",
    ID_TIPO_MOVIMIENTO_SALIDA: "Salida",
    ID_TIPO_MOVIMIENTO_REINGRESO: "Reingreso",
}


class ReporteEmpaqueService:
    def __init__(self, db: Session):
        self.repository = ReporteEmpaqueRepository(db)

    def ReporteInventario(self, clase: ClaseEmpaque) -> ReporteInventarioEmpaqueResponse:
        tipos = self.repository.Inventario(clase)

        if not tipos:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No hay tipos de {CLASES[clase]['nombre'].lower()} registrados",
            )

        unidades = (
            self.repository.UnidadesBobinaEnAlmacen() if clase == ClaseEmpaque.bobina else []
        )

        return ReporteInventarioEmpaqueResponse(
            Clase=clase,
            NombreClase=CLASES[clase]["nombre"],
            Unidad=CLASES[clase]["unidad"],
            FechaGeneracion=datetime.now(ZONA_BOLIVIA),
            Tipos=[InventarioTipoEmpaqueResponse(**fila) for fila in tipos],
            Unidades=[UnidadEmpaqueInventarioResponse(**fila) for fila in unidades],
        )

    def ResumenMovimientos(self, data: ReporteEmpaqueRequest) -> ReporteMovimientosEmpaqueResponse:
        todos_los_tipos = self._ValidarFiltros(data)
        ids_tipo = data.IdsTipo or None

        movimientos = [
            self._Movimiento(data.Clase, fila)
            for fila in self.repository.Movimientos(
                data.Clase,
                {
                    "p_FechaInicio": data.FechaInicio,
                    "p_FechaFin": data.FechaFin,
                    "p_IdsTipo": ids_tipo,
                    "p_IdTipoMovimiento": data.IdTipoMovimiento,
                },
            )
        ]

        stock = self.repository.StockActual(data.Clase, ids_tipo)

        return ReporteMovimientosEmpaqueResponse(
            Clase=data.Clase,
            NombreClase=CLASES[data.Clase]["nombre"],
            Unidad=CLASES[data.Clase]["unidad"],
            PeriodoInicio=data.FechaInicio,
            PeriodoFin=data.FechaFin,
            TodosLosTipos=todos_los_tipos,
            NombreMovimientoFiltro=self._NombreMovimientoFiltro(data, movimientos),
            Resumen=[self._ResumenTipo(fila, movimientos) for fila in stock],
            Movimientos=movimientos,
        )

    def ReporteMovimientos(self, data: ReporteEmpaqueRequest) -> ReporteMovimientosEmpaqueResponse:
        resumen = self.ResumenMovimientos(data)

        if not resumen.Movimientos:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No se registraron movimientos de {CLASES[data.Clase]['nombre'].lower()} en el período y los tipos seleccionados",
            )

        return resumen

    def ResumenLotes(self, data: ReporteEmpaqueRequest) -> ReporteLotesEmpaqueResponse:
        todos_los_tipos = self._ValidarFiltros(data)

        filas = self.repository.Movimientos(
            data.Clase,
            {
                "p_FechaInicio": data.FechaInicio,
                "p_FechaFin": data.FechaFin,
                "p_IdsTipo": data.IdsTipo or None,
                "p_IdTipoMovimiento": ID_TIPO_MOVIMIENTO_INGRESO,
                "p_SoloLotes": True,
            },
        )

        lotes = self._AgruparLotes(data.Clase, filas)

        return ReporteLotesEmpaqueResponse(
            Clase=data.Clase,
            NombreClase=CLASES[data.Clase]["nombre"],
            Unidad=CLASES[data.Clase]["unidad"],
            PeriodoInicio=data.FechaInicio,
            PeriodoFin=data.FechaFin,
            TodosLosTipos=todos_los_tipos,
            Resumen=self._ResumenLotes(data.Clase, lotes),
            Lotes=lotes,
        )

    def ReporteLotes(self, data: ReporteEmpaqueRequest) -> ReporteLotesEmpaqueResponse:
        resumen = self.ResumenLotes(data)

        if not resumen.Lotes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No se registraron lotes de {CLASES[data.Clase]['nombre'].lower()} en el período y los tipos seleccionados",
            )

        return resumen

    def _Movimiento(self, clase: ClaseEmpaque, fila: dict) -> MovimientoEmpaqueReporteResponse:
        if clase != ClaseEmpaque.bobina:
            fila = {
                **fila,
                "NombreMovimiento": NOMBRES_MOVIMIENTO_CONTEO.get(
                    fila["IdTipoMovimiento"], fila["NombreMovimiento"]
                ),
            }
        return MovimientoEmpaqueReporteResponse(**fila)

    def _NombreMovimientoFiltro(
        self, data: ReporteEmpaqueRequest, movimientos: list[MovimientoEmpaqueReporteResponse]
    ) -> str | None:
        if data.IdTipoMovimiento is None:
            return None
        if movimientos:
            return movimientos[0].NombreMovimiento
        if data.Clase != ClaseEmpaque.bobina:
            return NOMBRES_MOVIMIENTO_CONTEO.get(data.IdTipoMovimiento)
        return None

    def _ResumenTipo(
        self, fila: dict, movimientos: list[MovimientoEmpaqueReporteResponse]
    ) -> ResumenTipoEmpaqueResponse:
        propios = [m for m in movimientos if m.IdTipo == fila["IdTipo"]]
        ingresos = sum(m.Cantidad for m in propios if m.IdTipoMovimiento in TIPOS_MOVIMIENTO_ENTRADA)
        salidas = sum(m.Cantidad for m in propios if m.IdTipoMovimiento == ID_TIPO_MOVIMIENTO_SALIDA)

        return ResumenTipoEmpaqueResponse(
            IdTipo=fila["IdTipo"],
            NombreTipo=fila["NombreTipo"],
            Ingresos=ingresos,
            Salidas=salidas,
            Neto=ingresos - salidas,
            NumeroMovimientos=len(propios),
            CantidadActual=fila["CantidadActual"],
        )

    def _AgruparLotes(self, clase: ClaseEmpaque, filas: list[dict]) -> list[LoteEmpaqueReporteResponse]:
        con_peso = clase == ClaseEmpaque.bobina
        lotes: dict[int, dict] = {}

        for fila in filas:
            lote = lotes.setdefault(
                fila["IdLoteEmpaque"],
                {
                    "IdLoteEmpaque": fila["IdLoteEmpaque"],
                    "FechaRecepcion": fila["FechaRecepcion"],
                    "NombreProveedor": fila["NombreProveedor"],
                    "CantidadToneladasPedida": fila["CantidadToneladasPedida"],
                    "FechaRegistro": fila["FechaMovimiento"],
                    "Ci": fila["Ci"],
                    "PrimerNombre": fila["PrimerNombre"],
                    "ApellidoPaterno": fila["ApellidoPaterno"],
                    "NombreRol": fila["NombreRol"],
                    "Items": {},
                },
            )

            if fila["FechaMovimiento"] < lote["FechaRegistro"]:
                lote["FechaRegistro"] = fila["FechaMovimiento"]

            item = lote["Items"].setdefault(
                fila["IdTipo"],
                {
                    "IdTipo": fila["IdTipo"],
                    "NombreTipo": fila["NombreTipo"],
                    "Cantidad": 0,
                    "PesoKg": Decimal("0") if con_peso else None,
                    "Codigos": [],
                },
            )
            item["Cantidad"] += int(fila["Cantidad"])
            if con_peso:
                item["PesoKg"] += fila["PesoKg"] or Decimal("0")
                item["Codigos"].append(fila["CodigoEmpaque"])

        resultado = []
        for lote in lotes.values():
            items = [
                ItemLoteEmpaqueResponse(**{**item, "Codigos": sorted(item["Codigos"])})
                for item in sorted(lote["Items"].values(), key=lambda i: i["NombreTipo"])
            ]
            resultado.append(
                LoteEmpaqueReporteResponse(
                    **{k: v for k, v in lote.items() if k != "Items"},
                    CantidadTotal=sum(i.Cantidad for i in items),
                    PesoTotalKg=sum((i.PesoKg for i in items), Decimal("0")) if con_peso else None,
                    Items=items,
                )
            )

        return sorted(resultado, key=lambda l: (l.FechaRegistro, l.IdLoteEmpaque), reverse=True)

    def _ResumenLotes(
        self, clase: ClaseEmpaque, lotes: list[LoteEmpaqueReporteResponse]
    ) -> list[ResumenLotesTipoEmpaqueResponse]:
        con_peso = clase == ClaseEmpaque.bobina
        resumen: dict[int, dict] = {}

        for lote in lotes:
            for item in lote.Items:
                fila = resumen.setdefault(
                    item.IdTipo,
                    {
                        "IdTipo": item.IdTipo,
                        "NombreTipo": item.NombreTipo,
                        "NumeroLotes": 0,
                        "Cantidad": 0,
                        "PesoKg": Decimal("0") if con_peso else None,
                    },
                )
                fila["NumeroLotes"] += 1
                fila["Cantidad"] += item.Cantidad
                if con_peso:
                    fila["PesoKg"] += item.PesoKg or Decimal("0")

        return [
            ResumenLotesTipoEmpaqueResponse(**fila)
            for fila in sorted(resumen.values(), key=lambda f: f["NombreTipo"])
        ]

    def _ValidarFiltros(self, data: ReporteEmpaqueRequest) -> bool:
        if data.FechaInicio > data.FechaFin:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="La fecha de inicio no puede ser posterior a la fecha de fin",
            )

        dias_periodo = (data.FechaFin - data.FechaInicio).days + 1
        if dias_periodo > DIAS_MAXIMOS_REPORTE_PRODUCCION:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El rango de fechas no puede superar los {DIAS_MAXIMOS_REPORTE_PRODUCCION} días",
            )

        tipos = {t["IdTipo"] for t in self.repository.ObtenerTipos(data.Clase)}
        ids_solicitados = set(data.IdsTipo or [])

        if ids_solicitados - tipos:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Uno o más tipos de empaque seleccionados no existen",
            )

        return not ids_solicitados or ids_solicitados == tipos
