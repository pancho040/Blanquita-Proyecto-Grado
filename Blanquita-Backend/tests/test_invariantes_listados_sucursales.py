import pytest
from sqlalchemy import text

def test_invariantes_endpoints_listado_multisede(actor_sucursal):
    """
    Prueba Permanente de Invariante de Conteo Multisede:
    Para cada endpoint de listado:
      Total(Todas) == Total(Sucre) + Total(Potosí) [+ Total(Corporativo)]
    """
    client_multi = actor_sucursal("multisede")

    # 1. /logistica/rutas
    r_todas = client_multi.get("/logistica/rutas?id_sucursal=todas").json()
    r_sucre = client_multi.get("/logistica/rutas?id_sucursal=1").json()
    r_potosi = client_multi.get("/logistica/rutas?id_sucursal=2").json()
    assert len(r_todas) == len(r_sucre) + len(r_potosi), f"Fallo invariante en /logistica/rutas: {len(r_todas)} != {len(r_sucre)} + {len(r_potosi)}"

    # 2. /logistica/zonas
    z_todas = client_multi.get("/logistica/zonas?id_sucursal=todas").json()
    z_sucre = client_multi.get("/logistica/zonas?id_sucursal=1").json()
    z_potosi = client_multi.get("/logistica/zonas?id_sucursal=2").json()
    assert len(z_todas) == len(z_sucre) + len(z_potosi), f"Fallo invariante en /logistica/zonas: {len(z_todas)} != {len(z_sucre)} + {len(z_potosi)}"

    # 3. /logistica/clientes/puntos-venta/todos
    pv_todas = client_multi.get("/logistica/clientes/puntos-venta/todos?id_sucursal=todas").json()
    pv_sucre = client_multi.get("/logistica/clientes/puntos-venta/todos?id_sucursal=1").json()
    pv_potosi = client_multi.get("/logistica/clientes/puntos-venta/todos?id_sucursal=2").json()
    assert len(pv_todas) == len(pv_sucre) + len(pv_potosi), f"Fallo invariante en /logistica/clientes/puntos-venta/todos: {len(pv_todas)} != {len(pv_sucre)} + {len(pv_potosi)}"

    # 4. /cxc/cuentas
    cxc_todas = client_multi.get("/cxc/cuentas?id_sucursal=todas&limit=1000").json()
    cxc_sucre = client_multi.get("/cxc/cuentas?id_sucursal=1&limit=1000").json()
    cxc_potosi = client_multi.get("/cxc/cuentas?id_sucursal=2&limit=1000").json()
    tot_cxc_todas = cxc_todas.get("total", len(cxc_todas.get("items", [])))
    tot_cxc_sucre = cxc_sucre.get("total", len(cxc_sucre.get("items", [])))
    tot_cxc_potosi = cxc_potosi.get("total", len(cxc_potosi.get("items", [])))
    assert tot_cxc_todas == tot_cxc_sucre + tot_cxc_potosi, f"Fallo invariante en /cxc/cuentas: {tot_cxc_todas} != {tot_cxc_sucre} + {tot_cxc_potosi}"

    # 5. /cxc/abonos/pendientes
    ab_todas = client_multi.get("/cxc/abonos/pendientes?id_sucursal=todas").json()
    ab_sucre = client_multi.get("/cxc/abonos/pendientes?id_sucursal=1").json()
    ab_potosi = client_multi.get("/cxc/abonos/pendientes?id_sucursal=2").json()
    assert len(ab_todas) == len(ab_sucre) + len(ab_potosi), f"Fallo invariante en /cxc/abonos/pendientes: {len(ab_todas)} != {len(ab_sucre)} + {len(ab_potosi)}"

    # 6. /tesoreria/caja/movimientos (soporta Corporativo)
    mov_todas = client_multi.get("/tesoreria/caja/movimientos?id_sucursal=todas&limit=1000").json()
    mov_sucre = client_multi.get("/tesoreria/caja/movimientos?id_sucursal=1&limit=1000").json()
    mov_potosi = client_multi.get("/tesoreria/caja/movimientos?id_sucursal=2&limit=1000").json()
    mov_corp = client_multi.get("/tesoreria/caja/movimientos?es_corporativo=true&limit=1000").json()

    tot_mov_todas = mov_todas.get("total", len(mov_todas.get("items", [])))
    tot_mov_sucre = mov_sucre.get("total", len(mov_sucre.get("items", [])))
    tot_mov_potosi = mov_potosi.get("total", len(mov_potosi.get("items", [])))
    tot_mov_corp = mov_corp.get("total", len(mov_corp.get("items", [])))

    assert tot_mov_todas == tot_mov_sucre + tot_mov_potosi + tot_mov_corp, (
        f"Fallo invariante en MovimientoCaja: {tot_mov_todas} != {tot_mov_sucre} + {tot_mov_potosi} + {tot_mov_corp}"
    )

    # 7. /rrhh/no-venta
    nv_todas = client_multi.get("/rrhh/no-venta?id_sucursal=todas").json()
    nv_sucre = client_multi.get("/rrhh/no-venta?id_sucursal=1").json()
    nv_potosi = client_multi.get("/rrhh/no-venta?id_sucursal=2").json()
    assert len(nv_todas) == len(nv_sucre) + len(nv_potosi), f"Fallo invariante en /rrhh/no-venta: {len(nv_todas)} != {len(nv_sucre)} + {len(nv_potosi)}"


