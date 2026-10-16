import os

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


def precargar_jwks() -> None:
    try:
        _jwk_client.get_jwk_set()
    except Exception:
        pass


def verificar_token(token: str) -> dict:
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
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado"
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido"
        )