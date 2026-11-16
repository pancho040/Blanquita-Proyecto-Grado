import json
from decimal import Decimal
from datetime import date, datetime
from uuid import UUID
from typing import Any


def json_safe_encoder(obj: Any) -> Any:
    """Encoder seguro universal para tipos no serializables por defecto (Decimal, datetime, date, UUID, set, tuple)."""
    if isinstance(obj, Decimal):
        # Convertir a float
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, (set, tuple)):
        return list(obj)
    if hasattr(obj, "dict") and callable(getattr(obj, "dict")):
        return obj.dict()
    if hasattr(obj, "model_dump") and callable(getattr(obj, "model_dump")):
        return obj.model_dump()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def json_dumps_safe(obj: Any, **kwargs: Any) -> str:
    """Serializa un objeto a JSON garantizando compatibilidad con Decimals, fechas, UUIDs y colecciones."""
    if "default" not in kwargs:
        kwargs["default"] = json_safe_encoder
    return json.dumps(obj, **kwargs)
