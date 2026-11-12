import os
import time
from typing import Optional

import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient
from dotenv import load_dotenv
load_dotenv()
SUPABASE_URL = (os.getenv("SUPABASE_URL") or "https://blanquita.supabase.co").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "blanquita_service_secret_key_safe"
JWT_SECRET_LOCAL = os.getenv("JWT_SECRET") or SUPABASE_SERVICE_ROLE_KEY

JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
ISSUER = f"{SUPABASE_URL}/auth/v1"
AUDIENCE = "authenticated"

ALGORITMOS = ["ES256"]

_jwk_client = PyJWKClient(JWKS_URL, cache_keys=True, lifespan=900)
_token_cache: dict[str, tuple[dict, float]] = {}


def precargar_jwks() -> None:
    try:
        _jwk_client.get_jwk_set()
    except Exception:
        pass


def crear_access_token_movil(
    usuario_id: int,
    rol_id: int,
    auth_user_id: Optional[str] = None,
    correo: Optional[str] = None,
    is_admin: bool = False,
    expira_segundos: int = 3600
) -> str:
    """
    Genera un Access Token JWT con formato y claims idénticos a los emitidos por Supabase Auth:
    - aud: "authenticated"
    - iss: SUPABASE_URL/auth/v1
    - sub: auth_user_id
    - app_metadata: { IdUsuario, IdRol, IdEstadoUsuario: 1, IsAdmin }
    Permite mantener sesiones de choferes en ruta sin 401 Unauthorized ante fallos de conectividad con Supabase.
    """
    ahora = int(time.time())
    sub_val = str(auth_user_id) if auth_user_id else f"usr-{usuario_id}"
    payload = {
        "sub": sub_val,
        "aud": AUDIENCE,
        "iss": ISSUER,
        "iat": ahora,
        "exp": ahora + expira_segundos,
        "email": correo or f"usuario_{usuario_id}@papelerablanquita.com",
        "app_metadata": {
            "IdUsuario": int(usuario_id),
            "IdRol": int(rol_id),
            "IdEstadoUsuario": 1,
            "IsAdmin": bool(is_admin)
        },
        "user_metadata": {
            "id_usuario": int(usuario_id),
            "id_rol": int(rol_id)
        }
    }
    return jwt.encode(payload, JWT_SECRET_LOCAL, algorithm="HS256")


def verificar_token(token: str) -> dict:
    ahora = time.time()
    cached = _token_cache.get(token)
    if cached is not None:
        payload, exp_ts = cached
        if ahora < exp_ts:
            return payload

    try:
        # Detectar algoritmo en cabecera no verificada
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")

        if alg == "HS256":
            payload = jwt.decode(
                token,
                JWT_SECRET_LOCAL,
                algorithms=["HS256"],
                audience=AUDIENCE,
                issuer=ISSUER,
                options={"require": ["exp", "sub", "aud"]},
                leeway=60,
            )
        else:
            llave_firma = _jwk_client.get_signing_key_from_jwt(token).key
            payload = jwt.decode(
                token,
                llave_firma,
                algorithms=ALGORITMOS,
                audience=AUDIENCE,
                issuer=ISSUER,
                options={"require": ["exp", "sub", "aud"]},
                leeway=60,
            )

        # Guardar en caché con expiración segura (mínimo entre exp del token - 15s y 120s desde ahora)
        exp_token = float(payload.get("exp", ahora + 60))
        exp_cache = min(exp_token - 15.0, ahora + 120.0)
        if exp_cache > ahora:
            # Limitar tamaño de caché para evitar consumo innecesario
            if len(_token_cache) > 200:
                _token_cache.clear()
            _token_cache[token] = (payload, exp_cache)
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"codigo": "TOKEN_EXPIRADO", "mensaje": "Token expirado", "detail": "Token expirado"}
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"codigo": "TOKEN_INVALIDO", "mensaje": "Token inválido", "detail": "Token inválido"}
        )