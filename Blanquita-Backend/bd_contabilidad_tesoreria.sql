-- =============================================================================
-- PAPEL BLANQUITA - MÓDULO DE CONTABILIDAD, TESORERÍA, CXC Y CXP
-- Adaptado 100% a la operatoria contable real de los Excels de la empresa
-- =============================================================================

-- 1. CUENTAS BANCARIAS DE LA EMPRESA (Bancos reales: BU, BNB, BMSC, Caja)
CREATE TABLE IF NOT EXISTS public."CuentaBancariaEmpresa" (
  "IdCuentaBancaria" SERIAL PRIMARY KEY,
  "NombreBanco" TEXT NOT NULL, -- 'Banco Unión', 'Banco Nacional de Bolivia', 'Banco Mercantil Santa Cruz'
  "Sigla" TEXT NOT NULL UNIQUE, -- 'BU', 'BNB', 'BMSC', 'CAJA'
  "NumeroCuenta" TEXT,
  "TipoCuenta" TEXT NOT NULL DEFAULT 'Cuenta Corriente', -- 'Cuenta Corriente', 'Caja de Ahorro', 'Caja Efectivo'
  "Moneda" TEXT NOT NULL DEFAULT 'BOB', -- 'BOB', 'USD'
  "SaldoActual" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "Activa" BOOLEAN NOT NULL DEFAULT TRUE,
  "FechaCreacion" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insertar Cuentas Bancarias Semilla
INSERT INTO public."CuentaBancariaEmpresa" ("NombreBanco", "Sigla", "NumeroCuenta", "TipoCuenta", "Moneda", "SaldoActual") VALUES
  ('Banco Unión', 'BU', '100000-BU-BLANQUITA', 'Cuenta Corriente', 'BOB', 0),
  ('Banco Nacional de Bolivia', 'BNB', '200000-BNB-BLANQUITA', 'Cuenta Corriente', 'BOB', 0),
  ('Banco Mercantil Santa Cruz', 'BMSC', '300000-BMSC-BLANQUITA', 'Cuenta Corriente', 'BOB', 0),
  ('Caja Central Moneda Nacional', 'CAJA', 'CAJA-FISICA-BOB', 'Caja Efectivo', 'BOB', 0),
  ('Caja Dólares Albani', 'ALBANY_USD', 'CUENTA-USD-ALBANY', 'Cuenta Dólares', 'USD', 0)
ON CONFLICT ("Sigla") DO NOTHING;


-- 2. AMPLIACIÓN DEL PLAN DE CUENTAS / CATEGORÍAS DE MOVIMIENTO DE CAJA
-- Exactamente las categorías utilizadas en el Flujo de Caja 2025-2026 de la empresa
INSERT INTO public."CategoriaMovimientoCaja" ("NombreCategoria", "TipoMovimiento", "Descripcion") VALUES
  -- Depósitos y Traspasos Bancarios
  ('Depósito a Banco Unión', 'Egreso', 'Salida de efectivo de caja depositado en Banco Unión (BU)'),
  ('Depósito a Banco Nacional', 'Egreso', 'Salida de efectivo de caja depositado en Banco BNB'),
  ('Compra de dólar', 'Egreso', 'Salida de caja para adquisición de divisas / giro a proveedores exteriores'),
  
  -- Operación, Transporte y Combustible
  ('Combustible y Lubricantes', 'Egreso', 'Compra de gasolina/diésel para camiones de distribución y reparto'),
  ('Compra de materiales', 'Egreso', 'Adquisición de insumos menores, cintas, materiales operativos'),
  ('Flete y Transporte', 'Egreso', 'Fletes de transporte interdepartamental y encomiendas pesadas'),
  ('Encomiendas', 'Egreso', 'Envíos y recepción de paquetes y sobres'),
  ('Courier', 'Egreso', 'Servicios de mensajería rápida'),
  ('Pasajes', 'Egreso', 'Pasajes en bus/micro para gestiones comerciales y visitas a clientes'),
  ('Viaticos', 'Egreso', 'Viáticos de choferes y personal de ruta'),
  ('Matto. de Vehiculo', 'Egreso', 'Mantenimiento mecánico y repuestos de vehículos y camiones'),
  ('Matto. De maquinaria y equipo', 'Egreso', 'Mantenimiento preventivo y correctivo de cortadoras, bobinadoras y empaque'),
  ('Seguros / SOAT', 'Egreso', 'Pago de seguros vehiculares y SOAT anual'),
  
  -- Personal y Recursos Humanos
  ('Anticipo de Sueldos', 'Egreso', 'Adelantos de sueldo otorgados a personal de planta y choferes'),
  ('Sueldos y Salarios', 'Egreso', 'Liquidación mensual de haberes'),
  ('Beneficios Sociales Finiquito', 'Egreso', 'Liquidación de beneficios y quinquenios'),
  ('Te y Refrigerio', 'Egreso', 'Alimentación, té y refrigerios del personal de planta'),
  ('Refrigerio pasantes', 'Egreso', 'Estipendio de refrigerio para estudiantes pasantes'),
  ('Medicamentos', 'Egreso', 'Botiquín de primeros auxilios y atenciones médicas del personal'),
  ('Formularios de caja Cordes', 'Egreso', 'Trámites de seguro médico Caja Cordes'),
  ('GESTORA', 'Egreso', 'Aportes a la Gestora Pública de la Seguridad Social'),
  
  -- Oficina, Servicios Básicos e Institucionales
  ('Servicios Basicos', 'Egreso', 'Pago de servicios de energía eléctrica, agua potable, gas y telecomunicaciones'),
  ('Material de escritorio', 'Egreso', 'Hojas, tóner, bolígrafos y papelería de oficina'),
  ('Material de limpieza', 'Egreso', 'Artículos de aseo e higiene para planta y oficinas'),
  ('Fotocopias', 'Egreso', 'Fotocopiado de contratos, notas y documentación legal'),
  ('Otros Gastos', 'Egreso', 'Gastos menores no clasificados de funcionamiento'),
  ('Repuestos y Accesorios', 'Egreso', 'Piezas de recambio de ferretería y maquinaria'),
  ('Tramites ministerio', 'Egreso', 'Aranceles y trámites ante el Ministerio de Trabajo u otros'),
  ('Tramites GAMS', 'Egreso', 'Impuestos municipales, patentes y trámites en la Alcaldía de Sucre (GAMS)'),
  
  -- Ingresos de Caja
  ('Ingreso Ventas en Mercados', 'Ingreso', 'Entrada a caja por ventas directas en mercados de Sucre'),
  ('Ingreso Venta Papel Segunda', 'Ingreso', 'Venta de paquetes de papel de segunda/descarte'),
  ('Ingreso Cobro Créditos Anteriores', 'Ingreso', 'Recuperación de cuentas por cobrar de meses anteriores')
ON CONFLICT ("NombreCategoria") DO NOTHING;


-- 3. AJUSTES EN TABLA "Cliente" (Destino/Departamento, Línea de Crédito y NIT opcional)
ALTER TABLE public."Cliente" 
  ADD COLUMN IF NOT EXISTS "CiudadDestino" TEXT DEFAULT 'Sucre',
  ADD COLUMN IF NOT EXISTS "LineaCredito" TEXT DEFAULT 'Al contado';

ALTER TABLE public."Cliente" ALTER COLUMN "NitCi" DROP NOT NULL;


-- 4. CONTROL DE NOTAS DE VENTA Y DESPACHO POR CAMIÓN (Basado en 5_CONTROL NOTAS DE VENTA)
CREATE TABLE IF NOT EXISTS public."NotaVenta" (
  "IdNotaVenta" BIGSERIAL PRIMARY KEY,
  "NumeroNotaVenta" TEXT NOT NULL UNIQUE, -- ej: '260801', '251110'
  "NumeroNotaEntrega" TEXT, -- ej: '568', '2020'
  "FechaVenta" DATE NOT NULL DEFAULT CURRENT_DATE,
  "IdCliente" INTEGER REFERENCES public."Cliente"("IdCliente") ON DELETE RESTRICT,
  "ClienteNombreLibre" TEXT, -- Permite registrar el cliente textual tal como viene del camión/Excel
  "DestinoDepartamento" TEXT NOT NULL DEFAULT 'Sucre', -- Sucre, Potosi, Oruro, Tarija, Alto, La Paz, Provincias, Chile
  "Chofer" TEXT, -- ej: 'Luis'
  "PlacaCamion" TEXT, -- ej: '5738UPK'
  "CantidadCamiones" NUMERIC(10,4) DEFAULT 1,
  "TotalVentaBruto" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "DescuentoBonificacion" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "Promocion" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "ImporteNeto" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "SaldoAnterior" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "TotalCancelado" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "SaldoPendiente" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "EstadoCobranza" TEXT NOT NULL DEFAULT 'Pendiente', -- 'Pagado al Contado', 'Crédito Pendiente', 'Crédito Parcial', 'Liquidado'
  "Observacion" TEXT,
  "FechaRegistro" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "IdUsuarioRegistro" INTEGER REFERENCES public."Usuario"("IdUsuario") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_notaventa_cliente" ON public."NotaVenta"("IdCliente");
CREATE INDEX IF NOT EXISTS "idx_notaventa_fecha" ON public."NotaVenta"("FechaVenta" DESC);
CREATE INDEX IF NOT EXISTS "idx_notaventa_destino" ON public."NotaVenta"("DestinoDepartamento");

-- Detalle de productos despachados en la Nota de Venta
CREATE TABLE IF NOT EXISTS public."DetalleNotaVenta" (
  "IdDetalleNotaVenta" BIGSERIAL PRIMARY KEY,
  "IdNotaVenta" BIGINT NOT NULL REFERENCES public."NotaVenta"("IdNotaVenta") ON DELETE CASCADE,
  "IdPresentacion" INTEGER REFERENCES public."PresentacionProducto"("IdPresentacion") ON DELETE SET NULL,
  "NombreProducto" TEXT NOT NULL, -- 'MEGA 12R', 'Economico', 'LUX 6R', 'SERV 500X6', 'TOALLA COCINA', etc.
  "Cantidad" NUMERIC(10,2) NOT NULL CHECK ("Cantidad" > 0),
  "PrecioUnitario" NUMERIC(10,2) DEFAULT 0,
  "Subtotal" NUMERIC(12,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_detnotaventa_nota" ON public."DetalleNotaVenta"("IdNotaVenta");


-- 5. ADAPTACIÓN DE "CuentaCobrar" Y "AbonoCuentaCobrar" (Basado en 3_CUENTAS POR COBRAR)
ALTER TABLE public."CuentaCobrar"
  ADD COLUMN IF NOT EXISTS "IdNotaVenta" BIGINT REFERENCES public."NotaVenta"("IdNotaVenta") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "NumeroNotaVenta" TEXT,
  ADD COLUMN IF NOT EXISTS "NumeroNotaEntrega" TEXT,
  ADD COLUMN IF NOT EXISTS "FechaDespacho" DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS "DiasMora" INTEGER DEFAULT 0;

ALTER TABLE public."CuentaCobrar" ALTER COLUMN "IdUsuarioRegistro" DROP NOT NULL;
ALTER TABLE public."CuentaCobrar" ALTER COLUMN "FechaVencimiento" DROP NOT NULL;

ALTER TABLE public."AbonoCuentaCobrar"
  ADD COLUMN IF NOT EXISTS "IdNotaVenta" BIGINT REFERENCES public."NotaVenta"("IdNotaVenta") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "IdCuentaBancaria" INTEGER REFERENCES public."CuentaBancariaEmpresa"("IdCuentaBancaria") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "BancoSigla" TEXT, -- 'BU', 'BNB', 'BMSC', 'CAJA'
  ADD COLUMN IF NOT EXISTS "Depositante" TEXT, -- ej. 'Romero Quispe Luis Hector'
  ADD COLUMN IF NOT EXISTS "Moneda" TEXT DEFAULT 'BOB',
  ADD COLUMN IF NOT EXISTS "MontoDolares" NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "TipoCambio" NUMERIC(10,4) DEFAULT 1;

ALTER TABLE public."AbonoCuentaCobrar" ALTER COLUMN "IdUsuario" DROP NOT NULL;


-- 6. ADAPTACIÓN DE "MovimientoCaja" Y CAJA CHICA
ALTER TABLE public."MovimientoCaja"
  ADD COLUMN IF NOT EXISTS "NotaCodigo" TEXT, -- ej: 'SC260801'
  ADD COLUMN IF NOT EXISTS "Solicitante" TEXT, -- ej: 'Beatriz Chintari', 'Inocencio Cruz'
  ADD COLUMN IF NOT EXISTS "Respaldo" TEXT, -- ej: 'Recibo 773', 'Fact. 61318'
  ADD COLUMN IF NOT EXISTS "IdCuentaBancaria" INTEGER REFERENCES public."CuentaBancariaEmpresa"("IdCuentaBancaria") ON DELETE SET NULL;

ALTER TABLE public."MovimientoCaja" ALTER COLUMN "IdUsuario" DROP NOT NULL;
ALTER TABLE public."MovimientoCaja" ALTER COLUMN "IdAperturaCierreCaja" DROP NOT NULL;

-- Solicitud formal de Caja Chica (MODELO SOLICITUD DE CAJA CHICA)
CREATE TABLE IF NOT EXISTS public."SolicitudCajaChica" (
  "IdSolicitudCajaChica" SERIAL PRIMARY KEY,
  "CodigoSolicitud" TEXT NOT NULL UNIQUE, -- ej: 'SC260801', 'SC241204'
  "IdCaja" INTEGER NOT NULL DEFAULT 1 REFERENCES public."Caja"("IdCaja") ON DELETE RESTRICT,
  "FechaSolicitud" DATE NOT NULL DEFAULT CURRENT_DATE,
  "NombreSolicitante" TEXT NOT NULL,
  "CargoSolicitante" TEXT,
  "MontoSolicitado" NUMERIC(12,2) NOT NULL CHECK ("MontoSolicitado" > 0),
  "DestinoJustificacion" TEXT NOT NULL,
  "NombreEntregadoPor" TEXT,
  "NombreAprobadoPor" TEXT DEFAULT 'GERENCIA GENERAL',
  "Estado" TEXT NOT NULL DEFAULT 'Aprobada' CHECK ("Estado" IN ('Pendiente', 'Aprobada', 'Rendida', 'Rechazada')),
  "IdCategoriaMovimientoCaja" INTEGER REFERENCES public."CategoriaMovimientoCaja"("IdCategoriaMovimientoCaja"),
  "RespaldoDoc" TEXT,
  "IdMovimientoCaja" BIGINT REFERENCES public."MovimientoCaja"("IdMovimientoCaja") ON DELETE SET NULL,
  "FechaRegistro" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_solcajachica_codigo" ON public."SolicitudCajaChica"("CodigoSolicitud");
CREATE INDEX IF NOT EXISTS "idx_solcajachica_fecha" ON public."SolicitudCajaChica"("FechaSolicitud" DESC);

-- Detalle de Arqueo Físico de Billetes y Monedas (ARQUEO DE CAJA)
ALTER TABLE public."AperturaCierreCaja"
  ADD COLUMN IF NOT EXISTS "NumeroArqueo" TEXT, -- ej: 'N° 231101'
  ADD COLUMN IF NOT EXISTS "HoraInicio" TIME,
  ADD COLUMN IF NOT EXISTS "HoraTermino" TIME;

CREATE TABLE IF NOT EXISTS public."ArqueoCajaDetalle" (
  "IdArqueoCajaDetalle" BIGSERIAL PRIMARY KEY,
  "IdAperturaCierreCaja" INTEGER NOT NULL REFERENCES public."AperturaCierreCaja"("IdAperturaCierreCaja") ON DELETE CASCADE,
  "TipoEfectivo" TEXT NOT NULL CHECK ("TipoEfectivo" IN ('Billete', 'Moneda')),
  "Corte" NUMERIC(6,2) NOT NULL, -- 200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10
  "Cantidad" INTEGER NOT NULL DEFAULT 0 CHECK ("Cantidad" >= 0),
  "Subtotal" NUMERIC(12,2) GENERATED ALWAYS AS ("Corte" * "Cantidad") STORED
);

CREATE INDEX IF NOT EXISTS "idx_arqueodetalle_cierre" ON public."ArqueoCajaDetalle"("IdAperturaCierreCaja");


-- 7. MÓDULO DE CUENTAS POR PAGAR A PROVEEDORES (CXP)
-- Basado en CUENTAS PROVEEDOR 2025-2026 de la empresa

-- Insertar los Proveedores reales de la empresa en la tabla Proveedor legacy
INSERT INTO public."Proveedor" ("NombreProveedor", "IdEstadoProveedor") VALUES
  ('Papelera Vinto (VINTO)', 1),
  ('DERQUI S.R.L.', 1),
  ('MULTIFLEX Ltda.', 1),
  ('COLMAFLEX', 1),
  ('D'' ARTEPLAST', 1),
  ('DISPROQUIMICOS (CODELSA SRL.)', 1),
  ('WILED PAPER', 1),
  ('MONOPOL', 1)
ON CONFLICT DO NOTHING;

-- Maestro de Cuentas por Pagar (Facturas y Despachos de Proveedores)
CREATE TABLE IF NOT EXISTS public."CuentaPagarProveedor" (
  "IdCuentaPagar" BIGSERIAL PRIMARY KEY,
  "IdProveedor" INTEGER NOT NULL REFERENCES public."Proveedor"("IdProveedor") ON DELETE RESTRICT,
  "FechaRecepcion" DATE NOT NULL DEFAULT CURRENT_DATE,
  "FechaEnvio" DATE,
  "NumeroNota" TEXT, -- N° de nota de entrega / recepción del proveedor
  "NumeroFactura" TEXT, -- N° de factura fiscal emitida por el proveedor
  "ConceptoMaterial" TEXT NOT NULL, -- 'Material Bolsas', 'Pegamento', 'Bobinas Papel', 'Rodellas'
  "PesoTotalKgr" NUMERIC(10,2) DEFAULT 0,
  "CantidadUnidades" NUMERIC(10,2) DEFAULT 0,
  "PrecioUnitario" NUMERIC(10,2) DEFAULT 0,
  "Descuento" NUMERIC(12,2) DEFAULT 0,
  "PrecioFacturado" NUMERIC(12,2) NOT NULL DEFAULT 0, -- Total a pagar
  "TotalPagado" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "SaldoPendiente" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "Estado" TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK ("Estado" IN ('PENDIENTE', 'PARCIAL', 'PAGADO', 'COMPENSADO', 'ANULADO')),
  "FechaPago" DATE,
  "BancoPago" TEXT, -- 'BU', 'BNB', 'CAJA'
  "Observacion" TEXT,
  "FechaRegistro" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "IdUsuarioRegistro" INTEGER REFERENCES public."Usuario"("IdUsuario") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_cxp_proveedor" ON public."CuentaPagarProveedor"("IdProveedor");
CREATE INDEX IF NOT EXISTS "idx_cxp_fecha" ON public."CuentaPagarProveedor"("FechaRecepcion" DESC);
CREATE INDEX IF NOT EXISTS "idx_cxp_estado" ON public."CuentaPagarProveedor"("Estado");

-- Detalle de Insumos Recibidos por Factura de Proveedor
CREATE TABLE IF NOT EXISTS public."DetalleInsumoCuentaPagar" (
  "IdDetalleInsumo" BIGSERIAL PRIMARY KEY,
  "IdCuentaPagar" BIGINT NOT NULL REFERENCES public."CuentaPagarProveedor"("IdCuentaPagar") ON DELETE CASCADE,
  "DescripcionInsumo" TEXT NOT NULL, -- ej: '48 x 64 /40 - Mega. 2ª', 'Laminado LAM-950', 'Pegamento Colilla R200'
  "MedidaOFormato" TEXT, -- ej: '47x77cm', 'Turril 200KG'
  "Cantidad" NUMERIC(10,2) DEFAULT 0,
  "PesoKgr" NUMERIC(10,2) DEFAULT 0,
  "PrecioUnitario" NUMERIC(10,2) DEFAULT 0,
  "Subtotal" NUMERIC(12,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_detinsumo_cxp" ON public."DetalleInsumoCuentaPagar"("IdCuentaPagar");

-- Pagos y Depósitos a Cuentas por Pagar de Proveedores
CREATE TABLE IF NOT EXISTS public."PagoCuentaPagar" (
  "IdPagoCuentaPagar" BIGSERIAL PRIMARY KEY,
  "IdCuentaPagar" BIGINT NOT NULL REFERENCES public."CuentaPagarProveedor"("IdCuentaPagar") ON DELETE RESTRICT,
  "IdCuentaBancaria" INTEGER REFERENCES public."CuentaBancariaEmpresa"("IdCuentaBancaria") ON DELETE SET NULL,
  "IdMovimientoCaja" BIGINT REFERENCES public."MovimientoCaja"("IdMovimientoCaja") ON DELETE SET NULL,
  "MontoPagado" NUMERIC(12,2) NOT NULL CHECK ("MontoPagado" > 0),
  "FechaPago" DATE NOT NULL DEFAULT CURRENT_DATE,
  "BancoSigla" TEXT, -- 'BU', 'BNB', 'CAJA'
  "NumeroTransaccion" TEXT,
  "EsCompensacion" BOOLEAN NOT NULL DEFAULT FALSE,
  "DetalleCompensacion" TEXT, -- ej: 'Compensado con la venta de rodelas antiguas'
  "Observacion" TEXT,
  "FechaRegistro" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "IdUsuario" INTEGER REFERENCES public."Usuario"("IdUsuario") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_pagocxp_cuenta" ON public."PagoCuentaPagar"("IdCuentaPagar");

-- Devoluciones de Material Defectuoso a Proveedores (Hoja1 CUENTAS PROVEEDOR)
CREATE TABLE IF NOT EXISTS public."DevolucionProveedor" (
  "IdDevolucionProveedor" SERIAL PRIMARY KEY,
  "IdProveedor" INTEGER NOT NULL REFERENCES public."Proveedor"("IdProveedor") ON DELETE RESTRICT,
  "FechaDevolucion" DATE NOT NULL DEFAULT CURRENT_DATE,
  "ProductoMaterial" TEXT NOT NULL, -- ej: 'Bolsas de Megarollo - Defectuoso', 'Bolsas Transparentes'
  "Motivo" TEXT,
  "TotalPesoKgr" NUMERIC(10,2) DEFAULT 0,
  "TotalPaquetes" INTEGER DEFAULT 0,
  "Observacion" TEXT,
  "FechaRegistro" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_devolucion_proveedor" ON public."DevolucionProveedor"("IdProveedor");
