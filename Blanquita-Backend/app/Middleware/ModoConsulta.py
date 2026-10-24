from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.Constants.Horario import (
    MENSAJE_SOLO_CONSULTA,
    METODOS_LECTURA,
    RUTAS_PERMITIDAS_SOLO_CONSULTA,
)
from app.utils.horario import en_modo_consulta

HTTP_423_LOCKED = 423


class ModoConsultaMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        ruta = request.url.path.rstrip("/") or "/"
        if (
            request.method not in METODOS_LECTURA
            and ruta not in RUTAS_PERMITIDAS_SOLO_CONSULTA
            and en_modo_consulta()
        ):
            return JSONResponse(status_code=HTTP_423_LOCKED, content={"detail": MENSAJE_SOLO_CONSULTA})
        return await call_next(request)
