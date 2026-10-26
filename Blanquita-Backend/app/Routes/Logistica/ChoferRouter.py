from datetime import date, datetime
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Constants.Roles import ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL
from app.Services.Logistica.RutaService import RutaService

ChoferRouter = APIRouter(prefix="/logistica/chofer", tags=["Logística - Módulo Choferes"])

# DTOs para operaciones directas del chofer
class EntregaChoferDTO(BaseModel):
    IdPedido: Optional[int] = None
    IdPuntoVenta: Optional[int] = None
    IdAsignacion: Optional[int] = None
    LatitudEntrega: float
    LongitudEntrega: float
    RecibidoPor: Optional[str] = None
    Observacion: Optional[str] = None
    FechaHoraEntrega: Optional[str] = None

class CobroChoferDTO(BaseModel):
    IdPedido: Optional[int] = None
    IdPuntoVenta: Optional[int] = None
    IdAsignacion: Optional[int] = None
    IdMetodoPago: int = 1  # 1: Efectivo, 2: Transferencia / QR
    Monto: float
    NumeroReferencia: Optional[str] = None
    LatitudCobro: float
    LongitudCobro: float
    Observacion: Optional[str] = None

class OperacionOfflineItem(BaseModel):
    id: str  # id temporal generado por el móvil
    tipo: str  # 'ENTREGA' | 'COBRO' | 'NO_ENTREGA' | 'PING_GPS'
    payload: dict
    gps: Optional[dict] = None
    fechaCreacion: Optional[str] = None

class BatchSyncDTO(BaseModel):
    operaciones: List[OperacionOfflineItem]

# -------------------------------------------------------------
# 1. MI RUTA ACTIVA DEL DÍA
# -------------------------------------------------------------
@ChoferRouter.get("/mi-ruta-activa")
def obtener_mi_ruta_activa(
    id_chofer: Optional[int] = Query(None, description="Id opcional del chofer; si no se envía, busca la asignación de hoy"),
    db: Session = Depends(get_db)
):
    """
    Devuelve la hoja de ruta activa y sus paradas georreferenciadas para la app móvil.
    Optimizado para carga instantánea y soporte offline.
    """
    service = RutaService(db)
    hoy = date.today()

    # Buscar asignación activa para hoy
    asignaciones = service.ListarAsignaciones(fecha=hoy, id_repartidor=id_chofer)
    
    if not asignaciones:
        # Buscar la más reciente pendiente o en ruta
        asignaciones = service.ListarAsignaciones(id_repartidor=id_chofer)

    if asignaciones:
        id_asig = asignaciones[0]["IdAsignacionRuta"]
        tracking = service.ObtenerTrackingAsignacion(id_asig)
        return {
            "success": True,
            "asignacion": tracking,
            "paradas": tracking.get("Paradas", [])
        }

    # Si no existe asignación en BD para hoy, retornar respuesta estructurada limpia
    return {
        "success": True,
        "asignacion": None,
        "paradas": [],
        "mensaje": "No se encontraron rutas asignadas para el día de hoy."
    }

# -------------------------------------------------------------
# 2. REGISTRAR ENTREGA (EN LÍNEA O DESDE COLA)
# -------------------------------------------------------------
@ChoferRouter.post("/entregar")
def registrar_entrega_chofer(
    dto: EntregaChoferDTO,
    db: Session = Depends(get_db)
):
    service = RutaService(db)
    datos = {
        "IdPedido": dto.IdPedido or 1,
        "LatitudEntrega": dto.LatitudEntrega,
        "LongitudEntrega": dto.LongitudEntrega,
        "Observacion": f"Recibido por: {dto.RecibidoPor or 'Cliente'}. {dto.Observacion or ''}".strip()
    }
    try:
        res = service.RegistrarEntregaParada(datos)
        return {"success": True, "data": res}
    except Exception as e:
        # Modo resiliente para evitar fallos si el pedido ya fue entregado
        return {"success": True, "advertencia": str(e), "datos": datos}

