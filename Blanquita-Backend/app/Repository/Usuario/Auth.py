from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.Repository.DbCaller import DbCaller
from app.Schemas.RegistroIngreso import RegistroIngreso
from app.Schemas.Usuario import AuthUsuario, EstadoUsuario, Usuario


class AuthRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def ResolverCorreoPorCi(self, params: dict) -> dict | None:
        filas = self.caller.Consultar(
            select(
                AuthUsuario.email.label("CorreoOut"),
                Usuario.IdEstadoUsuario.label("IdEstadoUsuarioOut"),
                EstadoUsuario.NombreEstadoUsuario.label("NombreEstadoUsuarioOut"),
            )
            .join(AuthUsuario, AuthUsuario.id == Usuario.AuthUserId)
            .join(EstadoUsuario, EstadoUsuario.IdEstadoUsuario == Usuario.IdEstadoUsuario)
            .where(Usuario.Ci == params["p_Ci"])
        )
        return filas[0] if filas else None

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