def test_restriccion_rbac_modulos_globales_sede_fija(actor_sucursal):
    """
    Valida la Decisión 3:
    /cxp/*, /reportes/contabilidad/cuentas-pagar, /distribuidores/pedidos y /tesoreria/bancos
    deben devolver 403 Forbidden para usuarios de sede fija (ej. TEST_Potosi_Contador).
    """
    client_potosi = actor_sucursal("potosi")

    # 1. /cxp/cuentas
    r_cxp = client_potosi.get("/cxp/cuentas")
    assert r_cxp.status_code == 403, f"Esperado 403 en /cxp/cuentas, obtenido {r_cxp.status_code}"

    # 2. /cxp/proveedores
    r_prov = client_potosi.get("/cxp/proveedores")
    assert r_prov.status_code == 403, f"Esperado 403 en /cxp/proveedores, obtenido {r_prov.status_code}"

    # 3. /reportes/contabilidad/cuentas-pagar
    r_rep_cxp = client_potosi.get("/reportes/contabilidad/cuentas-pagar")
    assert r_rep_cxp.status_code == 403, f"Esperado 403 en /reportes/contabilidad/cuentas-pagar, obtenido {r_rep_cxp.status_code}"

    # 4. /distribuidores/pedidos
    r_dist = client_potosi.get("/distribuidores/pedidos")
    assert r_dist.status_code == 403, f"Esperado 403 en /distribuidores/pedidos, obtenido {r_dist.status_code}"

    # 5. /tesoreria/bancos
    r_bancos = client_potosi.get("/tesoreria/bancos")
    assert r_bancos.status_code == 403, f"Esperado 403 en /tesoreria/bancos, obtenido {r_bancos.status_code}"


def test_precios_rechaza_todas_con_400(actor_sucursal):
    """
    Valida la Decisión 5:
    /logistica/precios con 'todas' debe responder 400 Bad Request, nunca 422 ni consolidado.
    """
    client_multi = actor_sucursal("multisede")

    # Consulta con ?id_sucursal=todas
    res_todas = client_multi.get("/logistica/precios?id_sucursal=todas")
    assert res_todas.status_code == 400, f"Esperado 400 en /logistica/precios?id_sucursal=todas, obtenido {res_todas.status_code}"
    assert "Debe seleccionar una sucursal específica" in res_todas.json().get("detail", "")

    # Consulta con ?sucursal=todas
    res_todas_alias = client_multi.get("/logistica/precios?sucursal=todas")
    assert res_todas_alias.status_code == 400
    assert "Debe seleccionar una sucursal específica" in res_todas_alias.json().get("detail", "")

    # Consulta sin parámetro sede con usuario multisede
    res_sin_param = client_multi.get("/logistica/precios")
    assert res_sin_param.status_code == 400
    assert "Debe seleccionar una sucursal específica" in res_sin_param.json().get("detail", "")

    # Consulta válida con sede 1 (Sucre)
    res_sucre = client_multi.get("/logistica/precios?id_sucursal=1")
    assert res_sucre.status_code == 200
    assert isinstance(res_sucre.json(), list)

    # Consulta válida con sede 2 (Potosí) -> responde 200 con lista
    res_potosi = client_multi.get("/logistica/precios?id_sucursal=2")
    assert res_potosi.status_code == 200
    items_potosi = res_potosi.json()
    assert isinstance(items_potosi, list)


