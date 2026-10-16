import os
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.Config.supabase import get_db
from app.Auth.Dependencies import get_current_user, require_role
from app.Constants.Roles import ROL_CONTADOR, ROL_GERENTE_GENERAL
from app.Services.Contabilidad.ExcelImportService import ExcelImportService

ImportacionRouter = APIRouter(prefix="/contabilidad/importar", tags=["Contabilidad - Importación de Excels"])

PERMISOS_IMPORTACION = [ROL_CONTADOR, ROL_GERENTE_GENERAL]

DIRECTORIO_EXCELS_DEFAULT = r"c:\Users\franz\Desktop\Blanquita\Blanquita-Proyecto-Grado\archivos_contabilidad"

@ImportacionRouter.post("/todas")
@ImportacionRouter.post("/todo")
def importar_todos_los_archivos(
    directorio: str = Query(DIRECTORIO_EXCELS_DEFAULT, description="Ruta de la carpeta con los Excels"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_IMPORTACION))
):
    if not os.path.exists(directorio):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró el directorio {directorio}"
        )

    service = ExcelImportService(db)
    resultados = service.ImportarTodosArchivos(directorio)
    return {
        "mensaje": "Proceso de importación de todos los Excels finalizado con éxito",
        "directorio": directorio,
        "resultados": resultados
    }

@ImportacionRouter.post("/flujo-caja")
def importar_flujo_caja(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_IMPORTACION))
):
    ruta = os.path.join(DIRECTORIO_EXCELS_DEFAULT, "Flujo de Caja - Blanquita 2026.xlsx")
    if not os.path.exists(ruta):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")
    res = ExcelImportService(db).ImportarFlujoDeCaja(ruta)
    return {"mensaje": "Flujo de caja importado exitosamente", "detalle": res}

@ImportacionRouter.post("/cuentas-cobrar")
def importar_cuentas_cobrar(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_IMPORTACION))
):
    ruta = os.path.join(DIRECTORIO_EXCELS_DEFAULT, "CUENTAS POR COBRAR.xlsx")
    if not os.path.exists(ruta):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")
    res = ExcelImportService(db).ImportarCuentasPorCobrar(ruta)
    return {"mensaje": "Cuentas por cobrar importadas exitosamente", "detalle": res}

@ImportacionRouter.post("/notas-venta")
def importar_notas_venta(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_IMPORTACION))
):
    ruta = os.path.join(DIRECTORIO_EXCELS_DEFAULT, "Control Notas de Venta - Blanquita 2026.xlsx")
    if not os.path.exists(ruta):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")
    res = ExcelImportService(db).ImportarNotasVentaCamion(ruta)
    return {"mensaje": "Notas de venta importadas exitosamente", "detalle": res}

@ImportacionRouter.post("/proveedores")
@ImportacionRouter.post("/cuentas-proveedor")
def importar_cuentas_proveedor(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_IMPORTACION))
):
    ruta = os.path.join(DIRECTORIO_EXCELS_DEFAULT, "CUENTAS PROVEEDOR 2026.xlsx")
    if not os.path.exists(ruta):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")
    res = ExcelImportService(db).ImportarCuentasProveedor(ruta)
    return {"mensaje": "Cuentas de proveedores importadas exitosamente", "detalle": res}
