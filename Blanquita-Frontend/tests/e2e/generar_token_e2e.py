import sys
import os
import json
import secrets
import httpx
from dotenv import load_dotenv

load_dotenv("Blanquita-Backend/.env")
backend_dir = os.path.abspath("Blanquita-Backend")
sys.path.insert(0, backend_dir)

from app.Config.supabase import SessionLocal
from app.Services.Usuario.Auth import AuthService
from sqlalchemy import text

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

def main():
    db = SessionLocal()
    try:
        user_row = db.execute(
            text('SELECT "IdUsuario", "AuthUserId", "Ci" FROM public."Usuario" WHERE "Ci" = \'9000003\'')
        ).fetchone()
        if not user_row:
            print(json.dumps({"error": "Usuario 9000003 no encontrado"}))
            sys.exit(1)

        id_usuario, auth_id, ci = user_row
        test_pwd = "P@ss_" + secrets.token_hex(6) + "Aa1!"

        headers = {
            "apikey": SUPABASE_SECRET_KEY,
            "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
            "Content-Type": "application/json",
        }
        resp = httpx.put(
            f"{SUPABASE_URL}/auth/v1/admin/users/{auth_id}",
            headers=headers,
            json={"password": test_pwd},
            timeout=15.0
        )
        if resp.status_code != 200:
            print(json.dumps({"error": f"Error seteando password en Supabase: {resp.status_code}"}))
            sys.exit(1)

        auth_service = AuthService(db)
        login_res = auth_service.Login(ci, test_pwd, "127.0.0.1", "Playwright-E2E")
        print(json.dumps({
            "token": login_res["AccessToken"],
            "refresh_token": login_res["RefreshTokenCrudo"],
            "ci": ci,
            "id_usuario": id_usuario
        }))
    finally:
        db.close()

if __name__ == "__main__":
    main()
