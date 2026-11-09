from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.Repository.DbCaller import DbCaller

class DistribuidorRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def ListarDistribuidores(self, activo: Optional[bool] = None) -> List[Dict]:
        where = 'WHERE "activo" = :activo' if activo is not None else ''
        params = {"activo": activo} if activo is not None else {}
        sql = f"""
            SELECT d.*, TRIM(CONCAT(COALESCE(u."PrimerNombre", ''), ' ', COALESCE(u."ApellidoPaterno", ''))) as "NombreUsuario"
            FROM "distribuidores_externos" d
            LEFT JOIN "Usuario" u ON d."id_usuario" = u."IdUsuario"
            {where}
            ORDER BY d."ciudad" ASC, d."nombre_comercial" ASC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def ObtenerDistribuidorPorId(self, distribuidor_id: int) -> Optional[Dict]:
        sql = 'SELECT * FROM "distribuidores_externos" WHERE "id" = :id;'
        return self.caller.LlamarUnRegistro(sql, {"id": distribuidor_id})

    def ObtenerDistribuidorPorUsuarioId(self, usuario_id: int) -> Optional[Dict]:
        sql = 'SELECT * FROM "distribuidores_externos" WHERE "id_usuario" = :uid;'
        return self.caller.LlamarUnRegistro(sql, {"uid": usuario_id})

    def CrearPedido(self, codigo_pedido: str, distribuidor_id: int, monto_total: float, obs_distribuidor: Optional[str] = None) -> Dict:
        sql = """
            INSERT INTO "pedidos_distribuidores" (
                "codigo_pedido", "distribuidor_id", "monto_total", "observacion_distribuidor", "estado"
            ) VALUES (
                :cod, :dist_id, :monto, :obs, 'PENDIENTE_REVISION'
            )
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, {
            "cod": codigo_pedido,
            "dist_id": distribuidor_id,
            "monto": monto_total,
            "obs": obs_distribuidor
        })

    def CrearDetallePedido(self, pedido_id: int, presentacion_id: int, cantidad: float, precio_u: float, subtotal: float) -> Dict:
        sql = """
            INSERT INTO "detalles_pedido_distribuidor" (
                "pedido_id", "presentacion_id", "cantidad_solicitada", "cantidad_aprobada", "precio_unitario", "subtotal"
            ) VALUES (
                :pid, :pres_id, :cant, :cant, :precio, :subtotal
            )
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, {
            "pid": pedido_id,
            "pres_id": presentacion_id,
            "cant": cantidad,
            "precio": precio_u,
            "subtotal": subtotal
        })

    def ListarPedidos(self, distribuidor_id: Optional[int] = None, estado: Optional[str] = None) -> List[Dict]:
        where_clauses = []
        params = {}
        if distribuidor_id:
            where_clauses.append('p."distribuidor_id" = :dist_id')
            params["dist_id"] = distribuidor_id
        if estado:
            where_clauses.append('p."estado" = :estado')
            params["estado"] = estado

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        sql = f"""
            SELECT 
                p.*,
                d."nombre_comercial" as "nombre_distribuidor",
                d."ciudad",
                ca."UrlArchivo" as "url_comprobante"
            FROM "pedidos_distribuidores" p
            JOIN "distribuidores_externos" d ON p."distribuidor_id" = d."id"
            LEFT JOIN "ComprobanteArchivo" ca ON p."id_comprobante_archivo" = ca."IdComprobante"
            {where_sql}
            ORDER BY p."fecha_pedido" DESC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def ObtenerPedidoPorId(self, pedido_id: int) -> Optional[Dict]:
        sql = """
            SELECT 
                p.*,
                d."nombre_comercial" as "nombre_distribuidor",
                d."ciudad",
                ca."UrlArchivo" as "url_comprobante"
            FROM "pedidos_distribuidores" p
            JOIN "distribuidores_externos" d ON p."distribuidor_id" = d."id"
            LEFT JOIN "ComprobanteArchivo" ca ON p."id_comprobante_archivo" = ca."IdComprobante"
            WHERE p."id" = :id;
        """
        return self.caller.LlamarUnRegistro(sql, {"id": pedido_id})

    def ListarDetallesPedido(self, pedido_id: int) -> List[Dict]:
        sql = """
            SELECT 
                dp.*,
                COALESCE(p."NombreProducto" || ' (' || pp."CodigoPresentacion" || ')', pp."TipoContenedor", 'Producto') as "nombre_producto"
            FROM "detalles_pedido_distribuidor" dp
            LEFT JOIN "PresentacionProducto" pp ON dp."presentacion_id" = pp."IdPresentacion"
            LEFT JOIN "Producto" p ON pp."IdProducto" = p."IdProducto"
            WHERE dp."pedido_id" = :pid;
        """
        return self.caller.LlamarFuncion(sql, {"pid": pedido_id})

    def AjustarCantidadDetalle(self, detalle_id: int, cantidad_aprobada: float, nuevo_subtotal: float) -> Optional[Dict]:
        sql = """
            UPDATE "detalles_pedido_distribuidor"
            SET "cantidad_aprobada" = :cant, "subtotal" = :subtotal
            WHERE "id" = :id
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, {
            "id": detalle_id,
            "cant": cantidad_aprobada,
            "subtotal": nuevo_subtotal
        })

    def ActualizarEstadoPedido(self, pedido_id: int, nuevo_estado: str, nuevo_monto: Optional[float] = None,
                               observacion_kevin: Optional[str] = None, id_comprobante: Optional[int] = None) -> Optional[Dict]:
        set_clauses = ['"estado" = :estado']
        params = {"id": pedido_id, "estado": nuevo_estado}

        if nuevo_monto is not None:
            set_clauses.append('"monto_total" = :monto')
            params["monto"] = nuevo_monto
        if observacion_kevin is not None:
            set_clauses.append('"observacion_kevin" = :obs')
            params["obs"] = observacion_kevin
        if id_comprobante is not None:
            set_clauses.append('"id_comprobante_archivo" = :comp_id')
            params["comp_id"] = id_comprobante
        if nuevo_estado == 'APROBADO_DESPACHO':
            set_clauses.append('"fecha_aprobacion" = now()')

        sql = f"""
            UPDATE "pedidos_distribuidores"
            SET {", ".join(set_clauses)}
            WHERE "id" = :id
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, params)
