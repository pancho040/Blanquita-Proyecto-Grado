import os
import pytest
from decimal import Decimal
from unittest.mock import MagicMock
from app.adapters.planta_fabricio_adapter import (
    FabricioLegacyAdapter,
    PlantaNoSoportadaException,
    StockInsuficienteException,
)


@pytest.fixture
def adapter():
    return FabricioLegacyAdapter()


def test_validar_planta_inexistente(adapter):
    mock_session = MagicMock()
    mock_session.execute.return_value.fetchone.return_value = None
    
    with pytest.raises(PlantaNoSoportadaException, match="no existe"):
        adapter.get_stock_disponible(mock_session, planta_id=999, presentacion_id=1)


def test_validar_planta_no_legacy(adapter):
    mock_session = MagicMock()
    # Mock planta con proveedor distinto
    mock_session.execute.return_value.fetchone.return_value = MagicMock(
        id=2, proveedor_inventario="COMERCIAL_PROPIO", activa=True
    )
    
    with pytest.raises(PlantaNoSoportadaException, match="no está gestionada por el proveedor FABRICIO_LEGACY"):
        adapter.get_stock_disponible(mock_session, planta_id=2, presentacion_id=1)


def test_get_stock_disponible_exitoso(adapter):
    mock_session = MagicMock()
    mock_session.execute.return_value.fetchone.side_effect = [
        # Retorno de _validar_planta
        MagicMock(id=1, proveedor_inventario="FABRICIO_LEGACY", activa=True),
        # Retorno de query stock
        (Decimal("150.00"),)
    ]
    
    stock = adapter.get_stock_disponible(mock_session, planta_id=1, presentacion_id=1)
    assert stock == Decimal("150.00")


def test_descuento_con_interruptor_inactivo(adapter, monkeypatch):
    monkeypatch.setenv("DESCONTAR_PLANTA_ACTIVO", "false")
    mock_session = MagicMock()
    mock_session.execute.return_value.fetchone.side_effect = [
        # 1. _validar_planta
        MagicMock(id=1, proveedor_inventario="FABRICIO_LEGACY", activa=True),
        # 2. get_stock_disponible -> _validar_planta
        MagicMock(id=1, proveedor_inventario="FABRICIO_LEGACY", activa=True),
        # 3. get_stock_disponible -> query stock
        (Decimal("100.00"),)
    ]
    
    resultado = adapter.descontar_stock_despacho(
        mock_session,
        planta_id=1,
        presentacion_id=1,
        cantidad=Decimal("50.00"),
        usuario_id=1,
        referencia_guia="ENV-001"
    )
    # Debe retornar False indicando que no se ejecutó el UPDATE físico en BD
    assert resultado is False


def test_descuento_con_stock_insuficiente(adapter, monkeypatch):
    monkeypatch.setenv("DESCONTAR_PLANTA_ACTIVO", "true")
    mock_session = MagicMock()
    mock_session.execute.return_value.fetchone.side_effect = [
        # 1. _validar_planta
        MagicMock(id=1, proveedor_inventario="FABRICIO_LEGACY", activa=True),
        # 2. get_stock_disponible -> _validar_planta
        MagicMock(id=1, proveedor_inventario="FABRICIO_LEGACY", activa=True),
        # 3. get_stock_disponible -> query stock (solo hay 10)
        (Decimal("10.00"),)
    ]
    
    with pytest.raises(StockInsuficienteException, match="Stock insuficiente"):
        adapter.descontar_stock_despacho(
            mock_session,
            planta_id=1,
            presentacion_id=1,
            cantidad=Decimal("50.00"),
            usuario_id=1,
            referencia_guia="ENV-001"
        )


def test_descuento_exitoso_con_interruptor_activo(adapter, monkeypatch):
    monkeypatch.setenv("DESCONTAR_PLANTA_ACTIVO", "true")
    mock_session = MagicMock()
    mock_session.execute.return_value.fetchone.side_effect = [
        # 1. _validar_planta
        MagicMock(id=1, proveedor_inventario="FABRICIO_LEGACY", activa=True),
        # 2. get_stock_disponible -> _validar_planta
        MagicMock(id=1, proveedor_inventario="FABRICIO_LEGACY", activa=True),
        # 3. get_stock_disponible -> query stock (hay 100)
        (Decimal("100.00"),),
        # 4. update returning CantidadActual
        (Decimal("50.00"),)
    ]
    
    resultado = adapter.descontar_stock_despacho(
        mock_session,
        planta_id=1,
        presentacion_id=1,
        cantidad=Decimal("50.00"),
        usuario_id=1,
        referencia_guia="ENV-001"
    )
    assert resultado is True
    # Verificar que nunca ejecutó commit
    assert mock_session.commit.call_count == 0


def test_reintegrar_stock_anulacion(adapter):
    mock_session = MagicMock()
    mock_session.execute.return_value.fetchone.return_value = MagicMock(
        id=1, proveedor_inventario="FABRICIO_LEGACY", activa=True
    )
    
    resultado = adapter.reintegrar_stock_anulacion(
        mock_session,
        planta_id=1,
        presentacion_id=1,
        cantidad=Decimal("30.00"),
        usuario_id=1,
        referencia_guia="ENV-001"
    )
    assert resultado is True
    assert mock_session.commit.call_count == 0
