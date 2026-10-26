from sqlalchemy.orm import Session
from app.Repository.DbCaller import DbCaller
from datetime import date, datetime
from decimal import Decimal

class RRHHRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    # =========================================================================
    # 1. EMPLEADOS & DATOS LABORALES
    # =========================================================================
    def ListarEmpleados(self, busqueda: str = "", area: str = "", activo: bool | None = None) -> list[dict]:
        params = {}
        where_clauses = []

        if busqueda:
            where_clauses.append("""
                (u."PrimerNombre" ILIKE :busqueda OR 
                 u."ApellidoPaterno" ILIKE :busqueda OR 
                 u."Ci" ILIKE :busqueda OR 
                 COALESCE(d."Cargo", '') ILIKE :busqueda)
            """)
            params["busqueda"] = f"%{busqueda}%"

        if area and area != "TODAS":
            where_clauses.append('d."Area" = :area')
            params["area"] = area

        if activo is not None:
            where_clauses.append('d."Activo" = :activo')
            params["activo"] = activo

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        sql = f"""
            SELECT 
                u."IdUsuario",
                u."Ci",
                u."PrimerNombre",
                u."SegundoNombre",
                u."ApellidoPaterno",
                u."ApellidoMaterno",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno", ' ', COALESCE(u."ApellidoMaterno", '')) as "NombreCompleto",
                u."Celular",
                u."IdRol",
                r."NombreRol",
                u."IsAdmin",
                COALESCE(d."Cargo", 'Operador de Planta') as "Cargo",
                COALESCE(d."Area", 'Rebobinado') as "Area",
                COALESCE(d."SueldoBasico", 2500.00) as "SueldoBasico",
                d."FechaIngreso",
                COALESCE(d."PorcentajeComisionDefault", 0.00) as "PorcentajeComisionDefault",
                d."CuentaBancaria",
                d."Banco",
                COALESCE(d."Activo", true) as "Activo"
            FROM "Usuario" u
            JOIN "Rol" r ON u."IdRol" = r."IdRol"
            LEFT JOIN "DatosLaboralesEmpleado" d ON u."IdUsuario" = d."IdUsuario"
            {where_sql}
            ORDER BY COALESCE(d."Activo", true) DESC, d."Area" ASC, u."PrimerNombre" ASC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def ObtenerEmpleadoPorId(self, id_usuario: int) -> dict | None:
        sql = """
            SELECT 
                u."IdUsuario",
                u."Ci",
                u."PrimerNombre",
                u."SegundoNombre",
                u."ApellidoPaterno",
                u."ApellidoMaterno",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno", ' ', COALESCE(u."ApellidoMaterno", '')) as "NombreCompleto",
                u."Celular",
                u."IdRol",
                r."NombreRol",
                u."IsAdmin",
                COALESCE(d."Cargo", 'Operador de Planta') as "Cargo",
                COALESCE(d."Area", 'Rebobinado') as "Area",
                COALESCE(d."SueldoBasico", 2500.00) as "SueldoBasico",
                d."FechaIngreso",
                COALESCE(d."PorcentajeComisionDefault", 0.00) as "PorcentajeComisionDefault",
                d."CuentaBancaria",
                d."Banco",
                COALESCE(d."Activo", true) as "Activo"
            FROM "Usuario" u
            JOIN "Rol" r ON u."IdRol" = r."IdRol"
            LEFT JOIN "DatosLaboralesEmpleado" d ON u."IdUsuario" = d."IdUsuario"
            WHERE u."IdUsuario" = :id_usuario;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_usuario": id_usuario})

    def ActualizarEmpleado(self, id_usuario: int, datos_usuario: dict, datos_laborales: dict) -> dict:
        if datos_usuario:
            campos_u = []
            params_u = {"id_usuario": id_usuario}
            for k, v in datos_usuario.items():
                if v is not None:
                    campos_u.append(f'"{k}" = :{k}')
                    params_u[k] = v
            if campos_u:
                sql_u = f"""
                    UPDATE "Usuario"
                    SET {", ".join(campos_u)}
                    WHERE "IdUsuario" = :id_usuario;
                """
                self.caller.LlamarFuncion(sql_u, params_u)

        if datos_laborales:
            campos_d = []
            params_d = {"id_usuario": id_usuario}
            for k, v in datos_laborales.items():
                if v is not None:
                    campos_d.append(f'"{k}" = :{k}')
                    params_d[k] = v
            
            # Upsert en DatosLaboralesEmpleado
            cols = ['"IdUsuario"'] + [f'"{k}"' for k in datos_laborales if datos_laborales[k] is not None]
            vals = [':id_usuario'] + [f':{k}' for k in datos_laborales if datos_laborales[k] is not None]
            updates = [f'"{k}" = EXCLUDED."{k}"' for k in datos_laborales if datos_laborales[k] is not None]

            sql_d = f"""
                INSERT INTO "DatosLaboralesEmpleado" ({", ".join(cols)})
                VALUES ({", ".join(vals)})
                ON CONFLICT ("IdUsuario") DO UPDATE
                SET {", ".join(updates)};
            """
            self.caller.LlamarFuncion(sql_d, params_d)

        return self.ObtenerEmpleadoPorId(id_usuario)

    # =========================================================================
    # 2. TURNOS Y HORARIOS
    # =========================================================================
    def ListarTurnos(self, area: str = "") -> list[dict]:
        params = {}
        where = ""
        if area and area != "TODAS":
            where = 'WHERE t."Area" = :area OR t."Area" = \'General\''
            params["area"] = area

        sql = f"""
            SELECT 
                t."IdTurno",
                t."NombreTurno",
                TO_CHAR(t."HoraInicio", 'HH24:MI:SS') as "HoraInicio",
                TO_CHAR(t."HoraFin", 'HH24:MI:SS') as "HoraFin",
                COALESCE(t."Area", 'General') as "Area",
                COALESCE(t."Color", '#20A7DB') as "Color",
                t."DescripcionTurno"
            FROM "Turno" t
            {where}
            ORDER BY t."IdTurno" ASC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def ObtenerTurnoPorId(self, id_turno: int) -> dict | None:
        sql = """
            SELECT 
                t."IdTurno",
                t."NombreTurno",
                TO_CHAR(t."HoraInicio", 'HH24:MI:SS') as "HoraInicio",
                TO_CHAR(t."HoraFin", 'HH24:MI:SS') as "HoraFin",
                COALESCE(t."Area", 'General') as "Area",
                COALESCE(t."Color", '#20A7DB') as "Color",
                t."DescripcionTurno"
            FROM "Turno" t
            WHERE t."IdTurno" = :id_turno;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_turno": id_turno})

    def CrearTurno(self, datos: dict) -> dict:
        sql = """
            INSERT INTO "Turno" (
                "NombreTurno", "HoraInicio", "HoraFin", "Area", "Color", "DescripcionTurno"
            ) VALUES (
                :NombreTurno, :HoraInicio::time, :HoraFin::time, :Area, :Color, :DescripcionTurno
            ) RETURNING "IdTurno";
        """
        res = self.caller.LlamarUnRegistro(sql, datos)
        return self.ObtenerTurnoPorId(res["IdTurno"])

    def ActualizarTurno(self, id_turno: int, datos: dict) -> dict | None:
        campos = []
        params = {"id_turno": id_turno}
        for k, v in datos.items():
            if v is not None:
                if k in ("HoraInicio", "HoraFin"):
                    campos.append(f'"{k}" = :{k}::time')
                else:
                    campos.append(f'"{k}" = :{k}')
                params[k] = v

        if campos:
            sql = f"""
                UPDATE "Turno"
                SET {", ".join(campos)}
                WHERE "IdTurno" = :id_turno;
            """
            self.caller.LlamarFuncion(sql, params)
        return self.ObtenerTurnoPorId(id_turno)

    def EliminarTurno(self, id_turno: int) -> bool:
        sql = 'DELETE FROM "Turno" WHERE "IdTurno" = :id_turno;'
        self.caller.LlamarFuncion(sql, {"id_turno": id_turno})
        return True

    # =========================================================================
    # 3. CRONOGRAMA DE TURNOS Y ASIGNACIONES
    # =========================================================================
    def ListarCronograma(self, fecha_inicio: date, fecha_fin: date, area: str = "") -> list[dict]:
        params = {"fecha_inicio": fecha_inicio, "fecha_fin": fecha_fin}
        where_clauses = ['a."Fecha" BETWEEN :fecha_inicio AND :fecha_fin']

        if area and area != "TODAS":
            where_clauses.append('COALESCE(a."Area", d."Area") = :area')
            params["area"] = area

        sql = f"""
            SELECT 
                a."IdAsistenciaDiaria",
                a."IdUsuario",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "NombreEmpleado",
                u."PrimerNombre",
                u."ApellidoPaterno",
                u."Ci",
                COALESCE(a."Area", d."Area", 'Rebobinado') as "Area",
                COALESCE(d."Cargo", 'Operador') as "Cargo",
                a."IdTurno",
                t."NombreTurno",
                t."Color" as "ColorTurno",
                TO_CHAR(t."HoraInicio", 'HH24:MI') as "TurnoHoraInicio",
                TO_CHAR(t."HoraFin", 'HH24:MI') as "TurnoHoraFin",
                a."Fecha",
                TO_CHAR(a."HoraEntrada", 'HH24:MI:SS') as "HoraEntrada",
                TO_CHAR(a."HoraSalida", 'HH24:MI:SS') as "HoraSalida",
                a."MinutosAtraso",
                a."HorasExtraTrabajadas",
                a."EsFalta",
                a."FaltaJustificada",
                a."Observacion"
            FROM "AsistenciaDiaria" a
            JOIN "Usuario" u ON a."IdUsuario" = u."IdUsuario"
            LEFT JOIN "DatosLaboralesEmpleado" d ON u."IdUsuario" = d."IdUsuario"
            LEFT JOIN "Turno" t ON a."IdTurno" = t."IdTurno"
            WHERE {" AND ".join(where_clauses)}
            ORDER BY a."Fecha" ASC, COALESCE(a."Area", d."Area") ASC, u."PrimerNombre" ASC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def AsignarTurno(self, id_usuario: int, id_turno: int, fecha: date, area: str = "", observacion: str = "") -> dict:
        sql = """
            INSERT INTO "AsistenciaDiaria" (
                "IdUsuario", "IdTurno", "Fecha", "Area", "Observacion"
            ) VALUES (
                :id_u, :id_t, :fecha, :area, :obs
            ) ON CONFLICT ("IdUsuario", "Fecha") DO UPDATE
            SET "IdTurno" = EXCLUDED."IdTurno",
                "Area" = COALESCE(EXCLUDED."Area", "AsistenciaDiaria"."Area"),
                "Observacion" = COALESCE(EXCLUDED."Observacion", "AsistenciaDiaria"."Observacion")
            RETURNING "IdAsistenciaDiaria", "IdUsuario", "IdTurno", "Fecha";
        """
        params = {
            "id_u": id_usuario,
            "id_t": id_turno,
            "fecha": fecha,
            "area": area or None,
            "obs": observacion or None
        }
        return self.caller.LlamarUnRegistro(sql, params)

    def DesasignarTurno(self, id_usuario: int, fecha: date) -> bool:
        sql = """
            DELETE FROM "AsistenciaDiaria"
            WHERE "IdUsuario" = :id_usuario AND "Fecha" = :fecha AND "HoraEntrada" IS NULL;
        """
        self.caller.LlamarFuncion(sql, {"id_usuario": id_usuario, "fecha": fecha})
        return True

    # =========================================================================
    # 4. CONTROL DE ASISTENCIA Y MARCAS BIOMÉTRICAS
    # =========================================================================
    def ListarAsistencias(self, fecha_inicio: date, fecha_fin: date, id_usuario: int | None = None, area: str = "") -> list[dict]:
        params = {"fecha_inicio": fecha_inicio, "fecha_fin": fecha_fin}
        where = ['a."Fecha" BETWEEN :fecha_inicio AND :fecha_fin']

        if id_usuario is not None:
            where.append('a."IdUsuario" = :id_usuario')
            params["id_usuario"] = id_usuario

        if area and area != "TODAS":
            where.append('COALESCE(a."Area", d."Area") = :area')
            params["area"] = area

        sql = f"""
            SELECT 
                a."IdAsistenciaDiaria",
                a."IdUsuario",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno", ' ', COALESCE(u."ApellidoMaterno", '')) as "NombreCompleto",
                u."Ci",
                COALESCE(d."Cargo", 'Operador') as "Cargo",
                COALESCE(a."Area", d."Area", 'Rebobinado') as "Area",
                a."IdTurno",
                t."NombreTurno",
                TO_CHAR(t."HoraInicio", 'HH24:MI') as "TurnoHoraInicio",
                TO_CHAR(t."HoraFin", 'HH24:MI') as "TurnoHoraFin",
                a."Fecha",
                TO_CHAR(a."HoraEntrada", 'HH24:MI:SS') as "HoraEntrada",
                TO_CHAR(a."HoraSalida", 'HH24:MI:SS') as "HoraSalida",
                a."MinutosAtraso",
                a."HorasExtraTrabajadas",
                a."EsFalta",
                a."FaltaJustificada",
                a."Observacion"
            FROM "AsistenciaDiaria" a
            JOIN "Usuario" u ON a."IdUsuario" = u."IdUsuario"
            LEFT JOIN "DatosLaboralesEmpleado" d ON u."IdUsuario" = d."IdUsuario"
            LEFT JOIN "Turno" t ON a."IdTurno" = t."IdTurno"
            WHERE {" AND ".join(where)}
            ORDER BY a."Fecha" DESC, u."PrimerNombre" ASC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def ObtenerAsistenciaPorId(self, id_asistencia: int) -> dict | None:
        sql = """
            SELECT 
                a."IdAsistenciaDiaria",
                a."IdUsuario",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "NombreCompleto",
                u."Ci",
                a."IdTurno",
                t."NombreTurno",
                a."Fecha",
                TO_CHAR(a."HoraEntrada", 'HH24:MI:SS') as "HoraEntrada",
                TO_CHAR(a."HoraSalida", 'HH24:MI:SS') as "HoraSalida",
                a."MinutosAtraso",
                a."HorasExtraTrabajadas",
                a."EsFalta",
                a."FaltaJustificada",
                a."Observacion"
            FROM "AsistenciaDiaria" a
            JOIN "Usuario" u ON a."IdUsuario" = u."IdUsuario"
            LEFT JOIN "Turno" t ON a."IdTurno" = t."IdTurno"
            WHERE a."IdAsistenciaDiaria" = :id_asistencia;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_asistencia": id_asistencia})

    def ActualizarAsistencia(self, id_asistencia: int, datos: dict) -> dict:
        campos = []
        params = {"id_asistencia": id_asistencia}
        for k, v in datos.items():
            if v is not None:
                if k in ("HoraEntrada", "HoraSalida"):
                    campos.append(f'"{k}" = CAST(:{k} AS TIME)')
                else:
                    campos.append(f'"{k}" = :{k}')
                params[k] = v

        if campos:
            sql = f"""
                UPDATE "AsistenciaDiaria"
                SET {", ".join(campos)}
                WHERE "IdAsistenciaDiaria" = :id_asistencia;
            """
            self.caller.LlamarFuncion(sql, params)

        return self.ObtenerAsistenciaPorId(id_asistencia)

    def RegistrarMarcaBiometrica(self, id_usuario: int, fecha_hora: datetime, tipo_marca: str, origen: str = "Biometrico", id_disp: str = "NG-ECO-01") -> dict:
        sql = """
            INSERT INTO "MarcaBiometrica" (
                "IdUsuario", "FechaHoraMarca", "TipoMarca", "OrigenDatos", "IdDispositivo"
            ) VALUES (
                :id_u, :fecha_hora, :tipo, :origen, :disp
            ) RETURNING "IdMarcaBiometrica", "IdUsuario", "FechaHoraMarca", "TipoMarca";
        """
        params = {
            "id_u": id_usuario,
            "fecha_hora": fecha_hora,
            "tipo": tipo_marca,
            "origen": origen,
            "disp": id_disp
        }
        return self.caller.LlamarUnRegistro(sql, params)

    def ListarMarcasBiometricas(self, fecha_inicio: date, fecha_fin: date, id_usuario: int | None = None) -> list[dict]:
        params = {"fecha_inicio": fecha_inicio, "fecha_fin": fecha_fin}
        where = ['mb."FechaHoraMarca"::date BETWEEN :fecha_inicio AND :fecha_fin']
        if id_usuario:
            where.append('mb."IdUsuario" = :id_usuario')
            params["id_usuario"] = id_usuario

        sql = f"""
            SELECT 
                mb."IdMarcaBiometrica",
                mb."IdUsuario",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "NombreCompleto",
                u."Ci",
                mb."FechaHoraMarca",
                mb."TipoMarca",
                mb."OrigenDatos",
                COALESCE(mb."IdDispositivo", 'NG-ECO-01') as "IdDispositivo",
                mb."FechaImportacion"
            FROM "MarcaBiometrica" mb
            JOIN "Usuario" u ON mb."IdUsuario" = u."IdUsuario"
            WHERE {" AND ".join(where)}
            ORDER BY mb."FechaHoraMarca" DESC
            LIMIT 500;
        """
        return self.caller.LlamarFuncion(sql, params)

    # =========================================================================
    # 5. CONFIGURACIÓN LABORAL
    # =========================================================================
    def ListarConfiguracionLaboral(self) -> list[dict]:
        sql = """
            SELECT 
                "IdConfiguracionLaboral",
                "Parametro",
                "Valor",
                "Descripcion",
                "FechaActualizacion"
            FROM "ConfiguracionLaboral"
            ORDER BY "IdConfiguracionLaboral" ASC;
        """
        return self.caller.LlamarFuncion(sql, {})

    def ActualizarParametroLaboral(self, id_config: int, valor: Decimal, descripcion: str | None = None) -> dict:
        campos = ['"Valor" = :valor', '"FechaActualizacion" = now()']
        params = {"id_config": id_config, "valor": valor}
        if descripcion is not None:
            campos.append('"Descripcion" = :desc')
            params["desc"] = descripcion

        sql = f"""
            UPDATE "ConfiguracionLaboral"
            SET {", ".join(campos)}
            WHERE "IdConfiguracionLaboral" = :id_config
            RETURNING "IdConfiguracionLaboral", "Parametro", "Valor", "Descripcion", "FechaActualizacion";
        """
        return self.caller.LlamarUnRegistro(sql, params)

    def ObtenerValorConfiguracion(self, parametro: str, default: Decimal = Decimal("0")) -> Decimal:
        sql = 'SELECT "Valor" FROM "ConfiguracionLaboral" WHERE "Parametro" = :param;'
        res = self.caller.LlamarUnRegistro(sql, {"param": parametro})
        if res and res.get("Valor") is not None:
            return Decimal(str(res["Valor"]))
        return default

    # =========================================================================
    # 6. PLANILLAS DE SUELDOS & PERIODOS DE NÓMINA
    # =========================================================================
    def ListarPeriodosNomina(self) -> list[dict]:
        sql = """
            SELECT 
                p."IdPeriodoNomina",
                p."Mes",
                p."Anio",
                p."FechaInicio",
                p."FechaFin",
                p."Cerrado",
                TO_CHAR(p."FechaInicio", 'TMMonth YYYY') as "NombrePeriodo",
                pl."IdPlanilla",
                pl."Aprobada",
                pl."TotalLiquido"
            FROM "PeriodoNomina" p
            LEFT JOIN "Planilla" pl ON p."IdPeriodoNomina" = pl."IdPeriodoNomina"
            ORDER BY p."Anio" DESC, p."Mes" DESC;
        """
        return self.caller.LlamarFuncion(sql, {})

    def ObtenerPeriodoPorId(self, id_periodo: int) -> dict | None:
        sql = """
            SELECT 
                "IdPeriodoNomina", "Mes", "Anio", "FechaInicio", "FechaFin", "Cerrado"
            FROM "PeriodoNomina"
            WHERE "IdPeriodoNomina" = :id_periodo;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_periodo": id_periodo})

    def CrearPeriodoNomina(self, mes: int, anio: int, fecha_inicio: date, fecha_fin: date) -> dict:
        sql = """
            INSERT INTO "PeriodoNomina" ("Mes", "Anio", "FechaInicio", "FechaFin", "Cerrado")
            VALUES (:mes, :anio, :f_ini, :f_fin, false)
            ON CONFLICT ("Mes", "Anio") DO UPDATE
            SET "FechaInicio" = EXCLUDED."FechaInicio", "FechaFin" = EXCLUDED."FechaFin"
            RETURNING "IdPeriodoNomina", "Mes", "Anio", "FechaInicio", "FechaFin", "Cerrado";
        """
        params = {"mes": mes, "anio": anio, "f_ini": fecha_inicio, "f_fin": fecha_fin}
        return self.caller.LlamarUnRegistro(sql, params)

    def ObtenerPlanillaPorPeriodo(self, id_periodo: int) -> dict | None:
        sql = """
            SELECT 
                pl."IdPlanilla",
                pl."IdPeriodoNomina",
                p."Mes",
                p."Anio",
                TO_CHAR(p."FechaInicio", 'TMMonth YYYY') as "NombrePeriodo",
                p."FechaInicio",
                p."FechaFin",
                pl."IdUsuarioGenera",
                CONCAT(ug."PrimerNombre", ' ', ug."ApellidoPaterno") as "GeneradoPor",
                pl."FechaGeneracion",
                pl."TotalSueldoBruto",
                pl."TotalDeducciones",
                pl."TotalLiquido",
                pl."Aprobada",
                pl."IdUsuarioAprueba",
                CONCAT(ua."PrimerNombre", ' ', ua."ApellidoPaterno") as "AprobadoPor",
                pl."FechaAprobacion",
                pl."Observacion"
            FROM "Planilla" pl
            JOIN "PeriodoNomina" p ON pl."IdPeriodoNomina" = p."IdPeriodoNomina"
            LEFT JOIN "Usuario" ug ON pl."IdUsuarioGenera" = ug."IdUsuario"
            LEFT JOIN "Usuario" ua ON pl."IdUsuarioAprueba" = ua."IdUsuario"
            WHERE pl."IdPeriodoNomina" = :id_periodo;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_periodo": id_periodo})

    def CrearPlanillaCabecera(self, id_periodo: int, id_usuario_genera: int) -> dict:
        sql = """
            INSERT INTO "Planilla" (
                "IdPeriodoNomina", "IdUsuarioGenera", "FechaGeneracion",
                "TotalSueldoBruto", "TotalDeducciones", "TotalLiquido", "Aprobada"
            ) VALUES (
                :id_periodo, :id_usuario, now(), 0, 0, 0, false
            ) RETURNING "IdPlanilla";
        """
        return self.caller.LlamarUnRegistro(sql, {"id_periodo": id_periodo, "id_usuario": id_usuario_genera})

    def EliminarDetallesPlanilla(self, id_planilla: int) -> None:
        sql = 'DELETE FROM "DetallePlanilla" WHERE "IdPlanilla" = :id_planilla;'
        self.caller.LlamarFuncion(sql, {"id_planilla": id_planilla})

    def CrearDetallePlanilla(self, datos: dict) -> dict:
        sql = """
            INSERT INTO "DetallePlanilla" (
                "IdPlanilla", "IdUsuario", "SueldoBasico", "MontoHorasExtra",
                "MontoComisiones", "TotalBonos", "DescuentoAtrasos", "DescuentoFaltas",
                "AporteAFP", "OtrasDeducciones", "TotalGanado", "TotalDescuento",
                "LiquidoPagable", "Observacion"
            ) VALUES (
                :IdPlanilla, :IdUsuario, :SueldoBasico, :MontoHorasExtra,
                :MontoComisiones, :TotalBonos, :DescuentoAtrasos, :DescuentoFaltas,
                :AporteAFP, :OtrasDeducciones, :TotalGanado, :TotalDescuento,
                :LiquidoPagable, :Observacion
            ) RETURNING "IdDetallePlanilla";
        """
        return self.caller.LlamarUnRegistro(sql, datos)

    def ListarDetallesPlanilla(self, id_planilla: int) -> list[dict]:
        sql = """
            SELECT 
                dp."IdDetallePlanilla",
                dp."IdPlanilla",
                dp."IdUsuario",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno", ' ', COALESCE(u."ApellidoMaterno", '')) as "NombreEmpleado",
                u."Ci",
                COALESCE(d."Cargo", 'Operador') as "Cargo",
                COALESCE(d."Area", 'Rebobinado') as "Area",
                COALESCE(d."CuentaBancaria", 'Sin registrar') as "CuentaBancaria",
                COALESCE(d."Banco", 'Banco Unión') as "Banco",
                dp."SueldoBasico",
                dp."MontoHorasExtra",
                dp."MontoComisiones",
                dp."TotalBonos",
                dp."DescuentoAtrasos",
                dp."DescuentoFaltas",
                dp."AporteAFP",
                dp."OtrasDeducciones",
                dp."TotalGanado",
                dp."TotalDescuento",
                dp."LiquidoPagable",
                dp."Observacion"
            FROM "DetallePlanilla" dp
            JOIN "Usuario" u ON dp."IdUsuario" = u."IdUsuario"
            LEFT JOIN "DatosLaboralesEmpleado" d ON u."IdUsuario" = d."IdUsuario"
            WHERE dp."IdPlanilla" = :id_planilla
            ORDER BY d."Area" ASC, u."PrimerNombre" ASC;
        """
        return self.caller.LlamarFuncion(sql, {"id_planilla": id_planilla})

    def ObtenerDetallePlanillaPorId(self, id_detalle: int) -> dict | None:
        sql = """
            SELECT 
                dp."IdDetallePlanilla",
                dp."IdPlanilla",
                pl."IdPeriodoNomina",
                p."Mes",
                p."Anio",
                TO_CHAR(p."FechaInicio", 'TMMonth YYYY') as "NombrePeriodo",
                p."FechaInicio",
                p."FechaFin",
                dp."IdUsuario",
                CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno", ' ', COALESCE(u."ApellidoMaterno", '')) as "NombreEmpleado",
                u."Ci",
                d."FechaIngreso",
                COALESCE(d."Cargo", 'Operador') as "Cargo",
                COALESCE(d."Area", 'Rebobinado') as "Area",
                COALESCE(d."CuentaBancaria", 'Sin registrar') as "CuentaBancaria",
                COALESCE(d."Banco", 'Banco Unión') as "Banco",
                dp."SueldoBasico",
                dp."MontoHorasExtra",
                dp."MontoComisiones",
                dp."TotalBonos",
                dp."DescuentoAtrasos",
                dp."DescuentoFaltas",
                dp."AporteAFP",
                dp."OtrasDeducciones",
                dp."TotalGanado",
                dp."TotalDescuento",
                dp."LiquidoPagable",
                dp."Observacion",
                pl."Aprobada",
                pl."FechaAprobacion"
            FROM "DetallePlanilla" dp
            JOIN "Planilla" pl ON dp."IdPlanilla" = pl."IdPlanilla"
            JOIN "PeriodoNomina" p ON pl."IdPeriodoNomina" = p."IdPeriodoNomina"
            JOIN "Usuario" u ON dp."IdUsuario" = u."IdUsuario"
            LEFT JOIN "DatosLaboralesEmpleado" d ON u."IdUsuario" = d."IdUsuario"
            WHERE dp."IdDetallePlanilla" = :id_detalle;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_detalle": id_detalle})

    def ActualizarDetallePlanilla(self, id_detalle: int, datos: dict) -> dict:
        campos = []
        params = {"id_detalle": id_detalle}
        for k, v in datos.items():
            if v is not None:
                campos.append(f'"{k}" = :{k}')
                params[k] = v

        if campos:
            sql = f"""
                UPDATE "DetallePlanilla"
                SET {", ".join(campos)}
                WHERE "IdDetallePlanilla" = :id_detalle;
            """
            self.caller.LlamarFuncion(sql, params)

        # Retornar detalle actualizado
        return self.ObtenerDetallePlanillaPorId(id_detalle)

    def RecalcularTotalesPlanilla(self, id_planilla: int) -> dict:
        sql = """
            UPDATE "Planilla" pl
            SET 
                "TotalSueldoBruto" = COALESCE((SELECT SUM("TotalGanado") FROM "DetallePlanilla" WHERE "IdPlanilla" = :id_p), 0),
                "TotalDeducciones" = COALESCE((SELECT SUM("TotalDescuento") FROM "DetallePlanilla" WHERE "IdPlanilla" = :id_p), 0),
                "TotalLiquido" = COALESCE((SELECT SUM("LiquidoPagable") FROM "DetallePlanilla" WHERE "IdPlanilla" = :id_p), 0)
            WHERE pl."IdPlanilla" = :id_p
            RETURNING "IdPlanilla", "TotalSueldoBruto", "TotalDeducciones", "TotalLiquido";
        """
        return self.caller.LlamarUnRegistro(sql, {"id_p": id_planilla})

    def AprobarPlanilla(self, id_planilla: int, id_usuario_aprueba: int, observacion: str = "") -> dict:
        sql = """
            UPDATE "Planilla"
            SET "Aprobada" = true,
                "IdUsuarioAprueba" = :id_usuario,
                "FechaAprobacion" = now(),
                "Observacion" = :obs
            WHERE "IdPlanilla" = :id_planilla
            RETURNING "IdPlanilla", "Aprobada", "FechaAprobacion";
        """
        res = self.caller.LlamarUnRegistro(sql, {
            "id_planilla": id_planilla,
            "id_usuario": id_usuario_aprueba,
            "obs": observacion or "Planilla aprobada por administración"
        })

        # Marcar periodo como cerrado
        sql_periodo = """
            UPDATE "PeriodoNomina"
            SET "Cerrado" = true
            WHERE "IdPeriodoNomina" = (SELECT "IdPeriodoNomina" FROM "Planilla" WHERE "IdPlanilla" = :id_p);
        """
        self.caller.LlamarFuncion(sql_periodo, {"id_p": id_planilla})
        return res

    # =========================================================================
    # 7. DASHBOARD RESUMEN DE RECURSOS HUMANOS
    # =========================================================================
    def ObtenerKPIsResumenRRHH(self) -> dict:
        sql = """
            SELECT 
                (SELECT COUNT(*) FROM "DatosLaboralesEmpleado" WHERE "Activo" = true) as "TotalEmpleadosActivos",
                (SELECT COUNT(*) FROM "Turno") as "TotalTurnosConfigurados",
                (SELECT COUNT(*) FROM "AsistenciaDiaria" WHERE "Fecha" = CURRENT_DATE AND "HoraEntrada" IS NOT NULL) as "AsistenciasHoy",
                (SELECT COUNT(*) FROM "AsistenciaDiaria" WHERE "Fecha" = CURRENT_DATE AND "EsFalta" = true) as "FaltasHoy",
                (SELECT COALESCE(SUM("SueldoBasico"), 0) FROM "DatosLaboralesEmpleado" WHERE "Activo" = true) as "MasaSalarialMensual",
                (SELECT COUNT(*) FROM "Planilla" WHERE "Aprobada" = true) as "PlanillasAprobadas";
        """
        return self.caller.LlamarUnRegistro(sql, {}) or {}

    # =========================================================================
    # 8. INTEGRACION CONTABLE Y COMISIONES (RN-02, RF-10, HU-12, HU-19, HU-24)
    # =========================================================================
    def ObtenerTotalCobrosRepartidorPeriodo(self, id_usuario: int, fecha_inicio, fecha_fin) -> Decimal:
        """RN-02 / RF-10: Cómputo de comisiones sobre ventas y entregas efectivamente cobradas en campo."""
        # 1. Buscar pagos registrados a través de la app móvil y asignaciones
        sql_pagos = """
            SELECT COALESCE(SUM(pp."Monto"), 0) as total
            FROM "PagoPedido" pp
            JOIN "Pedido" ped ON pp."IdPedido" = ped."IdPedido"
            JOIN "AsignacionRuta" ar ON ped."IdAsignacionRuta" = ar."IdAsignacionRuta"
            WHERE ar."IdUsuarioRepartidor" = :id_u
              AND pp."FechaPago"::date >= :f_ini
              AND pp."FechaPago"::date <= :f_fin;
        """
        res_pagos = self.caller.LlamarUnRegistro(sql_pagos, {"id_u": id_usuario, "f_ini": fecha_inicio, "f_fin": fecha_fin})
        total_pagos = Decimal(str(res_pagos.get("total", 0.0) if res_pagos else 0.0))

        # 2. Fallback a rendiciones en MovimientoCaja
        sql_caja = """
            SELECT COALESCE(SUM(mc."Monto"), 0) as total
            FROM "MovimientoCaja" mc
            JOIN "CategoriaMovimientoCaja" cat ON mc."IdCategoriaMovimientoCaja" = cat."IdCategoriaMovimientoCaja"
            WHERE mc."IdUsuarioRegistro" = :id_u
              AND cat."TipoMovimiento" = 'Ingreso'
              AND (cat."NombreCategoria" ILIKE '%repart%' OR cat."NombreCategoria" ILIKE '%cobranza%')
              AND mc."FechaMovimiento"::date >= :f_ini
              AND mc."FechaMovimiento"::date <= :f_fin;
        """
        res_caja = self.caller.LlamarUnRegistro(sql_caja, {"id_u": id_usuario, "f_ini": fecha_inicio, "f_fin": fecha_fin})
        total_caja = Decimal(str(res_caja.get("total", 0.0) if res_caja else 0.0))

        return max(total_pagos, total_caja)

    def ObtenerTotalAnticiposEmpleadoPeriodo(self, id_usuario: int, nombre_empleado: str, fecha_inicio, fecha_fin) -> Decimal:
        """HU-19: Descuento automático de anticipos otorgados en caja durante el periodo de nómina."""
        sql_ant = """
            SELECT COALESCE(SUM(mc."Monto"), 0) as total
            FROM "MovimientoCaja" mc
            JOIN "CategoriaMovimientoCaja" cat ON mc."IdCategoriaMovimientoCaja" = cat."IdCategoriaMovimientoCaja"
            WHERE cat."TipoMovimiento" = 'Egreso'
              AND (cat."NombreCategoria" ILIKE '%anticipo%' OR cat."NombreCategoria" ILIKE '%adelanto%')
              AND (
                  mc."Solicitante" ILIKE :nom 
                  OR mc."Descripcion" ILIKE :nom
                  OR mc."IdUsuarioRegistro" = :id_u
              )
              AND mc."FechaMovimiento"::date >= :f_ini
              AND mc."FechaMovimiento"::date <= :f_fin;
        """
        nom_param = f"%{nombre_empleado}%" if nombre_empleado else "---"
        res = self.caller.LlamarUnRegistro(sql_ant, {"id_u": id_usuario, "nom": nom_param, "f_ini": fecha_inicio, "f_fin": fecha_fin})
        return Decimal(str(res.get("total", 0.0) if res else 0.0))

    def CrearAsientoEgresoPlanilla(self, id_planilla: int, id_usuario_aprueba: int) -> dict:
        """HU-12: Generar asiento contable automático en flujo de caja al aprobar la planilla salarial."""
        # 1. Obtener datos de la planilla
        sql_pl = 'SELECT pl.*, pn."Mes", pn."Anio" FROM "Planilla" pl JOIN "PeriodoNomina" pn ON pl."IdPeriodoNomina" = pn."IdPeriodoNomina" WHERE pl."IdPlanilla" = :id_p;'
        pl = self.caller.LlamarUnRegistro(sql_pl, {"id_p": id_planilla})
        if not pl:
            return {}

        liquido_total = float(pl.get("TotalLiquido", 0.0))
        if liquido_total <= 0:
            return {}

        # 2. Verificar si ya existe movimiento para esta planilla
        ref = f"PLN-{id_planilla}"
        sql_dup = 'SELECT "IdMovimientoCaja" FROM "MovimientoCaja" WHERE "NumeroReferencia" = :ref;'
        dup = self.caller.LlamarUnRegistro(sql_dup, {"ref": ref})
        if dup:
            return dup

        # 3. Buscar sesión de caja abierta o la más reciente
        sql_caja = 'SELECT "IdAperturaCierreCaja" FROM "AperturaCierreCaja" WHERE "FechaCierre" IS NULL ORDER BY "FechaApertura" DESC LIMIT 1;'
        caja = self.caller.LlamarUnRegistro(sql_caja)
        if not caja:
            sql_last_caja = 'SELECT "IdAperturaCierreCaja" FROM "AperturaCierreCaja" ORDER BY "FechaApertura" DESC LIMIT 1;'
            caja = self.caller.LlamarUnRegistro(sql_last_caja)

        id_apertura = caja["IdAperturaCierreCaja"] if caja else 1

        # 4. Obtener o crear categoría Sueldos y Salarios
        sql_cat = 'SELECT "IdCategoriaMovimientoCaja" FROM "CategoriaMovimientoCaja" WHERE "NombreCategoria" ILIKE '%sueldo%' OR "NombreCategoria" ILIKE '%salario%' LIMIT 1;'
        cat = self.caller.LlamarUnRegistro(sql_cat)
        id_cat = cat["IdCategoriaMovimientoCaja"] if cat else 1

        # 5. Insertar Movimiento de Caja (Egreso)
        sql_insert = """
            INSERT INTO "MovimientoCaja" (
                "IdAperturaCierreCaja", "IdCategoriaMovimientoCaja", "TipoMovimiento",
                "Monto", "FechaMovimiento", "Solicitante", "Descripcion",
                "NumeroReferencia", "IdUsuarioRegistro"
            ) VALUES (
                :id_apertura, :id_cat, 'Egreso',
                :monto, NOW(), 'Planilla General de Personal',
                :desc, :ref, :id_u
            ) RETURNING *;
        """
        glosa = f"Asiento contable automático por pago de planilla de haberes {pl.get('Mes')}/{pl.get('Anio')} (Planilla #{id_planilla})"
        mov = self.caller.LlamarUnRegistro(sql_insert, {
            "id_apertura": id_apertura,
            "id_cat": id_cat,
            "monto": liquido_total,
            "desc": glosa,
            "ref": ref,
            "id_u": id_usuario_aprueba
        })

        # 6. Registrar en AuditLog (HU-16)
        try:
            sql_audit = """
                INSERT INTO "AuditLog" ("IdUsuario", "Accion", "TablaAfectada", "IdRegistroAfectado", "Detalle", "FechaHora")
                VALUES (:id_u, 'APROBACION_NOMINA', 'Planilla', :id_p, :det, NOW());
            """
            self.caller.LlamarFuncion(sql_audit, {
                "id_u": id_usuario_aprueba,
                "id_p": str(id_planilla),
                "det": f"Aprobación de nómina #{id_planilla} con generación de asiento automático por Bs. {liquido_total:.2f} (Ref: {ref})."
            })
        except Exception:
            pass

        return mov
