from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import date, datetime, timedelta, time
from decimal import Decimal, ROUND_HALF_UP
import re

from app.Repository.RRHH.RRHHRepository import RRHHRepository

def numero_a_palabras_bob(monto: Decimal) -> str:
    """Convierte un importe numérico en Bs. a su representación literal oficial en español."""
    try:
        entero = int(monto)
        centavos = int((monto - entero) * 100)
        
        unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"]
        dieces = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"]
        decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"]
        centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"]

        def convertir_grupo(n):
            if n == 0:
                return ""
            if n == 100:
                return "CIEN"
            res = []
            c = n // 100
            d = (n % 100) // 10
            u = n % 10
            if c > 0:
                res.append(centenas[c])
            if d == 1:
                res.append(dieces[u])
            elif d == 2 and u > 0:
                res.append(f"VEINTI{unidades[u]}")
            else:
                if d > 0:
                    res.append(decenas[d])
                if u > 0:
                    if d > 0:
                        res.append(f"Y {unidades[u]}")
                    else:
                        res.append(unidades[u])
            return " ".join(res).strip()

        if entero == 0:
            texto = "CERO"
        elif entero < 1000:
            texto = convertir_grupo(entero)
        elif entero < 1000000:
            miles = entero // 1000
            resto = entero % 1000
            txt_miles = "MIL" if miles == 1 else f"{convertir_grupo(miles)} MIL"
            txt_resto = convertir_grupo(resto)
            texto = f"{txt_miles} {txt_resto}".strip()
        else:
            millones = entero // 1000000
            resto = entero % 1000000
            txt_millones = "UN MILLON" if millones == 1 else f"{convertir_grupo(millones)} MILLONES"
            miles = resto // 1000
            subresto = resto % 1000
            txt_miles = f"{convertir_grupo(miles)} MIL" if miles > 0 else ""
            txt_resto = convertir_grupo(subresto)
            texto = f"{txt_millones} {txt_miles} {txt_resto}".strip()

        return f"{texto} {centavos:02d}/100 BOLIVIANOS"
    except Exception:
        return f"{monto:.2f} BOLIVIANOS"


