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
                COUNT(rpv."IdPuntoVenta") as "TotalPuntosVenta",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'IdRutaPuntoVenta', rpv."IdRutaPuntoVenta",
                            'IdPuntoVenta', pv."IdPuntoVenta",
                            'OrdenVisita', rpv."OrdenVisita",
                            'NombrePuntoVenta', pv."NombrePuntoVenta",
                            'NombreCliente', c."RazonSocial",
                            'Direccion', pv."Direccion",
                            'Latitud', pv."Latitud",
                            'Longitud', pv."Longitud"
                        ) ORDER BY rpv."OrdenVisita" ASC
                    ) FILTER (WHERE rpv."IdPuntoVenta" IS NOT NULL),
                    '[]'::json
                ) as "PuntosVenta"
            FROM "RutaDistribucion" r
            JOIN "ZonaDistribucion" z ON r."IdZonaDistribucion" = z."IdZonaDistribucion"
            LEFT JOIN "RutaPuntoVenta" rpv ON r."IdRutaDistribucion" = rpv."IdRutaDistribucion"
            LEFT JOIN "PuntoVenta" pv ON rpv."IdPuntoVenta" = pv."IdPuntoVenta"
            LEFT JOIN "Cliente" c ON pv."IdCliente" = c."IdCliente"
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

    def ActualizarAsignacion(self, id_asignacion: int, datos: dict) -> dict:
        campos = []
        params = {"id_asignacion": id_asignacion}
        if "Estado" in datos and datos["Estado"] is not None:
            campos.append('"Estado" = :Estado')
            params["Estado"] = datos["Estado"]
        if "KilometrajeFinal" in datos and datos["KilometrajeFinal"] is not None:
            campos.append('"KilometrajeFinal" = :KilometrajeFinal')
            params["KilometrajeFinal"] = datos["KilometrajeFinal"]
        if "Observacion" in datos and datos["Observacion"] is not None:
            campos.append('"Observacion" = :Observacion')
            params["Observacion"] = datos["Observacion"]
        if not campos:
            return {"IdAsignacionRuta": id_asignacion}
        sql = f"""
            UPDATE "AsignacionRuta"
            SET {', '.join(campos)}
            WHERE "IdAsignacionRuta" = :id_asignacion
            RETURNING "IdAsignacionRuta", "Estado", "KilometrajeFinal", "Observacion";
        """
        return self.caller.LlamarUnRegistro(sql, params)

    def ListarRepartidoresActivos(self) -> list[dict]:
        sql = """
            SELECT 
                u."IdUsuario",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno", ' ', COALESCE(u."ApellidoMaterno", '')) as "NombreCompleto",
                u."PrimerNombre",
                u."SegundoNombre",
                u."ApellidoPaterno",
                u."ApellidoMaterno",
                u."Celular",
                u."Ci",
                u."IdEstadoUsuario",
                CASE WHEN u."IdEstadoUsuario" = 1 THEN 'Activo' ELSE 'Inactivo' END as "Estado",
                (SELECT COUNT(*) FROM "AsignacionRuta" ar WHERE ar."IdUsuarioRepartidor" = u."IdUsuario") as "TotalAsignaciones"
            FROM "Usuario" u
            WHERE u."IdRol" = 6
            ORDER BY u."IdEstadoUsuario" ASC, u."PrimerNombre" ASC;
        """
        return self.caller.LlamarFuncion(sql, {})

    def CrearRepartidor(self, datos: dict, clave_hash: str) -> dict:
        sql = """
            INSERT INTO "Usuario" (
                "Ci", "PrimerNombre", "SegundoNombre", "ApellidoPaterno", "ApellidoMaterno",
                "Celular", "IdRol", "IdEstadoUsuario", "Clave", "IsAdmin"
            ) VALUES (
                :Ci, :PrimerNombre, :SegundoNombre, :ApellidoPaterno, :ApellidoMaterno,
                :Celular, 6, 1, :Clave, false
            ) RETURNING "IdUsuario", "Ci", "PrimerNombre", "ApellidoPaterno", "Celular";
        """
        params = {
            "Ci": datos["Ci"],
            "PrimerNombre": datos["PrimerNombre"],
            "SegundoNombre": datos.get("SegundoNombre"),
            "ApellidoPaterno": datos["ApellidoPaterno"],
            "ApellidoMaterno": datos.get("ApellidoMaterno"),
            "Celular": datos.get("Celular"),
            "Clave": clave_hash
        }
        return self.caller.LlamarUnRegistro(sql, params)

    def CambiarEstadoRepartidor(self, id_usuario: int, id_estado: int) -> dict:
        sql = """
            UPDATE "Usuario"
            SET "IdEstadoUsuario" = :id_estado
            WHERE "IdUsuario" = :id_usuario AND "IdRol" = 6
            RETURNING "IdUsuario", "IdEstadoUsuario";
        """
        return self.caller.LlamarUnRegistro(sql, {"id_usuario": id_usuario, "id_estado": id_estado})

    # -------------------------------------------------------------
    # TELEMETRÍA Y RASTREO GPS EN VIVO (HU-30, HU-33)
    # -------------------------------------------------------------
    def RegistrarTelemetriaPing(self, datos: dict) -> dict:
        id_asig = datos.get("IdAsignacionRuta")
        if not id_asig:
            sql_asig = """
                SELECT "IdAsignacionRuta" 
                FROM "AsignacionRuta" 
                WHERE "IdUsuarioRepartidor" = :id_rep 
                  AND ("FechaAsignacion" = CURRENT_DATE OR "Estado" = 'En Ruta')
                ORDER BY "FechaAsignacion" DESC, "IdAsignacionRuta" DESC 
                LIMIT 1;
            """
            asig_row = self.caller.LlamarUnRegistro(sql_asig, {"id_rep": datos["IdUsuarioRepartidor"]})
            if asig_row and asig_row.get("IdAsignacionRuta"):
                id_asig = asig_row["IdAsignacionRuta"]

        sql = """
            INSERT INTO "TrackingChofer" (
                "IdUsuarioRepartidor", "IdAsignacionRuta", "Latitud", "Longitud",
                "Velocidad", "Bateria", "EstadoMovimiento", "DireccionAproximada",
                "ParadaActual", "TotalParadas", "ParadasCompletadas", "MontoCobradoTotal",
                "UltimaActualizacion"
            ) VALUES (
                :IdUsuarioRepartidor, :IdAsignacionRuta, :Latitud, :Longitud,
                :Velocidad, :Bateria, :EstadoMovimiento, :DireccionAproximada,
                COALESCE(:ParadaActual, 1), 
                COALESCE(:TotalParadas, (
                    SELECT COUNT(*) FROM "RutaPuntoVenta" rpv 
                    JOIN "AsignacionRuta" ar ON ar."IdRutaDistribucion" = rpv."IdRutaDistribucion" 
                    WHERE ar."IdAsignacionRuta" = :IdAsignacionRuta
                ), 0),
                COALESCE(:ParadasCompletadas, 0), 
                COALESCE(:MontoCobradoTotal, 0.0), 
                NOW()
            )
            ON CONFLICT ("IdUsuarioRepartidor") DO UPDATE SET
                "IdAsignacionRuta" = COALESCE(EXCLUDED."IdAsignacionRuta", "TrackingChofer"."IdAsignacionRuta"),
                "Latitud" = EXCLUDED."Latitud",
                "Longitud" = EXCLUDED."Longitud",
                "Velocidad" = EXCLUDED."Velocidad",
                "Bateria" = EXCLUDED."Bateria",
                "EstadoMovimiento" = EXCLUDED."EstadoMovimiento",
                "DireccionAproximada" = COALESCE(EXCLUDED."DireccionAproximada", "TrackingChofer"."DireccionAproximada"),
                "ParadaActual" = COALESCE(EXCLUDED."ParadaActual", "TrackingChofer"."ParadaActual"),
                "TotalParadas" = CASE 
                    WHEN EXCLUDED."TotalParadas" > 0 THEN EXCLUDED."TotalParadas" 
                    ELSE "TrackingChofer"."TotalParadas" 
                END,
                "ParadasCompletadas" = COALESCE(EXCLUDED."ParadasCompletadas", "TrackingChofer"."ParadasCompletadas"),
                "MontoCobradoTotal" = COALESCE(EXCLUDED."MontoCobradoTotal", "TrackingChofer"."MontoCobradoTotal"),
                "UltimaActualizacion" = NOW()
            RETURNING *;
        """
        params = {
            "IdUsuarioRepartidor": datos["IdUsuarioRepartidor"],
            "IdAsignacionRuta": id_asig,
            "Latitud": datos["Latitud"],
            "Longitud": datos["Longitud"],
            "Velocidad": datos.get("Velocidad", 0.0),
            "Bateria": datos.get("Bateria", 100),
            "EstadoMovimiento": datos.get("EstadoMovimiento", "En Ruta"),
            "DireccionAproximada": datos.get("DireccionAproximada"),
            "ParadaActual": datos.get("ParadaActual"),
            "TotalParadas": datos.get("TotalParadas"),
            "ParadasCompletadas": datos.get("ParadasCompletadas"),
            "MontoCobradoTotal": datos.get("MontoCobradoTotal")
        }
        return self.caller.LlamarUnRegistro(sql, params)

    def ObtenerChoferesEnVivo(self) -> list[dict]:
        sql = """
            SELECT 
                COALESCE(t."IdTracking", 0) as "IdTracking",
                u."IdUsuario" as "IdUsuarioRepartidor",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "NombreRepartidor",
                u."Celular",
                COALESCE(t."IdAsignacionRuta", ar."IdAsignacionRuta") as "IdAsignacionRuta",
                COALESCE(r."NombreRuta", 'Sin Ruta Asignada') as "NombreRuta",
                COALESCE(z."NombreZona", 'Sucre') as "NombreZona",
                COALESCE(ar."Estado", 'Sin Asignación') as "EstadoAsignacion",
                COALESCE(t."Latitud", -19.0435) as "Latitud",
                COALESCE(t."Longitud", -65.2580) as "Longitud",
                COALESCE(t."Velocidad", 0.0) as "Velocidad",
                COALESCE(t."Bateria", 100) as "Bateria",
                COALESCE(t."EstadoMovimiento", 'En Base') as "EstadoMovimiento",
                COALESCE(t."DireccionAproximada", 'Planta Central Sucre') as "DireccionAproximada",
                COALESCE(t."ParadaActual", 1) as "ParadaActual",
                COALESCE(t."TotalParadas", (
                    SELECT COUNT(*) FROM "RutaPuntoVenta" rpv 
                    WHERE rpv."IdRutaDistribucion" = r."IdRutaDistribucion"
                ), 0) as "TotalParadas",
                COALESCE(t."ParadasCompletadas", 0) as "ParadasCompletadas",
                COALESCE(t."MontoCobradoTotal", 0.0) as "MontoCobradoTotal",
                COALESCE(t."UltimaActualizacion", NOW()) as "UltimaActualizacion",
                COALESCE(ROUND(EXTRACT(EPOCH FROM (NOW() - t."UltimaActualizacion")))::INTEGER, 0) as "SegundosDesdeUltimoReporte"
            FROM "Usuario" u
            LEFT JOIN "TrackingChofer" t ON t."IdUsuarioRepartidor" = u."IdUsuario"
            LEFT JOIN "AsignacionRuta" ar ON (ar."IdUsuarioRepartidor" = u."IdUsuario" AND ar."FechaAsignacion" = CURRENT_DATE)
            LEFT JOIN "RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
            LEFT JOIN "ZonaDistribucion" z ON r."IdZonaDistribucion" = z."IdZonaDistribucion"
            WHERE u."IdRol" = 6 AND u."IdEstadoUsuario" = 1
            ORDER BY t."UltimaActualizacion" DESC NULLS LAST, u."PrimerNombre" ASC;
        """
        return self.caller.LlamarFuncion(sql, {})

    def ObtenerTrackingPorAsignacion(self, id_asignacion: int) -> dict:
        sql_asig = """
            SELECT 
                ar."IdAsignacionRuta",
                ar."FechaAsignacion",
                ar."Estado" as "EstadoAsignacion",
                ar."KilometrajeInicial",
                ar."KilometrajeFinal",
                ar."Observacion",
                r."IdRutaDistribucion",
                r."NombreRuta",
                '#20A7DB' as "ColorHex",
                z."NombreZona",
                u."IdUsuario" as "IdUsuarioRepartidor",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "NombreRepartidor",
                u."Celular" as "CelularRepartidor",
                COALESCE(t."Latitud", -19.0330) as "LatitudChofer",
                COALESCE(t."Longitud", -65.2550) as "LongitudChofer",
                COALESCE(t."Velocidad", 0) as "Velocidad",
                COALESCE(t."Bateria", 100) as "Bateria",
                COALESCE(t."EstadoMovimiento", 'En Espera') as "EstadoMovimiento",
                t."UltimaActualizacion",
                ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(t."UltimaActualizacion", NOW()))))::INTEGER as "SegundosDesdeUltimoReporte"
            FROM "AsignacionRuta" ar
            JOIN "RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
            JOIN "ZonaDistribucion" z ON r."IdZonaDistribucion" = z."IdZonaDistribucion"
            JOIN "Usuario" u ON ar."IdUsuarioRepartidor" = u."IdUsuario"
            LEFT JOIN "TrackingChofer" t ON t."IdUsuarioRepartidor" = u."IdUsuario"
            WHERE ar."IdAsignacionRuta" = :id_asignacion;
        """
        asig = self.caller.LlamarUnRegistro(sql_asig, {"id_asignacion": id_asignacion})
        if not asig:
            return None

        sql_paradas = """
            SELECT 
                rpv."OrdenVisita",
                pv."IdPuntoVenta",
                pv."NombrePuntoVenta",
                pv."Direccion",
                pv."Latitud",
                pv."Longitud",
                pv."Referencia",
                c."IdCliente",
                COALESCE(c."NombreComercial", c."RazonSocial") as "NombreCliente",
                c."Telefono" as "TelefonoCliente",
                p."IdPedido",
                p."NumeroPedido",
                p."MontoTotal" as "MontoPedido",
                p."IdEstadoPedido",
                CASE 
                    WHEN p."IdEstadoPedido" = 3 THEN 'Entregado'
                    WHEN p."IdEstadoPedido" = 2 THEN 'En Camino'
                    WHEN p."IdEstadoPedido" = 4 THEN 'Cancelado'
                    WHEN p."IdPedido" IS NOT NULL THEN 'Pendiente'
                    ELSE 'Visita Comercial'
                END as "EstadoEntrega",
                p."LatitudEntrega",
                p."LongitudEntrega",
                p."FechaEntrega",
                COALESCE((
                    SELECT SUM(pp."Monto") 
                    FROM "PagoPedido" pp 
                    WHERE pp."IdPedido" = p."IdPedido"
                ), 0) as "MontoCobrado"
            FROM "RutaPuntoVenta" rpv
            JOIN "PuntoVenta" pv ON rpv."IdPuntoVenta" = pv."IdPuntoVenta"
            JOIN "Cliente" c ON pv."IdCliente" = c."IdCliente"
            LEFT JOIN "Pedido" p ON p."IdPuntoVenta" = pv."IdPuntoVenta" AND p."IdAsignacionRuta" = :id_asignacion
            WHERE rpv."IdRutaDistribucion" = :id_ruta
            ORDER BY rpv."OrdenVisita" ASC;
        """
        paradas = self.caller.LlamarFuncion(sql_paradas, {
            "id_ruta": asig["IdRutaDistribucion"],
            "id_asignacion": id_asignacion
        })

        asig["Paradas"] = paradas
        asig["TotalParadas"] = len(paradas)
        asig["ParadasEntregadas"] = sum(1 for p in paradas if p.get("EstadoEntrega") == "Entregado")
        asig["TotalRecaudado"] = sum(float(p.get("MontoCobrado") or 0) for p in paradas)
        return asig

    # -------------------------------------------------------------
    # OPERACIONES EN CAMPO Y CIERRE DE RUTA (HU-31, HU-32, HU-33, HU-34)
    # -------------------------------------------------------------
    def RegistrarEntregaParada(self, datos: dict) -> dict:
        sql = """
            UPDATE "Pedido"
            SET "IdEstadoPedido" = 3,
                "FechaEntrega" = NOW(),
                "LatitudEntrega" = :LatitudEntrega,
                "LongitudEntrega" = :LongitudEntrega,
                "Observacion" = COALESCE(:Observacion, "Observacion")
            WHERE "IdPedido" = :IdPedido
            RETURNING "IdPedido", "NumeroPedido", "IdEstadoPedido", "FechaEntrega", "LatitudEntrega", "LongitudEntrega";
        """
        return self.caller.LlamarUnRegistro(sql, datos)

    def RegistrarCobroParada(self, datos: dict) -> dict:
        sql = """
            INSERT INTO "PagoPedido" (
                "IdPedido", "IdMetodoPago", "Monto", "FechaPago",
                "NumeroReferencia", "LatitudCobro", "LongitudCobro", "Observacion"
            ) VALUES (
                :IdPedido, :IdMetodoPago, :Monto, NOW(),
                :NumeroReferencia, :LatitudCobro, :LongitudCobro, :Observacion
            ) RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, datos)

    def ObtenerLiquidacionRuta(self, id_asignacion: int) -> dict:
        sql_gen = """
            SELECT 
                ar."IdAsignacionRuta",
                ar."FechaAsignacion",
                ar."Estado",
                ar."KilometrajeInicial",
                ar."KilometrajeFinal",
                COALESCE(ar."KilometrajeFinal" - ar."KilometrajeInicial", 0) as "KmRecorridos",
                ar."Observacion",
                r."NombreRuta",
                z."NombreZona",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "NombreRepartidor",
                u."IdUsuario" as "IdUsuarioRepartidor",
                u."Celular"
            FROM "AsignacionRuta" ar
            JOIN "RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
            JOIN "ZonaDistribucion" z ON r."IdZonaDistribucion" = z."IdZonaDistribucion"
            JOIN "Usuario" u ON ar."IdUsuarioRepartidor" = u."IdUsuario"
            WHERE ar."IdAsignacionRuta" = :id_asignacion;
        """
        general = self.caller.LlamarUnRegistro(sql_gen, {"id_asignacion": id_asignacion})
        if not general:
            return None

        sql_pedidos = """
            SELECT 
                p."IdPedido",
                p."NumeroPedido",
                COALESCE(c."NombreComercial", c."RazonSocial") as "NombreCliente",
                pv."NombrePuntoVenta",
                p."MontoTotal",
                p."IdEstadoPedido",
                p."FechaEntrega",
                p."LatitudEntrega",
                p."LongitudEntrega",
                COALESCE(SUM(pp."Monto"), 0) as "TotalCobrado",
                COALESCE(SUM(CASE WHEN pp."IdMetodoPago" = 1 THEN pp."Monto" ELSE 0 END), 0) as "CobradoEfectivo",
                COALESCE(SUM(CASE WHEN pp."IdMetodoPago" != 1 THEN pp."Monto" ELSE 0 END), 0) as "CobradoTransferenciaQr"
            FROM "Pedido" p
            JOIN "Cliente" c ON p."IdCliente" = c."IdCliente"
            JOIN "PuntoVenta" pv ON p."IdPuntoVenta" = pv."IdPuntoVenta"
            LEFT JOIN "PagoPedido" pp ON p."IdPedido" = pp."IdPedido"
            WHERE p."IdAsignacionRuta" = :id_asignacion
            GROUP BY p."IdPedido", c."NombreComercial", c."RazonSocial", pv."NombrePuntoVenta";
        """
        pedidos = self.caller.LlamarFuncion(sql_pedidos, {"id_asignacion": id_asignacion})

        total_pedidos = len(pedidos)
        total_esperado = sum(float(p.get("MontoTotal") or 0) for p in pedidos)
        total_cobrado_efectivo = sum(float(p.get("CobradoEfectivo") or 0) for p in pedidos)
        total_cobrado_transf = sum(float(p.get("CobradoTransferenciaQr") or 0) for p in pedidos)
        total_cobrado = total_cobrado_efectivo + total_cobrado_transf
        saldo_pendiente = total_esperado - total_cobrado

        sql_rend = """
            SELECT * FROM "RendicionRuta" 
            WHERE "IdAsignacionRuta" = :id_asignacion 
            LIMIT 1;
        """
        rendicion = self.caller.LlamarUnRegistro(sql_rend, {"id_asignacion": id_asignacion})

        return {
            "Asignacion": general,
            "TotalPedidos": total_pedidos,
            "TotalEsperado": total_esperado,
            "TotalCobradoEfectivo": total_cobrado_efectivo,
            "TotalCobradoTransferenciaQr": total_cobrado_transf,
            "TotalCobrado": total_cobrado,
            "SaldoPendiente": max(0.0, saldo_pendiente),
            "RendicionRegistrada": rendicion,
            "DetallePedidos": pedidos
        }

    def CerrarYLiquidarRuta(self, id_asignacion: int, datos: dict, id_usuario_aprueba: int) -> dict:
        sql_update_asig = """
            UPDATE "AsignacionRuta"
            SET "Estado" = 'Completada',
                "KilometrajeFinal" = COALESCE(:km_final, "KilometrajeFinal"),
                "Observacion" = COALESCE(:obs, "Observacion")
            WHERE "IdAsignacionRuta" = :id_asignacion
            RETURNING *;
        """
        self.caller.LlamarUnRegistro(sql_update_asig, {
            "id_asignacion": id_asignacion,
            "km_final": datos.get("KilometrajeFinal"),
            "obs": datos.get("Observacion")
        })

        sql_rend = """
            INSERT INTO "RendicionRuta" (
                "IdUsuarioRepartidor", "IdAsignacionRuta", "FechaRendicion",
                "MontoTotalCobradoRuta", "MontoEfectivoEntregado", "MontoTransferenciaReportada",
                "MontoQrReportado", "Diferencia", "Conciliada", "IdUsuarioAprueba", "Observacion"
            ) VALUES (
                :IdUsuarioRepartidor, :IdAsignacionRuta, NOW(),
                :MontoTotalCobradoRuta, :MontoEfectivoEntregado, :MontoTransferenciaReportada,
                :MontoQrReportado, :Diferencia, :Conciliada, :IdUsuarioAprueba, :Observacion
            ) RETURNING *;
        """
        params_rend = {
            "IdUsuarioRepartidor": datos["IdUsuarioRepartidor"],
            "IdAsignacionRuta": id_asignacion,
            "MontoTotalCobradoRuta": datos.get("MontoTotalCobradoRuta", 0.0),
            "MontoEfectivoEntregado": datos.get("MontoEfectivoEntregado", 0.0),
            "MontoTransferenciaReportada": datos.get("MontoTransferenciaReportada", 0.0),
            "MontoQrReportado": datos.get("MontoQrReportado", 0.0),
            "Diferencia": datos.get("Diferencia", 0.0),
            "Conciliada": datos.get("Conciliada", True),
            "IdUsuarioAprueba": id_usuario_aprueba,
            "Observacion": datos.get("ObservacionLiquidacion")
        }
        return self.caller.LlamarUnRegistro(sql_rend, params_rend)
