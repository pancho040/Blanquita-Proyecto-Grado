# BRIEF TÉCNICO: SUBAGENTE D
*Fase de Ejecución: Fase 3 (En Paralelo)*
*Módulos Asignados: Módulo 2 (Personal, Planillas Duales, Biométrico y Finiquitos)*

---

## 1. MISIÓN DEL SUBAGENTE (3 Líneas)
Implementar el módulo integral de Personal y Recursos Humanos: diferenciación estricta entre personal Asegurado y Externo, sistema dual de planillas (Oficial para Ministerio/Gestora e Interna de Planta con bonos/descuentos), importador del Excel de asistencia de Don Osvaldo (columna AJ), papeletas de pago en 2 copias, deducción compartida de "No venta" y cálculo exacto de finiquito por fechas calendario.

---

## 2. REQUISITOS DETALLADOS DEL NEGOCIO

### Personal y Clasificación Laboral
- Pestañas separadas en interfaz para personal `Asegurado` (formal, aportes a Caja Nacional y Gestora) y `Externo` (eventual, contratistas y jornaleros).
- Registro de datos laborales: fecha de ingreso, fecha de retiro, tipo de contrato, cargo, área y asignación de sucursal.

### Sistema Dual de Planillas
- **Planilla Oficial (Ministerio de Trabajo / Gestora):** Refleja exclusivamente el total ganado base menos los descuentos de ley de la Gestora Pública (porcentaje parametrizable en `ConfiguracionLaboral`, por defecto $12.71\%$). Formato exportable a Excel según plantilla del Ministerio.
- **Planilla Interna (Real de Operaciones):** Computa el sueldo base + horas extra autorizadas de fábrica - días faltados (números negativos en asistencia) - permisos sin goce - adelantos quincenales - faltantes de cobranza - cuota de "No venta" compartida.

### Importador de Asistencia de Don Osvaldo
- Parser inteligente del archivo Excel de asistencia mensual utilizado por Don Osvaldo:
  - Lee la **columna `AJ`** que contiene las "horas trabajadas" mensuales (sin importar mayúsculas, minúsculas o tildes).
  - Trata los valores numéricos negativos como días enteros de falta.
  - Multiplica horas trabajadas por el valor hora calculado (`sueldo / 30 / 8`).

### Deducción Compartida por "No Venta"
- Permite registrar un evento de deuda por cliente desaparecido o faltante de ruta mayor imputable a un equipo de vendedores, dividiendo el importe en partes iguales entre los responsables y deduciéndolo en la planilla del mes correspondiente.

### Papeleta de Pago Formal
- Generación de boleta de pago individual estructurada para imprimirse en formato formal de **2 copias idénticas por hoja** (una copia para la empresa firmada por el trabajador y otra copia para el empleado).

### Módulo de Finiquitos por Diferencia Exacta de Fechas
- Habilitado únicamente para trabajadores con antigüedad continua $\ge 3\text{ meses}$ ($\ge 90\text{ días}$).
- Cálculo de antigüedad por diferencia exacta de fechas calendario: años, meses y días (ej. ingreso 18/11/2025 y retiro 30/10/2026 -> 0 años, 11 meses y 12 días).
- Salario base indemnizable calculado sobre el promedio de los últimos 3 sueldos percibidos. Emisión en formato oficial del Ministerio de Trabajo.

---

## 3. PROPIEDAD DE TABLAS Y ARCHIVOS

### Tablas que Posee (Puede crear y modificar):
- `public.DatosLaboralesEmpleado` (extensión: `EsAsegurado`, `IdSucursal`)
- `public.PeriodoNomina`
- `public.Planilla` (extensión: `TipoPlanilla` ['OFICIAL', 'INTERNA'])
- `public.DetallePlanilla` (extensión: `DescuentoNoVenta`, `HorasTrabajadasAJ`, `ValorHora`)
- `public.AsistenciaDiaria`
- `public.ConfiguracionLaboral` (extensión: `PorcentajeGestora`, `MetodoBaseFiniquito`)
- `public.Finiquito` (nueva tabla de liquidaciones: `IdFiniquito`, `IdEmpleado`, `FechaIngreso`, `FechaRetiro`, `Anios`, `Meses`, `Dias`, `SueldoPromedio`, `MontoIndemnizacion`, `AguinaldoDuodecimas`, `MontoTotal`)

### Tablas que Solo Puede Leer o Consumir:
- `public.Usuario`: para vincular la ficha personal y credenciales de acceso.
- `public.Sucursal`: para filtrar empleados por sucursal.

---

## 4. SERVICIOS TRANSVERSALES A REUTILIZAR
- **Motor de Reportes (PDF / Excel):** Generación de papeletas de pago (2 copias en hoja carta/oficio con `@media print`) y exportación de planillas oficiales en CSV/Excel.
- **Servicio `AuditLogService`:** Trazabilidad de creación y aprobación de planillas y cálculo de finiquitos.

---

## 5. ZONA PROTEGIDA Y PUNTOS DE INTEGRACIÓN CON PLANTA
- **Prohibido:** Tocar tablas de fabricación de planta.
- **Integración:** Ninguna directa con planta; las horas extra de fábrica se ingresan mediante el importador de asistencia o registro manual de supervisores.

---

## 6. DEPENDENCIAS PREVIAS
- Fase 1 completada (`Sucursal`, `Usuario` extendido, `ReportEngineService`).

---

## 7. PUNTOS DE CHOQUE Y REGLAS DE RESOLUCIÓN
- **Choque con Subagente A y B:** Descuentos en planilla por faltantes de cobranza o "No Venta".
- **Regla:** Los subagentes A y B generan los registros de faltantes o deudas en sus módulos; el Subagente D consume esos saldos consolidados mediante consulta de solo lectura al momento de armar la planilla mensual.

---

## 8. ENTREGABLES Y TESTS OBLIGATORIOS
- [ ] Endpoints para CRUD de empleados diferenciando Asegurados y Externos.
- [ ] Importador de Excel de asistencia de Don Osvaldo (lectura de columna AJ y negativos).
- [ ] Procesador dual de planillas: Oficial (Ministerio/Gestora) e Interna (bonos/descuentos).
- [ ] Generador de Papeletas de Pago imprimibles (2 copias por hoja).
- [ ] Módulo y calculadora de Finiquito por diferencia exacta de fechas calendario.
- [ ] **Tests:**
  - `TC-RRHH-01`: Valor hora (`sueldo / 30 / 8 = 13.75`) y cálculo de horas a favor.
  - `TC-RRHH-02`: Descuento de 7 días faltados sobre sueldo base de 3.000 Bs da 2.300 Bs.
  - `TC-RRHH-03`: Descuento de 1.185 Bs de No Venta dividido entre 2 vendedores (592.50 Bs cada uno).
  - `TC-RRHH-04`: Finiquito con ingreso 18/11/2025 y retiro 30/10/2026 arroja 0 años, 11 meses y 12 días con indemnización exacta de 3.230 Bs.

---

## 9. PROTOCOLO DE CIERRE
1. Marcar los checkboxes de la sección Subagente D en `ROADMAP.md`.
2. Actualizar `docs/context/DB_ESQUEMA.md`.
3. Registrar entrada en `docs/progress/LOG.md`.
4. Si la tarea queda en progreso, generar reporte en `docs/progress/HANDOFF_TEMPLATE.md`.
