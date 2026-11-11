"""
Pruebas de Seguridad y RBAC Estricto:
1. Endpoints de /Usuario/* (Crear, Roles, Modificar Rol y Sucursal)
2. Endpoint /distribuidores/pedidos (Aislamiento de distribuidor y 403 a personal no autorizado)
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.Auth.Dependencies import get_current_user, require_admin_db
from app.Constants.Roles import (
    ROL_GERENTE_GENERAL,
    ROL_LIDER_INVENTARIO_PRODUCCION,
    ROL_OPERADOR,
    ROL_AGENTE_REPARTO,
    ROL_DISTRIBUIDOR,
    ROL_CONTADOR,
    ROL_SUPERVISOR,
)

client = TestClient(app)


class TestRBACGestionUsuarios:
    """Verifica que NINGÚN usuario excepto el Gerente General (IdRol=3) puede gestionar usuarios o roles."""

    def test_post_usuario_crear_bloqueado_para_lider_inventario_con_is_admin(self):
        """Un usuario con IsAdmin=True pero rol Líder de Inventario (IdRol=2) recibe 403 al intentar crear usuario."""
        def mock_user():
            return {
                "IdUsuario": 99,
                "IdRol": ROL_LIDER_INVENTARIO_PRODUCCION,
                "IsAdmin": True,
                "IdSucursal": 1,
            }

        app.dependency_overrides[get_current_user] = mock_user
        app.dependency_overrides[require_admin_db] = mock_user

        try:
            payload = {
                "IdRol": 1,
                "Ci": "99988877",
                "PrimerNombre": "Nuevo",
                "ApellidoPaterno": "Empleado",
                "Celular": "71234567",
                "Clave": "Password123!",
                "IdSucursal": 1,
            }
            res = client.post("/Usuario/crear", json=payload)
            assert res.status_code == 403
            assert "únicamente el Gerente General" in res.json().get("detail", "")
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(require_admin_db, None)

    def test_post_usuario_crear_con_sede_invalida_rechazado_400(self):
        """El Gerente General no puede crear un usuario con una sucursal inexistente (falla 400)."""
        def mock_gerente():
            return {
                "IdUsuario": 12,
                "IdRol": ROL_GERENTE_GENERAL,
                "IsAdmin": True,
                "IdSucursal": 1,
            }

        app.dependency_overrides[get_current_user] = mock_gerente
        app.dependency_overrides[require_admin_db] = mock_gerente

        try:
            payload = {
                "IdRol": 1,
                "Ci": "11122233",
                "PrimerNombre": "Invalido",
                "ApellidoPaterno": "Sucursal",
                "Celular": "71234567",
                "Clave": "Password123!",
                "IdSucursal": 9999, # Sede inexistente
            }
            res = client.post("/Usuario/crear", json=payload)
            assert res.status_code == 400
            assert "Sucursal inválida" in res.json().get("detail", "")
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(require_admin_db, None)

    def test_get_usuario_roles_bloqueado_para_lider_inventario_con_is_admin(self):
        """GET /Usuario/roles retorna 403 para Líder de Inventario con IsAdmin=True."""
        def mock_user():
            return {
                "IdUsuario": 99,
                "IdRol": ROL_LIDER_INVENTARIO_PRODUCCION,
                "IsAdmin": True,
                "IdSucursal": 1,
            }

        app.dependency_overrides[get_current_user] = mock_user

        try:
            res = client.get("/Usuario/roles")
            assert res.status_code == 403
            assert "únicamente el Gerente General" in res.json().get("detail", "")
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_get_usuario_roles_permitido_para_gerente_general(self):
        """GET /Usuario/roles retorna 200 y catálogo para Gerente General."""
        def mock_gerente():
            return {
                "IdUsuario": 12,
                "IdRol": ROL_GERENTE_GENERAL,
                "IsAdmin": True,
                "IdSucursal": 1,
            }

        app.dependency_overrides[get_current_user] = mock_gerente

        try:
            res = client.get("/Usuario/roles")
            assert res.status_code == 200
            assert isinstance(res.json(), list)
            assert len(res.json()) > 0
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_put_usuario_rol_bloqueado_para_lider_inventario_con_is_admin(self):
        """PUT /Usuario/{id}/rol retorna 403 si lo llama Líder de Inventario."""
        def mock_user():
            return {
                "IdUsuario": 99,
                "IdRol": ROL_LIDER_INVENTARIO_PRODUCCION,
                "IsAdmin": True,
                "IdSucursal": 1,
            }

        app.dependency_overrides[get_current_user] = mock_user
        app.dependency_overrides[require_admin_db] = mock_user

        try:
            res = client.put("/Usuario/5/rol?id_rol=1")
            assert res.status_code == 403
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(require_admin_db, None)

    def test_put_usuario_rol_auto_modificacion_bloqueada(self):
        """El Gerente General no puede modificar su propio rol (403 Forbidden)."""
        def mock_gerente():
            return {
                "IdUsuario": 12,
                "IdRol": ROL_GERENTE_GENERAL,
                "IsAdmin": True,
                "IdSucursal": 1,
            }

        app.dependency_overrides[get_current_user] = mock_gerente
        app.dependency_overrides[require_admin_db] = mock_gerente

        try:
            res = client.put("/Usuario/12/rol?id_rol=1")
            assert res.status_code == 403
            assert "modificar su propio rol" in res.json().get("detail", "")
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(require_admin_db, None)

    def test_put_usuario_sucursal_bloqueado_para_lider_inventario_con_is_admin(self):
        """PUT /Usuario/{id}/sucursal retorna 403 para Líder de Inventario con IsAdmin=True."""
        def mock_user():
            return {
                "IdUsuario": 99,
                "IdRol": ROL_LIDER_INVENTARIO_PRODUCCION,
                "IsAdmin": True,
                "IdSucursal": 1,
            }

        app.dependency_overrides[get_current_user] = mock_user
        app.dependency_overrides[require_admin_db] = mock_user

        try:
            res = client.put("/Usuario/5/sucursal?id_sucursal=2")
            assert res.status_code == 403
            assert "únicamente el Gerente General" in res.json().get("detail", "")
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(require_admin_db, None)


class TestDistribuidoresPedidosRBAC:
    """Verifica seguridad territorial y RBAC sobre /distribuidores/pedidos."""

    def test_distribuidores_pedidos_personal_no_autorizado_falla_403(self):
        """Un Operador de planta (IdRol=1) o Chofer (IdRol=6) recibe 403 Forbidden al llamar /distribuidores/pedidos."""
        def mock_operador():
            return {
                "IdUsuario": 55,
                "IdRol": ROL_OPERADOR,
                "IsAdmin": False,
                "IdSucursal": 1,
            }

        app.dependency_overrides[get_current_user] = mock_operador

        try:
            res = client.get("/distribuidores/pedidos")
            assert res.status_code == 403
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_distribuidores_pedidos_lider_inventario_con_is_admin_falla_403(self):
        """Un Líder de Inventario (IdRol=2) con IsAdmin=True no puede acceder a pedidos de distribuidores (403)."""
        def mock_lider():
            return {
                "IdUsuario": 99,
                "IdRol": ROL_LIDER_INVENTARIO_PRODUCCION,
                "IsAdmin": True,
                "IdSucursal": 1,
            }

        app.dependency_overrides[get_current_user] = mock_lider

        try:
            res = client.get("/distribuidores/pedidos")
            assert res.status_code == 403
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_distribuidores_pedidos_permitido_para_gerente_general(self):
        """El Gerente General (IdRol=3) puede consultar pedidos de distribuidores mayoristas."""
        def mock_gerente():
            return {
                "IdUsuario": 12,
                "IdRol": ROL_GERENTE_GENERAL,
                "IsAdmin": True,
                "IdSucursal": 1,
            }

        app.dependency_overrides[get_current_user] = mock_gerente

        try:
            res = client.get("/distribuidores/pedidos")
            assert res.status_code == 200
            assert isinstance(res.json(), list)
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_distribuidores_pedidos_distribuidor_sin_ficha_devuelve_vacio(self):
        """
        Un distribuidor autenticado (IdRol=7) sin ficha vinculada devuelve [] (fallo cerrado),
        impidiendo ver pedidos ajenos incluso si manipula ?distribuidor_id=1.
        """
        def mock_distribuidor():
            return {
                "IdUsuario": 99999, # Usuario sin ficha
                "IdRol": ROL_DISTRIBUIDOR,
                "IsAdmin": False,
            }

        app.dependency_overrides[get_current_user] = mock_distribuidor

        try:
            res = client.get("/distribuidores/pedidos?distribuidor_id=1")
            assert res.status_code == 200
            assert res.json() == [] # Fallo cerrado garantizado
        finally:
            app.dependency_overrides.pop(get_current_user, None)
