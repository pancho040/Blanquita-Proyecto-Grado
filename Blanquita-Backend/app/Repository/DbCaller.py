from sqlalchemy import Select
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException, status


class DbCaller:
    def __init__(self, db: Session):
        self.db = db

    def Consultar(self, consulta: Select) -> list[dict]:
        try:
            return [dict(fila) for fila in self.db.execute(consulta).mappings().all()]
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error ejecutando consulta en base de datos",
            )
