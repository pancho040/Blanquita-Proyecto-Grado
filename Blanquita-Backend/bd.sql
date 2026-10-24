CREATE TABLE "Turno" (
  "IdTurno" SERIAL PRIMARY KEY,
  "NombreTurno" TEXT NOT NULL,
  "HoraInicio" TIME NOT NULL,
  "HoraFin" TIME NOT NULL,
  "DescripcionTurno" TEXT
);

CREATE TABLE "Rol" (
  "IdRol" SERIAL PRIMARY KEY,
  "NombreRol" TEXT NOT NULL,
  "Descripcion" TEXT
);

CREATE TABLE "EstadoUsuario" (
  "IdEstadoUsuario" SERIAL PRIMARY KEY,
  "NombreEstadoUsuario" TEXT NOT NULL,
  "DescripcionEstadoUsuario" TEXT
);

CREATE TABLE "Usuario" (
  "IdUsuario" SERIAL PRIMARY KEY,
  "AuthUserId" UUID NOT NULL UNIQUE REFERENCES auth."users"("id") ON DELETE RESTRICT,
  "IdRol" INTEGER NOT NULL REFERENCES "Rol"("IdRol") ON DELETE RESTRICT,
  "IdEstadoUsuario" INTEGER NOT NULL REFERENCES "EstadoUsuario"("IdEstadoUsuario") ON DELETE RESTRICT,
  "Ci" TEXT UNIQUE NOT NULL,
  "PrimerNombre" TEXT NOT NULL,
  "SegundoNombre" TEXT,
  "ApellidoPaterno" TEXT NOT NULL,
  "ApellidoMaterno" TEXT,
  "Celular" TEXT,
  "IsAdmin" BOOLEAN NOT NULL DEFAULT FALSE,
  "FechaRegistro" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "chk_usuario_celular" CHECK ("Celular" IS NULL OR "Celular" ~ '^[67][0-9]{7}$')
);

