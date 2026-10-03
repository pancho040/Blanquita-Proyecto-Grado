from sqlalchemy.orm import Session
from app.Repository.Logistica.PrecioRepository import PrecioRepository
from app.Models.Logistica.PrecioModel import PrecioProductoCrear

class PrecioService:
    def __init__(self, db: Session):
        self.repo = PrecioRepository(db)

    def ListarPreciosVigentes(self) -> list[dict]:
        return self.repo.ListarPreciosVigentes()

    def GuardarPrecio(self, dto: PrecioProductoCrear) -> dict:
        return self.repo.GuardarPrecio(dto.model_dump())
