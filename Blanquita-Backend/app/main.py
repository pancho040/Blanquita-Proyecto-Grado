from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.Routes.Usuario.UsuarioRouter import UsuarioRouter
from app.Routes.Usuario.AuthRouter import AuthRouter

from app.Routes.BobinaPapel.BobinaPapelRouter import BobinaPapelRouter
from app.Routes.BobinaPapel.InventarioRouter import InventarioBobinaPapelRouter
from app.Routes.BobinaPapel.ProduccionRouter import ProduccionBobinaPapelRouter
from app.Routes.BobinaPapel.Reporte import bpReporteRouter


from app.Routes.Rodela.RodelaRouter import RodelaRouter
from app.Routes.Rodela.InventarioRouter import InventarioRodelaRouter
from app.Routes.Rodela.Reporte import RodelaReporteRouter


from app.Routes.Empaque.EmpaqueBobinaRouter import EmpaqueBobinaRouter
from app.Routes.Empaque.EmpaqueBolsaRouter import EmpaqueBolsaRouter


from app.Routes.BobinaServilleta.BobinaServilletaRouter import BobinaServilletaRouter
from app.Routes.BobinaServilleta.ProduccionRouter import ProduccionBobinaServilletaRouter
from app.Routes.BobinaServilleta.InventarioRouter import InventarioBobinaServilletaRouter
from app.Routes.BobinaServilleta.Reporte import bs_ReporteRouter

from app.Routes.InventarioFinal.ProductoFinal import ProductoFinalRouter

from app.Routes.Proveedor.Proveedor import ProveedorRouter

from app.Routes.Qr.InventarioProducto import qrRouter

from app.Routes.Logistica.ClienteRouter import ClienteRouter
from app.Routes.Logistica.RutaRouter import RutaRouter
from app.Routes.Logistica.PrecioRouter import PrecioRouter

from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.Auth.Limiter import limiter
from slowapi.middleware import SlowAPIMiddleware



app=FastAPI(debug=True
            ,title="Backend Blanquita"
            ,version="1.0.0"
            ,redirect_slashes=True
            ,docs_url="/documentacion")
origins=[
    "*"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(SlowAPIMiddleware)

app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler
)


@app.get("/")
def Servidor():
    return{
        "Servidor":"El servidor dice hola",
        "Documentación en:":" http://127.0.0.1:8000/documentacion"
    }


#ROUTERS USUARIO
app.include_router(UsuarioRouter)
app.include_router(AuthRouter)



#ROUTERS BOBINA PAPEL
app.include_router(BobinaPapelRouter)
app.include_router(InventarioBobinaPapelRouter)
app.include_router(ProduccionBobinaPapelRouter)
app.include_router(bpReporteRouter)


#ROUTERS RODELA
app.include_router(RodelaRouter)
app.include_router(InventarioRodelaRouter)
app.include_router(RodelaReporteRouter)




#ROUTERS BOBINA SERVILLETA
app.include_router(BobinaServilletaRouter)
app.include_router(ProduccionBobinaServilletaRouter)
app.include_router(InventarioBobinaServilletaRouter)
app.include_router(bs_ReporteRouter)


#ROUTERS EMPAQUE BOBINA / BOLSA
app.include_router(EmpaqueBobinaRouter)
app.include_router(EmpaqueBolsaRouter)

#ROUTERS INVENTARIO PRODUCTO FINAL
app.include_router(ProductoFinalRouter)

#ROUTERS PROVEEDOR
app.include_router(ProveedorRouter)

#ROUTERS GENERADORES DE QR
app.include_router(qrRouter)

#ROUTERS LOGISTICA
app.include_router(ClienteRouter)
app.include_router(RutaRouter)
app.include_router(PrecioRouter)
