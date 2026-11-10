from sqlalchemy.orm import Session
from app.Repository.DbCaller import DbCaller


class UsuarioRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def VerificarAdmin(self, params: dict) -> dict | None:
        consulta = '''
            SELECT * FROM "VerificarAdmin"(p_IdUsuario => :p_IdUsuario)
        '''
        return self.caller.LlamarUnRegistro(consulta, params, commit=False)

    def ObtenerPerfil(self, params: dict) -> dict | None:
        consulta = '''
            SELECT * FROM "ObtenerPerfil"(p_IdUsuario => :p_IdUsuario)
        '''
        return self.caller.LlamarUnRegistro(consulta, params, commit=False)

    def EditarPerfil(self, params: dict) -> dict | None:
        consulta = '''
            SELECT * FROM "EditarPerfil"(
                p_IdUsuario       => :p_IdUsuario,
                p_PrimerNombre    => :p_PrimerNombre,
                p_ApellidoPaterno => :p_ApellidoPaterno,
                p_SegundoNombre   => :p_SegundoNombre,
                p_ApellidoMaterno => :p_ApellidoMaterno,
                p_Celular         => :p_Celular
            )
        '''
        return self.caller.LlamarUnRegistro(consulta, params)

    def CrearUsuario(self, params: dict) -> dict | None:
        consulta = '''
            SELECT * FROM "CrearUsuario"(
                p_AuthUserId      => :p_AuthUserId,
                p_IdRol           => :p_IdRol,
                p_Ci              => :p_Ci,
                p_PrimerNombre    => :p_PrimerNombre,
                p_ApellidoPaterno => :p_ApellidoPaterno,
                p_Celular         => :p_Celular,
                p_SegundoNombre   => :p_SegundoNombre,
                p_ApellidoMaterno => :p_ApellidoMaterno,
                p_IsAdmin         => :p_IsAdmin
            )
        '''
        return self.caller.LlamarUnRegistro(consulta, params)

    def ListarUsuarios(self) -> list[dict]:
        consulta = '''
            SELECT 
                u."IdUsuario",
                u."Ci",
                u."PrimerNombre",
                u."SegundoNombre",
                u."ApellidoPaterno",
                u."ApellidoMaterno",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno", ' ', COALESCE(u."ApellidoMaterno", '')) as "NombreCompleto",
                u."Celular",
                u."IdRol",
                r."NombreRol",
                u."IdEstadoUsuario",
                CASE WHEN u."IdEstadoUsuario" = 1 THEN true ELSE false END as "Activo",
                u."IsAdmin",
                u."IdSucursal",
                s."nombre" as "NombreSucursal"
            FROM "Usuario" u
            JOIN "Rol" r ON u."IdRol" = r."IdRol"
            LEFT JOIN "sucursales" s ON u."IdSucursal" = s."id"
            ORDER BY u."IdUsuario" ASC;
        '''
        return self.caller.LlamarFuncion(consulta, commit=False)

    def ActualizarSucursalUsuario(self, id_usuario: int, id_sucursal: int | None) -> dict | None:
        consulta = '''
            UPDATE "Usuario"
            SET "IdSucursal" = :id_sucursal
            WHERE "IdUsuario" = :id_usuario
            RETURNING "IdUsuario", "IdSucursal";
        '''
        return self.caller.LlamarUnRegistro(consulta, {"id_usuario": id_usuario, "id_sucursal": id_sucursal})