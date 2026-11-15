"""Tests para el servicio SSE y Outbox de Logística (Fase 3)."""
import pytest
from starlette.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.Config.supabase import SessionLocal
from app.Auth.Jwt import crear_access_token_movil


@pytest.fixture
def cliente():
    return TestClient(app)


@pytest.fixture
def token_supervisor():
    return crear_access_token_movil(
        usuario_id=1,
        rol_id=5,
        is_admin=True
    )


def test_sse_endpoint_requiere_autenticacion(cliente):
    """Verifica que sin token devuelva 401 Unauthorized."""
    response = cliente.get("/logistica/eventos/stream")
    assert response.status_code == 401


def test_sse_outbox_recibe_evento_insertado(cliente, token_supervisor):
    """Verifica inserción en evento_logistica y lectura desde la outbox."""
    db = SessionLocal()
    evento_id = None
    try:
        # Insertar evento de prueba en la outbox
        res = db.execute(
            text("""
                INSERT INTO public.evento_logistica (
                    sucursal_id, usuario_id, asignacion_id, tipo, payload
                ) VALUES (
                    2, 1, 999999, 'TEST_PING_SSE', '{"test": true, "timestamp": 12345}'::jsonb
                ) RETURNING id;
            """)
        )
        evento_id = res.scalar()
        db.commit()

        assert evento_id is not None

        # Consultar outbox directamente
        row = db.execute(
            text("SELECT tipo, payload FROM public.evento_logistica WHERE id = :id"),
            {"id": evento_id}
        ).fetchone()
        assert row[0] == 'TEST_PING_SSE'
        assert row[1]["test"] is True
    finally:
        if evento_id:
            db.execute(text("DELETE FROM public.evento_logistica WHERE id = :id"), {"id": evento_id})
            db.commit()
        db.close()


def test_sse_limpieza_eventos_antiguos():
    """Verifica que la función limpiar_eventos_logistica_antiguos ejecute sin errores."""
    db = SessionLocal()
    try:
        res = db.execute(text("SELECT public.limpiar_eventos_logistica_antiguos()")).scalar()
        assert isinstance(res, int)
    finally:
        db.close()
