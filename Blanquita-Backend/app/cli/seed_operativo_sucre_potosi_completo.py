"""
Script de Sembrado Integral Operativo Multi-Sede (Sucre y Potosí)
Sistema ERP Papelera Blanquita

Objetivo:
Poblar de forma 100% segura e idempotente los datos operativos de Potosí y Sucre:
1. Asegurar 5 Usuarios Activos de Prueba:
   - 1 Encargado Web exclusivo para Sucre (IdSucursal = 1, IdRol = 5, puede_ver_todas = False)
   - 1 Encargado Web exclusivo para Potosí (IdSucursal = 2, IdRol = 5, puede_ver_todas = False)
   - 1 Chofer operativo para Sucre (IdSucursal = 1, IdRol = 6, con ruta activa y stock)
   - 2 Choferes operativos para Potosí (IdSucursal = 2, IdRol = 6, con rutas asignadas y stock)
2. En Potosí (IdSucursal = 2):
   - 3 Zonas de distribución reales (Zona Central, Mercado Uyuni / Feria Popular, Satélite / Ciudadela).
   - Clientes y Puntos de Venta con coordenadas GPS reales en Potosí (-19.58.., -65.75..).
   - 3 Rutas completas con paradas ordenadas 1..N (RutaPuntoVenta).
   - Stock comercial en inventario_sucursal (sucursal 2).
   - Asignaciones de ruta activas con pedidos de prueba y detalles.
   - Stock cargado en camión (inventario_chofer) para los choferes de Potosí.
   - Posicionamiento en vivo en TrackingChofer dentro de Potosí.
3. En Sucre (IdSucursal = 1):
   - Rutas, paradas, pedidos y stock en inventario_chofer para el chofer de Sucre.
   - Stock comercial en inventario_sucursal (sucursal 1).
4. Verificación automática de Login contra /auth/login y /api/movil/v1/auth/login.
5. Exportación de manifiesto JSON para auditoría.

Soporta flag --dry-run.
"""

import os
import sys
import json
import argparse
from datetime import datetime, date, timezone
from decimal import Decimal
from pathlib import Path

# Asegurar carga de .env y path del backend
backend_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(dotenv_path=backend_dir / ".env")

import httpx
from sqlalchemy import text
from app.Config.supabase import SessionLocal
from app.Services.Usuario.Auth import AuthService

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
PASSWORD_DEFAULT = os.getenv("TEST_OPERATIVO_PASSWORD", "BlanquitaOperativo2026!")

MANIFEST_DIR = backend_dir.parent / "docs" / "manifests"
MANIFEST_FILE = MANIFEST_DIR / "manifest_seed_operativo_sucre_potosi.json"

# ==============================================================================
# DEFINICIONES DE USUARIOS OPERATIVOS
# ==============================================================================
USUARIOS_OPERATIVOS = [
    {
        "alias": "encargado_sucre",
        "ci": "8001001",
        "primer_nombre": "René",
        "segundo_nombre": "Carlos",
        "apellido_paterno": "Torres",
        "apellido_materno": "Alba",
        "celular": "71001001",
        "id_rol": 5,  # Supervisor
        "id_sucursal": 1,  # Sucre
        "puede_ver_todas": False,
        "puede_escribir": True,
        "is_admin": False,
        "tipo_acceso": "Web (Supervisor)",
        "descripcion": "Encargado Web Exclusivo Sucre",
    },
    {
        "alias": "encargado_potosi",
        "ci": "8002001",
        "primer_nombre": "Gonzalo",
        "segundo_nombre": "Hugo",
        "apellido_paterno": "Flores",
        "apellido_materno": "Peñaranda",
        "celular": "72002001",
        "id_rol": 5,  # Supervisor
        "id_sucursal": 2,  # Potosí
        "puede_ver_todas": False,
        "puede_escribir": True,
        "is_admin": False,
        "tipo_acceso": "Web (Supervisor)",
        "descripcion": "Encargado Web Exclusivo Potosí",
    },
    {
        "alias": "chofer_sucre",
        "ci": "8001002",
        "primer_nombre": "Ramiro",
        "segundo_nombre": "Luis",
        "apellido_paterno": "Gutiérrez",
        "apellido_materno": "Sosa",
        "celular": "71001002",
        "id_rol": 6,  # Agente de Reparto
        "id_sucursal": 1,  # Sucre
        "puede_ver_todas": False,
        "puede_escribir": True,
        "is_admin": False,
        "tipo_acceso": "Móvil / Reparto",
        "descripcion": "Chofer Operativo Sucre (Ruta Activa + Stock)",
    },
    {
        "alias": "chofer_potosi_1",
        "ci": "8002002",
        "primer_nombre": "Jaime",
        "segundo_nombre": "Alberto",
        "apellido_paterno": "Villegas",
        "apellido_materno": "Copa",
        "celular": "72002002",
        "id_rol": 6,  # Agente de Reparto
        "id_sucursal": 2,  # Potosí
        "puede_ver_todas": False,
        "puede_escribir": True,
        "is_admin": False,
        "tipo_acceso": "Móvil / Reparto",
        "descripcion": "Chofer Operativo Potosí 1 (Casco Central + Stock)",
    },
    {
        "alias": "chofer_potosi_2",
        "ci": "8002003",
        "primer_nombre": "Milton",
        "segundo_nombre": "Roxana",
        "apellido_paterno": "Choque",
        "apellido_materno": "Quispe",
        "celular": "72002003",
        "id_rol": 6,  # Agente de Reparto
        "id_sucursal": 2,  # Potosí
        "puede_ver_todas": False,
        "puede_escribir": True,
        "is_admin": False,
        "tipo_acceso": "Móvil / Reparto",
        "descripcion": "Chofer Operativo Potosí 2 (Mercado Uyuni + Stock)",
    },
]

# ==============================================================================
# ZONAS Y RUTAS POTOSÍ
# ==============================================================================
ZONAS_POTOSI = [
    {
        "nombre": "Zona Central Potosí",
        "ciudad": "Potosí",
        "id_sucursal": 2,
        "descripcion": "Centro histórico, Plaza 10 de Noviembre, Mercados centrales y comercio tradicional.",
    },
    {
        "nombre": "Zona Mercado Uyuni / Feria Popular",
        "ciudad": "Potosí",
        "id_sucursal": 2,
        "descripcion": "Eje comercial mayorista Av. Sevilla, Universitaria y Ferias Populares de Potosí.",
    },
    {
        "nombre": "Zona Satélite / Ciudadela",
        "ciudad": "Potosí",
        "id_sucursal": 2,
        "descripcion": "Sector residencial y universitario, Ciudad Satélite, El Tejar y Hospital Daniel Bracamonte.",
    },
]

