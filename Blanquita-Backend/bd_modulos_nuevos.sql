-- =============================================================================
-- PAPEL BLANQUITA - EXTENSIÓN DE BASE DE DATOS
-- Módulos: Seguridad/Auditoría, Tesorería, RRHH, Logística, Ventas/Móvil
-- =============================================================================
-- IMPORTANTE: Este script no modifica ni elimina ninguna tabla ni columna preexistente.
-- Solo crea nuevas tablas, nuevos índices, nuevos roles y datos semilla.
-- =============================================================================

-- =============================================================================
-- 0. ACTUALIZACIÓN DE ROLES (Idempotente)
-- =============================================================================
INSERT INTO "Rol" ("IdRol", "NombreRol", "Descripcion") VALUES
  (3, 'Gerente General', 'Acceso total a dashboards, reportes ejecutivos, aprobaciones y configuración del sistema'),
  (4, 'Contador', 'Gestión de tesorería, caja, cuentas por cobrar, planillas y conciliaciones contables'),
  (5, 'Supervisor', 'Supervisión de logística, monitoreo de rutas, auditoría y desempeño de repartidores'),
  (6, 'Agente de Reparto', 'Registro de pedidos/ventas en ruta, cobros y sincronización móvil')
ON CONFLICT ("IdRol") DO NOTHING;

-- Sincronizar el valor de la secuencia para evitar colisiones futuras
SELECT setval('public."Rol_IdRol_seq"', (SELECT MAX("IdRol") FROM "Rol"));


-- =============================================================================
-- 1. MÓDULO: SEGURIDAD Y AUDITORÍA (RF-01, RF-02, RF-03, RN-04)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "IdAuditLog" BIGSERIAL PRIMARY KEY,
  "IdUsuario" INTEGER REFERENCES "Usuario"("IdUsuario") ON DELETE SET NULL,
  "Accion" TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'ANULACION', 'LOGIN', etc.
  "TablaAfectada" TEXT NOT NULL,
  "IdRegistroAfectado" TEXT,
  "DatosAnteriores" JSONB,
  "DatosNuevos" JSONB,
  "DireccionIp" TEXT,
  "FechaHora" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Detalle" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_audit_usuario" ON "AuditLog"("IdUsuario");
