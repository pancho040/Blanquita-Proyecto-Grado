"""
Script Idempotente de Siembra de Usuarios de Prueba Multi-Sede y Sede Fija
Sistema ERP Papelera Blanquita

Usuarios creados:
a) TEST_Sucre_Contador: Contador (IdRol=4), sede fija Sucre (IdSucursal=1).
b) TEST_Potosi_Contador: Contador (IdRol=4), sede fija Potosí (IdSucursal=2).
c) TEST_Potosi_Supervisor: Supervisor (IdRol=5), sede fija Potosí (IdSucursal=2).
d) TEST_Potosi_Chofer: Agente de Reparto (IdRol=6), sede fija Potosí (IdSucursal=2).
e) TEST_Multisede_Gerente: Gerente General (IdRol=3), multisede (puede_ver_todas=True).

Seguridad:
- Las contraseñas NO se imprimen en terminal ni se escriben en código.
- Se guardan únicamente en docs/manifests/.test_credentials.local.json (ignorado por git).
- Genera docs/manifests/manifest_usuarios_prueba_sedes.json con los IDs creados.
- Soporta --dry-run.
"""

import os
import sys
import json
import secrets
import argparse
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from sqlalchemy import text
from app.Config.supabase import SessionLocal
from app.Services.Usuario.UsuarioService import UsuarioService
from app.Models.Usuario.Usuario import UsuarioCreate

MANIFEST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../docs/manifests"))
MANIFEST_FILE = os.path.join(MANIFEST_DIR, "manifest_usuarios_prueba_sedes.json")
CREDENTIALS_FILE = os.path.join(MANIFEST_DIR, ".test_credentials.local.json")

USUARIOS_DEFINICION = [
    {
        "alias": "TEST_Sucre_Contador",
        "ci": "9000001",
        "celular": "70000001",
        "primer_nombre": "TEST_Sucre",
        "apellido": "Contador",
        "id_rol": 4, # Contador
        "id_sucursal": 1, # Sucre
        "puede_ver_todas": False,
        "puede_escribir": True,
        "permiso_sucursal_id": 1,
    },
    {
        "alias": "TEST_Potosi_Contador",
        "ci": "9000002",
        "celular": "70000002",
        "primer_nombre": "TEST_Potosi",
        "apellido": "Contador",
        "id_rol": 4, # Contador
        "id_sucursal": 2, # Potosí
        "puede_ver_todas": False,
        "puede_escribir": True,
        "permiso_sucursal_id": 2,
    },
    {
        "alias": "TEST_Potosi_Supervisor",
        "ci": "9000003",
        "celular": "70000003",
        "primer_nombre": "TEST_Potosi",
        "apellido": "Supervisor",
        "id_rol": 5, # Supervisor
        "id_sucursal": 2, # Potosí
        "puede_ver_todas": False,
        "puede_escribir": True,
        "permiso_sucursal_id": 2,
    },
    {
        "alias": "TEST_Potosi_Chofer",
        "ci": "9000004",
        "celular": "70000004",
        "primer_nombre": "TEST_Potosi",
        "apellido": "Chofer",
        "id_rol": 6, # Agente de Reparto
        "id_sucursal": 2, # Potosí
        "puede_ver_todas": False,
        "puede_escribir": True,
        "permiso_sucursal_id": 2,
    },
    {
        "alias": "TEST_Multisede_Gerente",
        "ci": "9000005",
        "celular": "70000005",
        "primer_nombre": "TEST_Multisede",
        "apellido": "Gerente",
        "id_rol": 3, # Gerente General
        "id_sucursal": 1, # Base Sucre
        "puede_ver_todas": True,
        "puede_escribir": True,
        "permiso_sucursal_id": None, # Fila NULL con puede_ver_todas=True
    },
]

