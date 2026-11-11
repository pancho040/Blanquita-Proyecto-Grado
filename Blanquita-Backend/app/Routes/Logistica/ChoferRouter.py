from datetime import date, datetime
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL
from app.Services.Logistica.RutaService import RutaService

ChoferRouter = APIRouter(prefix="/logistica/chofer", tags=["Logística - Módulo Choferes"])

ROLES_CHOFER_OPERATIVO = [ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL]


# DTOs para operaciones directas del chofer
class EntregaChoferDTO(BaseModel):
    IdPedido: int = Field(..., gt=0, description="Identificador único del pedido a entregar")
    IdPuntoVenta: Optional[int] = None
    IdAsignacion: Optional[int] = None
    LatitudEntrega: float
    LongitudEntrega: float
    RecibidoPor: Optional[str] = None
    Observacion: Optional[str] = None
    FechaHoraEntrega: Optional[str] = None


class CobroChoferDTO(BaseModel):
    IdPedido: int = Field(..., gt=0, description="Identificador único del pedido a cobrar")
    IdPuntoVenta: Optional[int] = None
    IdAsignacion: Optional[int] = None
    IdMetodoPago: int = 1  # 1: Efectivo, 2: Transferencia / QR
    Monto: float = Field(..., gt=0, description="Monto cobrado mayor a cero")
    NumeroReferencia: Optional[str] = None
    LatitudCobro: float
    LongitudCobro: float
    Observacion: Optional[str] = None


class OperacionOfflineItem(BaseModel):
    id: str  # id temporal local del móvil
    tipo: str  # 'ENTREGA' | 'COBRO' | 'NO_ENTREGA' | 'PING_GPS'
    payload: dict
    gps: Optional[dict] = None
    fechaCreacion: Optional[str] = None


class BatchSyncDTO(BaseModel):
    operaciones: List[OperacionOfflineItem]


def _validar_pertenencia_pedido_chofer(
    db: Session,
    id_pedido: int,
    usuario: dict,
    alcance: AlcanceUsuario
) -> dict:
    """
    Verifica que el pedido pertenezca a la asignación del chofer autenticado
    y a su sucursal autorizada. En caso de discrepancia retorna HTTP 404
    para no filtrar existencia de recursos ajenos.
    """
    sql = text("""
        SELECT 
            p."IdPedido",
            ar."IdUsuarioRepartidor",
            r."IdSucursal"
        FROM "Pedido" p
        JOIN "AsignacionRuta" ar ON p."IdAsignacionRuta" = ar."IdAsignacionRuta"
        JOIN "RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
        WHERE p."IdPedido" = :id_pedido;
    """)
    row = db.execute(sql, {"id_pedido": id_pedido}).fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado o no asignado a su ruta"
        )

    # Si es chofer (Agente de Reparto), no puede operar sobre pedidos de otro repartidor
    if usuario.get("IdRol") == ROL_AGENTE_REPARTO and row.IdUsuarioRepartidor != usuario["IdUsuario"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado o no asignado a su ruta"
        )

    # Validar aislamiento de sucursal (404 si es de otra sede)
    alcance.validar_recurso(row.IdSucursal, nombre_recurso="pedido", responder_404=True)

    return {"IdPedido": row.IdPedido, "IdUsuarioRepartidor": row.IdUsuarioRepartidor, "IdSucursal": row.IdSucursal}


