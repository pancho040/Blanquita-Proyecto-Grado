from typing import List, Dict, Any, Optional
from decimal import Decimal
from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Repository.Logistica.InventarioComercialRepository import InventarioComercialRepository
from app.Models.Logistica.InventarioComercialModel import CargaChoferDTO


class InventarioComercialService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = InventarioComercialRepository(db)

    def listar_inventario_sucursal(self, sucursal_id: int) -> List[Dict[str, Any]]:
        return self.repo.listar_inventario_sucursal(sucursal_id)

    def listar_inventario_chofer(self, chofer_id: int) -> List[Dict[str, Any]]:
        return self.repo.listar_inventario_chofer(chofer_id)

    def cargar_stock_chofer(self, dto: CargaChoferDTO) -> List[Dict[str, Any]]:
        resultados = []
        try:
            for item in dto.items:
                if item.cantidad <= 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="La cantidad a cargar en camión debe ser mayor a 0."
                    )
                res = self.repo.cargar_stock_chofer(
                    chofer_id=dto.chofer_id,
                    sucursal_id=dto.sucursal_id,
                    presentacion_id=item.presentacion_id,
                    cantidad=item.cantidad
                )
                resultados.append(res)
            
            self.db.commit()
            return resultados
        except Exception as e:
            self.db.rollback()
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    def generar_reporte_inventario_valorizado(self, sucursal_id: int, fecha_corte: Optional[datetime] = None) -> Dict[str, Any]:
        return self.repo.generar_reporte_inventario_valorizado(sucursal_id, fecha_corte)
