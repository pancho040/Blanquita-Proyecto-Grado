from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.Repository.DbCaller import DbCaller
from app.Schemas.HistorialAdmin import HistorialAdmin
from app.Schemas.Usuario import EstadoUsuario, Rol, Usuario


class UsuarioRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def ListarUsuarios(self, params: dict) -> tuple[int, list[dict]]:
        consulta = (
            select(
                Usuario.IdUsuario,
                Usuario.Ci,
                Usuario.PrimerNombre,
                Usuario.SegundoNombre,
                Usuario.ApellidoPaterno,
                Usuario.ApellidoMaterno,
                Usuario.Celular,
                Usuario.FechaRegistro,
                Usuario.IsAdmin,
                Rol.IdRol,
                Rol.NombreRol,
                EstadoUsuario.IdEstadoUsuario,
                EstadoUsuario.NombreEstadoUsuario,
            )
            .join(Rol, Usuario.IdRol == Rol.IdRol)
            .join(EstadoUsuario, Usuario.IdEstadoUsuario == EstadoUsuario.IdEstadoUsuario)
        )

        if params.get("IdEstadoUsuario") is not None:
            consulta = consulta.where(Usuario.IdEstadoUsuario == params["IdEstadoUsuario"])

        if params.get("IdRol") is not None:
            consulta = consulta.where(Usuario.IdRol == params["IdRol"])

        busqueda = (params.get("Busqueda") or "").strip()
        if busqueda:
            nombre_completo = func.concat_ws(
                " ",
                Usuario.PrimerNombre,
                Usuario.SegundoNombre,
                Usuario.ApellidoPaterno,
                Usuario.ApellidoMaterno,
            )
            consulta = consulta.where(
                or_(
                    Usuario.Ci.ilike(f"%{busqueda}%"),
                    nombre_completo.ilike(f"%{busqueda}%"),
                )
            )

        total = self.caller.Consultar(
            select(func.count().label("Total")).select_from(consulta.subquery())
        )[0]["Total"]

        pagina = consulta.order_by(
            Usuario.ApellidoPaterno, Usuario.PrimerNombre, Usuario.IdUsuario
        ).limit(params["TamanoPagina"]).offset((params["Pagina"] - 1) * params["TamanoPagina"])

        return total, self.caller.Consultar(pagina)

    def VerificarAdmin(self, params: dict) -> dict | None:
        filas = self.caller.Consultar(
            select(
                Usuario.IsAdmin.label("EsAdminOut"),
                Usuario.IdEstadoUsuario.label("IdEstadoUsuarioOut"),
            ).where(Usuario.IdUsuario == params["p_IdUsuario"])
        )
        return filas[0] if filas else None

    def ObtenerPerfil(self, params: dict) -> dict | None:
        filas = self.caller.Consultar(
            select(
                Usuario.IdUsuario.label("IdUsuarioOut"),
                Usuario.Ci.label("CiOut"),
                Usuario.PrimerNombre.label("PrimerNombreOut"),
                Usuario.SegundoNombre.label("SegundoNombreOut"),
                Usuario.ApellidoPaterno.label("ApellidoPaternoOut"),
                Usuario.ApellidoMaterno.label("ApellidoMaternoOut"),
                func.concat_ws(
                    " ",
                    Usuario.PrimerNombre,
                    Usuario.SegundoNombre,
                    Usuario.ApellidoPaterno,
                    Usuario.ApellidoMaterno,
                ).label("NombreCompletoOut"),
                Usuario.Celular.label("CelularOut"),
                Usuario.IdRol.label("IdRolOut"),
                Rol.NombreRol.label("NombreRolOut"),
                Usuario.IdEstadoUsuario.label("IdEstadoUsuarioOut"),
                EstadoUsuario.NombreEstadoUsuario.label("NombreEstadoUsuarioOut"),
                Usuario.FechaRegistro.label("FechaRegistroOut"),
            )
            .join(Rol, Rol.IdRol == Usuario.IdRol)
            .join(EstadoUsuario, EstadoUsuario.IdEstadoUsuario == Usuario.IdEstadoUsuario)
            .where(Usuario.IdUsuario == params["p_IdUsuario"])
        )
        return filas[0] if filas else None

    def ObtenerUsuarioBloqueado(self, id_usuario: int) -> Usuario | None:
        try:
            return self.db.execute(
                select(Usuario).where(Usuario.IdUsuario == id_usuario).with_for_update()
            ).scalar_one_or_none()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error ejecutando consulta en base de datos",
            )

    def NombresEstadosUsuario(self) -> dict[int, str]:
        filas = self.caller.Consultar(
            select(EstadoUsuario.IdEstadoUsuario, EstadoUsuario.NombreEstadoUsuario)
        )
        return {f["IdEstadoUsuario"]: f["NombreEstadoUsuario"] for f in filas}

    def CambiarEstado(
        self, usuario: Usuario, id_estado: int, observacion: str, id_admin: int
    ) -> None:
        try:
            usuario.IdEstadoUsuario = id_estado
            self.db.add(HistorialAdmin(IdUsuario=id_admin, Observacion=observacion))
            self.db.commit()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo cambiar el estado del usuario",
            )

    def EditarUsuario(
        self, usuario: Usuario, datos: dict, observacion: str, id_admin: int
    ) -> None:
        try:
            for campo, valor in datos.items():
                setattr(usuario, campo, valor)
            self.db.add(HistorialAdmin(IdUsuario=id_admin, Observacion=observacion))
            self.db.commit()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo editar el usuario",
            )

    def AgregarHistorial(self, id_admin: int, observacion: str) -> None:
        try:
            self.db.add(HistorialAdmin(IdUsuario=id_admin, Observacion=observacion))
            self.db.flush()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el historial",
            )

    def Confirmar(self) -> None:
        try:
            self.db.commit()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el historial",
            )

    def Revertir(self) -> None:
        self.db.rollback()

    def ObtenerRol(self, id_rol: int) -> dict | None:
        filas = self.caller.Consultar(
            select(Rol.IdRol, Rol.NombreRol).where(Rol.IdRol == id_rol)
        )
        return filas[0] if filas else None

    def ExisteCi(self, ci: str) -> bool:
        return bool(self.caller.Consultar(select(Usuario.IdUsuario).where(Usuario.Ci == ci)))

    def CrearUsuario(self, usuario: Usuario, observacion: str, id_admin: int) -> Usuario:
        try:
            self.db.add(usuario)
            self.db.flush()
            self.db.add(HistorialAdmin(IdUsuario=id_admin, Observacion=observacion))
            self.db.commit()
        except IntegrityError as e:
            self.db.rollback()
            restriccion = getattr(getattr(e.orig, "diag", None), "constraint_name", "") or ""
            if "_Ci_" in restriccion:
                detalle = f"Ya existe un usuario registrado con el CI {usuario.Ci}"
            elif "AuthUserId" in restriccion:
                detalle = "La cuenta de acceso ya está vinculada a otro usuario"
            else:
                detalle = "Los datos del usuario no son válidos"
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detalle)
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el usuario",
            )

        self.db.refresh(usuario)
        return usuario