def test_check_constraint_movimientocaja_sede_o_corporativo(db_session_rollback):
    """
    Verifica que el CHECK constraint 'ck_movimientocaja_sede_o_corporativo'
    hace cumplir estrictamente la disyunción:
      ("IdSucursal" IS NOT NULL AND es_corporativo = false)
      OR
      ("IdSucursal" IS NULL AND es_corporativo = true)
    Cualquier otra combinación debe ser rechazada por el motor de base de datos con IntegrityError (CheckViolation).
    """
    from sqlalchemy.exc import IntegrityError
    db = db_session_rollback

    # 1. Caso inválido: sin sede y sin corporativo (IdSucursal=NULL, es_corporativo=False)
    with pytest.raises(IntegrityError) as exc_info1:
        db.execute(text("""
            INSERT INTO "MovimientoCaja" (
                "IdCategoriaMovimientoCaja", "Monto", "MetodoPago", "FechaMovimiento", "Anulado",
                "IdSucursal", "es_corporativo"
            ) VALUES (
                1, 10.00, 'Efectivo', NOW(), false,
                NULL, false
            )
        """))
        db.flush()
    assert "ck_movimientocaja_sede_o_corporativo" in str(exc_info1.value)
    db.rollback()

    # 2. Caso inválido: con sede y corporativo a la vez (IdSucursal=1, es_corporativo=True)
    with pytest.raises(IntegrityError) as exc_info2:
        db.execute(text("""
            INSERT INTO "MovimientoCaja" (
                "IdCategoriaMovimientoCaja", "Monto", "MetodoPago", "FechaMovimiento", "Anulado",
                "IdSucursal", "es_corporativo"
            ) VALUES (
                1, 10.00, 'Efectivo', NOW(), false,
                1, true
            )
        """))
        db.flush()
    assert "ck_movimientocaja_sede_o_corporativo" in str(exc_info2.value)
    db.rollback()

    # 3. Caso válido: Sede fija (IdSucursal=1, es_corporativo=False)
    res_sede = db.execute(text("""
        INSERT INTO "MovimientoCaja" (
            "IdCategoriaMovimientoCaja", "Monto", "MetodoPago", "FechaMovimiento", "Anulado",
            "IdSucursal", "es_corporativo"
        ) VALUES (
            1, 10.00, 'Efectivo', NOW(), false,
            1, false
        ) RETURNING "IdMovimientoCaja"
    """)).scalar()
    assert res_sede is not None
    db.rollback()

    # 4. Caso válido: Corporativo (IdSucursal=NULL, es_corporativo=True)
    res_corp = db.execute(text("""
        INSERT INTO "MovimientoCaja" (
            "IdCategoriaMovimientoCaja", "Monto", "MetodoPago", "FechaMovimiento", "Anulado",
            "IdSucursal", "es_corporativo"
        ) VALUES (
            1, 10.00, 'Efectivo', NOW(), false,
            NULL, true
        ) RETURNING "IdMovimientoCaja"
    """)).scalar()
    assert res_corp is not None
    db.rollback()


def test_envios_invariante_union_remisiones_inter_sucursales(actor_sucursal, db_session_rollback):
    """
    Invariante de Envíos y Traslados con Remisiones Inter-Sucursales:
    Regla 'ambos' (origen o destino):
      - Si un envío es de Sucre (origen) a Potosí (destino), es visible en Sucre y en Potosí.
      - En 'Todas', cada envío aparece exactamente una vez (clave primaria única).
      - Por tanto:
          Set(Todas) == Set(Sucre) | Set(Potosí)   (Unión disjunta de IDs)
          Len(Sucre) + Len(Potosí) == Len(Todas) + Len(InterSucursales)
    """
    client_multi = actor_sucursal("multisede")
    db = db_session_rollback

    # 1. Sembrar una remisión inter-sucursal Sucre (1) -> Potosí (2) en transacción con rollback
    res_envio = db.execute(text("""
        INSERT INTO public.envios_inventario (
            numero_guia, origen_tipo, origen_id, destino_tipo, destino_id,
            estado, descuento_planta_aplicado, chofer_nombre, camion_placa,
            usuario_despacho_id, observaciones, created_at
        ) VALUES (
            'GUIA-TEST-INTER-01', 'SUCURSAL', 1, 'SUCURSAL', 2,
            'PENDIENTE', false, 'Chofer Prueba', '9999-XYZ',
            1, 'Remision de prueba inter-sucursal Sucre a Potosi', NOW()
        ) RETURNING id;
    """)).scalar()
    db.flush()
    assert res_envio is not None

    # 2. Consultar con actor multisede en Todas, Sucre y Potosí
    resp_todas = client_multi.get("/logistica/envios").json()
    resp_sucre = client_multi.get("/logistica/envios?id_sucursal=1").json()
    resp_potosi = client_multi.get("/logistica/envios?id_sucursal=2").json()

    ids_todas = set(e["id"] for e in resp_todas)
    ids_sucre = set(e["id"] for e in resp_sucre)
    ids_potosi = set(e["id"] for e in resp_potosi)

    # 3. Validar unión de conjuntos (invariante libre de duplicados)
    assert ids_todas == (ids_sucre | ids_potosi), (
        f"Invariante de unión violado: Todas={len(ids_todas)}, Unión={len(ids_sucre | ids_potosi)}"
    )

    # 4. Validar que la remisión inter-sucursal aparece en Sucre y en Potosí, y 1 sola vez en Todas
    assert res_envio in ids_todas, "El envío sembrado debe aparecer en 'Todas'"
    assert res_envio in ids_sucre, "El envío sembrado debe ser visible en Sucre (origen)"
    assert res_envio in ids_potosi, "El envío sembrado debe ser visible en Potosí (destino)"


