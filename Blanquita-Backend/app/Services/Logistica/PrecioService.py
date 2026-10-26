from sqlalchemy.orm import Session
from app.Repository.Logistica.PrecioRepository import PrecioRepository
from app.Models.Logistica.PrecioModel import PrecioProductoCrear

class PrecioService:
    def __init__(self, db: Session):
        self.repo = PrecioRepository(db)

    def ListarPreciosVigentes(self) -> list[dict]:
        return self.repo.ListarPreciosVigentes()

    def GuardarPrecio(self, dto: PrecioProductoCrear, id_usuario: int | None = None) -> dict:
        return self.repo.GuardarPrecio(dto.model_dump(), id_usuario)

    def ListarHistorialPrecios(self, id_presentacion: int) -> list[dict]:
        return self.repo.ListarHistorialPrecios(id_presentacion)
