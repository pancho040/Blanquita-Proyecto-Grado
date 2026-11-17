"""
Script Idempotente de Sembrado de Usuarios Oficiales de Prueba - Todos los Módulos
Sistema ERP Papelera Blanquita

Módulos cubiertos:
1. Contabilidad & Tesorería:
   - Contador Sucre (Mono-sede Sucre)
   - Contadora Potosí (Mono-sede Potosí)
   - Contador General (Multisede Sucre y Potosí)
2. Logística & Distribución:
   - Supervisor Sucre (Mono-sede Sucre)
   - Supervisor Potosí (Mono-sede Potosí)
   - Supervisor Nacional (Multisede Sucre y Potosí)
   - Choferes Repartidores (Sucre y Potosí con rutas y stock)
3. Recursos Humanos (RRHH):
   - Encargada RRHH Sucre (Mono-sede Sucre)
   - Encargado RRHH Potosí (Mono-sede Potosí)
   - Jefe Nacional RRHH (Multisede Sucre y Potosí)
4. Usuarios Web con Acceso Parcial / Híbrido:
   - Auxiliar Despacho y Cobranzas (Logística + CxC Contabilidad - Sucre)
   - Auxiliar Operaciones y Asistencia (Logística + Asistencia RRHH - Potosí)
   - Auditor de Operaciones (Auditoría CxC + Despachos + Asistencia - Multisede)
   - Auxiliar Tesorería y Personal (Cajas + Asistencia RRHH - Multisede)

Verificación automática de login mediante /auth/login y /api/movil/v1/auth/login.
"""

import os
import sys
import json
import argparse
from datetime import datetime, timezone
from pathlib import Path

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
MANIFEST_FILE = MANIFEST_DIR / "manifest_usuarios_todos_modulos.json"

