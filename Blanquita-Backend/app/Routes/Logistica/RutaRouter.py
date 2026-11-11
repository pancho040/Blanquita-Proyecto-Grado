from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR, ROL_AGENTE_REPARTO
from app.Services.Logistica.RutaService import RutaService
from app.Models.Logistica.RutaModel import (
    ZonaCrear, ZonaResponse, RutaCrear, RutaActualizar, RutaResponse,
    GuardarPuntosVentaRuta, AsignacionRutaCrear, AsignacionRutaActualizar, AsignacionRutaResponse,
    RepartidorCrear, TelemetriaPing
)

RutaRouter = APIRouter(prefix="/logistica", tags=["Logística - Rutas y Asignaciones"])

PERMISOS_LOGISTICA = [ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR]

# -------------------------------------------------------------
# ZONAS
# -------------------------------------------------------------
@RutaRouter.get("/zonas", response_model=list[ZonaResponse])
def listar_zonas(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    return RutaService(db).ListarZonas(alcance.sucursal_efectiva)

@RutaRouter.post("/zonas", response_model=dict)
def crear_zona(
    dto: ZonaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    # Si la sede es fija, validar que la ciudad corresponda
    if alcance.sucursal_efectiva == 1 and "potos" in dto.Ciudad.lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para crear zonas en Potosí")
    if alcance.sucursal_efectiva == 2 and "sucre" in dto.Ciudad.lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para crear zonas en Sucre")
    return RutaService(db).CrearZona(dto)

# -------------------------------------------------------------
# RUTAS
# -------------------------------------------------------------
@RutaRouter.get("/rutas", response_model=list[RutaResponse])
def listar_rutas(
    id_zona: Optional[int] = Query(None, description="Filtrar por zona"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    return RutaService(db).ListarRutas(id_zona, alcance.sucursal_efectiva)

@RutaRouter.get("/rutas/{id_ruta}", response_model=RutaResponse)
def obtener_ruta(
    id_ruta: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    r = RutaService(db).ObtenerRutaDetalle(id_ruta)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ruta de distribución no encontrada")
    sid = r.get("IdSucursal") if isinstance(r, dict) else getattr(r, "IdSucursal", None)
    alcance.validar_recurso(sid, nombre_recurso="ruta", responder_404=True)
    return r

@RutaRouter.post("/rutas", response_model=RutaResponse)
def crear_ruta(
    dto: RutaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    sid = alcance.validar_escritura(dto.IdSucursal)
    dto.IdSucursal = sid
    return RutaService(db).CrearRuta(dto)

@RutaRouter.put("/rutas/{id_ruta}", response_model=RutaResponse)
def actualizar_ruta(
    id_ruta: int,
    dto: RutaActualizar,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    r = RutaService(db).ObtenerRutaDetalle(id_ruta)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ruta de distribución no encontrada")
    sid = r.get("IdSucursal") if isinstance(r, dict) else getattr(r, "IdSucursal", None)
    alcance.validar_recurso(sid, nombre_recurso="ruta", responder_404=True)
    if dto.IdSucursal is not None:
        dto.IdSucursal = alcance.validar_escritura(dto.IdSucursal)
    return RutaService(db).ActualizarRuta(id_ruta, dto)

@RutaRouter.put("/rutas/{id_ruta}/puntos-venta", response_model=RutaResponse)
def guardar_puntos_venta_ruta(
    id_ruta: int,
    dto: GuardarPuntosVentaRuta,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    r = RutaService(db).ObtenerRutaDetalle(id_ruta)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ruta de distribución no encontrada")
    sid = r.get("IdSucursal") if isinstance(r, dict) else getattr(r, "IdSucursal", None)
    alcance.validar_recurso(sid, nombre_recurso="ruta", responder_404=True)
    return RutaService(db).GuardarPuntosVentaRuta(id_ruta, dto)

# -------------------------------------------------------------
# ASIGNACIONES DIARIAS A REPARTIDORES
# -------------------------------------------------------------
@RutaRouter.get("/asignaciones", response_model=list[AsignacionRutaResponse])
def listar_asignaciones(
    fecha: Optional[date] = Query(None, description="Filtrar por fecha de asignación"),
    id_repartidor: Optional[int] = Query(None, description="Filtrar por repartidor"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    return RutaService(db).ListarAsignaciones(fecha, id_repartidor, alcance.sucursal_efectiva)

@RutaRouter.post("/asignaciones", response_model=dict)
def crear_asignacion(
    dto: AsignacionRutaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    sql_r = text('SELECT "IdSucursal" FROM "RutaDistribucion" WHERE "IdRutaDistribucion" = :id')
    row = db.execute(sql_r, {"id": dto.IdRutaDistribucion}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ruta de distribución no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="ruta", responder_404=True)
    return RutaService(db).CrearAsignacion(dto, usuario["IdUsuario"])

@RutaRouter.put("/asignaciones/{id_asignacion}", response_model=dict)
def actualizar_asignacion(
    id_asignacion: int,
    dto: AsignacionRutaActualizar,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    sql_ar = text('SELECT r."IdSucursal" FROM "AsignacionRuta" ar JOIN "RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion" WHERE ar."IdAsignacionRuta" = :id')
    row = db.execute(sql_ar, {"id": id_asignacion}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación de ruta no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="asignación de ruta", responder_404=True)
    return RutaService(db).ActualizarAsignacion(id_asignacion, dto)

@RutaRouter.get("/repartidores", response_model=list[dict])
def listar_repartidores(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    return RutaService(db).ListarRepartidores(alcance.sucursal_efectiva)

@RutaRouter.post("/repartidores", response_model=dict)
def crear_repartidor(
    dto: RepartidorCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    dto.IdSucursal = alcance.validar_escritura(dto.IdSucursal, nombre_recurso="sucursal_repartidor")
    return RutaService(db).CrearRepartidor(dto)

@RutaRouter.put("/repartidores/{id_usuario}/estado", response_model=dict)
def cambiar_estado_repartidor(
    id_usuario: int,
    id_estado: int = Query(..., description="1 = Activo, 2 = Inactivo"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    sql_u = 'SELECT "IdSucursal" FROM "Usuario" WHERE "IdUsuario" = :uid;'
    u_row = db.execute(text(sql_u), {"uid": id_usuario}).fetchone()
    if not u_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repartidor no encontrado")
    alcance.validar_recurso(u_row[0], nombre_recurso="repartidor", responder_404=True)
    return RutaService(db).CambiarEstadoRepartidor(id_usuario, id_estado)

# -------------------------------------------------------------
# Telemetría y rastreo en vivo
# -------------------------------------------------------------
@RutaRouter.post("/telemetria/ping", response_model=dict)
def registrar_telemetria(
    dto: TelemetriaPing,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role([ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR]))
):
    """
    Recibe las coordenadas GPS en tiempo real enviadas por la app móvil del chofer o simulador web.
    """
    # Si el usuario es repartidor, asegurar que no envíe ping de otro repartidor
    if usuario.get("IdRol") == ROL_AGENTE_REPARTO:
        dto.IdUsuarioRepartidor = usuario["IdUsuario"]
    return RutaService(db).RegistrarTelemetriaPing(dto)

@RutaRouter.get("/telemetria/en-vivo", response_model=list[dict])
def obtener_choferes_en_vivo(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal),
):
    """
    Devuelve la última posición y telemetría de todos los choferes para el mapa central de rastreo web.
    """
    return RutaService(db).ObtenerChoferesEnVivo(alcance.sucursal_efectiva)

@RutaRouter.get("/telemetria/asignacion/{id_asignacion}", response_model=dict)
def obtener_tracking_asignacion(
    id_asignacion: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role([ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR]))
):
    """
    Devuelve la posición en vivo del camión, ruta completa y estado de cada parada/pedido asignado.
    """
    return RutaService(db).ObtenerTrackingAsignacion(id_asignacion)

@RutaRouter.post("/telemetria/entrega", response_model=dict)
def registrar_entrega_parada(
    datos: dict,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role([ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL]))
):
    """
    Registra la entrega de un pedido con georreferenciación GPS obligatoria .
    """
    return RutaService(db).RegistrarEntregaParada(datos)

@RutaRouter.post("/telemetria/cobro", response_model=dict)
def registrar_cobro_parada(
    datos: dict,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role([ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL]))
):
    """
    Registra cobro en efectivo o digital con captura obligatoria de GPS .
    """
    return RutaService(db).RegistrarCobroParada(datos)

# -------------------------------------------------------------
# Liquidación y cierre de ruta
# -------------------------------------------------------------
@RutaRouter.get("/asignaciones/{id_asignacion}/liquidacion", response_model=dict)
def obtener_liquidacion_ruta(
    id_asignacion: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Genera el resumen de liquidación consolidada para caja: efectivo a entregar, transferencias/QR, pedidos entregados y saldo.
    """
    sql_ar = text('SELECT r."IdSucursal" FROM "AsignacionRuta" ar JOIN "RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion" WHERE ar."IdAsignacionRuta" = :id')
    row = db.execute(sql_ar, {"id": id_asignacion}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación de ruta no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="asignación de ruta", responder_404=True)
    return RutaService(db).ObtenerLiquidacionRuta(id_asignacion)

@RutaRouter.post("/asignaciones/{id_asignacion}/liquidar", response_model=dict)
def cerrar_y_liquidar_ruta(
    id_asignacion: int,
    datos: dict,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Cierra la ruta diaria del chofer y registra la rendición de cuentas oficial para Tesorería/Caja.
    """
    sql_ar = text('SELECT r."IdSucursal" FROM "AsignacionRuta" ar JOIN "RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion" WHERE ar."IdAsignacionRuta" = :id')
    row = db.execute(sql_ar, {"id": id_asignacion}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación de ruta no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="asignación de ruta", responder_404=True)
    return RutaService(db).CerrarYLiquidarRuta(id_asignacion, datos, usuario["IdUsuario"])
