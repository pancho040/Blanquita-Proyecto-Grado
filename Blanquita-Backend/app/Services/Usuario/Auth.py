import os
import time

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.RegistroIngreso import (
    DETALLE_CI_NO_REGISTRADO,
    DETALLE_CIERRE_SESION,
    DETALLE_CIERRE_TODAS_SESIONES,
    DETALLE_CLAVE_INCORRECTA,
    DETALLE_DEMASIADOS_INTENTOS,
    DETALLE_ERROR_SERVICIO,
    DETALLE_SERVICIO_NO_DISPONIBLE,
    DETALLE_SIN_CUENTA_AUTENTICACION,
    DETALLE_SIN_REVOCACION,
    LONGITUD_MAXIMA_CI_INTENTADO,
    LONGITUD_MAXIMA_DIRECCION_IP,
    LONGITUD_MAXIMA_USER_AGENT,
    REGISTRO_INGRESO,
    REGISTRO_INTENTO_FALLIDO,
    REGISTRO_SALIDA,
)
from app.Repository.Usuario.Auth import AuthRepository
from app.Schemas.RegistroIngreso import RegistroIngreso

SUPABASE_URL = os.getenv("SUPABASE_URL").rstrip("/")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")

TIMEOUT_AUTH = 15.0
TIEMPO_MINIMO_LOGIN = 0.5

ESTADO_USUARIO_ACTIVO = 1


def _Recortar(valor: str | None, longitud: int) -> str | None:
    if valor is None:
        return None
    valor = valor.strip()
    return valor[:longitud] if valor else None


