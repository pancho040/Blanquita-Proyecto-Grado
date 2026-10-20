from sqlalchemy import select
from sqlalchemy.orm import Session

from app.Repository.MateriaPrima.TipoMateriaPrima import TipoMateriaPrimaRepository
from app.Schemas.BobinaPapel import TipoBobina


class TipoBobinaRepository(TipoMateriaPrimaRepository):
    def __init__(self, db: Session):
        super().__init__(db, TipoBobina, TipoBobina.IdTipoBobina, TipoBobina.NombreTipoBobina)

    def ListarTipos(self, id_tipo: int | None = None) -> list[dict]:
        consulta = select(
            TipoBobina.IdTipoBobina,
            TipoBobina.NombreTipoBobina,
            TipoBobina.DiametroMm,
            TipoBobina.Formato,
            TipoBobina.TaraKg,
            TipoBobina.Descripcion,
            TipoBobina.Activo,
            TipoBobina.StockMinimo,
            TipoBobina.StockPreventivo,
        ).order_by(TipoBobina.IdTipoBobina)
        if id_tipo is not None:
            consulta = consulta.where(TipoBobina.IdTipoBobina == id_tipo)
        return self.caller.Consultar(consulta)
