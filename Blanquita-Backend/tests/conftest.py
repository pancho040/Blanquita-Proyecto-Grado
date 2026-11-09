import sys
from pathlib import Path

# Asegurar que el directorio raíz del backend esté en sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import pytest
from fastapi import HTTPException, status
from fastapi.testclient import TestClient
from app.main import app
from app.Auth.Dependencies import get_current_user, require_admin_db

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
        "IdUsuario": 1,
        "IdRol": ROL_GERENTE_GENERAL,
        "IsAdmin": True,
        "Correo": "admin@blanquita.com",
        "IdEstadoUsuario": 1,
    }

@pytest.fixture
def user_contador():
    return {
        "IdUsuario": 2,
        "IdRol": ROL_CONTADOR,
        "IsAdmin": False,
        "Correo": "contador@blanquita.com",
        "IdEstadoUsuario": 1,
    }

@pytest.fixture
def user_supervisor():
    return {
        "IdUsuario": 3,
        "IdRol": ROL_SUPERVISOR,
        "IsAdmin": False,
        "Correo": "supervisor@blanquita.com",
        "IdEstadoUsuario": 1,
    }

@pytest.fixture
def user_chofer():
    return {
        "IdUsuario": 4,
        "IdRol": ROL_AGENTE_REPARTO,
        "IsAdmin": False,
        "Correo": "chofer1@blanquita.com",
        "IdEstadoUsuario": 1,
    }

@pytest.fixture
def client_admin(user_admin):
    app.dependency_overrides[get_current_user] = lambda: user_admin
    app.dependency_overrides[require_admin_db] = lambda: user_admin
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()

@pytest.fixture
def client_contador(user_contador):
    app.dependency_overrides[get_current_user] = lambda: user_contador
    app.dependency_overrides[require_admin_db] = _deny_admin_access
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()

@pytest.fixture
def client_supervisor(user_supervisor):
    app.dependency_overrides[get_current_user] = lambda: user_supervisor
    app.dependency_overrides[require_admin_db] = _deny_admin_access
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()

@pytest.fixture
def client_chofer(user_chofer):
    app.dependency_overrides[get_current_user] = lambda: user_chofer
    app.dependency_overrides[require_admin_db] = _deny_admin_access
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()

@pytest.fixture
def client_anonimo():
    app.dependency_overrides.clear()
    with TestClient(app) as client:
        yield client