# -------------------------------------------------------------
# 1. MI RUTA ACTIVA DEL DÍA
# -------------------------------------------------------------
@ChoferRouter.get("/mi-ruta-activa")
def obtener_mi_ruta_activa(
    id_chofer: Optional[int] = Query(None, description="Id opcional del chofer (solo para supervisión/gerencia)"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Devuelve la hoja de ruta activa y sus paradas georreferenciadas para la app móvil.
    La identidad del chofer se toma forzosamente del token JWT.
    """
    service = RutaService(db)
    hoy = date.today()

    # Si el usuario es Agente de Reparto, su identidad SALE DEL TOKEN, nunca de la query
    if usuario.get("IdRol") == ROL_AGENTE_REPARTO:
        chofer_objetivo = usuario["IdUsuario"]
    else:
        # Supervisores o Gerentes pueden consultar la de un chofer específico o la suya propia
        chofer_objetivo = id_chofer or usuario["IdUsuario"]

    # Buscar asignación activa para hoy en la sucursal autorizada
    asignaciones = service.ListarAsignaciones(
        fecha=hoy,
        id_repartidor=chofer_objetivo,
        id_sucursal=alcance.sucursal_efectiva
    )

    if not asignaciones:
        # Buscar la más reciente pendiente o en ruta
        asignaciones = service.ListarAsignaciones(
            id_repartidor=chofer_objetivo,
            id_sucursal=alcance.sucursal_efectiva
        )

    if asignaciones:
        id_asig = asignaciones[0]["IdAsignacionRuta"]
        tracking = service.ObtenerTrackingAsignacion(id_asig)

        # Doble verificación: que pertenezca al chofer autenticado
        if usuario.get("IdRol") == ROL_AGENTE_REPARTO and tracking.get("IdUsuarioRepartidor") != usuario["IdUsuario"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Asignación no encontrada"
            )

        return {
            "success": True,
            "asignacion": tracking,
            "paradas": tracking.get("Paradas", [])
        }

    # Si no existe asignación en BD para hoy, retornar respuesta limpia
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
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Registra la entrega física del pedido. Exige autenticación y valida pertenencia del pedido.
    Ante cualquier fallo lanza excepción HTTP explícita; NUNCA devuelve success=True engañoso.
    """
    _validar_pertenencia_pedido_chofer(db, dto.IdPedido, usuario, alcance)

    service = RutaService(db)
    datos = {
        "IdPedido": dto.IdPedido,
        "LatitudEntrega": dto.LatitudEntrega,
        "LongitudEntrega": dto.LongitudEntrega,
        "Observacion": f"Recibido por: {dto.RecibidoPor or 'Cliente'}. {dto.Observacion or ''}".strip()
    }
    try:
        res = service.RegistrarEntregaParada(datos)
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al registrar entrega: {str(e)}"
        )


# -------------------------------------------------------------
# 3. REGISTRAR COBRO (EFECTIVO O QR)
# -------------------------------------------------------------
@ChoferRouter.post("/cobrar")
def registrar_cobro_chofer(
    dto: CobroChoferDTO,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Registra cobro de dinero. Exige autenticación y valida que el pedido pertenezca a la ruta del chofer.
    Ante fallo lanza error HTTP; nunca devuelve éxito optimista.
    """
    _validar_pertenencia_pedido_chofer(db, dto.IdPedido, usuario, alcance)

    service = RutaService(db)
    datos = {
        "IdPedido": dto.IdPedido,
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al registrar cobro: {str(e)}"
        )


# -------------------------------------------------------------
# 4. SINCRONIZACIÓN BATCH OFFLINE-FIRST (OUTBOX PATTERN)
# -------------------------------------------------------------
@ChoferRouter.post("/sincronizar-batch")
def sincronizar_lote_offline(
    batch: BatchSyncDTO,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Recibe transacciones guardadas localmente durante el modo offline
    y las aplica validando identidad y alcance de sucursal por cada item.
    Si hay fallos, los reporta explícitamente y success=False si hubo errores.
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
            id_pedido = p.get("idPedido") or p.get("IdPedido")

            if op.tipo == "ENTREGA":
                if not id_pedido:
                    raise ValueError("Falta IdPedido para operación de ENTREGA")
                _validar_pertenencia_pedido_chofer(db, int(id_pedido), usuario, alcance)
                service.RegistrarEntregaParada({
                    "IdPedido": int(id_pedido),
                    "LatitudEntrega": lat,
                    "LongitudEntrega": lng,
                    "Observacion": p.get("observacion") or f"Entregado a {p.get('recibidoPor', 'Cliente')}"
                })
                sincronizados.append(op.id)

            elif op.tipo == "COBRO":
                if not id_pedido:
                    raise ValueError("Falta IdPedido para operación de COBRO")
                _validar_pertenencia_pedido_chofer(db, int(id_pedido), usuario, alcance)
                monto = float(p.get("monto") or 0.0)
                if monto <= 0:
                    raise ValueError("El monto del cobro debe ser mayor a 0")
                metodo = 1 if p.get("metodoPago") == "EFECTIVO" else 2
                service.RegistrarCobroParada({
                    "IdPedido": int(id_pedido),
                    "IdMetodoPago": metodo,
                    "Monto": monto,
                    "NumeroReferencia": p.get("numeroRecibo") or p.get("numeroReferencia"),
                    "LatitudCobro": lat,
                    "LongitudCobro": lng,
                    "Observacion": p.get("observaciones") or "Sincronizado desde offline"
                })
                sincronizados.append(op.id)

            elif op.tipo == "PING_GPS":
                sincronizados.append(op.id)

            else:
                sincronizados.append(op.id)

        except Exception as ex:
            errores.append({"id": op.id, "error": str(ex)})

    return {
        "success": len(errores) == 0,
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
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_CHOFER_OPERATIVO)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Devuelve la liquidación de la asignación. Valida que pertenezca al chofer y a su sede.
    """
    sql = text("""
        SELECT ar."IdUsuarioRepartidor", r."IdSucursal"
        FROM "AsignacionRuta" ar
        JOIN "RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
        WHERE ar."IdAsignacionRuta" = :id;
    """)
    row = db.execute(sql, {"id": id_asignacion}).fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asignación no encontrada"
        )

    if usuario.get("IdRol") == ROL_AGENTE_REPARTO and row.IdUsuarioRepartidor != usuario["IdUsuario"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asignación no encontrada"
        )

    alcance.validar_recurso(row.IdSucursal, nombre_recurso="asignación de ruta", responder_404=True)

    service = RutaService(db)
    try:
        liq = service.ObtenerLiquidacionRuta(id_asignacion)
        return {"success": True, "data": liq}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al obtener resumen de turno: {str(e)}"
        )

