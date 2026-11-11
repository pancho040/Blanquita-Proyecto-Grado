from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.Repository.DbCaller import DbCaller
from app.core.cache import memory_cache


class SucursalRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def listar_sucursales(self, solo_activas: bool = False) -> List[Dict[str, Any]]:
        cache_key = f"sucursales:listar:{solo_activas}"
        cached_data = memory_cache.get(cache_key)
        if cached_data is not None:
            return cached_data

        filtro = "WHERE activa = true" if solo_activas else ""
        sql = f"""
            SELECT id, nombre, ciudad, direccion, telefono, activa, created_at
            FROM public.sucursales
            {filtro}
            ORDER BY id ASC;
        """
        resultado = self.caller.LlamarFuncion(sql, {})
        memory_cache.set(cache_key, resultado, ttl=180)
        return resultado

    def obtener_sucursal(self, id_sucursal: int) -> Optional[Dict[str, Any]]:
        cache_key = f"sucursales:id:{id_sucursal}"
        cached_data = memory_cache.get(cache_key)
        if cached_data is not None:
            return cached_data

        sql = """
            SELECT id, nombre, ciudad, direccion, telefono, activa, created_at
            FROM public.sucursales
            WHERE id = :id;
        """
        resultado = self.caller.LlamarUnRegistro(sql, {"id": id_sucursal})
        if resultado:
            memory_cache.set(cache_key, resultado, ttl=180)
        return resultado

    def crear_sucursal(self, datos: dict) -> Dict[str, Any]:
        memory_cache.invalidate_prefix("sucursales:")
        sql = """
            INSERT INTO public.sucursales (nombre, ciudad, direccion, telefono, activa, created_at)
            VALUES (:nombre, :ciudad, :direccion, :telefono, :activa, NOW())
            RETURNING id, nombre, ciudad, direccion, telefono, activa, created_at;
        """
        res = self.caller.LlamarUnRegistro(sql, {
            "nombre": datos["nombre"],
            "ciudad": datos["ciudad"],
            "direccion": datos.get("direccion"),
            "telefono": datos.get("telefono"),
            "activa": datos.get("activa", True)
        })
        self.db.commit()
        return res

    def actualizar_sucursal(self, id_sucursal: int, datos: dict) -> Optional[Dict[str, Any]]:
        memory_cache.invalidate_prefix("sucursales:")
        campos = []
        params = {"id": id_sucursal}
        for k, v in datos.items():
            if v is not None:
                campos.append(f"{k} = :{k}")
                params[k] = v

        if not campos:
            return self.obtener_sucursal(id_sucursal)

        set_clause = ", ".join(campos)
        sql = f"""
            UPDATE public.sucursales
            SET {set_clause}
            WHERE id = :id
            RETURNING id, nombre, ciudad, direccion, telefono, activa, created_at;
        """
        res = self.caller.LlamarUnRegistro(sql, params)
        self.db.commit()
        return res

    def listar_plantas(self) -> List[Dict[str, Any]]:
        sql = """
            SELECT id, nombre, sucursal_id, activa, proveedor_inventario
            FROM public.plantas
            ORDER BY id ASC;
        """
        return self.caller.LlamarFuncion(sql, {})
