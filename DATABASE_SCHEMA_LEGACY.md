# Esquema de Base de Datos (Referencia / Legacy DDL)

> **Nota para Agentes y Desarrolladores:**  
> Este documento contiene la estructura DDL en PostgreSQL del esquema proporcionado como contexto.  
> *Aviso:* Conforme a la delimitación actual del proyecto de grado para **Shema Asociados S.R.L. ("Blanquita")**, los módulos de manufactura y control de materia prima (tales como `BobinaPapel`, `SubBobinaServilleta`, `Rodela`, `LoteBobina`, etc.) quedan fuera del alcance operativo, priorizando los módulos de **Seguridad**, **Administración y Contabilidad**, **Recursos Humanos / Biométrico**, **Logística y Distribución Móvil**, y **Reportes/Dashboards**.

---

## Estructura de Tablas SQL (DDL)

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
```
