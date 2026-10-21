from decimal import Decimal

from pydantic import Field

from app.Constants.Cantidades import (
    CANTIDAD_MAXIMA_UNIDADES_BOBINA_SERVILLETA,
    DIAMETRO_MAXIMO_BOBINA_MM,
    RESISTENCIA_MAXIMA_BOBINA_KGF,
)
from app.Models.AlertaStock.AlertaStock import NivelStockResponse
from app.Models.BobinaServilleta.BobinaServilleta import FormatoSubBobinaResponse
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CampoNombreTipo,
    DatosTipoRequest,
    ProductoAsociado,
)


class TipoBobinaServilletaAdminItem(NivelStockResponse):
    IdTipoBobinaServilleta: int
    NombreTipoBobinaServilleta: str
    DiametroMm: Decimal
    CrepadoPorcentaje: Decimal
    ResistenciaKgf: Decimal
    Descripcion: str | None = None
    CantidadUnidades: int
    Activo: bool
    CantidadBobinas: int
    Formatos: list[FormatoSubBobinaResponse]
    Productos: list[ProductoAsociado]


class DatosTipoBobinaServilletaRequest(DatosTipoRequest):
    DiametroMm: Decimal = Field(..., gt=0, le=DIAMETRO_MAXIMO_BOBINA_MM)
    CrepadoPorcentaje: Decimal = Field(..., ge=0, le=100)
    ResistenciaKgf: Decimal = Field(..., gt=0, le=RESISTENCIA_MAXIMA_BOBINA_KGF)
    CantidadUnidades: int = Field(..., ge=1, le=CANTIDAD_MAXIMA_UNIDADES_BOBINA_SERVILLETA)
    IdsFormato: list[int] = Field(..., min_length=1)
    IdsProducto: list[int] = Field(default_factory=list)


class CrearTipoBobinaServilletaRequest(DatosTipoBobinaServilletaRequest):
    NombreTipoBobinaServilleta: str = CampoNombreTipo()


class EditarTipoBobinaServilletaRequest(DatosTipoBobinaServilletaRequest):
    IdTipoBobinaServilleta: int = Field(..., gt=0)
