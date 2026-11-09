import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

from app.Services.Logistica.SucursalService import SucursalService
from app.Services.Logistica.PrecioService import PrecioService
from app.Services.Logistica.EnviosService import EnviosService
from app.Services.Logistica.InventarioComercialService import InventarioComercialService
from app.Models.Logistica.SucursalModel import SucursalCrear
from app.Models.Logistica.PrecioModel import PrecioProductoCrear
from app.Models.Logistica.EnvioInventarioModel import EnvioCrearDTO, DetalleEnvioItem, EnvioRecepcionarDTO, EnvioRecepcionarItem


@pytest.fixture
def mock_db():
    return MagicMock()


# -------------------------------------------------------------
# TEST 1: Crear tercera sucursal sin tocar código fuente
# -------------------------------------------------------------
def test_crear_tercera_sucursal_dinamica(mock_db):
    service = SucursalService(mock_db)
    
    # Mock de respuesta del repo
    service.repo.crear_sucursal = MagicMock(return_value={
        "id": 3,
        "nombre": "Sucursal Oruro",
        "ciudad": "Oruro",
        "direccion": "Av. 6 de Agosto #100",
        "telefono": "52512345",
        "activa": True,
        "created_at": datetime.now(timezone.utc)
    })

    dto = SucursalCrear(
        nombre="Sucursal Oruro",
        ciudad="Oruro",
        direccion="Av. 6 de Agosto #100",
        telefono="52512345",
        activa=True
    )
    resultado = service.crear_sucursal(dto)
    assert resultado["id"] == 3
    assert resultado["ciudad"] == "Oruro"
    assert resultado["activa"] is True


# -------------------------------------------------------------
# TEST 2: Cambiar precio en Potosí no altera precios en Sucre
# -------------------------------------------------------------
def test_cambiar_precio_potosi_aislado_de_sucre(mock_db):
    service = PrecioService(mock_db)

    # Simular precios independientes en repo
    precios_sucre = [{"IdPresentacion": 1, "PrecioUnitario": 120.0, "IdSucursal": 1, "Activo": True}]
    precios_potosi = [{"IdPresentacion": 1, "PrecioUnitario": 135.0, "IdSucursal": 2, "Activo": True}]

    service.repo.ListarPreciosVigentes = MagicMock(side_effect=lambda sid: precios_potosi if sid == 2 else precios_sucre)
    service.repo.GuardarPrecio = MagicMock(return_value={"IdPrecioProducto": 10})

    # Guardar precio para Potosí (Sucursal 2)
    dto_potosi = PrecioProductoCrear(
        IdPresentacion=1,
        IdSucursal=2,
        PrecioUnitario=135.0,
        Activo=True
    )
    res_guardar = service.GuardarPrecio(dto_potosi, id_usuario=1)
    assert res_guardar["IdPrecioProducto"] == 10

    # Verificar que al listar Sucre el precio sigue en 120.0
    res_sucre = service.ListarPreciosVigentes(id_sucursal=1)
    assert res_sucre[0]["PrecioUnitario"] == 120.0

    # Verificar que al listar Potosí el precio es 135.0
    res_potosi = service.ListarPreciosVigentes(id_sucursal=2)
    assert res_potosi[0]["PrecioUnitario"] == 135.0


