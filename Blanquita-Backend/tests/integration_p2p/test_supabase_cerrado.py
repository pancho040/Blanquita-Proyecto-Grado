"""
Pruebas de Aislamiento y Cierre Total de Supabase (Fase 1.1 - Auditoría Exhaustiva de Seguridad)
Sistema ERP Papelera Blanquita

Verifica que el rol 'anon' y 'authenticated' carecen de cualquier privilegio
sobre tablas, secuencias y rutinas en el esquema public, y que el 100% de tablas
tienen Row Level Security (RLS) habilitado.
"""

import pytest
from sqlalchemy import text
from app.Config.supabase import engine


def test_catalogo_cero_privilegios_tablas_anon_y_authenticated():
    """Valida con has_table_privilege (incluyendo herencia de PUBLIC) que anon y authenticated tienen 0 privilegios sobre tablas."""
    with engine.connect() as conn:
        query = text("""
            SELECT c.relname, p.rol
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            CROSS JOIN (VALUES ('anon'), ('authenticated')) AS p(rol)
            WHERE n.nspname = 'public' AND c.relkind = 'r'
              AND (has_table_privilege(p.rol, c.oid, 'SELECT')
                OR has_table_privilege(p.rol, c.oid, 'INSERT')
                OR has_table_privilege(p.rol, c.oid, 'UPDATE')
                OR has_table_privilege(p.rol, c.oid, 'DELETE'));
        """)
        privs = conn.execute(query).fetchall()
        assert len(privs) == 0, f"Se encontraron {len(privs)} privilegios sobre tablas para anon/authenticated: {privs}"


def test_catalogo_cero_privilegios_rutinas_anon_y_authenticated():
    """Valida con has_function_privilege (incluyendo herencia de PUBLIC) que anon y authenticated tienen 0 privilegios de ejecucion."""
    with engine.connect() as conn:
        query = text("""
            SELECT p.proname, r.rol
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rol)
            WHERE n.nspname = 'public'
              AND has_function_privilege(r.rol, p.oid, 'EXECUTE');
        """)
        privs = conn.execute(query).fetchall()
        assert len(privs) == 0, f"Se encontraron {len(privs)} funciones con EXECUTE para anon/authenticated: {privs}"


def test_catalogo_cero_privilegios_secuencias_anon_y_authenticated():
    """Valida con has_sequence_privilege (incluyendo herencia de PUBLIC) que anon y authenticated tienen 0 privilegios sobre secuencias."""
    with engine.connect() as conn:
        query = text("""
            SELECT c.relname, p.rol
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            CROSS JOIN (VALUES ('anon'), ('authenticated')) AS p(rol)
            WHERE n.nspname = 'public' AND c.relkind = 'S'
              AND (has_sequence_privilege(p.rol, c.oid, 'USAGE')
                OR has_sequence_privilege(p.rol, c.oid, 'SELECT')
                OR has_sequence_privilege(p.rol, c.oid, 'UPDATE'));
        """)
        privs = conn.execute(query).fetchall()
        assert len(privs) == 0, f"Se encontraron {len(privs)} privilegios sobre secuencias para anon/authenticated: {privs}"


def test_catalogo_cien_por_ciento_tablas_con_rls_habilitado():
    """Valida que el 100% de tablas físicas en el esquema public tienen rowsecurity = true."""
    with engine.connect() as conn:
        query = text("""
            SELECT c.relname 
            FROM pg_class c 
            JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE n.nspname = 'public' 
              AND c.relkind = 'r' 
              AND c.relrowsecurity = false;
        """)
        tablas_sin_rls = conn.execute(query).fetchall()
        assert len(tablas_sin_rls) == 0, f"Tablas sin RLS detectadas: {[t[0] for t in tablas_sin_rls]}"


def test_anon_bloqueado_en_ejecucion_directa_de_rutinas():
    """Demuestra que anon no puede ejecutar ResolverCorreoPorCi y recibe permission denied."""
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            conn.execute(text("SET LOCAL ROLE anon;"))
            with pytest.raises(Exception) as excinfo:
                conn.execute(text('SELECT public."ResolverCorreoPorCi"(\'1234567\');'))
            assert "permission denied" in str(excinfo.value).lower()
        finally:
            trans.rollback()


def test_postgres_fastapi_mantiene_acceso_total():
    """Verifica que el rol 'postgres' usado por FastAPI sigue leyendo y escribiendo con normalidad."""
    with engine.connect() as conn:
        p_cnt = conn.execute(text('SELECT count(*) FROM public."Pedido";')).scalar()
        assert p_cnt >= 0
        u_cnt = conn.execute(text('SELECT count(*) FROM public."Usuario";')).scalar()
        assert u_cnt >= 0

        # Escritura con rollback
        conn.rollback()
        with conn.begin() as trans:
            conn.execute(text('UPDATE public."Pedido" SET "Observacion" = \'Test Permanente\' WHERE "IdPedido" = 1;'))
            trans.rollback()
