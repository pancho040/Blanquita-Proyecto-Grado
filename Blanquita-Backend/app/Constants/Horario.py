from datetime import time

HORA_INICIO_SOLO_CONSULTA = time(0, 0, 0)
HORA_FIN_SOLO_CONSULTA = time(5, 59, 59)

METODOS_LECTURA = {"GET", "HEAD", "OPTIONS"}

RUTAS_PERMITIDAS_SOLO_CONSULTA = {
    "/auth/login",
    "/auth/refresh",
    "/auth/logout",
    "/auth/logout-todos",
    "/Usuario/estado",
}

MENSAJE_SOLO_CONSULTA = (
    f"Sistema en modo consulta de {HORA_INICIO_SOLO_CONSULTA:%H:%M} a {HORA_FIN_SOLO_CONSULTA:%H:%M}, "
    "solo se permite ver información y descargar reportes"
)
MENSAJE_ACTIVAR_USUARIO_SOLO_CONSULTA = (
    "En modo consulta solo se puede inactivar o suspender usuarios"
)
