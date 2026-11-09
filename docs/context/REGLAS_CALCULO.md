# REGLAS DE CÁLCULO Y FÓRMULAS MATEMÁTICAS - SISTEMA BLANQUITA

Este documento define con precisión matemática, tipos de datos y ejemplos numéricos reales todas las reglas de cálculo del sistema. Es la base técnica vinculante para la implementación de servicios y tests unitarios.

---

## 1. VALOR HORA LABORAL

- **Fórmula:**
  $$\text{Valor Hora} = \frac{\text{Sueldo Básico Mensual}}{30 \times 8} = \frac{\text{Sueldo Básico Mensual}}{240}$$
- **Tipo de Dato:** `Decimal(10, 4)` en memoria; resultado monetario redondeado a `Decimal(10, 2)` con redondeo bancario/half-up.
- **Ejemplo Numérico Real:**
  - Sueldo Básico: $3.300,00\text{ Bs.}$
  - Cálculo: $\frac{3300}{240} = 13,75\text{ Bs/hora}$.
  - Para $1,5\text{ horas}$ a favor: $1,5 \times 13,75 = 20,625\text{ Bs} \approx 20,63\text{ Bs}$ (en la entrevista redondean a aprox. $20\text{ Bs}$).

---

## 2. DÍAS FALTADOS (TRABAJO NORMAL MENSUAL)

- **Fórmula:**
  $$\text{Días Computables a Pago} = 30 - \text{Total Días Faltados}$$
  $$\text{Pago Base} = \left(\frac{\text{Sueldo Básico}}{30}\right) \times \text{Días Computables} + \text{Horas a Favor}$$
- **Detección en Excel de Asistencia:** Los números negativos en el registro mensual representan días faltados.
- **Ejemplo Numérico Real:**
  - Sueldo Básico: $3.000,00\text{ Bs.}$
  - Días Faltados: $7\text{ días}$.
  - Días Pagables: $30 - 7 = 23\text{ días}$.
  - Pago Proporcional: $\frac{3000}{30} \times 23 = 100 \times 23 = 2.300,00\text{ Bs.}$

---

## 3. PERSONAL LIQUIDADO POR HORAS (COLUMNA AJ)

- **Regla:** En el Excel de asistencia de Don Osvaldo, la columna `AJ` contiene el consolidado de "horas trabajadas" (independiente de mayúsculas o tildes).
- **Fórmula:**
  $$\text{Monto Ganado} = \text{Horas Trabajadas (Columna AJ)} \times \text{Valor Hora}$$
- **Ejemplo Numérico Real:**
  - Empleado con mínimo referencial de $3.300,00\text{ Bs.}$ (Valor hora: $13,75\text{ Bs}$).
  - Total horas registradas en columna AJ: $163\text{ horas}$.
  - Pago Bruto: $163 \times 13,75 = 2.241,25\text{ Bs.}$

---

## 4. SISTEMA DUAL DE PLANILLAS: OFICIAL VS. INTERNA

### 4.1 Planilla Oficial (Ministerio de Trabajo / Gestora Pública)
- **Objetivo:** Cumplimiento tributario y laboral formal ante autoridades.
- **Fórmula:**
  $$\text{Líquido Pagable Oficial} = \text{Total Ganado Base} - \text{Descuentos de Ley Gestora Pública}$$
- **Aporte Laboral Gestora:** Porcentaje configurable en `ConfiguracionLaboral` (por defecto $12,71\%$, configurable).

### 4.2 Planilla Interna (Real de Planta y Operaciones)
- **Objetivo:** Pago efectivo real al trabajador considerando bonos de fábrica y penalizaciones comerciales.
- **Fórmula:**
  $$\text{Líquido Interno} = \text{Sueldo Base} + \text{Horas Extra Fábrica} - \text{Descuentos Faltas} - \text{Permisos} - \text{Adelantos} - \text{Faltantes Cobro} - \text{Descuento No Venta}$$
- **Ejemplo Numérico Real:**
  - Sueldo base: $2.880,00\text{ Bs.}$
  - Horas extra autorizadas de fábrica: $+460,63\text{ Bs.}$
  - Descuento por 1 día de falta: $-96,00\text{ Bs.}$ ($\frac{2880}{30}$)
  - Total Planilla Interna: $2.880 + 460,63 - 96,00 = 3.244,63\text{ Bs.}$ (o $3.231,20\text{ Bs.}$ según adelantos específicos aplicados).

