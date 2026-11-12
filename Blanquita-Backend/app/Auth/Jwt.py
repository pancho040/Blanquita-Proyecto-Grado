import os
import time

import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient
from dotenv import load_dotenv
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL").rstrip("/")

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


def verificar_token(token: str) -> dict:
    ahora = time.time()
    cached = _token_cache.get(token)
    if cached is not None:
        payload, exp_ts = cached
        if ahora < exp_ts:
            return payload

    try:
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