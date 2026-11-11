import os

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Models.Usuario.Usuario import PerfilUpdate, UsuarioCreate, UsuarioPerfil
from app.Repository.Usuario.UsuarioRepository import UsuarioRepository

SUPABASE_URL = os.getenv("SUPABASE_URL").rstrip("/")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

TIMEOUT_ADMIN = 15.0
DOMINIO_SINTETICO = "papelblanquita.invalid"


class UsuarioService:
    def __init__(self, db: Session):
        self.repository = UsuarioRepository(db)

    def ObtenerPerfil(self, usuario_actual: dict) -> UsuarioPerfil:
        fila = self.repository.ObtenerPerfil(
            {"p_IdUsuario": usuario_actual["IdUsuario"]}
        )

        if not fila:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró el perfil del usuario"
            )

        return UsuarioPerfil(**fila, Correo=usuario_actual.get("Correo"))

    def EditarPerfil(self, usuario_actual: dict, datos: PerfilUpdate) -> UsuarioPerfil:
        fila = self.repository.EditarPerfil({
            "p_IdUsuario": usuario_actual["IdUsuario"],
            "p_PrimerNombre": datos.PrimerNombre,
            "p_ApellidoPaterno": datos.ApellidoPaterno,
            "p_SegundoNombre": datos.SegundoNombre,
            "p_ApellidoMaterno": datos.ApellidoMaterno,
            "p_Celular": datos.Celular,
        })

        if not fila:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró el perfil del usuario"
            )

        return UsuarioPerfil(**fila, Correo=usuario_actual.get("Correo"))

    def _CabecerasAdmin(self) -> dict:
        return {
            "apikey": SUPABASE_SECRET_KEY,
            "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
            "Content-Type": "application/json",
        }

    def _CorreoSintetico(self, ci: str) -> str:
        return f"{ci}@{DOMINIO_SINTETICO}"

    def _CrearCuentaAuth(self, ci: str, clave: str) -> str:
        try:
            respuesta = httpx.post(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                headers=self._CabecerasAdmin(),
                json={
                    "email": self._CorreoSintetico(ci),
                    "password": clave,
                    "email_confirm": True,
                },
                timeout=TIMEOUT_ADMIN,
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de autenticación no disponible"
            )

        if respuesta.status_code in (409, 422):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una cuenta de acceso para el CI {ci}"
            )

        if respuesta.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No se pudo crear la cuenta de acceso"
            )

        cuenta = respuesta.json()
        auth_user_id = cuenta.get("id")

        if not auth_user_id:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Respuesta inválida del servicio de autenticación"
            )

        return auth_user_id

    def _EliminarCuentaAuth(self, auth_user_id: str) -> None:
        try:
            httpx.delete(
                f"{SUPABASE_URL}/auth/v1/admin/users/{auth_user_id}",
                headers=self._CabecerasAdmin(),
                timeout=TIMEOUT_ADMIN,
            )
        except httpx.RequestError:
            pass

    def CrearUsuario(self, datos: UsuarioCreate) -> dict:
        auth_user_id = self._CrearCuentaAuth(datos.Ci, datos.Clave)

        params = {
            "p_AuthUserId": auth_user_id,
            "p_IdRol": datos.IdRol,
            "p_Ci": datos.Ci,
            "p_PrimerNombre": datos.PrimerNombre,
            "p_ApellidoPaterno": datos.ApellidoPaterno,
            "p_Celular": datos.Celular,
            "p_SegundoNombre": datos.SegundoNombre,
            "p_ApellidoMaterno": datos.ApellidoMaterno,
            "p_IsAdmin": datos.IsAdmin,
        }

        try:
            usuario = self.repository.CrearUsuario(params)
        except HTTPException:
            self._EliminarCuentaAuth(auth_user_id)
            raise
        except Exception:
            self._EliminarCuentaAuth(auth_user_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el usuario"
            )

        if not usuario:
            self._EliminarCuentaAuth(auth_user_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el usuario"
            )

        # Asignar sucursal seleccionada si fue especificada
        id_creado = usuario.get("IdUsuarioOut") or usuario.get("IdUsuario")
        if id_creado and datos.IdSucursal is not None:
            self.repository.ActualizarSucursalUsuario(id_creado, datos.IdSucursal)
            usuario["IdSucursalOut"] = datos.IdSucursal

        return usuario

    def ListarUsuarios(self, sucursal_id: int | None = None) -> list[dict]:
        return self.repository.ListarUsuarios(sucursal_id)

    def ActualizarSucursalUsuario(self, id_usuario: int, id_sucursal: int | None) -> dict:
        res = self.repository.ActualizarSucursalUsuario(id_usuario, id_sucursal)
        if not res:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        return res