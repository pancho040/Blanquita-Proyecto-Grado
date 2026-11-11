import sys
from pathlib import Path

# Asegurar que el directorio raíz del backend esté en sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from typing import Optional, Union
import pytest
from fastapi import HTTPException, status, Query
from fastapi.testclient import TestClient
from app.main import app
from app.Auth.Dependencies import get_current_user, require_admin_db

import app.Config.supabase as supabase_module
from app.Config.supabase import engine, get_db
from sqlalchemy.orm import Session

@pytest.fixture(autouse=True)
def db_session_rollback(monkeypatch):
    """
    Garantiza aislamiento transaccional total (Opción A):
    Abre una conexión con una transacción externa y crea una sesión SQLAlchemy
    con join_transaction_mode='create_savepoint'.
    Sobrescribe la dependencia get_db y SessionLocal para que toda la app y los tests
    usen esta conexión transaccional compartida.
    Al finalizar cada test, se ejecuta transaction.rollback(), asegurando que ningún cambio persista en disco.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")

    def _get_db_override():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = _get_db_override

    # Patch SessionLocal to ensure any direct SessionLocal() calls in tests also join the transaction
    monkeypatch.setattr(
        supabase_module,
        "SessionLocal",
        lambda: Session(bind=connection, join_transaction_mode="create_savepoint")
    )

    yield session

    session.close()
    transaction.rollback()
    connection.close()
    app.dependency_overrides.pop(get_db, None)

def _deny_admin_access():
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Requiere permisos de administrador"
    )

from app.Constants.Roles import (
    ROL_GERENTE_GENERAL,
    ROL_CONTADOR,
    ROL_SUPERVISOR,
    ROL_AGENTE_REPARTO,
)

@pytest.fixture
def user_admin():
    return {
        "IdUsuario": 12,
        "IdRol": ROL_GERENTE_GENERAL,
        "IsAdmin": True,
        "IdSucursal": 1,
        "Correo": "admin@blanquita.com",
        "IdEstadoUsuario": 1,
    }

@pytest.fixture
def user_contador():
    return {
        "IdUsuario": 7,
        "IdRol": ROL_CONTADOR,
        "IsAdmin": True,
        "IdSucursal": 1,
        "Correo": "contador@blanquita.com",
        "IdEstadoUsuario": 1,
    }

@pytest.fixture
def user_supervisor():
    return {
        "IdUsuario": 4,
        "IdRol": ROL_SUPERVISOR,
        "IsAdmin": True,
        "IdSucursal": 1,
        "Correo": "supervisor@blanquita.com",
        "IdEstadoUsuario": 1,
    }

@pytest.fixture
def user_chofer():
    return {
        "IdUsuario": 9,
        "IdRol": ROL_AGENTE_REPARTO,
        "IsAdmin": False,
        "IdSucursal": 1,
        "Correo": "chofer1@blanquita.com",
        "IdEstadoUsuario": 1,
    }

@pytest.fixture
def client_admin(user_admin):
    app.dependency_overrides[get_current_user] = lambda: user_admin
    app.dependency_overrides[require_admin_db] = lambda: user_admin
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(require_admin_db, None)

@pytest.fixture
def client_contador(user_contador):
    app.dependency_overrides[get_current_user] = lambda: user_contador
    app.dependency_overrides[require_admin_db] = _deny_admin_access
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(require_admin_db, None)

@pytest.fixture
def client_supervisor(user_supervisor):
    app.dependency_overrides[get_current_user] = lambda: user_supervisor
    app.dependency_overrides[require_admin_db] = _deny_admin_access
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(require_admin_db, None)

@pytest.fixture
def client_chofer(user_chofer):
    app.dependency_overrides[get_current_user] = lambda: user_chofer
    app.dependency_overrides[require_admin_db] = _deny_admin_access
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(require_admin_db, None)

@pytest.fixture
def client_anonimo():
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(require_admin_db, None)
    with TestClient(app) as client:
        yield client

# =============================================================================
# USUARIOS Y CLIENTES DE PRUEBA EXCLUSIVOS PARA CONTROL DE SUCURSALES (FASE 1/2)
# =============================================================================
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal

@pytest.fixture
def user_prueba_sucre():
    """Usuario de prueba de sede fija Sucre (IdSucursal = 1, sin permiso multisede)."""
    return {
        "IdUsuario": 101,
        "PrimerNombre": "Test",
        "ApellidoPaterno": "Sucre",
        "IdRol": ROL_GERENTE_GENERAL,
        "IsAdmin": False,
        "IdSucursal": 1,
        "Correo": "test_sucre@blanquita.com",
        "IdEstadoUsuario": 1,
    }

@pytest.fixture
def user_prueba_potosi():
    """Usuario de prueba de sede fija Potosí (IdSucursal = 2, sin permiso multisede)."""
    return {
        "IdUsuario": 102,
        "PrimerNombre": "Test",
        "ApellidoPaterno": "Potosi",
        "IdRol": ROL_GERENTE_GENERAL,
        "IsAdmin": False,
        "IdSucursal": 2,
        "Correo": "test_potosi@blanquita.com",
        "IdEstadoUsuario": 1,
    }

@pytest.fixture
def user_prueba_multisede():
    """Usuario de prueba multisede (puede_ver_todas = True, sedes 1 y 2)."""
    return {
        "IdUsuario": 100,
        "PrimerNombre": "Test",
        "ApellidoPaterno": "Multisede",
        "IdRol": ROL_GERENTE_GENERAL,
        "IsAdmin": True,
        "IdSucursal": 1,
        "Correo": "test_multi@blanquita.com",
        "IdEstadoUsuario": 1,
    }

def _crear_override_alcance(id_usuario: int, sede_fija: int | None, puede_ver_todas: bool):
    def _override(
        id_sucursal: Optional[str] = Query(None, alias="id_sucursal"),
        sucursal_id: Optional[str] = Query(None, alias="sucursal_id"),
    ):
        solicitada = id_sucursal if id_sucursal is not None else sucursal_id
        sid_limpio = None
        pidio_todas = False
        if solicitada is not None:
            s_str = str(solicitada).strip().lower()
            if s_str in ("todas", "all"):
                pidio_todas = True
            elif s_str not in ("", "null", "none", "0"):
                try:
                    sid_limpio = int(s_str)
                except ValueError:
                    raise HTTPException(status_code=400, detail="Sucursal inválida")

        permitidas = [1, 2] if puede_ver_todas else ([sede_fija] if sede_fija else [])

        if pidio_todas:
            if not puede_ver_todas:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tiene autorización para acceder a la vista consolidada de todas las sucursales."
                )
            efectiva = None
        elif sid_limpio is not None:
            if puede_ver_todas or (sid_limpio in permitidas):
                efectiva = sid_limpio
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"No tiene autorización para acceder a los datos de la sucursal {sid_limpio}."
                )
        else:
            efectiva = None if puede_ver_todas else (permitidas[0] if permitidas else None)

        return AlcanceUsuario(
            id_usuario=id_usuario,
            puede_ver_todas=puede_ver_todas,
            sucursales_permitidas=permitidas,
            sucursal_efectiva=efectiva,
            sucursal_asignada_defecto=sede_fija or 1
        )
    return _override

@pytest.fixture
def client_prueba_sucre(user_prueba_sucre):
    """Cliente HTTP autenticado como usuario de Sucre (sede fija 1, validación activa)."""
    app.dependency_overrides[get_current_user] = lambda: user_prueba_sucre
    app.dependency_overrides[require_admin_db] = lambda: user_prueba_sucre
    app.dependency_overrides[DependenciaAlcanceSucursal] = _crear_override_alcance(101, 1, False)
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(require_admin_db, None)
    app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)

@pytest.fixture
def client_prueba_potosi(user_prueba_potosi):
    """Cliente HTTP autenticado como usuario de Potosí (sede fija 2, validación activa)."""
    app.dependency_overrides[get_current_user] = lambda: user_prueba_potosi
    app.dependency_overrides[require_admin_db] = lambda: user_prueba_potosi
    app.dependency_overrides[DependenciaAlcanceSucursal] = _crear_override_alcance(102, 2, False)
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(require_admin_db, None)
    app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)

@pytest.fixture
def client_prueba_multisede(user_prueba_multisede):
    """Cliente HTTP autenticado como usuario Multisede (Gerencia General, todas las sedes)."""
    app.dependency_overrides[get_current_user] = lambda: user_prueba_multisede
    app.dependency_overrides[require_admin_db] = lambda: user_prueba_multisede
    app.dependency_overrides[DependenciaAlcanceSucursal] = _crear_override_alcance(100, 1, True)
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(require_admin_db, None)
    app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)

@pytest.fixture
def actor_sucursal(user_prueba_sucre, user_prueba_potosi, user_prueba_multisede):
    """
    Permite alternar dinámicamente entre Sucre, Potosí y Multisede dentro del mismo test
    sin reiniciar la sesión HTTP ni perder el aislamiento transaccional rollback de get_db.
    """
    with TestClient(app) as client:
        def _actuar(rol_sede: str):
            if rol_sede == "sucre":
                app.dependency_overrides[get_current_user] = lambda: user_prueba_sucre
                app.dependency_overrides[require_admin_db] = lambda: user_prueba_sucre
                app.dependency_overrides[DependenciaAlcanceSucursal] = _crear_override_alcance(101, 1, False)
            elif rol_sede == "potosi":
                app.dependency_overrides[get_current_user] = lambda: user_prueba_potosi
                app.dependency_overrides[require_admin_db] = lambda: user_prueba_potosi
                app.dependency_overrides[DependenciaAlcanceSucursal] = _crear_override_alcance(102, 2, False)
            elif rol_sede == "multisede":
                app.dependency_overrides[get_current_user] = lambda: user_prueba_multisede
                app.dependency_overrides[require_admin_db] = lambda: user_prueba_multisede
                app.dependency_overrides[DependenciaAlcanceSucursal] = _crear_override_alcance(100, 1, True)
            else:
                raise ValueError(f"Actor desconocido: {rol_sede}")
            return client

        yield _actuar

        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(require_admin_db, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)
