"""
Módulo de Limitación de Tasa (Rate Limiting) y Resolución Segura de IP.
Diseñado para operar de forma segura detrás de proxies de confianza (Render / Cloudflare).
"""

from slowapi import Limiter


def obtener_ip_real(request):
    """
    Obtiene la IP real del cliente evitando IP-Spoofing.
    En Render, el reverse proxy de entrada agrega la IP de conexión
    al FINAL de la cabecera X-Forwarded-For.
    No se confía en cf-connecting-ip (inyectable si la conexión es directa a Render)
    ni en los primeros valores de X-Forwarded-For (inyectables por el cliente).
    """
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        ips = [ip.strip() for ip in forwarded_for.split(",") if ip.strip()]
        if ips:
            return ips[-1]
    return request.client.host if request.client else "desconocido"


limiter = Limiter(
    key_func=obtener_ip_real,
    default_limits=["120/minute"],
    storage_uri="memory://",
    strategy="fixed-window",
)
