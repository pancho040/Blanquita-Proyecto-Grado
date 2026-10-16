from sqlalchemy.orm import Session
from app.Repository.DbCaller import DbCaller

class CuentasPagarRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    # --- Proveedores ---
    def ListarProveedores(self) -> list[dict]:
        sql = """
            SELECT p."IdProveedor", p."NombreProveedor", p."CelularProveedor", p."CorreoProveedor",
                   p."IdEstadoProveedor", ep."NombreEstadoProveedor"
            FROM "Proveedor" p
            JOIN "EstadoProveedor" ep ON p."IdEstadoProveedor" = ep."IdEstadoProveedor"
            ORDER BY p."NombreProveedor" ASC;
        """
        return self.caller.LlamarFuncion(sql)

    def ObtenerProveedorPorNombre(self, nombre: str) -> dict | None:
        sql = """
            SELECT * FROM "Proveedor" WHERE "NombreProveedor" ILIKE :nombre LIMIT 1;
        """
        return self.caller.LlamarUnRegistro(sql, {"nombre": f"%{nombre}%"})

    def AsegurarProveedor(self, nombre: str) -> int:
        prov = self.ObtenerProveedorPorNombre(nombre)
        if prov:
            return prov["IdProveedor"]
        sql = """
            INSERT INTO "Proveedor" ("NombreProveedor", "IdEstadoProveedor")
            VALUES (:nombre, 1)
            RETURNING "IdProveedor";
        """
        res = self.caller.LlamarUnRegistro(sql, {"nombre": nombre})
        return res["IdProveedor"]


    # --- Cuentas por Pagar a Proveedores ---
    def ListarCuentasPagar(self, id_proveedor: int | None = None, estado: str | None = None,
                           fecha_inicio = None, fecha_fin = None) -> list[dict]:
        where_clauses = []
        params = {}

        if id_proveedor is not None:
            where_clauses.append('cxp."IdProveedor" = :id_proveedor')
            params["id_proveedor"] = id_proveedor
        if estado:
            where_clauses.append('cxp."Estado" = :estado')
            params["estado"] = estado
        if fecha_inicio:
            where_clauses.append('cxp."FechaRecepcion" >= :fecha_inicio')
            params["fecha_inicio"] = fecha_inicio
        if fecha_fin:
            where_clauses.append('cxp."FechaRecepcion" <= :fecha_fin')
            params["fecha_fin"] = fecha_fin

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        sql = f"""
            SELECT cxp.*, p."NombreProveedor"
            FROM "CuentaPagarProveedor" cxp
            JOIN "Proveedor" p ON cxp."IdProveedor" = p."IdProveedor"
            {where_sql}
            ORDER BY cxp."FechaRecepcion" DESC, cxp."IdCuentaPagar" DESC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def ObtenerCuentaPagarPorId(self, id_cxp: int) -> dict | None:
        sql = """
            SELECT cxp.*, p."NombreProveedor"
            FROM "CuentaPagarProveedor" cxp
            JOIN "Proveedor" p ON cxp."IdProveedor" = p."IdProveedor"
            WHERE cxp."IdCuentaPagar" = :id_cxp;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_cxp": id_cxp})

    def CrearCuentaPagar(self, datos: dict, id_usuario: int | None = None) -> dict:
        sql = """
            INSERT INTO "CuentaPagarProveedor" (
                "IdProveedor", "FechaRecepcion", "FechaEnvio", "NumeroNota",
                "NumeroFactura", "ConceptoMaterial", "PesoTotalKgr", "CantidadUnidades",
                "PrecioUnitario", "Descuento", "PrecioFacturado", "TotalPagado",
                "SaldoPendiente", "Estado", "BancoPago", "Observacion", "IdUsuarioRegistro"
            ) VALUES (
                :IdProveedor, :FechaRecepcion, :FechaEnvio, :NumeroNota,
                :NumeroFactura, :ConceptoMaterial, :PesoTotalKgr, :CantidadUnidades,
                :PrecioUnitario, :Descuento, :PrecioFacturado, :TotalPagado,
                :SaldoPendiente, :Estado, :BancoPago, :Observacion, :IdUsuarioRegistro
            )
            RETURNING *;
        """
        payload = dict(datos)
        payload["IdUsuarioRegistro"] = id_usuario
        payload["TotalPagado"] = payload.get("TotalPagado", 0.0)
        payload["SaldoPendiente"] = payload["PrecioFacturado"] - payload["TotalPagado"]
        payload["Estado"] = "PAGADO" if payload["SaldoPendiente"] <= 0 else "PENDIENTE"
        return self.caller.LlamarUnRegistro(sql, payload)

    def CrearDetalleInsumos(self, id_cxp: int, items: list[dict]):
        for item in items:
            sql = """
                INSERT INTO "DetalleInsumoCuentaPagar" (
                    "IdCuentaPagar", "DescripcionInsumo", "MedidaOFormato", "Cantidad",
                    "PesoKgr", "PrecioUnitario", "Subtotal"
                ) VALUES (
                    :id_cxp, :DescripcionInsumo, :MedidaOFormato, :Cantidad,
                    :PesoKgr, :PrecioUnitario, :Subtotal
                );
            """
            self.caller.LlamarFuncion(sql, {
                "id_cxp": id_cxp,
                "DescripcionInsumo": item["DescripcionInsumo"],
                "MedidaOFormato": item.get("MedidaOFormato"),
                "Cantidad": item.get("Cantidad", 0.0),
                "PesoKgr": item.get("PesoKgr", 0.0),
                "PrecioUnitario": item.get("PrecioUnitario", 0.0),
                "Subtotal": item.get("Subtotal", 0.0)
            })

    def ListarDetallesInsumos(self, id_cxp: int) -> list[dict]:
        sql = """
            SELECT * FROM "DetalleInsumoCuentaPagar" WHERE "IdCuentaPagar" = :id_cxp;
        """
        return self.caller.LlamarFuncion(sql, {"id_cxp": id_cxp})


    # --- Pagos a Proveedores ---
    def RegistrarPagoProveedor(self, datos: dict, id_usuario: int | None = None) -> dict:
        sql = """
            INSERT INTO "PagoCuentaPagar" (
                "IdCuentaPagar", "IdCuentaBancaria", "IdMovimientoCaja", "MontoPagado",
                "FechaPago", "BancoSigla", "NumeroTransaccion", "EsCompensacion",
                "DetalleCompensacion", "Observacion", "IdUsuario"
            ) VALUES (
                :IdCuentaPagar, :IdCuentaBancaria, :IdMovimientoCaja, :MontoPagado,
                :FechaPago, :BancoSigla, :NumeroTransaccion, :EsCompensacion,
                :DetalleCompensacion, :Observacion, :IdUsuario
            )
            RETURNING *;
        """
        payload = dict(datos)
        payload["IdUsuario"] = id_usuario
        pago = self.caller.LlamarUnRegistro(sql, payload)

        # Actualizar saldo en la cuenta por pagar
        sql_update = """
            UPDATE "CuentaPagarProveedor"
            SET "TotalPagado" = "TotalPagado" + :monto,
                "SaldoPendiente" = GREATEST("PrecioFacturado" - ("TotalPagado" + :monto), 0),
                "Estado" = CASE 
                    WHEN GREATEST("PrecioFacturado" - ("TotalPagado" + :monto), 0) = 0 THEN 
                        CASE WHEN :es_comp THEN 'COMPENSADO' ELSE 'PAGADO' END
                    ELSE 'PARCIAL'
                END,
                "FechaPago" = :fecha_pago,
                "BancoPago" = COALESCE(:banco, "BancoPago")
            WHERE "IdCuentaPagar" = :id_cxp;
        """
        self.caller.LlamarFuncion(sql_update, {
            "id_cxp": datos["IdCuentaPagar"],
            "monto": datos["MontoPagado"],
            "es_comp": datos.get("EsCompensacion", False),
            "fecha_pago": datos.get("FechaPago"),
            "banco": datos.get("BancoSigla")
        })

        return pago

    def ListarPagosPorCuenta(self, id_cxp: int) -> list[dict]:
        sql = """
            SELECT p.*, b."NombreBanco"
            FROM "PagoCuentaPagar" p
            LEFT JOIN "CuentaBancariaEmpresa" b ON p."IdCuentaBancaria" = b."IdCuentaBancaria"
            WHERE p."IdCuentaPagar" = :id_cxp
            ORDER BY p."FechaPago" ASC;
        """
        return self.caller.LlamarFuncion(sql, {"id_cxp": id_cxp})


    # --- Devoluciones a Proveedores ---
    def RegistrarDevolucion(self, datos: dict) -> dict:
        sql = """
            INSERT INTO "DevolucionProveedor" (
                "IdProveedor", "FechaDevolucion", "ProductoMaterial",
                "Motivo", "TotalPesoKgr", "TotalPaquetes", "Observacion"
            ) VALUES (
                :IdProveedor, :FechaDevolucion, :ProductoMaterial,
                :Motivo, :TotalPesoKgr, :TotalPaquetes, :Observacion
            )
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, datos)

    def ListarDevoluciones(self, id_proveedor: int | None = None) -> list[dict]:
        where_sql = "WHERE d.\"IdProveedor\" = :id_proveedor" if id_proveedor else ""
        sql = f"""
            SELECT d.*, p."NombreProveedor"
            FROM "DevolucionProveedor" d
            JOIN "Proveedor" p ON d."IdProveedor" = p."IdProveedor"
            {where_sql}
            ORDER BY d."FechaDevolucion" DESC;
        """
        params = {"id_proveedor": id_proveedor} if id_proveedor else {}
        return self.caller.LlamarFuncion(sql, params)
