"""
Módulo de Limitación de Tasa (Rate Limiting) y Resolución Segura de IP.
Diseñado para operar de forma segura detrás de proxies de confianza (Render / Cloudflare).
"""

from slowapi import Limiter


def obtener_ip_real(request) -> str:
    """
    Obtiene la IP de cliente real de forma segura detrás de proxies de confianza.
    
    Protección contra falsificación (IP Spoofing):
    Un cliente malicioso puede enviar una cabecera arbitraria 'X-Forwarded-For: 1.1.1.1'.
    Al pasar por el proxy reverso de Render / Cloudflare, el proxy concatena la IP de conexión
    real del cliente al final: '1.1.1.1, <IP_REAL>'.
    Tomar el primer elemento (split(',')[0]) es vulnerable a spoofing.
    Tomar el último elemento (split(',')[-1]) o cabeceras de borde de confianza garantiza
    que la IP evaluada sea la validada por el proxy de la infraestructura.
    """
    # 1. Cabeceras directas de proxies de borde no modificables por el cliente final
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip and cf_ip.strip():
        return cf_ip.strip()

    true_ip = request.headers.get("true-client-ip")
    if true_ip and true_ip.strip():
        return true_ip.strip()

    # 2. X-Forwarded-For: la IP agregada por el proxy de confianza es la última de la cadena
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        partes = [p.strip() for p in forwarded_for.split(",") if p.strip()]
        if partes:
            return partes[-1]

    # 3. Conexión directa / entorno de desarrollo
    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


limiter = Limiter(
    key_func=obtener_ip_real
)