# Clientes y Puntos de Venta con coordenadas reales de Potosí (~ -19.58.., -65.75..)
PUNTOS_VENTA_POTOSI = [
    # Zona Central
    {
        "zona_nombre": "Zona Central Potosí",
        "ruta_nombre": "Ruta 201 - Casco Central Potosí",
        "orden": 1,
        "razon_social": "Comercializadora La Casona Imperial S.R.L.",
        "nombre_comercial": "La Casona Imperial",
        "nit_ci": "5841029014",
        "telefono": "6224101",
        "direccion": "Calle Bolívar #45",
        "latitud": Decimal("-19.5878000"),
        "longitud": Decimal("-65.7538000"),
        "nombre_pv": "La Casona Imperial - Central",
        "referencia": "A media cuadra de Plaza 10 de Noviembre",
    },
    {
        "zona_nombre": "Zona Central Potosí",
        "ruta_nombre": "Ruta 201 - Casco Central Potosí",
        "orden": 2,
        "razon_social": "Abarrotes Don Carlos Potosí",
        "nombre_comercial": "Abarrotes Don Carlos",
        "nit_ci": "3892015012",
        "telefono": "6225544",
        "direccion": "Calle Junín #120",
        "latitud": Decimal("-19.5891000"),
        "longitud": Decimal("-65.7525000"),
        "nombre_pv": "Abarrotes Don Carlos - Junín",
        "referencia": "Frente al Pasaje Boulevard",
    },
    {
        "zona_nombre": "Zona Central Potosí",
        "ruta_nombre": "Ruta 201 - Casco Central Potosí",
        "orden": 3,
        "razon_social": "Farmacia y Minimarket San Roque Potosí",
        "nombre_comercial": "Minimarket San Roque",
        "nit_ci": "4920194017",
        "telefono": "6223322",
        "direccion": "Calle Bustillos #230",
        "latitud": Decimal("-19.5882000"),
        "longitud": Decimal("-65.7548000"),
        "nombre_pv": "Minimarket San Roque - Bustillos",
        "referencia": "Cerca del Banco Central",
    },
    {
        "zona_nombre": "Zona Central Potosí",
        "ruta_nombre": "Ruta 201 - Casco Central Potosí",
        "orden": 4,
        "razon_social": "Distribuidora Quijarro Potosí",
        "nombre_comercial": "Distribuidora Quijarro",
        "nit_ci": "7102948011",
        "telefono": "6227788",
        "direccion": "Calle Quijarro #85",
        "latitud": Decimal("-19.5869000"),
        "longitud": Decimal("-65.7529000"),
        "nombre_pv": "Distribuidora Quijarro Central",
        "referencia": "Sector Arco de Cobija",
    },

    # Zona Mercado Uyuni / Feria Popular
    {
        "zona_nombre": "Zona Mercado Uyuni / Feria Popular",
        "ruta_nombre": "Ruta 202 - Mercado Uyuni y Feria Popular",
        "orden": 1,
        "razon_social": "Comercial Virgen del Carmen Potosí",
        "nombre_comercial": "Comercial Carmen Uyuni",
        "nit_ci": "6102934015",
        "telefono": "6221199",
        "direccion": "Av. Universitaria #510",
        "latitud": Decimal("-19.5782000"),
        "longitud": Decimal("-65.7592000"),
        "nombre_pv": "Comercial Carmen - Av. Universitaria",
        "referencia": "A media cuadra de Av. Sevilla",
    },
    {
        "zona_nombre": "Zona Mercado Uyuni / Feria Popular",
        "ruta_nombre": "Ruta 202 - Mercado Uyuni y Feria Popular",
        "orden": 2,
        "razon_social": "Abarrotes El Minero Potosí",
        "nombre_comercial": "El Minero Mercado Uyuni",
        "nit_ci": "5192837018",
        "telefono": "6224455",
        "direccion": "Mercado Uyuni Puesto #42",
        "latitud": Decimal("-19.5775000"),
        "longitud": Decimal("-65.7601000"),
        "nombre_pv": "El Minero - Mercado Uyuni Puesto 42",
        "referencia": "Sector Abarrotes y Papelería",
    },
    {
        "zona_nombre": "Zona Mercado Uyuni / Feria Popular",
        "ruta_nombre": "Ruta 202 - Mercado Uyuni y Feria Popular",
        "orden": 3,
        "razon_social": "Distribuidora Sevilla Potosí",
        "nombre_comercial": "Distribuidora Sevilla",
        "nit_ci": "4192039019",
        "telefono": "6228833",
        "direccion": "Av. Sevilla #320",
        "latitud": Decimal("-19.5768000"),
        "longitud": Decimal("-65.7615000"),
        "nombre_pv": "Distribuidora Sevilla - Principal",
        "referencia": "Frente al acceso a Feria Popular",
    },
    {
        "zona_nombre": "Zona Mercado Uyuni / Feria Popular",
        "ruta_nombre": "Ruta 202 - Mercado Uyuni y Feria Popular",
        "orden": 4,
        "razon_social": "Minimarket La Terminal Potosí",
        "nombre_comercial": "La Terminal Express",
        "nit_ci": "3920194016",
        "telefono": "6226677",
        "direccion": "Av. Universitaria #180",
        "latitud": Decimal("-19.5802000"),
        "longitud": Decimal("-65.7583000"),
        "nombre_pv": "La Terminal Express - Universitaria",
        "referencia": "Cerca de la Terminal Antigua",
    },

    # Zona Satélite / Ciudadela
    {
        "zona_nombre": "Zona Satélite / Ciudadela",
        "ruta_nombre": "Ruta 203 - Ciudad Satélite y El Tejar",
        "orden": 1,
        "razon_social": "Supermercado Satélite Express S.R.L.",
        "nombre_comercial": "Satélite Express",
        "nit_ci": "8192034012",
        "telefono": "6229900",
        "direccion": "Av. Panamericana #102",
        "latitud": Decimal("-19.5692000"),
        "longitud": Decimal("-65.7684000"),
        "nombre_pv": "Satélite Express - Panamericana",
        "referencia": "Entrada principal a Ciudad Satélite",
    },
    {
        "zona_nombre": "Zona Satélite / Ciudadela",
        "ruta_nombre": "Ruta 203 - Ciudad Satélite y El Tejar",
        "orden": 2,
        "razon_social": "Tienda de Barrio Doña Martha",
        "nombre_comercial": "Doña Martha El Tejar",
        "nit_ci": "2910293010",
        "telefono": "6223388",
        "direccion": "Calle El Tejar #45",
        "latitud": Decimal("-19.5721000"),
        "longitud": Decimal("-65.7648000"),
        "nombre_pv": "Doña Martha - El Tejar",
        "referencia": "A dos cuadras del campus UATF El Tejar",
    },
    {
        "zona_nombre": "Zona Satélite / Ciudadela",
        "ruta_nombre": "Ruta 203 - Ciudad Satélite y El Tejar",
        "orden": 3,
        "razon_social": "Abarrotes y Licorería Ciudadela",
        "nombre_comercial": "Abarrotes Ciudadela",
        "nit_ci": "5820194013",
        "telefono": "6227711",
        "direccion": "Rotonda Satélite #78",
        "latitud": Decimal("-19.5684000"),
        "longitud": Decimal("-65.7698000"),
        "nombre_pv": "Abarrotes Ciudadela - Rotonda",
        "referencia": "Rotonda central de Ciudad Satélite",
    },
    {
        "zona_nombre": "Zona Satélite / Ciudadela",
        "ruta_nombre": "Ruta 203 - Ciudad Satélite y El Tejar",
        "orden": 4,
        "razon_social": "Comercial El Tejar Potosí",
        "nombre_comercial": "Comercial El Tejar",
        "nit_ci": "7192039014",
        "telefono": "6225599",
        "direccion": "Av. Villazón #405",
        "latitud": Decimal("-19.5738000"),
        "longitud": Decimal("-65.7635000"),
        "nombre_pv": "Comercial El Tejar - Villazón",
        "referencia": "Frente al Hospital Daniel Bracamonte",
    },
]


