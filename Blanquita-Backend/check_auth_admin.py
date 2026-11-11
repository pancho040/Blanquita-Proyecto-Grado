from app.Config.supabase import engine
from sqlalchemy import text

with engine.connect() as conn:
    trans = conn.begin()
    try:
        conn.execute(text("SET LOCAL ROLE supabase_auth_admin;"))
        cnt = conn.execute(text('SELECT count(*) FROM public."Usuario";')).scalar()
        print("Rows seen by supabase_auth_admin on Usuario:", cnt)
    except Exception as e:
        print("Error under supabase_auth_admin:", e)
    finally:
        trans.rollback()