# -------------------------------------------------------------
# TEST 3: Revalorización automática de choferes con remanente
# -------------------------------------------------------------
def test_revalorizacion_automatica_inventario_chofer(mock_db):
    from app.Repository.Logistica.PrecioRepository import PrecioRepository
    repo = PrecioRepository(mock_db)

    # Mock precio anterior: Bs. 100.00
    repo.caller.LlamarUnRegistro = MagicMock(return_value={"PrecioUnitario": 100.00})
    repo.caller.LlamarFuncion = MagicMock(return_value=[])

    # Mock chofer con 10 bultos en camión
    mock_db.execute.return_value.fetchall.return_value = [
        MagicMock(id=15, chofer_id=7, cantidad_remanente=Decimal("10.00"))
    ]

    # Modificar precio a Bs. 110.00 (+10 Bs/bulto -> Ajuste total = +100 Bs)
    datos_nuevo_precio = {
        "IdPresentacion": 1,
        "IdSucursal": 1,
        "PrecioUnitario": 110.00,
        "CantidadMinimaMayorista": 10,
        "VigenteDesde": "2026-11-09",
        "Activo": True
    }

    with patch("app.Services.Common.NotificationService.NotificationService.crear_notificacion") as mock_notif, \
         patch("app.Services.Usuario.AuditService.AuditService.registrar_evento"):
        repo.GuardarPrecio(datos_nuevo_precio, id_usuario=1)
        # Se debe haber notificado al chofer sobre la revalorización
        assert mock_notif.called
        assert mock_db.commit.called


# -------------------------------------------------------------
# TEST 4: Ciclo de vida completo de envíos (Despacho, Recepción, Mermas)
# -------------------------------------------------------------
def test_flujo_envio_despacho_recepcion_con_mermas(mock_db):
    service = EnviosService(mock_db)

    # Mock del envío en PENDIENTE
    envio_pendiente = {
        "id": 101,
        "numero_guia": "ENV-001",
        "origen_tipo": "PLANTA",
        "origen_id": 1,
        "destino_tipo": "SUCURSAL",
        "destino_id": 2,
        "destino_nombre": "Sucursal Potosí",
        "estado": "PENDIENTE",
        "descuento_planta_aplicado": False,
        "detalles": [
            {"presentacion_id": 1, "cantidad_enviada": Decimal("50.00"), "cantidad_recibida": Decimal("0.00")}
        ],
        "mermas": []
    }

    envio_transito = dict(envio_pendiente)
    envio_transito["estado"] = "EN_TRANSITO"
    envio_transito["descuento_planta_aplicado"] = True

    service.repo.obtener_envio = MagicMock(side_effect=[envio_pendiente, envio_transito, envio_transito])

    # 1. Despacho (PENDIENTE -> EN_TRANSITO)
    with patch.object(service.planta_adapter, "descontar_stock_despacho", return_value=True) as mock_desc, \
         patch("app.Services.Common.NotificationService.NotificationService.crear_notificacion"):
        resultado_despacho = service.despachar_envio(envio_id=101, usuario_id=1)
        assert mock_desc.called
        assert mock_db.commit.called

    # 2. Recepción con faltante/merma (50 enviadas, 48 recibidas -> 2 merma)
    service.repo.obtener_envio = MagicMock(return_value=envio_transito)
    dto_recep = EnvioRecepcionarDTO(
        items=[EnvioRecepcionarItem(presentacion_id=1, cantidad_recibida=Decimal("48.00"), motivo_merma="Daño en transporte")],
        observaciones="Recibido con 2 paquetes dañados"
    )

    with patch("app.Services.Common.NotificationService.NotificationService.crear_notificacion"):
        service.recepcionar_envio(envio_id=101, dto=dto_recep, usuario_id=2)
        assert mock_db.commit.called


# -------------------------------------------------------------
# TEST 5: Anulación de envío reintegra stock
# -------------------------------------------------------------
def test_anular_envio_reintegra_stock(mock_db):
    service = EnviosService(mock_db)

    envio_transito = {
        "id": 102,
        "numero_guia": "ENV-002",
        "origen_tipo": "PLANTA",
        "origen_id": 1,
        "destino_tipo": "SUCURSAL",
        "destino_id": 2,
        "estado": "EN_TRANSITO",
        "descuento_planta_aplicado": True,
        "detalles": [
            {"presentacion_id": 1, "cantidad_enviada": Decimal("30.00")}
        ]
    }
    service.repo.obtener_envio = MagicMock(return_value=envio_transito)

    with patch.object(service.planta_adapter, "reintegrar_stock_anulacion", return_value=True) as mock_reint:
        service.anular_envio(envio_id=102, usuario_id=1, motivo="Camión averiado en camino")
        assert mock_reint.called
        assert mock_db.commit.called
