from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_admin_db
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Services.RRHH.RRHHService import RRHHService
from app.Models.RRHH.RRHHModel import (
    EmpleadoActualizar,
    TurnoCrear,
    TurnoActualizar,
    AsignacionTurnoCrear,
    AsignacionTurnoBatch,
    MarcaBiometricaCrear,
    ImportacionBiometricoRequest,
    AsistenciaDiariaActualizar,
    ConfiguracionLaboralActualizar,
    PeriodoNominaCrear,
    PlanillaGenerarRequest,
    DetallePlanillaActualizar,
    PlanillaAprobarRequest,
    FiniquitoCalcularRequest,
    RegistrarNoVentaRequest
)

RRHHRouter = APIRouter(
    prefix="/rrhh",
    tags=["Recursos Humanos & Biométrico"],
    dependencies=[Depends(require_admin_db)]
)

# =============================================================================
# DASHBOARD RESUMEN
# =============================================================================
@RRHHRouter.get("/resumen")
def ObtenerResumen(
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    service = RRHHService(db)
    return service.ObtenerResumenKPIs(alcance.sucursal_efectiva)

# =============================================================================
# EMPLEADOS & DATOS LABORALES
# =============================================================================
@RRHHRouter.get("/empleados")
def ListarEmpleados(
    busqueda: str = "",
    area: str = "",
    activo: Optional[bool] = None,
    es_asegurado: Optional[bool] = None,
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    service = RRHHService(db)
    return service.ListarEmpleados(busqueda, area, activo, es_asegurado, alcance.sucursal_efectiva)

@RRHHRouter.get("/empleados/simple")
def ListarEmpleadosSimple(
    area: str = "",
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    service = RRHHService(db)
    return service.ListarEmpleadosSimple(area, alcance.sucursal_efectiva)

@RRHHRouter.get("/empleados/{id_usuario}")
def ObtenerEmpleado(
    id_usuario: int,
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    service = RRHHService(db)
    emp = service.ObtenerEmpleado(id_usuario)
    alcance.validar_recurso(emp.get("IdSucursal"), nombre_recurso="empleado", responder_404=True)
    return emp

@RRHHRouter.put("/empleados/{id_usuario}")
def ActualizarEmpleado(
    id_usuario: int,
    datos: EmpleadoActualizar,
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    service = RRHHService(db)
    emp = service.ObtenerEmpleado(id_usuario)
    alcance.validar_recurso(emp.get("IdSucursal"), nombre_recurso="empleado", responder_404=True)
    if datos.IdSucursal is not None:
        alcance.validar_escritura(datos.IdSucursal, nombre_recurso="sucursal_empleado")
    return service.ActualizarEmpleado(id_usuario, datos.dict(exclude_unset=True))

# =============================================================================
# TURNOS & HORARIOS
# =============================================================================
@RRHHRouter.get("/turnos")
def ListarTurnos(area: str = "", db: Session = Depends(get_db)):
    service = RRHHService(db)
    return service.ListarTurnos(area)

@RRHHRouter.post("/turnos", status_code=status.HTTP_201_CREATED)
def CrearTurno(datos: TurnoCrear, db: Session = Depends(get_db)):
    service = RRHHService(db)
    return service.CrearTurno(datos.dict())

@RRHHRouter.put("/turnos/{id_turno}")
def ActualizarTurno(id_turno: int, datos: TurnoActualizar, db: Session = Depends(get_db)):
    service = RRHHService(db)
    return service.ActualizarTurno(id_turno, datos.dict(exclude_unset=True))

@RRHHRouter.delete("/turnos/{id_turno}")
def EliminarTurno(id_turno: int, db: Session = Depends(get_db)):
    service = RRHHService(db)
    service.EliminarTurno(id_turno)
    return {"mensaje": "Turno eliminado correctamente"}

# =============================================================================
# CRONOGRAMA DE TURNOS (MATRIZ SEMANAL)
# =============================================================================
@RRHHRouter.get("/cronograma")
def ObtenerCronograma(
    fecha_inicio: date,
    fecha_fin: date,
    area: str = "",
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    service = RRHHService(db)
    return service.ObtenerCronograma(fecha_inicio, fecha_fin, area, alcance.sucursal_efectiva)

@RRHHRouter.post("/cronograma/asignar")
def AsignarTurno(
    datos: AsignacionTurnoCrear,
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    service = RRHHService(db)
    emp = service.ObtenerEmpleado(datos.IdUsuario)
    alcance.validar_recurso(emp.get("IdSucursal"), nombre_recurso="empleado", responder_404=True)
    return service.AsignarTurno(
        id_usuario=datos.IdUsuario,
        id_turno=datos.IdTurno,
        fecha=datos.Fecha,
        area=datos.Area or "",
        observacion=datos.Observacion or ""
    )

@RRHHRouter.post("/cronograma/asignar-batch")
def AsignarTurnosBatch(
    datos: AsignacionTurnoBatch,
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    service = RRHHService(db)
    for item in datos.Asignaciones:
        emp = service.ObtenerEmpleado(item.IdUsuario)
        alcance.validar_recurso(emp.get("IdSucursal"), nombre_recurso="empleado", responder_404=True)
    return service.AsignarTurnosBatch([item.dict() for item in datos.Asignaciones])

@RRHHRouter.delete("/cronograma/desasignar")
def DesasignarTurno(
    id_usuario: int,
    fecha: date,
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    service = RRHHService(db)
    emp = service.ObtenerEmpleado(id_usuario)
    alcance.validar_recurso(emp.get("IdSucursal"), nombre_recurso="empleado", responder_404=True)
    service.DesasignarTurno(id_usuario, fecha)
    return {"mensaje": "Turno desasignado correctamente"}

# =============================================================================
# CONTROL DE ASISTENCIA & BIOMÉTRICO
# =============================================================================
@RRHHRouter.get("/asistencia")
def ListarAsistencias(
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    id_usuario: Optional[int] = None,
    area: str = "",
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    service = RRHHService(db)
    return service.ListarAsistencias(fecha_inicio, fecha_fin, id_usuario, area, alcance.sucursal_efectiva)

@RRHHRouter.put("/asistencia/{id_asistencia}")
def ActualizarAsistencia(
    id_asistencia: int,
    datos: AsistenciaDiariaActualizar,
    db: Session = Depends(get_db)
):
    service = RRHHService(db)
    return service.ActualizarAsistencia(id_asistencia, datos.dict(exclude_unset=True))

@RRHHRouter.post("/asistencia/marca-manual")
def RegistrarMarcaManual(datos: MarcaBiometricaCrear, db: Session = Depends(get_db)):
    service = RRHHService(db)
    return service.RegistrarMarcaManual(
        id_usuario=datos.IdUsuario,
        fecha_hora=datos.FechaHoraMarca,
        tipo_marca=datos.TipoMarca,
        origen=datos.OrigenDatos or "Manual",
        id_disp=datos.IdDispositivo or "WEB-ADMIN"
    )

@RRHHRouter.post("/biometrico/importar")
def ImportarBiometrico(datos: ImportacionBiometricoRequest, db: Session = Depends(get_db)):
    service = RRHHService(db)
    return service.ImportarMarcacionesBiometrico([item.dict() for item in datos.Marcas])

@RRHHRouter.get("/biometrico/marcas")
def ListarMarcasBiometricas(
    fecha_inicio: date,
    fecha_fin: date,
    id_usuario: Optional[int] = None,
    db: Session = Depends(get_db)
):
    service = RRHHService(db)
    return service.repository.ListarMarcasBiometricas(fecha_inicio, fecha_fin, id_usuario)

# =============================================================================
# CONFIGURACIÓN LABORAL
# =============================================================================
@RRHHRouter.get("/configuracion")
def ListarConfiguracion(db: Session = Depends(get_db)):
    service = RRHHService(db)
    return service.ListarConfiguracion()

@RRHHRouter.put("/configuracion/{id_config}")
def ActualizarConfiguracion(
    id_config: int,
    datos: ConfiguracionLaboralActualizar,
    db: Session = Depends(get_db)
):
    service = RRHHService(db)
    return service.ActualizarConfiguracion(id_config, datos.Valor, datos.Descripcion)

# =============================================================================
# PERIODOS DE NÓMINA & PLANILLAS DE SUELDOS
# =============================================================================
@RRHHRouter.get("/periodos")
def ListarPeriodos(db: Session = Depends(get_db)):
    service = RRHHService(db)
    return service.ListarPeriodos()

@RRHHRouter.post("/periodos", status_code=status.HTTP_201_CREATED)
def CrearPeriodo(datos: PeriodoNominaCrear, db: Session = Depends(get_db)):
    service = RRHHService(db)
    return service.CrearPeriodo(datos.Mes, datos.Anio, datos.FechaInicio, datos.FechaFin)

@RRHHRouter.get("/planillas/{id_periodo}")
def ObtenerPlanilla(
    id_periodo: int,
    tipo_planilla: Optional[str] = None,
    id_sucursal: Optional[int] = None,
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    id_suc = alcance.validar_recurso(id_sucursal) if id_sucursal else alcance.sucursal_efectiva
    service = RRHHService(db)
    pl = service.ObtenerPlanillaPeriodo(id_periodo, tipo_planilla, id_suc)
    if not pl:
        return {"mensaje": "No se ha generado planilla para este periodo aún", "generada": False}
    return pl

@RRHHRouter.post("/planillas/generar")
def GenerarPlanilla(
    datos: PlanillaGenerarRequest,
    usuario_actual: dict = Depends(require_admin_db),
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    datos.IdSucursal = alcance.validar_escritura(datos.IdSucursal, nombre_recurso="sucursal_planilla")
    service = RRHHService(db)
    return service.GenerarPlanilla(
        datos.IdPeriodoNomina,
        usuario_actual["IdUsuario"],
        datos.TipoPlanilla,
        datos.IdSucursal
    )

@RRHHRouter.put("/planillas/detalle/{id_detalle}")
def EditarDetallePlanilla(
    id_detalle: int,
    datos: DetallePlanillaActualizar,
    db: Session = Depends(get_db)
):
    service = RRHHService(db)
    return service.EditarDetallePlanilla(id_detalle, datos.dict(exclude_unset=True))

@RRHHRouter.post("/planillas/{id_planilla}/aprobar")
def AprobarPlanilla(
    id_planilla: int,
    datos: PlanillaAprobarRequest,
    usuario_actual: dict = Depends(require_admin_db),
    db: Session = Depends(get_db)
):
    service = RRHHService(db)
    return service.AprobarPlanilla(id_planilla, usuario_actual["IdUsuario"], datos.Observacion or "")

@RRHHRouter.get("/planillas/boleta/{id_detalle}")
def ObtenerBoletaPago(
    id_detalle: int,
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    service = RRHHService(db)
    boleta = service.GenerarBoletaPago(id_detalle)
    if boleta and "IdUsuario" in boleta:
        emp = service.repository.ObtenerEmpleadoPorId(boleta["IdUsuario"])
        alcance.validar_recurso(emp.get("IdSucursal") if emp else None, nombre_recurso="boleta_pago", responder_404=True)
    return boleta

@RRHHRouter.get("/planillas/boleta/{id_detalle}/doble")
def ObtenerBoletaPagoDoble(
    id_detalle: int,
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    service = RRHHService(db)
    boleta = service.GenerarPapeletaPagoDoble(id_detalle)
    if boleta and "IdUsuario" in boleta:
        emp = service.repository.ObtenerEmpleadoPorId(boleta["IdUsuario"])
        alcance.validar_recurso(emp.get("IdSucursal") if emp else None, nombre_recurso="boleta_pago", responder_404=True)
    return boleta


# =============================================================================
# FINIQUITOS LABORALES (MINISTERIO DE TRABAJO)
# =============================================================================
@RRHHRouter.post("/finiquitos/calcular")
def CalcularFiniquito(
    datos: FiniquitoCalcularRequest,
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    service = RRHHService(db)
    emp = service.ObtenerEmpleado(datos.IdUsuario)
    alcance.validar_recurso(emp.get("IdSucursal"), nombre_recurso="empleado", responder_404=True)
    return service.CalcularYRegistrarFiniquito(datos)

@RRHHRouter.get("/finiquitos")
def ListarFiniquitos(
    id_usuario: Optional[int] = None,
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    service = RRHHService(db)
    return service.ListarFiniquitos(id_usuario, alcance.sucursal_efectiva)

@RRHHRouter.get("/finiquitos/{id_finiquito}")
def ObtenerFiniquito(
    id_finiquito: int,
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    service = RRHHService(db)
    fin = service.ObtenerFiniquito(id_finiquito)
    if not fin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finiquito no encontrado")
    emp = service.repository.ObtenerEmpleadoPorId(fin.get("IdUsuario"))
    alcance.validar_recurso(emp.get("IdSucursal") if emp else None, nombre_recurso="finiquito", responder_404=True)
    return fin


# =============================================================================
# DEDUCCIONES COMPARTIDAS POR NO VENTA Y FALTANTES
# =============================================================================
@RRHHRouter.post("/no-venta")
def RegistrarNoVenta(
    datos: RegistrarNoVentaRequest,
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    datos.IdSucursal = alcance.validar_escritura(datos.IdSucursal, nombre_recurso="sucursal_no_venta")
    service = RRHHService(db)
    return service.RegistrarNoVenta(datos)

@RRHHRouter.get("/no-venta")
def ListarNoVenta(
    id_sucursal: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    sid = None
    if id_sucursal is not None and str(id_sucursal).strip().lower() not in ("todas", "all", "null", ""):
        try:
            sid = int(id_sucursal)
            alcance.validar_recurso(sid, nombre_recurso="sucursal_no_venta")
        except ValueError:
            sid = alcance.sucursal_efectiva
    else:
        sid = alcance.sucursal_efectiva

    service = RRHHService(db)
    return service.ListarDeudasNoVenta(sid)


# =============================================================================
# IMPORTACIÓN EXCEL ASISTENCIA MENSUAL
# =============================================================================
@RRHHRouter.post("/asistencias/importar-excel")
@RRHHRouter.post("/asistencias/importar-excel-osvaldo")
async def ImportarExcelOsvaldo(
    file: UploadFile = File(...),
    mes: int = Query(..., ge=1, le=12),
    anio: int = Query(..., ge=2020, le=2100),
    id_sucursal: Optional[int] = None,
    db: Session = Depends(get_db),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    id_suc = alcance.validar_escritura(id_sucursal, nombre_recurso="importar_asistencia")
    service = RRHHService(db)
    contenido = await file.read()
    return service.ImportarAsistenciaExcelOsvaldo(contenido, mes, anio, id_suc)
    return service.ImportarAsistenciaExcelOsvaldo(contenido, mes, anio, id_sucursal)
