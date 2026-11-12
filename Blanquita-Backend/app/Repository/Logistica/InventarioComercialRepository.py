from typing import List, Dict, Any, Optional
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.Repository.DbCaller import DbCaller


class InventarioComercialRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def listar_inventario_sucursal(self, sucursal_id: int) -> List[Dict[str, Any]]:
        sql = """
            SELECT * FROM (
                SELECT DISTINCT ON (inv.id)
                    inv.id,
                    inv.sucursal_id,
                    inv.presentacion_id,
                    p."CodigoPresentacion" as codigo_presentacion,
                    prod."NombreProducto" as nombre_producto,
                    p."TipoContenedor" as tipo_contenedor,
                    inv.cantidad_disponible,
                    inv.cantidad_reservada,
                    COALESCE(pp."PrecioUnitario", 0) as precio_unitario_vigente,
                    ROUND(inv.cantidad_disponible * COALESCE(pp."PrecioUnitario", 0), 2) as valor_total_disponible,
                    inv.updated_at
                FROM public.inventario_sucursal inv
                JOIN public."PresentacionProducto" p ON inv.presentacion_id = p."IdPresentacion"
                JOIN public."Producto" prod ON p."IdProducto" = prod."IdProducto"
                LEFT JOIN public."PrecioProducto" pp ON p."IdPresentacion" = pp."IdPresentacion"
                     AND (pp."IdSucursal" = inv.sucursal_id OR pp."IdSucursal" IS NULL)
                     AND pp."Activo" = TRUE
                WHERE inv.sucursal_id = :sid
                ORDER BY inv.id, (pp."IdSucursal" IS NOT NULL) DESC, pp."IdPrecioProducto" DESC
            ) sub
            ORDER BY sub.nombre_producto, sub.codigo_presentacion;
        """
        return self.caller.LlamarFuncion(sql, {"sid": sucursal_id})

    def listar_inventario_chofer(self, chofer_id: int) -> List[Dict[str, Any]]:
        sql = """
            SELECT 
                ic.id,
                ic.chofer_id,
                u."PrimerNombre" || ' ' || u."ApellidoPaterno" as chofer_nombre,
                ic.sucursal_id,
                ic.presentacion_id,
                p."CodigoPresentacion" as codigo_presentacion,
                prod."NombreProducto" as nombre_producto,
                p."TipoContenedor" as tipo_contenedor,
                ic.cantidad_cargada,
                ic.cantidad_vendida,
                ic.cantidad_remanente,
                ic.precio_vigente_carga,
                ROUND(ic.cantidad_remanente * ic.precio_vigente_carga, 2) as valor_remanente,
                COALESCE((
                    SELECT pp."PrecioUnitario" 
                    FROM public."PrecioProducto" pp 
                    WHERE pp."IdPresentacion" = ic.presentacion_id 
                      AND (pp."IdSucursal" = ic.sucursal_id OR pp."IdSucursal" IS NULL) 
                      AND pp."Activo" = TRUE 
                    ORDER BY (pp."IdSucursal" = ic.sucursal_id) DESC, pp."IdPrecioProducto" DESC 
                    LIMIT 1
                ), ic.precio_vigente_carga) as precio_vigente_actual,
                ROUND(ic.cantidad_remanente * COALESCE((
                    SELECT pp."PrecioUnitario" 
                    FROM public."PrecioProducto" pp 
                    WHERE pp."IdPresentacion" = ic.presentacion_id 
                      AND (pp."IdSucursal" = ic.sucursal_id OR pp."IdSucursal" IS NULL) 
                      AND pp."Activo" = TRUE 
                    ORDER BY (pp."IdSucursal" = ic.sucursal_id) DESC, pp."IdPrecioProducto" DESC 
                    LIMIT 1
                ), ic.precio_vigente_carga), 2) as valor_remanente_revalorizado,
                ROUND(ic.cantidad_remanente * (COALESCE((
                    SELECT pp."PrecioUnitario" 
                    FROM public."PrecioProducto" pp 
                    WHERE pp."IdPresentacion" = ic.presentacion_id 
                      AND (pp."IdSucursal" = ic.sucursal_id OR pp."IdSucursal" IS NULL) 
                      AND pp."Activo" = TRUE 
                    ORDER BY (pp."IdSucursal" = ic.sucursal_id) DESC, pp."IdPrecioProducto" DESC 
                    LIMIT 1
                ), ic.precio_vigente_carga) - ic.precio_vigente_carga), 2) as diferencia_revalorizacion_bs,
                ic.fecha_carga
            FROM public.inventario_chofer ic
            JOIN public."Usuario" u ON ic.chofer_id = u."IdUsuario"
            JOIN public."PresentacionProducto" p ON ic.presentacion_id = p."IdPresentacion"
            JOIN public."Producto" prod ON p."IdProducto" = prod."IdProducto"
            WHERE ic.chofer_id = :cid
            ORDER BY prod."NombreProducto", p."CodigoPresentacion";
        """
        return self.caller.LlamarFuncion(sql, {"cid": chofer_id})

    def cargar_stock_chofer(self, chofer_id: int, sucursal_id: int, presentacion_id: int, cantidad: Decimal) -> Dict[str, Any]:
        """
        Descuenta del stock disponible de la sucursal y suma a la carga del chofer con el precio vigente.
        """
        # 1. Obtener precio vigente de la sucursal
        stmt_precio = text("""
            SELECT "PrecioUnitario" 
            FROM public."PrecioProducto"
            WHERE "IdPresentacion" = :pid 
              AND ("IdSucursal" = :sid OR "IdSucursal" IS NULL)
              AND "Activo" = TRUE
            ORDER BY "IdPrecioProducto" DESC 
            LIMIT 1;
        """)
        row_precio = self.db.execute(stmt_precio, {"pid": presentacion_id, "sid": sucursal_id}).fetchone()
        precio_vigente = Decimal(str(row_precio[0])) if row_precio and row_precio[0] is not None else Decimal("0.00")

        # 2. Descontar de inventario_sucursal (con verificación condicional)
        stmt_desc_suc = text("""
            UPDATE public.inventario_sucursal
            SET cantidad_disponible = cantidad_disponible - :cant,
                updated_at = NOW()
            WHERE sucursal_id = :sid AND presentacion_id = :pid AND cantidad_disponible >= :cant
            RETURNING cantidad_disponible;
        """)
        res_desc = self.db.execute(stmt_desc_suc, {"sid": sucursal_id, "pid": presentacion_id, "cant": cantidad}).fetchone()
        if not res_desc:
            raise ValueError(f"Stock insuficiente en la sucursal #{sucursal_id} para la presentación #{presentacion_id}.")

        # 3. Incrementar en inventario_chofer
        stmt_inc_chofer = text("""
            INSERT INTO public.inventario_chofer (
                chofer_id, sucursal_id, presentacion_id,
                cantidad_cargada, cantidad_vendida, cantidad_remanente,
                precio_vigente_carga, fecha_carga
            ) VALUES (
                :cid, :sid, :pid,
                :cant, 0, :cant,
                :precio, NOW()
            )
            ON CONFLICT (chofer_id, sucursal_id, presentacion_id) DO UPDATE SET
                cantidad_cargada = public.inventario_chofer.cantidad_cargada + EXCLUDED.cantidad_cargada,
                cantidad_remanente = public.inventario_chofer.cantidad_remanente + EXCLUDED.cantidad_remanente,
                precio_vigente_carga = EXCLUDED.precio_vigente_carga,
                fecha_carga = NOW()
            RETURNING id, cantidad_remanente;
        """)
        res_ch = self.db.execute(stmt_inc_chofer, {
            "cid": chofer_id,
            "sid": sucursal_id,
            "pid": presentacion_id,
            "cant": cantidad,
            "precio": precio_vigente
        }).fetchone()

        return {"chofer_inventario_id": res_ch[0], "nuevo_remanente": Decimal(str(res_ch[1]))}

    def descontar_stock_chofer(self, sucursal_id: int, chofer_id: int, presentacion_id: int, cantidad: float) -> None:
        stmt = text("""
            UPDATE public.inventario_chofer
            SET cantidad_remanente = GREATEST(cantidad_remanente - :cant, 0),
                cantidad_vendida = cantidad_vendida + :cant
            WHERE sucursal_id = :sid AND chofer_id = :cid AND presentacion_id = :pid;
        """)
        self.db.execute(stmt, {
            "sid": sucursal_id,
            "cid": chofer_id,
            "pid": presentacion_id,
            "cant": cantidad
        })

    def DescontarStockChofer(self, sucursal_id: int, chofer_id: int, presentacion_id: int, cantidad: float) -> None:
        self.descontar_stock_chofer(sucursal_id, chofer_id, presentacion_id, cantidad)

    def incrementar_stock_sucursal(self, sucursal_id: int, presentacion_id: int, cantidad: float) -> None:
        stmt = text("""
            INSERT INTO public.inventario_sucursal (sucursal_id, presentacion_id, cantidad_disponible, updated_at)
            VALUES (:sid, :pid, :cant, NOW())
            ON CONFLICT (sucursal_id, presentacion_id) DO UPDATE SET
                cantidad_disponible = public.inventario_sucursal.cantidad_disponible + EXCLUDED.cantidad_disponible,
                updated_at = NOW();
        """)
        self.db.execute(stmt, {"sid": sucursal_id, "pid": presentacion_id, "cant": cantidad})

    def IncrementarStockSucursal(self, sucursal_id: int, presentacion_id: int, cantidad: float) -> None:
        self.incrementar_stock_sucursal(sucursal_id, presentacion_id, cantidad)

    def generar_reporte_inventario_valorizado(self, sucursal_id: int, fecha_corte: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Calcula el valor total del inventario comercial por sucursal a la fecha de corte.
        """
        # Nombre de la sucursal
        sucursal_row = self.caller.LlamarUnRegistro(
            "SELECT nombre FROM public.sucursales WHERE id = :id",
            {"id": sucursal_id}
        )
        sucursal_nombre = sucursal_row["nombre"] if sucursal_row else f"Sucursal #{sucursal_id}"

        sql = """
            SELECT 
                p."IdPresentacion" as presentacion_id,
                p."CodigoPresentacion" as codigo_presentacion,
                prod."NombreProducto" as nombre_producto,
                p."TipoContenedor" as tipo_contenedor,
                p."CantidadRollosUnidades" as unidades_por_paquete,
                COALESCE(inv.cantidad_disponible, 0) as cantidad_disponible,
                COALESCE(pp."PrecioUnitario", 0) as precio_unitario,
                ROUND(COALESCE(inv.cantidad_disponible, 0) * COALESCE(pp."PrecioUnitario", 0), 2) as subtotal_valorizado
            FROM public."PresentacionProducto" p
            JOIN public."Producto" prod ON p."IdProducto" = prod."IdProducto"
            LEFT JOIN public.inventario_sucursal inv ON p."IdPresentacion" = inv.presentacion_id AND inv.sucursal_id = :sid
            LEFT JOIN public."PrecioProducto" pp ON p."IdPresentacion" = pp."IdPresentacion"
                 AND (pp."IdSucursal" = :sid OR pp."IdSucursal" IS NULL)
                 AND pp."Activo" = TRUE
            WHERE COALESCE(inv.cantidad_disponible, 0) > 0 OR pp."PrecioUnitario" IS NOT NULL
            ORDER BY prod."NombreProducto", p."CodigoPresentacion";
        """
        items = self.caller.LlamarFuncion(sql, {"sid": sucursal_id})
        
        total_valor = Decimal("0.00")
        items_formateados = []
        for it in items:
            subtotal = Decimal(str(it["subtotal_valorizado"]))
            total_valor += subtotal
            items_formateados.append({
                "presentacion_id": it["presentacion_id"],
                "codigo_presentacion": it["codigo_presentacion"],
                "nombre_producto": it["nombre_producto"],
                "tipo_contenedor": it["tipo_contenedor"],
                "unidades_por_paquete": it["unidades_por_paquete"],
                "cantidad_disponible": Decimal(str(it["cantidad_disponible"])),
                "precio_unitario": Decimal(str(it["precio_unitario"])),
                "subtotal_valorizado": subtotal
            })

        return {
            "sucursal_id": sucursal_id,
            "sucursal_nombre": sucursal_nombre,
            "fecha_corte": fecha_corte or datetime.now(timezone.utc),
            "total_items": len(items_formateados),
            "valor_total_inventario": total_valor,
            "items": items_formateados
        }