CREATE INDEX IF NOT EXISTS "idx_audit_tabla_fecha" ON "AuditLog"("TablaAfectada", "FechaHora" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_fecha" ON "AuditLog"("FechaHora" DESC);


-- =============================================================================
-- 2. MÓDULO: TESORERÍA - CAJA Y MOVIMIENTOS (RF-04, RF-05, RN-03, RN-04)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "Caja" (
  "IdCaja" SERIAL PRIMARY KEY,
  "NombreCaja" TEXT NOT NULL,
  "Descripcion" TEXT,
  "Activa" BOOLEAN NOT NULL DEFAULT TRUE,
  "FechaCreacion" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "EstadoAperturaCaja" (
  "IdEstadoAperturaCaja" SERIAL PRIMARY KEY,
  "NombreEstado" TEXT NOT NULL UNIQUE -- 'Abierta', 'Cerrada', 'Cerrada con Diferencia'
);

CREATE TABLE IF NOT EXISTS "AperturaCierreCaja" (
  "IdAperturaCierreCaja" SERIAL PRIMARY KEY,
  "IdCaja" INTEGER NOT NULL REFERENCES "Caja"("IdCaja") ON DELETE RESTRICT,
  "IdUsuarioApertura" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "IdUsuarioCierre" INTEGER REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "IdUsuarioAutorizaCierre" INTEGER REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "IdEstadoAperturaCaja" INTEGER NOT NULL REFERENCES "EstadoAperturaCaja"("IdEstadoAperturaCaja") ON DELETE RESTRICT,
  "FechaApertura" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "SaldoInicial" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "FechaCierre" TIMESTAMPTZ,
  "SaldoTeorico" NUMERIC(12,2),
  "SaldoReal" NUMERIC(12,2),
  "Diferencia" NUMERIC(12,2),
  "Observacion" TEXT,
  CONSTRAINT "chk_cierre_diferencia" CHECK (
    "FechaCierre" IS NULL OR "SaldoReal" IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS "idx_apcaja_fecha" ON "AperturaCierreCaja"("FechaApertura" DESC);
CREATE INDEX IF NOT EXISTS "idx_apcaja_caja" ON "AperturaCierreCaja"("IdCaja");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_caja_abierta" ON "AperturaCierreCaja"("IdCaja") WHERE ("FechaCierre" IS NULL);

CREATE TABLE IF NOT EXISTS "CategoriaMovimientoCaja" (
  "IdCategoriaMovimientoCaja" SERIAL PRIMARY KEY,
  "NombreCategoria" TEXT NOT NULL UNIQUE,
  "TipoMovimiento" TEXT NOT NULL CHECK ("TipoMovimiento" IN ('Ingreso', 'Egreso')),
  "Descripcion" TEXT
);

CREATE TABLE IF NOT EXISTS "MovimientoCaja" (
  "IdMovimientoCaja" BIGSERIAL PRIMARY KEY,
  "IdAperturaCierreCaja" INTEGER NOT NULL REFERENCES "AperturaCierreCaja"("IdAperturaCierreCaja") ON DELETE RESTRICT,
  "IdCategoriaMovimientoCaja" INTEGER NOT NULL REFERENCES "CategoriaMovimientoCaja"("IdCategoriaMovimientoCaja") ON DELETE RESTRICT,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "Monto" NUMERIC(12,2) NOT NULL CHECK ("Monto" > 0),
  "MetodoPago" TEXT NOT NULL DEFAULT 'Efectivo' CHECK ("MetodoPago" IN ('Efectivo', 'Transferencia', 'QR')),
  "NumeroReferencia" TEXT,
  "FechaMovimiento" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Descripcion" TEXT,
  "Anulado" BOOLEAN NOT NULL DEFAULT FALSE,
  "IdMovimientoCajaAnulacion" BIGINT REFERENCES "MovimientoCaja"("IdMovimientoCaja")
);

CREATE INDEX IF NOT EXISTS "idx_movcaja_apertura" ON "MovimientoCaja"("IdAperturaCierreCaja");
CREATE INDEX IF NOT EXISTS "idx_movcaja_fecha" ON "MovimientoCaja"("FechaMovimiento" DESC);
CREATE INDEX IF NOT EXISTS "idx_movcaja_categoria" ON "MovimientoCaja"("IdCategoriaMovimientoCaja");


-- =============================================================================
-- 3. MÓDULO: LOGÍSTICA, CLIENTES Y RUTAS (RF-12, RF-13, RF-17)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "EstadoCliente" (
  "IdEstadoCliente" SERIAL PRIMARY KEY,
  "NombreEstado" TEXT NOT NULL UNIQUE -- 'Activo', 'Inactivo', 'Bloqueado por Mora'
);

CREATE TABLE IF NOT EXISTS "Cliente" (
  "IdCliente" SERIAL PRIMARY KEY,
  "IdEstadoCliente" INTEGER NOT NULL DEFAULT 1 REFERENCES "EstadoCliente"("IdEstadoCliente") ON DELETE RESTRICT,
  "RazonSocial" TEXT NOT NULL,
  "NombreComercial" TEXT,
  "NitCi" TEXT NOT NULL,
  "Telefono" TEXT,
  "CorreoElectronico" TEXT,
  "Direccion" TEXT,
  "Latitud" NUMERIC(10,7),
  "Longitud" NUMERIC(10,7),
  "LimiteCreditoBs" NUMERIC(12,2) DEFAULT 0,
  "DiasCredito" INTEGER DEFAULT 0,
  "BloqueadoPorMora" BOOLEAN NOT NULL DEFAULT FALSE,
  "FechaRegistro" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "IdUsuarioRegistro" INTEGER REFERENCES "Usuario"("IdUsuario") ON DELETE SET NULL,
  "Observacion" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_cliente_estado" ON "Cliente"("IdEstadoCliente");
CREATE INDEX IF NOT EXISTS "idx_cliente_nitci" ON "Cliente"("NitCi");

CREATE TABLE IF NOT EXISTS "PuntoVenta" (
  "IdPuntoVenta" SERIAL PRIMARY KEY,
  "IdCliente" INTEGER NOT NULL REFERENCES "Cliente"("IdCliente") ON DELETE CASCADE,
  "NombrePuntoVenta" TEXT NOT NULL,
  "Direccion" TEXT NOT NULL,
  "Latitud" NUMERIC(10,7),
  "Longitud" NUMERIC(10,7),
  "Referencia" TEXT,
  "Activo" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS "idx_puntoventa_cliente" ON "PuntoVenta"("IdCliente");

CREATE TABLE IF NOT EXISTS "ZonaDistribucion" (
  "IdZonaDistribucion" SERIAL PRIMARY KEY,
  "NombreZona" TEXT NOT NULL UNIQUE,
  "Ciudad" TEXT DEFAULT 'Sucre',
  "Descripcion" TEXT,
  "Activa" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "RutaDistribucion" (
  "IdRutaDistribucion" SERIAL PRIMARY KEY,
  "IdZonaDistribucion" INTEGER NOT NULL REFERENCES "ZonaDistribucion"("IdZonaDistribucion") ON DELETE RESTRICT,
  "NombreRuta" TEXT NOT NULL,
  "DiaSemana" INTEGER CHECK ("DiaSemana" BETWEEN 1 AND 7), -- 1=Lunes, 7=Domingo
  "Descripcion" TEXT,
  "Activa" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS "idx_ruta_zona" ON "RutaDistribucion"("IdZonaDistribucion");

CREATE TABLE IF NOT EXISTS "RutaPuntoVenta" (
  "IdRutaPuntoVenta" SERIAL PRIMARY KEY,
  "IdRutaDistribucion" INTEGER NOT NULL REFERENCES "RutaDistribucion"("IdRutaDistribucion") ON DELETE CASCADE,
  "IdPuntoVenta" INTEGER NOT NULL REFERENCES "PuntoVenta"("IdPuntoVenta") ON DELETE CASCADE,
  "OrdenVisita" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "uq_ruta_puntoventa" UNIQUE ("IdRutaDistribucion", "IdPuntoVenta")
);

CREATE INDEX IF NOT EXISTS "idx_rutapuntoventa_ruta_orden" ON "RutaPuntoVenta"("IdRutaDistribucion", "OrdenVisita");

CREATE TABLE IF NOT EXISTS "AsignacionRuta" (
  "IdAsignacionRuta" BIGSERIAL PRIMARY KEY,
  "IdRutaDistribucion" INTEGER NOT NULL REFERENCES "RutaDistribucion"("IdRutaDistribucion") ON DELETE RESTRICT,
  "IdUsuarioRepartidor" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "FechaAsignacion" DATE NOT NULL DEFAULT CURRENT_DATE,
  "IdUsuarioAsigna" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "Estado" TEXT NOT NULL DEFAULT 'Pendiente' CHECK ("Estado" IN ('Pendiente', 'En Ruta', 'Finalizada', 'Cancelada')),
  "KilometrajeInicial" NUMERIC(10,2),
  "KilometrajeFinal" NUMERIC(10,2),
  "Observacion" TEXT,
  CONSTRAINT "uq_asignacion_ruta_fecha" UNIQUE ("IdRutaDistribucion", "IdUsuarioRepartidor", "FechaAsignacion")
);

CREATE INDEX IF NOT EXISTS "idx_asignruta_repartidor_fecha" ON "AsignacionRuta"("IdUsuarioRepartidor", "FechaAsignacion");

-- Control de inventario en camión para venta directa
CREATE TABLE IF NOT EXISTS "CargaInventarioRuta" (
  "IdCargaInventarioRuta" BIGSERIAL PRIMARY KEY,
  "IdAsignacionRuta" BIGINT NOT NULL REFERENCES "AsignacionRuta"("IdAsignacionRuta") ON DELETE CASCADE,
  "IdPresentacion" INTEGER NOT NULL REFERENCES "PresentacionProducto"("IdPresentacion") ON DELETE RESTRICT,
  "CantidadCargada" NUMERIC(10,2) NOT NULL CHECK ("CantidadCargada" >= 0),
  "CantidadVendida" NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK ("CantidadVendida" >= 0),
  "CantidadDevuelta" NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK ("CantidadDevuelta" >= 0),
  "Diferencia" NUMERIC(10,2) GENERATED ALWAYS AS ("CantidadCargada" - "CantidadVendida" - "CantidadDevuelta") STORED,
  "FechaCarga" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "IdUsuarioDespacha" INTEGER REFERENCES "Usuario"("IdUsuario") ON DELETE SET NULL,
  "Observacion" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_cargainv_asignacion" ON "CargaInventarioRuta"("IdAsignacionRuta");


-- =============================================================================
-- 4. MÓDULO: VENTAS, PRECIOS Y MÓVIL OFFLINE (RF-14, RF-15, RF-16, RF-17, RNF-01)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "PrecioProducto" (
  "IdPrecioProducto" SERIAL PRIMARY KEY,
  "IdPresentacion" INTEGER NOT NULL REFERENCES "PresentacionProducto"("IdPresentacion") ON DELETE CASCADE,
  "PrecioUnitario" NUMERIC(10,2) NOT NULL CHECK ("PrecioUnitario" >= 0),
  "PrecioMayorista" NUMERIC(10,2) CHECK ("PrecioMayorista" >= 0),
  "CantidadMinimaMayorista" INTEGER DEFAULT 10,
  "VigenteDesde" DATE NOT NULL DEFAULT CURRENT_DATE,
  "VigenteHasta" DATE,
  "Activo" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS "idx_precio_presentacion" ON "PrecioProducto"("IdPresentacion");

CREATE TABLE IF NOT EXISTS "EstadoPedido" (
  "IdEstadoPedido" SERIAL PRIMARY KEY,
  "NombreEstado" TEXT NOT NULL UNIQUE -- 'Pendiente', 'En Camino', 'Entregado', 'Cancelado', 'Parcialmente Entregado'
);

CREATE TABLE IF NOT EXISTS "MetodoPago" (
  "IdMetodoPago" SERIAL PRIMARY KEY,
  "NombreMetodoPago" TEXT NOT NULL UNIQUE -- 'Efectivo', 'Transferencia', 'QR', 'Crédito'
);

CREATE TABLE IF NOT EXISTS "Pedido" (
  "IdPedido" BIGSERIAL PRIMARY KEY,
  "NumeroPedido" TEXT UNIQUE,
  "IdCliente" INTEGER NOT NULL REFERENCES "Cliente"("IdCliente") ON DELETE RESTRICT,
  "IdPuntoVenta" INTEGER REFERENCES "PuntoVenta"("IdPuntoVenta") ON DELETE SET NULL,
  "IdUsuarioRepartidor" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "IdEstadoPedido" INTEGER NOT NULL REFERENCES "EstadoPedido"("IdEstadoPedido") ON DELETE RESTRICT,
  "IdAsignacionRuta" BIGINT REFERENCES "AsignacionRuta"("IdAsignacionRuta") ON DELETE SET NULL,
  "FechaPedido" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "FechaEntrega" TIMESTAMPTZ,
  "EsVentaDirecta" BOOLEAN NOT NULL DEFAULT FALSE,
  "SubTotal" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "Descuento" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "MontoTotal" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "LatitudEntrega" NUMERIC(10,7),
  "LongitudEntrega" NUMERIC(10,7),
  "SincronizadoDesdeMovil" BOOLEAN NOT NULL DEFAULT FALSE,
  "IdMovilLocal" TEXT UNIQUE, -- UUID local del móvil para garantizar idempotencia y evitar duplicados
  "Observacion" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_pedido_cliente" ON "Pedido"("IdCliente");
CREATE INDEX IF NOT EXISTS "idx_pedido_repartidor_fecha" ON "Pedido"("IdUsuarioRepartidor", "FechaPedido" DESC);
CREATE INDEX IF NOT EXISTS "idx_pedido_estado" ON "Pedido"("IdEstadoPedido");

CREATE TABLE IF NOT EXISTS "DetallePedido" (
  "IdDetallePedido" BIGSERIAL PRIMARY KEY,
  "IdPedido" BIGINT NOT NULL REFERENCES "Pedido"("IdPedido") ON DELETE CASCADE,
  "IdPresentacion" INTEGER NOT NULL REFERENCES "PresentacionProducto"("IdPresentacion") ON DELETE RESTRICT,
  "Cantidad" INTEGER NOT NULL CHECK ("Cantidad" > 0),
  "PrecioUnitarioAplicado" NUMERIC(10,2) NOT NULL,
  "Subtotal" NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_detpedido_pedido" ON "DetallePedido"("IdPedido");

CREATE TABLE IF NOT EXISTS "PagoPedido" (
  "IdPagoPedido" BIGSERIAL PRIMARY KEY,
  "IdPedido" BIGINT NOT NULL REFERENCES "Pedido"("IdPedido") ON DELETE CASCADE,
  "IdMetodoPago" INTEGER NOT NULL REFERENCES "MetodoPago"("IdMetodoPago") ON DELETE RESTRICT,
  "IdMovimientoCaja" BIGINT REFERENCES "MovimientoCaja"("IdMovimientoCaja") ON DELETE SET NULL,
  "Monto" NUMERIC(12,2) NOT NULL CHECK ("Monto" > 0),
  "FechaPago" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "NumeroReferencia" TEXT,
  "LatitudCobro" NUMERIC(10,7),
  "LongitudCobro" NUMERIC(10,7),
  "IdMovilLocal" TEXT UNIQUE,
  "Observacion" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_pagopedido_pedido" ON "PagoPedido"("IdPedido");

CREATE TABLE IF NOT EXISTS "SincronizacionMovil" (
  "IdSincronizacion" BIGSERIAL PRIMARY KEY,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "DeviceId" TEXT,
  "FechaInicio" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "FechaFin" TIMESTAMPTZ,
  "CantidadRegistrosSubidos" INTEGER NOT NULL DEFAULT 0,
  "CantidadRegistrosDescargados" INTEGER NOT NULL DEFAULT 0,
  "Estado" TEXT NOT NULL DEFAULT 'En Proceso' CHECK ("Estado" IN ('En Proceso', 'Completada', 'Error')),
  "Detalle" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_sincro_usuario" ON "SincronizacionMovil"("IdUsuario");


-- =============================================================================
-- 5. MÓDULO: CUENTAS POR COBRAR Y RENDICIÓN DE RUTA (RF-06, RF-07, RN-01, RN-02)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "EstadoCuentaCobrar" (
  "IdEstadoCuentaCobrar" SERIAL PRIMARY KEY,
  "NombreEstado" TEXT NOT NULL UNIQUE -- 'Vigente', 'Vencida', 'Pagada', 'Bloqueada', 'Anulada'
);

CREATE TABLE IF NOT EXISTS "CuentaCobrar" (
  "IdCuentaCobrar" BIGSERIAL PRIMARY KEY,
  "IdCliente" INTEGER NOT NULL REFERENCES "Cliente"("IdCliente") ON DELETE RESTRICT,
  "IdPedido" BIGINT REFERENCES "Pedido"("IdPedido") ON DELETE SET NULL,
  "IdEstadoCuentaCobrar" INTEGER NOT NULL REFERENCES "EstadoCuentaCobrar"("IdEstadoCuentaCobrar") ON DELETE RESTRICT,
  "MontoTotal" NUMERIC(12,2) NOT NULL CHECK ("MontoTotal" >= 0),
  "SaldoPendiente" NUMERIC(12,2) NOT NULL,
  "FechaEmision" DATE NOT NULL DEFAULT CURRENT_DATE,
  "FechaVencimiento" DATE NOT NULL,
  "IdUsuarioRegistro" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "Observacion" TEXT,
  CONSTRAINT "chk_saldo_no_negativo" CHECK ("SaldoPendiente" >= 0),
  CONSTRAINT "chk_saldo_no_excede" CHECK ("SaldoPendiente" <= "MontoTotal")
);

CREATE INDEX IF NOT EXISTS "idx_cxc_cliente" ON "CuentaCobrar"("IdCliente");
CREATE INDEX IF NOT EXISTS "idx_cxc_estado" ON "CuentaCobrar"("IdEstadoCuentaCobrar");
CREATE INDEX IF NOT EXISTS "idx_cxc_vencimiento" ON "CuentaCobrar"("FechaVencimiento");

CREATE TABLE IF NOT EXISTS "PlanPago" (
  "IdPlanPago" SERIAL PRIMARY KEY,
  "IdCuentaCobrar" BIGINT NOT NULL REFERENCES "CuentaCobrar"("IdCuentaCobrar") ON DELETE CASCADE,
  "NumeroCuota" INTEGER NOT NULL,
  "MontoSugerido" NUMERIC(12,2) NOT NULL,
  "FechaProgramada" DATE NOT NULL,
  "Pagada" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS "idx_planpago_cxc" ON "PlanPago"("IdCuentaCobrar");

CREATE TABLE IF NOT EXISTS "AbonoCuentaCobrar" (
  "IdAbonoCuentaCobrar" BIGSERIAL PRIMARY KEY,
  "IdCuentaCobrar" BIGINT NOT NULL REFERENCES "CuentaCobrar"("IdCuentaCobrar") ON DELETE RESTRICT,
  "IdMovimientoCaja" BIGINT REFERENCES "MovimientoCaja"("IdMovimientoCaja") ON DELETE SET NULL,
  "IdMetodoPago" INTEGER REFERENCES "MetodoPago"("IdMetodoPago") ON DELETE RESTRICT,
  "MontoAbonado" NUMERIC(12,2) NOT NULL CHECK ("MontoAbonado" > 0),
  "FechaAbono" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "NumeroReferencia" TEXT,
  "Observacion" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_abono_cxc" ON "AbonoCuentaCobrar"("IdCuentaCobrar");

CREATE TABLE IF NOT EXISTS "RendicionRuta" (
  "IdRendicionRuta" BIGSERIAL PRIMARY KEY,
  "IdUsuarioRepartidor" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "IdAperturaCierreCaja" INTEGER NOT NULL REFERENCES "AperturaCierreCaja"("IdAperturaCierreCaja") ON DELETE RESTRICT,
  "IdAsignacionRuta" BIGINT REFERENCES "AsignacionRuta"("IdAsignacionRuta") ON DELETE SET NULL,
  "FechaRendicion" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "MontoTotalCobradoRuta" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "MontoEfectivoEntregado" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "MontoTransferenciaReportada" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "MontoQrReportado" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "Diferencia" NUMERIC(12,2) GENERATED ALWAYS AS (
    "MontoTotalCobradoRuta" - "MontoEfectivoEntregado" - "MontoTransferenciaReportada" - "MontoQrReportado"
  ) STORED,
  "Conciliada" BOOLEAN NOT NULL DEFAULT FALSE,
  "IdUsuarioAprueba" INTEGER REFERENCES "Usuario"("IdUsuario") ON DELETE SET NULL,
  "IdMovimientoCaja" BIGINT REFERENCES "MovimientoCaja"("IdMovimientoCaja") ON DELETE SET NULL,
  "Observacion" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_rendicion_repartidor" ON "RendicionRuta"("IdUsuarioRepartidor");
CREATE INDEX IF NOT EXISTS "idx_rendicion_fecha" ON "RendicionRuta"("FechaRendicion" DESC);


-- =============================================================================
-- 6. MÓDULO: RECURSOS HUMANOS Y NÓMINA (RF-08, RF-09, RF-10, RF-11, RN-05)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "ConfiguracionLaboral" (
  "IdConfiguracionLaboral" SERIAL PRIMARY KEY,
  "Parametro" TEXT NOT NULL UNIQUE,
  "Valor" NUMERIC NOT NULL,
  "Descripcion" TEXT,
  "FechaActualizacion" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "PeriodoNomina" (
  "IdPeriodoNomina" SERIAL PRIMARY KEY,
  "Mes" INTEGER NOT NULL CHECK ("Mes" BETWEEN 1 AND 12),
  "Anio" INTEGER NOT NULL,
  "FechaInicio" DATE NOT NULL,
  "FechaFin" DATE NOT NULL,
  "Cerrado" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "uq_periodo_mes_anio" UNIQUE ("Mes", "Anio")
);

-- Datos laborales del personal sin alterar la tabla Usuario existente
CREATE TABLE IF NOT EXISTS "DatosLaboralesEmpleado" (
  "IdUsuario" INTEGER PRIMARY KEY REFERENCES "Usuario"("IdUsuario") ON DELETE CASCADE,
  "SueldoBasico" NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("SueldoBasico" >= 0),
  "FechaIngreso" DATE NOT NULL DEFAULT CURRENT_DATE,
  "PorcentajeComisionDefault" NUMERIC(5,2) DEFAULT 0,
  "CuentaBancaria" TEXT,
  "Banco" TEXT,
  "Cargo" TEXT,
  "Activo" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "MarcaBiometrica" (
  "IdMarcaBiometrica" BIGSERIAL PRIMARY KEY,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "FechaHoraMarca" TIMESTAMPTZ NOT NULL,
  "TipoMarca" TEXT NOT NULL CHECK ("TipoMarca" IN ('Entrada', 'Salida')),
  "OrigenDatos" TEXT DEFAULT 'Biometrico',
  "FechaImportacion" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_marca_usuario_fecha" ON "MarcaBiometrica"("IdUsuario", "FechaHoraMarca" DESC);
CREATE INDEX IF NOT EXISTS "idx_marca_fecha" ON "MarcaBiometrica"("FechaHoraMarca");

CREATE TABLE IF NOT EXISTS "AsistenciaDiaria" (
  "IdAsistenciaDiaria" BIGSERIAL PRIMARY KEY,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "IdTurno" INTEGER REFERENCES "Turno"("IdTurno") ON DELETE SET NULL,
  "Fecha" DATE NOT NULL,
  "HoraEntrada" TIME,
  "HoraSalida" TIME,
  "MinutosAtraso" INTEGER NOT NULL DEFAULT 0,
  "HorasExtraTrabajadas" NUMERIC(5,2) NOT NULL DEFAULT 0,
  "EsFalta" BOOLEAN NOT NULL DEFAULT FALSE,
  "FaltaJustificada" BOOLEAN NOT NULL DEFAULT FALSE,
  "Observacion" TEXT,
  CONSTRAINT "uq_asistencia_usuario_fecha" UNIQUE ("IdUsuario", "Fecha")
);

CREATE INDEX IF NOT EXISTS "idx_asistencia_fecha" ON "AsistenciaDiaria"("Fecha");
CREATE INDEX IF NOT EXISTS "idx_asistencia_usuario" ON "AsistenciaDiaria"("IdUsuario");

-- Comisiones liquidadas exclusivamente sobre rendición conciliada en caja (RN-02)
CREATE TABLE IF NOT EXISTS "ComisionReparto" (
  "IdComisionReparto" BIGSERIAL PRIMARY KEY,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "IdPeriodoNomina" INTEGER NOT NULL REFERENCES "PeriodoNomina"("IdPeriodoNomina") ON DELETE RESTRICT,
  "IdRendicionRuta" BIGINT REFERENCES "RendicionRuta"("IdRendicionRuta") ON DELETE SET NULL,
  "MontoVentaCobrada" NUMERIC(12,2) NOT NULL,
  "PorcentajeComision" NUMERIC(5,2) NOT NULL,
  "MontoComision" NUMERIC(12,2) NOT NULL,
  "FechaCalculo" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Observacion" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_comision_usuario_periodo" ON "ComisionReparto"("IdUsuario", "IdPeriodoNomina");

CREATE TABLE IF NOT EXISTS "Planilla" (
  "IdPlanilla" SERIAL PRIMARY KEY,
  "IdPeriodoNomina" INTEGER NOT NULL REFERENCES "PeriodoNomina"("IdPeriodoNomina") ON DELETE RESTRICT,
  "IdUsuarioGenera" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "FechaGeneracion" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "TotalSueldoBruto" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "TotalDeducciones" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "TotalLiquido" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "Aprobada" BOOLEAN NOT NULL DEFAULT FALSE,
  "IdUsuarioAprueba" INTEGER REFERENCES "Usuario"("IdUsuario") ON DELETE SET NULL,
  "FechaAprobacion" TIMESTAMPTZ,
  "Observacion" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_planilla_periodo" ON "Planilla"("IdPeriodoNomina");

CREATE TABLE IF NOT EXISTS "DetallePlanilla" (
  "IdDetallePlanilla" BIGSERIAL PRIMARY KEY,
  "IdPlanilla" INTEGER NOT NULL REFERENCES "Planilla"("IdPlanilla") ON DELETE CASCADE,
  "IdUsuario" INTEGER NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
  "SueldoBasico" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "MontoHorasExtra" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "MontoComisiones" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "TotalBonos" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "DescuentoAtrasos" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "DescuentoFaltas" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "AporteAFP" NUMERIC(12,2) NOT NULL DEFAULT 0, -- Gestora Pública de la Seguridad Social de Largo Plazo (12.71%)
  "OtrasDeducciones" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "TotalGanado" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "TotalDescuento" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "LiquidoPagable" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "Observacion" TEXT,
  CONSTRAINT "uq_detalle_planilla_usuario" UNIQUE ("IdPlanilla", "IdUsuario")
);

CREATE INDEX IF NOT EXISTS "idx_detplanilla_planilla" ON "DetallePlanilla"("IdPlanilla");
CREATE INDEX IF NOT EXISTS "idx_detplanilla_usuario" ON "DetallePlanilla"("IdUsuario");


-- =============================================================================
-- 7. DATOS SEMILLA DE CATÁLOGOS (INSERT ... ON CONFLICT DO NOTHING)
-- =============================================================================

-- Estados de Apertura/Cierre de Caja
INSERT INTO "EstadoAperturaCaja" ("IdEstadoAperturaCaja", "NombreEstado") VALUES
  (1, 'Abierta'),
  (2, 'Cerrada'),
  (3, 'Cerrada con Diferencia')
ON CONFLICT ("IdEstadoAperturaCaja") DO NOTHING;
SELECT setval('public."EstadoAperturaCaja_IdEstadoAperturaCaja_seq"', (SELECT MAX("IdEstadoAperturaCaja") FROM "EstadoAperturaCaja"));

-- Categorías de Movimiento de Caja
INSERT INTO "CategoriaMovimientoCaja" ("IdCategoriaMovimientoCaja", "NombreCategoria", "TipoMovimiento", "Descripcion") VALUES
  (1, 'Ingreso por Venta Directa', 'Ingreso', 'Cobro inmediato por venta en planta o ruta'),
  (2, 'Ingreso por Cobro de Crédito', 'Ingreso', 'Abono o liquidación de cuenta por cobrar'),
  (3, 'Ingreso por Rendición de Ruta', 'Ingreso', 'Dinero en efectivo liquidado por repartidor al cerrar ruta'),
  (4, 'Ingreso Extraordinario', 'Ingreso', 'Otros ingresos no clasificados'),
  (5, 'Egreso a Proveedor', 'Egreso', 'Pago a proveedores de materia prima o insumos'),
  (6, 'Egreso Operativo', 'Egreso', 'Gastos operativos menores de planta y distribución'),
  (7, 'Egreso Nómina', 'Egreso', 'Pago de sueldos y salarios'),
  (8, 'Egreso Extraordinario', 'Egreso', 'Otros egresos no clasificados')
ON CONFLICT ("IdCategoriaMovimientoCaja") DO NOTHING;
SELECT setval('public."CategoriaMovimientoCaja_IdCategoriaMovimientoCaja_seq"', (SELECT MAX("IdCategoriaMovimientoCaja") FROM "CategoriaMovimientoCaja"));

-- Estados de Cliente
INSERT INTO "EstadoCliente" ("IdEstadoCliente", "NombreEstado") VALUES
  (1, 'Activo'),
  (2, 'Inactivo'),
  (3, 'Bloqueado por Mora')
ON CONFLICT ("IdEstadoCliente") DO NOTHING;
SELECT setval('public."EstadoCliente_IdEstadoCliente_seq"', (SELECT MAX("IdEstadoCliente") FROM "EstadoCliente"));

-- Estados de Pedido
INSERT INTO "EstadoPedido" ("IdEstadoPedido", "NombreEstado") VALUES
  (1, 'Pendiente'),
  (2, 'En Camino'),
  (3, 'Entregado'),
  (4, 'Cancelado'),
  (5, 'Parcialmente Entregado')
ON CONFLICT ("IdEstadoPedido") DO NOTHING;
SELECT setval('public."EstadoPedido_IdEstadoPedido_seq"', (SELECT MAX("IdEstadoPedido") FROM "EstadoPedido"));

-- Métodos de Pago
INSERT INTO "MetodoPago" ("IdMetodoPago", "NombreMetodoPago") VALUES
  (1, 'Efectivo'),
  (2, 'Transferencia'),
  (3, 'QR'),
  (4, 'Crédito')
ON CONFLICT ("IdMetodoPago") DO NOTHING;
SELECT setval('public."MetodoPago_IdMetodoPago_seq"', (SELECT MAX("IdMetodoPago") FROM "MetodoPago"));

-- Estados de Cuenta por Cobrar
INSERT INTO "EstadoCuentaCobrar" ("IdEstadoCuentaCobrar", "NombreEstado") VALUES
  (1, 'Vigente'),
  (2, 'Vencida'),
  (3, 'Pagada'),
  (4, 'Bloqueada'),
  (5, 'Anulada')
ON CONFLICT ("IdEstadoCuentaCobrar") DO NOTHING;
SELECT setval('public."EstadoCuentaCobrar_IdEstadoCuentaCobrar_seq"', (SELECT MAX("IdEstadoCuentaCobrar") FROM "EstadoCuentaCobrar"));

-- Configuración Laboral Bolivia (RN-05)
INSERT INTO "ConfiguracionLaboral" ("Parametro", "Valor", "Descripcion") VALUES
  ('ToleranciaAtrasoMinutos', 10, 'Máximo de minutos de tolerancia antes de computar atraso - Ley General del Trabajo'),
  ('RecargoHoraExtraPorcentaje', 100, 'Porcentaje de recargo sobre hora extra - Art. 55 LGT Bolivia'),
  ('SalarioMinimoNacional', 2500, 'Salario mínimo nacional vigente en BOB'),
  ('DiasVacacionesPrimerAnio', 15, 'Días hábiles de vacación primer año - Art. 44 LGT'),
  ('DiasBloqueoMora', 15, 'Días de mora para bloquear crédito a cliente - RN-01'),
  ('PorcentajeAporteAFPGestora', 12.71, 'Aporte laboral obligatorio Gestora Pública de la Seguridad Social de Largo Plazo')
ON CONFLICT ("Parametro") DO NOTHING;

-- Caja Principal Semilla
INSERT INTO "Caja" ("IdCaja", "NombreCaja", "Descripcion", "Activa") VALUES
  (1, 'Caja Principal Planta', 'Caja central en planta de producción para ingresos y egresos diarios', TRUE)
ON CONFLICT ("IdCaja") DO NOTHING;
SELECT setval('public."Caja_IdCaja_seq"', (SELECT MAX("IdCaja") FROM "Caja"));
