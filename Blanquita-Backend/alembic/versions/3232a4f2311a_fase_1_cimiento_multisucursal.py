"""fase_1_cimiento_multisucursal

Revision ID: 3232a4f2311a
Revises: 
Create Date: 2026-11-09 00:09:40.803973

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '3232a4f2311a'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Tabla sucursales
    op.execute("""
    CREATE TABLE IF NOT EXISTS public.sucursales (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        ciudad VARCHAR(50) NOT NULL,
        direccion VARCHAR(200),
        telefono VARCHAR(30),
        activa BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)

    # Seed sucursales Sucre y Potosí
    op.execute("""
    INSERT INTO public.sucursales (id, nombre, ciudad, direccion, telefono, activa)
    VALUES 
        (1, 'Sucursal Central Sucre', 'Sucre', 'Av. Jaime Mendoza #450', '46412345', true),
        (2, 'Sucursal Potosí', 'Potosí', 'Calle Bolívar #120', '26212345', true)
    ON CONFLICT (id) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        ciudad = EXCLUDED.ciudad,
        activa = EXCLUDED.activa;
    SELECT setval('public.sucursales_id_seq', (SELECT GREATEST(MAX(id), 2) FROM public.sucursales));
    """)

    # 2. Tabla plantas
    op.execute("""
    CREATE TABLE IF NOT EXISTS public.plantas (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        sucursal_id INT REFERENCES public.sucursales(id) ON DELETE RESTRICT,
        activa BOOLEAN NOT NULL DEFAULT TRUE,
        proveedor_inventario VARCHAR(30) NOT NULL DEFAULT 'FABRICIO_LEGACY'
    );
    """)

    # Seed planta Sucre
    op.execute("""
    INSERT INTO public.plantas (id, nombre, sucursal_id, activa, proveedor_inventario)
    VALUES (1, 'Planta Central Sucre', 1, true, 'FABRICIO_LEGACY')
    ON CONFLICT (id) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        proveedor_inventario = EXCLUDED.proveedor_inventario;
    SELECT setval('public.plantas_id_seq', (SELECT GREATEST(MAX(id), 1) FROM public.plantas));
    """)

    # 3. Extensión aditiva de tablas existentes con IdSucursal y backfill hacia Sucre
    op.execute("""
    -- Usuario
    ALTER TABLE public."Usuario" ADD COLUMN IF NOT EXISTS "IdSucursal" INT REFERENCES public.sucursales(id) ON DELETE RESTRICT;
    UPDATE public."Usuario" SET "IdSucursal" = 1 WHERE "IdSucursal" IS NULL;

    -- PrecioProducto
    ALTER TABLE public."PrecioProducto" ADD COLUMN IF NOT EXISTS "IdSucursal" INT REFERENCES public.sucursales(id) ON DELETE RESTRICT;
    ALTER TABLE public."PrecioProducto" ADD COLUMN IF NOT EXISTS "IdPresentacion" INT REFERENCES public."PresentacionProducto"("IdPresentacion") ON DELETE RESTRICT;
    ALTER TABLE public."PrecioProducto" ADD COLUMN IF NOT EXISTS "FechaVigenciaDesde" TIMESTAMPTZ NOT NULL DEFAULT NOW();
    UPDATE public."PrecioProducto" SET "IdSucursal" = 1 WHERE "IdSucursal" IS NULL;

    -- Cliente
    ALTER TABLE public."Cliente" ADD COLUMN IF NOT EXISTS "IdSucursal" INT REFERENCES public.sucursales(id) ON DELETE RESTRICT;
    UPDATE public."Cliente" SET "IdSucursal" = 1 WHERE "IdSucursal" IS NULL;

    -- RutaDistribucion
    ALTER TABLE public."RutaDistribucion" ADD COLUMN IF NOT EXISTS "IdSucursal" INT REFERENCES public.sucursales(id) ON DELETE RESTRICT;
    UPDATE public."RutaDistribucion" SET "IdSucursal" = 1 WHERE "IdSucursal" IS NULL;

    -- NotaVenta
    ALTER TABLE public."NotaVenta" ADD COLUMN IF NOT EXISTS "IdSucursal" INT REFERENCES public.sucursales(id) ON DELETE RESTRICT;
    ALTER TABLE public."NotaVenta" ADD COLUMN IF NOT EXISTS "NroNotaVenta" VARCHAR(50);
    ALTER TABLE public."NotaVenta" ADD COLUMN IF NOT EXISTS "FirmaDigitalUrl" TEXT;
    UPDATE public."NotaVenta" SET "IdSucursal" = 1 WHERE "IdSucursal" IS NULL;

    -- DetalleNotaVenta
    ALTER TABLE public."DetalleNotaVenta" ADD COLUMN IF NOT EXISTS "IdPresentacion" INT REFERENCES public."PresentacionProducto"("IdPresentacion") ON DELETE RESTRICT;
    ALTER TABLE public."DetalleNotaVenta" ADD COLUMN IF NOT EXISTS "EsBonificacionBandeo" BOOLEAN NOT NULL DEFAULT FALSE;

    -- Caja
    ALTER TABLE public."Caja" ADD COLUMN IF NOT EXISTS "IdSucursal" INT REFERENCES public.sucursales(id) ON DELETE RESTRICT;
    UPDATE public."Caja" SET "IdSucursal" = 1 WHERE "IdSucursal" IS NULL;

    -- CuentaCobrar
    ALTER TABLE public."CuentaCobrar" ADD COLUMN IF NOT EXISTS "IdSucursal" INT REFERENCES public.sucursales(id) ON DELETE RESTRICT;
    ALTER TABLE public."CuentaCobrar" ADD COLUMN IF NOT EXISTS "EstadoAprobacion" VARCHAR(30) NOT NULL DEFAULT 'APROBADO';
    UPDATE public."CuentaCobrar" SET "IdSucursal" = 1 WHERE "IdSucursal" IS NULL;

    -- CuentaPagarProveedor
    ALTER TABLE public."CuentaPagarProveedor" ADD COLUMN IF NOT EXISTS "IdSucursal" INT REFERENCES public.sucursales(id) ON DELETE RESTRICT;
    UPDATE public."CuentaPagarProveedor" SET "IdSucursal" = 1 WHERE "IdSucursal" IS NULL;

    -- SolicitudCajaChica
    ALTER TABLE public."SolicitudCajaChica" ADD COLUMN IF NOT EXISTS "IdSucursal" INT REFERENCES public.sucursales(id) ON DELETE RESTRICT;
    ALTER TABLE public."SolicitudCajaChica" ADD COLUMN IF NOT EXISTS "AprobacionGerencia" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE';
    ALTER TABLE public."SolicitudCajaChica" ADD COLUMN IF NOT EXISTS "MontoReintegro" NUMERIC(12,2) NOT NULL DEFAULT 0.00;
    UPDATE public."SolicitudCajaChica" SET "IdSucursal" = 1 WHERE "IdSucursal" IS NULL;

    -- DatosLaboralesEmpleado
    ALTER TABLE public."DatosLaboralesEmpleado" ADD COLUMN IF NOT EXISTS "IdSucursal" INT REFERENCES public.sucursales(id) ON DELETE RESTRICT;
    ALTER TABLE public."DatosLaboralesEmpleado" ADD COLUMN IF NOT EXISTS "EsAsegurado" BOOLEAN NOT NULL DEFAULT FALSE;
    UPDATE public."DatosLaboralesEmpleado" SET "IdSucursal" = 1 WHERE "IdSucursal" IS NULL;
    """)

    # 4. Tabla ProductoConfigComercial
    op.execute("""
    CREATE TABLE IF NOT EXISTS public."ProductoConfigComercial" (
        "IdConfigComercial" SERIAL PRIMARY KEY,
        "IdProducto" INT NOT NULL REFERENCES public."Producto"("IdProducto") ON DELETE RESTRICT,
        "EsBandeo" BOOLEAN NOT NULL DEFAULT FALSE,
        "ValorBandeo" INT NOT NULL DEFAULT 0,
        "ActivoParaVenta" BOOLEAN NOT NULL DEFAULT TRUE,
        "UpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_producto_config_comercial UNIQUE ("IdProducto")
    );
    """)

    # 5. Tablas de Envíos y Mermas de Inventario
    op.execute("""
    CREATE TABLE IF NOT EXISTS public.envios_inventario (
        id SERIAL PRIMARY KEY,
        numero_guia VARCHAR(50) UNIQUE NOT NULL,
        origen_tipo VARCHAR(20) NOT NULL,
        origen_id INT NOT NULL,
        destino_tipo VARCHAR(20) NOT NULL,
        destino_id INT NOT NULL,
        estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
        descuento_planta_aplicado BOOLEAN NOT NULL DEFAULT FALSE,
        chofer_nombre VARCHAR(100),
        camion_placa VARCHAR(20),
        usuario_despacho_id INT NOT NULL,
        usuario_recepcion_id INT,
        fecha_despacho TIMESTAMPTZ,
        fecha_recepcion TIMESTAMPTZ,
        observaciones TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.detalles_envio_inventario (
        id SERIAL PRIMARY KEY,
        envio_id INT NOT NULL REFERENCES public.envios_inventario(id) ON DELETE RESTRICT,
        presentacion_id INT NOT NULL REFERENCES public."PresentacionProducto"("IdPresentacion") ON DELETE RESTRICT,
        cantidad_enviada NUMERIC(12,2) NOT NULL CHECK (cantidad_enviada > 0),
        cantidad_recibida NUMERIC(12,2) DEFAULT 0 CHECK (cantidad_recibida >= 0)
    );

    CREATE TABLE IF NOT EXISTS public.mermas_envio (
        id SERIAL PRIMARY KEY,
        envio_id INT NOT NULL REFERENCES public.envios_inventario(id) ON DELETE RESTRICT,
        presentacion_id INT NOT NULL REFERENCES public."PresentacionProducto"("IdPresentacion") ON DELETE RESTRICT,
        cantidad_merma NUMERIC(12,2) NOT NULL CHECK (cantidad_merma > 0),
        motivo TEXT NOT NULL,
        fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)

    # 6. Tablas de Inventario de Sucursal y Chofer (por presentacion_id)
    op.execute("""
    CREATE TABLE IF NOT EXISTS public.inventario_sucursal (
        id SERIAL PRIMARY KEY,
        sucursal_id INT NOT NULL REFERENCES public.sucursales(id) ON DELETE RESTRICT,
        presentacion_id INT NOT NULL REFERENCES public."PresentacionProducto"("IdPresentacion") ON DELETE RESTRICT,
        cantidad_disponible NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
        cantidad_reservada NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad_reservada >= 0),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_sucursal_presentacion UNIQUE (sucursal_id, presentacion_id)
    );

    CREATE TABLE IF NOT EXISTS public.inventario_chofer (
        id SERIAL PRIMARY KEY,
        chofer_id INT NOT NULL REFERENCES public."Usuario"("IdUsuario") ON DELETE RESTRICT,
        sucursal_id INT NOT NULL REFERENCES public.sucursales(id) ON DELETE RESTRICT,
        presentacion_id INT NOT NULL REFERENCES public."PresentacionProducto"("IdPresentacion") ON DELETE RESTRICT,
        cantidad_cargada NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad_cargada >= 0),
        cantidad_vendida NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad_vendida >= 0),
        cantidad_remanente NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad_remanente >= 0),
        precio_vigente_carga NUMERIC(12,2) NOT NULL DEFAULT 0,
        fecha_carga TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_chofer_sucursal_presentacion UNIQUE (chofer_id, sucursal_id, presentacion_id)
    );

    CREATE TABLE IF NOT EXISTS public."RevalorizacionInventarioChofer" (
        "IdRevalorizacion" SERIAL PRIMARY KEY,
        "IdChofer" INT NOT NULL REFERENCES public."Usuario"("IdUsuario") ON DELETE RESTRICT,
        "IdSucursal" INT NOT NULL REFERENCES public.sucursales(id) ON DELETE RESTRICT,
        "IdPresentacion" INT NOT NULL REFERENCES public."PresentacionProducto"("IdPresentacion") ON DELETE RESTRICT,
        "CantidadRemanente" NUMERIC(12,2) NOT NULL,
        "PrecioAnterior" NUMERIC(12,2) NOT NULL,
        "PrecioNuevo" NUMERIC(12,2) NOT NULL,
        "MontoAjuste" NUMERIC(12,2) NOT NULL,
        "FechaRevalorizacion" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "DetalleNotificacion" TEXT
    );
    """)

    # 7. Comprobantes de Archivo y Notificaciones
    op.execute("""
    CREATE TABLE IF NOT EXISTS public."ComprobanteArchivo" (
        "IdComprobante" SERIAL PRIMARY KEY,
        "EntidadOrigen" VARCHAR(50) NOT NULL,
        "IdRegistroOrigen" INT NOT NULL,
        "UrlArchivo" TEXT NOT NULL,
        "NombreOriginal" VARCHAR(255) NOT NULL,
        "Formato" VARCHAR(20) NOT NULL,
        "TamanoBytes" INT NOT NULL,
        "Sha256" VARCHAR(64),
        "ArchivoEliminado" BOOLEAN NOT NULL DEFAULT FALSE,
        "FechaSubida" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "FechaExpiracion" TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 days')
    );

    CREATE TABLE IF NOT EXISTS public."NotificacionInterna" (
        "IdNotificacion" SERIAL PRIMARY KEY,
        "IdUsuarioDestinatario" INT REFERENCES public."Usuario"("IdUsuario") ON DELETE CASCADE,
        "Titulo" VARCHAR(100) NOT NULL,
        "Mensaje" TEXT NOT NULL,
        "Tipo" VARCHAR(30) NOT NULL,
        "CodigoReferencia" INT,
        "Leido" BOOLEAN NOT NULL DEFAULT FALSE,
        "FechaCreacion" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)


def downgrade() -> None:
    pass