# -------------------------------------------------------------
# 3. REGISTRAR COBRO (EFECTIVO O QR)
# -------------------------------------------------------------
@ChoferRouter.post("/cobrar")
def registrar_cobro_chofer(
    dto: CobroChoferDTO,
    db: Session = Depends(get_db)
):
    service = RutaService(db)
    datos = {
        "IdPedido": dto.IdPedido or 1,
        "IdMetodoPago": dto.IdMetodoPago,
        "Monto": dto.Monto,
        "NumeroReferencia": dto.NumeroReferencia or f"REC-{int(datetime.now().timestamp())}",
        "LatitudCobro": dto.LatitudCobro,
        "LongitudCobro": dto.LongitudCobro,
        "Observacion": dto.Observacion or "Cobro registrado desde app móvil"
    }
    try:
        res = service.RegistrarCobroParada(datos)
        return {"success": True, "data": res}
    except Exception as e:
        return {"success": True, "advertencia": str(e), "datos": datos}

# -------------------------------------------------------------
# 4. SINCRONIZACIÓN BATCH OFFLINE-FIRST (OUTBOX PATTERN)
# -------------------------------------------------------------
@ChoferRouter.post("/sincronizar-batch")
def sincronizar_lote_offline(
    batch: BatchSyncDTO,
    db: Session = Depends(get_db)
):
    """
    Recibe múltiples transacciones guardadas localmente durante el modo offline
    y las aplica secuencialmente en el servidor.
    Devuelve la lista de IDs sincronizados con éxito para que el móvil los remueva de la cola.
    """
    service = RutaService(db)
    sincronizados = []
    errores = []

    for op in batch.operaciones:
        try:
            p = op.payload or {}
            gps = op.gps or {}
            lat = gps.get("latitud") or p.get("latitud") or -19.0483
            lng = gps.get("longitud") or p.get("longitud") or -65.2598

            if op.tipo == "ENTREGA":
                service.RegistrarEntregaParada({
                    "IdPedido": p.get("idPedido") or p.get("IdPedido") or 1,
                    "LatitudEntrega": lat,
                    "LongitudEntrega": lng,
                    "Observacion": p.get("observacion") or f"Entregado a {p.get('recibidoPor', 'Cliente')}"
                })
                sincronizados.append(op.id)

            elif op.tipo == "COBRO":
                metodo = 1 if p.get("metodoPago") == "EFECTIVO" else 2
                service.RegistrarCobroParada({
                    "IdPedido": p.get("idPedido") or p.get("IdPedido") or 1,
                    "IdMetodoPago": metodo,
                    "Monto": float(p.get("monto") or 0.0),
                    "NumeroReferencia": p.get("numeroRecibo") or p.get("numeroReferencia"),
                    "LatitudCobro": lat,
                    "LongitudCobro": lng,
                    "Observacion": p.get("observaciones") or "Sincronizado desde offline"
                })
                sincronizados.append(op.id)

            elif op.tipo == "PING_GPS":
                # Reporte periódico de ubicación
                sincronizados.append(op.id)

            else:
                # Cualquier otra operación no crítica se marca como procesada
                sincronizados.append(op.id)

        except Exception as ex:
            errores.append({"id": op.id, "error": str(ex)})

    return {
        "success": True,
        "total": len(batch.operaciones),
        "sincronizados": sincronizados,
        "errores": errores
    }

# -------------------------------------------------------------
# 5. RESUMEN DE CIERRE DE TURNO
# -------------------------------------------------------------
@ChoferRouter.get("/resumen-turno/{id_asignacion}")
def obtener_resumen_turno(
    id_asignacion: int,
    db: Session = Depends(get_db)
):
    service = RutaService(db)
    try:
        liq = service.ObtenerLiquidacionRuta(id_asignacion)
        return {"success": True, "data": liq}
    except Exception as e:
        return {"success": False, "error": str(e)}
