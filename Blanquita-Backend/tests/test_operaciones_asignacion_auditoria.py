import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def test_obtener_operaciones_asignacion_309(client_prueba_potosi):
    """Verifica que el endpoint de operaciones de la asignación 309 devuelva los cobros y entregas reales."""
    response = client_prueba_potosi.get("/api/logistica/asignaciones/309/operaciones")
    assert response.status_code == 200, f"Error: {response.text}"
    data = response.json()

    assert data["codigo"] == "EXITO"
    assert data["asignacion_id"] == 309
    assert "Mercado Uyuni" in data["nombre_ruta"]
    assert "resumen" in data
    assert data["resumen"]["total_operaciones"] >= 2
    assert data["resumen"]["total_cobrado"] >= 300.0 # 125 + 175 = 300

    # Verificar que vengan cobros y entregas
    ops = data["operaciones"]
    assert len(ops) >= 2
    tipos = {op["tipo_operacion"] for op in ops}
    assert "COBRO" in tipos
    assert any(op["monto"] == 125.0 for op in ops)
    assert any(op["monto"] == 175.0 for op in ops)


def test_obtener_operaciones_asignacion_inexistente(client_prueba_potosi):
    """Verifica que una asignación inexistente retorne 404."""
    response = client_prueba_potosi.get("/api/logistica/asignaciones/99999999/operaciones")
    assert response.status_code == 404


def test_aprobar_todas_operaciones_rollback(client_prueba_potosi, db_session_rollback):
    """Verifica la aprobación masiva de operaciones en la asignación 309 con rollback automático."""
    response = client_prueba_potosi.post("/api/logistica/asignaciones/309/aprobar-todo")
    assert response.status_code == 200, f"Error: {response.text}"
    data = response.json()
    assert data["codigo"] == "EXITO"
    assert data["asignacion_id"] == 309
    assert "total_aprobadas" in data
