from functools import lru_cache

from app.Models.Qr.QrBasico import QrCartel, QrParametros

class CartelesEmpaque:
    @staticmethod
    @lru_cache(maxsize=32)
    def Bobina(generado_por: str | None) -> bytes:
        parametros = QrParametros(
            ruta="/empaque/bobina-inventario",
            titulo="Inventario de Empaque en Bobina",
            subtitulo="Escanee para ver el empaque en bobina y trasladarlo a producción",
            generado_por=generado_por,
        )
        return QrCartel(parametros).aPdf()

    @staticmethod
    @lru_cache(maxsize=32)
    def Bolsa(generado_por: str | None) -> bytes:
        parametros = QrParametros(
            ruta="/empaque/bolsa-inventario",
            titulo="Inventario de Empaque en Bolsa",
            subtitulo="Escanee para registrar la salida de empaques en bolsa",
            generado_por=generado_por,
        )
        return QrCartel(parametros).aPdf()

    @staticmethod
    @lru_cache(maxsize=32)
    def Jaba(generado_por: str | None) -> bytes:
        parametros = QrParametros(
            ruta="/empaque/jaba-inventario",
            titulo="Inventario de Bolsas de Jaba",
            subtitulo="Escanee para registrar la salida de bolsas de jaba",
            generado_por=generado_por,
        )
        return QrCartel(parametros).aPdf()
