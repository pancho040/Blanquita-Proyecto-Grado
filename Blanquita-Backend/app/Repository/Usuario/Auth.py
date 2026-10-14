from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.Repository.DbCaller import DbCaller
from app.Schemas.RegistroIngreso import RegistroIngreso
from app.Schemas.Usuario import Usuario


class AuthRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def ResolverCorreoPorCi(self, params: dict) -> dict | None:
        consulta = '''
            SELECT * FROM "ResolverCorreoPorCi"(p_Ci => :p_Ci)
        '''
        return self.caller.LlamarUnRegistro(consulta, params, commit=False)

    def ObtenerUsuarioPorId(self, params: dict) -> dict | None:
        consulta = '''
            SELECT * FROM "ObtenerUsuarioPorId"(p_IdUsuario => :p_IdUsuario)
        '''
        return self.caller.LlamarUnRegistro(consulta, params, commit=False)

    def ObtenerIdUsuarioPorCi(self, ci: str) -> int | None:
        try:
            return self.db.execute(
                select(Usuario.IdUsuario).where(Usuario.Ci == ci)
            ).scalar_one_or_none()
        except SQLAlchemyError:
            self.db.rollback()
            return None

    def RegistrarIngreso(self, registro: RegistroIngreso) -> bool:
        try:
            self.db.add(registro)
            self.db.commit()
            return True
        except SQLAlchemyError:
            self.db.rollback()
            return False
