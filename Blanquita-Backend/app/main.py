from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.Routes.Usuario.UsuarioRouter import UsuarioRouter
from app.Routes.Usuario.AuthRouter import AuthRouter
from app.Routes.Usuario.RegistroIngresoRouter import RegistroIngresoRouter
from app.Routes.Usuario.HistorialAdminRouter import HistorialAdminRouter

from app.Routes.BobinaPapel.BobinaPapelRouter import BobinaPapelRouter
from app.Routes.BobinaPapel.InventarioRouter import InventarioBobinaPapelRouter
from app.Routes.BobinaPapel.ProduccionRouter import ProduccionBobinaPapelRouter
from app.Routes.BobinaPapel.Reporte import bpReporteRouter
from app.Routes.BobinaPapel.TipoBobinaRouter import TipoBobinaRouter
from app.Routes.BobinaPapel.InicioRouter import InicioBobinaPapelRouter


from app.Routes.Rodela.RodelaRouter import RodelaRouter
from app.Routes.Rodela.InventarioRouter import InventarioRodelaRouter
from app.Routes.Rodela.Reporte import RodelaReporteRouter
from app.Routes.Rodela.TipoRodelaRouter import TipoRodelaRouter
from app.Routes.Rodela.InicioRouter import InicioRodelaRouter


from app.Routes.Empaque.EmpaqueBobinaRouter import EmpaqueBobinaRouter
from app.Routes.Empaque.EmpaqueBolsaRouter import EmpaqueBolsaRouter
from app.Routes.Empaque.BolsaJavaRouter import BolsaJavaRouter
from app.Routes.Empaque.Reporte import EmpaqueReporteRouter
from app.Routes.Empaque.TipoEmpaqueRouter import TipoEmpaqueRouter
from app.Routes.Empaque.InicioRouter import InicioEmpaqueRouter


from app.Routes.BobinaServilleta.BobinaServilletaRouter import BobinaServilletaRouter
from app.Routes.BobinaServilleta.ProduccionRouter import ProduccionBobinaServilletaRouter
from app.Routes.BobinaServilleta.InventarioRouter import InventarioBobinaServilletaRouter
from app.Routes.BobinaServilleta.Reporte import bs_ReporteRouter
from app.Routes.BobinaServilleta.TipoBobinaServilletaRouter import TipoBobinaServilletaRouter
from app.Routes.BobinaServilleta.FormatoSubBobinaRouter import FormatoSubBobinaRouter
from app.Routes.BobinaServilleta.InicioRouter import InicioBobinaServilletaRouter

from app.Routes.InventarioFinal.ProductoFinal import ProductoFinalRouter
from app.Routes.InventarioFinal.Reporte import ProductoFinalReporteRouter
from app.Routes.InventarioFinal.LineaProductoRouter import LineaProductoRouter
from app.Routes.InventarioFinal.InicioRouter import InicioProductoTerminadoRouter

from app.Routes.Proveedor.Proveedor import ProveedorRouter

from app.Routes.Qr.InventarioProducto import qrRouter

from app.Routes.Insumo.Insumo import InsumoRouter
from app.Routes.Insumo.Reporte import InsumoReporteRouter
from app.Routes.Insumo.InicioRouter import InicioInsumoRouter

from app.Routes.AlertaStock.AlertaStock import AlertaStockRouter

from app.Routes.Notificacion.NotificacionRouter import NotificacionRouter

from app.Routes.Inicio.GerenteRouter import InicioGerenteRouter

from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.Auth.Limiter import limiter
from slowapi.middleware import SlowAPIMiddleware
from app.Middleware.ModoConsulta import ModoConsultaMiddleware



app=FastAPI(debug=True
            ,title="Backend Blanquita"
            ,version="1.0.0"
            ,redirect_slashes=True
            ,docs_url="/documentacion")
origins=[
    "*"
]
app.add_middleware(ModoConsultaMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH"],
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
app.include_router(RegistroIngresoRouter)
app.include_router(HistorialAdminRouter)



#ROUTERS BOBINA PAPEL
app.include_router(BobinaPapelRouter)
app.include_router(InventarioBobinaPapelRouter)
app.include_router(ProduccionBobinaPapelRouter)
app.include_router(bpReporteRouter)
app.include_router(TipoBobinaRouter)
app.include_router(InicioBobinaPapelRouter)


#ROUTERS RODELA
app.include_router(RodelaRouter)
app.include_router(InventarioRodelaRouter)
app.include_router(RodelaReporteRouter)
app.include_router(TipoRodelaRouter)
app.include_router(InicioRodelaRouter)




#ROUTERS BOBINA SERVILLETA
app.include_router(BobinaServilletaRouter)
app.include_router(ProduccionBobinaServilletaRouter)
app.include_router(InventarioBobinaServilletaRouter)
app.include_router(bs_ReporteRouter)
app.include_router(TipoBobinaServilletaRouter)
app.include_router(FormatoSubBobinaRouter)
app.include_router(InicioBobinaServilletaRouter)


#ROUTERS EMPAQUE BOBINA / BOLSA / BOLSA JABA
app.include_router(EmpaqueBobinaRouter)
app.include_router(EmpaqueBolsaRouter)
app.include_router(BolsaJavaRouter)
app.include_router(EmpaqueReporteRouter)
app.include_router(TipoEmpaqueRouter)
app.include_router(InicioEmpaqueRouter)

#ROUTERS INVENTARIO PRODUCTO FINAL
app.include_router(ProductoFinalRouter)
app.include_router(ProductoFinalReporteRouter)
app.include_router(LineaProductoRouter)
app.include_router(InicioProductoTerminadoRouter)

#ROUTERS PROVEEDOR
app.include_router(ProveedorRouter)

#ROUTERS GENERADORES DE QR
app.include_router(qrRouter)

#ROUTERS INSUMOS
app.include_router(InsumoRouter)
app.include_router(InsumoReporteRouter)
app.include_router(InicioInsumoRouter)

#ROUTERS ALERTAS DE STOCK
app.include_router(AlertaStockRouter)

#ROUTERS NOTIFICACIONES
app.include_router(NotificacionRouter)

#ROUTERS INICIO GERENTE
app.include_router(InicioGerenteRouter)
