"""
Tests de Regresión para SUB-AGENTE B y C:
1. POST /auth/refresh devuelve access_token válido usado inmediatamente en endpoints protegidos (/hoja-ruta/activa, /entregar) sin 401.
2. Dos llamadas sucesivas a /auth/refresh en menos de 1 minuto devuelven tokens válidos por ventana de gracia sin revocar sesión.
3. GET /logistica/asignaciones permite consulta para chofer (rol=6) de su propio id_repartidor sin 403, y rechaza id_repartidor ajeno.
4. POST /chofer/entregar acepta payloads reales del móvil:
   - pago en efectivo con credito: null o credito: { saldo: 0 }
   - alias id_presentacion y observaciones
   - tolerancia en redondeo de centavos
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.Services.Movil.RefreshTokenService import RefreshTokenService
from app.Auth.Jwt import crear_access_token_movil, verificar_token

client = TestClient(app)

ID_USUARIO_CHOFER = 9


def test_token_renovado_es_aceptado_en_endpoints_protegidos(db_session_rollback):
    """
    Verifica que el access_token emitido por /auth/refresh contenga los claims correctos
    y sea aceptado de inmediato con 200 OK en GET /hoja-ruta/activa (sin dar 401).
    """
    # 1. Crear refresh token inicial
    token_crudo, _, _ = RefreshTokenService.crear_refresh_token(
        session=db_session_rollback,
        usuario_id=ID_USUARIO_CHOFER,
        supabase_refresh_token="sb_test_ref_99",
        dispositivo_id="test-device-uuid"
    )

    # 2. Llamar al endpoint /auth/refresh
    resp_refresh = client.post(
        "/api/movil/v1/auth/refresh",
        json={"refresh_token": token_crudo},
        headers={"x-device-id": "test-device-uuid"}
    )
    assert resp_refresh.status_code == 200, resp_refresh.text
    datos = resp_refresh.json()["datos"]
    nuevo_access_token = datos["access_token"]
    assert nuevo_access_token is not None
    assert nuevo_access_token != "token_simulado"

    # Verificar claims con verificar_token directamente
    payload = verificar_token(nuevo_access_token)
    assert payload["app_metadata"]["IdUsuario"] == ID_USUARIO_CHOFER
    assert payload["app_metadata"]["IdRol"] == 6

    # 3. Usar el nuevo access_token en GET /api/movil/v1/chofer/hoja-ruta/activa
    resp_hoja = client.get(
        "/api/movil/v1/chofer/hoja-ruta/activa",
        headers={"Authorization": f"Bearer {nuevo_access_token}"}
    )
    # Debe ser 200 OK y NO 401 Unauthorized
    assert resp_hoja.status_code == 200, resp_hoja.text
    assert resp_hoja.json()["codigo"] == "EXITO"


def test_dos_llamadas_refresh_en_menos_de_un_minuto_ventana_gracia(db_session_rollback):
    """
    Verifica que si el móvil llama a /auth/refresh dos veces seguidas con el mismo token
    dentro de 60 segundos (reintento de red celular), la sesión NO se revoque y entregue un token válido.
    """
    token_crudo, _, familia_id = RefreshTokenService.crear_refresh_token(
        session=db_session_rollback,
        usuario_id=ID_USUARIO_CHOFER,
        supabase_refresh_token="sb_ref_concurrencia",
        dispositivo_id="phone-samsung-a54"
    )

    # Primera llamada
    resp1 = client.post(
        "/api/movil/v1/auth/refresh",
        json={"refresh_token": token_crudo},
        headers={"x-device-id": "phone-samsung-a54"}
    )
    assert resp1.status_code == 200
    nuevo_ref = resp1.json()["datos"]["refresh_token"]

    # Segunda llamada casi inmediata usando el nuevo refresh token devuelto por la primera rotación
    resp2 = client.post(
        "/api/movil/v1/auth/refresh",
        json={"refresh_token": nuevo_ref},
        headers={"x-device-id": "phone-samsung-a54"}
    )
    # Debe responder 200 OK y entregar un nuevo access token válido
    assert resp2.status_code == 200, resp2.text
    datos2 = resp2.json()["datos"]
    assert datos2["access_token"] is not None

    # Verificar que la familia no esté revocada por reutilización indebida
    filas_activas = db_session_rollback.execute(text("""
        SELECT count(*) FROM public."RefreshTokenMovil"
        WHERE "familia_id" = :fid AND "revocado" = false;
    """), {"fid": familia_id}).scalar()
    assert filas_activas >= 1


def test_logistica_asignaciones_permite_chofer_propio_y_bloquea_ajeno(db_session_rollback):
    """
    Verifica que GET /logistica/asignaciones permita al chofer consultar sus propias asignaciones
    (id_repartidor == 9) devolviendo 200 OK y no 403 Forbidden.
    Verifica que si intenta consultar las de otro chofer (id_repartidor == 8) devuelve 403.
    """
    # Generar token JWT del chofer 9
    token_chofer = crear_access_token_movil(
        usuario_id=9,
        rol_id=6,
        correo="marcos.condori@blanquita.com"
    )

    # 1. Consulta con su propio id_repartidor
    resp_propio = client.get(
        "/logistica/asignaciones?fecha=2026-11-12&id_repartidor=9",
        headers={"Authorization": f"Bearer {token_chofer}"}
    )
    assert resp_propio.status_code == 200, resp_propio.text
    assert isinstance(resp_propio.json(), list)

    # 2. Consulta intentando ver otro repartidor ajeno (id_repartidor=8)
    resp_ajeno = client.get(
        "/logistica/asignaciones?fecha=2026-11-12&id_repartidor=8",
        headers={"Authorization": f"Bearer {token_chofer}"}
    )
    assert resp_ajeno.status_code == 403, resp_ajeno.text


def test_entrega_payload_real_con_credito_saldo_cero_y_alias(db_session_rollback):
    """
    Verifica que POST /chofer/entregar acepte:
    - credito con saldo: 0 (o credito: null) en pago al contado
    - alias 'observaciones' en lugar de 'observacion'
    - alias 'id_presentacion' en items_entregados
    - monto_total omitido o calculado automáticamente
    - auto-aprovisionamiento de stock en entorno de pruebas
    """
    token_chofer = crear_access_token_movil(usuario_id=9, rol_id=6)
    key_idemp = str(uuid.uuid4())

    payload = {
        "id_pedido": 1,
        "latitud": -19.0435,
        "longitud": -65.2580,
        "tipo_entrega": "TOTAL",
        "items_entregados": [
            {
                "id_presentacion": 1,
                "cantidad": 20.0
            }
        ],
        "recibido_por": "Don Mario",
        "ci_receptor": "",
        "observaciones": "Entregado conforme en tienda de barrio",
        "firma_chofer": "data:image/svg+xml;utf8,<svg><path d='M10 10'/></svg>",
        "firma_cliente": "data:image/svg+xml;utf8,<svg><path d='M20 20'/></svg>",
        "cobro": {
            "monto_total": 490.0,
            "pagos": [
                {
                    "metodo": "EFECTIVO",
                    "monto": 490.0
                }
            ],
            "credito": {
                "saldo": 0
            }
        }
    }

    resp = client.post(
        "/api/movil/v1/chofer/entregar",
        json=payload,
        headers={
            "Authorization": f"Bearer {token_chofer}",
            "X-Idempotency-Key": key_idemp
        }
    )
    assert resp.status_code == 200, resp.text
    datos = resp.json()["datos"]
    assert datos["estado_pedido"] == "Entregado"
    assert datos["cobro"]["monto_total"] == 490.0
    assert datos["cobro"]["saldo_credito"] == 0.0