CREATE TABLE "Proveedor" (
  "IdProveedor" SERIAL PRIMARY KEY,
  "NombreProveedor" TEXT NOT NULL,
  "CelularProveedor" TEXT,
  "CorreoProveedor" TEXT,
  "Activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX "idx_proveedor_activo" ON "Proveedor"("Activo");

CREATE TABLE "TipoBobina" (
  "IdTipoBobina" SERIAL PRIMARY KEY,
  "NombreTipoBobina" TEXT NOT NULL,
  "DiametroMm" NUMERIC NOT NULL DEFAULT 1210,
  "Formato" NUMERIC NOT NULL DEFAULT 2760,
  "TaraKg" NUMERIC NOT NULL DEFAULT 38,
  "Descripcion" TEXT,
  "Activo" BOOLEAN NOT NULL DEFAULT true,
  "StockMinimo" INTEGER,
  "StockPreventivo" INTEGER,
  CONSTRAINT "ck_tipobobina_stockminimo" CHECK ("StockMinimo" IS NULL OR "StockMinimo" >= 0),
  CONSTRAINT "ck_tipobobina_umbrales_completos" CHECK (num_nonnulls("StockMinimo", "StockPreventivo") IN (0, 2)),
  CONSTRAINT "ck_tipobobina_umbrales_orden" CHECK ("StockPreventivo" IS NULL OR "StockPreventivo" > "StockMinimo")
);

CREATE TABLE "EstadoMateriaPrima" (
  "IdEstadoMateriaPrima" SERIAL PRIMARY KEY,
  "TipoEstado" TEXT NOT NULL
);

CREATE TABLE "LoteBobina" (
  "IdLoteBobina" SERIAL PRIMARY KEY,
  "IdProveedor" INTEGER NOT NULL REFERENCES "Proveedor"("IdProveedor") ON DELETE CASCADE,
  "IdUsuario" INTEGER REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "FechaRecepcion" DATE NOT NULL
);

CREATE TABLE "BobinaPapel" (
  "IdBobinaPapel" SERIAL PRIMARY KEY,
  "CodigoBobina" TEXT UNIQUE NOT NULL,
  "IdTipoBobina" INTEGER NOT NULL REFERENCES "TipoBobina"("IdTipoBobina") ON DELETE CASCADE,
  "IdLoteBobina" INTEGER NOT NULL REFERENCES "LoteBobina"("IdLoteBobina") ON DELETE CASCADE,
  "IdEstadoMateriaPrima" INTEGER NOT NULL REFERENCES "EstadoMateriaPrima"("IdEstadoMateriaPrima") ON DELETE CASCADE,
  "PesoBrutoKg" NUMERIC,
  "Gramaje" NUMERIC,
  "PesoNetoKg" NUMERIC
);
CREATE INDEX "idx_bobina_tipo_estado" ON "BobinaPapel"("IdTipoBobina", "IdEstadoMateriaPrima");

CREATE TABLE "TipoBobinaServilleta" (
  "IdTipoBobinaServilleta" SERIAL PRIMARY KEY,
  "NombreTipoBobinaServilleta" TEXT NOT NULL,
  "DiametroMm" NUMERIC NOT NULL DEFAULT 1210,
  "CrepadoPorcentaje" NUMERIC NOT NULL DEFAULT 14,
  "ResistenciaKgf" NUMERIC NOT NULL DEFAULT 1.35,
  "Descripcion" TEXT,
  "CantidadUnidades" INTEGER NOT NULL DEFAULT 1,
  "Activo" BOOLEAN NOT NULL DEFAULT true,
  "StockMinimo" INTEGER,
  "StockPreventivo" INTEGER,
  CONSTRAINT "ck_tipobobinaservilleta_unidades" CHECK ("CantidadUnidades" > 0),
  CONSTRAINT "ck_tipobobinaservilleta_stockminimo" CHECK ("StockMinimo" IS NULL OR "StockMinimo" >= 0),
  CONSTRAINT "ck_tipobobinaservilleta_umbrales_completos" CHECK (num_nonnulls("StockMinimo", "StockPreventivo") IN (0, 2)),
  CONSTRAINT "ck_tipobobinaservilleta_umbrales_orden" CHECK ("StockPreventivo" IS NULL OR "StockPreventivo" > "StockMinimo")
);

CREATE TABLE "FormatoSubBobina" (
  "IdFormatoSubBobina" SERIAL PRIMARY KEY,
  "DescripcionFormato" TEXT NOT NULL,
  "Activo" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "uq_formatosubbobina_descripcion" UNIQUE ("DescripcionFormato")
);

CREATE TABLE "TipoMedidaSubBobina" (
  "IdTipoMedidaSubBobina" SERIAL PRIMARY KEY,
  "MedidaMm" INTEGER NOT NULL,
  "Descripcion" TEXT,
  "Activo" BOOLEAN NOT NULL DEFAULT true,
  "StockMinimo" INTEGER,
  "StockPreventivo" INTEGER,
  CONSTRAINT "uq_tipomedidasubbobina_medida" UNIQUE ("MedidaMm"),
  CONSTRAINT "ck_tipomedidasubbobina_medida" CHECK ("MedidaMm" > 0),
  CONSTRAINT "ck_tipomedidasubbobina_stockminimo" CHECK ("StockMinimo" IS NULL OR "StockMinimo" >= 0),
  CONSTRAINT "ck_tipomedidasubbobina_umbrales_completos" CHECK (num_nonnulls("StockMinimo", "StockPreventivo") IN (0, 2)),
  CONSTRAINT "ck_tipomedidasubbobina_umbrales_orden" CHECK ("StockPreventivo" IS NULL OR "StockPreventivo" > "StockMinimo")
);

CREATE TABLE "FormatoSubBobinaDetalle" (
  "IdFormatoSubBobinaDetalle" SERIAL PRIMARY KEY,
  "IdFormatoSubBobina" INTEGER NOT NULL REFERENCES "FormatoSubBobina"("IdFormatoSubBobina") ON DELETE RESTRICT,
  "IdTipoMedidaSubBobina" INTEGER NOT NULL REFERENCES "TipoMedidaSubBobina"("IdTipoMedidaSubBobina") ON DELETE RESTRICT,
  "Cantidad" INTEGER NOT NULL,
  CONSTRAINT "uq_formatodetalle_formato_medida" UNIQUE ("IdFormatoSubBobina", "IdTipoMedidaSubBobina"),
  CONSTRAINT "ck_formatodetalle_cantidad" CHECK ("Cantidad" > 0)
);

CREATE TABLE "TipoBobinaServilletaFormato" (
  "IdTipoBobinaServilletaFormato" SERIAL PRIMARY KEY,
  "IdTipoBobinaServilleta" INTEGER NOT NULL REFERENCES "TipoBobinaServilleta"("IdTipoBobinaServilleta") ON DELETE RESTRICT,
  "IdFormatoSubBobina" INTEGER NOT NULL REFERENCES "FormatoSubBobina"("IdFormatoSubBobina") ON DELETE RESTRICT,
  CONSTRAINT "uq_tipoformato_tipo_formato" UNIQUE ("IdTipoBobinaServilleta", "IdFormatoSubBobina")
);

CREATE TABLE "LoteBobinaServilleta" (
  "IdLoteBobinaServilleta" SERIAL PRIMARY KEY,
  "IdProveedor" INTEGER NOT NULL REFERENCES "Proveedor"("IdProveedor") ON DELETE CASCADE,
  "IdUsuario" INTEGER REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "FechaRecepcion" DATE NOT NULL
);

CREATE TABLE "BobinaServilleta" (
  "IdBobinaServilleta" SERIAL PRIMARY KEY,
  "IdLoteBobinaServilleta" INTEGER NOT NULL REFERENCES "LoteBobinaServilleta"("IdLoteBobinaServilleta") ON DELETE CASCADE,
  "IdTipoBobinaServilleta" INTEGER NOT NULL REFERENCES "TipoBobinaServilleta"("IdTipoBobinaServilleta") ON DELETE CASCADE,
  "IdEstadoMateriaPrima" INTEGER NOT NULL REFERENCES "EstadoMateriaPrima"("IdEstadoMateriaPrima") ON DELETE CASCADE
);
CREATE INDEX "idx_bobinaserv_tipo" ON "BobinaServilleta"("IdTipoBobinaServilleta");
CREATE INDEX "idx_bobinaserv_estado" ON "BobinaServilleta"("IdEstadoMateriaPrima");

CREATE TABLE "UnidadBobinaServilleta" (
  "IdUnidadBobinaServilleta" SERIAL PRIMARY KEY,
  "IdBobinaServilleta" INTEGER NOT NULL REFERENCES "BobinaServilleta"("IdBobinaServilleta") ON DELETE CASCADE,
  "IdFormatoSubBobina" INTEGER NOT NULL REFERENCES "FormatoSubBobina"("IdFormatoSubBobina") ON DELETE CASCADE,
  "CodigoBobina" TEXT UNIQUE NOT NULL,
  "PesoBrutoKg" NUMERIC,
  "GramajeGr" NUMERIC
);
CREATE INDEX "idx_unidbobserv_bobserv" ON "UnidadBobinaServilleta"("IdBobinaServilleta");
CREATE INDEX "idx_unidbobserv_formato" ON "UnidadBobinaServilleta"("IdFormatoSubBobina");

CREATE TABLE "SubBobinaServilleta" (
  "IdSubBobinaServilleta" SERIAL PRIMARY KEY,
  "IdUnidadBobinaServilleta" INTEGER NOT NULL REFERENCES "UnidadBobinaServilleta"("IdUnidadBobinaServilleta") ON DELETE CASCADE,
  "IdTipoMedidaSubBobina" INTEGER NOT NULL REFERENCES "TipoMedidaSubBobina"("IdTipoMedidaSubBobina") ON DELETE CASCADE,
  "IdEstadoMateriaPrima" INTEGER NOT NULL REFERENCES "EstadoMateriaPrima"("IdEstadoMateriaPrima") ON DELETE CASCADE
);
CREATE INDEX "idx_subbobina_unidad" ON "SubBobinaServilleta"("IdUnidadBobinaServilleta");
CREATE INDEX "idx_subbobina_estado" ON "SubBobinaServilleta"("IdEstadoMateriaPrima");

CREATE TABLE "LoteEmpaque" (
  "IdLoteEmpaque" SERIAL PRIMARY KEY,
  "IdProveedor" INTEGER NOT NULL REFERENCES "Proveedor"("IdProveedor") ON DELETE CASCADE,
  "IdUsuario" INTEGER REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "FechaRecepcion" DATE NOT NULL,
  "CantidadToneladasPedida" NUMERIC
);

CREATE TABLE "TipoEmpaque" (
  "IdTipoEmpaque" SERIAL PRIMARY KEY,
  "NombreTipoEmpaque" TEXT NOT NULL,
  "Activo" BOOLEAN NOT NULL DEFAULT true,
  "StockMinimo" INTEGER,
  "StockPreventivo" INTEGER,
  CONSTRAINT "ck_tipoempaque_stockminimo" CHECK ("StockMinimo" IS NULL OR "StockMinimo" >= 0),
  CONSTRAINT "ck_tipoempaque_umbrales_completos" CHECK (num_nonnulls("StockMinimo", "StockPreventivo") IN (0, 2)),
  CONSTRAINT "ck_tipoempaque_umbrales_orden" CHECK ("StockPreventivo" IS NULL OR "StockPreventivo" > "StockMinimo")
);

CREATE TABLE "Empaque" (
  "IdEmpaque" SERIAL PRIMARY KEY,
  "IdTipoEmpaque" INTEGER NOT NULL REFERENCES "TipoEmpaque"("IdTipoEmpaque") ON DELETE CASCADE,
  "IdLoteEmpaque" INTEGER NOT NULL REFERENCES "LoteEmpaque"("IdLoteEmpaque") ON DELETE CASCADE,
  "IdEstadoMateriaPrima" INTEGER NOT NULL REFERENCES "EstadoMateriaPrima"("IdEstadoMateriaPrima") ON DELETE CASCADE,
  "PesoKg" NUMERIC,
  "CodigoEmpaque" TEXT UNIQUE NOT NULL
);
CREATE INDEX "idx_empaque_estado" ON "Empaque"("IdEstadoMateriaPrima");

CREATE TABLE "LoteRodela" (
  "IdLoteRodela" SERIAL PRIMARY KEY,
  "IdProveedor" INTEGER NOT NULL REFERENCES "Proveedor"("IdProveedor") ON DELETE CASCADE,
  "IdUsuario" INTEGER REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "FechaRecepcion" DATE NOT NULL
);

CREATE TABLE "TipoRodela" (
  "IdTipoRodela" SERIAL PRIMARY KEY,
  "NombreTipoRodela" TEXT NOT NULL,
  "Descripcion" TEXT,
  "Activo" BOOLEAN NOT NULL DEFAULT true,
  "StockMinimo" INTEGER,
  "StockPreventivo" INTEGER,
  CONSTRAINT "ck_tiporodela_stockminimo" CHECK ("StockMinimo" IS NULL OR "StockMinimo" >= 0),
  CONSTRAINT "ck_tiporodela_umbrales_completos" CHECK (num_nonnulls("StockMinimo", "StockPreventivo") IN (0, 2)),
  CONSTRAINT "ck_tiporodela_umbrales_orden" CHECK ("StockPreventivo" IS NULL OR "StockPreventivo" > "StockMinimo")
);

CREATE TABLE "Rodela" (
  "IdRodela" SERIAL PRIMARY KEY,
  "IdLoteRodela" INTEGER NOT NULL REFERENCES "LoteRodela"("IdLoteRodela") ON DELETE CASCADE,
  "IdEstadoMateriaPrima" INTEGER NOT NULL REFERENCES "EstadoMateriaPrima"("IdEstadoMateriaPrima") ON DELETE CASCADE,
  "IdTipoRodela" INTEGER NOT NULL REFERENCES "TipoRodela"("IdTipoRodela") ON DELETE CASCADE,
  "CodigoRodela" TEXT UNIQUE NOT NULL
);
CREATE INDEX "idx_rodela_estado" ON "Rodela"("IdEstadoMateriaPrima");

CREATE TABLE "TipoMovimientoMateriaPrima" (
  "IdTipoMovimiento" SERIAL PRIMARY KEY,
  "NombreMovimiento" TEXT NOT NULL,
  "AplicaA" TEXT NOT NULL,
  "DescripcionTipoMovimientoMateriaPrima" TEXT
);

CREATE TABLE "MovimientoBobina" (
  "IdMovimientoBobina" SERIAL PRIMARY KEY,
  "IdBobinaPapel" INTEGER NOT NULL REFERENCES "BobinaPapel"("IdBobinaPapel") ON DELETE CASCADE,
  "IdTipoMovimiento" INTEGER NOT NULL REFERENCES "TipoMovimientoMateriaPrima"("IdTipoMovimiento") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "FechaMovimiento" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Observacion" TEXT
);
CREATE INDEX "idx_movbobina_bobina_fecha" ON "MovimientoBobina"("IdBobinaPapel", "FechaMovimiento" DESC);

CREATE TABLE "MovimientoRodela" (
  "IdMovimientoRodela" SERIAL PRIMARY KEY,
  "IdRodela" INTEGER NOT NULL REFERENCES "Rodela"("IdRodela") ON DELETE CASCADE,
  "IdTipoMovimiento" INTEGER NOT NULL REFERENCES "TipoMovimientoMateriaPrima"("IdTipoMovimiento") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "FechaMovimiento" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Observacion" TEXT
);
CREATE INDEX "idx_movrodela_rodela_fecha" ON "MovimientoRodela"("IdRodela", "FechaMovimiento" DESC);

CREATE TABLE "MovimientoBobinaServilleta" (
  "IdMovimientoBobinaServilleta" SERIAL PRIMARY KEY,
  "IdBobinaServilleta" INTEGER NOT NULL REFERENCES "BobinaServilleta"("IdBobinaServilleta") ON DELETE CASCADE,
  "IdTipoMovimiento" INTEGER NOT NULL REFERENCES "TipoMovimientoMateriaPrima"("IdTipoMovimiento") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "FechaMovimiento" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Observacion" TEXT
);
CREATE INDEX "idx_movbobinaservilleta_bobina_fecha" ON "MovimientoBobinaServilleta"("IdBobinaServilleta", "FechaMovimiento" DESC);

CREATE TABLE "MovimientoSubBobina" (
  "IdMovimientoSubBobina" SERIAL PRIMARY KEY,
  "IdSubBobinaServilleta" INTEGER NOT NULL REFERENCES "SubBobinaServilleta"("IdSubBobinaServilleta") ON DELETE CASCADE,
  "IdTipoMovimiento" INTEGER NOT NULL REFERENCES "TipoMovimientoMateriaPrima"("IdTipoMovimiento") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "FechaMovimiento" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Observacion" TEXT
);
CREATE INDEX "idx_movsubbobina_subbobina_fecha" ON "MovimientoSubBobina"("IdSubBobinaServilleta", "FechaMovimiento" DESC);

CREATE TABLE "MovimientoEmpaque" (
  "IdMovimientoEmpaque" SERIAL PRIMARY KEY,
  "IdEmpaque" INTEGER NOT NULL REFERENCES "Empaque"("IdEmpaque") ON DELETE CASCADE,
  "IdTipoMovimiento" INTEGER NOT NULL REFERENCES "TipoMovimientoMateriaPrima"("IdTipoMovimiento") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "FechaMovimiento" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Observacion" TEXT
);
CREATE INDEX "idx_movempaque_empaque_fecha" ON "MovimientoEmpaque"("IdEmpaque", "FechaMovimiento" DESC);

CREATE TABLE "EstadoProduccion" (
  "IdEstadoProduccion" SERIAL PRIMARY KEY,
  "NombreEstadoProduccion" TEXT NOT NULL,
  "DescripcionEstadoProduccion" TEXT
);

CREATE TABLE "ProduccionBobinaTubo" (
  "IdProduccionBobinaTubo" SERIAL PRIMARY KEY,
  "IdEstadoProduccion" INTEGER NOT NULL REFERENCES "EstadoProduccion"("IdEstadoProduccion") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "IdBobina_1" INTEGER NOT NULL REFERENCES "BobinaPapel"("IdBobinaPapel") ON DELETE CASCADE,
  "IdBobina_2" INTEGER NOT NULL REFERENCES "BobinaPapel"("IdBobinaPapel") ON DELETE CASCADE,
  "IdTurno" INTEGER NOT NULL REFERENCES "Turno"("IdTurno") ON DELETE CASCADE,
  "IdProducto" INTEGER NOT NULL,
  "FechaInicioProduccion" TIMESTAMPTZ NOT NULL,
  "FechaFinProduccion" TIMESTAMPTZ,
  "CantidadLogsActual" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "idx_prodbobinatubo_turno" ON "ProduccionBobinaTubo"("IdTurno");
CREATE INDEX "idx_prodbobinatubo_estado" ON "ProduccionBobinaTubo"("IdEstadoProduccion");
CREATE INDEX "idx_prodbobinatubo_producto" ON "ProduccionBobinaTubo"("IdProducto");

CREATE TABLE "ProduccionServilleta" (
  "IdProduccionServilleta" SERIAL PRIMARY KEY,
  "IdEstadoProduccion" INTEGER NOT NULL REFERENCES "EstadoProduccion"("IdEstadoProduccion") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "IdSubBobina" INTEGER NOT NULL REFERENCES "SubBobinaServilleta"("IdSubBobinaServilleta") ON DELETE CASCADE,
  "IdTurno" INTEGER NOT NULL REFERENCES "Turno"("IdTurno") ON DELETE CASCADE,
  "FechaInicioProduccion" TIMESTAMPTZ NOT NULL,
  "FechaFinProduccion" TIMESTAMPTZ
);
CREATE INDEX "idx_prodservilleta_turno" ON "ProduccionServilleta"("IdTurno");
CREATE INDEX "idx_prodservilleta_estado" ON "ProduccionServilleta"("IdEstadoProduccion");
CREATE INDEX "idx_prodservilleta_subbobina" ON "ProduccionServilleta"("IdSubBobina");

CREATE TABLE "PausaProduccionBobinaTubo" (
  "IdPausaProduccionBobinaTubo" SERIAL PRIMARY KEY,
  "IdProduccionBobinaTubo" INTEGER NOT NULL REFERENCES "ProduccionBobinaTubo"("IdProduccionBobinaTubo") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "FechaHoraPausa" TIMESTAMPTZ NOT NULL,
  "MotivoPausaProduccion" TEXT,
  "FechaHoraReanudacion" TIMESTAMPTZ,
  "MotivoReanudacion" TEXT
);
CREATE INDEX "idx_pausabobinatubo_fecha" ON "PausaProduccionBobinaTubo"("FechaHoraPausa");
CREATE INDEX IF NOT EXISTS "idx_pausabobinatubo_produccion"
  ON "PausaProduccionBobinaTubo"("IdProduccionBobinaTubo");

CREATE TABLE "PausaProduccionServilleta" (
  "IdPausaProduccionServilleta" SERIAL PRIMARY KEY,
  "IdProduccionServilleta" INTEGER NOT NULL REFERENCES "ProduccionServilleta"("IdProduccionServilleta") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "FechaHoraPausa" TIMESTAMPTZ NOT NULL,
  "MotivoPausaProduccion" TEXT,
  "FechaHoraReanudacion" TIMESTAMPTZ,
  "MotivoReanudacion" TEXT
);
CREATE INDEX "idx_pausaservilleta_fecha" ON "PausaProduccionServilleta"("FechaHoraPausa");

CREATE TABLE "Producto" (
  "IdProducto" SERIAL PRIMARY KEY,
  "NombreProducto" TEXT NOT NULL,
  "SiglasProducto" TEXT NOT NULL,
  "IdTipoBobina" INTEGER REFERENCES "TipoBobina"("IdTipoBobina") ON DELETE RESTRICT,
  "IdTipoBobinaServilleta" INTEGER REFERENCES "TipoBobinaServilleta"("IdTipoBobinaServilleta") ON DELETE RESTRICT,
  "Activo" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "uq_producto_nombre" UNIQUE ("NombreProducto"),
  CONSTRAINT "uq_producto_siglas" UNIQUE ("SiglasProducto"),
  CONSTRAINT "ck_producto_siglas" CHECK ("SiglasProducto" ~ '^[A-Z]{3}$'),
  CONSTRAINT "ck_producto_un_tipo" CHECK (num_nonnulls("IdTipoBobina", "IdTipoBobinaServilleta") <= 1)
);

ALTER TABLE "ProduccionBobinaTubo"
ADD CONSTRAINT "fk_prodbobinatubo_producto"
FOREIGN KEY ("IdProducto") REFERENCES "Producto"("IdProducto") ON DELETE RESTRICT;

CREATE TABLE "PresentacionProducto" (
  "IdPresentacion" SERIAL PRIMARY KEY,
  "IdProducto" INTEGER NOT NULL REFERENCES "Producto"("IdProducto") ON DELETE CASCADE,
  "TipoContenedor" TEXT NOT NULL,
  "CantidadRollosUnidades" INTEGER,
  "CantidadPorUnidadTerminada" INTEGER,
  "CodigoPresentacion" TEXT UNIQUE NOT NULL,
  "Activo" BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX "idx_presentacion_producto" ON "PresentacionProducto"("IdProducto");

CREATE TABLE "TipoMovimientoInventario" (
  "IdTipoMovimientoInventario" SERIAL PRIMARY KEY,
  "NombreTipoMovimientoInventario" TEXT NOT NULL,
  "DescripcionTipoMovimientoInventario" TEXT
);

CREATE TABLE "MovimientoProductoTerminado" (
  "IdMovimientoProductoTerminado" SERIAL PRIMARY KEY,
  "IdTipoMovimientoInventario" INTEGER NOT NULL REFERENCES "TipoMovimientoInventario"("IdTipoMovimientoInventario") ON DELETE CASCADE,
  "IdPresentacion" INTEGER NOT NULL REFERENCES "PresentacionProducto"("IdPresentacion") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "CantidadIngresoInventario" NUMERIC NOT NULL,
  "FechaMovimiento" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Observacion" TEXT
);
CREATE INDEX "idx_movprodterm_presentacion_fecha" ON "MovimientoProductoTerminado"("IdPresentacion", "FechaMovimiento" DESC);
CREATE INDEX "idx_movprodterm_fecha" ON "MovimientoProductoTerminado"("FechaMovimiento");

CREATE TABLE "InventarioProductoTerminado" (
  "IdPresentacion" INTEGER PRIMARY KEY REFERENCES "PresentacionProducto"("IdPresentacion") ON DELETE CASCADE,
  "CantidadActual" NUMERIC NOT NULL DEFAULT 0,
  "StockMinimo" INTEGER,
  "StockPreventivo" INTEGER,
  CONSTRAINT "ck_invpt_stockminimo" CHECK ("StockMinimo" IS NULL OR "StockMinimo" >= 0),
  CONSTRAINT "ck_invpt_umbrales_completos" CHECK (num_nonnulls("StockMinimo", "StockPreventivo") IN (0, 2)),
  CONSTRAINT "ck_invpt_umbrales_orden" CHECK ("StockPreventivo" IS NULL OR "StockPreventivo" > "StockMinimo")
);

CREATE TABLE "BloqueoProductoTerminado" (
  "IdBloqueoProductoTerminado" SERIAL PRIMARY KEY,
  "IdUsuarioBloqueo" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "FechaHoraBloqueo" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "MotivoBloqueo" TEXT NOT NULL,
  "IdUsuarioDesbloqueo" INTEGER REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "FechaHoraDesbloqueo" TIMESTAMPTZ,
  "BloqueaIngreso" BOOLEAN NOT NULL DEFAULT true,
  "BloqueaCorreccion" BOOLEAN NOT NULL DEFAULT true,
  "BloqueaSalida" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ck_bloqueopt_algun_movimiento" CHECK ("BloqueaIngreso" OR "BloqueaCorreccion" OR "BloqueaSalida"),
  CONSTRAINT "ck_bloqueopt_desbloqueo_completo" CHECK (num_nonnulls("IdUsuarioDesbloqueo", "FechaHoraDesbloqueo") IN (0, 2)),
  CONSTRAINT "ck_bloqueopt_orden" CHECK ("FechaHoraDesbloqueo" IS NULL OR "FechaHoraDesbloqueo" >= "FechaHoraBloqueo")
);
CREATE UNIQUE INDEX "uq_bloqueopt_activo" ON "BloqueoProductoTerminado"((true)) WHERE "FechaHoraDesbloqueo" IS NULL;
CREATE INDEX "idx_bloqueopt_fecha" ON "BloqueoProductoTerminado"("FechaHoraBloqueo");

CREATE TABLE "TipoInsumo" (
  "IdTipoInsumo" SERIAL PRIMARY KEY,
  "NombreInsumo" TEXT NOT NULL,
  "DescripcionInsumo" TEXT,
  "Activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "MovimientoInsumo" (
  "IdMovimientoInsumo" SERIAL PRIMARY KEY,
  "IdTipoInsumo" INTEGER NOT NULL REFERENCES "TipoInsumo"("IdTipoInsumo") ON DELETE CASCADE,
  "IdTipoMovimiento" INTEGER NOT NULL REFERENCES "TipoMovimientoMateriaPrima"("IdTipoMovimiento") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "CantidadMovimiento" NUMERIC,
  "FechaMovimiento" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Observacion" TEXT
);
CREATE INDEX "idx_movinsumo_tipo_fecha" ON "MovimientoInsumo"("IdTipoInsumo", "FechaMovimiento" DESC);

CREATE TABLE "InventarioInsumo" (
  "IdInventarioInsumo" SERIAL PRIMARY KEY,
  "IdTipoInsumo" INTEGER NOT NULL REFERENCES "TipoInsumo"("IdTipoInsumo") ON DELETE CASCADE,
  "CantidadActual" NUMERIC NOT NULL DEFAULT 0,
  "StockMinimo" INTEGER,
  "StockPreventivo" INTEGER,
  CONSTRAINT "ck_invinsumo_stockminimo" CHECK ("StockMinimo" IS NULL OR "StockMinimo" >= 0),
  CONSTRAINT "ck_invinsumo_umbrales_completos" CHECK (num_nonnulls("StockMinimo", "StockPreventivo") IN (0, 2)),
  CONSTRAINT "ck_invinsumo_umbrales_orden" CHECK ("StockPreventivo" IS NULL OR "StockPreventivo" > "StockMinimo")
);

CREATE TABLE "TipoEmpaqueBolsa" (
  "IdTipoEmpaqueBolsa" SERIAL PRIMARY KEY,
  "NombreEmpaqueBolsa" TEXT NOT NULL,
  "DescripcionEmpaqueBolsa" TEXT,
  "Activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "MovimientoEmpaqueBolsa" (
  "IdMovimientoEmpaqueBolsa" SERIAL PRIMARY KEY,
  "IdTipoEmpaqueBolsa" INTEGER NOT NULL REFERENCES "TipoEmpaqueBolsa"("IdTipoEmpaqueBolsa") ON DELETE CASCADE,
  "IdLoteEmpaque" INTEGER REFERENCES "LoteEmpaque"("IdLoteEmpaque") ON DELETE CASCADE,
  "IdTipoMovimiento" INTEGER NOT NULL REFERENCES "TipoMovimientoMateriaPrima"("IdTipoMovimiento") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "CantidadMovimiento" NUMERIC NOT NULL,
  "FechaMovimiento" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Observacion" TEXT
);
CREATE INDEX "idx_movempaquebolsa_tipo_fecha" ON "MovimientoEmpaqueBolsa"("IdTipoEmpaqueBolsa", "FechaMovimiento" DESC);
CREATE INDEX "idx_movempaquebolsa_lote" ON "MovimientoEmpaqueBolsa"("IdLoteEmpaque");

ALTER TABLE "MovimientoEmpaqueBolsa"
ADD CONSTRAINT chk_lote_solo_ingreso
CHECK ("IdTipoMovimiento" <> 1 OR "IdLoteEmpaque" IS NOT NULL);

CREATE TABLE "InventarioEmpaqueBolsa" (
  "IdInventarioEmpaqueBolsa" SERIAL PRIMARY KEY,
  "IdTipoEmpaqueBolsa" INTEGER NOT NULL REFERENCES "TipoEmpaqueBolsa"("IdTipoEmpaqueBolsa") ON DELETE CASCADE,
  "CantidadActual" NUMERIC NOT NULL DEFAULT 0,
  "StockMinimo" INTEGER,
  "StockPreventivo" INTEGER,
  CONSTRAINT "ck_invempaquebolsa_stockminimo" CHECK ("StockMinimo" IS NULL OR "StockMinimo" >= 0),
  CONSTRAINT "ck_invempaquebolsa_umbrales_completos" CHECK (num_nonnulls("StockMinimo", "StockPreventivo") IN (0, 2)),
  CONSTRAINT "ck_invempaquebolsa_umbrales_orden" CHECK ("StockPreventivo" IS NULL OR "StockPreventivo" > "StockMinimo")
);

CREATE TABLE "TipoBolsaJava" (
  "IdTipoBolsaJava" SERIAL PRIMARY KEY,
  "NombreBolsaJava" TEXT NOT NULL,
  "DescripcionBolsaJava" TEXT,
  "Activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "MovimientoBolsaJava" (
  "IdMovimientoBolsaJava" SERIAL PRIMARY KEY,
  "IdTipoBolsaJava" INTEGER NOT NULL REFERENCES "TipoBolsaJava"("IdTipoBolsaJava") ON DELETE CASCADE,
  "IdLoteEmpaque" INTEGER REFERENCES "LoteEmpaque"("IdLoteEmpaque") ON DELETE CASCADE,
  "IdTipoMovimiento" INTEGER NOT NULL REFERENCES "TipoMovimientoMateriaPrima"("IdTipoMovimiento") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "CantidadMovimiento" NUMERIC,
  "FechaMovimiento" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Observacion" TEXT
);
CREATE INDEX "idx_movbolsajava_tipo_fecha" ON "MovimientoBolsaJava"("IdTipoBolsaJava", "FechaMovimiento" DESC);
CREATE INDEX "idx_movbolsajava_lote" ON "MovimientoBolsaJava"("IdLoteEmpaque");

ALTER TABLE "MovimientoBolsaJava"
ADD CONSTRAINT chk_lote_solo_ingreso_bolsajava
CHECK ("IdTipoMovimiento" <> 1 OR "IdLoteEmpaque" IS NOT NULL);

CREATE TABLE "InventarioBolsaJava" (
  "IdInventarioBolsaJava" SERIAL PRIMARY KEY,
  "IdTipoBolsaJava" INTEGER NOT NULL REFERENCES "TipoBolsaJava"("IdTipoBolsaJava") ON DELETE CASCADE,
  "CantidadActual" NUMERIC NOT NULL DEFAULT 0,
  "StockMinimo" INTEGER,
  "StockPreventivo" INTEGER,
  CONSTRAINT "ck_invbolsajava_stockminimo" CHECK ("StockMinimo" IS NULL OR "StockMinimo" >= 0),
  CONSTRAINT "ck_invbolsajava_umbrales_completos" CHECK (num_nonnulls("StockMinimo", "StockPreventivo") IN (0, 2)),
  CONSTRAINT "ck_invbolsajava_umbrales_orden" CHECK ("StockPreventivo" IS NULL OR "StockPreventivo" > "StockMinimo")
);

CREATE TABLE "TipoMovimientoOperadorLogs" (
  "IdTipoMovimientoOperadorLogs" SERIAL PRIMARY KEY,
  "NombreMovimiento" TEXT NOT NULL,
  "DescripcionTipoMovimientoOperadorLogs" TEXT
);

CREATE TABLE "MovimientoOperadorLogs" (
  "IdMovimientoOperadorLogs" SERIAL PRIMARY KEY,
  "IdProduccionBobinaTubo" INTEGER NOT NULL REFERENCES "ProduccionBobinaTubo"("IdProduccionBobinaTubo") ON DELETE CASCADE,
  "IdTipoMovimientoOperadorLogs" INTEGER NOT NULL REFERENCES "TipoMovimientoOperadorLogs"("IdTipoMovimientoOperadorLogs") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "CantidadLogs" INTEGER NOT NULL,
  "FechaMovimiento" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Observacion" TEXT
);
CREATE INDEX "idx_movoperlogs_produccion_fecha" ON "MovimientoOperadorLogs"("IdProduccionBobinaTubo", "FechaMovimiento" DESC);
CREATE INDEX "idx_movoperlogs_tipo" ON "MovimientoOperadorLogs"("IdTipoMovimientoOperadorLogs");

CREATE TABLE "CancelacionProduccionBobinaTubo" (
  "IdCancelacionProduccionBobinaTubo" SERIAL PRIMARY KEY,
  "IdProduccionBobinaTubo" INTEGER NOT NULL REFERENCES "ProduccionBobinaTubo"("IdProduccionBobinaTubo") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "FechaHoraCancelacion" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "MotivoCancelacion" TEXT
);
CREATE INDEX "idx_cancelbobinatubo_produccion" ON "CancelacionProduccionBobinaTubo"("IdProduccionBobinaTubo");

CREATE TABLE "CancelacionProduccionServilleta" (
  "IdCancelacionProduccionServilleta" SERIAL PRIMARY KEY,
  "IdProduccionServilleta" INTEGER NOT NULL REFERENCES "ProduccionServilleta"("IdProduccionServilleta") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "FechaHoraCancelacion" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "MotivoCancelacion" TEXT
);
CREATE INDEX "idx_cancelservilleta_produccion" ON "CancelacionProduccionServilleta"("IdProduccionServilleta");

CREATE TABLE "HistorialAdmin" (
  "IdHistorialAdmin" SERIAL PRIMARY KEY,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "Observacion" TEXT NOT NULL,
  "FechaMovimiento" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "idx_historialadmin_fecha" ON "HistorialAdmin"("FechaMovimiento" DESC);

CREATE TABLE "RegistroIngreso" (
  "IdRegistroIngreso" SERIAL PRIMARY KEY,
  "IdUsuario" INTEGER REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "Registro" TEXT NOT NULL,
  "CiIntentado" TEXT,
  "Detalle" TEXT,
  "DireccionIp" TEXT,
  "UserAgent" TEXT,
  "FechaRegistro" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "chk_registroingreso_registro" CHECK ("Registro" IN ('Ingreso', 'Salida', 'Intento fallido')),
  CONSTRAINT "chk_registroingreso_identificacion" CHECK ("IdUsuario" IS NOT NULL OR "CiIntentado" IS NOT NULL)
);
CREATE INDEX "idx_registroingreso_usuario_fecha" ON "RegistroIngreso"("IdUsuario", "FechaRegistro" DESC);
CREATE INDEX "idx_registroingreso_fecha" ON "RegistroIngreso"("FechaRegistro" DESC);