class RRHHService:
    def __init__(self, db: Session):
        self.repository = RRHHRepository(db)

    # =========================================================================
    # 1. EMPLEADOS
    # =========================================================================
    def ListarEmpleados(self, busqueda: str = "", area: str = "", activo: bool | None = None) -> list[dict]:
        return self.repository.ListarEmpleados(busqueda, area, activo)

    def ObtenerEmpleado(self, id_usuario: int) -> dict:
        emp = self.repository.ObtenerEmpleadoPorId(id_usuario)
        if not emp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empleado no encontrado")
        return emp

    def ActualizarEmpleado(self, id_usuario: int, datos: dict) -> dict:
        self.ObtenerEmpleado(id_usuario)

        campos_usuario = {
            "PrimerNombre": datos.get("PrimerNombre"),
            "SegundoNombre": datos.get("SegundoNombre"),
            "ApellidoPaterno": datos.get("ApellidoPaterno"),
            "ApellidoMaterno": datos.get("ApellidoMaterno"),
            "Celular": datos.get("Celular"),
        }
        campos_laborales = {
            "Cargo": datos.get("Cargo"),
            "Area": datos.get("Area"),
            "SueldoBasico": datos.get("SueldoBasico"),
            "FechaIngreso": datos.get("FechaIngreso"),
            "PorcentajeComisionDefault": datos.get("PorcentajeComisionDefault"),
            "CuentaBancaria": datos.get("CuentaBancaria"),
            "Banco": datos.get("Banco"),
            "Activo": datos.get("Activo"),
        }
        return self.repository.ActualizarEmpleado(id_usuario, campos_usuario, campos_laborales)

    # =========================================================================
    # 2. TURNOS & HORARIOS
    # =========================================================================
    def ListarTurnos(self, area: str = "") -> list[dict]:
        return self.repository.ListarTurnos(area)

    def CrearTurno(self, datos: dict) -> dict:
        return self.repository.CrearTurno(datos)

    def ActualizarTurno(self, id_turno: int, datos: dict) -> dict:
        t = self.repository.ObtenerTurnoPorId(id_turno)
        if not t:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Turno no encontrado")
        return self.repository.ActualizarTurno(id_turno, datos)

    def EliminarTurno(self, id_turno: int) -> bool:
        t = self.repository.ObtenerTurnoPorId(id_turno)
        if not t:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Turno no encontrado")
        return self.repository.EliminarTurno(id_turno)

    # =========================================================================
    # 3. CRONOGRAMA DE TURNOS SEMANAL
    # =========================================================================
    def ObtenerCronograma(self, fecha_inicio: date, fecha_fin: date, area: str = "") -> list[dict]:
        return self.repository.ListarCronograma(fecha_inicio, fecha_fin, area)

    def AsignarTurno(self, id_usuario: int, id_turno: int, fecha: date, area: str = "", observacion: str = "") -> dict:
        return self.repository.AsignarTurno(id_usuario, id_turno, fecha, area, observacion)

    def AsignarTurnosBatch(self, lista_asignaciones: list[dict]) -> dict:
        total = 0
        for item in lista_asignaciones:
            self.repository.AsignarTurno(
                id_usuario=item["IdUsuario"],
                id_turno=item["IdTurno"],
                fecha=item["Fecha"],
                area=item.get("Area", ""),
                observacion=item.get("Observacion", "")
            )
            total += 1
        return {"mensaje": f"Se programaron {total} asignaciones de turno correctamente"}

    def DesasignarTurno(self, id_usuario: int, fecha: date) -> bool:
        return self.repository.DesasignarTurno(id_usuario, fecha)

    # =========================================================================
    # 4. ASISTENCIA & BIOMÉTRICO (NG-ECO / ZKTECO)
    # =========================================================================
    def ListarAsistencias(self, fecha_inicio: date, fecha_fin: date, id_usuario: int | None = None, area: str = "") -> list[dict]:
        return self.repository.ListarAsistencias(fecha_inicio, fecha_fin, id_usuario, area)

    def ActualizarAsistencia(self, id_asistencia: int, datos: dict) -> dict:
        asist = self.repository.ObtenerAsistenciaPorId(id_asistencia)
        if not asist:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro de asistencia no encontrado")
        return self.repository.ActualizarAsistencia(id_asistencia, datos)

    def RegistrarMarcaManual(self, id_usuario: int, fecha_hora: datetime, tipo_marca: str, origen: str = "Manual", id_disp: str = "WEB-ADMIN") -> dict:
        # 1. Guardar en MarcaBiometrica
        marca = self.repository.RegistrarMarcaBiometrica(id_usuario, fecha_hora, tipo_marca, origen, id_disp)

        # 2. Procesar e impactar en AsistenciaDiaria
        self._ProcesarMarcaEnAsistencia(id_usuario, fecha_hora, tipo_marca)
        return marca

    def ImportarMarcacionesBiometrico(self, items: list[dict]) -> dict:
        """
        Procesa un lote de marcaciones importadas desde el biométrico NGTeco/ZKTeco.
        Mapea el código de usuario (CI o ID) al usuario del sistema y computa asistencia.
        """
        tolerancia_minutos = int(self.repository.ObtenerValorConfiguracion("ToleranciaAtrasoMinutos", Decimal("10")))

        # Mapeo en memoria de CI y IdUsuario
        empleados = self.repository.ListarEmpleados()
        mapa_ci = {str(e["Ci"]).strip(): e["IdUsuario"] for e in empleados}
        mapa_id = {str(e["IdUsuario"]): e["IdUsuario"] for e in empleados}

        total_procesadas = 0
        total_ignoradas = 0

        for item in items:
            cod_usr = str(item.get("CodigoUsuario") or item.get("Identificador") or "").strip()
            id_usuario = mapa_ci.get(cod_usr) or mapa_id.get(cod_usr)
            if not id_usuario:
                total_ignoradas += 1
                continue

            fh_str = str(item.get("FechaHora", "")).strip()
            try:
                # Soportar múltiples formatos de fecha/hora de biométricos
                fh = None
                for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%Y/%m/%d %H:%M:%S"):
                    try:
                        fh = datetime.strptime(fh_str, fmt)
                        break
                    except ValueError:
                        pass
                if not fh:
                    total_ignoradas += 1
                    continue
            except Exception:
                total_ignoradas += 1
                continue

            # Determinar tipo de marca (Entrada o Salida)
            estado_raw = str(item.get("Estado") or item.get("Tipo") or "").lower()
            if "out" in estado_raw or "salida" in estado_raw:
                tipo_marca = "Salida"
            elif "in" in estado_raw or "entrada" in estado_raw:
                tipo_marca = "Entrada"
            else:
                # Auto-detección por hora (antes de las 13:00 entrada, después salida)
                tipo_marca = "Entrada" if fh.hour < 13 else "Salida"

            dispositivo = item.get("Dispositivo") or item.get("IdDispositivo") or "NG-ECO-01"

            # Guardar MarcaBiometrica
            self.repository.RegistrarMarcaBiometrica(id_usuario, fh, tipo_marca, "Biometrico", dispositivo)

            # Impactar en AsistenciaDiaria
            self._ProcesarMarcaEnAsistencia(id_usuario, fh, tipo_marca, tolerancia_minutos)
            total_procesadas += 1

        return {
            "mensaje": f"Se procesaron con éxito {total_procesadas} marcaciones del biométrico",
            "total_procesadas": total_procesadas,
            "total_ignoradas": total_ignoradas
        }

    def _ProcesarMarcaEnAsistencia(self, id_usuario: int, fecha_hora: datetime, tipo_marca: str, tolerancia: int = 10):
        fecha_d = fecha_hora.date()
        hora_t = fecha_hora.time()
        hora_str = hora_t.strftime("%H:%M:%S")

        # Buscar si ya existe AsistenciaDiaria para este usuario y fecha
        asists = self.repository.ListarAsistencias(fecha_d, fecha_d, id_usuario)
        asist = asists[0] if asists else None

        # Si no existe, crear registro base (asociar con turno 1 por defecto si no tenía asignado)
        if not asist:
            asist_res = self.repository.AsignarTurno(id_usuario, 1, fecha_d)
            asists = self.repository.ListarAsistencias(fecha_d, fecha_d, id_usuario)
            asist = asists[0] if asists else None

        if not asist:
            return

        id_asistencia = asist["IdAsistenciaDiaria"]
        hora_entrada_actual = asist.get("HoraEntrada")
        hora_salida_actual = asist.get("HoraSalida")

        updates = {"EsFalta": False}

        if tipo_marca == "Entrada":
            # Si no tiene entrada, o la nueva es más temprana
            if not hora_entrada_actual or hora_str < hora_entrada_actual:
                updates["HoraEntrada"] = hora_str

                # Calcular minutos de atraso vs TurnoHoraInicio
                t_ini_str = asist.get("TurnoHoraInicio") or "06:00"
                h_ini = datetime.strptime(t_ini_str, "%H:%M").time()
                t_ini_dt = datetime.combine(fecha_d, h_ini)
                t_ent_dt = datetime.combine(fecha_d, hora_t)

                if t_ent_dt > t_ini_dt:
                    diff_min = int((t_ent_dt - t_ini_dt).total_seconds() / 60)
                    updates["MinutosAtraso"] = max(0, diff_min - tolerancia) if diff_min > tolerancia else 0
                else:
                    updates["MinutosAtraso"] = 0
        else:
            # Salida: si no tiene salida, o la nueva es más tardía
            if not hora_salida_actual or hora_str > hora_salida_actual:
                updates["HoraSalida"] = hora_str

                # Calcular horas extras vs TurnoHoraFin
                t_fin_str = asist.get("TurnoHoraFin") or "15:00"
                h_fin = datetime.strptime(t_fin_str, "%H:%M").time()
                t_fin_dt = datetime.combine(fecha_d, h_fin)
                t_sal_dt = datetime.combine(fecha_d, hora_t)

                if t_sal_dt > t_fin_dt:
                    diff_sec = (t_sal_dt - t_fin_dt).total_seconds()
                    hrs_extra = Decimal(str(round(diff_sec / 3600.0, 2)))
                    updates["HorasExtraTrabajadas"] = hrs_extra
                else:
                    updates["HorasExtraTrabajadas"] = Decimal("0.00")

        self.repository.ActualizarAsistencia(id_asistencia, updates)

    # =========================================================================
    # 5. CONFIGURACIÓN LABORAL
    # =========================================================================
    def ListarConfiguracion(self) -> list[dict]:
        return self.repository.ListarConfiguracionLaboral()

    def ActualizarConfiguracion(self, id_config: int, valor: Decimal, descripcion: str | None = None) -> dict:
        return self.repository.ActualizarParametroLaboral(id_config, valor, descripcion)

    # =========================================================================
    # 6. PLANILLAS DE SUELDOS & BOLETAS DE PAGO
    # =========================================================================
    def ListarPeriodos(self) -> list[dict]:
        return self.repository.ListarPeriodosNomina()

    def CrearPeriodo(self, mes: int, anio: int, fecha_inicio: date, fecha_fin: date) -> dict:
        return self.repository.CrearPeriodoNomina(mes, anio, fecha_inicio, fecha_fin)

    def ObtenerPlanillaPeriodo(self, id_periodo: int) -> dict | None:
        planilla = self.repository.ObtenerPlanillaPorPeriodo(id_periodo)
        if not planilla:
            return None
        detalles = self.repository.ListarDetallesPlanilla(planilla["IdPlanilla"])
        return {
            "Planilla": planilla,
            "Detalles": detalles,
            **planilla
        }

    def GenerarPlanilla(self, id_periodo: int, id_usuario_genera: int) -> dict:
        periodo = self.repository.ObtenerPeriodoPorId(id_periodo)
        if not periodo:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Periodo de nómina no encontrado")

        f_ini = periodo["FechaInicio"]
        f_fin = periodo["FechaFin"]

        # Parametros laborales vigentes
        recargo_he = self.repository.ObtenerValorConfiguracion("RecargoHoraExtraPorcentaje", Decimal("100")) # 100% recargo
        factor_he = Decimal("1.0") + (recargo_he / Decimal("100")) # ej. 2.0
        porcentaje_afp = self.repository.ObtenerValorConfiguracion("PorcentajeAporteAFPGestora", Decimal("12.71")) # 12.71%

        # 1. Obtener o crear cabecera Planilla
        planilla = self.repository.ObtenerPlanillaPorPeriodo(id_periodo)
        if not planilla:
            res_pl = self.repository.CrearPlanillaCabecera(id_periodo, id_usuario_genera)
            id_planilla = res_pl["IdPlanilla"]
        else:
            id_planilla = planilla["IdPlanilla"]
            if planilla["Aprobada"]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La planilla de este periodo ya está aprobada y cerrada")

        # 2. Limpiar detalles previos para recalcular
        self.repository.EliminarDetallesPlanilla(id_planilla)

        # 3. Para cada empleado activo, calcular haberes y deducciones
        empleados = self.repository.ListarEmpleados(activo=True)

        for emp in empleados:
            id_u = emp["IdUsuario"]
            sueldo_basico = Decimal(str(emp.get("SueldoBasico", 2500.00)))

            # Sumar horas extras acumuladas en el mes
            asistencias_emp = self.repository.ListarAsistencias(f_ini, f_fin, id_u)
            total_hrs_extra = sum([Decimal(str(a.get("HorasExtraTrabajadas") or 0)) for a in asistencias_emp])
            total_min_atraso = sum([int(a.get("MinutosAtraso") or 0) for a in asistencias_emp])
            dias_falta = sum([1 for a in asistencias_emp if a.get("EsFalta") and not a.get("FaltaJustificada")])

            # Valor hora legal = Sueldo / 240 hrs
            valor_hora_normal = sueldo_basico / Decimal("240")
            valor_hora_extra = valor_hora_normal * factor_he

            monto_horas_extra = (total_hrs_extra * valor_hora_extra).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            # Descuento atrasos proporcional al valor por hora
            descuento_atrasos = ((Decimal(str(total_min_atraso)) / Decimal("60")) * valor_hora_normal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            # Descuento faltas = días de falta * (Sueldo / 30)
            valor_dia = sueldo_basico / Decimal("30")
            descuento_faltas = (Decimal(str(dias_falta)) * valor_dia).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            # RN-02 / RF-10 / HU-24: Cálculo automático de comisiones de reparto sobre cobros efectivos
            pct_comision = Decimal(str(emp.get("PorcentajeComisionDefault") or 0.0))
            if pct_comision <= Decimal("0.0") and (emp.get("IdRol") == 4 or "repart" in (emp.get("NombreCargo") or "").lower()):
                pct_comision = Decimal("2.0")  # 2% según política de incentivos de Blanquita

            monto_comisiones = Decimal("0.00")
            if pct_comision > Decimal("0.0"):
                total_cobrado_ruta = self.repository.ObtenerTotalCobrosRepartidorPeriodo(id_u, f_ini, f_fin)
                monto_comisiones = (total_cobrado_ruta * (pct_comision / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            total_bonos = Decimal("0.00")

            # HU-19: Descuento automático de anticipos de sueldo registrados en tesorería
            nom_emp = f"{emp.get('PrimerNombre', '')} {emp.get('ApellidoPaterno', '')}".strip()
            total_anticipos = self.repository.ObtenerTotalAnticiposEmpleadoPeriodo(id_u, nom_emp, f_ini, f_fin)
            otras_deducciones = total_anticipos.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            total_ganado = (sueldo_basico + monto_horas_extra + monto_comisiones + total_bonos).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            aporte_afp = (total_ganado * (porcentaje_afp / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            total_descuento = (descuento_atrasos + descuento_faltas + aporte_afp + otras_deducciones).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            liquido_pagable = (total_ganado - total_descuento).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            self.repository.CrearDetallePlanilla({
                "IdPlanilla": id_planilla,
                "IdUsuario": id_u,
                "SueldoBasico": sueldo_basico,
                "MontoHorasExtra": monto_horas_extra,
                "MontoComisiones": monto_comisiones,
                "TotalBonos": total_bonos,
                "DescuentoAtrasos": descuento_atrasos,
                "DescuentoFaltas": descuento_faltas,
                "AporteAFP": aporte_afp,
                "OtrasDeducciones": otras_deducciones,
                "TotalGanado": total_ganado,
                "TotalDescuento": total_descuento,
                "LiquidoPagable": liquido_pagable,
                "Observacion": f"{total_hrs_extra}h extras, {total_min_atraso}m atraso, {dias_falta} faltas"
            })

        # 4. Recalcular totales de la cabecera
        self.repository.RecalcularTotalesPlanilla(id_planilla)
        return self.ObtenerPlanillaPeriodo(id_periodo)

    def EditarDetallePlanilla(self, id_detalle: int, datos: dict) -> dict:
        det = self.repository.ObtenerDetallePlanillaPorId(id_detalle)
        if not det:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Línea de detalle no encontrada")
        if det.get("Aprobada"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se puede modificar una planilla aprobada")

        sueldo_basico = Decimal(str(datos.get("SueldoBasico", det["SueldoBasico"])))
        monto_he = Decimal(str(datos.get("MontoHorasExtra", det["MontoHorasExtra"])))
        monto_com = Decimal(str(datos.get("MontoComisiones", det["MontoComisiones"])))
        bonos = Decimal(str(datos.get("TotalBonos", det["TotalBonos"])))
        desc_atrasos = Decimal(str(datos.get("DescuentoAtrasos", det["DescuentoAtrasos"])))
        desc_faltas = Decimal(str(datos.get("DescuentoFaltas", det["DescuentoFaltas"])))
        afp = Decimal(str(datos.get("AporteAFP", det["AporteAFP"])))
        otras_ded = Decimal(str(datos.get("OtrasDeducciones", det["OtrasDeducciones"])))

        total_ganado = (sueldo_basico + monto_he + monto_com + bonos).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_descuento = (desc_atrasos + desc_faltas + afp + otras_ded).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        liquido = (total_ganado - total_descuento).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        updates = {
            "SueldoBasico": sueldo_basico,
            "MontoHorasExtra": monto_he,
            "MontoComisiones": monto_com,
            "TotalBonos": bonos,
            "DescuentoAtrasos": desc_atrasos,
            "DescuentoFaltas": desc_faltas,
            "AporteAFP": afp,
            "OtrasDeducciones": otras_ded,
            "TotalGanado": total_ganado,
            "TotalDescuento": total_descuento,
            "LiquidoPagable": liquido,
            "Observacion": datos.get("Observacion", det.get("Observacion"))
        }

        res = self.repository.ActualizarDetallePlanilla(id_detalle, updates)
        self.repository.RecalcularTotalesPlanilla(det["IdPlanilla"])
        return res

    def AprobarPlanilla(self, id_planilla: int, id_usuario_aprueba: int, observacion: str = "") -> dict:
        res = self.repository.AprobarPlanilla(id_planilla, id_usuario_aprueba, observacion)
        # HU-12: Generar comprobante de egreso y asiento automático en flujo de caja
        try:
            self.repository.CrearAsientoEgresoPlanilla(id_planilla, id_usuario_aprueba)
        except Exception as e:
            print(f"Advertencia al generar asiento contable de nómina: {e}")
        return res

    def GenerarBoletaPago(self, id_detalle: int) -> dict:
        det = self.repository.ObtenerDetallePlanillaPorId(id_detalle)
        if not det:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Detalle de planilla no encontrado")

        liquido = Decimal(str(det["LiquidoPagable"]))
        literal = numero_a_palabras_bob(liquido)

        return {
            "Empresa": {
                "RazonSocial": "EMPRESA DE PAPEL BLANQUITA (SHEMA ASOCIADOS S.R.L.)",
                "Nit": "1028495024",
                "Direccion": "Calle Regimiento Charcas (16 de Infantería) N° 37",
                "Ciudad": "Sucre - Bolivia",
                "Telefono": "(4) 64-51234 / 71234567"
            },
            "Periodo": {
                "IdPeriodoNomina": det["IdPeriodoNomina"],
                "NombrePeriodo": det["NombrePeriodo"],
                "Mes": det["Mes"],
                "Anio": det["Anio"],
                "FechaInicio": det["FechaInicio"],
                "FechaFin": det["FechaFin"]
            },
            "Empleado": {
                "IdUsuario": det["IdUsuario"],
                "NombreEmpleado": det["NombreEmpleado"],
                "Ci": det["Ci"],
                "Cargo": det["Cargo"],
                "Area": det["Area"],
                "FechaIngreso": det["FechaIngreso"],
                "Banco": det["Banco"],
                "CuentaBancaria": det["CuentaBancaria"]
            },
            "Haberes": [
                {"Concepto": "Sueldo Básico Mensual", "Monto": det["SueldoBasico"]},
                {"Concepto": "Horas Extraordinarias (100% Recargo)", "Monto": det["MontoHorasExtra"]},
                {"Concepto": "Comisiones de Reparto / Ventas", "Monto": det["MontoComisiones"]},
                {"Concepto": "Bonos de Producción y Puntualidad", "Monto": det["TotalBonos"]},
            ],
            "Descuentos": [
                {"Concepto": "Aporte Laboral Gestora / AFP (12.71%)", "Monto": det["AporteAFP"]},
                {"Concepto": "Descuento por Minutos de Atraso", "Monto": det["DescuentoAtrasos"]},
                {"Concepto": "Descuento por Faltas Injustificadas", "Monto": det["DescuentoFaltas"]},
                {"Concepto": "Anticipos y Otras Deducciones", "Monto": det["OtrasDeducciones"]},
            ],
            "Totales": {
                "TotalGanado": det["TotalGanado"],
                "TotalDescuento": det["TotalDescuento"],
                "LiquidoPagable": det["LiquidoPagable"],
                "LiquidoPagableLiteral": literal
            },
            "Metadatos": {
                "IdDetallePlanilla": det["IdDetallePlanilla"],
                "IdPlanilla": det["IdPlanilla"],
                "Aprobada": det["Aprobada"],
                "FechaAprobacion": det["FechaAprobacion"],
                "Observacion": det["Observacion"]
            }
        }

    # =========================================================================
    # 7. RESUMEN / KPIS
    # =========================================================================
    def ObtenerResumenKPIs(self) -> dict:
        return self.repository.ObtenerKPIsResumenRRHH()