class AuthService:
    def __init__(self, db: Session):
        self.repository = AuthRepository(db)

    def _Cabeceras(self, access_token: str | None = None) -> dict:
        cabeceras = {
            "apikey": SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
        }
        if access_token:
            cabeceras["Authorization"] = f"Bearer {access_token}"
        return cabeceras

    def _SolicitarToken(self, grant_type: str, cuerpo: dict) -> httpx.Response:
        try:
            return httpx.post(
                f"{SUPABASE_URL}/auth/v1/token",
                params={"grant_type": grant_type},
                headers=self._Cabeceras(),
                json=cuerpo,
                timeout=TIMEOUT_AUTH,
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de autenticación no disponible"
            )

    def _IgualarTiempo(self, inicio: float) -> None:
        transcurrido = time.perf_counter() - inicio
        if transcurrido < TIEMPO_MINIMO_LOGIN:
            time.sleep(TIEMPO_MINIMO_LOGIN - transcurrido)

    def _Registrar(
        self,
        registro: str,
        id_usuario: int | None,
        ip: str | None,
        user_agent: str | None,
        ci: str | None = None,
        detalle: str | None = None,
    ) -> None:
        self.repository.RegistrarIngreso(
            RegistroIngreso(
                IdUsuario=id_usuario,
                Registro=registro,
                CiIntentado=_Recortar(ci, LONGITUD_MAXIMA_CI_INTENTADO),
                Detalle=detalle,
                DireccionIp=_Recortar(ip, LONGITUD_MAXIMA_DIRECCION_IP),
                UserAgent=_Recortar(user_agent, LONGITUD_MAXIMA_USER_AGENT),
            )
        )

    def _RechazarLogin(
        self,
        ci: str,
        id_usuario: int | None,
        detalle: str,
        ip: str | None,
        user_agent: str | None,
        error: HTTPException,
    ) -> None:
        self._Registrar(REGISTRO_INTENTO_FALLIDO, id_usuario, ip, user_agent, ci, detalle)
        raise error

    def Login(self, ci: str, clave: str, ip: str | None, user_agent: str | None) -> dict:
        inicio = time.perf_counter()
        try:
            return self._EjecutarLogin(ci, clave, ip, user_agent)
        finally:
            self._IgualarTiempo(inicio)

    def _EjecutarLogin(self, ci: str, clave: str, ip: str | None, user_agent: str | None) -> dict:
        credenciales_invalidas = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas"
        )

        usuario = self.repository.ResolverCorreoPorCi({"p_Ci": ci})

        if usuario is None:
            self._RechazarLogin(ci, None, DETALLE_CI_NO_REGISTRADO, ip, user_agent, credenciales_invalidas)

        id_usuario = self.repository.ObtenerIdUsuarioPorCi(ci)

        if usuario["CorreoOut"] is None:
            self._RechazarLogin(ci, id_usuario, DETALLE_SIN_CUENTA_AUTENTICACION, ip, user_agent, credenciales_invalidas)

        try:
            respuesta = self._SolicitarToken("password", {
                "email": usuario["CorreoOut"],
                "password": clave,
            })
        except HTTPException as error:
            self._RechazarLogin(ci, id_usuario, DETALLE_SERVICIO_NO_DISPONIBLE, ip, user_agent, error)

        if respuesta.status_code in (400, 401, 403):
            self._RechazarLogin(ci, id_usuario, DETALLE_CLAVE_INCORRECTA, ip, user_agent, credenciales_invalidas)

        if respuesta.status_code == 429:
            self._RechazarLogin(ci, id_usuario, DETALLE_DEMASIADOS_INTENTOS, ip, user_agent, HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos, intente más tarde"
            ))

        if respuesta.status_code >= 400:
            self._RechazarLogin(ci, id_usuario, DETALLE_ERROR_SERVICIO, ip, user_agent, HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Error del servicio de autenticación"
            ))

        if usuario["IdEstadoUsuarioOut"] != ESTADO_USUARIO_ACTIVO:
            self._RechazarLogin(
                ci,
                id_usuario,
                f"Usuario {usuario['NombreEstadoUsuarioOut']}",
                ip,
                user_agent,
                HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Usuario {usuario['NombreEstadoUsuarioOut']}, no puede iniciar sesión"
                ),
            )

        sesion = respuesta.json()

        self._Registrar(REGISTRO_INGRESO, id_usuario, ip, user_agent, None if id_usuario else ci)

        return {
            "AccessToken": sesion["access_token"],
            "RefreshTokenCrudo": sesion["refresh_token"],
        }

    def RefreshAccessToken(self, refresh_token_crudo: str) -> dict:
        respuesta = self._SolicitarToken("refresh_token", {
            "refresh_token": refresh_token_crudo,
        })

        if respuesta.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token inválido"
            )

        sesion = respuesta.json()

        return {
            "AccessToken": sesion["access_token"],
            "RefreshTokenCrudo": sesion["refresh_token"],
        }

    def _CerrarSesion(self, access_token: str, scope: str) -> bool:
        try:
            respuesta = httpx.post(
                f"{SUPABASE_URL}/auth/v1/logout",
                params={"scope": scope},
                headers=self._Cabeceras(access_token),
                timeout=TIMEOUT_AUTH,
            )
        except httpx.RequestError:
            return False

        return respuesta.status_code < 400

    def _RegistrarSalida(
        self,
        id_usuario: int | None,
        detalle: str,
        revocado: bool,
        ip: str | None,
        user_agent: str | None,
    ) -> None:
        if id_usuario is None:
            return
        if not revocado:
            detalle = f"{detalle}, {DETALLE_SIN_REVOCACION}"
        self._Registrar(REGISTRO_SALIDA, id_usuario, ip, user_agent, detalle=detalle)

    def Logout(
        self,
        access_token: str,
        id_usuario: int | None,
        ip: str | None,
        user_agent: str | None,
    ) -> bool:
        revocado = self._CerrarSesion(access_token, "local")
        self._RegistrarSalida(id_usuario, DETALLE_CIERRE_SESION, revocado, ip, user_agent)
        return revocado

    def LogoutTodasLasSesiones(
        self,
        access_token: str,
        id_usuario: int,
        ip: str | None,
        user_agent: str | None,
    ) -> bool:
        revocado = self._CerrarSesion(access_token, "global")
        self._RegistrarSalida(id_usuario, DETALLE_CIERRE_TODAS_SESIONES, revocado, ip, user_agent)
        return revocado
