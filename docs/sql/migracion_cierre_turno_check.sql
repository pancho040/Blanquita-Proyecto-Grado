-- Migración: Flexibilización de check constraint AsignacionRuta_Estado_check
-- Autor: Agente Coordinador Antigravity
-- Fecha: 2026-11-15
-- Propósito: Permitir tanto 'Finalizada' como 'Completada' para evitar errores de integridad al liquidar ruta.

ALTER TABLE public."AsignacionRuta"
    DROP CONSTRAINT IF EXISTS "AsignacionRuta_Estado_check";

ALTER TABLE public."AsignacionRuta"
    ADD CONSTRAINT "AsignacionRuta_Estado_check"
    CHECK ("Estado" = ANY (ARRAY['Pendiente'::text, 'En Ruta'::text, 'Finalizada'::text, 'Completada'::text, 'Cancelada'::text]));

-- REVERSA:
-- ALTER TABLE public."AsignacionRuta" DROP CONSTRAINT IF EXISTS "AsignacionRuta_Estado_check";
-- ALTER TABLE public."AsignacionRuta" ADD CONSTRAINT "AsignacionRuta_Estado_check" CHECK ("Estado" = ANY (ARRAY['Pendiente'::text, 'En Ruta'::text, 'Finalizada'::text, 'Cancelada'::text]));
