import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.Auth.Dependencies import get_current_user
from app.Auth.AlcanceSucursal import DependenciaAlcanceSucursal, AlcanceUsuario
from app.Constants.Roles import ROL_SUPERVISOR

client = TestClient(app)

def mock_supervisor_user():
    return {
        "IdUsuario": 12,
        "IdRol": ROL_SUPERVISOR,
        "id_rol": ROL_SUPERVISOR,
        "IdSucursal": 2,
        "id_sucursal": 2,
        "Correo": "supervisor_potosi@blanquita.com",
        "NombreCompleto": "Supervisor Potosí"
    }

def mock_alcance_supervisor():
    return AlcanceUsuario(
        id_usuario=12,
        puede_ver_todas=True,
        sucursales_permitidas=[1, 2],
        sucursal_efectiva=2,
        sucursal_asignada_defecto=2
    )

def test_asignacion_255_consulta_e_idempotencia_409(db_session_rollback):
    app.dependency_overrides[get_current_user] = mock_supervisor_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance_supervisor

    try:
        # 1. Consulta de liquidación de asignación 255
        res_get = client.get("/api/logistica/asignaciones/255/liquidacion")
        assert res_get.status_code == 200, f"Error en GET liquidacion: {res_get.text}"
        data_get = res_get.json()
        assert "Asignacion" in data_get
        assert "StockCamion" in data_get
        assert data_get["RendicionRegistrada"] is not None
        assert float(data_get["TotalCobrado"]) == 225.0
        print("Stock en camión items:", len(data_get["StockCamion"]))

        # 2. Intentar liquidar de nuevo debe retornar 409 Conflict (Idempotencia)
        payload = {
            "IdUsuarioRepartidor": data_get["Asignacion"]["IdUsuarioRepartidor"],
            "KilometrajeFinal": 1250.0,
            "MontoTotalCobradoRuta": 225.0,
            "MontoEfectivoEntregado": 225.0,
            "MontoTransferenciaReportada": 0.0,
            "MontoQrReportado": 0.0,
            "Diferencia": 0.0,
            "Conciliada": True,
            "ObservacionLiquidacion": "Cierre repetido"
        }
        res_post = client.post("/api/logistica/asignaciones/255/liquidar", json=payload)
        assert res_post.status_code == 409
        assert "ya ha sido liquidada" in res_post.json()["detail"]
        print("Idempotencia 409 confirmada en asignación 255")

        # 3. Asignación inexistente da 404
        res_404 = client.post("/api/logistica/asignaciones/999999/liquidar", json=payload)
        assert res_404.status_code == 404

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)

def test_liquidacion_asignacion_sin_entregas(db_session_rollback):
    """
    Prueba liquidación de una asignación sin pedidos/entregas.
    Crea una asignación temporal en la sesión con rollback y ejecuta la liquidación.
    """
    app.dependency_overrides[get_current_user] = mock_supervisor_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance_supervisor

    db = db_session_rollback
    from sqlalchemy import text
    try:
        # Crear asignación sin entregas para la prueba
        row = db.execute(text("""
            INSERT INTO "AsignacionRuta" (
                "IdRutaDistribucion", "IdUsuarioRepartidor", "FechaAsignacion",
                "IdUsuarioAsigna", "Estado", "KilometrajeInicial", "estado_operativo"
            ) VALUES (
                57, 24, '2026-11-15',
                12, 'En Ruta', 50000, 'APROBADA_EN_RUTA'
            ) RETURNING "IdAsignacionRuta";
        """)).first()
        asig_id = row[0]

        # 1. GET liquidacion
        res_get = client.get(f"/api/logistica/asignaciones/{asig_id}/liquidacion")
        assert res_get.status_code == 200
        data_get = res_get.json()
        assert data_get["TotalPedidos"] == 0
        assert data_get["TotalCobrado"] == 0.0
        assert data_get["SaldoPendiente"] == 0.0

        # 2. POST liquidar con 0 cobrado
        payload = {
            "IdUsuarioRepartidor": 24,
            "KilometrajeFinal": 50010.0,
            "MontoTotalCobradoRuta": 0.0,
            "MontoEfectivoEntregado": 0.0,
            "MontoTransferenciaReportada": 0.0,
            "MontoQrReportado": 0.0,
            "Diferencia": 0.0,
            "Conciliada": True,
            "ObservacionLiquidacion": "Cierre de asignación sin entregas"
        }
        res_post = client.post(f"/api/logistica/asignaciones/{asig_id}/liquidar", json=payload)
        assert res_post.status_code == 200
        data_post = res_post.json()
        assert data_post["Conciliada"] is True
        assert float(data_post["MontoTotalCobradoRuta"]) == 0.0

        # 3. Idempotencia segundo llamado: 409
        res_dup = client.post(f"/api/logistica/asignaciones/{asig_id}/liquidar", json=payload)
        assert res_dup.status_code == 409
        print(f"Liquidación sin entregas en asignación temporal {asig_id} completada exitosamente.")

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)