---

## 5. DESCUENTO COMPARTIDO POR "NO VENTA" Y FALTANTES DE COBRANZA

- **Regla:** Cuando un cliente desaparece con deuda o existe un faltante en la liquidación de ruta compartido por un equipo de vendedores, el monto se divide en partes iguales entre los responsables asignados.
- **Fórmula de Prorrateo:**
  $$\text{Descuento Individual} = \frac{\text{Monto Deuda No Venta}}{\text{Nº Vendedores Responsables}}$$
- **Ejemplo Numérico Real (Caso Octubre):**
  - Cliente no habido deja deuda de: $1.185,00\text{ Bs.}$
  - Faltante en liquidación de camión: $66,00\text{ Bs.}$
  - Vendedores asignados (2): Carlos y María.
  - Imputación a cada vendedor:
    - Faltante: $\frac{66}{2} = 33,00\text{ Bs}$ a cada uno.
    - No Venta: $\frac{1185}{2} = 592,50\text{ Bs}$ a cada uno.
  - Liquidación particular de María:
    - 5 horas de permiso sin goce: $5 \times 13,75 = 68,75\text{ Bs}$.
    - Adelanto de sueldo del mes: $1.200,00\text{ Bs}$.
    - Cuota No Venta + Faltante: $592,50 + 33,00 = 625,50\text{ Bs}$.
    - Total descuentos acumulados en el mes: $2.489,00\text{ Bs.}$ (incluyendo retenciones adicionales).

---

## 6. CÁLCULO EXACTO DE FINIQUITO LABORAL

- **Elegibilidad:** Antigüedad continua igual o mayor a 3 meses ($\ge 90\text{ días}$). Si tiene menos de 3 meses, el sistema deshabilita el finiquito legal.
- **Cálculo de Antigüedad por Fechas Calendario:**
  - Se debe utilizar la diferencia exacta entre `FechaRetiro` y `FechaIngreso`.
  - **Ejemplo Real:**
    - Fecha de Ingreso: $18/11/2025$
    - Fecha de Retiro: $30/10/2026$
    - Diferencia exacta: **0 años, 11 meses y 12 días**.
- **Salario Base Indemnizable:** Promedio de los últimos 3 sueldos percibidos ($S_1, S_2, S_3$):
  $$\text{Sueldo Promedio} = \frac{S_1 + S_2 + S_3}{3}$$
- **Fórmula de Indemnización Legal:**
  $$\text{Monto Indemnización} = (\text{Sueldo Promedio} \times \text{Años}) + \left(\frac{\text{Sueldo Promedio}}{12} \times \text{Meses}\right) + \left(\frac{\text{Sueldo Promedio}}{12 \times 30} \times \text{Días}\right)$$
- **Ejemplo Numérico:**
  - Sueldos últimos 3 meses: $3.400,00\text{ Bs.}$, $3.400,00\text{ Bs.}$, $3.400,00\text{ Bs.}$ $\rightarrow$ Promedio: $3.400,00\text{ Bs.}$
  - Tiempo: 0 años, 11 meses, 12 días.
  - Fracción meses: $\frac{3400}{12} \times 11 = 283,333 \times 11 = 3.116,67\text{ Bs.}$
  - Fracción días: $\frac{3400}{360} \times 12 = 9,444 \times 12 = 113,33\text{ Bs.}$
  - Total Indemnización: $3.116,67 + 113,33 = 3.230,00\text{ Bs.}$ (+ aguinaldo y duodécimas aplicables).

---

## 7. REVALORIZACIÓN AUTOMÁTICA DE INVENTARIO DE CHOFERES

- **Regla:** Al emitirse una actualización de precio para una sucursal con `FechaVigenciaDesde`, todo el stock remanente que los choferes tienen actualmente cargado en sus camiones se revaloriza automáticamente al nuevo precio. Las notas ya emitidas y vendidas antes de esa fecha conservan su precio histórico original.
- **Fórmula de Ajuste:**
  $$\Delta \text{Valor} = \sum_{p \in \text{Productos}} \text{Stock Remanente Chofer}_p \times (\text{Precio Nuevo}_p - \text{Precio Anterior}_p)$$
  $$\text{Inventario Valorizado Nuevo} = \text{Inventario Valorizado Anterior} + \Delta \text{Valor}$$
