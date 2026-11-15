"""
calculo_entrega.py
Módulo canónico de cálculo de total de entrega y validación de cobro.
Garantiza 100% de paridad con calculoEntrega.js del móvil.
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Tuple


def redondear_dos_decimales(val: float | Decimal | int | None) -> float:
    if val is None:
        return 0.0
    d = Decimal(str(val))
    return float(d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def calcular_total_entrega(items: List[Dict[str, Any]]) -> Tuple[float, List[Dict[str, Any]]]:
    """
    Calcula el subtotal por ítem y el total acumulado de la entrega.
    Aplica redondeo ROUND_HALF_UP a dos decimales de forma determinista.
    """
    if not items:
        return 0.0, []

    total_acumulado = Decimal("0.00")
    items_calculados = []

    for it in items:
        cant_raw = it.get("cantidad") if it.get("cantidad") is not None else it.get("cantidadAEntregar", 0)
        cant = Decimal(str(cant_raw or 0))
        cant = max(Decimal("0.00"), cant)

        pu_raw = it.get("precio_unitario") or it.get("PrecioUnitario") or it.get("precio") or 0
        pu = Decimal(str(pu_raw or 0))
        pu = max(Decimal("0.00"), pu)

        es_bandeo = bool(it.get("es_bandeo") or it.get("es_cortesia_bandeo"))
        descuento = Decimal(str(it.get("descuento") or 0))
        descuento = max(Decimal("0.00"), descuento)

        if es_bandeo:
            subtotal = Decimal("0.00")
        else:
            subtotal = (cant * pu - descuento).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            subtotal = max(Decimal("0.00"), subtotal)

        total_acumulado += subtotal

        it_copia = dict(it)
        it_copia["cantidad"] = float(cant)
        it_copia["precio_unitario"] = float(pu)
        it_copia["es_bandeo"] = es_bandeo
        it_copia["subtotal"] = float(subtotal)
        items_calculados.append(it_copia)

    return float(total_acumulado.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)), items_calculados


def validar_coherencia_cobro(total_entregado: float, monto_cobrado: float, tolerancia: float = 0.05) -> Dict[str, Any]:
    """
    Valida si el monto cobrado excede el valor total entregado.
    """
    tot = redondear_dos_decimales(total_entregado)
    cob = redondear_dos_decimales(monto_cobrado)
    diferencia = round(cob - tot, 2)
    excede = cob > round(tot + tolerancia, 2)

    return {
        "valido": not excede,
        "excede": excede,
        "total_entregado": tot,
        "monto_cobrado": cob,
        "diferencia": max(0.0, diferencia),
    }
