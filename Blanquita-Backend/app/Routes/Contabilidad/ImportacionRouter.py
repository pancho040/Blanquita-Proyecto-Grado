import os
import shutil
import tempfile
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Constants.Roles import ROL_CONTADOR, ROL_GERENTE_GENERAL
from app.Services.Contabilidad.ExcelImportService import ExcelImportService

ImportacionRouter = APIRouter(prefix="/contabilidad/importar", tags=["Contabilidad - Importación de Excels"])

PERMISOS_IMPORTACION = [ROL_CONTADOR, ROL_GERENTE_GENERAL]

DIRECTORIO_EXCELS_DEFAULT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "archivos_contabilidad")
)

def _buscar_archivo_por_patron(patrones: list[str]) -> Optional[str]:
    """Busca un archivo en el directorio de contabilidad que coincida con alguno de los patrones."""
    if not os.path.exists(DIRECTORIO_EXCELS_DEFAULT):
        return None
    for fname in os.listdir(DIRECTORIO_EXCELS_DEFAULT):
        fname_lower = fname.lower()
        if fname_lower.endswith(('.xlsx', '.xls')):
            for p in patrones:
                if p.lower() in fname_lower:
                    return os.path.join(DIRECTORIO_EXCELS_DEFAULT, fname)
    return None

def _procesar_archivo_o_local(
    archivo: Optional[UploadFile],
    patrones_default: list[str],
    funcion_importacion
) -> dict:
    """Procesa el archivo subido si existe; de lo contrario busca el predeterminado en el servidor."""
    if archivo and archivo.filename:
        # Guardar archivo temporalmente
        suffix = os.path.splitext(archivo.filename)[1] or ".xlsx"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(archivo.file, tmp)
            tmp_path = tmp.name
        try:
            res = funcion_importacion(tmp_path)
            return {
                "mensaje": f"Archivo '{archivo.filename}' importado y procesado exitosamente.",
                "archivo": archivo.filename,
                "detalle": res
            }
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
    else:
        ruta = _buscar_archivo_por_patron(patrones_default)
        if not ruta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No se encontró un archivo predeterminado en el servidor con los patrones: {patrones_default}"
            )
        res = funcion_importacion(ruta)
        return {
            "mensaje": f"Archivo predeterminado '{os.path.basename(ruta)}' importado exitosamente.",
            "archivo": os.path.basename(ruta),
            "detalle": res
        }

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
    archivo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_IMPORTACION))
):
    service = ExcelImportService(db)
    return _procesar_archivo_o_local(
        archivo=archivo,
        patrones_default=["flujo de caja", "caja chica"],
        funcion_importacion=service.ImportarFlujoDeCaja
    )

@ImportacionRouter.post("/cuentas-cobrar")
def importar_cuentas_cobrar(
    archivo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_IMPORTACION))
):
    service = ExcelImportService(db)
    return _procesar_archivo_o_local(
        archivo=archivo,
        patrones_default=["cuentas por cobrar", "cxc"],
        funcion_importacion=service.ImportarCuentasPorCobrar
    )

@ImportacionRouter.post("/notas-venta")
def importar_notas_venta(
    archivo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_IMPORTACION))
):
    service = ExcelImportService(db)
    return _procesar_archivo_o_local(
        archivo=archivo,
        patrones_default=["control notas de venta", "notas de venta"],
        funcion_importacion=service.ImportarNotasVentaCamion
    )

@ImportacionRouter.post("/proveedores")
@ImportacionRouter.post("/cuentas-proveedor")
def importar_cuentas_proveedor(
    archivo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_IMPORTACION))
):
    service = ExcelImportService(db)
    return _procesar_archivo_o_local(
        archivo=archivo,
        patrones_default=["cuentas proveedor", "proveedor"],
        funcion_importacion=service.ImportarCuentasProveedor
    )
