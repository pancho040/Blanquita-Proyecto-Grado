import os
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Models.Usuario.Usuario import (
    CambiarEstadoUsuarioRequest,
    CambiarEstadoUsuarioResponse,
    EditarUsuarioRequest,
    EditarUsuarioResponse,
    ListarUsuariosRequest,
    ListarUsuariosResponse,
    RestablecerClaveRequest,
    RestablecerClaveResponse,
    UsuarioCreate,
    UsuarioListaItem,
    UsuarioPerfil,
    UsuarioResponse,
)
from app.Schemas.Usuario import Usuario
from app.Repository.Usuario.UsuarioRepository import UsuarioRepository
from app.utils.validators import (
    ValidarFormularioUsuario,
    ValidarTexto,
    REGLA_CARACTERES_OBSERVACION,
)
from app.Auth.Security import ValidarClaveNueva
from app.Constants.Cantidades import LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION,ROL_GERENTE_GENERAL
from app.Constants.Estados import (
    ESTADO_USUARIO_ACTIVO,
    ESTADO_USUARIO_SUSPENDIDO,
    TRANSICIONES_ESTADO_USUARIO,
)

SUPABASE_URL = os.getenv("SUPABASE_URL").rstrip("/")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

TIMEOUT_ADMIN = 15.0
DOMINIO_SINTETICO = "papelblanquita.invalid"


def _texto_opcional(valor: str | None) -> str | None:
    texto = (valor or "").strip()
    return texto or None


def _nombres(usuario: Usuario) -> list[str | None]:
    return [
        usuario.PrimerNombre,
        usuario.SegundoNombre,
        usuario.ApellidoPaterno,
        usuario.ApellidoMaterno,
    ]


def _nombre_completo(usuario: Usuario) -> str:
    return " ".join(n for n in _nombres(usuario) if n)

# (campo, etiqueta para el mensaje, obligatorio)
CAMPOS_NOMBRE = (
    ("PrimerNombre", "El primer nombre", True),
    ("SegundoNombre", "El segundo nombre", False),
    ("ApellidoPaterno", "El apellido paterno", True),
    ("ApellidoMaterno", "El apellido materno", False),
)


