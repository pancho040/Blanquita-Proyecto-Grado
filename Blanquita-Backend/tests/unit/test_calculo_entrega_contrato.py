import pytest
from app.utils.calculo_entrega import (
    calcular_total_entrega,
    validar_coherencia_cobro,
    redondear_dos_decimales,
)


def test_calculo_caso_real_potosi_375_vs_348_30():
    """
    Caso real diagnosticado:
    - 5 Mega Rollo @ 37.80 = 189.00
    - 5 Económico @ 27.00 = 135.00 (el pedido original tenía 6 = 162.00)
    - 5 Merma @ 4.86 = 24.30
    Total entregado esperado: 348.30 (no 375.00, diferencia exacta de 26.70)
    """
    items = [
        {"presentacion_id": 10, "cantidad": 5, "precio_unitario": 37.80, "es_bandeo": False},
        {"presentacion_id": 11, "cantidad": 5, "precio_unitario": 27.00, "es_bandeo": False},
        {"presentacion_id": 13, "cantidad": 5, "precio_unitario": 4.86, "es_bandeo": False},
    ]

    total, items_calc = calcular_total_entrega(items)
    assert total == 348.30
    assert len(items_calc) == 3
    assert items_calc[0]["subtotal"] == 189.00
    assert items_calc[1]["subtotal"] == 135.00
    assert items_calc[2]["subtotal"] == 24.30

    # Validar coherencia cobro sin excedente: 375.00 vs 348.30 debe dar invalido y excede True
    res_val = validar_coherencia_cobro(
        total_entregado=total,
        monto_cobrado=375.00,
    )
    assert res_val["valido"] is False
    assert res_val["excede"] is True
    assert res_val["diferencia"] == 26.70

    # Con cobro exacto 348.30 debe dar valido
    res_val_ok = validar_coherencia_cobro(
        total_entregado=total,
        monto_cobrado=348.30,
    )
    assert res_val_ok["valido"] is True
    assert res_val_ok["excede"] is False
    assert res_val_ok["diferencia"] == 0.0


def test_calculo_con_cortesia_bandeo():
    """Los productos en bandeo o cortesía deben tener costo 0.00 en el total de entrega"""
    items = [
        {"presentacion_id": 10, "cantidad": 3, "precio_unitario": 37.80, "es_bandeo": False},
        {"presentacion_id": 11, "cantidad": 1, "precio_unitario": 27.00, "es_bandeo": True},  # Cortesía
    ]
    total, items_calc = calcular_total_entrega(items)
    assert total == 113.40
    assert items_calc[1]["subtotal"] == 0.00


def test_redondeo_dos_decimales_financiero():
    assert redondear_dos_decimales(348.30000000000007) == 348.30
    assert redondear_dos_decimales(26.69999999999999) == 26.70
    assert redondear_dos_decimales(0.005) == 0.01