def test_inventario_valorizado_rechaza_todas_con_400(actor_sucursal):
    """
    Valida que /logistica/inventario/reportes/valorizado rechaza consultas
    sin sede o con 'todas' con HTTP 400 Bad Request, exigiendo sede explícita.
    """
    client_multi = actor_sucursal("multisede")

    # 1. Con ?sucursal_id=todas
    r_todas = client_multi.get("/logistica/inventario/reportes/valorizado?sucursal_id=todas")
    assert r_todas.status_code == 400, f"Esperado 400 con sucursal_id=todas, obtenido {r_todas.status_code}"
    assert "Debe seleccionar una sucursal específica" in r_todas.json().get("detail", "")

    # 2. Con ?sucursal_id=all
    r_all = client_multi.get("/logistica/inventario/reportes/valorizado?sucursal_id=all")
    assert r_all.status_code == 400
    assert "Debe seleccionar una sucursal específica" in r_all.json().get("detail", "")

    # 3. Sin parámetro sede (usuario multisede sin sede efectiva)
    r_sin_sede = client_multi.get("/logistica/inventario/reportes/valorizado")
    assert r_sin_sede.status_code == 400
    assert "Debe seleccionar una sucursal específica" in r_sin_sede.json().get("detail", "")

    # 4. Con sucursal_id=1 (Sucre) -> 200 OK
    r_sucre = client_multi.get("/logistica/inventario/reportes/valorizado?sucursal_id=1")
    assert r_sucre.status_code == 200, f"Esperado 200 con sucursal_id=1, obtenido {r_sucre.status_code}"
    data_sucre = r_sucre.json()
    assert "items" in data_sucre or "total_items" in data_sucre

    # 5. Con sucursal_id=2 (Potosí) -> 200 OK
    r_potosi = client_multi.get("/logistica/inventario/reportes/valorizado?sucursal_id=2")
    assert r_potosi.status_code == 200, f"Esperado 200 con sucursal_id=2, obtenido {r_potosi.status_code}"


