import sys
sys.path.insert(0, ".")
from app.Config.supabase import SessionLocal
from sqlalchemy import text
from decimal import Decimal

# Lista maestra de los 20 empleados de PLANILLA OCTUBRE 2026 (SHEMA ASOCIADOS S.R.L.)
EMPLEADOS_OCTUBRE = [
    # ASEGURADOS
    {
        "ci": "10355315",
        "nombres": "Eulogia",
        "paterno": "Sayhua",
        "materno": "Cervantes",
        "cargo": "Operario",
        "area": "Producción Planta",
        "sueldo": Decimal("3300.00"),
        "fecha_ingreso": "2025-11-01",
        "es_asegurado": True,
        "banco": "Banco Sol",
        "cuenta": "1011332-000-001",
        "horas_extra": Decimal("0.00"),
        "monto_he": Decimal("0.00"),
        "descuento": Decimal("0.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Asegurado Gestora 12.71%"
    },
    {
        "ci": "5660389",
        "nombres": "Lesli",
        "paterno": "Carrasco",
        "materno": "Daza",
        "cargo": "Administrativa y Ventas",
        "area": "Administración",
        "sueldo": Decimal("4600.00"),
        "fecha_ingreso": "2026-03-01",
        "es_asegurado": True,
        "banco": "Banco Unión",
        "cuenta": "10000010520430",
        "horas_extra": Decimal("0.00"),
        "monto_he": Decimal("0.00"),
        "descuento": Decimal("0.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Asegurado Gestora 12.71%"
    },
    {
        "ci": "7565412",
        "nombres": "Ernesto",
        "paterno": "Aguilar",
        "materno": "Coragua",
        "cargo": "Operario",
        "area": "Producción Planta",
        "sueldo": Decimal("3300.00"),
        "fecha_ingreso": "2025-11-01",
        "es_asegurado": True,
        "banco": "Banco Unión",
        "cuenta": "145558795",
        "horas_extra": Decimal("0.00"),
        "monto_he": Decimal("0.00"),
        "descuento": Decimal("110.00"), # Falta 1 día (31 Octubre)
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Asegurado Gestora 12.71% - Falta sábado 31 Octubre"
    },
    {
        "ci": "12739468",
        "nombres": "Gabriel",
        "paterno": "León",
        "materno": "",
        "cargo": "Operario",
        "area": "Producción Planta",
        "sueldo": Decimal("3300.00"),
        "fecha_ingreso": "2025-11-01",
        "es_asegurado": True,
        "banco": "Banco BISA",
        "cuenta": "772971-4016",
        "horas_extra": Decimal("0.00"),
        "monto_he": Decimal("0.00"),
        "descuento": Decimal("260.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Asegurado Gestora 12.71%"
    },
    {
        "ci": "7497429",
        "nombres": "Paola Estrella",
        "paterno": "Flores",
        "materno": "Pinto",
        "cargo": "Operario",
        "area": "Producción Planta",
        "sueldo": Decimal("3300.00"),
        "fecha_ingreso": "2025-11-01",
        "es_asegurado": True,
        "banco": "Efectivo",
        "cuenta": "",
        "horas_extra": Decimal("0.00"),
        "monto_he": Decimal("0.00"),
        "descuento": Decimal("110.00"), # Falta sábado 31 Octubre
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Asegurado Gestora 12.71% - Falta sábado 31 Octubre"
    },
    {
        "ci": "10385041",
        "nombres": "Kevin Fernando",
        "paterno": "García",
        "materno": "Trujillo",
        "cargo": "Contador",
        "area": "Contabilidad",
        "sueldo": Decimal("4000.00"),
        "fecha_ingreso": "2026-09-01",
        "es_asegurado": True,
        "banco": "Banco Unión",
        "cuenta": "10000023965508",
        "horas_extra": Decimal("0.00"),
        "monto_he": Decimal("0.00"),
        "descuento": Decimal("166.66"), # 1 falta (133.33) + 2 hrs atraso (33.33)
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Asegurado Gestora 12.71% - Falta 2 Octubre y 2h atraso 27 Octubre"
    },

    # EXTERNOS
    {
        "ci": "1093833",
        "nombres": "Carlos René",
        "paterno": "Méndez",
        "materno": "Portugal",
        "cargo": "Encargado Operativo",
        "area": "Operaciones",
        "sueldo": Decimal("6325.00"),
        "fecha_ingreso": "2025-10-09",
        "es_asegurado": False,
        "banco": "Banco Unión",
        "cuenta": "131722833",
        "horas_extra": Decimal("10.50"),
        "monto_he": Decimal("553.44"),
        "descuento": Decimal("0.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Personal Externo 0% AFP"
    },
    {
        "ci": "10331316",
        "nombres": "María Luisa",
        "paterno": "Limachi",
        "materno": "Carrillo",
        "cargo": "Encargada de Ventas e Inventarios",
        "area": "Ventas",
        "sueldo": Decimal("3843.47"),
        "fecha_ingreso": "2025-10-09",
        "es_asegurado": False,
        "banco": "Banco BISA",
        "cuenta": "706312-4014",
        "horas_extra": Decimal("6.75"),
        "monto_he": Decimal("216.20"),
        "descuento": Decimal("0.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Personal Externo 0% AFP"
    },
    {
        "ci": "7534176",
        "nombres": "Juan Víctor",
        "paterno": "Vela",
        "materno": "Esquibel",
        "cargo": "Área Ventas",
        "area": "Ventas",
        "sueldo": Decimal("3450.00"),
        "fecha_ingreso": "2025-02-01",
        "es_asegurado": False,
        "banco": "Banco Nacional de Bolivia",
        "cuenta": "450-1323778",
        "horas_extra": Decimal("0.00"),
        "monto_he": Decimal("0.00"),
        "descuento": Decimal("0.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Personal Externo 0% AFP"
    },
    {
        "ci": "10331304",
        "nombres": "Alex",
        "paterno": "Limachi",
        "materno": "",
        "cargo": "Área Ventas",
        "area": "Ventas",
        "sueldo": Decimal("3450.00"),
        "fecha_ingreso": "2025-07-07",
        "es_asegurado": False,
        "banco": "Efectivo",
        "cuenta": "",
        "horas_extra": Decimal("0.00"),
        "monto_he": Decimal("0.00"),
        "descuento": Decimal("0.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Personal Externo 0% AFP"
    },
    {
        "ci": "8317232",
        "nombres": "Dennis",
        "paterno": "Figueroa",
        "materno": "",
        "cargo": "Operario",
        "area": "Producción Planta",
        "sueldo": Decimal("3300.00"),
        "fecha_ingreso": "2025-10-13",
        "es_asegurado": False,
        "banco": "Banco FIE",
        "cuenta": "40-0-0006949-5",
        "horas_extra": Decimal("17.75"),
        "monto_he": Decimal("488.13"),
        "descuento": Decimal("0.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Personal Externo 0% AFP"
    },
    {
        "ci": "15643850",
        "nombres": "Cristian",
        "paterno": "Ortiz",
        "materno": "",
        "cargo": "Operario",
        "area": "Producción Planta",
        "sueldo": Decimal("3450.00"),
        "fecha_ingreso": "2025-11-27",
        "es_asegurado": False,
        "banco": "Banco Unión",
        "cuenta": "10000063129643",
        "horas_extra": Decimal("5.00"),
        "monto_he": Decimal("143.75"),
        "descuento": Decimal("0.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Personal Externo 0% AFP"
    },
    {
        "ci": "12835568",
        "nombres": "Beatriz",
        "paterno": "Chintari",
        "materno": "Lescano",
        "cargo": "Reponedora e Impulsadora",
        "area": "Comercial",
        "sueldo": Decimal("3450.00"),
        "fecha_ingreso": "2025-11-18",
        "es_asegurado": False,
        "banco": "Banco Nacional de Bolivia",
        "cuenta": "4500850448",
        "horas_extra": Decimal("0.00"),
        "monto_he": Decimal("0.00"),
        "descuento": Decimal("71.88"), # 5 horas atraso
        "anticipos": Decimal("1200.00"),
        "faltantes": Decimal("1218.00"), # Faltante Sandra Campos (1185) + mitad ventas Sept (33)
        "observacion": "Personal Externo 0% AFP - Faltantes cobranza Sandra Campos y Sept."
    },
    {
        "ci": "10350159",
        "nombres": "Ivana",
        "paterno": "Salanova",
        "materno": "Kama",
        "cargo": "Operario",
        "area": "Producción Planta",
        "sueldo": Decimal("3450.00"),
        "fecha_ingreso": "2025-12-01",
        "es_asegurado": False,
        "banco": "Banco Unión",
        "cuenta": "140301602",
        "horas_extra": Decimal("18.50"),
        "monto_he": Decimal("531.88"),
        "descuento": Decimal("0.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Personal Externo 0% AFP"
    },
    {
        "ci": "13122307",
        "nombres": "Marisol",
        "paterno": "Arancibia",
        "materno": "Carrillo",
        "cargo": "Operario",
        "area": "Producción Planta",
        "sueldo": Decimal("3300.00"),
        "fecha_ingreso": "2025-12-22",
        "es_asegurado": False,
        "banco": "Al Toke",
        "cuenta": "4013724-000-001",
        "horas_extra": Decimal("15.25"),
        "monto_he": Decimal("419.38"),
        "descuento": Decimal("0.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Personal Externo 0% AFP"
    },
    {
        "ci": "13442483",
        "nombres": "Wilson",
        "paterno": "Álvarez",
        "materno": "Bravo",
        "cargo": "Operario",
        "area": "Producción Planta",
        "sueldo": Decimal("3300.00"),
        "fecha_ingreso": "2026-04-06",
        "es_asegurado": False,
        "banco": "Banco Unión",
        "cuenta": "10000029739999",
        "horas_extra": Decimal("0.00"),
        "monto_he": Decimal("0.00"),
        "descuento": Decimal("0.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Personal Externo 0% AFP"
    },
    {
        "ci": "14106744",
        "nombres": "Alex",
        "paterno": "Ramos",
        "materno": "",
        "cargo": "Operario",
        "area": "Producción Planta",
        "sueldo": Decimal("3300.00"),
        "fecha_ingreso": "2026-03-04",
        "es_asegurado": False,
        "banco": "Al Toke",
        "cuenta": "1818356-000-002",
        "horas_extra": Decimal("0.75"),
        "monto_he": Decimal("20.63"),
        "descuento": Decimal("0.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Personal Externo 0% AFP"
    },
    {
        "ci": "7494198",
        "nombres": "Luis",
        "paterno": "Azurduy",
        "materno": "",
        "cargo": "Operario",
        "area": "Producción Planta",
        "sueldo": Decimal("3300.00"),
        "fecha_ingreso": "2026-03-04",
        "es_asegurado": False,
        "banco": "Banco Nacional de Bolivia",
        "cuenta": "4501621213",
        "horas_extra": Decimal("0.00"),
        "monto_he": Decimal("0.00"),
        "descuento": Decimal("0.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("33.00"), # Mitad faltante cobros Septiembre
        "observacion": "Personal Externo 0% AFP - Mitad faltante cobros Septiembre (33 Bs)"
    },
    {
        "ci": "12898896",
        "nombres": "Efraín",
        "paterno": "Aguilar",
        "materno": "Coragua",
        "cargo": "Operario",
        "area": "Producción Planta",
        "sueldo": Decimal("3300.00"),
        "fecha_ingreso": "2026-08-28",
        "es_asegurado": False,
        "banco": "Banco Unión",
        "cuenta": "144803597",
        "horas_extra": Decimal("17.00"),
        "monto_he": Decimal("467.19"),
        "descuento": Decimal("0.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Personal Externo 0% AFP"
    },
    {
        "ci": "15278735",
        "nombres": "Limbert Humberto",
        "paterno": "Salazar",
        "materno": "García",
        "cargo": "Operario",
        "area": "Producción Planta",
        "sueldo": Decimal("3300.00"),
        "fecha_ingreso": "2026-09-01",
        "es_asegurado": False,
        "banco": "Banco Sol",
        "cuenta": "2625891-000-001",
        "horas_extra": Decimal("6.25"),
        "monto_he": Decimal("171.88"),
        "descuento": Decimal("0.00"),
        "anticipos": Decimal("0.00"),
        "faltantes": Decimal("0.00"),
        "observacion": "Personal Externo 0% AFP"
    }
]

db = SessionLocal()
try:
    print(f"Iniciando sincronización de {len(EMPLEADOS_OCTUBRE)} empleados del libro contable oficial...")
    
    # 1. Periodo Octubre 2026
    sql_per = """
        INSERT INTO "PeriodoNomina" ("Mes", "Anio", "FechaInicio", "FechaFin", "Cerrado")
        VALUES (10, 2026, '2026-10-01', '2026-10-31', false)
        ON CONFLICT ("Mes", "Anio") DO UPDATE
        SET "FechaInicio" = EXCLUDED."FechaInicio", "FechaFin" = EXCLUDED."FechaFin"
        RETURNING "IdPeriodoNomina";
    """
    res_per = db.execute(text(sql_per)).fetchone()
    id_periodo_oct = res_per[0]
    print(f"Periodo Octubre 2026 listo con ID: {id_periodo_oct}")

    # 2. Planilla Octubre 2026
    sql_pl = """
        INSERT INTO "Planilla" (
            "IdPeriodoNomina", "IdUsuarioGenera", "FechaGeneracion",
            "TotalSueldoBruto", "TotalDeducciones", "TotalLiquido", "Aprobada",
            "TipoPlanilla", "IdSucursal"
        ) VALUES (
            :id_p, 1, now(), 0, 0, 0, false, 'INTERNA', 1
        )
        ON CONFLICT DO NOTHING;
    """
    db.execute(text(sql_pl), {"id_p": id_periodo_oct})
    db.commit()

    id_planilla_oct = db.execute(
        text('SELECT "IdPlanilla" FROM "Planilla" WHERE "IdPeriodoNomina" = :p AND "TipoPlanilla" = \'INTERNA\' AND COALESCE("IdSucursal", 1) = 1 ORDER BY "IdPlanilla" DESC LIMIT 1'),
        {"p": id_periodo_oct}
    ).scalar()
    print(f"Planilla Interna Octubre 2026 con ID: {id_planilla_oct}")

    # Limpiar detalles previos de esta planilla para reconstruir de forma perfecta
    db.execute(text('DELETE FROM "DetallePlanilla" WHERE "IdPlanilla" = :id_pl'), {"id_pl": id_planilla_oct})
    db.commit()

    from app.cli.seed_usuarios_todos_modulos import _crear_o_actualizar_auth_user

    detalles_insertados = 0
    for emp in EMPLEADOS_OCTUBRE:
        ci = emp["ci"]
        email = f"{ci}@blanquita.com"
        auth_uid = _crear_o_actualizar_auth_user(email, "BlanquitaOperativo2026!")

        # Buscar usuario por CI o por AuthUserId
        u = db.execute(text('SELECT "IdUsuario" FROM "Usuario" WHERE "Ci" = :ci OR "AuthUserId" = :aid LIMIT 1'), {"ci": ci, "aid": auth_uid}).fetchone()
        if not u:
            # Crear usuario en public."Usuario"
            sql_u = """
                INSERT INTO "Usuario" (
                    "PrimerNombre", "ApellidoPaterno", "ApellidoMaterno", "Ci",
                    "IdRol", "IdEstadoUsuario", "AuthUserId"
                ) VALUES (
                    :nom, :pat, :mat, :ci,
                    5, 1, :aid
                ) RETURNING "IdUsuario";
            """
            u_id = db.execute(text(sql_u), {
                "nom": emp["nombres"],
                "pat": emp["paterno"],
                "mat": emp["materno"],
                "ci": ci,
                "aid": auth_uid
            }).scalar()
        else:
            u_id = u[0]
            # Actualizar nombres y AuthUserId por si acaso
            db.execute(text("""
                UPDATE "Usuario"
                SET "PrimerNombre" = :nom, "ApellidoPaterno" = :pat, "ApellidoMaterno" = :mat, "Ci" = :ci, "AuthUserId" = :aid
                WHERE "IdUsuario" = :uid
            """), {
                "nom": emp["nombres"],
                "pat": emp["paterno"],
                "mat": emp["materno"],
                "ci": ci,
                "aid": auth_uid,
                "uid": u_id
            })

        # Insertar o actualizar DatosLaboralesEmpleado
        sql_lab = """
            INSERT INTO "DatosLaboralesEmpleado" (
                "IdUsuario", "Cargo", "Area", "SueldoBasico", "FechaIngreso",
                "EsAsegurado", "Banco", "CuentaBancaria", "Activo"
            ) VALUES (
                :uid, :cargo, :area, :sueldo, :f_ing,
                :es_aseg, :banco, :cuenta, true
            )
            ON CONFLICT ("IdUsuario") DO UPDATE SET
                "Cargo" = EXCLUDED."Cargo",
                "Area" = EXCLUDED."Area",
                "SueldoBasico" = EXCLUDED."SueldoBasico",
                "FechaIngreso" = EXCLUDED."FechaIngreso",
                "EsAsegurado" = EXCLUDED."EsAsegurado",
                "Banco" = EXCLUDED."Banco",
                "CuentaBancaria" = EXCLUDED."CuentaBancaria",
                "Activo" = true;
        """
        db.execute(text(sql_lab), {
            "uid": u_id,
            "cargo": emp["cargo"],
            "area": emp["area"],
            "sueldo": emp["sueldo"],
            "f_ing": emp["fecha_ingreso"],
            "es_aseg": emp["es_asegurado"],
            "banco": emp["banco"],
            "cuenta": emp["cuenta"]
        })

        # Calcular valores matemáticos
        sueldo_b = emp["sueldo"]
        valor_hora = (sueldo_b / Decimal("240")).quantize(Decimal("0.0001"))
        monto_he = emp["monto_he"]
        total_ganado = (sueldo_b + monto_he).quantize(Decimal("0.01"))
        
        # AFP
        if emp["es_asegurado"]:
            aporte_afp = (total_ganado * Decimal("0.1271")).quantize(Decimal("0.01"))
        else:
            aporte_afp = Decimal("0.00")

        descuento_faltas = emp["descuento"]
        anticipos = emp["anticipos"]
        faltantes = emp["faltantes"]
        total_descuento = (aporte_afp + descuento_faltas + anticipos + faltantes).quantize(Decimal("0.01"))
        liquido = (total_ganado - total_descuento).quantize(Decimal("0.01"))
        
        metodo = "BANCO" if emp["cuenta"] and emp["cuenta"].lower() != "sin registrar" else "EFECTIVO"

        # Insertar DetallePlanilla
        sql_det = """
            INSERT INTO "DetallePlanilla" (
                "IdPlanilla", "IdUsuario", "SueldoBasico", "MontoHorasExtra",
                "MontoComisiones", "TotalBonos", "DescuentoAtrasos", "DescuentoFaltas",
                "DescuentoNoVenta", "HorasTrabajadasAJ", "ValorHora",
                "AporteAFP", "OtrasDeducciones", "TotalGanado", "TotalDescuento",
                "LiquidoPagable", "Observacion",
                "DiasTrabajados", "HorasExtrasTotal", "DiasFalta", "HorasAtraso",
                "Anticipos", "FaltantesVentas", "AporteNacionalSolidario", "RCIVA",
                "MetodoPago", "Banco", "NroCuenta", "EsAsegurado", "DetalleHorasJson"
            ) VALUES (
                :id_pl, :uid, :sueldo, :monto_he,
                0.00, 0.00, 0.00, :desc_faltas,
                0.00, 0.00, :val_hora,
                :afp, 0.00, :tot_gan, :tot_desc,
                :liq, :obs,
                30, :hrs_extra, 0, 0.00,
                :ant, :falt, 0.00, 0.00,
                :metodo, :banco, :cuenta, :es_aseg, NULL
            );
        """
        db.execute(text(sql_det), {
            "id_pl": id_planilla_oct,
            "uid": u_id,
            "sueldo": sueldo_b,
            "monto_he": monto_he,
            "desc_faltas": descuento_faltas,
            "val_hora": valor_hora,
            "afp": aporte_afp,
            "tot_gan": total_ganado,
            "tot_desc": total_descuento,
            "liq": liquido,
            "obs": emp["observacion"],
            "hrs_extra": emp["horas_extra"],
            "ant": anticipos,
            "falt": faltantes,
            "metodo": metodo,
            "banco": emp["banco"],
            "cuenta": emp["cuenta"],
            "es_aseg": emp["es_asegurado"]
        })
        detalles_insertados += 1

    db.commit()
    print(f"Éxito: Se registraron {detalles_insertados} empleados y detalles en Planilla Octubre 2026.")

    # Recalcular totales de planilla
    from app.Services.RRHH.RRHHService import RRHHService
    svc = RRHHService(db)
    res_tot = svc.repository.RecalcularTotalesPlanilla(id_planilla_oct)
    print("Totales recalculados de la planilla:", res_tot)

finally:
    db.close()
