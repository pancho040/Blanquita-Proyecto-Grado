from functools import lru_cache

from app.Models.Qr.QrBasico import QrCartel, QrParametros

class CartelesProductoTerminado:
    @staticmethod
    @lru_cache(maxsize=32)
    def Inventario(generado_por: str | None) -> bytes:
        parametros = QrParametros(
            ruta="/producto/inventario",
            titulo="Inventario de Producto Terminado",
            subtitulo="Escanee para ver el inventario de producto terminado",
            generado_por=generado_por,
        )
        return QrCartel(parametros).aPdf()

    @staticmethod
    @lru_cache(maxsize=32)
    def Movimientos(generado_por: str | None) -> bytes:
        parametros = QrParametros(
            ruta="/producto/movimientos",
            titulo="Movimientos de Producto Terminado",
            subtitulo="Escanee para registrar los movimientos de producto terminado",
            generado_por=generado_por,
        )
        return QrCartel(parametros).aPdf()
