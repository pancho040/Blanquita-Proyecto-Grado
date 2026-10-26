from sqlalchemy.orm import Session
from app.Repository.DbCaller import DbCaller

class PrecioRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def ListarPreciosVigentes(self) -> list[dict]:
        sql = """
            SELECT 
                p."IdPresentacion",
                prod."NombreProducto",
                p."TipoContenedor",
                p."CantidadRollosUnidades",
                p."CodigoPresentacion",
                pp."IdPrecioProducto",
                pp."PrecioUnitario",
                pp."PrecioMayorista",
                pp."CantidadMinimaMayorista",
                pp."VigenteDesde",
                COALESCE(pp."Activo", FALSE) as "Activo"
            FROM "PresentacionProducto" p
            JOIN "Producto" prod ON p."IdProducto" = prod."IdProducto"
            LEFT JOIN "PrecioProducto" pp ON p."IdPresentacion" = pp."IdPresentacion" AND pp."Activo" = TRUE
            ORDER BY prod."NombreProducto", p."TipoContenedor";
        """
        return self.caller.LlamarFuncion(sql, {})

    def GuardarPrecio(self, datos: dict, id_usuario: int | None = None) -> dict:
        id_presentacion = datos["IdPresentacion"]
        
        # Obtener precio anterior para trazabilidad de auditoría (HU-17)
        sql_ant = 'SELECT "PrecioUnitario", "PrecioMayorista" FROM "PrecioProducto" WHERE "IdPresentacion" = :id_p AND "Activo" = TRUE LIMIT 1;'
        precio_ant = self.caller.LlamarUnRegistro(sql_ant, {"id_p": id_presentacion})
        precio_ant_val = float(precio_ant["PrecioUnitario"]) if precio_ant else 0.0

        # Desactivar precio anterior vigente
        self.caller.LlamarFuncion(
            'UPDATE "PrecioProducto" SET "Activo" = FALSE WHERE "IdPresentacion" = :id_presentacion;',
            {"id_presentacion": id_presentacion}
        )

        # Insertar nuevo precio
        sql = """
            INSERT INTO "PrecioProducto" (
                "IdPresentacion", "PrecioUnitario", "PrecioMayorista",
                "CantidadMinimaMayorista", "VigenteDesde", "Activo"
            ) VALUES (
                :IdPresentacion, :PrecioUnitario, :PrecioMayorista,
                :CantidadMinimaMayorista, :VigenteDesde, TRUE
            ) RETURNING "IdPrecioProducto";
        """
        res = self.caller.LlamarUnRegistro(sql, datos)

        # HU-17: Registrar auditoría de cambio de precio
        try:
            from sqlalchemy import text
            sql_audit = '''
                INSERT INTO "AuditLog" ("IdUsuario", "Accion", "TablaAfectada", "IdRegistroAfectado", "Detalle", "FechaHora")
                VALUES (:id_u, 'MODIFICACION_PRECIO', 'PrecioProducto', :id_reg, :det, NOW());
            '''
            self.caller.db.execute(text(sql_audit), {
                "id_u": id_usuario or 1,
                "id_reg": str(id_presentacion),
                "det": f"Actualización de precio unitario en presentación #{id_presentacion}. Precio anterior: Bs. {precio_ant_val:.2f} -> Nuevo precio: Bs. {datos['PrecioUnitario']:.2f} (Mayorista: Bs. {datos.get('PrecioMayorista', 0):.2f})."
            })
            self.caller.db.commit()
        except Exception:
            pass

        return res

    def ListarHistorialPrecios(self, id_presentacion: int) -> list[dict]:
        """HU-17: Histórico de precios con fechas de vigencia."""
        sql = """
            SELECT 
                pp."IdPrecioProducto",
                pp."IdPresentacion",
                pp."PrecioUnitario",
                pp."PrecioMayorista",
                pp."CantidadMinimaMayorista",
                pp."VigenteDesde",
                pp."Activo"
            FROM "PrecioProducto" pp
            WHERE pp."IdPresentacion" = :id_p
            ORDER BY pp."VigenteDesde" DESC, pp."IdPrecioProducto" DESC;
        """
        return self.caller.LlamarFuncion(sql, {"id_p": id_presentacion})
