from typing import Optional, List
from pydantic import BaseModel
from datetime import date, datetime

class ZonaBase(BaseModel):
    NombreZona: str
    Ciudad: str = "Sucre"
    Descripcion: Optional[str] = None
    Activa: bool = True
    IdSucursal: Optional[int] = 1

class ZonaCrear(ZonaBase):
    IdSucursal: Optional[int] = None

class ZonaResponse(ZonaBase):
    IdZonaDistribucion: int
    TotalRutas: Optional[int] = 0

    class Config:
        from_attributes = True

class RutaBase(BaseModel):
    IdZonaDistribucion: int
    NombreRuta: str
    DiaSemana: Optional[int] = None # 1=Lunes, 7=Domingo
    dia_semana: Optional[int] = None
    Descripcion: Optional[str] = None
    Activa: bool = True
    IdSucursal: Optional[int] = 1
    EsAsignacionAutomatica: bool = False
    es_asignacion_automatica: Optional[bool] = None
    IdChoferPorDefecto: Optional[int] = None
    id_chofer_por_defecto: Optional[int] = None

class RutaCrear(RutaBase):
    pass

class RutaActualizar(BaseModel):
    IdZonaDistribucion: Optional[int] = None
    NombreRuta: Optional[str] = None
    DiaSemana: Optional[int] = None
    dia_semana: Optional[int] = None
    Descripcion: Optional[str] = None
    Activa: Optional[bool] = None
    IdSucursal: Optional[int] = None
    EsAsignacionAutomatica: Optional[bool] = None
    es_asignacion_automatica: Optional[bool] = None
    IdChoferPorDefecto: Optional[int] = None
    id_chofer_por_defecto: Optional[int] = None

class PuntoVentaRutaItem(BaseModel):
    IdPuntoVenta: int
    NombrePuntoVenta: str
    NombreCliente: str
    Direccion: str
    Latitud: Optional[float] = None
    Longitud: Optional[float] = None
    OrdenVisita: int

class RutaResponse(RutaBase):
    IdRutaDistribucion: int
    NombreZona: Optional[str] = None
    TotalPuntosVenta: Optional[int] = 0
    PuntosVenta: List[PuntoVentaRutaItem] = []

    class Config:
        from_attributes = True

class GuardarPuntosVentaRuta(BaseModel):
    PuntosVenta: List[dict] # [{"IdPuntoVenta": int, "OrdenVisita": int}]

class AsignacionRutaCrear(BaseModel):
    IdRutaDistribucion: int
    IdUsuarioRepartidor: int
    FechaAsignacion: date
    KilometrajeInicial: Optional[float] = None
    Observacion: Optional[str] = None
    EstadoOperativo: Optional[str] = "PENDIENTE_CARGA"
    estado_operativo: Optional[str] = None

class AsignacionRutaActualizar(BaseModel):
    Estado: Optional[str] = None # 'Pendiente', 'En Ruta', 'Finalizada', 'Cancelada'
    EstadoOperativo: Optional[str] = None # 'PENDIENTE_CARGA', 'CARGA_SOLICITADA', 'APROBADA_EN_RUTA', 'FINALIZADA', 'OBSERVADA'
    estado_operativo: Optional[str] = None
    KilometrajeFinal: Optional[float] = None
    Observacion: Optional[str] = None
    ObservacionCierreAdmin: Optional[str] = None
    observacion_cierre_admin: Optional[str] = None
    CerradoPorId: Optional[int] = None
    cerrado_por_id: Optional[int] = None

class AsignacionRutaResponse(BaseModel):
    IdAsignacionRuta: int
    IdRutaDistribucion: int
    NombreRuta: str
    NombreZona: Optional[str] = None
    IdUsuarioRepartidor: int
    NombreRepartidor: str
    FechaAsignacion: date
    Estado: str
    EstadoOperativo: Optional[str] = "PENDIENTE_CARGA"
    estado_operativo: Optional[str] = "PENDIENTE_CARGA"
    KilometrajeInicial: Optional[float] = None
    KilometrajeFinal: Optional[float] = None
    Observacion: Optional[str] = None
    ObservacionCierreAdmin: Optional[str] = None
    observacion_cierre_admin: Optional[str] = None
    CerradoPorId: Optional[int] = None
    cerrado_por_id: Optional[int] = None

    class Config:
        from_attributes = True

class RepartidorCrear(BaseModel):
    Ci: str
    PrimerNombre: str
    SegundoNombre: Optional[str] = None
    ApellidoPaterno: str
    ApellidoMaterno: Optional[str] = None
    Celular: Optional[str] = None
    Clave: Optional[str] = "Blanquita123!"

class RepartidorResponse(BaseModel):
    IdUsuario: int
    NombreCompleto: str
    Ci: str
    Celular: Optional[str] = None
    IdEstadoUsuario: int
    Estado: str
    TotalAsignaciones: Optional[int] = 0

class TelemetriaPing(BaseModel):
    IdUsuarioRepartidor: int
    IdAsignacionRuta: Optional[int] = None
    Latitud: float
    Longitud: float
    Velocidad: Optional[float] = 0.0
    Bateria: Optional[int] = 100
    EstadoMovimiento: Optional[str] = "En Ruta"
    DireccionAproximada: Optional[str] = None
    ParadaActual: Optional[int] = None
    ParadasCompletadas: Optional[int] = None
    MontoCobradoTotal: Optional[float] = None