USUARIOS_SISTEMA = [
    # --------------------------------------------------------------------------
    # CONTABILIDAD & TESORERÍA
    # --------------------------------------------------------------------------
    {
        "alias": "contador_sucre",
        "ci": "8001010",
        "primer_nombre": "Mateo",
        "segundo_nombre": "Alejandro",
        "apellido_paterno": "Morales",
        "apellido_materno": "Ramos",
        "celular": "71001010",
        "id_rol": 4,  # Contador
        "id_sucursal": 1,  # Sucre
        "puede_ver_todas": False,
        "puede_escribir": True,
        "is_admin": False,
        "tipo_acceso": "Web (Contabilidad Sucre)",
        "categoria": "Contabilidad",
        "alcance_territorial": "Exclusivo Sucursal Sucre (IdSucursal = 1)",
        "modulos_permitidos": "Flujo de Caja Sucre, Caja Chica Sucre, Cuentas por Cobrar Sucre, Notas de Venta Sucre",
        "modulos_restringidos": "Bancos Corporativos (403), Cuentas por Pagar Proveedores (403), Datos de Potosí, RRHH, Logística avanzada",
    },
    {
        "alias": "contador_potosi",
        "ci": "8002010",
        "primer_nombre": "Carmen",
        "segundo_nombre": "Elena",
        "apellido_paterno": "Vaca",
        "apellido_materno": "Guzmán",
        "celular": "72002010",
        "id_rol": 4,  # Contador
        "id_sucursal": 2,  # Potosí
        "puede_ver_todas": False,
        "puede_escribir": True,
        "is_admin": False,
        "tipo_acceso": "Web (Contabilidad Potosí)",
        "categoria": "Contabilidad",
        "alcance_territorial": "Exclusivo Sucursal Potosí (IdSucursal = 2)",
        "modulos_permitidos": "Flujo de Caja Potosí, Caja Chica Potosí, Cuentas por Cobrar Potosí, Notas de Venta Potosí",
        "modulos_restringidos": "Bancos Corporativos (403), Cuentas por Pagar Proveedores (403), Datos de Sucre, RRHH, Logística avanzada",
    },
    {
        "alias": "contador_multisede",
        "ci": "8003010",
        "primer_nombre": "Roberto",
        "segundo_nombre": "Carlos",
        "apellido_paterno": "Flores",
        "apellido_materno": "Terán",
        "celular": "73003010",
        "id_rol": 4,  # Contador
        "id_sucursal": 1,  # Sucre (base)
        "puede_ver_todas": True,
        "puede_escribir": True,
        "is_admin": False,
        "tipo_acceso": "Web (Contabilidad Corporativa Multisede)",
        "categoria": "Contabilidad",
        "alcance_territorial": "Multisede (Sucre y Potosí simultáneo)",
        "modulos_permitidos": "Consolidación Contable Sucre + Potosí, Bancos Corporativos, Cuentas por Pagar Proveedores (CXP), Aprobación de Cobros QR, Reportes Financieros Consolidados",
        "modulos_restringidos": "Administración de Roles y Usuarios de Seguridad, Configuración de Planta",
    },

    # --------------------------------------------------------------------------
    # LOGÍSTICA & DISTRIBUCIÓN
    # --------------------------------------------------------------------------
    {
        "alias": "supervisor_sucre",
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
        "tipo_acceso": "Web (Logística Sucre)",
        "categoria": "Logística",
        "alcance_territorial": "Exclusivo Sucursal Sucre (IdSucursal = 1)",
        "modulos_permitidos": "Rutas Sucre, Despachos Sucre, Clientes Sucre, Inventario Comercial Sucre, Envíos y Remisiones Sucre",
        "modulos_restringidos": "Rutas y Despachos de Potosí, Bancos, Cuentas por Pagar, RRHH, Sueldos",
    },
    {
        "alias": "supervisor_potosi",
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
        "tipo_acceso": "Web (Logística Potosí)",
        "categoria": "Logística",
        "alcance_territorial": "Exclusivo Sucursal Potosí (IdSucursal = 2)",
        "modulos_permitidos": "Rutas Potosí (201, 202, 203), Despachos Potosí, Clientes Potosí, Inventario Comercial Potosí",
        "modulos_restringidos": "Rutas y Despachos de Sucre, Bancos, Cuentas por Pagar, RRHH, Sueldos",
    },
    {
        "alias": "supervisor_multisede",
        "ci": "8003020",
        "primer_nombre": "Sergio",
        "segundo_nombre": "Marcelo",
        "apellido_paterno": "Ramos",
        "apellido_materno": "Calvimontes",
        "celular": "73003020",
        "id_rol": 5,  # Supervisor
        "id_sucursal": 1,  # Sucre (base)
        "puede_ver_todas": True,
        "puede_escribir": True,
        "is_admin": False,
        "tipo_acceso": "Web (Logística Nacional Multisede)",
        "categoria": "Logística",
        "alcance_territorial": "Multisede (Sucre y Potosí simultáneo)",
        "modulos_permitidos": "Monitoreo y asignación de rutas Sucre y Potosí, Despachos nacionales, Gestión de Precios comerciales, Traslados inter-sucursales / Remisiones",
        "modulos_restringidos": "Tesorería (Cajas, Bancos, Pagos), Módulo confidencial de RRHH y Sueldos",
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
        "tipo_acceso": "Móvil / Reparto Sucre",
        "categoria": "Logística (Móvil)",
        "alcance_territorial": "Exclusivo Sucursal Sucre (IdSucursal = 1)",
        "modulos_permitidos": "App Móvil Chofer: Hoja de ruta activa, paradas GPS, cobro QR/efectivo, inventario en camión Sucre",
        "modulos_restringidos": "Acceso Web administrativo, operaciones de Potosí",
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
        "tipo_acceso": "Móvil / Reparto Potosí",
        "categoria": "Logística (Móvil)",
        "alcance_territorial": "Exclusivo Sucursal Potosí (IdSucursal = 2)",
        "modulos_permitidos": "App Móvil Chofer: Ruta 201 Casco Central Potosí, paradas GPS, registro de cobros, stock camión Potosí",
        "modulos_restringidos": "Acceso Web administrativo, operaciones de Sucre",
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
        "tipo_acceso": "Móvil / Reparto Potosí",
        "categoria": "Logística (Móvil)",
        "alcance_territorial": "Exclusivo Sucursal Potosí (IdSucursal = 2)",
        "modulos_permitidos": "App Móvil Chofer: Ruta 202 Mercado Uyuni Potosí, paradas GPS, pedidos y stock camión Potosí",
        "modulos_restringidos": "Acceso Web administrativo, operaciones de Sucre",
    },

    # --------------------------------------------------------------------------
    # RECURSOS HUMANOS (RRHH)
    # --------------------------------------------------------------------------
    {
        "alias": "rrhh_sucre",
        "ci": "8001030",
        "primer_nombre": "Patricia",
        "segundo_nombre": "Eugenia",
        "apellido_paterno": "Morales",
        "apellido_materno": "Soliz",
        "celular": "71001030",
        "id_rol": 5,  # Supervisor con IsAdmin para módulo RRHH
        "id_sucursal": 1,  # Sucre
        "puede_ver_todas": False,
        "puede_escribir": True,
        "is_admin": True,
        "tipo_acceso": "Web (RRHH Sucre)",
        "categoria": "Recursos Humanos",
        "alcance_territorial": "Exclusivo Sucursal Sucre (IdSucursal = 1)",
        "modulos_permitidos": "Control de Asistencia Biométrico Sucre, Cronograma de Turnos Sucre, Registro y datos laborales de personal Sucre",
        "modulos_restringidos": "Personal y Asistencia de Potosí (bloqueo automático 404/403 en backend), Administración de Roles (exclusivo Gerente IdRol 3), Bancos y Tesorería",
    },
    {
        "alias": "rrhh_potosi",
        "ci": "8002030",
        "primer_nombre": "Javier",
        "segundo_nombre": "Fernando",
        "apellido_paterno": "Paredes",
        "apellido_materno": "Cruz",
        "celular": "72002030",
        "id_rol": 5,  # Supervisor con IsAdmin para módulo RRHH
        "id_sucursal": 2,  # Potosí
        "puede_ver_todas": False,
        "puede_escribir": True,
        "is_admin": True,
        "tipo_acceso": "Web (RRHH Potosí)",
        "categoria": "Recursos Humanos",
        "alcance_territorial": "Exclusivo Sucursal Potosí (IdSucursal = 2)",
        "modulos_permitidos": "Control de Asistencia Biométrico Potosí, Cronograma de Turnos Potosí, Registro de personal local Potosí",
        "modulos_restringidos": "Personal y Asistencia de Sucre, Administración de Roles (/admin/roles bloqueado), Bancos y Cuentas por Pagar",
    },
    {
        "alias": "rrhh_multisede",
        "ci": "8003030",
        "primer_nombre": "Valeria",
        "segundo_nombre": "Andrea",
        "apellido_paterno": "Mercado",
        "apellido_materno": "Paz",
        "celular": "73003030",
        "id_rol": 5,  # Supervisor con IsAdmin para módulo RRHH
        "id_sucursal": 1,  # Sucre (base)
        "puede_ver_todas": True,
        "puede_escribir": True,
        "is_admin": True,
        "tipo_acceso": "Web (RRHH Nacional Multisede)",
        "categoria": "Recursos Humanos",
        "alcance_territorial": "Multisede (Sucre y Potosí simultáneo)",
        "modulos_permitidos": "Dashboard RRHH Nacional, Nómina y Planillas Salariales Sucre y Potosí, Cálculo de Finiquitos, Configuración de Políticas Laborales y AFP, Turnos y Asistencia consolidada",
        "modulos_restringidos": "Administración de Roles del Sistema (/admin/roles exclusivo Don Osvaldo IdRol 3), Cuentas Bancarias Corporativas",
    },

    # --------------------------------------------------------------------------
    # USUARIOS WEB CON ACCESO PARCIAL / HÍBRIDO (GRANULAR)
    # --------------------------------------------------------------------------
    {
        "alias": "hibrido_despacho_cxc_sucre",
        "ci": "8001040",
        "primer_nombre": "Andrea",
        "segundo_nombre": "Sofía",
        "apellido_paterno": "Durán",
        "apellido_materno": "Méndez",
        "celular": "71001040",
        "id_rol": 5,  # Supervisor
        "id_sucursal": 1,  # Sucre
        "puede_ver_todas": False,
        "puede_escribir": True,
        "is_admin": False,
        "tipo_acceso": "Web (Híbrido: Despacho + Cobranzas Sucre)",
        "categoria": "Acceso Parcial / Híbrido",
        "alcance_territorial": "Exclusivo Sucursal Sucre (IdSucursal = 1)",
        "modulos_permitidos": "• Logística: Clientes Sucre, Despachos (/supervisor/asignaciones), Inventario Comercial (/supervisor/inventario-comercial).\n• Contabilidad: Consulta de Notas de Venta (/cxc/notas-venta) y Carteras por Cobrar de pedidos.",
        "modulos_restringidos": "• Contabilidad: Flujo de Caja y Bancos bloqueados (403), Vales de Caja Chica.\n• RRHH: Sin acceso (requiere permisos admin).\n• Territorial: Sin acceso a datos de Potosí.",
    },
    {
        "alias": "hibrido_operaciones_asistencia_potosi",
        "ci": "8002040",
        "primer_nombre": "Mauricio",
        "segundo_nombre": "José",
        "apellido_paterno": "Alarcón",
        "apellido_materno": "Pinto",
        "celular": "72002040",
        "id_rol": 5,  # Supervisor
        "id_sucursal": 2,  # Potosí
        "puede_ver_todas": False,
        "puede_escribir": True,
        "is_admin": True,
        "tipo_acceso": "Web (Híbrido: Rutas + Asistencia Potosí)",
        "categoria": "Acceso Parcial / Híbrido",
        "alcance_territorial": "Exclusivo Sucursal Potosí (IdSucursal = 2)",
        "modulos_permitidos": "• Logística: Trazado y monitoreo de Rutas en Potosí (/supervisor/rutas), Clientes Potosí.\n• RRHH: Control de Asistencia diaria (/admin/rrhh/asistencia) y Cronograma de Turnos (/admin/rrhh/turnos) de Potosí.",
        "modulos_restringidos": "• RRHH: Sin acceso a Planillas salariales confidenciales ni Finiquitos.\n• Contabilidad: Sin acceso a Tesorería, Cajas ni Bancos.\n• Territorial: Sin acceso a datos de Sucre.",
    },
    {
        "alias": "hibrido_auditor_operaciones_multisede",
        "ci": "8003040",
        "primer_nombre": "Álvaro",
        "segundo_nombre": "Esteban",
        "apellido_paterno": "Campero",
        "apellido_materno": "Daza",
        "celular": "73003040",
        "id_rol": 5,  # Supervisor
        "id_sucursal": 1,  # Sucre (base)
        "puede_ver_todas": True,
        "puede_escribir": True,
        "is_admin": True,
        "tipo_acceso": "Web (Híbrido: Auditoría Operaciones Multisede)",
        "categoria": "Acceso Parcial / Híbrido",
        "alcance_territorial": "Multisede (Sucre y Potosí simultáneo)",
        "modulos_permitidos": "• Contabilidad: Consulta de Notas de Venta, Saldos por Cobrar y Arqueos en ambas sedes.\n• Logística: Supervisión de Despachos, Inventario Comercial y Remisiones entre sucursales.\n• RRHH: Auditoría de Control de Asistencia y Turnos de ambas sedes.",
        "modulos_restringidos": "• Contabilidad: Bloqueada emisión de pagos y transferencias bancarias corporativas.\n• RRHH: Bloqueada alteración de sueldos básicos y finiquitos.\n• Seguridad: Bloqueada gestión de roles (/admin/roles).",
    },
    {
        "alias": "hibrido_tesoreria_personal_multisede",
        "ci": "8003050",
        "primer_nombre": "Gabriela",
        "segundo_nombre": "Beatriz",
        "apellido_paterno": "Salinas",
        "apellido_materno": "Rios",
        "celular": "73003050",
        "id_rol": 4,  # Contador
        "id_sucursal": 1,  # Sucre (base)
        "puede_ver_todas": True,
        "puede_escribir": True,
        "is_admin": True,
        "tipo_acceso": "Web (Híbrido: Tesorería + Turnos Multisede)",
        "categoria": "Acceso Parcial / Híbrido",
        "alcance_territorial": "Multisede (Sucre y Potosí simultáneo)",
        "modulos_permitidos": "• Contabilidad: Flujo de Caja, Vales de Caja Chica y Cuentas por Cobrar en Sucre y Potosí.\n• RRHH: Consulta de Turnos de planta y Asistencia del personal.\n• Logística: Consulta de listas de Precios de venta.",
        "modulos_restringidos": "• Logística: Sin facultades para crear o despachar camiones ni modificar paradas.\n• RRHH: Sin aprobación de finiquitos ni planillas salariales.",
    },
]


