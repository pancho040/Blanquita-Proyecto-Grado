import pytest
from sqlalchemy import text

def test_regresion_rutas_con_siembra_transaccional(db_session_rollback, actor_sucursal):
    """
    Prueba Integral de Regresión de Rutas y Seguridad IDOR con Siembra Transaccional:
    1. Siembra dentro de la sesión con rollback:
       - Zona en Sucre (IdSucursal=1) y Zona en Potosí (IdSucursal=2)
       - Ruta en Sucre (IdSucursal=1)
       - Ruta en Potosí (IdSucursal=2)
    2. Valida invariantes:
       - Todas == Sucre + Potosí
       - Filtro ?id_sucursal=1 devuelve las de Sucre
       - Filtro ?id_sucursal=2 devuelve las de Potosí
       - Sede fija Sucre solo ve Sucre
       - Sede fija Potosí solo ve Potosí
    3. Valida seguridad IDOR:
       - Sede fija Sucre consultando ruta de Potosí -> 404
       - Sede fija Potosí consultando ruta de Sucre -> 404
    4. Al finalizar, rollback automático garantiza 0 mutaciones en base de datos.
    """
    db = db_session_rollback

    # 1. Obtener o siembras zonas
    z_sucre = db.execute(text("""
        INSERT INTO "ZonaDistribucion" ("NombreZona", "Ciudad", "Descripcion", "Activa", "IdSucursal")
        VALUES ('Zona Test Sucre', 'Sucre', 'Zona de prueba transaccional', true, 1)
        RETURNING "IdZonaDistribucion";
    """)).scalar()

    z_potosi = db.execute(text("""
        INSERT INTO "ZonaDistribucion" ("NombreZona", "Ciudad", "Descripcion", "Activa", "IdSucursal")
        VALUES ('Zona Test Potosi', 'Potosí', 'Zona de prueba transaccional', true, 2)
        RETURNING "IdZonaDistribucion";
    """)).scalar()

    # Siembra rutas de prueba
    r_sucre = db.execute(text("""
        INSERT INTO "RutaDistribucion" ("IdZonaDistribucion", "NombreRuta", "DiaSemana", "Descripcion", "Activa", "IdSucursal")
        VALUES (:zid, 'Ruta Test Sucre #99', 1, 'Ruta de prueba', true, 1)
        RETURNING "IdRutaDistribucion";
    """), {"zid": z_sucre}).scalar()

    r_potosi = db.execute(text("""
        INSERT INTO "RutaDistribucion" ("IdZonaDistribucion", "NombreRuta", "DiaSemana", "Descripcion", "Activa", "IdSucursal")
        VALUES (:zid, 'Ruta Test Potosi #88', 2, 'Ruta de prueba', true, 2)
        RETURNING "IdRutaDistribucion";
    """), {"zid": z_potosi}).scalar()

    # 2. Consultar con actor multisede
    client_multi = actor_sucursal("multisede")

    # Todas
    res_todas = client_multi.get("/logistica/rutas?id_sucursal=todas")
    assert res_todas.status_code == 200
    rutas_todas = res_todas.json()
    ids_todas = [r["IdRutaDistribucion"] for r in rutas_todas]
    assert r_sucre in ids_todas
    assert r_potosi in ids_todas

    # Sucre (1)
    res_sucre = client_multi.get("/logistica/rutas?id_sucursal=1")
    assert res_sucre.status_code == 200
    rutas_sucre = res_sucre.json()
    ids_sucre = [r["IdRutaDistribucion"] for r in rutas_sucre]
    assert r_sucre in ids_sucre
    assert r_potosi not in ids_sucre
    for r in rutas_sucre:
        assert r.get("IdSucursal") == 1

    # Potosi (2)
    res_potosi = client_multi.get("/logistica/rutas?id_sucursal=2")
    assert res_potosi.status_code == 200
    rutas_potosi = res_potosi.json()
    ids_potosi = [r["IdRutaDistribucion"] for r in rutas_potosi]
    assert r_potosi in ids_potosi
    assert r_sucre not in ids_potosi
    for r in rutas_potosi:
        assert r.get("IdSucursal") == 2

    # Invariante conteo
    assert len(rutas_todas) == len(rutas_sucre) + len(rutas_potosi)

    # 3. Sede fija Sucre
    client_sucre = actor_sucursal("sucre")
    res_fija_sucre = client_sucre.get("/logistica/rutas")
    assert res_fija_sucre.status_code == 200
    rutas_fija_sucre = res_fija_sucre.json()
    ids_fija_sucre = [r["IdRutaDistribucion"] for r in rutas_fija_sucre]
    assert r_sucre in ids_fija_sucre
    assert r_potosi not in ids_fija_sucre

    # Seguridad IDOR: Sede fija Sucre intentando acceder al detalle de la ruta de Potosí -> 404
    res_idor_sucre = client_sucre.get(f"/logistica/rutas/{r_potosi}")
    assert res_idor_sucre.status_code == 404, f"Esperado 404 por IDOR, obtenido {res_idor_sucre.status_code}"

    # 4. Sede fija Potosí
    client_potosi = actor_sucursal("potosi")
    res_fija_potosi = client_potosi.get("/logistica/rutas")
    assert res_fija_potosi.status_code == 200
    rutas_fija_potosi = res_fija_potosi.json()
    ids_fija_potosi = [r["IdRutaDistribucion"] for r in rutas_fija_potosi]
    assert r_potosi in ids_fija_potosi
    assert r_sucre not in ids_fija_potosi

    # Seguridad IDOR: Sede fija Potosí intentando acceder al detalle de la ruta de Sucre -> 404
    res_idor_potosi = client_potosi.get(f"/logistica/rutas/{r_sucre}")
    assert res_idor_potosi.status_code == 404, f"Esperado 404 por IDOR, obtenido {res_idor_potosi.status_code}"
