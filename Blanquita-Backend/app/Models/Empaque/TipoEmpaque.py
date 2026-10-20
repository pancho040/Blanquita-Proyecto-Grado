from pydantic import Field

from app.Models.AlertaStock.AlertaStock import NivelStockResponse
from app.Models.MateriaPrima.TipoMateriaPrima import CampoNombreTipo, DatosTipoRequest


class TipoEmpaqueAdminItem(NivelStockResponse):
    Id: int
    Nombre: str
    Descripcion: str | None = None
    Activo: bool
    CantidadActual: int


class CrearTipoEmpaqueRequest(DatosTipoRequest):
    Nombre: str = CampoNombreTipo()


class EditarTipoEmpaqueRequest(DatosTipoRequest):
    Id: int = Field(..., gt=0)
