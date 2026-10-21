from pydantic import BaseModel, Field


class NivelStockResponse(BaseModel):
    StockMinimo: int | None = None
    StockPreventivo: int | None = None
    NivelStock: str | None = None


class UmbralStockItem(NivelStockResponse):
    Dominio: str
    NombreDominio: str
    Id: int
    Nombre: str
    CantidadActual: int
    Activo: bool


class ResumenAlertaStockResponse(BaseModel):
    Criticos: int
    Bajos: int
    Total: int
    Alertas: list[UmbralStockItem]


class EditarUmbralStockRequest(BaseModel):
    Dominio: str
    Id: int = Field(..., gt=0)
    StockMinimo: int | None = Field(default=None, ge=0)
    StockPreventivo: int | None = Field(default=None, ge=0)
