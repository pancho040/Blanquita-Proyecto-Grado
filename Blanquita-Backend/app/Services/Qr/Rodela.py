from functools import lru_cache

from app.Models.Qr.QrBasico import QrCartel, QrParametros

class CartelesRodela:
    @staticmethod
    @lru_cache(maxsize=32)
    def Inventario(generado_por: str | None) -> bytes:
        parametros = QrParametros(
            ruta="/rodela/inventario",
            titulo="Inventario de Rodelas",
            subtitulo="Escanee para ver las rodelas y trasladarlas a producción",
            generado_por=generado_por,
        )
        return QrCartel(parametros).aPdf()

    @staticmethod
    @lru_cache(maxsize=32)
    def Produccion(generado_por: str | None) -> bytes:
        parametros = QrParametros(
            ruta="/rodela/produccion",
            titulo="Producción de Rodelas",
            subtitulo="Escanee para ver las rodelas en producción",
            generado_por=generado_por,
        )
        return QrCartel(parametros).aPdf()
