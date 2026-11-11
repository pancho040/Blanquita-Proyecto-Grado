from typing import List, Dict, Any, Optional
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.Repository.DbCaller import DbCaller


class EnvioRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def listar_envios(self, estado: Optional[str] = None) -> List[Dict[str, Any]]:
        filtro = "WHERE e.estado = :estado" if estado else ""
        sql = f"""
            SELECT 
                e.id,
                e.numero_guia,
                e.origen_tipo,
                e.origen_id,
                CASE 
                    WHEN e.origen_tipo = 'PLANTA' THEN pl.nombre
                    ELSE s_orig.nombre 
                END as origen_nombre,
                e.destino_tipo,
                e.destino_id,
                CASE 
                    WHEN e.destino_tipo = 'PLANTA' THEN pl_dest.nombre
                    ELSE s_dest.nombre 
                END as destino_nombre,
                e.estado,
                e.descuento_planta_aplicado,
                e.chofer_nombre,
                e.camion_placa,
                e.usuario_despacho_id,
                e.usuario_recepcion_id,
                e.fecha_despacho,
                e.fecha_recepcion,
                e.observaciones
            FROM public.envios_inventario e
            LEFT JOIN public.plantas pl ON e.origen_tipo = 'PLANTA' AND e.origen_id = pl.id
            LEFT JOIN public.sucursales s_orig ON e.origen_tipo = 'SUCURSAL' AND e.origen_id = s_orig.id
            LEFT JOIN public.plantas pl_dest ON e.destino_tipo = 'PLANTA' AND e.destino_id = pl_dest.id
            LEFT JOIN public.sucursales s_dest ON e.destino_tipo = 'SUCURSAL' AND e.destino_id = s_dest.id
            {filtro}
            ORDER BY e.created_at DESC;
        """
        params = {"estado": estado} if estado else {}
        envios = self.caller.LlamarFuncion(sql, params, commit=False)

        if not envios:
            return []

        envio_ids = [envio["id"] for envio in envios]
        detalles_map = self.listar_detalles_envios_batch(envio_ids)
        mermas_map = self.listar_mermas_envios_batch(envio_ids)

        for envio in envios:
            envio_id = envio["id"]
            envio["detalles"] = detalles_map.get(envio_id, [])
            envio["mermas"] = mermas_map.get(envio_id, [])
        
        return envios

    def listar_detalles_envios_batch(self, envio_ids: List[int]) -> Dict[int, List[Dict[str, Any]]]:
        if not envio_ids:
            return {}
        sql = """
            SELECT 
                d.id,
                d.envio_id,
                d.presentacion_id,
                p."CodigoPresentacion" as codigo_presentacion,
                prod."NombreProducto" as nombre_producto,
                p."TipoContenedor" as tipo_contenedor,
                d.cantidad_enviada,
                d.cantidad_recibida
            FROM public.detalles_envio_inventario d
            JOIN public."PresentacionProducto" p ON d.presentacion_id = p."IdPresentacion"
            JOIN public."Producto" prod ON p."IdProducto" = prod."IdProducto"
            WHERE d.envio_id = ANY(:envio_ids)
            ORDER BY d.id ASC;
        """
        filas = self.caller.LlamarFuncion(sql, {"envio_ids": envio_ids}, commit=False)
        resultado: Dict[int, List[Dict[str, Any]]] = {eid: [] for eid in envio_ids}
        for f in filas:
            eid = f["envio_id"]
            if eid in resultado:
                resultado[eid].append(f)
        return resultado

    def listar_mermas_envios_batch(self, envio_ids: List[int]) -> Dict[int, List[Dict[str, Any]]]:
        if not envio_ids:
            return {}
        sql = """
            SELECT 
                m.id,
                m.envio_id,
                m.presentacion_id,
                p."CodigoPresentacion" as codigo_presentacion,
                m.cantidad_merma,
                m.motivo,
                m.fecha_registro
            FROM public.mermas_envio m
            JOIN public."PresentacionProducto" p ON m.presentacion_id = p."IdPresentacion"
            WHERE m.envio_id = ANY(:envio_ids)
            ORDER BY m.id ASC;
        """
        filas = self.caller.LlamarFuncion(sql, {"envio_ids": envio_ids}, commit=False)
        resultado: Dict[int, List[Dict[str, Any]]] = {eid: [] for eid in envio_ids}
        for f in filas:
            eid = f["envio_id"]
            if eid in resultado:
                resultado[eid].append(f)
        return resultado

    def obtener_envio(self, envio_id: int) -> Optional[Dict[str, Any]]:
        sql = """
            SELECT 
                e.id,
                e.numero_guia,
                e.origen_tipo,
                e.origen_id,
                CASE 
                    WHEN e.origen_tipo = 'PLANTA' THEN pl.nombre
                    ELSE s_orig.nombre 
                END as origen_nombre,
                e.destino_tipo,
                e.destino_id,
                CASE 
                    WHEN e.destino_tipo = 'PLANTA' THEN pl_dest.nombre
                    ELSE s_dest.nombre 
                END as destino_nombre,
                e.estado,
                e.descuento_planta_aplicado,
                e.chofer_nombre,
                e.camion_placa,
                e.usuario_despacho_id,
                e.usuario_recepcion_id,
                e.fecha_despacho,
                e.fecha_recepcion,
                e.observaciones
            FROM public.envios_inventario e
            LEFT JOIN public.plantas pl ON e.origen_tipo = 'PLANTA' AND e.origen_id = pl.id
            LEFT JOIN public.sucursales s_orig ON e.origen_tipo = 'SUCURSAL' AND e.origen_id = s_orig.id
            LEFT JOIN public.plantas pl_dest ON e.destino_tipo = 'PLANTA' AND e.destino_id = pl_dest.id
            LEFT JOIN public.sucursales s_dest ON e.destino_tipo = 'SUCURSAL' AND e.destino_id = s_dest.id
            WHERE e.id = :id;
        """
        envio = self.caller.LlamarUnRegistro(sql, {"id": envio_id})
        if envio:
            envio["detalles"] = self.listar_detalles_envio(envio_id)
            envio["mermas"] = self.listar_mermas_envio(envio_id)
        return envio

    def listar_detalles_envio(self, envio_id: int) -> List[Dict[str, Any]]:
        sql = """
            SELECT 
                d.id,
                d.presentacion_id,
                p."CodigoPresentacion" as codigo_presentacion,
                prod."NombreProducto" as nombre_producto,
                p."TipoContenedor" as tipo_contenedor,
                d.cantidad_enviada,
                d.cantidad_recibida
            FROM public.detalles_envio_inventario d
            JOIN public."PresentacionProducto" p ON d.presentacion_id = p."IdPresentacion"
            JOIN public."Producto" prod ON p."IdProducto" = prod."IdProducto"
            WHERE d.envio_id = :envio_id
            ORDER BY d.id ASC;
        """
        return self.caller.LlamarFuncion(sql, {"envio_id": envio_id})

    def listar_mermas_envio(self, envio_id: int) -> List[Dict[str, Any]]:
        sql = """
            SELECT 
                m.id,
                m.presentacion_id,
                p."CodigoPresentacion" as codigo_presentacion,
                m.cantidad_merma,
                m.motivo,
                m.fecha_registro
            FROM public.mermas_envio m
            JOIN public."PresentacionProducto" p ON m.presentacion_id = p."IdPresentacion"
            WHERE m.envio_id = :envio_id
            ORDER BY m.id ASC;
        """
        return self.caller.LlamarFuncion(sql, {"envio_id": envio_id})