def seed_usuarios(dry_run: bool = False):
    os.makedirs(MANIFEST_DIR, exist_ok=True)
    db = SessionLocal()
    service = UsuarioService(db)

    print(f"=== SIEMBRA DE USUARIOS DE PRUEBA MULTI-SEDE {'[MODO DRY-RUN]' if dry_run else ''} ===")

    manifest_usuarios = []
    credentials_data = {}

    try:
        # Clave común o por variable de entorno
        base_pwd = os.getenv("TEST_USERS_PASSWORD")
        if not base_pwd:
            base_pwd = "BlanquitaTest_" + secrets.token_urlsafe(8) + "!"

        for u in USUARIOS_DEFINICION:
            alias = u["alias"]
            ci = u["ci"]
            
            # Comprobar idempotencia en base de datos
            existente = db.execute(
                text('SELECT "IdUsuario", "PrimerNombre", "IdRol", "IdSucursal" FROM "Usuario" WHERE "Ci" = :ci'),
                {"ci": ci}
            ).fetchone()

            if existente:
                uid = existente.IdUsuario
                print(f"[YA EXISTE] {alias} (ID {uid}, Rol {existente.IdRol}, Sede {existente.IdSucursal}). Asegurando permisos...")
                if not dry_run:
                    # Asegurar usuario_sucursal_permiso
                    db.execute(text("DELETE FROM usuario_sucursal_permiso WHERE id_usuario = :uid"), {"uid": uid})
                    db.execute(text("""
                        INSERT INTO usuario_sucursal_permiso (id_usuario, id_sucursal, puede_ver_todas, puede_escribir, creado_en)
                        VALUES (:uid, :sid, :todas, :escribe, NOW())
                    """), {
                        "uid": uid,
                        "sid": u["permiso_sucursal_id"],
                        "todas": u["puede_ver_todas"],
                        "escribe": u["puede_escribir"]
                    })
                    db.commit()
                manifest_usuarios.append({
                    "alias": alias,
                    "id_usuario": uid,
                    "ci": ci,
                    "id_rol": u["id_rol"],
                    "id_sucursal": u["id_sucursal"],
                    "puede_ver_todas": u["puede_ver_todas"]
                })
                continue

            if dry_run:
                print(f"[DRY-RUN] Se crearía {alias} (CI: {ci}, Rol: {u['id_rol']}, Sede: {u['id_sucursal']}, PuedeVerTodas: {u['puede_ver_todas']})")
                manifest_usuarios.append({"alias": alias, "id_usuario": "DRY-RUN", "ci": ci})
            else:
                user_dto = UsuarioCreate(
                    Ci=ci,
                    Celular=u["celular"],
                    Clave=base_pwd,
                    PrimerNombre=u["primer_nombre"],
                    ApellidoPaterno=u["apellido"],
                    SegundoNombre=None,
                    ApellidoMaterno=None,
                    IdRol=u["id_rol"],
                    IdSucursal=u["id_sucursal"],
                    IsAdmin=(u["id_rol"] == 3)
                )

                created = service.CrearUsuario(user_dto)
                uid = created.get("IdUsuarioOut") or created.get("IdUsuario")
                auth_id = created.get("AuthUserIdOut") or created.get("AuthUserId")

                # Insertar permisos territoriales explícitos
                db.execute(text("""
                    INSERT INTO usuario_sucursal_permiso (id_usuario, id_sucursal, puede_ver_todas, puede_escribir, creado_en)
                    VALUES (:uid, :sid, :todas, :escribe, NOW())
                """), {
                    "uid": uid,
                    "sid": u["permiso_sucursal_id"],
                    "todas": u["puede_ver_todas"],
                    "escribe": u["puede_escribir"]
                })
                db.commit()

                print(f"[CREADO] {alias} -> ID {uid} (Rol {u['id_rol']}, Sede {u['id_sucursal']}, Multisede: {u['puede_ver_todas']})")

                manifest_usuarios.append({
                    "alias": alias,
                    "id_usuario": uid,
                    "auth_user_id": str(auth_id) if auth_id else None,
                    "ci": ci,
                    "id_rol": u["id_rol"],
                    "id_sucursal": u["id_sucursal"],
                    "puede_ver_todas": u["puede_ver_todas"]
                })

                credentials_data[alias] = {
                    "ci": ci,
                    "email": f"{ci}@papelblanquita.invalid",
                    "password": base_pwd
                }

        if not dry_run:
            # Guardar manifiesto
            manifest = {
                "tipo": "usuarios_prueba_sedes",
                "fecha": datetime.now(timezone.utc).isoformat(),
                "usuarios": manifest_usuarios
            }
            with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
                json.dump(manifest, f, indent=2)
            print(f"[OK] Manifiesto guardado en: {MANIFEST_FILE}")

            if credentials_data:
                with open(CREDENTIALS_FILE, "w", encoding="utf-8") as f:
                    json.dump(credentials_data, f, indent=2)
                print(f"[OK] Credenciales seguras guardadas en archivo local ignorado por git.")
        else:
            print("[DRY-RUN] Simulación completa. No se modificó la base de datos.")

    except Exception as e:
        db.rollback()
        print(f"ERROR durante la siembra de usuarios: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sembrar usuarios de prueba de sedes.")
    parser.add_argument("--dry-run", action="store_true", help="Simular sin persistir")
    args = parser.parse_args()
    seed_usuarios(dry_run=args.dry_run)
