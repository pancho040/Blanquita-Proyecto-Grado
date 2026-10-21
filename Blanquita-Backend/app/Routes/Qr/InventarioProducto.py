from fastapi import APIRouter, Depends, Response

from app.Auth.Dependencies import require_role, get_generado_por
from app.Services.Qr.BobinaPapel import CartelesBobinaPapel
from app.Services.Qr.BobinaServilleta import CartelesBobinaServilleta
from app.Services.Qr.ProductoTerminado import CartelesProductoTerminado
from app.Services.Qr.Insumo import CartelesInsumo
from app.Services.Qr.Rodela import CartelesRodela
from app.Services.Qr.Empaque import CartelesEmpaque
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL

qrRouter = APIRouter(
    prefix="/qr",
    tags=["Qr - Carteles de Escaneo"],
)

CONFIGURACION_PDF = {
    "status_code": 200,
    "response_class": Response,
    "responses": {200: {"content": {"application/pdf": {}}}},
    "dependencies": [Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
}


def _cartel(contenido: bytes, nombre_archivo: str) -> Response:
    return Response(
        content=contenido,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo}"',
            "Cache-Control": "no-store",
        },
    )


@qrRouter.get("/producto/inventario", **CONFIGURACION_PDF)
def QrPtInventario(generado_por: str | None = Depends(get_generado_por)) -> Response:
    return _cartel(
        CartelesProductoTerminado.Inventario(generado_por),
        "QR-ProductoTerminado-Inventario.pdf",
    )


@qrRouter.get("/producto/movimientos", **CONFIGURACION_PDF)
def QrPtMovimientos(generado_por: str | None = Depends(get_generado_por)) -> Response:
    return _cartel(
        CartelesProductoTerminado.Movimientos(generado_por),
        "QR-ProductoTerminado-Movimientos.pdf",
    )


@qrRouter.get("/bobina-papel/inventario", **CONFIGURACION_PDF)
def QrBpInventario(generado_por: str | None = Depends(get_generado_por)) -> Response:
    return _cartel(
        CartelesBobinaPapel.Inventario(generado_por),
        "QR-BobinaPapel-Inventario.pdf",
    )


@qrRouter.get("/bobina-papel/produccion", **CONFIGURACION_PDF)
def QrBpProduccion(generado_por: str | None = Depends(get_generado_por)) -> Response:
    return _cartel(
        CartelesBobinaPapel.Produccion(generado_por),
        "QR-BobinaPapel-Produccion.pdf",
    )


@qrRouter.get("/bobina-servilleta/inventario", **CONFIGURACION_PDF)
def QrBsInventario(generado_por: str | None = Depends(get_generado_por)) -> Response:
    return _cartel(
        CartelesBobinaServilleta.Inventario(generado_por),
        "QR-BobinaServilleta-Inventario.pdf",
    )


@qrRouter.get("/bobina-servilleta/produccion", **CONFIGURACION_PDF)
def QrBsProduccion(generado_por: str | None = Depends(get_generado_por)) -> Response:
    return _cartel(
        CartelesBobinaServilleta.Produccion(generado_por),
        "QR-BobinaServilleta-Produccion.pdf",
    )


@qrRouter.get("/rodela/inventario", **CONFIGURACION_PDF)
def QrRodelaInventario(generado_por: str | None = Depends(get_generado_por)) -> Response:
    return _cartel(
        CartelesRodela.Inventario(generado_por),
        "QR-Rodela-Inventario.pdf",
    )


@qrRouter.get("/rodela/produccion", **CONFIGURACION_PDF)
def QrRodelaProduccion(generado_por: str | None = Depends(get_generado_por)) -> Response:
    return _cartel(
        CartelesRodela.Produccion(generado_por),
        "QR-Rodela-Produccion.pdf",
    )


@qrRouter.get("/insumos/inventario", **CONFIGURACION_PDF)
def QrInsumoInventario(generado_por: str | None = Depends(get_generado_por)) -> Response:
    return _cartel(
        CartelesInsumo.Inventario(generado_por),
        "QR-Insumos-Inventario.pdf",
    )


@qrRouter.get("/empaque/bobina-inventario", **CONFIGURACION_PDF)
def QrEmpaqueBobina(generado_por: str | None = Depends(get_generado_por)) -> Response:
    return _cartel(
        CartelesEmpaque.Bobina(generado_por),
        "QR-Empaque-Bobina-Inventario.pdf",
    )


@qrRouter.get("/empaque/bolsa-inventario", **CONFIGURACION_PDF)
def QrEmpaqueBolsa(generado_por: str | None = Depends(get_generado_por)) -> Response:
    return _cartel(
        CartelesEmpaque.Bolsa(generado_por),
        "QR-Empaque-Bolsa-Inventario.pdf",
    )


@qrRouter.get("/empaque/jaba-inventario", **CONFIGURACION_PDF)
def QrEmpaqueJaba(generado_por: str | None = Depends(get_generado_por)) -> Response:
    return _cartel(
        CartelesEmpaque.Jaba(generado_por),
        "QR-Empaque-Jaba-Inventario.pdf",
    )
