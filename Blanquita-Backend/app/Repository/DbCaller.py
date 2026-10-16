from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException, status
from psycopg2.errors import RaiseException

class DbCaller:
    def __init__(self, db: Session):
        self.db = db

    def LlamarFuncion(self, consulta: str, parametros: dict | None = None, commit: bool = True) -> list[dict]:
        try:
            res = self.db.execute(text(consulta), parametros or {})
            filas = [dict(fila) for fila in res.mappings().all()] if res.returns_rows else []
            if commit:
                self.db.commit()
            return filas
        except SQLAlchemyError as e:
            self.db.rollback()

            origen = getattr(e, "orig", None)
            if RaiseException is not None and isinstance(origen, RaiseException):
                mensaje = getattr(origen.diag, "message_primary", None) or "Operación no permitida"
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=mensaje,
                )

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error ejecutando operación en base de datos",
            )

    def LlamarUnRegistro(self, consulta: str, parametros: dict | None = None, commit: bool = True) -> dict | None:
        filas = self.LlamarFuncion(consulta, parametros, commit)
        return filas[0] if filas else None
