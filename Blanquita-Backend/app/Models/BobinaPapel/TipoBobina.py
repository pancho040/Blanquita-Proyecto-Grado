from decimal import Decimal

from pydantic import BaseModel, Field

from app.Constants.Cantidades import (
    DIAMETRO_MAXIMO_BOBINA_MM,
    FORMATO_MAXIMO_BOBINA_MM,
    TARA_MAXIMA_BOBINA_KG,
)
from app.Models.AlertaStock.AlertaStock import NivelStockResponse
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CampoNombreTipo,
    DatosTipoRequest,
    ProductoAsociado,
)


class TipoBobinaAdminItem(NivelStockResponse):
    IdTipoBobina: int
    NombreTipoBobina: str
    DiametroMm: Decimal
    Formato: Decimal
    TaraKg: Decimal
    Descripcion: str | None = None
    Activo: bool
    CantidadBobinas: int
    Productos: list[ProductoAsociado]


class DatosTipoBobinaRequest(DatosTipoRequest):
    DiametroMm: Decimal = Field(..., gt=0, le=DIAMETRO_MAXIMO_BOBINA_MM)
    Formato: Decimal = Field(..., gt=0, le=FORMATO_MAXIMO_BOBINA_MM)
    TaraKg: Decimal = Field(..., gt=0, le=TARA_MAXIMA_BOBINA_KG)
    IdsProducto: list[int] = Field(default_factory=list)


class CrearTipoBobinaRequest(DatosTipoBobinaRequest):
    NombreTipoBobina: str = CampoNombreTipo()


class EditarTipoBobinaRequest(DatosTipoBobinaRequest):
    IdTipoBobina: int = Field(..., gt=0)
