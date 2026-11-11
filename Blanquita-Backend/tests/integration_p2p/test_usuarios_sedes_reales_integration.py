"""
Pruebas de Integración Reales con los 5 Usuarios de Prueba y Alcance Territorial
Sistema ERP Papelera Blanquita

Valida:
1. Endpoint real /Usuario/mi-alcance para ID 12 y los 5 usuarios TEST_.
2. TEST_Potosi_* recibe 403 al forzar ?id_sucursal=1 y 404 ante recurso IDOR de Sucre.
3. El usuario multisede ve ambas sedes y el consolidado suma sin duplicar.
4. Los datos de inventario, precios y cajas difieren correctamente entre Sucre (1) y Potosí (2).
"""

import pytest
from starlette.testclient import TestClient
from app.main import app
from app.Auth.Dependencies import get_current_user
from app.Config.supabase import SessionLocal
from app.Auth.AlcanceSucursal import resolver_alcance_usuario, obtener_caja_para_alcance

client = TestClient(app)

USUARIOS_TEST_IDS = {
    "GERENTE_12": 12,
    "SUCRE_CONTADOR": 14,
    "POTOSI_CONTADOR": 15,
    "POTOSI_SUPERVISOR": 16,
    "POTOSI_CHOFER": 17,
    "MULTI_GERENTE": 18,
}

def auth_override_for_id(uid: int, rol: int, is_admin: bool = False):
    return lambda: {
        "IdUsuario": uid,
        "id": uid,
        "IdRol": rol,
        "IsAdmin": is_admin,
        "Correo": f"test_{uid}@blanquita.invalid"
    }