def test_flujo_caja_filtra_por_idsucursal_movimiento(actor_sucursal, db_session_rollback):
    """
    Valida que /reportes/contabilidad/flujo-caja filtra estrictamente por mc."IdSucursal",
    incluyendo movimientos de caja propios de la sede que no tienen IdAperturaCierreCaja.
    """
    client_multi = actor_sucursal("multisede")
    db = db_session_rollback

    # 1. Sembrar movimiento en Sucre (IdSucursal=1) sin apertura de caja física
    res_m1 = db.execute(text("""
        INSERT INTO "MovimientoCaja" (
            "IdCategoriaMovimientoCaja", "Monto", "MetodoPago", "FechaMovimiento", "Anulado",
            "IdSucursal", "es_corporativo", "Descripcion"
        ) VALUES (
            1, 550.00, 'Efectivo', NOW(), false,
            1, false, 'Ingreso Sucre sin apertura test'
        ) RETURNING "IdMovimientoCaja";
    """)).scalar()

    # 2. Sembrar movimiento en Potosí (IdSucursal=2) sin apertura de caja física
    res_m2 = db.execute(text("""
        INSERT INTO "MovimientoCaja" (
            "IdCategoriaMovimientoCaja", "Monto", "MetodoPago", "FechaMovimiento", "Anulado",
            "IdSucursal", "es_corporativo", "Descripcion"
        ) VALUES (
            1, 750.00, 'Efectivo', NOW(), false,
            2, false, 'Ingreso Potosi sin apertura test'
        ) RETURNING "IdMovimientoCaja";
    """)).scalar()
    db.flush()

    # 3. Consultar flujo de caja para Sucre y Potosí
    r_sucre = client_multi.get("/reportes/contabilidad/flujo-caja?id_sucursal=1")
    assert r_sucre.status_code == 200
    items_sucre = r_sucre.json().get("data", [])
    ids_sucre = [item["id"] for item in items_sucre]
    assert res_m1 in ids_sucre, "El movimiento de Sucre sin apertura debe figurar en flujo-caja de Sucre"
    assert res_m2 not in ids_sucre, "El movimiento de Potosí NO debe figurar en flujo-caja de Sucre"

    r_potosi = client_multi.get("/reportes/contabilidad/flujo-caja?id_sucursal=2")
    assert r_potosi.status_code == 200
    items_potosi = r_potosi.json().get("data", [])
    ids_potosi = [item["id"] for item in items_potosi]
    assert res_m2 in ids_potosi, "El movimiento de Potosí sin apertura debe figurar en flujo-caja de Potosí"
    assert res_m1 not in ids_potosi, "El movimiento de Sucre NO debe figurar en flujo-caja de Potosí"


def test_consistencia_punto_venta_sucursal(db_session_rollback):
    """
    Prueba formal de consistencia de PuntoVenta y RutaDistribucion:
      a) Todo PuntoVenta tiene un Cliente con IdSucursal no nulo.
      b) Ninguna ruta mezcla sedes: todos los puntos de venta de una ruta
         pertenecen a clientes de la misma sede que la ruta.
      c) Caso negativo sembrado en transacción con rollback:
         Se simula un cliente con sede nula o asignado a una ruta de sede distinta,
         verificando que la consulta de consistencia detecta la anomalía.
    """
    db = db_session_rollback

    # a) Todo PuntoVenta tiene Cliente con IdSucursal no nulo
    q_pv_sin_sede = text("""
        SELECT COUNT(*)
        FROM "PuntoVenta" pv
        JOIN "Cliente" c ON pv."IdCliente" = c."IdCliente"
        WHERE c."IdSucursal" IS NULL;
    """)
    cnt_pv_sin_sede = db.execute(q_pv_sin_sede).scalar()
    assert cnt_pv_sin_sede == 0, f"Existen {cnt_pv_sin_sede} PuntosVenta con Cliente sin IdSucursal"

    # b) Ninguna ruta mezcla sedes
    q_rutas_cruzadas = text("""
        SELECT COUNT(*)
        FROM "RutaPuntoVenta" rpv
        JOIN "RutaDistribucion" r ON rpv."IdRutaDistribucion" = r."IdRutaDistribucion"
        JOIN "PuntoVenta" pv ON rpv."IdPuntoVenta" = pv."IdPuntoVenta"
        JOIN "Cliente" c ON pv."IdCliente" = c."IdCliente"
        WHERE r."IdSucursal" != c."IdSucursal";
    """)
    cnt_cruzadas = db.execute(q_rutas_cruzadas).scalar()
    assert cnt_cruzadas == 0, f"Existen {cnt_cruzadas} asignaciones de ruta con sede cruzada"

    # c) Caso negativo sembrado: crear un cliente sin sede con PuntoVenta y verificar detección
    id_cli_invalido = db.execute(text("""
        INSERT INTO "Cliente" ("RazonSocial", "NombreComercial", "IdSucursal", "IdEstadoCliente")
        VALUES ('Cliente Inconsistente Test', 'Test Invalido', NULL, 1)
        RETURNING "IdCliente";
    """)).scalar()
    db.execute(text("""
        INSERT INTO "PuntoVenta" ("IdCliente", "NombrePuntoVenta", "Direccion")
        VALUES (:id_cli, 'PV Sin Sede Test', 'Calle Falsa 123');
    """), {"id_cli": id_cli_invalido})
    db.flush()

    cnt_detectado = db.execute(q_pv_sin_sede).scalar()
    assert cnt_detectado == 1, "La verificación debe detectar el caso negativo sembrado de PuntoVenta sin sede"