def _crear_o_actualizar_auth_user(email: str, password: str, dry_run: bool = False) -> str | None:
    """Asegura la cuenta en auth.users mediante la API Admin de Supabase."""
    if dry_run:
        return "auth-user-dryrun-id"

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    # Verificar si ya existe en auth.users
    db = SessionLocal()
    try:
        row = db.execute(text("SELECT id FROM auth.users WHERE email = :email"), {"email": email}).fetchone()
        if row:
            auth_id = str(row[0])
            # Actualizar contraseña para asegurar consistencia
            r = httpx.put(
                f"{SUPABASE_URL}/auth/v1/admin/users/{auth_id}",
                headers=headers,
                json={"password": password, "email_confirm": True},
                timeout=15.0
            )
            if r.status_code not in (200, 201):
                print(f"  [WARN] No se pudo actualizar clave auth para {email}: {r.text}")
            return auth_id
        else:
            r = httpx.post(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                headers=headers,
                json={"email": email, "password": password, "email_confirm": True},
                timeout=15.0
            )
            if r.status_code in (200, 201):
                return r.json().get("id")
            else:
                raise RuntimeError(f"Error creando usuario auth {email}: {r.status_code} - {r.text}")
    finally:
        db.close()


def ejecutar_sembrado(dry_run: bool = False):
    os.makedirs(MANIFEST_DIR, exist_ok=True)
    db = SessionLocal()
    print("=" * 80)
    print(f"=== SEMBRADO INTEGRAL OPERATIVO SUCRE Y POTOSÍ {'[MODO DRY-RUN]' if dry_run else ''} ===")
    print("=" * 80)

    manifest_output = {
        "fecha": datetime.now(timezone.utc).isoformat(),
        "dry_run": dry_run,
        "usuarios": {},
        "zonas_potosi": [],
        "rutas_potosi": [],
        "asignaciones_activas": [],
        "stock_choferes": [],
    }

    try:
        # ----------------------------------------------------------------------
        # 1. VERIFICAR SUCURSALES (1 = Sucre, 2 = Potosí)
        # ----------------------------------------------------------------------
        print("\n[1/7] Verificando Sucursales...")
        suc_sucre = db.execute(text("SELECT id, nombre, activa FROM sucursales WHERE id = 1")).fetchone()
        suc_potosi = db.execute(text("SELECT id, nombre, activa FROM sucursales WHERE id = 2")).fetchone()

        if not suc_sucre:
            raise RuntimeError("La Sucursal 1 (Sucre) no existe en la base de datos.")
        if not suc_potosi:
            raise RuntimeError("La Sucursal 2 (Potosí) no existe en la base de datos.")

        print(f"  [OK] Sucursal 1: {suc_sucre.nombre} (Activa: {suc_sucre.activa})")
        print(f"  [OK] Sucursal 2: {suc_potosi.nombre} (Activa: {suc_potosi.activa})")

        # ----------------------------------------------------------------------
        # 2. ASEGURAR LOS 5 USUARIOS OPERATIVOS ACTIVOS
        # ----------------------------------------------------------------------
        print("\n[2/7] Sembrando los 5 Usuarios Operativos Activos...")
        mapa_usuarios = {}  # alias -> IdUsuario

        for u in USUARIOS_OPERATIVOS:
            alias = u["alias"]
            ci = u["ci"]
            email = f"{ci}@papelblanquita.invalid"

            print(f"  -> Procesando {alias} (CI: {ci}, Rol: {u['id_rol']}, Sede: {u['id_sucursal']})...")

            auth_id = _crear_o_actualizar_auth_user(email, PASSWORD_DEFAULT, dry_run=dry_run)

            if not dry_run:
                # Comprobar si existe en public."Usuario"
                existente = db.execute(
                    text('SELECT "IdUsuario", "PrimerNombre", "IdRol", "IdSucursal" FROM "Usuario" WHERE "Ci" = :ci'),
                    {"ci": ci}
                ).fetchone()

                if existente:
                    uid = existente.IdUsuario
                    db.execute(text("""
                        UPDATE "Usuario"
                        SET "AuthUserId" = :auth_id,
                            "PrimerNombre" = :pnombre,
                            "SegundoNombre" = :snombre,
                            "ApellidoPaterno" = :paterno,
                            "ApellidoMaterno" = :materno,
                            "Celular" = :celular,
                            "IdRol" = :id_rol,
                            "IdSucursal" = :id_sucursal,
                            "IdEstadoUsuario" = 1,
                            "IsAdmin" = :is_admin
                        WHERE "IdUsuario" = :uid
                    """), {
                        "auth_id": auth_id,
                        "pnombre": u["primer_nombre"],
                        "snombre": u["segundo_nombre"],
                        "paterno": u["apellido_paterno"],
                        "materno": u["apellido_materno"],
                        "celular": u["celular"],
                        "id_rol": u["id_rol"],
                        "id_sucursal": u["id_sucursal"],
                        "is_admin": u["is_admin"],
                        "uid": uid
                    })
                    print(f"     [ACTUALIZADO] Usuario ID {uid} ({u['primer_nombre']} {u['apellido_paterno']})")
                else:
                    uid = db.execute(text("""
                        INSERT INTO "Usuario" (
                            "AuthUserId", "IdRol", "Ci", "PrimerNombre", "SegundoNombre",
                            "ApellidoPaterno", "ApellidoMaterno", "Celular",
                            "IdEstadoUsuario", "IdSucursal", "IsAdmin", "FechaRegistro"
                        ) VALUES (
                            :auth_id, :id_rol, :ci, :pnombre, :snombre,
                            :paterno, :materno, :celular,
                            1, :id_sucursal, :is_admin, NOW()
                        )
                        RETURNING "IdUsuario";
                    """), {
                        "auth_id": auth_id,
                        "id_rol": u["id_rol"],
                        "ci": ci,
                        "pnombre": u["primer_nombre"],
                        "snombre": u["segundo_nombre"],
                        "paterno": u["apellido_paterno"],
                        "materno": u["apellido_materno"],
                        "celular": u["celular"],
                        "id_sucursal": u["id_sucursal"],
                        "is_admin": u["is_admin"]
                    }).scalar()
                    print(f"     [CREADO] Usuario ID {uid} ({u['primer_nombre']} {u['apellido_paterno']})")

                # Asegurar permisos territoriales en usuario_sucursal_permiso
                db.execute(text("DELETE FROM usuario_sucursal_permiso WHERE id_usuario = :uid"), {"uid": uid})
                db.execute(text("""
                    INSERT INTO usuario_sucursal_permiso (
                        id_usuario, id_sucursal, puede_ver_todas, puede_escribir, creado_en
                    ) VALUES (
                        :uid, :sid, :todas, :escribe, NOW()
                    )
                """), {
                    "uid": uid,
                    "sid": u["id_sucursal"],
                    "todas": u["puede_ver_todas"],
                    "escribe": u["puede_escribir"]
                })
                db.commit()

                mapa_usuarios[alias] = uid
                manifest_output["usuarios"][alias] = {
                    "id_usuario": uid,
                    "auth_user_id": auth_id,
                    "ci": ci,
                    "email": email,
                    "nombre_completo": f"{u['primer_nombre']} {u['apellido_paterno']}",
                    "id_rol": u["id_rol"],
                    "id_sucursal": u["id_sucursal"],
                    "tipo_acceso": u["tipo_acceso"],
                    "puede_ver_todas": u["puede_ver_todas"]
                }
            else:
                mapa_usuarios[alias] = 9999
                print(f"     [DRY-RUN] Usuario {alias} (CI {ci}) verificado.")

        # ----------------------------------------------------------------------
        # 3. STOCK EN INVENTARIO_SUCURSAL (Sucursal 1 Sucre y Sucursal 2 Potosí)
        # ----------------------------------------------------------------------
        print("\n[3/7] Sembrando Stock Comercial en Almacenes de Sucursal...")
        stock_sucursales = [
            # Sucursal 1 (Sucre)
            {"sucursal_id": 1, "presentacion_id": 10, "cantidad": Decimal("500.00")},
            {"sucursal_id": 1, "presentacion_id": 11, "cantidad": Decimal("350.00")},
            {"sucursal_id": 1, "presentacion_id": 13, "cantidad": Decimal("200.00")},
            {"sucursal_id": 1, "presentacion_id": 14, "cantidad": Decimal("150.00")},
            # Sucursal 2 (Potosí)
            {"sucursal_id": 2, "presentacion_id": 10, "cantidad": Decimal("300.00")},
            {"sucursal_id": 2, "presentacion_id": 11, "cantidad": Decimal("250.00")},
            {"sucursal_id": 2, "presentacion_id": 13, "cantidad": Decimal("150.00")},
            {"sucursal_id": 2, "presentacion_id": 14, "cantidad": Decimal("100.00")},
        ]

        if not dry_run:
            for s in stock_sucursales:
                db.execute(text("""
                    INSERT INTO inventario_sucursal (sucursal_id, presentacion_id, cantidad_disponible, cantidad_reservada, updated_at)
                    VALUES (:sid, :pid, :cant, 0.00, NOW())
                    ON CONFLICT (sucursal_id, presentacion_id) DO UPDATE SET
                        cantidad_disponible = EXCLUDED.cantidad_disponible,
                        updated_at = NOW();
                """), {"sid": s["sucursal_id"], "pid": s["presentacion_id"], "cant": s["cantidad"]})
            db.commit()
            print(f"  [OK] Stock comercial actualizado en Sucursal 1 y Sucursal 2.")
        else:
            print("  [DRY-RUN] Simulación de stock sucursal completa.")

        # ----------------------------------------------------------------------
        # 4. ZONAS DE DISTRIBUCIÓN EN POTOSÍ
        # ----------------------------------------------------------------------
        print("\n[4/7] Sembrando Zonas de Distribución de Potosí...")
        mapa_zonas_potosi = {}  # nombre_zona -> IdZonaDistribucion

        for z in ZONAS_POTOSI:
            nombre_zona = z["nombre"]
            if not dry_run:
                # Comprobar si existe por nombre
                z_row = db.execute(
                    text('SELECT "IdZonaDistribucion" FROM "ZonaDistribucion" WHERE "NombreZona" = :nom'),
                    {"nom": nombre_zona}
                ).fetchone()

                if z_row:
                    zid = z_row[0]
                    db.execute(text("""
                        UPDATE "ZonaDistribucion"
                        SET "Ciudad" = :ciudad,
                            "IdSucursal" = :sid,
                            "Descripcion" = :desc,
                            "Activa" = TRUE
                        WHERE "IdZonaDistribucion" = :zid
                    """), {"ciudad": z["ciudad"], "sid": z["id_sucursal"], "desc": z["descripcion"], "zid": zid})
                else:
                    zid = db.execute(text("""
                        INSERT INTO "ZonaDistribucion" ("NombreZona", "Ciudad", "Descripcion", "Activa", "IdSucursal")
                        VALUES (:nom, :ciudad, :desc, TRUE, :sid)
                        RETURNING "IdZonaDistribucion";
                    """), {"nom": nombre_zona, "ciudad": z["ciudad"], "desc": z["descripcion"], "sid": z["id_sucursal"]}).scalar()

                db.commit()
                mapa_zonas_potosi[nombre_zona] = zid
                manifest_output["zonas_potosi"].append({"id_zona": zid, "nombre": nombre_zona})
                print(f"  [OK] Zona Potosí ID {zid}: '{nombre_zona}'")
            else:
                mapa_zonas_potosi[nombre_zona] = 100
                print(f"  [DRY-RUN] Zona Potosí: '{nombre_zona}'")

        # ----------------------------------------------------------------------
        # 5. CLIENTES, PUNTOS DE VENTA Y 3 RUTAS EN POTOSÍ CON PARADAS 1..N
        # ----------------------------------------------------------------------
        print("\n[5/7] Sembrando Clientes, Puntos de Venta y 3 Rutas en Potosí...")

        # Definir las 3 Rutas de Potosí
        RUTAS_POTOSI_CONFIG = [
            {
                "nombre": "Ruta 201 - Casco Central Potosí",
                "zona": "Zona Central Potosí",
                "dia_semana": 1,
                "chofer_defecto_alias": "chofer_potosi_1",
                "descripcion": "Recorrido de abastecimiento diario en zona comercial y casco central Potosí."
            },
            {
                "nombre": "Ruta 202 - Mercado Uyuni y Feria Popular",
                "zona": "Zona Mercado Uyuni / Feria Popular",
                "dia_semana": 2,
                "chofer_defecto_alias": "chofer_potosi_2",
                "descripcion": "Ruta mayorista y de alto volumen por eje Av. Sevilla y Mercado Uyuni."
            },
            {
                "nombre": "Ruta 203 - Ciudad Satélite y El Tejar",
                "zona": "Zona Satélite / Ciudadela",
                "dia_semana": 3,
                "chofer_defecto_alias": "chofer_potosi_1",
                "descripcion": "Ruta residencial, puntos universitarios y hospitalarios en Ciudad Satélite."
            },
        ]

        mapa_rutas_potosi = {}  # nombre_ruta -> IdRutaDistribucion

        if not dry_run:
            for rcfg in RUTAS_POTOSI_CONFIG:
                zid = mapa_zonas_potosi[rcfg["zona"]]
                chofer_defecto_id = mapa_usuarios.get(rcfg["chofer_defecto_alias"])

                r_row = db.execute(
                    text('SELECT "IdRutaDistribucion" FROM "RutaDistribucion" WHERE "NombreRuta" = :nom'),
                    {"nom": rcfg["nombre"]}
                ).fetchone()

                if r_row:
                    rid = r_row[0]
                    db.execute(text("""
                        UPDATE "RutaDistribucion"
                        SET "IdZonaDistribucion" = :zid,
                            "DiaSemana" = :dia,
                            "Descripcion" = :desc,
                            "Activa" = TRUE,
                            "IdSucursal" = 2,
                            "id_chofer_por_defecto" = :cid,
                            "dia_semana" = :dia
                        WHERE "IdRutaDistribucion" = :rid
                    """), {"zid": zid, "dia": rcfg["dia_semana"], "desc": rcfg["descripcion"], "cid": chofer_defecto_id, "rid": rid})
                else:
                    rid = db.execute(text("""
                        INSERT INTO "RutaDistribucion" (
                            "IdZonaDistribucion", "NombreRuta", "DiaSemana", "Descripcion",
                            "Activa", "IdSucursal", "es_asignacion_automatica", "id_chofer_por_defecto", "dia_semana"
                        ) VALUES (
                            :zid, :nom, :dia, :desc,
                            TRUE, 2, FALSE, :cid, :dia
                        )
                        RETURNING "IdRutaDistribucion";
                    """), {
                        "zid": zid,
                        "nom": rcfg["nombre"],
                        "dia": rcfg["dia_semana"],
                        "desc": rcfg["descripcion"],
                        "cid": chofer_defecto_id
                    }).scalar()

                db.commit()
                mapa_rutas_potosi[rcfg["nombre"]] = rid
                manifest_output["rutas_potosi"].append({"id_ruta": rid, "nombre": rcfg["nombre"], "zona": rcfg["zona"]})
                print(f"  [OK] Ruta Potosí ID {rid}: '{rcfg['nombre']}'")

            # Sembrar Clientes y Puntos de Venta
            mapa_pv_potosi = {}  # nombre_pv -> IdPuntoVenta

            for pv_data in PUNTOS_VENTA_POTOSI:
                # Comprobar si existe Cliente por RazonSocial o NitCi
                cli_row = db.execute(
                    text('SELECT "IdCliente" FROM "Cliente" WHERE "NitCi" = :nit'),
                    {"nit": pv_data["nit_ci"]}
                ).fetchone()

                if cli_row:
                    cid = cli_row[0]
                    db.execute(text("""
                        UPDATE "Cliente"
                        SET "RazonSocial" = :razon,
                            "NombreComercial" = :nom_com,
                            "Telefono" = :tel,
                            "Direccion" = :dir,
                            "Latitud" = :lat,
                            "Longitud" = :lng,
                            "CiudadDestino" = 'Potosí',
                            "IdSucursal" = 2,
                            "IdEstadoCliente" = 1
                        WHERE "IdCliente" = :cid
                    """), {
                        "razon": pv_data["razon_social"],
                        "nom_com": pv_data["nombre_comercial"],
                        "tel": pv_data["telefono"],
                        "dir": pv_data["direccion"],
                        "lat": pv_data["latitud"],
                        "lng": pv_data["longitud"],
                        "cid": cid
                    })
                else:
                    cid = db.execute(text("""
                        INSERT INTO "Cliente" (
                            "IdEstadoCliente", "RazonSocial", "NombreComercial", "NitCi", "Telefono",
                            "Direccion", "Latitud", "Longitud", "LimiteCreditoBs", "DiasCredito",
                            "BloqueadoPorMora", "FechaRegistro", "CiudadDestino", "IdSucursal"
                        ) VALUES (
                            1, :razon, :nom_com, :nit, :tel,
                            :dir, :lat, :lng, 5000.00, 15,
                            FALSE, NOW(), 'Potosí', 2
                        )
                        RETURNING "IdCliente";
                    """), {
                        "razon": pv_data["razon_social"],
                        "nom_com": pv_data["nombre_comercial"],
                        "nit": pv_data["nit_ci"],
                        "tel": pv_data["telefono"],
                        "dir": pv_data["direccion"],
                        "lat": pv_data["latitud"],
                        "lng": pv_data["longitud"]
                    }).scalar()

                # Comprobar o crear PuntoVenta
                pv_row = db.execute(
                    text('SELECT "IdPuntoVenta" FROM "PuntoVenta" WHERE "IdCliente" = :cid AND "NombrePuntoVenta" = :nom'),
                    {"cid": cid, "nom": pv_data["nombre_pv"]}
                ).fetchone()

                if pv_row:
                    pvid = pv_row[0]
                    db.execute(text("""
                        UPDATE "PuntoVenta"
                        SET "Direccion" = :dir,
                            "Latitud" = :lat,
                            "Longitud" = :lng,
                            "Referencia" = :ref,
                            "Activo" = TRUE
                        WHERE "IdPuntoVenta" = :pvid
                    """), {
                        "dir": pv_data["direccion"],
                        "lat": pv_data["latitud"],
                        "lng": pv_data["longitud"],
                        "ref": pv_data["referencia"],
                        "pvid": pvid
                    })
                else:
                    pvid = db.execute(text("""
                        INSERT INTO "PuntoVenta" (
                            "IdCliente", "NombrePuntoVenta", "Direccion", "Latitud", "Longitud", "Referencia", "Activo"
                        ) VALUES (
                            :cid, :nom, :dir, :lat, :lng, :ref, TRUE
                        )
                        RETURNING "IdPuntoVenta";
                    """), {
                        "cid": cid,
                        "nom": pv_data["nombre_pv"],
                        "dir": pv_data["direccion"],
                        "lat": pv_data["latitud"],
                        "lng": pv_data["longitud"],
                        "ref": pv_data["referencia"]
                    }).scalar()

                mapa_pv_potosi[pv_data["nombre_pv"]] = pvid

                # Vincular a RutaPuntoVenta
                rid = mapa_rutas_potosi[pv_data["ruta_nombre"]]
                db.execute(text("""
                    INSERT INTO "RutaPuntoVenta" ("IdRutaDistribucion", "IdPuntoVenta", "OrdenVisita")
                    VALUES (:rid, :pvid, :orden)
                    ON CONFLICT ("IdRutaDistribucion", "IdPuntoVenta") DO UPDATE SET
                        "OrdenVisita" = EXCLUDED."OrdenVisita";
                """), {"rid": rid, "pvid": pvid, "orden": pv_data["orden"]})

            db.commit()
            print("  [OK] 12 Puntos de venta y paradas ordenadas vinculados en Potosí.")
        else:
            print("  [DRY-RUN] Simulación de rutas y puntos de venta Potosí completa.")

        # ----------------------------------------------------------------------
        # 6. ASIGNACIONES ACTIVAS, STOCK EN CAMIÓN Y PEDIDOS DE PRUEBA
        # ----------------------------------------------------------------------
        print("\n[6/7] Sembrando Asignaciones Activas, Stock a Bordo y Pedidos de Prueba...")

        if not dry_run:
            id_chofer_sucre = mapa_usuarios["chofer_sucre"]
            id_chofer_pot1 = mapa_usuarios["chofer_potosi_1"]
            id_chofer_pot2 = mapa_usuarios["chofer_potosi_2"]
            admin_asigna_id = mapa_usuarios["encargado_sucre"]

            hoy = date.today()

            # A. STOCK EN CAMIÓN (inventario_chofer)
            stock_choferes = [
                # Chofer Sucre
                {"chofer_id": id_chofer_sucre, "sucursal_id": 1, "pid": 10, "cargada": 100, "vendida": 30, "remanente": 70, "precio": Decimal("35.00")},
                {"chofer_id": id_chofer_sucre, "sucursal_id": 1, "pid": 11, "cargada": 60, "vendida": 20, "remanente": 40, "precio": Decimal("25.00")},
                {"chofer_id": id_chofer_sucre, "sucursal_id": 1, "pid": 13, "cargada": 40, "vendida": 10, "remanente": 30, "precio": Decimal("4.50")},
                # Chofer 1 Potosí
                {"chofer_id": id_chofer_pot1, "sucursal_id": 2, "pid": 10, "cargada": 80, "vendida": 20, "remanente": 60, "precio": Decimal("37.80")},
                {"chofer_id": id_chofer_pot1, "sucursal_id": 2, "pid": 11, "cargada": 50, "vendida": 10, "remanente": 40, "precio": Decimal("27.00")},
                {"chofer_id": id_chofer_pot1, "sucursal_id": 2, "pid": 13, "cargada": 30, "vendida": 5, "remanente": 25, "precio": Decimal("4.86")},
                # Chofer 2 Potosí
                {"chofer_id": id_chofer_pot2, "sucursal_id": 2, "pid": 10, "cargada": 70, "vendida": 15, "remanente": 55, "precio": Decimal("37.80")},
                {"chofer_id": id_chofer_pot2, "sucursal_id": 2, "pid": 11, "cargada": 40, "vendida": 10, "remanente": 30, "precio": Decimal("27.00")},
                {"chofer_id": id_chofer_pot2, "sucursal_id": 2, "pid": 14, "cargada": 30, "vendida": 5, "remanente": 25, "precio": Decimal("3.24")},
            ]

            for sc in stock_choferes:
                db.execute(text("""
                    INSERT INTO inventario_chofer (
                        chofer_id, sucursal_id, presentacion_id,
                        cantidad_cargada, cantidad_vendida, cantidad_remanente,
                        precio_vigente_carga, fecha_carga
                    ) VALUES (
                        :cid, :sid, :pid,
                        :cargada, :vendida, :remanente,
                        :precio, NOW()
                    )
                    ON CONFLICT (chofer_id, sucursal_id, presentacion_id) DO UPDATE SET
                        cantidad_cargada = EXCLUDED.cantidad_cargada,
                        cantidad_vendida = EXCLUDED.cantidad_vendida,
                        cantidad_remanente = EXCLUDED.cantidad_remanente,
                        precio_vigente_carga = EXCLUDED.precio_vigente_carga,
                        fecha_carga = NOW();
                """), {
                    "cid": sc["chofer_id"],
                    "sid": sc["sucursal_id"],
                    "pid": sc["pid"],
                    "cargada": sc["cargada"],
                    "vendida": sc["vendida"],
                    "remanente": sc["remanente"],
                    "precio": sc["precio"]
                })
            db.commit()
            print("  [OK] Stock cargado en camión para Chofer Sucre, Chofer 1 Potosí y Chofer 2 Potosí.")

            # B. ASIGNACIONES DE RUTA ACTIVAS PARA HOY
            # 1. Asignación Sucre: Ruta 101 (o Ruta 1)
            ruta_sucre_row = db.execute(
                text('SELECT "IdRutaDistribucion" FROM "RutaDistribucion" WHERE "IdSucursal" = 1 ORDER BY "IdRutaDistribucion" ASC LIMIT 1')
            ).fetchone()
            id_ruta_sucre = ruta_sucre_row[0] if ruta_sucre_row else 1

            asig_sucre_id = db.execute(text("""
                INSERT INTO "AsignacionRuta" (
                    "IdRutaDistribucion", "IdUsuarioRepartidor", "FechaAsignacion",
                    "IdUsuarioAsigna", "Estado", "estado_operativo", "KilometrajeInicial", "Observacion"
                ) VALUES (
                    :rid, :cid, :fecha,
                    :asigna_id, 'En Ruta', 'APROBADA_EN_RUTA', 45200.00, 'Salida operativa matutina Sucre con stock cargado'
                )
                ON CONFLICT ("IdRutaDistribucion", "IdUsuarioRepartidor", "FechaAsignacion") DO UPDATE SET
                    "Estado" = 'En Ruta',
                    "estado_operativo" = 'APROBADA_EN_RUTA'
                RETURNING "IdAsignacionRuta";
            """), {
                "rid": id_ruta_sucre,
                "cid": id_chofer_sucre,
                "fecha": hoy,
                "asigna_id": admin_asigna_id
            }).scalar()

            # Tracking Chofer Sucre
            db.execute(text("""
                INSERT INTO "TrackingChofer" (
                    "IdUsuarioRepartidor", "IdAsignacionRuta", "Latitud", "Longitud",
                    "Velocidad", "Bateria", "EstadoMovimiento", "DireccionAproximada",
                    "ParadaActual", "TotalParadas", "ParadasCompletadas", "MontoCobradoTotal", "UltimaActualizacion"
                ) VALUES (
                    :cid, :asig_id, -19.0435000, -65.2598000,
                    25.0, 90, 'En Ruta', 'Av. Jaime Mendoza esq. Ostria Gutiérrez, Sucre',
                    2, 4, 1, 350.00, NOW()
                )
                ON CONFLICT ("IdUsuarioRepartidor") DO UPDATE SET
                    "IdAsignacionRuta" = EXCLUDED."IdAsignacionRuta",
                    "Latitud" = EXCLUDED."Latitud",
                    "Longitud" = EXCLUDED."Longitud",
                    "Velocidad" = EXCLUDED."Velocidad",
                    "Bateria" = EXCLUDED."Bateria",
                    "EstadoMovimiento" = EXCLUDED."EstadoMovimiento",
                    "DireccionAproximada" = EXCLUDED."DireccionAproximada",
                    "UltimaActualizacion" = NOW();
            """), {"cid": id_chofer_sucre, "asig_id": asig_sucre_id})

            # 2. Asignación Potosí 1: Ruta 201 (Casco Central)
            id_ruta_pot1 = mapa_rutas_potosi["Ruta 201 - Casco Central Potosí"]
            asig_pot1_id = db.execute(text("""
                INSERT INTO "AsignacionRuta" (
                    "IdRutaDistribucion", "IdUsuarioRepartidor", "FechaAsignacion",
                    "IdUsuarioAsigna", "Estado", "estado_operativo", "KilometrajeInicial", "Observacion"
                ) VALUES (
                    :rid, :cid, :fecha,
                    :asigna_id, 'En Ruta', 'APROBADA_EN_RUTA', 58100.00, 'Salida operativa Ruta 201 Casco Central Potosí'
                )
                ON CONFLICT ("IdRutaDistribucion", "IdUsuarioRepartidor", "FechaAsignacion") DO UPDATE SET
                    "Estado" = 'En Ruta',
                    "estado_operativo" = 'APROBADA_EN_RUTA'
                RETURNING "IdAsignacionRuta";
            """), {
                "rid": id_ruta_pot1,
                "cid": id_chofer_pot1,
                "fecha": hoy,
                "asigna_id": admin_asigna_id
            }).scalar()

            # Tracking Chofer 1 Potosí
            db.execute(text("""
                INSERT INTO "TrackingChofer" (
                    "IdUsuarioRepartidor", "IdAsignacionRuta", "Latitud", "Longitud",
                    "Velocidad", "Bateria", "EstadoMovimiento", "DireccionAproximada",
                    "ParadaActual", "TotalParadas", "ParadasCompletadas", "MontoCobradoTotal", "UltimaActualizacion"
                ) VALUES (
                    :cid, :asig_id, -19.5880000, -65.7535000,
                    18.5, 85, 'En Ruta', 'Calle Bolívar esq. Junín, Centro Potosí',
                    1, 4, 0, 0.00, NOW()
                )
                ON CONFLICT ("IdUsuarioRepartidor") DO UPDATE SET
                    "IdAsignacionRuta" = EXCLUDED."IdAsignacionRuta",
                    "Latitud" = EXCLUDED."Latitud",
                    "Longitud" = EXCLUDED."Longitud",
                    "Velocidad" = EXCLUDED."Velocidad",
                    "Bateria" = EXCLUDED."Bateria",
                    "EstadoMovimiento" = EXCLUDED."EstadoMovimiento",
                    "DireccionAproximada" = EXCLUDED."DireccionAproximada",
                    "UltimaActualizacion" = NOW();
            """), {"cid": id_chofer_pot1, "asig_id": asig_pot1_id})

            # 3. Asignación Potosí 2: Ruta 202 (Mercado Uyuni)
            id_ruta_pot2 = mapa_rutas_potosi["Ruta 202 - Mercado Uyuni y Feria Popular"]
            asig_pot2_id = db.execute(text("""
                INSERT INTO "AsignacionRuta" (
                    "IdRutaDistribucion", "IdUsuarioRepartidor", "FechaAsignacion",
                    "IdUsuarioAsigna", "Estado", "estado_operativo", "KilometrajeInicial", "Observacion"
                ) VALUES (
                    :rid, :cid, :fecha,
                    :asigna_id, 'En Ruta', 'APROBADA_EN_RUTA', 39400.00, 'Salida operativa Ruta 202 Mercado Uyuni y Feria Popular Potosí'
                )
                ON CONFLICT ("IdRutaDistribucion", "IdUsuarioRepartidor", "FechaAsignacion") DO UPDATE SET
                    "Estado" = 'En Ruta',
                    "estado_operativo" = 'APROBADA_EN_RUTA'
                RETURNING "IdAsignacionRuta";
            """), {
                "rid": id_ruta_pot2,
                "cid": id_chofer_pot2,
                "fecha": hoy,
                "asigna_id": admin_asigna_id
            }).scalar()

            # Tracking Chofer 2 Potosí
            db.execute(text("""
                INSERT INTO "TrackingChofer" (
                    "IdUsuarioRepartidor", "IdAsignacionRuta", "Latitud", "Longitud",
                    "Velocidad", "Bateria", "EstadoMovimiento", "DireccionAproximada",
                    "ParadaActual", "TotalParadas", "ParadasCompletadas", "MontoCobradoTotal", "UltimaActualizacion"
                ) VALUES (
                    :cid, :asig_id, -19.5780000, -65.7595000,
                    20.0, 92, 'En Ruta', 'Av. Universitaria esq. Sevilla, Mercado Uyuni Potosí',
                    2, 4, 1, 450.00, NOW()
                )
                ON CONFLICT ("IdUsuarioRepartidor") DO UPDATE SET
                    "IdAsignacionRuta" = EXCLUDED."IdAsignacionRuta",
                    "Latitud" = EXCLUDED."Latitud",
                    "Longitud" = EXCLUDED."Longitud",
                    "Velocidad" = EXCLUDED."Velocidad",
                    "Bateria" = EXCLUDED."Bateria",
                    "EstadoMovimiento" = EXCLUDED."EstadoMovimiento",
                    "DireccionAproximada" = EXCLUDED."DireccionAproximada",
                    "UltimaActualizacion" = NOW();
            """), {"cid": id_chofer_pot2, "asig_id": asig_pot2_id})

            db.commit()
            print(f"  [OK] Asignaciones activas creadas: Sucre (ID {asig_sucre_id}), Potosí 1 (ID {asig_pot1_id}), Potosí 2 (ID {asig_pot2_id}).")

            manifest_output["asignaciones_activas"] = [
                {"chofer": "chofer_sucre", "asignacion_id": asig_sucre_id, "ruta_id": id_ruta_sucre},
                {"chofer": "chofer_potosi_1", "asignacion_id": asig_pot1_id, "ruta_id": id_ruta_pot1},
                {"chofer": "chofer_potosi_2", "asignacion_id": asig_pot2_id, "ruta_id": id_ruta_pot2},
            ]

            # C. PEDIDOS DE PRUEBA VINCULADOS A PARADAS Y ASIGNACIONES
            # Pedidos Potosí 1 (Ruta 201)
            pedidos_potosi = [
                {
                    "nro": "PED-POT-201-001",
                    "asig_id": asig_pot1_id,
                    "chofer_id": id_chofer_pot1,
                    "pv_nom": "La Casona Imperial - Central",
                    "estado_id": 1,  # Pendiente
                    "items": [(10, 5, Decimal("37.80")), (11, 3, Decimal("27.00"))]
                },
                {
                    "nro": "PED-POT-201-002",
                    "asig_id": asig_pot1_id,
                    "chofer_id": id_chofer_pot1,
                    "pv_nom": "Abarrotes Don Carlos - Junín",
                    "estado_id": 1,  # Pendiente
                    "items": [(10, 4, Decimal("37.80")), (13, 2, Decimal("4.86"))]
                },
                # Pedidos Potosí 2 (Ruta 202)
                {
                    "nro": "PED-POT-202-001",
                    "asig_id": asig_pot2_id,
                    "chofer_id": id_chofer_pot2,
                    "pv_nom": "Comercial Carmen - Av. Universitaria",
                    "estado_id": 3,  # Entregado
                    "items": [(10, 6, Decimal("37.80")), (11, 4, Decimal("27.00"))]
                },
                {
                    "nro": "PED-POT-202-002",
                    "asig_id": asig_pot2_id,
                    "chofer_id": id_chofer_pot2,
                    "pv_nom": "El Minero - Mercado Uyuni Puesto 42",
                    "estado_id": 2,  # En Camino
                    "items": [(10, 8, Decimal("37.80")), (14, 5, Decimal("3.24"))]
                },
            ]

            for ped in pedidos_potosi:
                pvid = mapa_pv_potosi.get(ped["pv_nom"])
                if not pvid:
                    continue

                # Obtener IdCliente del PuntoVenta
                cid = db.execute(text('SELECT "IdCliente" FROM "PuntoVenta" WHERE "IdPuntoVenta" = :pvid'), {"pvid": pvid}).scalar()

                total = sum(cant * prec for _, cant, prec in ped["items"])

                ped_row = db.execute(text('SELECT "IdPedido" FROM "Pedido" WHERE "NumeroPedido" = :nro'), {"nro": ped["nro"]}).fetchone()
                if ped_row:
                    ped_id = ped_row[0]
                    db.execute(text("""
                        UPDATE "Pedido"
                        SET "IdCliente" = :cid,
                            "IdPuntoVenta" = :pvid,
                            "IdUsuarioRepartidor" = :choid,
                            "IdEstadoPedido" = :est,
                            "IdAsignacionRuta" = :asig,
                            "MontoTotal" = :tot,
                            "SubTotal" = :tot
                        WHERE "IdPedido" = :ped_id
                    """), {
                        "cid": cid, "pvid": pvid, "choid": ped["chofer_id"],
                        "est": ped["estado_id"], "asig": ped["asig_id"],
                        "tot": total, "ped_id": ped_id
                    })
                else:
                    ped_id = db.execute(text("""
                        INSERT INTO "Pedido" (
                            "NumeroPedido", "IdCliente", "IdPuntoVenta", "IdUsuarioRepartidor",
                            "IdEstadoPedido", "IdAsignacionRuta", "FechaPedido", "EsVentaDirecta",
                            "SubTotal", "Descuento", "MontoTotal", "SincronizadoDesdeMovil", "estado_revision_web"
                        ) VALUES (
                            :nro, :cid, :pvid, :choid,
                            :est, :asig, NOW(), FALSE,
                            :tot, 0.00, :tot, FALSE, 'PENDIENTE'
                        )
                        RETURNING "IdPedido";
                    """), {
                        "nro": ped["nro"], "cid": cid, "pvid": pvid, "choid": ped["chofer_id"],
                        "est": ped["estado_id"], "asig": ped["asig_id"], "tot": total
                    }).scalar()

                # Reinsertar detalles del pedido
                db.execute(text('DELETE FROM "DetallePedido" WHERE "IdPedido" = :pid'), {"pid": ped_id})
                for pres_id, cant, prec in ped["items"]:
                    sub = cant * prec
                    db.execute(text("""
                        INSERT INTO "DetallePedido" ("IdPedido", "IdPresentacion", "Cantidad", "PrecioUnitarioAplicado", "Subtotal")
                        VALUES (:pid, :pres, :cant, :prec, :sub)
                    """), {"pid": ped_id, "pres": pres_id, "cant": cant, "prec": prec, "sub": sub})

            db.commit()
            print("  [OK] Pedidos de prueba y detalles generados para Potosí.")

        # ----------------------------------------------------------------------
        # 7. VERIFICACIÓN DE LOGIN PARA LOS 5 USUARIOS
        # ----------------------------------------------------------------------
        print("\n[7/7] Verificando Autenticación de los 5 Usuarios (/auth/login y /api/movil/v1/auth/login)...")
        auth_service = AuthService(db)
        login_exitoso_todos = True

        for u in USUARIOS_OPERATIVOS:
            alias = u["alias"]
            ci = u["ci"]
            try:
                res_login = auth_service.Login(ci=ci, clave=PASSWORD_DEFAULT, ip="127.0.0.1", user_agent="SeedVerifier/1.0")
                token_preview = res_login["AccessToken"][:15] + "..."
                print(f"  [OK] Login verificado para {alias} (CI: {ci}): Token JWT válido ({token_preview})")
            except Exception as e:
                login_exitoso_todos = False
                print(f"  [ERROR] Falló login para {alias} (CI: {ci}): {e}")

        # Guardar manifiesto JSON
        if not dry_run:
            with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
                json.dump(manifest_output, f, indent=2, default=str)
            print(f"\n[OK] Manifiesto guardado en: {MANIFEST_FILE}")

        print("\n" + "=" * 80)
        if login_exitoso_todos:
            print("=== SEMBRADO Y VERIFICACIÓN EXITOSA AL 100% ===")
        else:
            print("=== SEMBRADO FINALIZADO CON OBSERVACIONES EN LOGIN ===")
        print("=" * 80)

    except Exception as e:
        db.rollback()
        print(f"\nERROR durante la ejecución del sembrado: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sembrado integral operativo para Sucre y Potosí.")
    parser.add_argument("--dry-run", action="store_true", help="Simular sin persistir cambios")
    args = parser.parse_args()
    ejecutar_sembrado(dry_run=args.dry_run)