class ChoferTrackingResponse(BaseModel):
    IdTracking: int
    IdUsuarioRepartidor: int
    NombreRepartidor: str
    Celular: Optional[str] = None
    IdAsignacionRuta: Optional[int] = None
    NombreRuta: Optional[str] = None
    NombreZona: Optional[str] = None
    EstadoAsignacion: Optional[str] = None
    Latitud: Optional[float] = None
    Longitud: Optional[float] = None
    Velocidad: Optional[float] = 0.0
    Bateria: Optional[int] = None
    EstadoMovimiento: Optional[str] = "Sin Señal"
    DireccionAproximada: Optional[str] = None
    ParadaActual: int = 1
    TotalParadas: int = 0
    ParadasCompletadas: int = 0
    MontoCobradoTotal: float = 0.0
    UltimaActualizacion: Optional[datetime] = None
    SegundosDesdeUltimoReporte: Optional[int] = None

    class Config:
        from_attributes = True

# -------------------------------------------------------------
# SOLICITUD DE CARGA DE CAMIÓN
# -------------------------------------------------------------
class ItemSolicitudCarga(BaseModel):
    IdPresentacion: Optional[int] = None
    presentacion_id: Optional[int] = None
    StockRemanente: float = 0.0
    stock_remanente: Optional[float] = None
    StockAdicionalSolicitado: Optional[float] = None
    stock_adicional_solicitado: Optional[float] = None
    StockAdicionalAprobado: Optional[float] = None
    stock_adicional_aprobado: Optional[float] = None
    Observacion: Optional[str] = None
    observacion: Optional[str] = None

class SolicitudCargaCrear(BaseModel):
    IdAsignacionRuta: Optional[int] = None
    id_asignacion: Optional[int] = None
    IdChofer: Optional[int] = None
    id_chofer: Optional[int] = None
    UsarRemanente: bool = True
    usar_remanente: Optional[bool] = None
    ObservacionChofer: Optional[str] = None
    observacion: Optional[str] = None
    Items: List[ItemSolicitudCarga] = []
    items: Optional[List[dict | ItemSolicitudCarga]] = None

class SolicitudCargaRevision(BaseModel):
    Estado: Optional[str] = "APROBADO" # 'APROBADO', 'RECHAZADO'
    estado: Optional[str] = None
    ObservacionAdmin: Optional[str] = None
    observacion: Optional[str] = None
    ItemsAprobados: Optional[List[dict]] = None
    items_aprobados: Optional[List[dict]] = None

class SolicitudCargaResponse(BaseModel):
    IdSolicitud: int
    IdAsignacionRuta: int
    IdChofer: int
    Estado: str
    ObservacionChofer: Optional[str] = None
    ObservacionAdmin: Optional[str] = None
    IdAdminRevision: Optional[int] = None
    FechaSolicitud: datetime
    FechaRevision: Optional[datetime] = None
    Detalles: List[dict] = []

    class Config:
        from_attributes = True

# -------------------------------------------------------------
# REORDENAMIENTO COMPACTO 1..N
# -------------------------------------------------------------
class InsertarParadaOrdenRequest(BaseModel):
    IdRuta: int
    IdPuntoVenta: int
    Posicion: Optional[int] = None # Si es None o > max, va al final

class QuitarParadaRequest(BaseModel):
    IdRuta: int
    IdPuntoVenta: int

class MoverParadaRutaRequest(BaseModel):
    IdPuntoVenta: int
    IdRutaOrigen: int
    IdRutaDestino: int
    PosicionDestino: Optional[int] = None

# -------------------------------------------------------------
# AUDITORÍA / REVISIÓN WEB
# -------------------------------------------------------------
class RevisionWebOperacionRequest(BaseModel):
    EstadoRevisionWeb: str # 'PENDIENTE', 'APROBADO', 'OBSERVADO', 'RECHAZADO'
    ObservacionRevision: Optional[str] = None

# -------------------------------------------------------------
# DTOs PARA APROBACIONES, FINALIZACIÓN Y REASIGNACIÓN
# -------------------------------------------------------------
class ItemAprobarCargaDTO(BaseModel):
    presentacion_id: Optional[int] = None
    IdPresentacion: Optional[int] = None
    cantidad_aprobada: Optional[float] = None
    stock_adicional_aprobado: Optional[float] = None


class AprobarCargaRequest(BaseModel):
    items: Optional[List[dict]] = None
    items_aprobados: Optional[List[dict]] = None
    ItemsAprobados: Optional[List[dict]] = None
    observacion: Optional[str] = None
    ObservacionAdmin: Optional[str] = None
    Estado: Optional[str] = "APROBADO"


class RevisionOperacionRequest(BaseModel):
    estado: Optional[str] = None
    EstadoRevisionWeb: Optional[str] = None
    observacion: Optional[str] = None
    ObservacionRevision: Optional[str] = None


class FinalizarAdminRequest(BaseModel):
    IdAsignacionRuta: Optional[int] = None
    observacion_cierre_admin: Optional[str] = None
    ObservacionCierre: Optional[str] = None
    kilometraje_final: Optional[float] = None


class ReasignarPendientesRequest(BaseModel):
    nuevo_id_chofer: Optional[int] = None
    nueva_id_asignacion: Optional[int] = None
    IdRutaDestino: Optional[int] = None
    observacion: Optional[str] = None
    FechaNueva: Optional[date] = None


