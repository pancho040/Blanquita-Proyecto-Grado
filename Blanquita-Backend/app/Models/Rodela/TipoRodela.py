from pydantic import Field

from app.Models.AlertaStock.AlertaStock import NivelStockResponse
from app.Models.MateriaPrima.TipoMateriaPrima import CampoNombreTipo, DatosTipoRequest


class TipoRodelaAdminItem(NivelStockResponse):
    IdTipoRodela: int
    NombreTipoRodela: str
    Descripcion: str | None = None
    Activo: bool
    CantidadEnAlmacen: int


class CrearTipoRodelaRequest(DatosTipoRequest):
    NombreTipoRodela: str = CampoNombreTipo()


class EditarTipoRodelaRequest(DatosTipoRequest):
    IdTipoRodela: int = Field(..., gt=0)
