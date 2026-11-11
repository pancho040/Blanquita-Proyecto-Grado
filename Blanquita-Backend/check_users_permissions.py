from sqlalchemy import text
from app.Config.supabase import SessionLocal
from app.Auth.AlcanceSucursal import resolver_alcance_usuario
from fastapi import HTTPException

db = SessionLocal()
try:
    usuarios = db.execute(text("""
        SELECT u."IdUsuario", u."PrimerNombre", u."ApellidoPaterno", u."IdRol", u."IdSucursal", u."Correo"
        FROM "Usuario" u
        ORDER BY u."IdUsuario";
    """)).fetchall()

    permisos = db.execute(text("""
        SELECT id_usuario, id_sucursal, puede_ver_todas, puede_escribir
        FROM usuario_sucursal_permiso
        ORDER BY id_usuario, id_sucursal;
    """)).fetchall()

    permisos_map = {}
    for p in permisos:
        permisos_map.setdefault(p.id_usuario, []).append(p)

    print(f"TOTAL USUARIOS: {len(usuarios)}")
    print(f"USUARIOS CON FILAS EN usuario_sucursal_permiso: {len(permisos_map)}")

    usuarios_sin_permiso_tabla = []
    print("\nDETALLE POR USUARIO:")
    for u in usuarios:
        filas_u = permisos_map.get(u.IdUsuario, [])
        sedes = [f"sede={f.id_sucursal}(multi={f.puede_ver_todas})" for f in filas_u]
        print(f"  Usuario ID {u.IdUsuario:2d} ({u.PrimerNombre} {u.ApellidoPaterno}, Rol={u.IdRol}, SedeDefecto={u.IdSucursal}): {sedes if sedes else '[SIN FILAS EN usuario_sucursal_permiso]'}")
        if not filas_u:
            usuarios_sin_permiso_tabla.append(u)

    print("\n=== EVALUACION DE FALLO CERRADO ===")
    for u in usuarios_sin_permiso_tabla:
        try:
            alcance = resolver_alcance_usuario(u.IdUsuario, db)
            print(f"  Usuario {u.IdUsuario} resuelve: permitidas={alcance.sucursales_permitidas}, efectiva={alcance.sucursal_efectiva}, puede_ver_todas={alcance.puede_ver_todas}")
        except HTTPException as he:
            print(f"  Usuario {u.IdUsuario} BLOQUEADO con {he.status_code}: {he.detail}")

finally:
    db.close()