class TestAlcanceUsuariosReales:

    def test_01_mi_alcance_usuario_12_gerente_general(self):
        """Usuario ID 12 debe tener puede_ver_todas=True y sucursales_permitidas=[1, 2] (Sucre y Potosí)"""
        app.dependency_overrides[get_current_user] = auth_override_for_id(12, 3, is_admin=True)
        try:
            res = client.get("/Usuario/mi-alcance")
            assert res.status_code == 200, res.text
            data = res.json()
            assert data["id_usuario"] == 12
            assert data["puede_ver_todas"] is True
            ids_permitidas = [s["id"] for s in data["sucursales_permitidas"]]
            assert 1 in ids_permitidas
            assert 2 in ids_permitidas
            assert len(ids_permitidas) >= 2
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_02_mi_alcance_5_usuarios_test(self):
        """Verificar mi-alcance para los 5 usuarios TEST_ creados en la base"""
        # a) TEST_Sucre_Contador (ID 14, Rol 4, Sede 1)
        app.dependency_overrides[get_current_user] = auth_override_for_id(14, 4, False)
        res = client.get("/Usuario/mi-alcance")
        assert res.status_code == 200
        d14 = res.json()
        assert d14["puede_ver_todas"] is False
        assert [s["id"] for s in d14["sucursales_permitidas"]] == [1]

        # b) TEST_Potosi_Contador (ID 15, Rol 4, Sede 2)
        app.dependency_overrides[get_current_user] = auth_override_for_id(15, 4, False)
        res = client.get("/Usuario/mi-alcance")
        assert res.status_code == 200
        d15 = res.json()
        assert d15["puede_ver_todas"] is False
        assert [s["id"] for s in d15["sucursales_permitidas"]] == [2]

        # c) TEST_Potosi_Supervisor (ID 16, Rol 5, Sede 2)
        app.dependency_overrides[get_current_user] = auth_override_for_id(16, 5, False)
        res = client.get("/Usuario/mi-alcance")
        assert res.status_code == 200
        d16 = res.json()
        assert d16["puede_ver_todas"] is False
        assert [s["id"] for s in d16["sucursales_permitidas"]] == [2]

        # d) TEST_Potosi_Chofer (ID 17, Rol 6, Sede 2)
        app.dependency_overrides[get_current_user] = auth_override_for_id(17, 6, False)
        res = client.get("/Usuario/mi-alcance")
        assert res.status_code == 200
        d17 = res.json()
        assert d17["puede_ver_todas"] is False
        assert [s["id"] for s in d17["sucursales_permitidas"]] == [2]

        # e) TEST_Multisede_Gerente (ID 18, Rol 3, Sede 1)
        app.dependency_overrides[get_current_user] = auth_override_for_id(18, 3, True)
        res = client.get("/Usuario/mi-alcance")
        assert res.status_code == 200
        d18 = res.json()
        assert d18["puede_ver_todas"] is True
        ids_permitidas = [s["id"] for s in d18["sucursales_permitidas"]]
        assert 1 in ids_permitidas and 2 in ids_permitidas
        assert len(ids_permitidas) >= 2
        app.dependency_overrides.pop(get_current_user, None)

    def test_03_potosi_rechaza_acceso_cruzado_sucre_403(self):
        """TEST_Potosi_* recibe 403 al forzar ?id_sucursal=1 o ?sucursal_id=1"""
        # TEST_Potosi_Contador (ID 15) intenta consultar notas de venta de Sucre
        app.dependency_overrides[get_current_user] = auth_override_for_id(15, 4, False)
        try:
            res = client.get("/cxc/notas-venta?id_sucursal=1")
            assert res.status_code == 403
            assert "fuera de su alcance" in res.text or "no asignada" in res.text or "autorización" in res.text

            res2 = client.get("/tesoreria/cajas?id_sucursal=1")
            assert res2.status_code == 403

            # Intento de forzar 'todas'
            res3 = client.get("/cxc/notas-venta?id_sucursal=todas")
            assert res3.status_code == 403
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_04_potosi_recibe_404_en_idor_de_sucre(self):
        """TEST_Potosi_* recibe 404 al intentar consultar un registro puntual de Sucre"""
        app.dependency_overrides[get_current_user] = auth_override_for_id(15, 4, False)
        try:
            # Nota 1 pertenece a Sucre (IdSucursal=1)
            res = client.get("/cxc/notas-venta/1")
            assert res.status_code == 404
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_05_inventario_comercial_difiere_por_sede(self):
        """El inventario de Sucre y Potosí muestra existencias físicas distintas"""
        # Consultar como Gerente General (ID 18)
        app.dependency_overrides[get_current_user] = auth_override_for_id(18, 3, True)
        try:
            res_sucre = client.get("/logistica/inventario/sucursal/1")
            assert res_sucre.status_code == 200
            data_sucre = res_sucre.json()

            res_potosi = client.get("/logistica/inventario/sucursal/2")
            assert res_potosi.status_code == 200
            data_potosi = res_potosi.json()

            # Potosí debe tener registros y sus stocks deben ser independientes
            assert len(data_sucre) > 0
            assert len(data_potosi) > 0
            # Comparar cantidades de presentación 10
            p10_sucre = next((x for x in data_sucre if x["presentacion_id"] == 10), None)
            p10_potosi = next((x for x in data_potosi if x["presentacion_id"] == 10), None)
            assert p10_sucre is not None
            assert p10_potosi is not None
            assert float(p10_sucre["cantidad_disponible"]) != float(p10_potosi["cantidad_disponible"])
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_06_precios_y_cajas_aislados_por_sede(self):
        """Precios y cajas se consultan según la sede del alcance"""
        app.dependency_overrides[get_current_user] = auth_override_for_id(18, 3, True)
        try:
            # Precios Sucre vs Potosí
            res_p_sucre = client.get("/logistica/precios?id_sucursal=1")
            assert res_p_sucre.status_code == 200
            res_p_potosi = client.get("/logistica/precios?id_sucursal=2")
            assert res_p_potosi.status_code == 200
            # Potosí tiene 4 precios registrados con flete +8% sobre el catálogo
            precios_asignados = [p for p in res_p_potosi.json() if p.get("IdPrecioProducto") is not None]
            assert len(precios_asignados) == 4

            # Cajas: obtener_caja_para_alcance resuelve dinámicamente Caja 1 para Sucre y Caja 2 para Potosí
            db = SessionLocal()
            try:
                alcance_s1 = resolver_alcance_usuario(18, db, sucursal_solicitada=1)
                caja_sucre = obtener_caja_para_alcance(db, alcance_s1)
                assert caja_sucre["IdCaja"] == 1 and caja_sucre["IdSucursal"] == 1

                alcance_s2 = resolver_alcance_usuario(18, db, sucursal_solicitada=2)
                caja_potosi = obtener_caja_para_alcance(db, alcance_s2)
                assert caja_potosi["IdCaja"] == 2 and caja_potosi["IdSucursal"] == 2
            finally:
                db.close()
        finally:
            app.dependency_overrides.pop(get_current_user, None)