- **Ejemplo Numérico Real:**
  - Chofer tiene inventario remanente valorizado en $4.000,00\text{ Bs.}$
  - Sube el precio del Megarrollo en $+2\text{ Bs.}$ y el chofer tiene 24 unidades en el camión.
  - Ajuste calculado: $24 \times (+2) = +48,00\text{ Bs.}$
  - Nuevo valor de cargo al chofer: $4.000 + 48 = 4.048,00\text{ Bs.}$

---

## 8. NOTAS DE VENTA Y PROMOCIÓN DE BANDEO

- **Cálculo de Ítem:**
  $$\text{Subtotal} = \text{Cantidad} \times \text{Precio Unitario Vigente Sucursal}$$
- **Regla de Bandeo Automático (Servilleta de Regalo):**
  - Si el producto vendido es Megarrollo con bandera `EsBandeo = TRUE`:
    $$\text{Cantidad Servilletas Bonificadas} = \text{Cantidad Megarrollos} \times 1$$
  - Las servilletas salen del inventario comercial con precio de venta $0,00\text{ Bs.}$ (bonificación $100\%$).
- **Ejemplo Numérico:**
  - Venta: 4 Megarrollos a $40,00\text{ Bs.}$ cada uno $\rightarrow$ Total: $160,00\text{ Bs.}$
  - Bonificación automática: 4 paquetes de servilleta de bandeo entregados sin costo.

---

## 9. CAJA CHICA: ENTREGAS, GASTO REAL Y REINTEGRO

- **Fórmula de Liquidación de Vales:**
  $$\text{Saldo Reintegro (Vuelto a devolver)} = \text{Monto Entregado} - \text{Monto Gasto Real Rendido}$$
  $$\text{Egreso Neto Efectivo en Caja} = \text{Monto Gasto Real Rendido}$$
- **Ejemplo Numérico Real:**
  - Kevin solicita y se le entregan fondos por: $700,00\text{ Bs.}$
  - Realiza compras y presenta comprobantes por: $600,00\text{ Bs.}$
  - Reintegro devuelto a caja: $700 - 600 = 100,00\text{ Bs.}$
  - Impacto final en el arqueo de caja chica: Egreso de $600,00\text{ Bs.}$
  - Don Osvaldo en su panel aprueba únicamente los $600,00\text{ Bs.}$ con su respaldo adjunto.

---

## 10. EDICIÓN Y AJUSTE DE NOTAS POR CONTABILIDAD (KEVIN)

- **Regla:** Si un chofer reporta un monto y al conciliar físicamente el dinero o la mercadería Kevin detecta discrepancia:
- **Fórmula de Ajuste:**
  $$\Delta \text{Ajuste} = \text{Monto Físico Recibido} - \text{Monto Declarado por Chofer}$$
- **Ejemplo Numérico Real:**
  - Chofer registró en móvil: $200,00\text{ Bs.}$
  - Kevin verifica en sobre de dinero: $190,00\text{ Bs.}$
  - Ajuste: $190 - 200 = -10,00\text{ Bs.}$
  - El sistema actualiza la nota a $190,00\text{ Bs.}$, genera notificación de alerta al chofer con el motivo y registra el evento en `AuditLog`.

---

## 11. HÁBITOS DE PAGO PARCIAL DE CHOFERES

- **Regla:** Los choferes no siempre pagan el total de la venta del día en una sola exhibición; pagan en cuotas durante la jornada.
- **Fórmula:**
  $$\text{Saldo Pendiente Chofer} = \text{Venta Total del Día} - \sum \text{Entregas Efectivo} - \sum \text{Comprobantes QR Aprobados}$$
- **Ejemplo Numérico Real:**
  - Venta total del camión en el día: $14.095,00\text{ Bs.}$
  - Primer abono a mediodía: $7.600,00\text{ Bs.}$
  - Segundo abono al final de la tarde: $2.700,00\text{ Bs.}$
  - Saldo en poder del chofer a liquidar en cierre de turno: $14.095 - 7.600 - 2.700 = 3.795,00\text{ Bs.}$
