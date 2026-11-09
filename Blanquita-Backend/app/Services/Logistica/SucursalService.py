from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.Repository.Logistica.SucursalRepository import SucursalRepository
from app.Models.Logistica.SucursalModel import SucursalCrear, SucursalUpdate


class SucursalService:
    def __init__(self, db: Session):
        self.repo = SucursalRepository(db)

    def listar_sucursales(self, solo_activas: bool = False) -> List[Dict[str, Any]]:
        return self.repo.listar_sucursales(solo_activas)

    def obtener_sucursal(self, id_sucursal: int) -> Optional[Dict[str, Any]]:
        return self.repo.obtener_sucursal(id_sucursal)

    def crear_sucursal(self, dto: SucursalCrear) -> Dict[str, Any]:
        return self.repo.crear_sucursal(dto.model_dump())

    def actualizar_sucursal(self, id_sucursal: int, dto: SucursalUpdate) -> Optional[Dict[str, Any]]:
        return self.repo.actualizar_sucursal(id_sucursal, dto.model_dump(exclude_unset=True))

    def listar_plantas(self) -> List[Dict[str, Any]]:
        return self.repo.listar_plantas()
