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

    def GuardarPrecio(self, datos: dict) -> dict:
        id_presentacion = datos["IdPresentacion"]
        
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
        return self.caller.LlamarUnRegistro(sql, datos)
