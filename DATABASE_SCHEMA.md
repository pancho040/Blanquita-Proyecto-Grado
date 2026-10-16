# DATABASE SCHEMA

```sql
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.Turno (
  IdTurno integer NOT NULL DEFAULT nextval('"Turno_IdTurno_seq"'::regclass),
  NombreTurno text NOT NULL,
  HoraInicio time without time zone NOT NULL,
  HoraFin time without time zone NOT NULL,
  DescripcionTurno text,
  CONSTRAINT Turno_pkey PRIMARY KEY (IdTurno)
);
CREATE TABLE public.Rol (
  IdRol integer NOT NULL DEFAULT nextval('"Rol_IdRol_seq"'::regclass),
  NombreRol text NOT NULL,
  Descripcion text,
  CONSTRAINT Rol_pkey PRIMARY KEY (IdRol)
);
CREATE TABLE public.EstadoUsuario (
  IdEstadoUsuario integer NOT NULL DEFAULT nextval('"EstadoUsuario_IdEstadoUsuario_seq"'::regclass),
  NombreEstadoUsuario text NOT NULL,
  DescripcionEstadoUsuario text,
  CONSTRAINT EstadoUsuario_pkey PRIMARY KEY (IdEstadoUsuario)
);
CREATE TABLE public.Usuario (
  IdUsuario integer NOT NULL DEFAULT nextval('"Usuario_IdUsuario_seq"'::regclass),
  IdRol integer NOT NULL,
  IdEstadoUsuario integer NOT NULL,
  Ci text NOT NULL UNIQUE,
  PrimerNombre text NOT NULL,
  SegundoNombre text,
  ApellidoPaterno text NOT NULL,
  ApellidoMaterno text,
  FechaRegistro timestamp with time zone NOT NULL DEFAULT now(),
  AuthUserId uuid NOT NULL UNIQUE,
  Celular text CHECK ("Celular" IS NULL OR "Celular" ~ '^[67][0-9]{7}$'::text),
  IsAdmin boolean NOT NULL DEFAULT false,
  CONSTRAINT Usuario_pkey PRIMARY KEY (IdUsuario),
  CONSTRAINT fk_usuario_authuser FOREIGN KEY (AuthUserId) REFERENCES auth.users(id),
  CONSTRAINT Usuario_IdRol_fkey FOREIGN KEY (IdRol) REFERENCES public.Rol(IdRol),
  CONSTRAINT Usuario_IdEstadoUsuario_fkey FOREIGN KEY (IdEstadoUsuario) REFERENCES public.EstadoUsuario(IdEstadoUsuario)
);
CREATE TABLE public.Proveedor (
  IdProveedor integer NOT NULL DEFAULT nextval('"Proveedor_IdProveedor_seq"'::regclass),
  NombreProveedor text NOT NULL,
  CelularProveedor text,
  CorreoProveedor text,
  IdEstadoProveedor integer NOT NULL DEFAULT 1,
  CONSTRAINT Proveedor_pkey PRIMARY KEY (IdProveedor),
  CONSTRAINT Proveedor_IdEstadoProveedor_fkey FOREIGN KEY (IdEstadoProveedor) REFERENCES public.EstadoProveedor(IdEstadoProveedor)
);
CREATE TABLE public.TipoBobina (
  IdTipoBobina integer NOT NULL DEFAULT nextval('"TipoBobina_IdTipoBobina_seq"'::regclass),
  NombreTipoBobina text NOT NULL,
  DiametroMm numeric NOT NULL DEFAULT 1210,
  Formato numeric NOT NULL DEFAULT 2760,
  TaraKg numeric NOT NULL DEFAULT 38,
  CONSTRAINT TipoBobina_pkey PRIMARY KEY (IdTipoBobina)
);
CREATE TABLE public.EstadoMateriaPrima (
  IdEstadoMateriaPrima integer NOT NULL DEFAULT nextval('"EstadoMateriaPrima_IdEstadoMateriaPrima_seq"'::regclass),
  TipoEstado text NOT NULL,
  CONSTRAINT EstadoMateriaPrima_pkey PRIMARY KEY (IdEstadoMateriaPrima)
);
CREATE TABLE public.LoteBobina (
  IdLoteBobina integer NOT NULL DEFAULT nextval('"LoteBobina_IdLoteBobina_seq"'::regclass),
  IdProveedor integer NOT NULL,
  FechaRecepcion date NOT NULL,
  IdUsuario integer,
  CONSTRAINT LoteBobina_pkey PRIMARY KEY (IdLoteBobina),
  CONSTRAINT LoteBobina_IdProveedor_fkey FOREIGN KEY (IdProveedor) REFERENCES public.Proveedor(IdProveedor),
  CONSTRAINT LoteBobina_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);
CREATE TABLE public.BobinaPapel (
  IdBobinaPapel integer NOT NULL DEFAULT nextval('"BobinaPapel_IdBobinaPapel_seq"'::regclass),
  CodigoBobina text NOT NULL UNIQUE,
  IdTipoBobina integer NOT NULL,
  IdLoteBobina integer NOT NULL,
  IdEstadoMateriaPrima integer NOT NULL,
  PesoBrutoKg numeric,
  Gramaje numeric,
  PesoNetoKg numeric,
  CONSTRAINT BobinaPapel_pkey PRIMARY KEY (IdBobinaPapel),
  CONSTRAINT BobinaPapel_IdTipoBobina_fkey FOREIGN KEY (IdTipoBobina) REFERENCES public.TipoBobina(IdTipoBobina),
  CONSTRAINT BobinaPapel_IdLoteBobina_fkey FOREIGN KEY (IdLoteBobina) REFERENCES public.LoteBobina(IdLoteBobina),
  CONSTRAINT BobinaPapel_IdEstadoMateriaPrima_fkey FOREIGN KEY (IdEstadoMateriaPrima) REFERENCES public.EstadoMateriaPrima(IdEstadoMateriaPrima)
);
CREATE TABLE public.LoteEmpaque (
  IdLoteEmpaque integer NOT NULL DEFAULT nextval('"LoteEmpaque_IdLoteEmpaque_seq"'::regclass),
  IdProveedor integer NOT NULL,
  FechaRecepcion date NOT NULL,
  CantidadToneladasPedida numeric,
  IdUsuario integer,
  CONSTRAINT LoteEmpaque_pkey PRIMARY KEY (IdLoteEmpaque),
  CONSTRAINT LoteEmpaque_IdProveedor_fkey FOREIGN KEY (IdProveedor) REFERENCES public.Proveedor(IdProveedor),
  CONSTRAINT LoteEmpaque_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);
CREATE TABLE public.TipoEmpaque (
  IdTipoEmpaque integer NOT NULL DEFAULT nextval('"TipoEmpaque_IdTipoEmpaque_seq"'::regclass),
  NombreTipoEmpaque text NOT NULL,
  CONSTRAINT TipoEmpaque_pkey PRIMARY KEY (IdTipoEmpaque)
);
CREATE TABLE public.Empaque (
  IdEmpaque integer NOT NULL DEFAULT nextval('"Empaque_IdEmpaque_seq"'::regclass),
  IdTipoEmpaque integer NOT NULL,
  IdLoteEmpaque integer NOT NULL,
  IdEstadoMateriaPrima integer NOT NULL,
  PesoKg numeric,
  CodigoEmpaque text NOT NULL UNIQUE,
  CONSTRAINT Empaque_pkey PRIMARY KEY (IdEmpaque),
  CONSTRAINT Empaque_IdTipoEmpaque_fkey FOREIGN KEY (IdTipoEmpaque) REFERENCES public.TipoEmpaque(IdTipoEmpaque),
  CONSTRAINT Empaque_IdLoteEmpaque_fkey FOREIGN KEY (IdLoteEmpaque) REFERENCES public.LoteEmpaque(IdLoteEmpaque),
  CONSTRAINT Empaque_IdEstadoMateriaPrima_fkey FOREIGN KEY (IdEstadoMateriaPrima) REFERENCES public.EstadoMateriaPrima(IdEstadoMateriaPrima)
);
CREATE TABLE public.LoteRodela (
  IdLoteRodela integer NOT NULL DEFAULT nextval('"LoteRodela_IdLoteRodela_seq"'::regclass),
  IdProveedor integer NOT NULL,
  FechaRecepcion date NOT NULL,
  IdUsuario integer,
  CONSTRAINT LoteRodela_pkey PRIMARY KEY (IdLoteRodela),
  CONSTRAINT LoteRodela_IdProveedor_fkey FOREIGN KEY (IdProveedor) REFERENCES public.Proveedor(IdProveedor),
  CONSTRAINT LoteRodela_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);
CREATE TABLE public.TipoRodela (
  IdTipoRodela integer NOT NULL DEFAULT nextval('"TipoRodela_IdTipoRodela_seq"'::regclass),
  Descripcion text,
  NombreTipoRodela text NOT NULL,
  CONSTRAINT TipoRodela_pkey PRIMARY KEY (IdTipoRodela)
);
CREATE TABLE public.Rodela (
  IdRodela integer NOT NULL DEFAULT nextval('"Rodela_IdRodela_seq"'::regclass),
  IdLoteRodela integer NOT NULL,
  IdEstadoMateriaPrima integer NOT NULL,
  IdTipoRodela integer NOT NULL,
  CodigoRodela text NOT NULL UNIQUE,
  CONSTRAINT Rodela_pkey PRIMARY KEY (IdRodela),
  CONSTRAINT Rodela_IdEstadoMateriaPrima_fkey FOREIGN KEY (IdEstadoMateriaPrima) REFERENCES public.EstadoMateriaPrima(IdEstadoMateriaPrima),
  CONSTRAINT Rodela_IdLoteRodela_fkey FOREIGN KEY (IdLoteRodela) REFERENCES public.LoteRodela(IdLoteRodela),
  CONSTRAINT Rodela_IdTipoRodela_fkey FOREIGN KEY (IdTipoRodela) REFERENCES public.TipoRodela(IdTipoRodela)
);
CREATE TABLE public.TipoMovimientoMateriaPrima (
  IdTipoMovimiento integer NOT NULL DEFAULT nextval('"TipoMovimientoMateriaPrima_IdTipoMovimiento_seq"'::regclass),
  NombreMovimiento text NOT NULL,
  AplicaA text NOT NULL,
  DescripcionTipoMovimientoMateriaPrima text,
  CONSTRAINT TipoMovimientoMateriaPrima_pkey PRIMARY KEY (IdTipoMovimiento)
);
CREATE TABLE public.MovimientoBobina (
  IdMovimientoBobina integer NOT NULL DEFAULT nextval('"MovimientoBobina_IdMovimientoBobina_seq"'::regclass),
  IdBobinaPapel integer NOT NULL,
  IdTipoMovimiento integer NOT NULL,
  IdUsuario integer NOT NULL,
  FechaMovimiento timestamp with time zone NOT NULL DEFAULT now(),
  Observacion text,
  CONSTRAINT MovimientoBobina_pkey PRIMARY KEY (IdMovimientoBobina),
  CONSTRAINT MovimientoBobina_IdBobinaPapel_fkey FOREIGN KEY (IdBobinaPapel) REFERENCES public.BobinaPapel(IdBobinaPapel),
  CONSTRAINT MovimientoBobina_IdTipoMovimiento_fkey FOREIGN KEY (IdTipoMovimiento) REFERENCES public.TipoMovimientoMateriaPrima(IdTipoMovimiento),
  CONSTRAINT MovimientoBobina_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);
CREATE TABLE public.MovimientoRodela (
  IdMovimientoRodela integer NOT NULL DEFAULT nextval('"MovimientoRodela_IdMovimientoRodela_seq"'::regclass),
  IdRodela integer NOT NULL,
  IdTipoMovimiento integer NOT NULL,
  IdUsuario integer NOT NULL,
  FechaMovimiento timestamp with time zone NOT NULL DEFAULT now(),
  Observacion text,
  CONSTRAINT MovimientoRodela_pkey PRIMARY KEY (IdMovimientoRodela),
  CONSTRAINT MovimientoRodela_IdRodela_fkey FOREIGN KEY (IdRodela) REFERENCES public.Rodela(IdRodela),
  CONSTRAINT MovimientoRodela_IdTipoMovimiento_fkey FOREIGN KEY (IdTipoMovimiento) REFERENCES public.TipoMovimientoMateriaPrima(IdTipoMovimiento),
  CONSTRAINT MovimientoRodela_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);
CREATE TABLE public.MovimientoSubBobina (
  IdMovimientoSubBobina integer NOT NULL DEFAULT nextval('"MovimientoSubBobina_IdMovimientoSubBobina_seq"'::regclass),
  IdSubBobinaServilleta integer NOT NULL,
  IdTipoMovimiento integer NOT NULL,
  IdUsuario integer NOT NULL,
  FechaMovimiento timestamp with time zone NOT NULL DEFAULT now(),
  Observacion text,
  CONSTRAINT MovimientoSubBobina_pkey PRIMARY KEY (IdMovimientoSubBobina),
  CONSTRAINT MovimientoSubBobina_IdTipoMovimiento_fkey FOREIGN KEY (IdTipoMovimiento) REFERENCES public.TipoMovimientoMateriaPrima(IdTipoMovimiento),
  CONSTRAINT MovimientoSubBobina_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);
CREATE TABLE public.MovimientoEmpaque (
  IdMovimientoEmpaque integer NOT NULL DEFAULT nextval('"MovimientoEmpaque_IdMovimientoEmpaque_seq"'::regclass),
  IdEmpaque integer NOT NULL,
  IdTipoMovimiento integer NOT NULL,
  IdUsuario integer NOT NULL,
  FechaMovimiento timestamp with time zone NOT NULL DEFAULT now(),
  Observacion text,
  CONSTRAINT MovimientoEmpaque_pkey PRIMARY KEY (IdMovimientoEmpaque),
  CONSTRAINT MovimientoEmpaque_IdEmpaque_fkey FOREIGN KEY (IdEmpaque) REFERENCES public.Empaque(IdEmpaque),
  CONSTRAINT MovimientoEmpaque_IdTipoMovimiento_fkey FOREIGN KEY (IdTipoMovimiento) REFERENCES public.TipoMovimientoMateriaPrima(IdTipoMovimiento),
  CONSTRAINT MovimientoEmpaque_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);
CREATE TABLE public.EstadoProduccion (
  IdEstadoProduccion integer NOT NULL DEFAULT nextval('"EstadoProduccion_IdEstadoProduccion_seq"'::regclass),
  NombreEstadoProduccion text NOT NULL,
  DescripcionEstadoProduccion text,
  CONSTRAINT EstadoProduccion_pkey PRIMARY KEY (IdEstadoProduccion)
);
CREATE TABLE public.ProduccionBobinaTubo (
  IdProduccionBobinaTubo integer NOT NULL DEFAULT nextval('"ProduccionBobinaTubo_IdProduccionBobinaTubo_seq"'::regclass),
  IdEstadoProduccion integer NOT NULL,
  IdUsuario integer NOT NULL,
  IdBobina_1 integer NOT NULL,
  IdBobina_2 integer NOT NULL,
  IdTurno integer NOT NULL,
  FechaInicioProduccion timestamp with time zone NOT NULL,
  FechaFinProduccion timestamp with time zone,
  CantidadLogsActual integer NOT NULL DEFAULT 0,
  CONSTRAINT ProduccionBobinaTubo_pkey PRIMARY KEY (IdProduccionBobinaTubo),
  CONSTRAINT ProduccionBobinaTubo_IdEstadoProduccion_fkey FOREIGN KEY (IdEstadoProduccion) REFERENCES public.EstadoProduccion(IdEstadoProduccion),
  CONSTRAINT ProduccionBobinaTubo_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario),
  CONSTRAINT ProduccionBobinaTubo_IdBobina_1_fkey FOREIGN KEY (IdBobina_1) REFERENCES public.BobinaPapel(IdBobinaPapel),
  CONSTRAINT ProduccionBobinaTubo_IdBobina_2_fkey FOREIGN KEY (IdBobina_2) REFERENCES public.BobinaPapel(IdBobinaPapel),
  CONSTRAINT ProduccionBobinaTubo_IdTurno_fkey FOREIGN KEY (IdTurno) REFERENCES public.Turno(IdTurno)
);
CREATE TABLE public.ProduccionServilleta (
  IdProduccionServilleta integer NOT NULL DEFAULT nextval('"ProduccionServilleta_IdProduccionServilleta_seq"'::regclass),
  IdEstadoProduccion integer NOT NULL,
  IdUsuario integer NOT NULL,
  IdSubBobina integer NOT NULL,
  IdTurno integer NOT NULL,
  FechaInicioProduccion timestamp with time zone NOT NULL,
  FechaFinProduccion timestamp with time zone,
  CONSTRAINT ProduccionServilleta_pkey PRIMARY KEY (IdProduccionServilleta),
  CONSTRAINT ProduccionServilleta_IdEstadoProduccion_fkey FOREIGN KEY (IdEstadoProduccion) REFERENCES public.EstadoProduccion(IdEstadoProduccion),
  CONSTRAINT ProduccionServilleta_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario),
  CONSTRAINT ProduccionServilleta_IdTurno_fkey FOREIGN KEY (IdTurno) REFERENCES public.Turno(IdTurno)
);
CREATE TABLE public.PausaProduccionBobinaTubo (
  IdPausaProduccionBobinaTubo integer NOT NULL DEFAULT nextval('"PausaProduccionBobinaTubo_IdPausaProduccionBobinaTubo_seq"'::regclass),
  IdProduccionBobinaTubo integer NOT NULL,
  IdUsuario integer NOT NULL,
  FechaHoraPausa timestamp with time zone NOT NULL,
  MotivoPausaProduccion text,
  FechaHoraReanudacion timestamp with time zone,
  CONSTRAINT PausaProduccionBobinaTubo_pkey PRIMARY KEY (IdPausaProduccionBobinaTubo),
  CONSTRAINT PausaProduccionBobinaTubo_IdProduccionBobinaTubo_fkey FOREIGN KEY (IdProduccionBobinaTubo) REFERENCES public.ProduccionBobinaTubo(IdProduccionBobinaTubo),
  CONSTRAINT PausaProduccionBobinaTubo_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);
CREATE TABLE public.PausaProduccionServilleta (
  IdPausaProduccionServilleta integer NOT NULL DEFAULT nextval('"PausaProduccionServilleta_IdPausaProduccionServilleta_seq"'::regclass),
  IdProduccionServilleta integer NOT NULL,
  IdUsuario integer NOT NULL,
  FechaHoraPausa timestamp with time zone NOT NULL,
  MotivoPausaProduccion text,
  FechaHoraReanudacion timestamp with time zone,
  CONSTRAINT PausaProduccionServilleta_pkey PRIMARY KEY (IdPausaProduccionServilleta),
  CONSTRAINT PausaProduccionServilleta_IdProduccionServilleta_fkey FOREIGN KEY (IdProduccionServilleta) REFERENCES public.ProduccionServilleta(IdProduccionServilleta),
  CONSTRAINT PausaProduccionServilleta_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);
CREATE TABLE public.Producto (
  IdProducto integer NOT NULL DEFAULT nextval('"Producto_IdProducto_seq"'::regclass),
  NombreProducto text NOT NULL,
  CONSTRAINT Producto_pkey PRIMARY KEY (IdProducto)
);
CREATE TABLE public.PresentacionProducto (
  IdPresentacion integer NOT NULL DEFAULT nextval('"PresentacionProducto_IdPresentacion_seq"'::regclass),
  IdProducto integer NOT NULL,
  TipoContenedor text NOT NULL,
  CantidadRollosUnidades integer,
  CantidadPorUnidadTerminada integer,
  CodigoPresentacion text NOT NULL UNIQUE,
  CONSTRAINT PresentacionProducto_pkey PRIMARY KEY (IdPresentacion),
  CONSTRAINT PresentacionProducto_IdProducto_fkey FOREIGN KEY (IdProducto) REFERENCES public.Producto(IdProducto)
);
CREATE TABLE public.TipoMovimientoInventario (
  IdTipoMovimientoInventario integer NOT NULL DEFAULT nextval('"TipoMovimientoInventario_IdTipoMovimientoInventario_seq"'::regclass),
  NombreTipoMovimientoInventario text NOT NULL,
  DescripcionTipoMovimientoInventario text,
  CONSTRAINT TipoMovimientoInventario_pkey PRIMARY KEY (IdTipoMovimientoInventario)
);
CREATE TABLE public.MovimientoProductoTerminado (
  IdMovimientoProductoTerminado integer NOT NULL DEFAULT nextval('"MovimientoProductoTerminado_IdMovimientoProductoTerminado_seq"'::regclass),
  IdTipoMovimientoInventario integer NOT NULL,
  IdPresentacion integer NOT NULL,
  IdUsuario integer NOT NULL,
  CantidadIngresoInventario numeric NOT NULL,
  FechaMovimiento timestamp with time zone NOT NULL DEFAULT now(),
  Observacion text,
  CONSTRAINT MovimientoProductoTerminado_pkey PRIMARY KEY (IdMovimientoProductoTerminado),
  CONSTRAINT MovimientoProductoTerminado_IdTipoMovimientoInventario_fkey FOREIGN KEY (IdTipoMovimientoInventario) REFERENCES public.TipoMovimientoInventario(IdTipoMovimientoInventario),
  CONSTRAINT MovimientoProductoTerminado_IdPresentacion_fkey FOREIGN KEY (IdPresentacion) REFERENCES public.PresentacionProducto(IdPresentacion),
  CONSTRAINT MovimientoProductoTerminado_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);
CREATE TABLE public.InventarioProductoTerminado (
  IdPresentacion integer NOT NULL,
  CantidadActual numeric NOT NULL DEFAULT 0,
  CONSTRAINT InventarioProductoTerminado_pkey PRIMARY KEY (IdPresentacion),
  CONSTRAINT InventarioProductoTerminado_IdPresentacion_fkey FOREIGN KEY (IdPresentacion) REFERENCES public.PresentacionProducto(IdPresentacion)
);
CREATE TABLE public.TipoInsumo (
  IdTipoInsumo integer NOT NULL DEFAULT nextval('"TipoInsumo_IdTipoInsumo_seq"'::regclass),
  NombreInsumo text NOT NULL,
  DescripcionInsumo text,
  CONSTRAINT TipoInsumo_pkey PRIMARY KEY (IdTipoInsumo)
);
CREATE TABLE public.MovimientoInsumo (
  IdMovimientoInsumo integer NOT NULL DEFAULT nextval('"MovimientoInsumo_IdMovimientoInsumo_seq"'::regclass),
  IdTipoMovimiento integer NOT NULL,
  IdUsuario integer NOT NULL,
  CantidadMovimiento numeric,
  FechaMovimiento timestamp with time zone NOT NULL DEFAULT now(),
  Observacion text,
  IdTipoInsumo integer NOT NULL,
  CONSTRAINT MovimientoInsumo_pkey PRIMARY KEY (IdMovimientoInsumo),
  CONSTRAINT MovimientoInsumo_IdTipoMovimiento_fkey FOREIGN KEY (IdTipoMovimiento) REFERENCES public.TipoMovimientoMateriaPrima(IdTipoMovimiento),
  CONSTRAINT MovimientoInsumo_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario),
  CONSTRAINT MovimientoInsumo_IdTipoInsumo_fkey FOREIGN KEY (IdTipoInsumo) REFERENCES public.TipoInsumo(IdTipoInsumo)
);
CREATE TABLE public.InventarioInsumo (
  IdInventarioInsumo integer NOT NULL DEFAULT nextval('"InventarioInsumo_IdInventarioInsumo_seq"'::regclass),
  IdTipoInsumo integer NOT NULL,
  CantidadActual numeric NOT NULL DEFAULT 0,
  CONSTRAINT InventarioInsumo_pkey PRIMARY KEY (IdInventarioInsumo),
  CONSTRAINT InventarioInsumo_IdTipoInsumo_fkey FOREIGN KEY (IdTipoInsumo) REFERENCES public.TipoInsumo(IdTipoInsumo)
);
CREATE TABLE public.TipoEmpaqueBolsa (
  IdTipoEmpaqueBolsa integer NOT NULL DEFAULT nextval('"TipoEmpaqueBolsa_IdTipoEmpaqueBolsa_seq"'::regclass),
  NombreEmpaqueBolsa text NOT NULL,
  DescripcionEmpaqueBolsa text,
  CONSTRAINT TipoEmpaqueBolsa_pkey PRIMARY KEY (IdTipoEmpaqueBolsa)
);
CREATE TABLE public.MovimientoEmpaqueBolsa (
  IdMovimientoEmpaqueBolsa integer NOT NULL DEFAULT nextval('"MovimientoEmpaqueBolsa_IdMovimientoEmpaqueBolsa_seq"'::regclass),
  IdTipoMovimiento integer NOT NULL,
  IdUsuario integer NOT NULL,
  CantidadMovimiento numeric,
  FechaMovimiento timestamp with time zone NOT NULL DEFAULT now(),
  Observacion text,
  IdTipoEmpaqueBolsa integer NOT NULL,
  IdLoteEmpaque integer,
  CONSTRAINT MovimientoEmpaqueBolsa_pkey PRIMARY KEY (IdMovimientoEmpaqueBolsa),
  CONSTRAINT MovimientoEmpaqueBolsa_IdTipoMovimiento_fkey FOREIGN KEY (IdTipoMovimiento) REFERENCES public.TipoMovimientoMateriaPrima(IdTipoMovimiento),
  CONSTRAINT MovimientoEmpaqueBolsa_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario),
  CONSTRAINT MovimientoEmpaqueBolsa_IdTipoEmpaqueBolsa_fkey FOREIGN KEY (IdTipoEmpaqueBolsa) REFERENCES public.TipoEmpaqueBolsa(IdTipoEmpaqueBolsa),
  CONSTRAINT MovimientoEmpaqueBolsa_IdLoteEmpaque_fkey FOREIGN KEY (IdLoteEmpaque) REFERENCES public.LoteEmpaque(IdLoteEmpaque)
);
CREATE TABLE public.InventarioEmpaqueBolsa (
  IdInventarioEmpaqueBolsa integer NOT NULL DEFAULT nextval('"InventarioEmpaqueBolsa_IdInventarioEmpaqueBolsa_seq"'::regclass),
  IdTipoEmpaqueBolsa integer NOT NULL,
  CantidadActual numeric NOT NULL DEFAULT 0,
  CONSTRAINT InventarioEmpaqueBolsa_pkey PRIMARY KEY (IdInventarioEmpaqueBolsa),
  CONSTRAINT InventarioEmpaqueBolsa_IdTipoEmpaqueBolsa_fkey FOREIGN KEY (IdTipoEmpaqueBolsa) REFERENCES public.TipoEmpaqueBolsa(IdTipoEmpaqueBolsa)
);
CREATE TABLE public.TipoBolsaJava (
  IdTipoBolsaJava integer NOT NULL DEFAULT nextval('"TipoBolsaJava_IdTipoBolsaJava_seq"'::regclass),
  NombreBolsaJava text NOT NULL,
  DescripcionBolsaJava text,
  CONSTRAINT TipoBolsaJava_pkey PRIMARY KEY (IdTipoBolsaJava)
);
CREATE TABLE public.MovimientoBolsaJava (
  IdMovimientoBolsaJava integer NOT NULL DEFAULT nextval('"MovimientoBolsaJava_IdMovimientoBolsaJava_seq"'::regclass),
  IdTipoMovimiento integer NOT NULL,
  IdUsuario integer NOT NULL,
  CantidadMovimiento numeric,
  FechaMovimiento timestamp with time zone NOT NULL DEFAULT now(),
  Observacion text,
  IdTipoBolsaJava integer NOT NULL,
  IdLoteEmpaque integer,
  CONSTRAINT MovimientoBolsaJava_pkey PRIMARY KEY (IdMovimientoBolsaJava),
  CONSTRAINT MovimientoBolsaJava_IdTipoMovimiento_fkey FOREIGN KEY (IdTipoMovimiento) REFERENCES public.TipoMovimientoMateriaPrima(IdTipoMovimiento),
  CONSTRAINT MovimientoBolsaJava_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario),
  CONSTRAINT MovimientoBolsaJava_IdTipoBolsaJava_fkey FOREIGN KEY (IdTipoBolsaJava) REFERENCES public.TipoBolsaJava(IdTipoBolsaJava),
  CONSTRAINT MovimientoBolsaJava_IdLoteEmpaque_fkey FOREIGN KEY (IdLoteEmpaque) REFERENCES public.LoteEmpaque(IdLoteEmpaque)
);
CREATE TABLE public.InventarioBolsaJava (
  IdInventarioBolsaJava integer NOT NULL DEFAULT nextval('"InventarioBolsaJava_IdInventarioBolsaJava_seq"'::regclass),
  IdTipoBolsaJava integer NOT NULL,
  CantidadActual numeric NOT NULL DEFAULT 0,
  CONSTRAINT InventarioBolsaJava_pkey PRIMARY KEY (IdInventarioBolsaJava),
  CONSTRAINT InventarioBolsaJava_IdTipoBolsaJava_fkey FOREIGN KEY (IdTipoBolsaJava) REFERENCES public.TipoBolsaJava(IdTipoBolsaJava)
);
CREATE TABLE public.TipoMovimientoOperadorLogs (
  IdTipoMovimientoOperadorLogs integer NOT NULL DEFAULT nextval('"TipoMovimientoOperadorLogs_IdTipoMovimientoOperadorLogs_seq"'::regclass),
  NombreMovimiento text NOT NULL,
  DescripcionTipoMovimientoOperadorLogs text,
  CONSTRAINT TipoMovimientoOperadorLogs_pkey PRIMARY KEY (IdTipoMovimientoOperadorLogs)
);
CREATE TABLE public.MovimientoOperadorLogs (
  IdMovimientoOperadorLogs integer NOT NULL DEFAULT nextval('"MovimientoOperadorLogs_IdMovimientoOperadorLogs_seq"'::regclass),
  IdProduccionBobinaTubo integer NOT NULL,
  IdTipoMovimientoOperadorLogs integer NOT NULL,
  IdUsuario integer NOT NULL,
  CantidadLogs integer NOT NULL,
  FechaMovimiento timestamp with time zone NOT NULL DEFAULT now(),
  Observacion text,
  CONSTRAINT MovimientoOperadorLogs_pkey PRIMARY KEY (IdMovimientoOperadorLogs),
  CONSTRAINT MovimientoOperadorLogs_IdProduccionBobinaTubo_fkey FOREIGN KEY (IdProduccionBobinaTubo) REFERENCES public.ProduccionBobinaTubo(IdProduccionBobinaTubo),
  CONSTRAINT MovimientoOperadorLogs_IdTipoMovimientoOperadorLogs_fkey FOREIGN KEY (IdTipoMovimientoOperadorLogs) REFERENCES public.TipoMovimientoOperadorLogs(IdTipoMovimientoOperadorLogs),
  CONSTRAINT MovimientoOperadorLogs_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);
CREATE TABLE public.EstadoProveedor (
  IdEstadoProveedor integer NOT NULL DEFAULT nextval('"EstadoProveedor_IdEstadoProveedor_seq"'::regclass),
  NombreEstadoProveedor text NOT NULL,
  DescripcionEstadoProveedor text,
  CONSTRAINT EstadoProveedor_pkey PRIMARY KEY (IdEstadoProveedor)
);
CREATE TABLE public.CancelacionProduccionBobinaTubo (
  IdCancelacionProduccionBobinaTubo integer NOT NULL DEFAULT nextval('"CancelacionProduccionBobinaTu_IdCancelacionProduccionBobina_seq"'::regclass),
  IdProduccionBobinaTubo integer NOT NULL,
  IdUsuario integer NOT NULL,
  FechaHoraCancelacion timestamp with time zone NOT NULL DEFAULT now(),
  MotivoCancelacion text,
  CONSTRAINT CancelacionProduccionBobinaTubo_pkey PRIMARY KEY (IdCancelacionProduccionBobinaTubo),
  CONSTRAINT CancelacionProduccionBobinaTubo_IdProduccionBobinaTubo_fkey FOREIGN KEY (IdProduccionBobinaTubo) REFERENCES public.ProduccionBobinaTubo(IdProduccionBobinaTubo),
  CONSTRAINT CancelacionProduccionBobinaTubo_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);
CREATE TABLE public.CancelacionProduccionServilleta (
  IdCancelacionProduccionServilleta integer NOT NULL DEFAULT nextval('"CancelacionProduccionServille_IdCancelacionProduccionServil_seq"'::regclass),
  IdProduccionServilleta integer NOT NULL,
  IdUsuario integer NOT NULL,
  FechaHoraCancelacion timestamp with time zone NOT NULL DEFAULT now(),
  MotivoCancelacion text,
  CONSTRAINT CancelacionProduccionServilleta_pkey PRIMARY KEY (IdCancelacionProduccionServilleta),
  CONSTRAINT CancelacionProduccionServilleta_IdProduccionServilleta_fkey FOREIGN KEY (IdProduccionServilleta) REFERENCES public.ProduccionServilleta(IdProduccionServilleta),
  CONSTRAINT CancelacionProduccionServilleta_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);
CREATE TABLE public.TipoBobinaServilleta (
  IdTipoBobinaServilleta integer NOT NULL DEFAULT nextval('"TipoBobinaServilleta_IdTipoBobinaServilleta_seq"'::regclass),
  NombreTipoBobinaServilleta text NOT NULL,
  DiametroMm numeric NOT NULL DEFAULT 1210,
  CrepadoPorcentaje numeric NOT NULL DEFAULT 14,
  ResistenciaKgf numeric NOT NULL DEFAULT 1.35,
  CONSTRAINT TipoBobinaServilleta_pkey PRIMARY KEY (IdTipoBobinaServilleta)
);
CREATE TABLE public.FormatoSubBobina (
  IdFormatoSubBobina integer NOT NULL DEFAULT nextval('"FormatoSubBobina_IdFormatoSubBobina_seq"'::regclass),
  DescripcionFormato text NOT NULL,
  CantidadBobina435 integer NOT NULL DEFAULT 0,
  CantidadBobina220 integer NOT NULL DEFAULT 0,
  CONSTRAINT FormatoSubBobina_pkey PRIMARY KEY (IdFormatoSubBobina)
);
CREATE TABLE public.TipoMedidaSubBobina (
  IdTipoMedidaSubBobina integer NOT NULL DEFAULT nextval('"TipoMedidaSubBobina_IdTipoMedidaSubBobina_seq"'::regclass),
  MedidaMm integer NOT NULL,
  Descripcion text,
  CONSTRAINT TipoMedidaSubBobina_pkey PRIMARY KEY (IdTipoMedidaSubBobina)
);
CREATE TABLE public.BobinaServilleta (
  IdBobinaServilleta integer NOT NULL DEFAULT nextval('"BobinaServilleta_IdBobinaServilleta_seq"'::regclass),
  IdTipoBobinaServilleta integer NOT NULL,
  IdEstadoMateriaPrima integer NOT NULL,
  IdLoteBobinaServilleta integer NOT NULL,
  CONSTRAINT BobinaServilleta_pkey PRIMARY KEY (IdBobinaServilleta),
  CONSTRAINT BobinaServilleta_IdTipoBobinaServilleta_fkey FOREIGN KEY (IdTipoBobinaServilleta) REFERENCES public.TipoBobinaServilleta(IdTipoBobinaServilleta),
  CONSTRAINT BobinaServilleta_IdEstadoMateriaPrima_fkey FOREIGN KEY (IdEstadoMateriaPrima) REFERENCES public.EstadoMateriaPrima(IdEstadoMateriaPrima),
  CONSTRAINT BobinaServilleta_IdLoteBobinaServilleta_fkey FOREIGN KEY (IdLoteBobinaServilleta) REFERENCES public.LoteBobinaServilleta(IdLoteBobinaServilleta)
);
CREATE TABLE public.UnidadBobinaServilleta (
  IdUnidadBobinaServilleta integer NOT NULL DEFAULT nextval('"UnidadBobinaServilleta_IdUnidadBobinaServilleta_seq"'::regclass),
  IdBobinaServilleta integer NOT NULL,
  IdFormatoSubBobina integer NOT NULL,
  CodigoBobina text NOT NULL UNIQUE,
  PesoBrutoKg numeric,
  GramajeGr numeric,
  CONSTRAINT UnidadBobinaServilleta_pkey PRIMARY KEY (IdUnidadBobinaServilleta),
  CONSTRAINT UnidadBobinaServilleta_IdBobinaServilleta_fkey FOREIGN KEY (IdBobinaServilleta) REFERENCES public.BobinaServilleta(IdBobinaServilleta),
  CONSTRAINT UnidadBobinaServilleta_IdFormatoSubBobina_fkey FOREIGN KEY (IdFormatoSubBobina) REFERENCES public.FormatoSubBobina(IdFormatoSubBobina)
);
CREATE TABLE public.SubBobinaServilleta (
  IdSubBobinaServilleta integer NOT NULL DEFAULT nextval('"SubBobinaServilleta_IdSubBobinaServilleta_seq"'::regclass),
  IdUnidadBobinaServilleta integer NOT NULL,
  IdTipoMedidaSubBobina integer NOT NULL,
  IdEstadoMateriaPrima integer NOT NULL,
  CONSTRAINT SubBobinaServilleta_pkey PRIMARY KEY (IdSubBobinaServilleta),
  CONSTRAINT SubBobinaServilleta_IdUnidadBobinaServilleta_fkey FOREIGN KEY (IdUnidadBobinaServilleta) REFERENCES public.UnidadBobinaServilleta(IdUnidadBobinaServilleta),
  CONSTRAINT SubBobinaServilleta_IdTipoMedidaSubBobina_fkey FOREIGN KEY (IdTipoMedidaSubBobina) REFERENCES public.TipoMedidaSubBobina(IdTipoMedidaSubBobina),
  CONSTRAINT SubBobinaServilleta_IdEstadoMateriaPrima_fkey FOREIGN KEY (IdEstadoMateriaPrima) REFERENCES public.EstadoMateriaPrima(IdEstadoMateriaPrima)
);
CREATE TABLE public.LoteBobinaServilleta (
  IdLoteBobinaServilleta integer NOT NULL DEFAULT nextval('"LoteBobinaServilleta_IdLoteBobinaServilleta_seq"'::regclass),
  IdProveedor integer NOT NULL,
  IdUsuario integer,
  FechaRecepcion date NOT NULL,
  CONSTRAINT LoteBobinaServilleta_pkey PRIMARY KEY (IdLoteBobinaServilleta),
  CONSTRAINT LoteBobinaServilleta_IdProveedor_fkey FOREIGN KEY (IdProveedor) REFERENCES public.Proveedor(IdProveedor),
  CONSTRAINT LoteBobinaServilleta_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);

-- =============================================================================
-- MÓDULOS NUEVOS: SEGURIDAD, TESORERÍA, RRHH, LOGÍSTICA, VENTAS / MÓVIL
-- =============================================================================

CREATE TABLE public.AuditLog (
  IdAuditLog bigint NOT NULL DEFAULT nextval('"AuditLog_IdAuditLog_seq"'::regclass),
  IdUsuario integer,
  Accion text NOT NULL,
  TablaAfectada text NOT NULL,
  IdRegistroAfectado text,
  DatosAnteriores jsonb,
  DatosNuevos jsonb,
  DireccionIp text,
  FechaHora timestamp with time zone NOT NULL DEFAULT now(),
  Detalle text,
  CONSTRAINT AuditLog_pkey PRIMARY KEY (IdAuditLog),
  CONSTRAINT AuditLog_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario) ON DELETE SET NULL
);

CREATE TABLE public.CuentaBancariaEmpresa (
  IdCuentaBancaria integer NOT NULL DEFAULT nextval('"CuentaBancariaEmpresa_IdCuentaBancaria_seq"'::regclass),
  NombreBanco text NOT NULL,
  Sigla text NOT NULL UNIQUE,
  NumeroCuenta text,
  TipoCuenta text NOT NULL DEFAULT 'Cuenta Corriente',
  Moneda text NOT NULL DEFAULT 'BOB',
  SaldoActual numeric(14,2) NOT NULL DEFAULT 0,
  Activa boolean NOT NULL DEFAULT true,
  FechaCreacion timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT CuentaBancariaEmpresa_pkey PRIMARY KEY (IdCuentaBancaria)
);

CREATE TABLE public.Caja (
  IdCaja integer NOT NULL DEFAULT nextval('"Caja_IdCaja_seq"'::regclass),
  NombreCaja text NOT NULL,
  Descripcion text,
  Activa boolean NOT NULL DEFAULT true,
  FechaCreacion timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT Caja_pkey PRIMARY KEY (IdCaja)
);

CREATE TABLE public.EstadoAperturaCaja (
  IdEstadoAperturaCaja integer NOT NULL DEFAULT nextval('"EstadoAperturaCaja_IdEstadoAperturaCaja_seq"'::regclass),
  NombreEstado text NOT NULL UNIQUE,
  CONSTRAINT EstadoAperturaCaja_pkey PRIMARY KEY (IdEstadoAperturaCaja)
);

CREATE TABLE public.AperturaCierreCaja (
  IdAperturaCierreCaja integer NOT NULL DEFAULT nextval('"AperturaCierreCaja_IdAperturaCierreCaja_seq"'::regclass),
  IdCaja integer NOT NULL,
  IdUsuarioApertura integer NOT NULL,
  IdUsuarioCierre integer,
  IdUsuarioAutorizaCierre integer,
  IdEstadoAperturaCaja integer NOT NULL,
  FechaApertura timestamp with time zone NOT NULL DEFAULT now(),
  SaldoInicial numeric(12,2) NOT NULL DEFAULT 0,
  FechaCierre timestamp with time zone,
  SaldoTeorico numeric(12,2),
  SaldoReal numeric(12,2),
  Diferencia numeric(12,2),
  NumeroArqueo text,
  HoraInicio time without time zone,
  HoraTermino time without time zone,
  Observacion text,
  CONSTRAINT AperturaCierreCaja_pkey PRIMARY KEY (IdAperturaCierreCaja),
  CONSTRAINT AperturaCierreCaja_IdCaja_fkey FOREIGN KEY (IdCaja) REFERENCES public.Caja(IdCaja),
  CONSTRAINT AperturaCierreCaja_IdUsuarioApertura_fkey FOREIGN KEY (IdUsuarioApertura) REFERENCES public.Usuario(IdUsuario),
  CONSTRAINT AperturaCierreCaja_IdUsuarioCierre_fkey FOREIGN KEY (IdUsuarioCierre) REFERENCES public.Usuario(IdUsuario),
  CONSTRAINT AperturaCierreCaja_IdUsuarioAutorizaCierre_fkey FOREIGN KEY (IdUsuarioAutorizaCierre) REFERENCES public.Usuario(IdUsuario),
  CONSTRAINT AperturaCierreCaja_IdEstadoAperturaCaja_fkey FOREIGN KEY (IdEstadoAperturaCaja) REFERENCES public.EstadoAperturaCaja(IdEstadoAperturaCaja)
);

CREATE TABLE public.ArqueoCajaDetalle (
  IdArqueoCajaDetalle bigint NOT NULL DEFAULT nextval('"ArqueoCajaDetalle_IdArqueoCajaDetalle_seq"'::regclass),
  IdAperturaCierreCaja integer NOT NULL,
  TipoEfectivo text NOT NULL CHECK (TipoEfectivo IN ('Billete', 'Moneda')),
  Corte numeric(6,2) NOT NULL,
  Cantidad integer NOT NULL DEFAULT 0 CHECK (Cantidad >= 0),
  Subtotal numeric(12,2) GENERATED ALWAYS AS (Corte * Cantidad) STORED,
  CONSTRAINT ArqueoCajaDetalle_pkey PRIMARY KEY (IdArqueoCajaDetalle),
  CONSTRAINT ArqueoCajaDetalle_IdAperturaCierreCaja_fkey FOREIGN KEY (IdAperturaCierreCaja) REFERENCES public.AperturaCierreCaja(IdAperturaCierreCaja) ON DELETE CASCADE
);

CREATE TABLE public.CategoriaMovimientoCaja (
  IdCategoriaMovimientoCaja integer NOT NULL DEFAULT nextval('"CategoriaMovimientoCaja_IdCategoriaMovimientoCaja_seq"'::regclass),
  NombreCategoria text NOT NULL UNIQUE,
  TipoMovimiento text NOT NULL CHECK (TipoMovimiento IN ('Ingreso', 'Egreso')),
  Descripcion text,
  CONSTRAINT CategoriaMovimientoCaja_pkey PRIMARY KEY (IdCategoriaMovimientoCaja)
);

CREATE TABLE public.MovimientoCaja (
  IdMovimientoCaja bigint NOT NULL DEFAULT nextval('"MovimientoCaja_IdMovimientoCaja_seq"'::regclass),
  IdAperturaCierreCaja integer,
  IdCategoriaMovimientoCaja integer NOT NULL,
  IdUsuario integer,
  Monto numeric(12,2) NOT NULL CHECK (Monto > 0),
  MetodoPago text NOT NULL DEFAULT 'Efectivo',
  NumeroReferencia text,
  FechaMovimiento timestamp with time zone NOT NULL DEFAULT now(),
  NotaCodigo text,
  Solicitante text,
  Respaldo text,
  IdCuentaBancaria integer,
  Descripcion text,
  Anulado boolean NOT NULL DEFAULT false,
  IdMovimientoCajaAnulacion bigint,
  CONSTRAINT MovimientoCaja_pkey PRIMARY KEY (IdMovimientoCaja),
  CONSTRAINT MovimientoCaja_IdAperturaCierreCaja_fkey FOREIGN KEY (IdAperturaCierreCaja) REFERENCES public.AperturaCierreCaja(IdAperturaCierreCaja),
  CONSTRAINT MovimientoCaja_IdCategoriaMovimientoCaja_fkey FOREIGN KEY (IdCategoriaMovimientoCaja) REFERENCES public.CategoriaMovimientoCaja(IdCategoriaMovimientoCaja),
  CONSTRAINT MovimientoCaja_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario),
  CONSTRAINT MovimientoCaja_IdCuentaBancaria_fkey FOREIGN KEY (IdCuentaBancaria) REFERENCES public.CuentaBancariaEmpresa(IdCuentaBancaria) ON DELETE SET NULL,
  CONSTRAINT MovimientoCaja_IdMovimientoCajaAnulacion_fkey FOREIGN KEY (IdMovimientoCajaAnulacion) REFERENCES public.MovimientoCaja(IdMovimientoCaja)
);

CREATE TABLE public.SolicitudCajaChica (
  IdSolicitudCajaChica integer NOT NULL DEFAULT nextval('"SolicitudCajaChica_IdSolicitudCajaChica_seq"'::regclass),
  CodigoSolicitud text NOT NULL UNIQUE,
  IdCaja integer NOT NULL DEFAULT 1,
  FechaSolicitud date NOT NULL DEFAULT CURRENT_DATE,
  NombreSolicitante text NOT NULL,
  CargoSolicitante text,
  MontoSolicitado numeric(12,2) NOT NULL CHECK (MontoSolicitado > 0),
  DestinoJustificacion text NOT NULL,
  NombreEntregadoPor text,
  NombreAprobadoPor text DEFAULT 'GERENCIA GENERAL',
  Estado text NOT NULL DEFAULT 'Aprobada' CHECK (Estado IN ('Pendiente', 'Aprobada', 'Rendida', 'Rechazada')),
  IdCategoriaMovimientoCaja integer,
  RespaldoDoc text,
  IdMovimientoCaja bigint,
  FechaRegistro timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT SolicitudCajaChica_pkey PRIMARY KEY (IdSolicitudCajaChica),
  CONSTRAINT SolicitudCajaChica_IdCaja_fkey FOREIGN KEY (IdCaja) REFERENCES public.Caja(IdCaja),
  CONSTRAINT SolicitudCajaChica_IdCategoriaMovimientoCaja_fkey FOREIGN KEY (IdCategoriaMovimientoCaja) REFERENCES public.CategoriaMovimientoCaja(IdCategoriaMovimientoCaja),
  CONSTRAINT SolicitudCajaChica_IdMovimientoCaja_fkey FOREIGN KEY (IdMovimientoCaja) REFERENCES public.MovimientoCaja(IdMovimientoCaja) ON DELETE SET NULL
);

CREATE TABLE public.EstadoCliente (
  IdEstadoCliente integer NOT NULL DEFAULT nextval('"EstadoCliente_IdEstadoCliente_seq"'::regclass),
  NombreEstado text NOT NULL UNIQUE,
  CONSTRAINT EstadoCliente_pkey PRIMARY KEY (IdEstadoCliente)
);

CREATE TABLE public.Cliente (
  IdCliente integer NOT NULL DEFAULT nextval('"Cliente_IdCliente_seq"'::regclass),
  IdEstadoCliente integer NOT NULL DEFAULT 1,
  RazonSocial text NOT NULL,
  NombreComercial text,
  NitCi text,
  Telefono text,
  CorreoElectronico text,
  Direccion text,
  CiudadDestino text DEFAULT 'Sucre',
  LineaCredito text DEFAULT 'Al contado',
  Latitud numeric(10,7),
  Longitud numeric(10,7),
  LimiteCreditoBs numeric(12,2) DEFAULT 0,
  DiasCredito integer DEFAULT 0,
  BloqueadoPorMora boolean NOT NULL DEFAULT false,
  FechaRegistro timestamp with time zone NOT NULL DEFAULT now(),
  IdUsuarioRegistro integer,
  Observacion text,
  CONSTRAINT Cliente_pkey PRIMARY KEY (IdCliente),
  CONSTRAINT Cliente_IdEstadoCliente_fkey FOREIGN KEY (IdEstadoCliente) REFERENCES public.EstadoCliente(IdEstadoCliente),
  CONSTRAINT Cliente_IdUsuarioRegistro_fkey FOREIGN KEY (IdUsuarioRegistro) REFERENCES public.Usuario(IdUsuario) ON DELETE SET NULL
);

CREATE TABLE public.PuntoVenta (
  IdPuntoVenta integer NOT NULL DEFAULT nextval('"PuntoVenta_IdPuntoVenta_seq"'::regclass),
  IdCliente integer NOT NULL,
  NombrePuntoVenta text NOT NULL,
  Direccion text NOT NULL,
  Latitud numeric(10,7),
  Longitud numeric(10,7),
  Referencia text,
  Activo boolean NOT NULL DEFAULT true,
  CONSTRAINT PuntoVenta_pkey PRIMARY KEY (IdPuntoVenta),
  CONSTRAINT PuntoVenta_IdCliente_fkey FOREIGN KEY (IdCliente) REFERENCES public.Cliente(IdCliente) ON DELETE CASCADE
);

CREATE TABLE public.ZonaDistribucion (
  IdZonaDistribucion integer NOT NULL DEFAULT nextval('"ZonaDistribucion_IdZonaDistribucion_seq"'::regclass),
  NombreZona text NOT NULL UNIQUE,
  Ciudad text DEFAULT 'Sucre',
  Descripcion text,
  Activa boolean NOT NULL DEFAULT true,
  CONSTRAINT ZonaDistribucion_pkey PRIMARY KEY (IdZonaDistribucion)
);

CREATE TABLE public.RutaDistribucion (
  IdRutaDistribucion integer NOT NULL DEFAULT nextval('"RutaDistribucion_IdRutaDistribucion_seq"'::regclass),
  IdZonaDistribucion integer NOT NULL,
  NombreRuta text NOT NULL,
  DiaSemana integer CHECK (DiaSemana BETWEEN 1 AND 7),
  Descripcion text,
  Activa boolean NOT NULL DEFAULT true,
  CONSTRAINT RutaDistribucion_pkey PRIMARY KEY (IdRutaDistribucion),
  CONSTRAINT RutaDistribucion_IdZonaDistribucion_fkey FOREIGN KEY (IdZonaDistribucion) REFERENCES public.ZonaDistribucion(IdZonaDistribucion)
);

CREATE TABLE public.RutaPuntoVenta (
  IdRutaPuntoVenta integer NOT NULL DEFAULT nextval('"RutaPuntoVenta_IdRutaPuntoVenta_seq"'::regclass),
  IdRutaDistribucion integer NOT NULL,
  IdPuntoVenta integer NOT NULL,
  OrdenVisita integer NOT NULL DEFAULT 1,
  CONSTRAINT RutaPuntoVenta_pkey PRIMARY KEY (IdRutaPuntoVenta),
  CONSTRAINT uq_ruta_puntoventa UNIQUE (IdRutaDistribucion, IdPuntoVenta),
  CONSTRAINT RutaPuntoVenta_IdRutaDistribucion_fkey FOREIGN KEY (IdRutaDistribucion) REFERENCES public.RutaDistribucion(IdRutaDistribucion) ON DELETE CASCADE,
  CONSTRAINT RutaPuntoVenta_IdPuntoVenta_fkey FOREIGN KEY (IdPuntoVenta) REFERENCES public.PuntoVenta(IdPuntoVenta) ON DELETE CASCADE
);

CREATE TABLE public.AsignacionRuta (
  IdAsignacionRuta bigint NOT NULL DEFAULT nextval('"AsignacionRuta_IdAsignacionRuta_seq"'::regclass),
  IdRutaDistribucion integer NOT NULL,
  IdUsuarioRepartidor integer NOT NULL,
  FechaAsignacion date NOT NULL DEFAULT CURRENT_DATE,
  IdUsuarioAsigna integer NOT NULL,
  Estado text NOT NULL DEFAULT 'Pendiente',
  KilometrajeInicial numeric(10,2),
  KilometrajeFinal numeric(10,2),
  Observacion text,
  CONSTRAINT AsignacionRuta_pkey PRIMARY KEY (IdAsignacionRuta),
  CONSTRAINT uq_asignacion_ruta_fecha UNIQUE (IdRutaDistribucion, IdUsuarioRepartidor, FechaAsignacion),
  CONSTRAINT AsignacionRuta_IdRutaDistribucion_fkey FOREIGN KEY (IdRutaDistribucion) REFERENCES public.RutaDistribucion(IdRutaDistribucion),
  CONSTRAINT AsignacionRuta_IdUsuarioRepartidor_fkey FOREIGN KEY (IdUsuarioRepartidor) REFERENCES public.Usuario(IdUsuario),
  CONSTRAINT AsignacionRuta_IdUsuarioAsigna_fkey FOREIGN KEY (IdUsuarioAsigna) REFERENCES public.Usuario(IdUsuario)
);

CREATE TABLE public.CargaInventarioRuta (
  IdCargaInventarioRuta bigint NOT NULL DEFAULT nextval('"CargaInventarioRuta_IdCargaInventarioRuta_seq"'::regclass),
  IdAsignacionRuta bigint NOT NULL,
  IdPresentacion integer NOT NULL,
  CantidadCargada numeric(10,2) NOT NULL,
  CantidadVendida numeric(10,2) NOT NULL DEFAULT 0,
  CantidadDevuelta numeric(10,2) NOT NULL DEFAULT 0,
  Diferencia numeric(10,2) GENERATED ALWAYS AS (CantidadCargada - CantidadVendida - CantidadDevuelta) STORED,
  FechaCarga timestamp with time zone NOT NULL DEFAULT now(),
  IdUsuarioDespacha integer,
  Observacion text,
  CONSTRAINT CargaInventarioRuta_pkey PRIMARY KEY (IdCargaInventarioRuta),
  CONSTRAINT CargaInventarioRuta_IdAsignacionRuta_fkey FOREIGN KEY (IdAsignacionRuta) REFERENCES public.AsignacionRuta(IdAsignacionRuta) ON DELETE CASCADE,
  CONSTRAINT CargaInventarioRuta_IdPresentacion_fkey FOREIGN KEY (IdPresentacion) REFERENCES public.PresentacionProducto(IdPresentacion),
  CONSTRAINT CargaInventarioRuta_IdUsuarioDespacha_fkey FOREIGN KEY (IdUsuarioDespacha) REFERENCES public.Usuario(IdUsuario) ON DELETE SET NULL
);

CREATE TABLE public.PrecioProducto (
  IdPrecioProducto integer NOT NULL DEFAULT nextval('"PrecioProducto_IdPrecioProducto_seq"'::regclass),
  IdPresentacion integer NOT NULL,
  PrecioUnitario numeric(10,2) NOT NULL,
  PrecioMayorista numeric(10,2),
  CantidadMinimaMayorista integer DEFAULT 10,
  VigenteDesde date NOT NULL DEFAULT CURRENT_DATE,
  VigenteHasta date,
  Activo boolean NOT NULL DEFAULT true,
  CONSTRAINT PrecioProducto_pkey PRIMARY KEY (IdPrecioProducto),
  CONSTRAINT PrecioProducto_IdPresentacion_fkey FOREIGN KEY (IdPresentacion) REFERENCES public.PresentacionProducto(IdPresentacion) ON DELETE CASCADE
);

CREATE TABLE public.EstadoPedido (
  IdEstadoPedido integer NOT NULL DEFAULT nextval('"EstadoPedido_IdEstadoPedido_seq"'::regclass),
  NombreEstado text NOT NULL UNIQUE,
  CONSTRAINT EstadoPedido_pkey PRIMARY KEY (IdEstadoPedido)
);

CREATE TABLE public.MetodoPago (
  IdMetodoPago integer NOT NULL DEFAULT nextval('"MetodoPago_IdMetodoPago_seq"'::regclass),
  NombreMetodoPago text NOT NULL UNIQUE,
  CONSTRAINT MetodoPago_pkey PRIMARY KEY (IdMetodoPago)
);

CREATE TABLE public.Pedido (
  IdPedido bigint NOT NULL DEFAULT nextval('"Pedido_IdPedido_seq"'::regclass),
  NumeroPedido text UNIQUE,
  IdCliente integer NOT NULL,
  IdPuntoVenta integer,
  IdUsuarioRepartidor integer NOT NULL,
  IdEstadoPedido integer NOT NULL,
  IdAsignacionRuta bigint,
  FechaPedido timestamp with time zone NOT NULL DEFAULT now(),
  FechaEntrega timestamp with time zone,
  EsVentaDirecta boolean NOT NULL DEFAULT false,
  SubTotal numeric(12,2) NOT NULL DEFAULT 0,
  Descuento numeric(12,2) NOT NULL DEFAULT 0,
  MontoTotal numeric(12,2) NOT NULL DEFAULT 0,
  LatitudEntrega numeric(10,7),
  LongitudEntrega numeric(10,7),
  SincronizadoDesdeMovil boolean NOT NULL DEFAULT false,
  IdMovilLocal text UNIQUE,
  Observacion text,
  CONSTRAINT Pedido_pkey PRIMARY KEY (IdPedido),
  CONSTRAINT Pedido_IdCliente_fkey FOREIGN KEY (IdCliente) REFERENCES public.Cliente(IdCliente),
  CONSTRAINT Pedido_IdPuntoVenta_fkey FOREIGN KEY (IdPuntoVenta) REFERENCES public.PuntoVenta(IdPuntoVenta) ON DELETE SET NULL,
  CONSTRAINT Pedido_IdUsuarioRepartidor_fkey FOREIGN KEY (IdUsuarioRepartidor) REFERENCES public.Usuario(IdUsuario),
  CONSTRAINT Pedido_IdEstadoPedido_fkey FOREIGN KEY (IdEstadoPedido) REFERENCES public.EstadoPedido(IdEstadoPedido),
  CONSTRAINT Pedido_IdAsignacionRuta_fkey FOREIGN KEY (IdAsignacionRuta) REFERENCES public.AsignacionRuta(IdAsignacionRuta) ON DELETE SET NULL
);

CREATE TABLE public.DetallePedido (
  IdDetallePedido bigint NOT NULL DEFAULT nextval('"DetallePedido_IdDetallePedido_seq"'::regclass),
  IdPedido bigint NOT NULL,
  IdPresentacion integer NOT NULL,
  Cantidad integer NOT NULL CHECK (Cantidad > 0),
  PrecioUnitarioAplicado numeric(10,2) NOT NULL,
  Subtotal numeric(12,2) NOT NULL,
  CONSTRAINT DetallePedido_pkey PRIMARY KEY (IdDetallePedido),
  CONSTRAINT DetallePedido_IdPedido_fkey FOREIGN KEY (IdPedido) REFERENCES public.Pedido(IdPedido) ON DELETE CASCADE,
  CONSTRAINT DetallePedido_IdPresentacion_fkey FOREIGN KEY (IdPresentacion) REFERENCES public.PresentacionProducto(IdPresentacion)
);

CREATE TABLE public.PagoPedido (
  IdPagoPedido bigint NOT NULL DEFAULT nextval('"PagoPedido_IdPagoPedido_seq"'::regclass),
  IdPedido bigint NOT NULL,
  IdMetodoPago integer NOT NULL,
  IdMovimientoCaja bigint,
  Monto numeric(12,2) NOT NULL CHECK (Monto > 0),
  FechaPago timestamp with time zone NOT NULL DEFAULT now(),
  NumeroReferencia text,
  LatitudCobro numeric(10,7),
  LongitudCobro numeric(10,7),
  IdMovilLocal text UNIQUE,
  Observacion text,
  CONSTRAINT PagoPedido_pkey PRIMARY KEY (IdPagoPedido),
  CONSTRAINT PagoPedido_IdPedido_fkey FOREIGN KEY (IdPedido) REFERENCES public.Pedido(IdPedido) ON DELETE CASCADE,
  CONSTRAINT PagoPedido_IdMetodoPago_fkey FOREIGN KEY (IdMetodoPago) REFERENCES public.MetodoPago(IdMetodoPago),
  CONSTRAINT PagoPedido_IdMovimientoCaja_fkey FOREIGN KEY (IdMovimientoCaja) REFERENCES public.MovimientoCaja(IdMovimientoCaja) ON DELETE SET NULL
);

CREATE TABLE public.SincronizacionMovil (
  IdSincronizacion bigint NOT NULL DEFAULT nextval('"SincronizacionMovil_IdSincronizacion_seq"'::regclass),
  IdUsuario integer NOT NULL,
  DeviceId text,
  FechaInicio timestamp with time zone NOT NULL DEFAULT now(),
  FechaFin timestamp with time zone,
  CantidadRegistrosSubidos integer NOT NULL DEFAULT 0,
  CantidadRegistrosDescargados integer NOT NULL DEFAULT 0,
  Estado text NOT NULL DEFAULT 'En Proceso',
  Detalle text,
  CONSTRAINT SincronizacionMovil_pkey PRIMARY KEY (IdSincronizacion),
  CONSTRAINT SincronizacionMovil_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);

CREATE TABLE public.NotaVenta (
  IdNotaVenta bigint NOT NULL DEFAULT nextval('"NotaVenta_IdNotaVenta_seq"'::regclass),
  NumeroNotaVenta text NOT NULL UNIQUE,
  NumeroNotaEntrega text,
  FechaVenta date NOT NULL DEFAULT CURRENT_DATE,
  IdCliente integer,
  ClienteNombreLibre text,
  DestinoDepartamento text NOT NULL DEFAULT 'Sucre',
  Chofer text,
  PlacaCamion text,
  CantidadCamiones numeric(10,4) DEFAULT 1,
  TotalVentaBruto numeric(12,2) NOT NULL DEFAULT 0,
  DescuentoBonificacion numeric(12,2) NOT NULL DEFAULT 0,
  Promocion numeric(12,2) NOT NULL DEFAULT 0,
  ImporteNeto numeric(12,2) NOT NULL DEFAULT 0,
  SaldoAnterior numeric(12,2) NOT NULL DEFAULT 0,
  TotalCancelado numeric(12,2) NOT NULL DEFAULT 0,
  SaldoPendiente numeric(12,2) NOT NULL DEFAULT 0,
  EstadoCobranza text NOT NULL DEFAULT 'Pendiente',
  Observacion text,
  FechaRegistro timestamp with time zone NOT NULL DEFAULT now(),
  IdUsuarioRegistro integer,
  CONSTRAINT NotaVenta_pkey PRIMARY KEY (IdNotaVenta),
  CONSTRAINT NotaVenta_IdCliente_fkey FOREIGN KEY (IdCliente) REFERENCES public.Cliente(IdCliente),
  CONSTRAINT NotaVenta_IdUsuarioRegistro_fkey FOREIGN KEY (IdUsuarioRegistro) REFERENCES public.Usuario(IdUsuario) ON DELETE SET NULL
);

CREATE TABLE public.DetalleNotaVenta (
  IdDetalleNotaVenta bigint NOT NULL DEFAULT nextval('"DetalleNotaVenta_IdDetalleNotaVenta_seq"'::regclass),
  IdNotaVenta bigint NOT NULL,
  IdPresentacion integer,
  NombreProducto text NOT NULL,
  Cantidad numeric(10,2) NOT NULL CHECK (Cantidad > 0),
  PrecioUnitario numeric(10,2) DEFAULT 0,
  Subtotal numeric(12,2) DEFAULT 0,
  CONSTRAINT DetalleNotaVenta_pkey PRIMARY KEY (IdDetalleNotaVenta),
  CONSTRAINT DetalleNotaVenta_IdNotaVenta_fkey FOREIGN KEY (IdNotaVenta) REFERENCES public.NotaVenta(IdNotaVenta) ON DELETE CASCADE,
  CONSTRAINT DetalleNotaVenta_IdPresentacion_fkey FOREIGN KEY (IdPresentacion) REFERENCES public.PresentacionProducto(IdPresentacion) ON DELETE SET NULL
);

CREATE TABLE public.EstadoCuentaCobrar (
  IdEstadoCuentaCobrar integer NOT NULL DEFAULT nextval('"EstadoCuentaCobrar_IdEstadoCuentaCobrar_seq"'::regclass),
  NombreEstado text NOT NULL UNIQUE,
  CONSTRAINT EstadoCuentaCobrar_pkey PRIMARY KEY (IdEstadoCuentaCobrar)
);

CREATE TABLE public.CuentaCobrar (
  IdCuentaCobrar bigint NOT NULL DEFAULT nextval('"CuentaCobrar_IdCuentaCobrar_seq"'::regclass),
  IdCliente integer NOT NULL,
  IdPedido bigint,
  IdNotaVenta bigint,
  NumeroNotaVenta text,
  NumeroNotaEntrega text,
  FechaDespacho date DEFAULT CURRENT_DATE,
  DiasMora integer DEFAULT 0,
  IdEstadoCuentaCobrar integer NOT NULL,
  MontoTotal numeric(12,2) NOT NULL CHECK (MontoTotal >= 0),
  SaldoPendiente numeric(12,2) NOT NULL CHECK (SaldoPendiente >= 0),
  FechaEmision date NOT NULL DEFAULT CURRENT_DATE,
  FechaVencimiento date,
  IdUsuarioRegistro integer,
  Observacion text,
  CONSTRAINT CuentaCobrar_pkey PRIMARY KEY (IdCuentaCobrar),
  CONSTRAINT chk_saldo_no_excede CHECK (SaldoPendiente <= MontoTotal),
  CONSTRAINT CuentaCobrar_IdCliente_fkey FOREIGN KEY (IdCliente) REFERENCES public.Cliente(IdCliente),
  CONSTRAINT CuentaCobrar_IdPedido_fkey FOREIGN KEY (IdPedido) REFERENCES public.Pedido(IdPedido) ON DELETE SET NULL,
  CONSTRAINT CuentaCobrar_IdNotaVenta_fkey FOREIGN KEY (IdNotaVenta) REFERENCES public.NotaVenta(IdNotaVenta) ON DELETE SET NULL,
  CONSTRAINT CuentaCobrar_IdEstadoCuentaCobrar_fkey FOREIGN KEY (IdEstadoCuentaCobrar) REFERENCES public.EstadoCuentaCobrar(IdEstadoCuentaCobrar),
  CONSTRAINT CuentaCobrar_IdUsuarioRegistro_fkey FOREIGN KEY (IdUsuarioRegistro) REFERENCES public.Usuario(IdUsuario)
);

CREATE TABLE public.PlanPago (
  IdPlanPago integer NOT NULL DEFAULT nextval('"PlanPago_IdPlanPago_seq"'::regclass),
  IdCuentaCobrar bigint NOT NULL,
  NumeroCuota integer NOT NULL,
  MontoSugerido numeric(12,2) NOT NULL,
  FechaProgramada date NOT NULL,
  Pagada boolean NOT NULL DEFAULT false,
  CONSTRAINT PlanPago_pkey PRIMARY KEY (IdPlanPago),
  CONSTRAINT PlanPago_IdCuentaCobrar_fkey FOREIGN KEY (IdCuentaCobrar) REFERENCES public.CuentaCobrar(IdCuentaCobrar) ON DELETE CASCADE
);

CREATE TABLE public.AbonoCuentaCobrar (
  IdAbonoCuentaCobrar bigint NOT NULL DEFAULT nextval('"AbonoCuentaCobrar_IdAbonoCuentaCobrar_seq"'::regclass),
  IdCuentaCobrar bigint NOT NULL,
  IdNotaVenta bigint,
  IdCuentaBancaria integer,
  IdMovimientoCaja bigint,
  IdMetodoPago integer,
  MontoAbonado numeric(12,2) NOT NULL CHECK (MontoAbonado > 0),
  FechaAbono timestamp with time zone NOT NULL DEFAULT now(),
  BancoSigla text,
  Depositante text,
  Moneda text DEFAULT 'BOB',
  MontoDolares numeric(12,2) DEFAULT 0,
  TipoCambio numeric(10,4) DEFAULT 1,
  IdUsuario integer,
  NumeroReferencia text,
  Observacion text,
  CONSTRAINT AbonoCuentaCobrar_pkey PRIMARY KEY (IdAbonoCuentaCobrar),
  CONSTRAINT AbonoCuentaCobrar_IdCuentaCobrar_fkey FOREIGN KEY (IdCuentaCobrar) REFERENCES public.CuentaCobrar(IdCuentaCobrar),
  CONSTRAINT AbonoCuentaCobrar_IdNotaVenta_fkey FOREIGN KEY (IdNotaVenta) REFERENCES public.NotaVenta(IdNotaVenta) ON DELETE SET NULL,
  CONSTRAINT AbonoCuentaCobrar_IdCuentaBancaria_fkey FOREIGN KEY (IdCuentaBancaria) REFERENCES public.CuentaBancariaEmpresa(IdCuentaBancaria) ON DELETE SET NULL,
  CONSTRAINT AbonoCuentaCobrar_IdMovimientoCaja_fkey FOREIGN KEY (IdMovimientoCaja) REFERENCES public.MovimientoCaja(IdMovimientoCaja) ON DELETE SET NULL,
  CONSTRAINT AbonoCuentaCobrar_IdMetodoPago_fkey FOREIGN KEY (IdMetodoPago) REFERENCES public.MetodoPago(IdMetodoPago),
  CONSTRAINT AbonoCuentaCobrar_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);

CREATE TABLE public.CuentaPagarProveedor (
  IdCuentaPagar bigint NOT NULL DEFAULT nextval('"CuentaPagarProveedor_IdCuentaPagar_seq"'::regclass),
  IdProveedor integer NOT NULL,
  FechaRecepcion date NOT NULL DEFAULT CURRENT_DATE,
  FechaEnvio date,
  NumeroNota text,
  NumeroFactura text,
  ConceptoMaterial text NOT NULL,
  PesoTotalKgr numeric(10,2) DEFAULT 0,
  CantidadUnidades numeric(10,2) DEFAULT 0,
  PrecioUnitario numeric(10,2) DEFAULT 0,
  Descuento numeric(12,2) DEFAULT 0,
  PrecioFacturado numeric(12,2) NOT NULL DEFAULT 0,
  TotalPagado numeric(12,2) NOT NULL DEFAULT 0,
  SaldoPendiente numeric(12,2) NOT NULL DEFAULT 0,
  Estado text NOT NULL DEFAULT 'PENDIENTE' CHECK (Estado IN ('PENDIENTE', 'PARCIAL', 'PAGADO', 'COMPENSADO', 'ANULADO')),
  FechaPago date,
  BancoPago text,
  Observacion text,
  FechaRegistro timestamp with time zone NOT NULL DEFAULT now(),
  IdUsuarioRegistro integer,
  CONSTRAINT CuentaPagarProveedor_pkey PRIMARY KEY (IdCuentaPagar),
  CONSTRAINT CuentaPagarProveedor_IdProveedor_fkey FOREIGN KEY (IdProveedor) REFERENCES public.Proveedor(IdProveedor),
  CONSTRAINT CuentaPagarProveedor_IdUsuarioRegistro_fkey FOREIGN KEY (IdUsuarioRegistro) REFERENCES public.Usuario(IdUsuario) ON DELETE SET NULL
);

CREATE TABLE public.DetalleInsumoCuentaPagar (
  IdDetalleInsumo bigint NOT NULL DEFAULT nextval('"DetalleInsumoCuentaPagar_IdDetalleInsumo_seq"'::regclass),
  IdCuentaPagar bigint NOT NULL,
  DescripcionInsumo text NOT NULL,
  MedidaOFormato text,
  Cantidad numeric(10,2) DEFAULT 0,
  PesoKgr numeric(10,2) DEFAULT 0,
  PrecioUnitario numeric(10,2) DEFAULT 0,
  Subtotal numeric(12,2) DEFAULT 0,
  CONSTRAINT DetalleInsumoCuentaPagar_pkey PRIMARY KEY (IdDetalleInsumo),
  CONSTRAINT DetalleInsumoCuentaPagar_IdCuentaPagar_fkey FOREIGN KEY (IdCuentaPagar) REFERENCES public.CuentaPagarProveedor(IdCuentaPagar) ON DELETE CASCADE
);

CREATE TABLE public.PagoCuentaPagar (
  IdPagoCuentaPagar bigint NOT NULL DEFAULT nextval('"PagoCuentaPagar_IdPagoCuentaPagar_seq"'::regclass),
  IdCuentaPagar bigint NOT NULL,
  IdCuentaBancaria integer,
  IdMovimientoCaja bigint,
  MontoPagado numeric(12,2) NOT NULL CHECK (MontoPagado > 0),
  FechaPago date NOT NULL DEFAULT CURRENT_DATE,
  BancoSigla text,
  NumeroTransaccion text,
  EsCompensacion boolean NOT NULL DEFAULT false,
  DetalleCompensacion text,
  Observacion text,
  FechaRegistro timestamp with time zone NOT NULL DEFAULT now(),
  IdUsuario integer,
  CONSTRAINT PagoCuentaPagar_pkey PRIMARY KEY (IdPagoCuentaPagar),
  CONSTRAINT PagoCuentaPagar_IdCuentaPagar_fkey FOREIGN KEY (IdCuentaPagar) REFERENCES public.CuentaPagarProveedor(IdCuentaPagar),
  CONSTRAINT PagoCuentaPagar_IdCuentaBancaria_fkey FOREIGN KEY (IdCuentaBancaria) REFERENCES public.CuentaBancariaEmpresa(IdCuentaBancaria) ON DELETE SET NULL,
  CONSTRAINT PagoCuentaPagar_IdMovimientoCaja_fkey FOREIGN KEY (IdMovimientoCaja) REFERENCES public.MovimientoCaja(IdMovimientoCaja) ON DELETE SET NULL,
  CONSTRAINT PagoCuentaPagar_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario) ON DELETE SET NULL
);

CREATE TABLE public.DevolucionProveedor (
  IdDevolucionProveedor integer NOT NULL DEFAULT nextval('"DevolucionProveedor_IdDevolucionProveedor_seq"'::regclass),
  IdProveedor integer NOT NULL,
  FechaDevolucion date NOT NULL DEFAULT CURRENT_DATE,
  ProductoMaterial text NOT NULL,
  Motivo text,
  TotalPesoKgr numeric(10,2) DEFAULT 0,
  TotalPaquetes integer DEFAULT 0,
  Observacion text,
  FechaRegistro timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT DevolucionProveedor_pkey PRIMARY KEY (IdDevolucionProveedor),
  CONSTRAINT DevolucionProveedor_IdProveedor_fkey FOREIGN KEY (IdProveedor) REFERENCES public.Proveedor(IdProveedor)
);

CREATE TABLE public.RendicionRuta (
  IdRendicionRuta bigint NOT NULL DEFAULT nextval('"RendicionRuta_IdRendicionRuta_seq"'::regclass),
  IdUsuarioRepartidor integer NOT NULL,
  IdAperturaCierreCaja integer NOT NULL,
  IdAsignacionRuta bigint,
  FechaRendicion timestamp with time zone NOT NULL DEFAULT now(),
  MontoTotalCobradoRuta numeric(12,2) NOT NULL DEFAULT 0,
  MontoEfectivoEntregado numeric(12,2) NOT NULL DEFAULT 0,
  MontoTransferenciaReportada numeric(12,2) NOT NULL DEFAULT 0,
  MontoQrReportado numeric(12,2) NOT NULL DEFAULT 0,
  Diferencia numeric(12,2) GENERATED ALWAYS AS (MontoTotalCobradoRuta - MontoEfectivoEntregado - MontoTransferenciaReportada - MontoQrReportado) STORED,
  Conciliada boolean NOT NULL DEFAULT false,
  IdUsuarioAprueba integer,
  IdMovimientoCaja bigint,
  Observacion text,
  CONSTRAINT RendicionRuta_pkey PRIMARY KEY (IdRendicionRuta),
  CONSTRAINT RendicionRuta_IdUsuarioRepartidor_fkey FOREIGN KEY (IdUsuarioRepartidor) REFERENCES public.Usuario(IdUsuario),
  CONSTRAINT RendicionRuta_IdAperturaCierreCaja_fkey FOREIGN KEY (IdAperturaCierreCaja) REFERENCES public.AperturaCierreCaja(IdAperturaCierreCaja),
  CONSTRAINT RendicionRuta_IdAsignacionRuta_fkey FOREIGN KEY (IdAsignacionRuta) REFERENCES public.AsignacionRuta(IdAsignacionRuta) ON DELETE SET NULL,
  CONSTRAINT RendicionRuta_IdUsuarioAprueba_fkey FOREIGN KEY (IdUsuarioAprueba) REFERENCES public.Usuario(IdUsuario) ON DELETE SET NULL,
  CONSTRAINT RendicionRuta_IdMovimientoCaja_fkey FOREIGN KEY (IdMovimientoCaja) REFERENCES public.MovimientoCaja(IdMovimientoCaja) ON DELETE SET NULL
);

CREATE TABLE public.ConfiguracionLaboral (
  IdConfiguracionLaboral integer NOT NULL DEFAULT nextval('"ConfiguracionLaboral_IdConfiguracionLaboral_seq"'::regclass),
  Parametro text NOT NULL UNIQUE,
  Valor numeric NOT NULL,
  Descripcion text,
  FechaActualizacion timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ConfiguracionLaboral_pkey PRIMARY KEY (IdConfiguracionLaboral)
);

CREATE TABLE public.PeriodoNomina (
  IdPeriodoNomina integer NOT NULL DEFAULT nextval('"PeriodoNomina_IdPeriodoNomina_seq"'::regclass),
  Mes integer NOT NULL CHECK (Mes BETWEEN 1 AND 12),
  Anio integer NOT NULL,
  FechaInicio date NOT NULL,
  FechaFin date NOT NULL,
  Cerrado boolean NOT NULL DEFAULT false,
  CONSTRAINT PeriodoNomina_pkey PRIMARY KEY (IdPeriodoNomina),
  CONSTRAINT uq_periodo_mes_anio UNIQUE (Mes, Anio)
);

CREATE TABLE public.DatosLaboralesEmpleado (
  IdUsuario integer NOT NULL,
  SueldoBasico numeric(12,2) NOT NULL DEFAULT 0 CHECK (SueldoBasico >= 0),
  FechaIngreso date NOT NULL DEFAULT CURRENT_DATE,
  PorcentajeComisionDefault numeric(5,2) DEFAULT 0,
  CuentaBancaria text,
  Banco text,
  Cargo text,
  Activo boolean NOT NULL DEFAULT true,
  CONSTRAINT DatosLaboralesEmpleado_pkey PRIMARY KEY (IdUsuario),
  CONSTRAINT DatosLaboralesEmpleado_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario) ON DELETE CASCADE
);

CREATE TABLE public.MarcaBiometrica (
  IdMarcaBiometrica bigint NOT NULL DEFAULT nextval('"MarcaBiometrica_IdMarcaBiometrica_seq"'::regclass),
  IdUsuario integer NOT NULL,
  FechaHoraMarca timestamp with time zone NOT NULL,
  TipoMarca text NOT NULL CHECK (TipoMarca IN ('Entrada', 'Salida')),
  OrigenDatos text DEFAULT 'Biometrico',
  FechaImportacion timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT MarcaBiometrica_pkey PRIMARY KEY (IdMarcaBiometrica),
  CONSTRAINT MarcaBiometrica_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);

CREATE TABLE public.AsistenciaDiaria (
  IdAsistenciaDiaria bigint NOT NULL DEFAULT nextval('"AsistenciaDiaria_IdAsistenciaDiaria_seq"'::regclass),
  IdUsuario integer NOT NULL,
  IdTurno integer,
  Fecha date NOT NULL,
  HoraEntrada time without time zone,
  HoraSalida time without time zone,
  MinutosAtraso integer NOT NULL DEFAULT 0,
  HorasExtraTrabajadas numeric(5,2) NOT NULL DEFAULT 0,
  EsFalta boolean NOT NULL DEFAULT false,
  FaltaJustificada boolean NOT NULL DEFAULT false,
  Observacion text,
  CONSTRAINT AsistenciaDiaria_pkey PRIMARY KEY (IdAsistenciaDiaria),
  CONSTRAINT uq_asistencia_usuario_fecha UNIQUE (IdUsuario, Fecha),
  CONSTRAINT AsistenciaDiaria_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario),
  CONSTRAINT AsistenciaDiaria_IdTurno_fkey FOREIGN KEY (IdTurno) REFERENCES public.Turno(IdTurno) ON DELETE SET NULL
);

CREATE TABLE public.ComisionReparto (
  IdComisionReparto bigint NOT NULL DEFAULT nextval('"ComisionReparto_IdComisionReparto_seq"'::regclass),
  IdUsuario integer NOT NULL,
  IdPeriodoNomina integer NOT NULL,
  IdRendicionRuta bigint,
  MontoVentaCobrada numeric(12,2) NOT NULL,
  PorcentajeComision numeric(5,2) NOT NULL,
  MontoComision numeric(12,2) NOT NULL,
  FechaCalculo timestamp with time zone NOT NULL DEFAULT now(),
  Observacion text,
  CONSTRAINT ComisionReparto_pkey PRIMARY KEY (IdComisionReparto),
  CONSTRAINT ComisionReparto_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario),
  CONSTRAINT ComisionReparto_IdPeriodoNomina_fkey FOREIGN KEY (IdPeriodoNomina) REFERENCES public.PeriodoNomina(IdPeriodoNomina),
  CONSTRAINT ComisionReparto_IdRendicionRuta_fkey FOREIGN KEY (IdRendicionRuta) REFERENCES public.RendicionRuta(IdRendicionRuta) ON DELETE SET NULL
);

CREATE TABLE public.Planilla (
  IdPlanilla integer NOT NULL DEFAULT nextval('"Planilla_IdPlanilla_seq"'::regclass),
  IdPeriodoNomina integer NOT NULL,
  IdUsuarioGenera integer NOT NULL,
  FechaGeneracion timestamp with time zone NOT NULL DEFAULT now(),
  TotalSueldoBruto numeric(12,2) NOT NULL DEFAULT 0,
  TotalDeducciones numeric(12,2) NOT NULL DEFAULT 0,
  TotalLiquido numeric(12,2) NOT NULL DEFAULT 0,
  Aprobada boolean NOT NULL DEFAULT false,
  IdUsuarioAprueba integer,
  FechaAprobacion timestamp with time zone,
  Observacion text,
  CONSTRAINT Planilla_pkey PRIMARY KEY (IdPlanilla),
  CONSTRAINT Planilla_IdPeriodoNomina_fkey FOREIGN KEY (IdPeriodoNomina) REFERENCES public.PeriodoNomina(IdPeriodoNomina),
  CONSTRAINT Planilla_IdUsuarioGenera_fkey FOREIGN KEY (IdUsuarioGenera) REFERENCES public.Usuario(IdUsuario),
  CONSTRAINT Planilla_IdUsuarioAprueba_fkey FOREIGN KEY (IdUsuarioAprueba) REFERENCES public.Usuario(IdUsuario) ON DELETE SET NULL
);

CREATE TABLE public.DetallePlanilla (
  IdDetallePlanilla bigint NOT NULL DEFAULT nextval('"DetallePlanilla_IdDetallePlanilla_seq"'::regclass),
  IdPlanilla integer NOT NULL,
  IdUsuario integer NOT NULL,
  SueldoBasico numeric(12,2) NOT NULL DEFAULT 0,
  MontoHorasExtra numeric(12,2) NOT NULL DEFAULT 0,
  MontoComisiones numeric(12,2) NOT NULL DEFAULT 0,
  TotalBonos numeric(12,2) NOT NULL DEFAULT 0,
  DescuentoAtrasos numeric(12,2) NOT NULL DEFAULT 0,
  DescuentoFaltas numeric(12,2) NOT NULL DEFAULT 0,
  AporteAFP numeric(12,2) NOT NULL DEFAULT 0,
  OtrasDeducciones numeric(12,2) NOT NULL DEFAULT 0,
  TotalGanado numeric(12,2) NOT NULL DEFAULT 0,
  TotalDescuento numeric(12,2) NOT NULL DEFAULT 0,
  LiquidoPagable numeric(12,2) NOT NULL DEFAULT 0,
  Observacion text,
  CONSTRAINT DetallePlanilla_pkey PRIMARY KEY (IdDetallePlanilla),
  CONSTRAINT uq_detalle_planilla_usuario UNIQUE (IdPlanilla, IdUsuario),
  CONSTRAINT DetallePlanilla_IdPlanilla_fkey FOREIGN KEY (IdPlanilla) REFERENCES public.Planilla(IdPlanilla) ON DELETE CASCADE,
  CONSTRAINT DetallePlanilla_IdUsuario_fkey FOREIGN KEY (IdUsuario) REFERENCES public.Usuario(IdUsuario)
);
```
