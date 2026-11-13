from datetime import date
from sqlalchemy.orm import Session
from app.Repository.DbCaller import DbCaller

class RutaRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    # -------------------------------------------------------------
    # ZONAS
    # -------------------------------------------------------------
    def ListarZonas(self, id_sucursal: int | None = None) -> list[dict]:
        where = ""
        params = {}
        if id_sucursal is not None:
            where = 'WHERE z."IdSucursal" = :id_sucursal'
            params["id_sucursal"] = id_sucursal

        sql = f"""
            SELECT 
                z."IdZonaDistribucion",
                z."NombreZona",
                z."Ciudad",
                z."Descripcion",
                z."Activa",
                z."IdSucursal",
                COUNT(r."IdRutaDistribucion") as "TotalRutas"
            FROM "ZonaDistribucion" z
            LEFT JOIN "RutaDistribucion" r ON z."IdZonaDistribucion" = r."IdZonaDistribucion" AND r."Activa" = TRUE
            {where}
            GROUP BY z."IdZonaDistribucion"
            ORDER BY z."NombreZona" ASC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def CrearZona(self, datos: dict) -> dict:
        sql = """
            INSERT INTO "ZonaDistribucion" ("NombreZona", "Ciudad", "Descripcion", "Activa", "IdSucursal")
            VALUES (:NombreZona, :Ciudad, :Descripcion, :Activa, :IdSucursal)
            RETURNING "IdZonaDistribucion";
        """
        payload = dict(datos)
        payload.setdefault("IdSucursal", 1)
        return self.caller.LlamarUnRegistro(sql, payload)

    # -------------------------------------------------------------
    # RUTAS
    # -------------------------------------------------------------
    def ListarRutas(self, id_zona: int | None = None, id_sucursal: int | None = None) -> list[dict]:
        params = {}
        condiciones = []
        if id_zona is not None:
            condiciones.append('r."IdZonaDistribucion" = :id_zona')
            params["id_zona"] = id_zona
        if id_sucursal is not None:
            condiciones.append('r."IdSucursal" = :id_sucursal')
            params["id_sucursal"] = id_sucursal

        where_sql = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""

        sql = f"""
            SELECT 
                r."IdRutaDistribucion",
                r."IdZonaDistribucion",
                r."IdSucursal",
                z."NombreZona",
                r."NombreRuta",
                r."DiaSemana",
                COALESCE(r."dia_semana", r."DiaSemana") as "dia_semana",
                r."Descripcion",
                r."Activa",
                COALESCE(r."es_asignacion_automatica", false) as "es_asignacion_automatica",
                r."id_chofer_por_defecto",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "NombreChoferPorDefecto",
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
            LEFT JOIN "Usuario" u ON r."id_chofer_por_defecto" = u."IdUsuario"
            LEFT JOIN "RutaPuntoVenta" rpv ON r."IdRutaDistribucion" = rpv."IdRutaDistribucion"
            LEFT JOIN "PuntoVenta" pv ON rpv."IdPuntoVenta" = pv."IdPuntoVenta"
            LEFT JOIN "Cliente" c ON pv."IdCliente" = c."IdCliente"
            {where_sql}
            GROUP BY r."IdRutaDistribucion", z."NombreZona", u."PrimerNombre", u."ApellidoPaterno"
            ORDER BY r."NombreRuta" ASC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def ObtenerRutaPorId(self, id_ruta: int) -> dict | None:
        sql = """
            SELECT 
                r."IdRutaDistribucion",
                r."IdZonaDistribucion",
                r."IdSucursal",
                z."NombreZona",
                r."NombreRuta",
                r."DiaSemana",
                COALESCE(r."dia_semana", r."DiaSemana") as "dia_semana",
                r."Descripcion",
                r."Activa",
                COALESCE(r."es_asignacion_automatica", false) as "es_asignacion_automatica",
                r."id_chofer_por_defecto",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "NombreChoferPorDefecto"
            FROM "RutaDistribucion" r
            JOIN "ZonaDistribucion" z ON r."IdZonaDistribucion" = z."IdZonaDistribucion"
            LEFT JOIN "Usuario" u ON r."id_chofer_por_defecto" = u."IdUsuario"
            WHERE r."IdRutaDistribucion" = :id_ruta;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_ruta": id_ruta})

    def CrearRuta(self, datos: dict) -> dict:
        payload = dict(datos)
        dia_sem = payload.get("dia_semana") if payload.get("dia_semana") is not None else payload.get("DiaSemana")
        es_auto = payload.get("es_asignacion_automatica") if payload.get("es_asignacion_automatica") is not None else payload.get("EsAsignacionAutomatica", False)
        chofer_def = payload.get("id_chofer_por_defecto") if payload.get("id_chofer_por_defecto") is not None else payload.get("IdChoferPorDefecto")

        sql = """
            INSERT INTO "RutaDistribucion" (
                "IdZonaDistribucion", "NombreRuta", "DiaSemana", "dia_semana",
                "Descripcion", "Activa", "IdSucursal",
                "es_asignacion_automatica", "id_chofer_por_defecto"
            ) VALUES (
                :IdZonaDistribucion, :NombreRuta, :DiaSemana, :dia_semana,
                :Descripcion, :Activa, :IdSucursal,
                :es_asignacion_automatica, :id_chofer_por_defecto
            ) RETURNING "IdRutaDistribucion";
        """
        params = {
            "IdZonaDistribucion": payload["IdZonaDistribucion"],
            "NombreRuta": payload["NombreRuta"],
            "DiaSemana": dia_sem,
            "dia_semana": dia_sem,
            "Descripcion": payload.get("Descripcion"),
            "Activa": payload.get("Activa", True),
            "IdSucursal": payload.get("IdSucursal", 1),
            "es_asignacion_automatica": bool(es_auto),
            "id_chofer_por_defecto": chofer_def
        }
        return self.caller.LlamarUnRegistro(sql, params)

    def ActualizarRuta(self, id_ruta: int, datos: dict) -> dict | None:
        campos = []
        params = {"id_ruta": id_ruta}
        payload = dict(datos)
        
        # Mapear claves comunes
        if "dia_semana" in payload or "DiaSemana" in payload:
            val = payload.get("dia_semana") if payload.get("dia_semana") is not None else payload.get("DiaSemana")
            campos.append('"DiaSemana" = :dia_sem')
            campos.append('"dia_semana" = :dia_sem')
            params["dia_sem"] = val
            payload.pop("dia_semana", None)
            payload.pop("DiaSemana", None)

        if "es_asignacion_automatica" in payload or "EsAsignacionAutomatica" in payload:
            val = payload.get("es_asignacion_automatica") if payload.get("es_asignacion_automatica") is not None else payload.get("EsAsignacionAutomatica")
            campos.append('"es_asignacion_automatica" = :es_auto')
            params["es_auto"] = val
            payload.pop("es_asignacion_automatica", None)
            payload.pop("EsAsignacionAutomatica", None)

        if "id_chofer_por_defecto" in payload or "IdChoferPorDefecto" in payload:
            val = payload.get("id_chofer_por_defecto") if payload.get("id_chofer_por_defecto") is not None else payload.get("IdChoferPorDefecto")
            campos.append('"id_chofer_por_defecto" = :chofer_def')
            params["chofer_def"] = val
            payload.pop("id_chofer_por_defecto", None)
            payload.pop("IdChoferPorDefecto", None)

        for k, v in payload.items():
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
                COALESCE(rpv."frecuencia_visita", 'SEMANAL') as "frecuencia_visita",
                COALESCE(rpv."dias_visita", 'TODOS') as "dias_visita",
                rpv."items_programados_json" as "items_programados_json",
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
        import json
        # Eliminar asignaciones previas de la ruta
        self.caller.LlamarFuncion(
            'DELETE FROM "RutaPuntoVenta" WHERE "IdRutaDistribucion" = :id_ruta;',
            {"id_ruta": id_ruta}
        )
        # Insertar nuevas
        for p in puntos:
            frec = p.get("frecuencia_visita") or p.get("FrecuenciaVisita") or "SEMANAL"
            dias = p.get("dias_visita") or p.get("DiasVisita") or "TODOS"
            if isinstance(dias, list):
                dias = json.dumps(dias)
            items_prog = p.get("items_programados_json") or p.get("ItemsProgramadosJson") or p.get("items_programados") or []
            if not isinstance(items_prog, str):
                items_prog = json.dumps(items_prog)
            self.caller.LlamarFuncion(
                """
                INSERT INTO "RutaPuntoVenta" (
                    "IdRutaDistribucion", "IdPuntoVenta", "OrdenVisita",
                    "frecuencia_visita", "dias_visita", "items_programados_json"
                )
                VALUES (:id_ruta, :id_pv, :orden, :frec, :dias, :items::jsonb)
                ON CONFLICT ("IdRutaDistribucion", "IdPuntoVenta") 
                DO UPDATE SET 
                    "OrdenVisita" = EXCLUDED."OrdenVisita",
                    "frecuencia_visita" = EXCLUDED."frecuencia_visita",
                    "dias_visita" = EXCLUDED."dias_visita",
                    "items_programados_json" = EXCLUDED."items_programados_json";
                """,
                {
                    "id_ruta": id_ruta,
                    "id_pv": p["IdPuntoVenta"],
                    "orden": p["OrdenVisita"],
                    "frec": frec,
                    "dias": str(dias),
                    "items": str(items_prog)
                }
            )

    # -------------------------------------------------------------
    # ASIGNACIONES DIARIAS A REPARTIDORES
    # -------------------------------------------------------------
    def ListarAsignaciones(self, fecha: date | None = None, id_repartidor: int | None = None, id_sucursal: int | None = None) -> list[dict]:
        params = {}
        where_clauses = []
        if fecha:
            where_clauses.append('ar."FechaAsignacion" = :fecha')
            params["fecha"] = fecha
        if id_repartidor:
            where_clauses.append('ar."IdUsuarioRepartidor" = :id_repartidor')
            params["id_repartidor"] = id_repartidor
        if id_sucursal:
            where_clauses.append('r."IdSucursal" = :id_sucursal')
            params["id_sucursal"] = id_sucursal

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
                COALESCE(ar."estado_operativo", 'PENDIENTE_CARGA') as "estado_operativo",
                COALESCE(ar."estado_operativo", 'PENDIENTE_CARGA') as "EstadoOperativo",
                ar."KilometrajeInicial",
                ar."KilometrajeFinal",
                ar."Observacion",
                ar."observacion_cierre_admin",
                ar."cerrado_por_id"
            FROM "AsignacionRuta" ar
            JOIN "RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
            JOIN "ZonaDistribucion" z ON r."IdZonaDistribucion" = z."IdZonaDistribucion"
            JOIN "Usuario" u ON ar."IdUsuarioRepartidor" = u."IdUsuario"
            {where_sql}
            ORDER BY 
                CASE 
                    WHEN UPPER(COALESCE(ar."estado_operativo", 'PENDIENTE_CARGA')) IN ('APROBADA_EN_RUTA', 'EN_RUTA') THEN 1
                    WHEN UPPER(COALESCE(ar."estado_operativo", 'PENDIENTE_CARGA')) = 'CARGA_SOLICITADA' THEN 2
                    WHEN UPPER(COALESCE(ar."estado_operativo", 'PENDIENTE_CARGA')) IN ('OBSERVADA', 'RECHAZADA', 'CARGA_OBSERVADA', 'CARGA_RECHAZADA') THEN 3
                    WHEN UPPER(COALESCE(ar."estado_operativo", 'PENDIENTE_CARGA')) = 'PENDIENTE_CARGA' THEN 4
                    ELSE 5
                END ASC,
                ar."FechaAsignacion" DESC,
                ar."IdAsignacionRuta" DESC,
                r."NombreRuta" ASC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def CrearAsignacion(self, datos: dict, id_usuario_asigna: int) -> dict:
        estado_op = datos.get("estado_operativo") or datos.get("EstadoOperativo") or "PENDIENTE_CARGA"
        sql = """
            INSERT INTO "AsignacionRuta" (
                "IdRutaDistribucion", "IdUsuarioRepartidor", "FechaAsignacion",
                "IdUsuarioAsigna", "KilometrajeInicial", "Observacion", "estado_operativo"
            ) VALUES (
                :IdRutaDistribucion, :IdUsuarioRepartidor, :FechaAsignacion,
                :IdUsuarioAsigna, :KilometrajeInicial, :Observacion, :estado_operativo
            ) RETURNING "IdAsignacionRuta", "estado_operativo";
        """
        params = {
            "IdRutaDistribucion": datos["IdRutaDistribucion"],
            "IdUsuarioRepartidor": datos["IdUsuarioRepartidor"],
            "FechaAsignacion": datos["FechaAsignacion"],
            "IdUsuarioAsigna": id_usuario_asigna,
            "KilometrajeInicial": datos.get("KilometrajeInicial"),
            "Observacion": datos.get("Observacion"),
            "estado_operativo": estado_op
        }
        return self.caller.LlamarUnRegistro(sql, params)

    def ActualizarAsignacion(self, id_asignacion: int, datos: dict) -> dict:
        campos = []
        params = {"id_asignacion": id_asignacion}
        if "Estado" in datos and datos["Estado"] is not None:
            campos.append('"Estado" = :Estado')
            params["Estado"] = datos["Estado"]
        if "EstadoOperativo" in datos and datos["EstadoOperativo"] is not None:
            campos.append('"estado_operativo" = :EstadoOperativo')
            params["EstadoOperativo"] = datos["EstadoOperativo"]
        elif "estado_operativo" in datos and datos["estado_operativo"] is not None:
            campos.append('"estado_operativo" = :estado_operativo')
            params["estado_operativo"] = datos["estado_operativo"]
        if "KilometrajeFinal" in datos and datos["KilometrajeFinal"] is not None:
            campos.append('"KilometrajeFinal" = :KilometrajeFinal')
            params["KilometrajeFinal"] = datos["KilometrajeFinal"]
        if "Observacion" in datos and datos["Observacion"] is not None:
            campos.append('"Observacion" = :Observacion')
            params["Observacion"] = datos["Observacion"]
        if "observacion_cierre_admin" in datos and datos["observacion_cierre_admin"] is not None:
            campos.append('"observacion_cierre_admin" = :obs_cierre')
            params["obs_cierre"] = datos["observacion_cierre_admin"]
        elif "ObservacionCierreAdmin" in datos and datos["ObservacionCierreAdmin"] is not None:
            campos.append('"observacion_cierre_admin" = :obs_cierre')
            params["obs_cierre"] = datos["ObservacionCierreAdmin"]
        if "cerrado_por_id" in datos and datos["cerrado_por_id"] is not None:
            campos.append('"cerrado_por_id" = :cerrado_por')
            params["cerrado_por"] = datos["cerrado_por_id"]
        elif "CerradoPorId" in datos and datos["CerradoPorId"] is not None:
            campos.append('"cerrado_por_id" = :cerrado_por')
            params["cerrado_por"] = datos["CerradoPorId"]

        if not campos:
            return {"IdAsignacionRuta": id_asignacion}
        sql = f"""
            UPDATE "AsignacionRuta"
            SET {', '.join(campos)}
            WHERE "IdAsignacionRuta" = :id_asignacion
            RETURNING "IdAsignacionRuta", "Estado", "estado_operativo", "KilometrajeFinal", "Observacion", "observacion_cierre_admin", "cerrado_por_id";
        """
        return self.caller.LlamarUnRegistro(sql, params)

    def ListarRepartidoresActivos(self, id_sucursal: int | None = None) -> list[dict]:
        where_suc = 'AND u."IdSucursal" = :id_s' if id_sucursal is not None else ""
        params = {"id_s": id_sucursal} if id_sucursal is not None else {}
        sql = f"""
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
                u."IdSucursal",
                CASE WHEN u."IdEstadoUsuario" = 1 THEN 'Activo' ELSE 'Inactivo' END as "Estado",
                (SELECT COUNT(*) FROM "AsignacionRuta" ar WHERE ar."IdUsuarioRepartidor" = u."IdUsuario") as "TotalAsignaciones"
            FROM "Usuario" u
            WHERE u."IdRol" = 6
              {where_suc}
            ORDER BY u."IdEstadoUsuario" ASC, u."PrimerNombre" ASC;
        """
        return self.caller.LlamarFuncion(sql, params)

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
    # Telemetría y rastreo GPS en vivo
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

    def ObtenerChoferesEnVivo(self, sucursal_id: int | None = None) -> list[dict]:
        filtro_sucursal = ""
        params = {}
        if sucursal_id is not None:
            filtro_sucursal = 'AND u."IdSucursal" = :sucursal_id'
            params["sucursal_id"] = sucursal_id

        sql = f"""
            SELECT 
                COALESCE(t."IdTracking", 0) as "IdTracking",
                u."IdUsuario" as "IdUsuarioRepartidor",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "NombreRepartidor",
                u."Celular",
                COALESCE(t."IdAsignacionRuta", ar."IdAsignacionRuta") as "IdAsignacionRuta",
                COALESCE(r."NombreRuta", 'Sin Ruta Asignada') as "NombreRuta",
                COALESCE(z."NombreZona", 'Sucre') as "NombreZona",
                COALESCE(ar."Estado", 'Sin Asignación') as "EstadoAsignacion",
                t."Latitud" as "Latitud",
                t."Longitud" as "Longitud",
                COALESCE(t."Velocidad", 0.0) as "Velocidad",
                t."Bateria" as "Bateria",
                COALESCE(t."EstadoMovimiento", 'Sin Señal') as "EstadoMovimiento",
                COALESCE(t."DireccionAproximada", 'Sin reporte de ubicación') as "DireccionAproximada",
                COALESCE(t."ParadaActual", 1) as "ParadaActual",
                COALESCE(t."TotalParadas", (
                    SELECT COUNT(*) FROM "RutaPuntoVenta" rpv 
                    WHERE rpv."IdRutaDistribucion" = r."IdRutaDistribucion"
                ), 0) as "TotalParadas",
                COALESCE(t."ParadasCompletadas", 0) as "ParadasCompletadas",
                COALESCE(t."MontoCobradoTotal", 0.0) as "MontoCobradoTotal",
                t."UltimaActualizacion" as "UltimaActualizacion",
                CASE 
                    WHEN t."UltimaActualizacion" IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM (NOW() - t."UltimaActualizacion")))::INTEGER 
                    ELSE NULL 
                END as "SegundosDesdeUltimoReporte"
            FROM "Usuario" u
            LEFT JOIN "TrackingChofer" t ON t."IdUsuarioRepartidor" = u."IdUsuario"
            LEFT JOIN "AsignacionRuta" ar ON (ar."IdUsuarioRepartidor" = u."IdUsuario" AND ar."FechaAsignacion" = CURRENT_DATE)
            LEFT JOIN "RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
            LEFT JOIN "ZonaDistribucion" z ON r."IdZonaDistribucion" = z."IdZonaDistribucion"
            WHERE u."IdRol" = 6 AND u."IdEstadoUsuario" = 1 {filtro_sucursal}
            ORDER BY t."UltimaActualizacion" DESC NULLS LAST, u."PrimerNombre" ASC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def ObtenerTrackingPorAsignacion(self, id_asignacion: int) -> dict:
        sql_asig = """
            SELECT 
                ar."IdAsignacionRuta",
                ar."FechaAsignacion",
                ar."Estado" as "EstadoAsignacion",
                COALESCE(ar."estado_operativo", 'PENDIENTE_CARGA') as "estado_operativo",
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
                COALESCE(p."estado_visita", '') as "estado_visita",
                COALESCE(p."tipo_incidencia", '') as "tipo_incidencia",
                COALESCE(rpv."frecuencia_visita", 'SEMANAL') as "frecuencia_visita",
                COALESCE(rpv."dias_visita", 'TODOS') as "dias_visita",
                rpv."items_programados_json" as "items_programados_json",
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

        # Fallback 1: Si no hay paradas en RutaPuntoVenta, buscar pedidos vinculados a la asignación
        if not paradas:
            sql_pedidos = """
                SELECT 
                    ROW_NUMBER() OVER (ORDER BY p."IdPedido" ASC) as "OrdenVisita",
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
                FROM "Pedido" p
                JOIN "PuntoVenta" pv ON p."IdPuntoVenta" = pv."IdPuntoVenta"
                JOIN "Cliente" c ON pv."IdCliente" = c."IdCliente"
                WHERE p."IdAsignacionRuta" = :id_asignacion
                ORDER BY p."IdPedido" ASC;
            """
            paradas = self.caller.LlamarFuncion(sql_pedidos, {"id_asignacion": id_asignacion})

        # Fallback 2: Si aún no hay paradas, cargar puntos de venta activos de la zona/sucursal
        if not paradas:
            sql_puntos_zona = """
                SELECT 
                    ROW_NUMBER() OVER (ORDER BY pv."IdPuntoVenta" ASC) as "OrdenVisita",
                    pv."IdPuntoVenta",
                    pv."NombrePuntoVenta",
                    pv."Direccion",
                    pv."Latitud",
                    pv."Longitud",
                    pv."Referencia",
                    c."IdCliente",
                    COALESCE(c."NombreComercial", c."RazonSocial") as "NombreCliente",
                    c."Telefono" as "TelefonoCliente",
                    NULL::integer as "IdPedido",
                    NULL::varchar as "NumeroPedido",
                    0.0 as "MontoPedido",
                    NULL::integer as "IdEstadoPedido",
                    'Visita Comercial' as "EstadoEntrega",
                    NULL::numeric as "LatitudEntrega",
                    NULL::numeric as "LongitudEntrega",
                    NULL::timestamp as "FechaEntrega",
                    0.0 as "MontoCobrado"
                FROM "PuntoVenta" pv
                JOIN "Cliente" c ON pv."IdCliente" = c."IdCliente"
                JOIN "RutaDistribucion" r ON r."IdRutaDistribucion" = :id_ruta
                WHERE (c."IdSucursal" = r."IdSucursal" OR pv."IdZona" = r."IdZonaDistribucion")
                  AND pv."Activo" = true
                ORDER BY pv."IdPuntoVenta" ASC
                LIMIT 10;
            """
            paradas = self.caller.LlamarFuncion(sql_puntos_zona, {"id_ruta": asig["IdRutaDistribucion"]})

        # Sanitizar paradas: asegurar que IdPedido corresponda efectivamente a ese punto de venta
        for p in paradas:
            p_id = p.get("IdPedido")
            pv_id = p.get("IdPuntoVenta")
            if p_id and pv_id:
                chk = self.caller.LlamarUnRegistro(
                    'SELECT "IdPedido" FROM "Pedido" WHERE "IdPedido" = :pid AND "IdPuntoVenta" = :pvid LIMIT 1;',
                    {"pid": p_id, "pvid": pv_id}
                )
                if not chk:
                    p["IdPedido"] = None
                    p["NumeroPedido"] = None
                    p["MontoPedido"] = 0.0
                    p["IdEstadoPedido"] = None
                    p["EstadoEntrega"] = "Visita Comercial"

        asig["Paradas"] = paradas
        asig["TotalParadas"] = len(paradas)
        asig["ParadasEntregadas"] = sum(1 for p in paradas if p.get("EstadoEntrega") == "Entregado")
        asig["TotalRecaudado"] = sum(float(p.get("MontoCobrado") or 0) for p in paradas)
        return asig

    # -------------------------------------------------------------
    # Operaciones en campo y cierre de ruta
    # -------------------------------------------------------------
    def RegistrarEntregaParada(self, datos: dict) -> dict:
        id_ped = datos.get("IdPedido") or datos.get("id_pedido") or datos.get("idPedido")
        lat = datos.get("LatitudEntrega") if datos.get("LatitudEntrega") is not None else datos.get("latitud")
        lng = datos.get("LongitudEntrega") if datos.get("LongitudEntrega") is not None else datos.get("longitud")
        obs = datos.get("Observacion") if datos.get("Observacion") is not None else datos.get("observacion")
        params = {
            "IdPedido": id_ped,
            "LatitudEntrega": lat,
            "LongitudEntrega": lng,
            "Observacion": obs
        }
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
        return self.caller.LlamarUnRegistro(sql, params)

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

    # -------------------------------------------------------------
    # GENERADOR DIARIO Y REORDENAMIENTO 1..N (SUB-AGENTE A)
    # -------------------------------------------------------------
    def EjecutarGeneradorRutasDiarias(self, fecha: date | None = None) -> dict:
        """Invoca la función PostgreSQL fn_generar_rutas_diarias(p_fecha)."""
        if fecha is None:
            fecha = date.today()
        sql = 'SELECT public.fn_generar_rutas_diarias(:fecha) as resultado;'
        res = self.caller.LlamarUnRegistro(sql, {"fecha": fecha}, commit=True)
        return res.get("resultado") if res and isinstance(res.get("resultado"), dict) else (res or {})

    def VerificarParadaOperadaHoy(self, id_punto_venta: int, id_ruta: int, fecha: date | None = None) -> bool:
        """
        Regla inquebrantable:
        Verifica si para este punto de venta hoy ya existe una entrega (Pedido entregado/en camino)
        o cobro (PagoPedido) en esta ruta o globalmente en la jornada.
        """
        if fecha is None:
            fecha = date.today()

        sql = """
            SELECT COUNT(*) as total
            FROM "Pedido" p
            LEFT JOIN "AsignacionRuta" ar ON p."IdAsignacionRuta" = ar."IdAsignacionRuta"
            LEFT JOIN "PagoPedido" pp ON pp."IdPedido" = p."IdPedido"
            WHERE p."IdPuntoVenta" = :id_pv
              AND (
                  (ar."IdRutaDistribucion" = :id_ruta AND ar."FechaAsignacion" = :fecha)
                  OR (p."FechaEntrega"::date = :fecha)
                  OR (pp."FechaPago"::date = :fecha)
              )
              AND (
                  p."IdEstadoPedido" IN (2, 3) -- 2=En Camino, 3=Entregado
                  OR p."FechaEntrega" IS NOT NULL
                  OR (pp."IdPagoPedido" IS NOT NULL AND pp."Monto" > 0)
              );
        """
        res = self.caller.LlamarUnRegistro(sql, {
            "id_pv": id_punto_venta,
            "id_ruta": id_ruta,
            "fecha": fecha
        })
        return bool(res and res.get("total", 0) > 0)

    def RecalcularOrdenParadasRuta(self, id_ruta: int) -> list[dict]:
        """
        Reordena compactamente las paradas de una ruta para asegurar una secuencia estricta 1..N sin huecos.
        Si se quita la #4, las paradas #5 y #6 pasan a ser #4 y #5 automáticamente.
        """
        sql_get = """
            SELECT "IdRutaPuntoVenta", "IdPuntoVenta", "OrdenVisita"
            FROM "RutaPuntoVenta"
            WHERE "IdRutaDistribucion" = :id_ruta
            ORDER BY "OrdenVisita" ASC, "IdRutaPuntoVenta" ASC;
        """
        paradas = self.caller.LlamarFuncion(sql_get, {"id_ruta": id_ruta})
        if not paradas:
            return []

        # Actualizar orden 1..N sin huecos
        for idx, p in enumerate(paradas, start=1):
            if p.get("OrdenVisita") != idx:
                self.caller.LlamarFuncion(
                    """
                    UPDATE "RutaPuntoVenta"
                    SET "OrdenVisita" = :nuevo_orden
                    WHERE "IdRutaPuntoVenta" = :id_rpv;
                    """,
                    {"nuevo_orden": idx, "id_rpv": p["IdRutaPuntoVenta"]},
                    commit=True
                )
                p["OrdenVisita"] = idx
        return paradas

    def InsertarParadaEnOrden(self, id_ruta: int, id_punto_venta: int, posicion: int | None = None) -> list[dict]:
        """
        Inserta una parada manual en Web o por ENTREGA_INMEDIATA del chofer en calle.
        Si se agrega en orden P (ej. después de la #2 -> posición 3),
        desplaza las paradas con orden >= 3 en +1 y asigna orden = 3 a la nueva parada.
        Luego ejecuta recalcular orden 1..N compacto.
        """
        sql_max = 'SELECT COALESCE(MAX("OrdenVisita"), 0) as max_o FROM "RutaPuntoVenta" WHERE "IdRutaDistribucion" = :id_ruta;'
        max_res = self.caller.LlamarUnRegistro(sql_max, {"id_ruta": id_ruta})
        max_o = int(max_res.get("max_o", 0)) if max_res else 0

        if posicion is None or posicion > (max_o + 1):
            posicion = max_o + 1
        elif posicion < 1:
            posicion = 1

        # 1. Desplazar paradas existentes con OrdenVisita >= posicion en +1
        sql_shift = """
            UPDATE "RutaPuntoVenta"
            SET "OrdenVisita" = "OrdenVisita" + 1
            WHERE "IdRutaDistribucion" = :id_ruta AND "OrdenVisita" >= :posicion;
        """
        self.caller.LlamarFuncion(sql_shift, {"id_ruta": id_ruta, "posicion": posicion}, commit=True)

        # 2. Insertar o actualizar la parada en la posicion solicitada
        sql_ins = """
            INSERT INTO "RutaPuntoVenta" ("IdRutaDistribucion", "IdPuntoVenta", "OrdenVisita")
            VALUES (:id_ruta, :id_pv, :posicion)
            ON CONFLICT ("IdRutaDistribucion", "IdPuntoVenta")
            DO UPDATE SET "OrdenVisita" = EXCLUDED."OrdenVisita";
        """
        self.caller.LlamarFuncion(sql_ins, {"id_ruta": id_ruta, "id_pv": id_punto_venta, "posicion": posicion}, commit=True)

        # 3. Compactar para asegurar 1..N sin huecos
        return self.RecalcularOrdenParadasRuta(id_ruta)

    def QuitarParadaRuta(self, id_ruta: int, id_punto_venta: int, fecha: date | None = None) -> list[dict]:
        """
        Quita una parada de una ruta y recalcula el orden 1..N.
        Regla inquebrantable: Si ya tiene entrega o cobro realizado hoy, lanza error y prohíbe eliminarla.
        """
        if self.VerificarParadaOperadaHoy(id_punto_venta, id_ruta, fecha):
            raise ValueError(
                "Regla inquebrantable: La parada ya tiene entrega o cobro realizado hoy; está prohibido eliminarla o quitarla de la ruta hoy."
            )

        self.caller.LlamarFuncion(
            'DELETE FROM "RutaPuntoVenta" WHERE "IdRutaDistribucion" = :id_ruta AND "IdPuntoVenta" = :id_pv;',
            {"id_ruta": id_ruta, "id_pv": id_punto_venta},
            commit=True
        )
        return self.RecalcularOrdenParadasRuta(id_ruta)

    def MoverClienteDeRuta(self, id_punto_venta: int, id_ruta_origen: int, id_ruta_destino: int,
                           posicion_destino: int | None = None, fecha: date | None = None) -> dict:
        """
        Mueve un cliente PENDIENTE a otra ruta del mismo día o a la ruta de otro día de la semana.
        Regla inquebrantable: Si ya tiene entrega o cobro hoy en origen, lanza error y prohíbe moverla.
        Recalcula el orden 1..N tanto en la ruta origen como en la ruta destino.
        """
        if self.VerificarParadaOperadaHoy(id_punto_venta, id_ruta_origen, fecha):
            raise ValueError(
                "Regla inquebrantable: La parada ya tiene entrega o cobro realizado hoy; está prohibido moverla o cambiarla de ruta o día hoy."
            )

        # Quitar de origen
        self.caller.LlamarFuncion(
            'DELETE FROM "RutaPuntoVenta" WHERE "IdRutaDistribucion" = :id_o AND "IdPuntoVenta" = :id_pv;',
            {"id_o": id_ruta_origen, "id_pv": id_punto_venta},
            commit=True
        )
        paradas_origen = self.RecalcularOrdenParadasRuta(id_ruta_origen)

        # Insertar en destino
        paradas_destino = self.InsertarParadaEnOrden(id_ruta_destino, id_punto_venta, posicion_destino)

        return {
            "id_ruta_origen": id_ruta_origen,
            "paradas_origen": paradas_origen,
            "id_ruta_destino": id_ruta_destino,
            "paradas_destino": paradas_destino
        }

    # -------------------------------------------------------------
    # SOLICITUDES DE CARGA DE CAMIÓN
    # -------------------------------------------------------------
    def CrearSolicitudCarga(self, datos: dict) -> dict:
        id_asig = datos.get("IdAsignacionRuta") or datos.get("id_asignacion")
        id_chofer = datos.get("IdChofer") or datos.get("id_chofer")
        obs_chofer = datos.get("ObservacionChofer") or datos.get("observacion")
        items = datos.get("Items") or datos.get("items") or []

        sql_sol = """
            INSERT INTO public."solicitud_carga_camion" (
                "id_asignacion_ruta", "id_chofer", "estado", "observacion_chofer"
            ) VALUES (
                :id_asig, :id_chofer, 'PENDIENTE', :obs_chofer
            ) RETURNING *;
        """
        sol = self.caller.LlamarUnRegistro(sql_sol, {
            "id_asig": id_asig,
            "id_chofer": id_chofer,
            "obs_chofer": obs_chofer
        })
        id_sol = sol["id_solicitud"]

        detalles_insertados = []
        for it in items:
            if hasattr(it, "model_dump"):
                it = it.model_dump()
            elif hasattr(it, "__dict__"):
                it = it.__dict__
            p_id = it.get("IdPresentacion") or it.get("presentacion_id")
            s_rem = float(it.get("StockRemanente") if it.get("StockRemanente") is not None else (it.get("stock_remanente") or 0.0))
            s_sol = float(it.get("StockAdicionalSolicitado") if it.get("StockAdicionalSolicitado") is not None else (it.get("stock_adicional_solicitado") or 0.0))
            it_obs = it.get("Observacion") or it.get("observacion")

            sql_det = """
                INSERT INTO public."detalle_solicitud_carga_camion" (
                    "id_solicitud", "id_presentacion", "stock_remanente",
                    "stock_adicional_solicitado", "stock_adicional_aprobado", "observacion"
                ) VALUES (
                    :id_sol, :p_id, :s_rem, :s_sol, :s_sol, :it_obs
                ) RETURNING *;
            """
            d = self.caller.LlamarUnRegistro(sql_det, {
                "id_sol": id_sol,
                "p_id": p_id,
                "s_rem": s_rem,
                "s_sol": s_sol,
                "it_obs": it_obs
            })
            detalles_insertados.append(d)

        # Actualizar estado_operativo en AsignacionRuta
        self.caller.LlamarFuncion(
            'UPDATE public."AsignacionRuta" SET "estado_operativo" = \'CARGA_SOLICITADA\' WHERE "IdAsignacionRuta" = :id_asig;',
            {"id_asig": id_asig},
            commit=True
        )

        sol["Detalles"] = detalles_insertados
        return sol

    def ListarSolicitudesCarga(self, id_asignacion: int | None = None, estado: str | None = None) -> list[dict]:
        params = {}
        conds = []
        if id_asignacion is not None:
            conds.append('s."id_asignacion_ruta" = :id_asig')
            params["id_asig"] = id_asignacion
        if estado:
            conds.append('s."estado" = :estado')
            params["estado"] = estado

        where_sql = f"WHERE {' AND '.join(conds)}" if conds else ""

        sql = f"""
            SELECT 
                s."id_solicitud",
                s."id_asignacion_ruta",
                s."id_chofer",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "nombre_chofer",
                s."estado",
                s."observacion_chofer",
                s."observacion_admin",
                s."id_admin_revision",
                s."fecha_solicitud",
                s."fecha_revision",
                s."created_at",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id_detalle', d."id_detalle",
                            'id_presentacion', d."id_presentacion",
                            'stock_remanente', d."stock_remanente",
                            'stock_adicional_solicitado', d."stock_adicional_solicitado",
                            'stock_adicional_aprobado', d."stock_adicional_aprobado",
                            'observacion', d."observacion"
                        )
                    ) FILTER (WHERE d."id_detalle" IS NOT NULL),
                    '[]'::json
                ) as "detalles"
            FROM public."solicitud_carga_camion" s
            JOIN public."Usuario" u ON s."id_chofer" = u."IdUsuario"
            LEFT JOIN public."detalle_solicitud_carga_camion" d ON s."id_solicitud" = d."id_solicitud"
            {where_sql}
            GROUP BY s."id_solicitud", u."PrimerNombre", u."ApellidoPaterno"
            ORDER BY s."fecha_solicitud" DESC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def ObtenerSolicitudCargaPorId(self, id_solicitud: int) -> dict | None:
        sql = """
            SELECT 
                s."id_solicitud",
                s."id_asignacion_ruta",
                s."id_chofer",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "nombre_chofer",
                r."IdSucursal" as "id_sucursal",
                r."NombreRuta" as "nombre_ruta",
                s."estado",
                s."observacion_chofer",
                s."observacion_admin",
                s."id_admin_revision",
                s."fecha_solicitud",
                s."fecha_revision",
                s."created_at"
            FROM public."solicitud_carga_camion" s
            JOIN public."Usuario" u ON s."id_chofer" = u."IdUsuario"
            LEFT JOIN public."AsignacionRuta" ar ON s."id_asignacion_ruta" = ar."IdAsignacionRuta"
            LEFT JOIN public."RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
            WHERE s."id_solicitud" = :id_sol;
        """
        sol = self.caller.LlamarUnRegistro(sql, {"id_sol": id_solicitud})
        if not sol:
            return None

        # Stock remanente real del chofer desde inventario_chofer
        sql_rem = """
            SELECT 
                ic.presentacion_id as id_presentacion,
                ic.presentacion_id as "IdPresentacion",
                pp."CodigoPresentacion" as codigo_presentacion,
                pp."CodigoPresentacion" as "CodigoPresentacion",
                prod."NombreProducto" as nombre_producto,
                prod."NombreProducto" as "NombreProducto",
                COALESCE(pp."TipoContenedor", 'Paquete') as tipo_contenedor,
                COALESCE(pp."TipoContenedor", 'Paquete') as "TipoContenedor",
                COALESCE(ic.cantidad_remanente, GREATEST(ic.cantidad_cargada - ic.cantidad_vendida, 0)) as cantidad,
                COALESCE(ic.cantidad_remanente, GREATEST(ic.cantidad_cargada - ic.cantidad_vendida, 0)) as stock_remanente,
                COALESCE(ic.cantidad_remanente, GREATEST(ic.cantidad_cargada - ic.cantidad_vendida, 0)) as cantidad_remanente,
                ic.cantidad_cargada,
                ic.cantidad_vendida,
                ic.precio_vigente_carga
            FROM public.inventario_chofer ic
            JOIN public."PresentacionProducto" pp ON ic.presentacion_id = pp."IdPresentacion"
            JOIN public."Producto" prod ON pp."IdProducto" = prod."IdProducto"
            WHERE ic.chofer_id = :id_chofer
              AND COALESCE(ic.cantidad_remanente, GREATEST(ic.cantidad_cargada - ic.cantidad_vendida, 0)) > 0
            ORDER BY prod."NombreProducto" ASC, pp."CodigoPresentacion" ASC;
        """
        stock_rem = self.caller.LlamarFuncion(sql_rem, {"id_chofer": sol["id_chofer"]})
        sol["stock_remanente"] = stock_rem

        sql_det = """
            SELECT 
                d."id_detalle",
                d."id_solicitud",
                d."id_presentacion",
                pp."CodigoPresentacion",
                prod."NombreProducto",
                pp."TipoContenedor",
                COALESCE(d."stock_remanente", 0) as "stock_remanente",
                COALESCE(d."stock_adicional_solicitado", 0) as "stock_adicional_solicitado",
                COALESCE(d."stock_adicional_aprobado", 0) as "stock_adicional_aprobado",
                d."observacion"
            FROM public."detalle_solicitud_carga_camion" d
            JOIN public."PresentacionProducto" pp ON d."id_presentacion" = pp."IdPresentacion"
            JOIN public."Producto" prod ON pp."IdProducto" = prod."IdProducto"
            WHERE d."id_solicitud" = :id_sol
            ORDER BY prod."NombreProducto" ASC;
        """
        detalles = self.caller.LlamarFuncion(sql_det, {"id_sol": id_solicitud})
        if not detalles:
            sql_sug = """
                SELECT 
                    NULL::integer as id_detalle,
                    pp."IdPresentacion" as id_presentacion,
                    pp."IdPresentacion" as "IdPresentacion",
                    pp."CodigoPresentacion" as "CodigoPresentacion",
                    pp."CodigoPresentacion" as codigo_presentacion,
                    prod."NombreProducto" as "NombreProducto",
                    prod."NombreProducto" as nombre_producto,
                    COALESCE(pp."TipoContenedor", 'Paquete') as "TipoContenedor",
                    COALESCE(pp."TipoContenedor", 'Paquete') as tipo_contenedor,
                    0.0 as stock_remanente,
                    0.0 as stock_adicional_solicitado,
                    0.0 as stock_adicional_aprobado,
                    'Sugerido para ruta' as observacion
                FROM public."PresentacionProducto" pp
                JOIN public."Producto" prod ON pp."IdProducto" = prod."IdProducto"
                WHERE pp."Activo" = true
                ORDER BY prod."NombreProducto" ASC, pp."CodigoPresentacion" ASC
                LIMIT 15;
            """
            detalles = self.caller.LlamarFuncion(sql_sug, {})

        sol["detalles"] = detalles
        sol["items"] = detalles
        sol["items_solicitados"] = detalles
        return sol

    def RevisarSolicitudCarga(self, id_solicitud: int, estado: str, id_admin: int,
                              obs_admin: str | None = None, items_aprobados: list[dict] | None = None) -> dict:
        estado_normalizado = estado.upper().strip()
        if estado_normalizado in ('APROBADO', 'APROBADA'):
            estado_db = 'APROBADA'
            nuevo_estado_op = 'APROBADA_EN_RUTA'
        elif estado_normalizado in ('OBSERVADO', 'OBSERVADA', 'CARGA_OBSERVADA'):
            estado_db = 'OBSERVADA'
            nuevo_estado_op = 'CARGA_OBSERVADA'
        elif estado_normalizado in ('RECHAZADO', 'RECHAZADA', 'CARGA_RECHAZADA'):
            estado_db = 'RECHAZADA'
            nuevo_estado_op = 'CARGA_RECHAZADA'
        elif estado_normalizado == 'PENDIENTE':
            estado_db = 'PENDIENTE'
            nuevo_estado_op = 'CARGA_SOLICITADA'
        else:
            raise ValueError("Estado de revisión no válido. Debe ser 'APROBADA', 'OBSERVADA' o 'RECHAZADA'.")

        sql_up = """
            UPDATE public."solicitud_carga_camion"
            SET "estado" = :estado,
                "id_admin_revision" = :id_admin,
                "observacion_admin" = :obs_admin,
                "fecha_revision" = now()
            WHERE "id_solicitud" = :id_sol
            RETURNING *;
        """
        sol = self.caller.LlamarUnRegistro(sql_up, {
            "estado": estado_db,
            "id_admin": id_admin,
            "obs_admin": obs_admin,
            "id_sol": id_solicitud
        })
        if not sol:
            return None

        id_asig = sol["id_asignacion_ruta"]

        # Si se especificaron cantidades aprobadas por item
        if items_aprobados:
            for it in items_aprobados:
                d_id = it.get("id_detalle")
                cant_aprobada = it.get("stock_adicional_aprobado") or it.get("cantidad_aprobada")
                if d_id and cant_aprobada is not None:
                    self.caller.LlamarFuncion(
                        'UPDATE public."detalle_solicitud_carga_camion" SET "stock_adicional_aprobado" = :cant WHERE "id_detalle" = :d_id;',
                        {"cant": float(cant_aprobada), "d_id": d_id},
                        commit=True
                    )

        self.caller.LlamarFuncion(
            'UPDATE public."AsignacionRuta" SET "estado_operativo" = :nuevo_estado, "Estado" = :estado_gen WHERE "IdAsignacionRuta" = :id_asig;',
            {
                "nuevo_estado": nuevo_estado_op,
                "estado_gen": "En Ruta" if nuevo_estado_op == "APROBADA_EN_RUTA" else "Asignada",
                "id_asig": id_asig
            },
            commit=True
        )

        return self.ObtenerSolicitudCargaPorId(id_solicitud)

    # -------------------------------------------------------------
    # AUDITORÍA / REVISIÓN WEB DE ENTREGAS Y COBROS
    # -------------------------------------------------------------
    def RevisarEntregaWeb(self, id_pedido: int, estado_revision: str, revisado_por_id: int, observacion: str | None = None) -> dict:
        estado_norm = estado_revision.upper().strip()
        if estado_norm not in ('PENDIENTE', 'APROBADO', 'OBSERVADO', 'RECHAZADO'):
            raise ValueError("Estado de revisión web inválido.")

        sql = """
            UPDATE public."Pedido"
            SET "estado_revision_web" = :est,
                "observacion_revision" = :obs,
                "revisado_por_id" = :rev_id,
                "fecha_revision" = now()
            WHERE "IdPedido" = :id_p
            RETURNING "IdPedido", "NumeroPedido", "estado_revision_web", "observacion_revision", "revisado_por_id", "fecha_revision";
        """
        return self.caller.LlamarUnRegistro(sql, {
            "est": estado_norm,
            "obs": observacion,
            "rev_id": revisado_por_id,
            "id_p": id_pedido
        })

    def RevisarPagoWeb(self, id_pago_pedido: int, estado_revision: str, revisado_por_id: int, observacion: str | None = None) -> dict:
        estado_norm = estado_revision.upper().strip()
        if estado_norm not in ('PENDIENTE', 'APROBADO', 'OBSERVADO', 'RECHAZADO'):
            raise ValueError("Estado de revisión web inválido.")

        sql = """
            UPDATE public."PagoPedido"
            SET "estado_revision_web" = :est,
                "observacion_revision" = :obs,
                "revisado_por_id" = :rev_id,
                "fecha_revision" = now()
            WHERE "IdPagoPedido" = :id_pago
            RETURNING "IdPagoPedido", "IdPedido", "Monto", "estado_revision_web", "observacion_revision", "revisado_por_id", "fecha_revision";
        """
        return self.caller.LlamarUnRegistro(sql, {
            "est": estado_norm,
            "obs": observacion,
            "rev_id": revisado_por_id,
            "id_pago": id_pago_pedido
        })
