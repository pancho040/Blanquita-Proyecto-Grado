import os
import sys
import json
import secrets
import httpx
from dotenv import load_dotenv

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "Blanquita-Backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from sqlalchemy import text
from app.Config.supabase import SessionLocal

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

def set_password(auth_user_id: str, pwd: str, id_usuario: int, id_rol: int, id_sucursal: int):
    headers = {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
        "Content-Type": "application/json",
    }
    resp = httpx.put(
        f"{SUPABASE_URL}/auth/v1/admin/users/{auth_user_id}",
        headers=headers,
        json={
            "password": pwd,
            "app_metadata": {
                "IdUsuario": id_usuario,
                "IdRol": id_rol,
                "IdSucursal": id_sucursal,
                "IsAdmin": False
            }
        },
        timeout=15.0
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Error seteando password en Supabase: {resp.text}")

def main():
    db = SessionLocal()
    try:
        # Buscar supervisor TEST_Potosi (ci 9000003) o supervisor Potosí 8002001
        user_row = db.execute(
            text('SELECT "IdUsuario", "AuthUserId", "Ci", "IdRol", "IdSucursal" FROM public."Usuario" WHERE "Ci" = :ci'),
            {"ci": "9000003"}
        ).fetchone()
        
        if not user_row or not user_row[1]:
            # Intentar con Gonzalo Flores 8002001
            user_row = db.execute(
                text('SELECT "IdUsuario", "AuthUserId", "Ci", "IdRol", "IdSucursal" FROM public."Usuario" WHERE "Ci" = :ci'),
                {"ci": "8002001"}
            ).fetchone()

        if not user_row or not user_row[1]:
            raise RuntimeError("No se encontró supervisor con AuthUserId")

        id_usuario, auth_id, ci, id_rol, id_sucursal = user_row
        print(f"Supervisor encontrado: IdUsuario={id_usuario}, CI={ci}, Rol={id_rol}, Sucursal={id_sucursal}")

        pwd = "P@ss_" + secrets.token_hex(8) + "Aa1!"
        set_password(str(auth_id), pwd, id_usuario, id_rol, id_sucursal)

        # Hacer login en backend web http://localhost:8000/api/auth/login
        resp_login = httpx.post(
            "http://localhost:8000/api/auth/login",
            json={"Ci": ci, "Clave": pwd},
            timeout=15.0
        )
        if resp_login.status_code != 200:
            raise RuntimeError(f"Fallo login en backend: {resp_login.status_code} {resp_login.text}")

        data = resp_login.json()
        tokens = {
            "token": data["AccessToken"],
            "refresh_token": data.get("RefreshToken", ""),
            "ci": ci,
            "id_usuario": id_usuario,
            "id_sucursal": id_sucursal
        }

        out_path = os.path.abspath("docs/manifests/sesion.local.json")
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(tokens, f, indent=2)

        print(f"Sesion guardada exitosamente en {out_path}")

    finally:
        db.close()

if __name__ == "__main__":
    main()
