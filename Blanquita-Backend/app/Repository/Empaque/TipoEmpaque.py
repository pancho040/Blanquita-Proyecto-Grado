from fastapi import HTTPException, status
from sqlalchemy import literal, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.Constants.AlertaStock import (
    DOMINIO_STOCK_BOLSA_JAVA,
    DOMINIO_STOCK_EMPAQUE_BOBINA,
    DOMINIO_STOCK_EMPAQUE_BOLSA,
)
from app.Models.Empaque.Reporte import ClaseEmpaque
from app.Repository.AlertaStock.AlertaStock import AlertaStockRepository
from app.Repository.MateriaPrima.TipoMateriaPrima import TipoMateriaPrimaRepository
from app.Schemas.Empaque import (
    InventarioBolsaJava,
    InventarioEmpaqueBolsa,
    TipoBolsaJava,
    TipoEmpaque,
    TipoEmpaqueBolsa,
)

CLASES_TIPO_EMPAQUE = {
    ClaseEmpaque.bobina: {
        "modelo": TipoEmpaque,
        "id": TipoEmpaque.IdTipoEmpaque,
        "nombre": TipoEmpaque.NombreTipoEmpaque,
        "descripcion": None,
        "inventario": None,
        "fk_inventario": None,
        "dominio": DOMINIO_STOCK_EMPAQUE_BOBINA,
    },
    ClaseEmpaque.bolsa: {
        "modelo": TipoEmpaqueBolsa,
        "id": TipoEmpaqueBolsa.IdTipoEmpaqueBolsa,
        "nombre": TipoEmpaqueBolsa.NombreEmpaqueBolsa,
        "descripcion": TipoEmpaqueBolsa.DescripcionEmpaqueBolsa,
        "inventario": InventarioEmpaqueBolsa,
        "fk_inventario": InventarioEmpaqueBolsa.IdTipoEmpaqueBolsa,
        "dominio": DOMINIO_STOCK_EMPAQUE_BOLSA,
    },
    ClaseEmpaque.jaba: {
        "modelo": TipoBolsaJava,
        "id": TipoBolsaJava.IdTipoBolsaJava,
        "nombre": TipoBolsaJava.NombreBolsaJava,
        "descripcion": TipoBolsaJava.DescripcionBolsaJava,
        "inventario": InventarioBolsaJava,
        "fk_inventario": InventarioBolsaJava.IdTipoBolsaJava,
        "dominio": DOMINIO_STOCK_BOLSA_JAVA,
    },
}


class TipoEmpaqueRepository(TipoMateriaPrimaRepository):
    def __init__(self, db: Session, clase: ClaseEmpaque):
        self.clase = CLASES_TIPO_EMPAQUE[clase]
        super().__init__(db, self.clase["modelo"], self.clase["id"], self.clase["nombre"])
        self.stock = AlertaStockRepository(db)

    def ListarTipos(self, id_tipo: int | None = None) -> list[dict]:
        descripcion = self.clase["descripcion"]
        consulta = select(
            self.columna_id.label("Id"),
            self.columna_nombre.label("Nombre"),
            (descripcion if descripcion is not None else literal(None)).label("Descripcion"),
            self.modelo.Activo,
        ).order_by(self.columna_nombre)
        if id_tipo is not None:
            consulta = consulta.where(self.columna_id == id_tipo)
        tipos = self.caller.Consultar(consulta)

        stock = {fila["Id"]: fila for fila in self.stock.ListarStock(dominio=self.clase["dominio"])}
        return [
            {
                **tipo,
                "CantidadActual": stock.get(tipo["Id"], {}).get("CantidadActual", 0),
                "StockMinimo": stock.get(tipo["Id"], {}).get("StockMinimo"),
                "StockPreventivo": stock.get(tipo["Id"], {}).get("StockPreventivo"),
                "NivelStock": stock.get(tipo["Id"], {}).get("NivelStock"),
            }
            for tipo in tipos
        ]

    def ObtenerInventarioBloqueado(self, id_tipo: int):
        if self.clase["inventario"] is None:
            return None
        try:
            return (
                self.db.execute(
                    select(self.clase["inventario"])
                    .where(self.clase["fk_inventario"] == id_tipo)
                    .limit(1)
                    .with_for_update()
                )
                .scalars()
                .first()
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener el inventario del empaque",
            )

    def NuevoInventario(self, id_tipo: int, stock_minimo: int | None, stock_preventivo: int | None):
        return self.clase["inventario"](
            **{
                self.clase["fk_inventario"].key: id_tipo,
                "CantidadActual": 0,
                "StockMinimo": stock_minimo,
                "StockPreventivo": stock_preventivo,
            }
        )
