from datetime import date
from sqlalchemy.orm import Session
from app.Repository.DbCaller import DbCaller

class RutaRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    # -------------------------------------------------------------
    # ZONAS
    # -------------------------------------------------------------
    def ListarZonas(self) -> list[dict]:
        sql = """
            SELECT 
                z."IdZonaDistribucion",
                z."NombreZona",
                z."Ciudad",
                z."Descripcion",
                z."Activa",
                COUNT(r."IdRutaDistribucion") as "TotalRutas"
            FROM "ZonaDistribucion" z
            LEFT JOIN "RutaDistribucion" r ON z."IdZonaDistribucion" = r."IdZonaDistribucion" AND r."Activa" = TRUE
            GROUP BY z."IdZonaDistribucion"
            ORDER BY z."NombreZona" ASC;
        """
        return self.caller.LlamarFuncion(sql, {})

    def CrearZona(self, datos: dict) -> dict:
        sql = """
            INSERT INTO "ZonaDistribucion" ("NombreZona", "Ciudad", "Descripcion", "Activa")
            VALUES (:NombreZona, :Ciudad, :Descripcion, :Activa)
            RETURNING "IdZonaDistribucion";
        """
        return self.caller.LlamarUnRegistro(sql, datos)

    # -------------------------------------------------------------
    # RUTAS
    # -------------------------------------------------------------
    def ListarRutas(self, id_zona: int | None = None) -> list[dict]:
        params = {}
        where_sql = ""
        if id_zona is not None:
            where_sql = 'WHERE r."IdZonaDistribucion" = :id_zona'
            params["id_zona"] = id_zona

        sql = f"""
            SELECT 
                r."IdRutaDistribucion",
                r."IdZonaDistribucion",
                z."NombreZona",
                r."NombreRuta",
                r."DiaSemana",
                r."Descripcion",
                r."Activa",
                COUNT(rpv."IdPuntoVenta") as "TotalPuntosVenta"
            FROM "RutaDistribucion" r
            JOIN "ZonaDistribucion" z ON r."IdZonaDistribucion" = z."IdZonaDistribucion"
            LEFT JOIN "RutaPuntoVenta" rpv ON r."IdRutaDistribucion" = rpv."IdRutaDistribucion"
            {where_sql}
            GROUP BY r."IdRutaDistribucion", z."NombreZona"
            ORDER BY r."NombreRuta" ASC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def ObtenerRutaPorId(self, id_ruta: int) -> dict | None:
        sql = """
            SELECT 
                r."IdRutaDistribucion",
                r."IdZonaDistribucion",
                z."NombreZona",
                r."NombreRuta",
                r."DiaSemana",
                r."Descripcion",
                r."Activa"
            FROM "RutaDistribucion" r
            JOIN "ZonaDistribucion" z ON r."IdZonaDistribucion" = z."IdZonaDistribucion"
            WHERE r."IdRutaDistribucion" = :id_ruta;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_ruta": id_ruta})

    def CrearRuta(self, datos: dict) -> dict:
        sql = """
            INSERT INTO "RutaDistribucion" (
                "IdZonaDistribucion", "NombreRuta", "DiaSemana", "Descripcion", "Activa"
            ) VALUES (
                :IdZonaDistribucion, :NombreRuta, :DiaSemana, :Descripcion, :Activa
            ) RETURNING "IdRutaDistribucion";
        """
        return self.caller.LlamarUnRegistro(sql, datos)

    def ActualizarRuta(self, id_ruta: int, datos: dict) -> dict | None:
        campos = []
        params = {"id_ruta": id_ruta}
        for k, v in datos.items():
            if v is not None:
                campos.append(f'"{k}" = :{k}')
                params[k] = v

        if not campos:
            return self.ObtenerRutaPorId(id_ruta)

        sql = f"""
            UPDATE "RutaDistribucion"
            SET {", ".join(campos)}
            WHERE "IdRutaDistribucion" = :id_ruta
            RETURNING "IdRutaDistribucion";
        """
        return self.caller.LlamarUnRegistro(sql, params)

    # -------------------------------------------------------------
    # PUNTOS DE VENTA POR RUTA (ITINERARIO)
    # -------------------------------------------------------------
    def ListarPuntosVentaRuta(self, id_ruta: int) -> list[dict]:
        sql = """
            SELECT 
                rpv."IdRutaPuntoVenta",
                rpv."IdRutaDistribucion",
                rpv."IdPuntoVenta",
                rpv."OrdenVisita",
                pv."NombrePuntoVenta",
                c."RazonSocial" as "NombreCliente",
                pv."Direccion",
                pv."Latitud",
                pv."Longitud"
            FROM "RutaPuntoVenta" rpv
            JOIN "PuntoVenta" pv ON rpv."IdPuntoVenta" = pv."IdPuntoVenta"
            JOIN "Cliente" c ON pv."IdCliente" = c."IdCliente"
            WHERE rpv."IdRutaDistribucion" = :id_ruta
            ORDER BY rpv."OrdenVisita" ASC;
        """
        return self.caller.LlamarFuncion(sql, {"id_ruta": id_ruta})

    def GuardarPuntosVentaRuta(self, id_ruta: int, puntos: list[dict]) -> None:
        # Eliminar asignaciones previas de la ruta
        self.caller.LlamarFuncion(
            'DELETE FROM "RutaPuntoVenta" WHERE "IdRutaDistribucion" = :id_ruta;',
            {"id_ruta": id_ruta}
        )
        # Insertar nuevas
        for p in puntos:
            self.caller.LlamarFuncion(
                """
                INSERT INTO "RutaPuntoVenta" ("IdRutaDistribucion", "IdPuntoVenta", "OrdenVisita")
                VALUES (:id_ruta, :id_pv, :orden)
                ON CONFLICT ("IdRutaDistribucion", "IdPuntoVenta") 
                DO UPDATE SET "OrdenVisita" = EXCLUDED."OrdenVisita";
                """,
                {"id_ruta": id_ruta, "id_pv": p["IdPuntoVenta"], "orden": p["OrdenVisita"]}
            )

    # -------------------------------------------------------------
    # ASIGNACIONES DIARIAS A REPARTIDORES
    # -------------------------------------------------------------
    def ListarAsignaciones(self, fecha: date | None = None, id_repartidor: int | None = None) -> list[dict]:
        params = {}
        where_clauses = []
        if fecha:
            where_clauses.append('ar."FechaAsignacion" = :fecha')
            params["fecha"] = fecha
        if id_repartidor:
            where_clauses.append('ar."IdUsuarioRepartidor" = :id_repartidor')
            params["id_repartidor"] = id_repartidor

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        sql = f"""
            SELECT 
                ar."IdAsignacionRuta",
                ar."IdRutaDistribucion",
                r."NombreRuta",
                z."NombreZona",
                ar."IdUsuarioRepartidor",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "NombreRepartidor",
                ar."FechaAsignacion",
                ar."Estado",
                ar."KilometrajeInicial",
                ar."KilometrajeFinal",
                ar."Observacion"
            FROM "AsignacionRuta" ar
            JOIN "RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
            JOIN "ZonaDistribucion" z ON r."IdZonaDistribucion" = z."IdZonaDistribucion"
            JOIN "Usuario" u ON ar."IdUsuarioRepartidor" = u."IdUsuario"
            {where_sql}
            ORDER BY ar."FechaAsignacion" DESC, r."NombreRuta" ASC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def CrearAsignacion(self, datos: dict, id_usuario_asigna: int) -> dict:
        sql = """
            INSERT INTO "AsignacionRuta" (
                "IdRutaDistribucion", "IdUsuarioRepartidor", "FechaAsignacion",
                "IdUsuarioAsigna", "KilometrajeInicial", "Observacion"
            ) VALUES (
                :IdRutaDistribucion, :IdUsuarioRepartidor, :FechaAsignacion,
                :IdUsuarioAsigna, :KilometrajeInicial, :Observacion
            ) RETURNING "IdAsignacionRuta";
        """
        params = {
            "IdRutaDistribucion": datos["IdRutaDistribucion"],
            "IdUsuarioRepartidor": datos["IdUsuarioRepartidor"],
            "FechaAsignacion": datos["FechaAsignacion"],
            "IdUsuarioAsigna": id_usuario_asigna,
            "KilometrajeInicial": datos.get("KilometrajeInicial"),
            "Observacion": datos.get("Observacion")
        }
        return self.caller.LlamarUnRegistro(sql, params)

    def ListarRepartidoresActivos(self) -> list[dict]:
        sql = """
            SELECT 
                u."IdUsuario",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno", ' ', COALESCE(u."ApellidoMaterno", '')) as "NombreCompleto",
                u."Celular",
                u."Ci"
            FROM "Usuario" u
            WHERE u."IdRol" = 6 AND u."IdEstadoUsuario" = 1
            ORDER BY u."PrimerNombre" ASC;
        """
        return self.caller.LlamarFuncion(sql, {})