class UsuarioService:
    def __init__(self, db: Session):
        self.repository = UsuarioRepository(db)

    def _ValidarNombres(self, datos: EditarUsuarioRequest | UsuarioCreate) -> None:
        for campo, etiqueta, obligatorio in CAMPOS_NOMBRE:
            valor = (getattr(datos, campo) or "").strip()

            if not valor:
                if obligatorio:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=f"{etiqueta} es obligatorio",
                    )
                continue

            if not ValidarFormularioUsuario(valor):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"{etiqueta} solo puede tener letras, sin espacios, entre 2 y 15 caracteres",
                )

    def ListarUsuarios(self, data: ListarUsuariosRequest) -> ListarUsuariosResponse:
        total, filas = self.repository.ListarUsuarios(data.model_dump())

        return ListarUsuariosResponse(
            Total=total,
            Pagina=data.Pagina,
            TamanoPagina=data.TamanoPagina,
            Usuarios=[UsuarioListaItem(**fila) for fila in filas],
        )

    def CambiarEstadoUsuario(
        self, data: CambiarEstadoUsuarioRequest, id_admin: int
    ) -> CambiarEstadoUsuarioResponse:
        motivo = (data.Motivo or "").strip()
        if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, motivo):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=(
                    "El motivo es obligatorio, debe tener entre "
                    f"{LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, "
                    f"{REGLA_CARACTERES_OBSERVACION}"
                ),
            )

        if data.IdUsuario == id_admin:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No puede cambiar el estado de su propio usuario",
            )

        estados = self.repository.NombresEstadosUsuario()
        if data.IdEstadoUsuario not in estados:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="El estado indicado no existe",
            )

        usuario = self.repository.ObtenerUsuarioBloqueado(data.IdUsuario)
        if usuario is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El usuario no existe",
            )

        anterior = usuario.IdEstadoUsuario
        if anterior == data.IdEstadoUsuario:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El usuario ya se encuentra {estados[anterior]}",
            )

        if data.IdEstadoUsuario not in TRANSICIONES_ESTADO_USUARIO.get(anterior, set()):
            detalle = (
                "El usuario está Suspendido de forma definitiva, su estado no puede cambiarse"
                if anterior == ESTADO_USUARIO_SUSPENDIDO
                else f"No se permite pasar de {estados[anterior]} a {estados[data.IdEstadoUsuario]}"
            )
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detalle)

        nombre_completo = _nombre_completo(usuario)
        observacion = (
            f"Cambio de estado · Usuario CI {usuario.Ci} ({nombre_completo}): "
            f"{estados[anterior]} → {estados[data.IdEstadoUsuario]}. Motivo: {motivo}"
        )

        self.repository.CambiarEstado(usuario, data.IdEstadoUsuario, observacion, id_admin)

        return CambiarEstadoUsuarioResponse(
            IdUsuario=usuario.IdUsuario,
            Ci=usuario.Ci,
            NombreCompleto=nombre_completo,
            IdEstadoAnterior=anterior,
            NombreEstadoAnterior=estados[anterior],
            IdEstadoUsuario=data.IdEstadoUsuario,
            NombreEstadoUsuario=estados[data.IdEstadoUsuario],
        )

    def RestablecerClave(
        self, data: RestablecerClaveRequest, id_admin: int
    ) -> RestablecerClaveResponse:
        usuario = self.repository.ObtenerUsuarioBloqueado(data.IdUsuario)
        if usuario is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El usuario no existe",
            )

        if usuario.IdEstadoUsuario == ESTADO_USUARIO_SUSPENDIDO:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El usuario está Suspendido de forma definitiva, no se puede restablecer su clave",
            )

        error_clave = ValidarClaveNueva(data.ClaveNueva, usuario.Ci, _nombres(usuario))
        if error_clave:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=error_clave,
            )

        nombre_completo = _nombre_completo(usuario)
        self.repository.AgregarHistorial(
            id_admin, f"Restablecer clave · Usuario CI {usuario.Ci} ({nombre_completo})"
        )

        try:
            self._ActualizarClaveAuth(str(usuario.AuthUserId), data.ClaveNueva)
        except Exception:
            self.repository.Revertir()
            raise

        self.repository.Confirmar()

        return RestablecerClaveResponse(
            IdUsuario=usuario.IdUsuario,
            Ci=usuario.Ci,
            NombreCompleto=nombre_completo,
        )

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

    def EditarUsuario(self, data: EditarUsuarioRequest, id_admin: int) -> EditarUsuarioResponse:
        self._ValidarNombres(data)

        usuario = self.repository.ObtenerUsuarioBloqueado(data.IdUsuario)
        if usuario is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El usuario no existe",
            )

        if usuario.IdEstadoUsuario == ESTADO_USUARIO_SUSPENDIDO:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El usuario está Suspendido de forma definitiva, no se pueden editar sus datos",
            )

        nuevos = {
            "PrimerNombre": _texto_opcional(data.PrimerNombre),
            "SegundoNombre": _texto_opcional(data.SegundoNombre),
            "ApellidoPaterno": _texto_opcional(data.ApellidoPaterno),
            "ApellidoMaterno": _texto_opcional(data.ApellidoMaterno),
            "Celular": _texto_opcional(data.Celular),
        }
        cambios = [campo for campo, valor in nuevos.items() if getattr(usuario, campo) != valor]
        if not cambios:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No hay cambios para guardar",
            )

        observacion = (
            f"Editar usuario · CI {usuario.Ci} ({_nombre_completo(usuario)}): "
            f"{', '.join(cambios)}"
        )
        self.repository.EditarUsuario(usuario, nuevos, observacion, id_admin)

        return EditarUsuarioResponse(
            IdUsuario=usuario.IdUsuario,
            Ci=usuario.Ci,
            NombreCompleto=_nombre_completo(usuario),
        )

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

    def _ActualizarClaveAuth(self, auth_user_id: str, clave: str) -> None:
        try:
            respuesta = httpx.put(
                f"{SUPABASE_URL}/auth/v1/admin/users/{auth_user_id}",
                headers=self._CabecerasAdmin(),
                json={"password": clave},
                timeout=TIMEOUT_ADMIN,
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de autenticación no disponible"
            )

        if respuesta.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El usuario no tiene una cuenta de acceso registrada"
            )

        if respuesta.status_code == 422:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="El servicio de autenticación rechazó la clave, elija otra"
            )

        if respuesta.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No se pudo restablecer la clave"
            )

    def _EliminarCuentaAuth(self, auth_user_id: str) -> None:
        try:
            httpx.delete(
                f"{SUPABASE_URL}/auth/v1/admin/users/{auth_user_id}",
                headers=self._CabecerasAdmin(),
                timeout=TIMEOUT_ADMIN,
            )
        except httpx.RequestError:
            pass

    def CrearUsuario(self, datos: UsuarioCreate, id_admin: int) -> UsuarioResponse:
        self._ValidarNombres(datos)

        ci = datos.Ci.strip()
        nombres = [
            _texto_opcional(datos.PrimerNombre),
            _texto_opcional(datos.SegundoNombre),
            _texto_opcional(datos.ApellidoPaterno),
            _texto_opcional(datos.ApellidoMaterno),
        ]

        error_clave = ValidarClaveNueva(datos.Clave, ci, nombres)
        if error_clave:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=error_clave,
            )

        rol = self.repository.ObtenerRol(datos.IdRol)
        if rol is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="El rol indicado no existe",
            )

        if datos.IsAdmin and datos.IdRol not in (ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Solo un Líder de Inventario y Producción o Gerente General puede tener acceso de administrador",
            )

        if self.repository.ExisteCi(ci):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un usuario registrado con el CI {ci}",
            )

        auth_user_id = self._CrearCuentaAuth(ci, datos.Clave)

        usuario = Usuario(
            AuthUserId=UUID(auth_user_id),
            IdRol=datos.IdRol,
            IdEstadoUsuario=ESTADO_USUARIO_ACTIVO,
            Ci=ci,
            PrimerNombre=nombres[0],
            SegundoNombre=nombres[1],
            ApellidoPaterno=nombres[2],
            ApellidoMaterno=nombres[3],
            Celular=datos.Celular.strip(),
            IsAdmin=datos.IsAdmin,
        )
        nombre_completo = " ".join(n for n in nombres if n)
        observacion = (
            f"Crear usuario · CI {ci} ({nombre_completo}), rol {rol['NombreRol']}"
            + (", administrador" if datos.IsAdmin else "")
        )

        try:
            usuario = self.repository.CrearUsuario(usuario, observacion, id_admin)
        except Exception:
            self._EliminarCuentaAuth(auth_user_id)
            raise

        return UsuarioResponse(
            IdUsuario=usuario.IdUsuario,
            AuthUserId=usuario.AuthUserId,
            Ci=usuario.Ci,
            IdRol=usuario.IdRol,
            NombreRol=rol["NombreRol"],
            IdEstadoUsuario=usuario.IdEstadoUsuario,
            NombreCompleto=nombre_completo,
            Celular=usuario.Celular,
            IsAdmin=usuario.IsAdmin,
            FechaRegistro=usuario.FechaRegistro,
        )