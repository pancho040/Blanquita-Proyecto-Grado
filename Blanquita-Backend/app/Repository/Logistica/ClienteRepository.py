from sqlalchemy.orm import Session
from app.Repository.DbCaller import DbCaller

class ClienteRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def ListarClientes(self, busqueda: str = "", id_estado: int | None = None) -> list[dict]:
        params = {}
        where_clauses = []

        if busqueda:
            where_clauses.append('(c."RazonSocial" ILIKE :busqueda OR c."NitCi" ILIKE :busqueda OR c."NombreComercial" ILIKE :busqueda)')
            params["busqueda"] = f"%{busqueda}%"

        if id_estado is not None:
            where_clauses.append('c."IdEstadoCliente" = :id_estado')
            params["id_estado"] = id_estado

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        sql = f"""
            SELECT 
                c."IdCliente",
                c."IdEstadoCliente",
                ec."NombreEstado",
                c."RazonSocial",
                c."NombreComercial",
                c."NitCi",
                c."Telefono",
                c."CorreoElectronico",
                c."Direccion",
                c."Latitud",
                c."Longitud",
                c."LimiteCreditoBs",
                c."DiasCredito",
                c."BloqueadoPorMora",
                c."FechaRegistro",
                c."Observacion",
                COUNT(pv."IdPuntoVenta") as "TotalPuntosVenta"
            FROM "Cliente" c
            JOIN "EstadoCliente" ec ON c."IdEstadoCliente" = ec."IdEstadoCliente"
            LEFT JOIN "PuntoVenta" pv ON c."IdCliente" = pv."IdCliente" AND pv."Activo" = TRUE
            {where_sql}
            GROUP BY c."IdCliente", ec."NombreEstado"
            ORDER BY c."RazonSocial" ASC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def ObtenerClientePorId(self, id_cliente: int) -> dict | None:
        sql = """
            SELECT 
                c."IdCliente",
                c."IdEstadoCliente",
                ec."NombreEstado",
                c."RazonSocial",
                c."NombreComercial",
                c."NitCi",
                c."Telefono",
                c."CorreoElectronico",
                c."Direccion",
                c."Latitud",
                c."Longitud",
                c."LimiteCreditoBs",
                c."DiasCredito",
                c."BloqueadoPorMora",
                c."FechaRegistro",
                c."Observacion"
            FROM "Cliente" c
            JOIN "EstadoCliente" ec ON c."IdEstadoCliente" = ec."IdEstadoCliente"
            WHERE c."IdCliente" = :id_cliente;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_cliente": id_cliente})

    def ObtenerClientePorNit(self, nit_ci: str) -> dict | None:
        sql = 'SELECT "IdCliente", "RazonSocial", "NitCi" FROM "Cliente" WHERE "NitCi" = :nit_ci LIMIT 1;'
        return self.caller.LlamarUnRegistro(sql, {"nit_ci": nit_ci})

    def CrearCliente(self, datos: dict, id_usuario_registro: int) -> dict:
        sql = """
            INSERT INTO "Cliente" (
                "IdEstadoCliente", "RazonSocial", "NombreComercial", "NitCi", 
                "Telefono", "CorreoElectronico", "Direccion", "Latitud", "Longitud", 
                "LimiteCreditoBs", "DiasCredito", "IdUsuarioRegistro", "Observacion"
            ) VALUES (
                :IdEstadoCliente, :RazonSocial, :NombreComercial, :NitCi,
                :Telefono, :CorreoElectronico, :Direccion, :Latitud, :Longitud,
                :LimiteCreditoBs, :DiasCredito, :IdUsuarioRegistro, :Observacion
            ) RETURNING "IdCliente";
        """
        params = {
            "IdEstadoCliente": datos.get("IdEstadoCliente", 1),
            "RazonSocial": datos["RazonSocial"],
            "NombreComercial": datos.get("NombreComercial"),
            "NitCi": datos["NitCi"],
            "Telefono": datos.get("Telefono"),
            "CorreoElectronico": datos.get("CorreoElectronico"),
            "Direccion": datos.get("Direccion"),
            "Latitud": datos.get("Latitud"),
            "Longitud": datos.get("Longitud"),
            "LimiteCreditoBs": datos.get("LimiteCreditoBs", 0),
            "DiasCredito": datos.get("DiasCredito", 0),
            "IdUsuarioRegistro": id_usuario_registro,
            "Observacion": datos.get("Observacion")
        }
        res = self.caller.LlamarUnRegistro(sql, params)
        return res

    def ActualizarCliente(self, id_cliente: int, datos: dict) -> dict | None:
        campos = []
        params = {"id_cliente": id_cliente}
        for k, v in datos.items():
            if v is not None:
                campos.append(f'"{k}" = :{k}')
                params[k] = v

        if not campos:
            return self.ObtenerClientePorId(id_cliente)

        sql = f"""
            UPDATE "Cliente"
            SET {", ".join(campos)}
            WHERE "IdCliente" = :id_cliente
            RETURNING "IdCliente";
        """
        return self.caller.LlamarUnRegistro(sql, params)

    def ListarPuntosVentaPorCliente(self, id_cliente: int) -> list[dict]:
        sql = """
            SELECT 
                "IdPuntoVenta", "IdCliente", "NombrePuntoVenta", 
                "Direccion", "Latitud", "Longitud", "Referencia", "Activo"
            FROM "PuntoVenta"
            WHERE "IdCliente" = :id_cliente
            ORDER BY "IdPuntoVenta" ASC;
        """
        return self.caller.LlamarFuncion(sql, {"id_cliente": id_cliente})

    def CrearPuntoVenta(self, id_cliente: int, datos: dict) -> dict:
        sql = """
            INSERT INTO "PuntoVenta" (
                "IdCliente", "NombrePuntoVenta", "Direccion", 
                "Latitud", "Longitud", "Referencia", "Activo"
            ) VALUES (
                :IdCliente, :NombrePuntoVenta, :Direccion,
                :Latitud, :Longitud, :Referencia, :Activo
            ) RETURNING "IdPuntoVenta";
        """
        params = {
            "IdCliente": id_cliente,
            "NombrePuntoVenta": datos["NombrePuntoVenta"],
            "Direccion": datos["Direccion"],
            "Latitud": datos.get("Latitud"),
            "Longitud": datos.get("Longitud"),
            "Referencia": datos.get("Referencia"),
            "Activo": datos.get("Activo", True)
        }
        return self.caller.LlamarUnRegistro(sql, params)

    def ListarTodosPuntosVentaActivos(self) -> list[dict]:
        sql = """
            SELECT 
                pv."IdPuntoVenta",
                pv."IdCliente",
                c."RazonSocial" as "NombreCliente",
                pv."NombrePuntoVenta",
                pv."Direccion",
                pv."Latitud",
                pv."Longitud",
                pv."Referencia"
            FROM "PuntoVenta" pv
            JOIN "Cliente" c ON pv."IdCliente" = c."IdCliente"
            WHERE pv."Activo" = TRUE AND c."IdEstadoCliente" = 1
            ORDER BY c."RazonSocial", pv."NombrePuntoVenta";
        """
        return self.caller.LlamarFuncion(sql, {})
