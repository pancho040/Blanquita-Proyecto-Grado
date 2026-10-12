from functools import lru_cache

from app.Models.Qr.QrBasico import QrCartel, QrParametros

class CartelesInsumo:
    @staticmethod
    @lru_cache(maxsize=32)
    def Inventario(generado_por: str | None) -> bytes:
        parametros = QrParametros(
            ruta="/insumos/inventario",
            titulo="Inventario de Insumos",
            subtitulo="Escanee para registrar ingresos y salidas de insumos",
            generado_por=generado_por,
        )
        return QrCartel(parametros).aPdf()
