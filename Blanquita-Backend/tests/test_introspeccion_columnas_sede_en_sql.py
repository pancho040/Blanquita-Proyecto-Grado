import pytest
from sqlalchemy import text

def test_introspeccion_columnas_sede_en_base_de_datos(db_session_rollback):
    """
    Verifica que cada tabla operativa con alcance por sede posee su columna correspondiente
    en information_schema.columns de la base de datos real.
    """
    db = db_session_rollback

    tablas_esperadas = {
        "ZonaDistribucion": ["IdSucursal"],
        "RutaDistribucion": ["IdSucursal"],
        "MovimientoCaja": ["IdSucursal", "es_corporativo"],
        "Cliente": ["IdSucursal"],
        "CuentaCobrar": ["IdSucursal"],
        "SolicitudCajaChica": ["IdSucursal"],
        "Planilla": ["IdSucursal"],
        "deudas_no_venta": ["id_sucursal"],
        "Caja": ["IdSucursal"],
    }

    for tabla, cols in tablas_esperadas.items():
        for col in cols:
            existe = db.execute(text("""
                SELECT 1 FROM information_schema.columns
                WHERE table_name = :tabla AND column_name = :col
            """), {"tabla": tabla, "col": col}).fetchone()
            assert existe is not None, f"La columna {col} no existe en la tabla {tabla} en la BD"


def test_introspeccion_columnas_sede_en_select_repositorios(db_session_rollback):
    """
    Verifica que las consultas de repositorio retornen la columna de sede en sus registros.
    """
    from app.Repository.Logistica.RutaRepository import RutaRepository
    from app.Repository.Logistica.ClienteRepository import ClienteRepository
    from app.Repository.Contabilidad.TesoreriaRepository import TesoreriaRepository
    from app.Repository.RRHH.RRHHRepository import RRHHRepository

    db = db_session_rollback

    # 1. Rutas
    rutas = RutaRepository(db).ListarRutas(id_sucursal=1)
    if rutas:
        assert "IdSucursal" in rutas[0]
        assert rutas[0]["IdSucursal"] == 1

    # 2. Zonas
    zonas = RutaRepository(db).ListarZonas(id_sucursal=1)
    if zonas:
        assert "IdSucursal" in zonas[0]
        assert zonas[0]["IdSucursal"] == 1

    # 3. Puntos de venta
    pvs = ClienteRepository(db).ListarTodosPuntosVentaActivos(id_sucursal=1)
    if pvs:
        assert "IdSucursal" in pvs[0]
        assert pvs[0]["IdSucursal"] == 1

    # 4. MovimientoCaja
    movs = TesoreriaRepository(db).ListarMovimientosCaja(id_sucursal=1, limit=5)
    if movs:
        assert "IdSucursal" in movs[0]
        assert "es_corporativo" in movs[0]
        assert movs[0]["IdSucursal"] == 1
        assert movs[0]["es_corporativo"] is False

    # 5. MovimientoCaja Corporativo
    movs_corp = TesoreriaRepository(db).ListarMovimientosCaja(es_corporativo=True, limit=5)
    if movs_corp:
        assert "es_corporativo" in movs_corp[0]
        assert movs_corp[0]["es_corporativo"] is True

    # 6. Deudas no venta
    deudas = RRHHRepository(db).ListarDeudasNoVenta(id_sucursal=1)
    if deudas:
        assert "id_sucursal" in deudas[0]
        assert deudas[0]["id_sucursal"] == 1
