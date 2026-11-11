"""
Prueba de Integración con Datos Reales y Aislamiento Transaccional Rollback (Fase 2 - Paso 2)
Sistema Integral ERP Papelera Blanquita

Verifica con siembra de datos reales dentro de una transacción con rollback automático:
1. Aislamiento estricto de lectura por sede (Sucre vs Potosí vs Multisede).
2. Bloqueo 403 ante solicitud de 'todas' para usuarios de sede fija.
3. Fallo cerrado 400 en escrituras multisede sin sucursal explícita.
4. Bloqueo 403 en escrituras cruzadas (sede fija intentando operar en otra sede).
5. Protección IDOR con respuesta 404 Not Found (mínima revelación OWASP) al consultar recursos ajenos por ID.
6. Aislamiento de cajas y movimientos de Tesorería.
"""

import pytest
from sqlalchemy import text


class TestDatosRealesAislamientoSucursal:

    def test_01_aislamiento_lectura_clientes_por_sede(
        self, db_session_rollback, actor_sucursal
    ):
        """Siembra un cliente en Sucre y otro en Potosí y verifica filtrado estricto por sede."""
        # 1. Siembra de datos transaccionales
        res_sucre = db_session_rollback.execute(text("""
            INSERT INTO "Cliente" (
                "RazonSocial", "NombreComercial", "NitCi", "IdEstadoCliente", "IdSucursal", "IdUsuarioRegistro"
            ) VALUES (
                'CLIENTE_TEST_SUCRE_UNICO', 'Comercial Sucre Test', '900000001', 1, 1, 12
            ) RETURNING "IdCliente";
        """))
        id_c_sucre = res_sucre.scalar()

        res_potosi = db_session_rollback.execute(text("""
            INSERT INTO "Cliente" (
                "RazonSocial", "NombreComercial", "NitCi", "IdEstadoCliente", "IdSucursal", "IdUsuarioRegistro"
            ) VALUES (
                'CLIENTE_TEST_POTOSI_UNICO', 'Comercial Potosi Test', '900000002', 1, 2, 12
            ) RETURNING "IdCliente";
        """))
        id_c_potosi = res_potosi.scalar()
        db_session_rollback.flush()

        # 2. Verificación usuario Sucre
        client = actor_sucursal("sucre")
        r_sucre = client.get("/logistica/clientes")
        assert r_sucre.status_code == 200
        ids_sucre = [c["IdCliente"] for c in r_sucre.json()]
        assert id_c_sucre in ids_sucre, "El cliente de Sucre debe ser visible para Sucre"
        assert id_c_potosi not in ids_sucre, "El cliente de Potosí NO debe ser visible para Sucre"

        # 3. Verificación usuario Potosí
        client = actor_sucursal("potosi")
        r_potosi = client.get("/logistica/clientes")
        assert r_potosi.status_code == 200
        ids_potosi = [c["IdCliente"] for c in r_potosi.json()]
        assert id_c_potosi in ids_potosi, "El cliente de Potosí debe ser visible para Potosí"
        assert id_c_sucre not in ids_potosi, "El cliente de Sucre NO debe ser visible para Potosí"

        # 4. Verificación usuario Multisede consolidado
        client = actor_sucursal("multisede")
        r_multi = client.get("/logistica/clientes")
        assert r_multi.status_code == 200
        ids_multi = [c["IdCliente"] for c in r_multi.json()]
        assert id_c_sucre in ids_multi, "El usuario multisede debe ver el cliente de Sucre"
        assert id_c_potosi in ids_multi, "El usuario multisede debe ver el cliente de Potosí"
        assert len(ids_multi) == len(set(ids_multi)), "No debe haber duplicados en la lista multisede"

    def test_02_aislamiento_lectura_notas_venta_por_sede(
        self, db_session_rollback, actor_sucursal
    ):
        """Siembra una nota de venta en Sucre y otra en Potosí y verifica filtrado estricto."""
        # 1. Siembra de datos transaccionales
        res_sucre = db_session_rollback.execute(text("""
            INSERT INTO "NotaVenta" (
                "NumeroNotaVenta", "FechaVenta", "DestinoDepartamento", 
                "TotalVentaBruto", "ImporteNeto", "SaldoPendiente", "IdSucursal", "IdUsuarioRegistro"
            ) VALUES (
                'NV-REALTEST-SUCRE-99', NOW(), 'Sucre', 150.0, 150.0, 150.0, 1, 12
            ) RETURNING "IdNotaVenta";
        """))
        id_nv_sucre = res_sucre.scalar()

        res_potosi = db_session_rollback.execute(text("""
            INSERT INTO "NotaVenta" (
                "NumeroNotaVenta", "FechaVenta", "DestinoDepartamento", 
                "TotalVentaBruto", "ImporteNeto", "SaldoPendiente", "IdSucursal", "IdUsuarioRegistro"
            ) VALUES (
                'NV-REALTEST-POTOSI-99', NOW(), 'Potosí', 250.0, 250.0, 250.0, 2, 12
            ) RETURNING "IdNotaVenta";
        """))
        id_nv_potosi = res_potosi.scalar()
        db_session_rollback.flush()

        # 2. Verificación usuario Sucre
        client = actor_sucursal("sucre")
        r_sucre = client.get("/cxc/notas-venta?busqueda=NV-REALTEST-")
        assert r_sucre.status_code == 200
        ids_sucre = [item["IdNotaVenta"] for item in r_sucre.json()["items"]]
        assert id_nv_sucre in ids_sucre, "La nota de Sucre debe ser visible para Sucre"
        assert id_nv_potosi not in ids_sucre, "La nota de Potosí NO debe ser visible para Sucre"

        # 3. Verificación usuario Potosí
        client = actor_sucursal("potosi")
        r_potosi = client.get("/cxc/notas-venta?busqueda=NV-REALTEST-")
        assert r_potosi.status_code == 200
        ids_potosi = [item["IdNotaVenta"] for item in r_potosi.json()["items"]]
        assert id_nv_potosi in ids_potosi, "La nota de Potosí debe ser visible para Potosí"
        assert id_nv_sucre not in ids_potosi, "La nota de Sucre NO debe ser visible para Potosí"

        # 4. Verificación usuario Multisede
        client = actor_sucursal("multisede")
        r_multi = client.get("/cxc/notas-venta?busqueda=NV-REALTEST-")
        assert r_multi.status_code == 200
        ids_multi = [item["IdNotaVenta"] for item in r_multi.json()["items"]]
        assert id_nv_sucre in ids_multi
        assert id_nv_potosi in ids_multi

    def test_03_bloqueo_parametro_todas_en_sede_fija(
        self, actor_sucursal
    ):
        """Verifica que 'id_sucursal=todas' sea rechazado con 403 en sede fija y permitido en multisede."""
        # Sucre pide 'todas' -> 403 Forbidden
        client = actor_sucursal("sucre")
        r1 = client.get("/cxc/notas-venta?id_sucursal=todas")
        assert r1.status_code == 403
        assert "No tiene autorización" in r1.json()["detail"]

        # Potosí pide 'todas' -> 403 Forbidden
        client = actor_sucursal("potosi")
        r2 = client.get("/logistica/clientes?id_sucursal=todas")
        assert r2.status_code == 403
        assert "No tiene autorización" in r2.json()["detail"]

        # Multisede pide 'todas' -> 200 OK
        client = actor_sucursal("multisede")
        r3 = client.get("/cxc/notas-venta?id_sucursal=todas")
        assert r3.status_code == 200

    def test_04_escritura_multisede_sin_sucursal_explicita_falla_400(
        self, actor_sucursal
    ):
        """Usuario multisede en modo consolidado que intenta escribir sin definir sucursal recibe 400 Bad Request."""
        client = actor_sucursal("multisede")
        # Intentar crear nota de venta sin sucursal
        r1 = client.post("/cxc/notas-venta", json={
            "NumeroNotaVenta": "NV-FAIL-001",
            "TotalVentaBruto": 100.0
        })
        assert r1.status_code == 400
        assert "especificar explícitamente la sucursal" in r1.json()["detail"]

        # Intentar crear cliente sin sucursal
        r2 = client.post("/logistica/clientes", json={
            "RazonSocial": "Cliente Fallo Multisede",
            "NitCi": "99999999"
        })
        assert r2.status_code == 400
        assert "especificar explícitamente la sucursal" in r2.json()["detail"]

    def test_05_escritura_cruzada_sede_fija_falla_403(
        self, actor_sucursal
    ):
        """Usuario de sede fija que intenta crear o modificar recursos en otra sede recibe 403 Forbidden."""
        client = actor_sucursal("sucre")
        # Sucre intentando registrar nota en Potosí (sucursal 2)
        r1 = client.post("/cxc/notas-venta", json={
            "NumeroNotaVenta": "NV-CRUZ-001",
            "IdSucursal": 2,
            "TotalVentaBruto": 100.0
        })
        assert r1.status_code == 403
        assert "No puede registrar operaciones en la sucursal 2" in r1.json()["detail"]

        # Sucre intentando registrar cliente en Potosí (sucursal 2)
        r2 = client.post("/logistica/clientes", json={
            "RazonSocial": "Cliente Cruzado Sucre a Potosí",
            "NitCi": "88888888",
            "IdSucursal": 2
        })
        assert r2.status_code == 403
        assert "No puede registrar operaciones en la sucursal 2" in r2.json()["detail"]

        client = actor_sucursal("potosi")
        # Potosí intentando registrar cliente en Sucre (sucursal 1)
        r3 = client.post("/logistica/clientes", json={
            "RazonSocial": "Cliente Cruzado Potosí a Sucre",
            "NitCi": "77777777",
            "IdSucursal": 1
        })
        assert r3.status_code == 403
        assert "No puede registrar operaciones en la sucursal 1" in r3.json()["detail"]

    def test_06_proteccion_idor_recurso_ajeno_devuelve_404(
        self, db_session_rollback, actor_sucursal
    ):
        """
        Regla de Mínima Revelación OWASP:
        Consultar un recurso por ID que pertenece a otra sede devuelve 404 Not Found (no 403 ni los datos).
        """
        # Siembra de cliente en Potosí
        res_p = db_session_rollback.execute(text("""
            INSERT INTO "Cliente" (
                "RazonSocial", "NombreComercial", "NitCi", "IdEstadoCliente", "IdSucursal", "IdUsuarioRegistro"
            ) VALUES (
                'CLIENTE_IDOR_POTOSI', 'Potosi Privado', '999111222', 1, 2, 12
            ) RETURNING "IdCliente";
        """))
        id_c_potosi = res_p.scalar()

        # Siembra de nota en Potosí
        res_nv_p = db_session_rollback.execute(text("""
            INSERT INTO "NotaVenta" (
                "NumeroNotaVenta", "FechaVenta", "DestinoDepartamento", 
                "TotalVentaBruto", "ImporteNeto", "SaldoPendiente", "IdSucursal", "IdUsuarioRegistro"
            ) VALUES (
                'NV-IDOR-POTOSI', NOW(), 'Potosí', 300.0, 300.0, 300.0, 2, 12
            ) RETURNING "IdNotaVenta";
        """))
        id_nv_potosi = res_nv_p.scalar()
        db_session_rollback.flush()

        client = actor_sucursal("sucre")
        # Sucre consulta el cliente de Potosí por ID directo -> 404 Not Found
        r1 = client.get(f"/logistica/clientes/{id_c_potosi}")
        assert r1.status_code == 404
        assert "no encontrad" in r1.json()["detail"].lower()

        # Sucre consulta la nota de Potosí por ID directo -> 404 Not Found
        r2 = client.get(f"/cxc/notas-venta/{id_nv_potosi}")
        assert r2.status_code == 404
        assert "no encontrad" in r2.json()["detail"].lower()

        client = actor_sucursal("multisede")
        # Multisede consulta los mismos recursos por ID -> 200 OK
        r3 = client.get(f"/logistica/clientes/{id_c_potosi}")
        assert r3.status_code == 200
        assert r3.json()["IdCliente"] == id_c_potosi

        r4 = client.get(f"/cxc/notas-venta/{id_nv_potosi}")
        assert r4.status_code == 200
        assert r4.json()["IdNotaVenta"] == id_nv_potosi

    def test_07_aislamiento_cajas_tesoreria(
        self, db_session_rollback, actor_sucursal
    ):
        """Verifica que el endpoint de historial de cajas filtre estrictamente por sucursal."""
        # Sembrar una apertura para la caja de Potosí (IdCaja=2) dentro de la transacción
        db_session_rollback.execute(text("""
            INSERT INTO "AperturaCierreCaja" (
                "IdCaja", "IdUsuarioApertura", "FechaApertura", "SaldoInicial", "IdEstadoAperturaCaja"
            ) VALUES (
                2, 12, NOW(), 500.0, 1
            ) RETURNING "IdAperturaCierreCaja";
        """))
        db_session_rollback.flush()

        # Sucre consulta historial de cajas
        client = actor_sucursal("sucre")
        r_sucre = client.get("/tesoreria/cajas")
        assert r_sucre.status_code == 200
        items_sucre = r_sucre.json()
        assert len(items_sucre) > 0
        for c in items_sucre:
            assert c["IdSucursal"] == 1, f"Caja {c['IdCaja']} de otra sucursal vista por Sucre"

        # Potosí consulta historial de cajas
        client = actor_sucursal("potosi")
        r_potosi = client.get("/tesoreria/cajas")
        assert r_potosi.status_code == 200
        items_potosi = r_potosi.json()
        assert len(items_potosi) > 0
        for c in items_potosi:
            assert c["IdSucursal"] == 2, f"Caja {c['IdCaja']} de otra sucursal vista por Potosí"

        # Multisede consulta consolidado
        client = actor_sucursal("multisede")
        r_multi = client.get("/tesoreria/cajas")
        assert r_multi.status_code == 200
        items_multi = r_multi.json()
        sedes_vistas = {c["IdSucursal"] for c in items_multi}
        assert 1 in sedes_vistas and 2 in sedes_vistas
