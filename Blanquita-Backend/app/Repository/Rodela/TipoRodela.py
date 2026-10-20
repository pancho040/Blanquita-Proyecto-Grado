from sqlalchemy import select
from sqlalchemy.orm import Session

from app.Repository.MateriaPrima.TipoMateriaPrima import TipoMateriaPrimaRepository
from app.Schemas.Rodela import TipoRodela


class TipoRodelaRepository(TipoMateriaPrimaRepository):
    def __init__(self, db: Session):
        super().__init__(db, TipoRodela, TipoRodela.IdTipoRodela, TipoRodela.NombreTipoRodela)

    def ListarTipos(self, id_tipo: int | None = None) -> list[dict]:
        consulta = select(
            TipoRodela.IdTipoRodela,
            TipoRodela.NombreTipoRodela,
            TipoRodela.Descripcion,
            TipoRodela.Activo,
            TipoRodela.StockMinimo,
            TipoRodela.StockPreventivo,
        ).order_by(TipoRodela.IdTipoRodela)
        if id_tipo is not None:
            consulta = consulta.where(TipoRodela.IdTipoRodela == id_tipo)
        return self.caller.Consultar(consulta)
