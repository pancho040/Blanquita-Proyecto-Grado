import time
import functools
import logging
from typing import Any, Callable, Optional, Dict, Tuple

logger = logging.getLogger(__name__)

class TTLCache:
    """
    Cache en memoria liviano con tiempo de expiración (TTL) en segundos.
    Ideal para catálogos estáticos de baja mutabilidad (sucursales, configuración laboral, etc.).
    """
    def __init__(self, default_ttl: int = 120):
        self._store: Dict[str, Tuple[Any, float]] = {}
        self.default_ttl = default_ttl

    def get(self, key: str) -> Optional[Any]:
        if key in self._store:
            value, expires_at = self._store[key]
            if time.time() < expires_at:
                return value
            else:
                del self._store[key]
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        duration = ttl if ttl is not None else self.default_ttl
        self._store[key] = (value, time.time() + duration)

    def delete(self, key: str) -> bool:
        if key in self._store:
            del self._store[key]
            return True
        return False

    def invalidate_prefix(self, prefix: str) -> int:
        keys_to_del = [k for k in self._store if k.startswith(prefix)]
        for k in keys_to_del:
            del self._store[k]
        return len(keys_to_del)

    def clear(self) -> None:
        self._store.clear()

    def size(self) -> int:
        # Retorna cantidad de items activos
        now = time.time()
        self._store = {k: v for k, v in self._store.items() if v[1] > now}
        return len(self._store)


# Instancia singleton global para el backend
memory_cache = TTLCache(default_ttl=180)


def cached(ttl_seconds: int = 120, prefix: str = ""):
    """
    Decorador para cachear resultados de funciones basadas en sus argumentos.
    """
    def decorator(fn: Callable):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            # Para evitar que el primer argumento 'self' rompa el hash si el objeto no es hashable,
            # usamos el nombre de la clase o excluimos self si es un método.
            arg_list = []
            if args:
                first = args[0]
                # Si es un método de instancia (tiene __class__ y __dict__ o repo/service)
                if hasattr(first, '__class__') and not isinstance(first, (str, int, float, bool, tuple, list, dict)):
                    arg_list = [first.__class__.__name__] + list(args[1:])
                else:
                    arg_list = list(args)
            
            key_parts = [prefix or fn.__name__]
            key_parts.extend([str(a) for a in arg_list])
            key_parts.extend([f"{k}:{v}" for k, v in sorted(kwargs.items())])
            cache_key = ":".join(key_parts)

            cached_val = memory_cache.get(cache_key)
            if cached_val is not None:
                return cached_val

            result = fn(*args, **kwargs)
            memory_cache.set(cache_key, result, ttl=ttl_seconds)
            return result
        return wrapper
    return decorator