def _crear_o_actualizar_auth_user(email: str, password: str, dry_run: bool = False) -> str | None:
    if dry_run:
        return "auth-user-dryrun-id"

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    db = SessionLocal()
    try:
        row = db.execute(text("SELECT id FROM auth.users WHERE email = :email"), {"email": email}).fetchone()
        if row:
            auth_id = str(row[0])
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
    print(f"=== SIEMBRA OFICIAL DE USUARIOS DE PRUEBA - TODOS LOS MÓDULOS {'[DRY-RUN]' if dry_run else ''} ===")
    print("=" * 80)

    manifest_usuarios = []

    try:
        for u in USUARIOS_SISTEMA:
            alias = u["alias"]
            ci = u["ci"]
            email = f"{ci}@papelblanquita.invalid"
            nombre_completo = f"{u['primer_nombre']} {u['segundo_nombre']} {u['apellido_paterno']} {u['apellido_materno']}".replace("  ", " ").strip()

            print(f"\n-> Procesando: {nombre_completo} ({alias})")
            print(f"   CI: {ci} | Rol: {u['id_rol']} | Sede: {u['id_sucursal']} | Multisede: {u['puede_ver_todas']} | IsAdmin: {u['is_admin']}")

            auth_id = _crear_o_actualizar_auth_user(email, PASSWORD_DEFAULT, dry_run=dry_run)

            if not dry_run:
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
                        "uid": uid,
                    })
                    print(f"   [ACTUALIZADO en public.Usuario] ID {uid}")
                else:
                    res = db.execute(text("""
                        INSERT INTO "Usuario" (
                            "AuthUserId", "IdRol", "Ci", "PrimerNombre", "SegundoNombre",
                            "ApellidoPaterno", "ApellidoMaterno", "Celular",
                            "IdEstadoUsuario", "IdSucursal", "IsAdmin", "FechaRegistro"
                        ) VALUES (
                            :auth_id, :id_rol, :ci, :pnombre, :snombre,
                            :paterno, :materno, :celular,
                            1, :id_sucursal, :is_admin, NOW()
                        ) RETURNING "IdUsuario"
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
                        "is_admin": u["is_admin"],
                    })
                    uid = res.fetchone()[0]
                    print(f"   [CREADO en public.Usuario] ID {uid}")

                # Asegurar usuario_sucursal_permiso
                db.execute(text("DELETE FROM usuario_sucursal_permiso WHERE id_usuario = :uid"), {"uid": uid})
                
                # Para usuarios multisede (puede_ver_todas=True), insertamos fila con id_sucursal=None
                # Para usuarios mono-sede, insertamos con su id_sucursal
                sid_permiso = None if u["puede_ver_todas"] else u["id_sucursal"]
                db.execute(text("""
                    INSERT INTO usuario_sucursal_permiso (id_usuario, id_sucursal, puede_ver_todas, puede_escribir, creado_en)
                    VALUES (:uid, :sid, :todas, :escribe, NOW())
                """), {
                    "uid": uid,
                    "sid": sid_permiso,
                    "todas": u["puede_ver_todas"],
                    "escribe": u["puede_escribir"]
                })
                db.commit()
                print(f"   [PERMISOS SUCURSAL] id_usuario {uid} -> Sede: {sid_permiso}, puede_ver_todas: {u['puede_ver_todas']}")
            else:
                uid = 9999

            manifest_usuarios.append({
                "alias": alias,
                "id_usuario": uid,
                "ci": ci,
                "nombre_completo": nombre_completo,
                "id_rol": u["id_rol"],
                "id_sucursal": u["id_sucursal"],
                "puede_ver_todas": u["puede_ver_todas"],
                "is_admin": u["is_admin"],
                "tipo_acceso": u["tipo_acceso"],
                "categoria": u["categoria"],
                "modulos_permitidos": u["modulos_permitidos"],
                "modulos_restringidos": u["modulos_restringidos"]
            })

        if not dry_run:
            manifest_data = {
                "fecha": datetime.now(timezone.utc).isoformat(),
                "usuarios": manifest_usuarios
            }
            with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
                json.dump(manifest_data, f, indent=2, ensure_ascii=False)
            print(f"\n[OK] Manifiesto guardado en: {MANIFEST_FILE}")

        # ----------------------------------------------------------------------
        # VERIFICACIÓN DE LOGIN
        # ----------------------------------------------------------------------
        print("\n" + "=" * 80)
        print("=== VERIFICACIÓN AUTOMÁTICA DE LOGIN DE LOS USUARIOS CREADOS ===")
        print("=" * 80)

        auth_service = AuthService(db)
        login_exitosos = 0
        total_a_probar = len(USUARIOS_SISTEMA)

        for u in USUARIOS_SISTEMA:
            ci = u["ci"]
            alias = u["alias"]
            if dry_run:
                print(f"  [DRY-RUN] Login simulado para CI {ci} ({alias})")
                continue

            try:
                login_res = auth_service.Login(ci, PASSWORD_DEFAULT, ip="127.0.0.1", user_agent="SeedVerifier/1.0")
                if login_res.get("AccessToken"):
                    login_exitosos += 1
                    print(f"  [LOGIN OK] CI {ci} ({alias}) -> Token JWT generado exitosamente")
                else:
                    print(f"  [LOGIN FALLO] CI {ci} ({alias}) -> Sin token")
            except Exception as e:
                print(f"  [LOGIN ERROR] CI {ci} ({alias}) -> {e}")

        print(f"\nResultado Login: {login_exitosos}/{total_a_probar} usuarios autenticados correctamente.")

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR CRÍTICO] {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sembrar usuarios oficiales de prueba para todos los módulos.")
    parser.add_argument("--dry-run", action="store_true", help="Simular sin modificar la base de datos")
    args = parser.parse_args()
    ejecutar_sembrado(dry_run=args.dry_run)
