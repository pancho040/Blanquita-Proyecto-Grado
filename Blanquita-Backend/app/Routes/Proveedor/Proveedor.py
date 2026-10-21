from fastapi import APIRouter,Depends,Query
from sqlalchemy.orm import Session
from app.Config.supabase import get_db

from app.Services.Proveedor.Proveedor import ProveedorService
from app.Auth.Dependencies import require_admin_db, require_role
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL

from typing import List

from app.Models.Proveedor.Proveedor import (
    CambiarEstadoProveedorRequest,
    CambiarEstadoProveedorResponse,
    CrearProveedorRequest,
    EditarProveedorRequest,
    ListarProveedoresRequest,
    ListarProveedoresResponse,
    ProveedorForm,
    ProveedorResponse,
)

def proveedor_service(db:Session=Depends(get_db))->ProveedorService:
    return ProveedorService(db)

ProveedorRouter=APIRouter(
    prefix="/proveedor",
    tags=["Proveedor - CRUD e Ingreso"]
)

@ProveedorRouter.get(
    "/formulario",
    response_model=List[ProveedorForm],
    status_code=200
)
def ObtenerProveedoresForm(
    usuario_actual:dict=Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL])),
    service:ProveedorService=Depends(proveedor_service)
): return service.ObtenerProveedoresForm()


@ProveedorRouter.get(
    "/listar",
    response_model=ListarProveedoresResponse,
    status_code=200,
)
def ListarProveedores(
    Activo: bool | None = None,
    Busqueda: str | None = Query(default=None, max_length=50),
    Pagina: int = Query(default=1, ge=1),
    TamanoPagina: int = Query(default=20, ge=1, le=100),
    usuario_actual: dict = Depends(require_admin_db),
    service: ProveedorService = Depends(proveedor_service),
):
    return service.ListarProveedores(
        ListarProveedoresRequest(
            Activo=Activo,
            Busqueda=Busqueda,
            Pagina=Pagina,
            TamanoPagina=TamanoPagina,
        )
    )


@ProveedorRouter.post(
    "/crear",
    response_model=ProveedorResponse,
    status_code=201,
)
def CrearProveedor(
    data: CrearProveedorRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: ProveedorService = Depends(proveedor_service),
):
    return service.CrearProveedor(data, usuario_actual["IdUsuario"])


@ProveedorRouter.put(
    "/editar",
    response_model=ProveedorResponse,
    status_code=200,
)
def EditarProveedor(
    data: EditarProveedorRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: ProveedorService = Depends(proveedor_service),
):
    return service.EditarProveedor(data, usuario_actual["IdUsuario"])


@ProveedorRouter.patch(
    "/estado",
    response_model=CambiarEstadoProveedorResponse,
    status_code=200,
)
def CambiarEstadoProveedor(
    data: CambiarEstadoProveedorRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: ProveedorService = Depends(proveedor_service),
):
    return service.CambiarEstadoProveedor(data, usuario_actual["IdUsuario"])
