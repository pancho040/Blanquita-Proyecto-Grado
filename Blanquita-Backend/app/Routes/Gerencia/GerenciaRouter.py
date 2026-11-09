import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.Config.supabase import get_db
from app.Services.Gerencia.GerenciaService import GerenciaService
from app.Models.Gerencia.GerenciaModel import (
    BuscadorGlobalResponse,
    KPIsEjecutivosResponse,
    RegistrarFirmaSelloRequest,
    FirmaSelloResponse,
    ConciliarBancoRequest,
    ReporteConsolidadoPlantaResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gerencia", tags=["Gerencia General"])


@router.get("/buscar-reporte", response_model=BuscadorGlobalResponse)
def buscar_reporte_global(
    codigo: str = Query(..., description="Código numérico o identificador de documento"),
    db: Session = Depends(get_db)
):
    """
    Buscador Global Rápido por Código.
    Localiza al instante el documento exacto (nota de venta, vale de caja chica, abono de cliente o pedido mayorista).
    """
    service = GerenciaService(db)
    return service.BuscarReporteOGlobal(codigo)


@router.get("/kpis-ejecutivos", response_model=KPIsEjecutivosResponse)
def obtener_kpis_ejecutivos(
    db: Session = Depends(get_db)
):
    """
    Panel de Control Ejecutivo de Gerencia.
    Consolida en tiempo real ventas del día, mora de clientes, vales de caja chica por autorizar y saldos bancarios.
    """
    service = GerenciaService(db)
    return service.ObtenerKPIsEjecutivos()


@router.post("/firmar-documento", response_model=FirmaSelloResponse)
def firmar_documento_gerencial(
    datos: RegistrarFirmaSelloRequest,
    id_gerente: int = Query(1, description="ID del usuario Gerente"),
    db: Session = Depends(get_db)
):
    """
    Registro de Firma y Sello Digital de Gerencia.
    Permite autorizaciones ejecutivas con o sin comprobante fotográfico.
    """
    service = GerenciaService(db)
    return service.RegistrarFirmaGerencial(id_gerente, datos)


@router.get("/firmas-historial")
def listar_firmas_historial(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Historial de firmas y autorizaciones emitidas por Gerencia.
    """
    service = GerenciaService(db)
    return service.ListarFirmasHistorial(limit)


@router.get("/bancos-referenciales")
def listar_bancos_referenciales(
    db: Session = Depends(get_db)
):
    """
    Listado y estado de conciliación de las cuentas bancarias de la empresa.
    """
    service = GerenciaService(db)
    kpis = service.ObtenerKPIsEjecutivos()
    return kpis.bancos


@router.post("/bancos-referenciales/{id_cuenta}/conciliar")
def conciliar_banco_referencial(
    id_cuenta: int,
    datos: ConciliarBancoRequest,
    id_usuario: int = Query(1, description="ID del usuario que realiza la conciliación"),
    db: Session = Depends(get_db)
):
    """
    Registro de conciliación manual de saldo en una cuenta bancaria.
    """
    service = GerenciaService(db)
    return service.ConciliarBancoReferencial(id_cuenta, datos, id_usuario)


@router.get("/reporte-consolidado-planta", response_model=ReporteConsolidadoPlantaResponse)
def obtener_reporte_consolidado_planta(
    db: Session = Depends(get_db)
):
    """
    Reporte Financiero Consolidado de Planta.
    Valoriza en solo lectura el stock de bobinas, rodelas y producto terminado en Sucre sin emitir escritura en planta.
    """
    service = GerenciaService(db)
    return service.ObtenerReporteConsolidadoPlanta()
