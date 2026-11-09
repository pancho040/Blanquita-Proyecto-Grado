# CASOS DE PRUEBA Y CRITERIOS DE ACEPTACIÓN FORMAL - SISTEMA BLANQUITA

Este documento establece los casos de prueba de aceptación formal estructurados bajo el estándar Gherkin (Dado / Cuando / Entonces). Contiene los criterios obligatorios de la Fase 1 y las pruebas numéricas exactas derivadas de la entrevista con el cliente.

---

## 1. CRITERIOS DE ACEPTACIÓN OBLIGATORIOS DE LA FASE 1

### TC-F1-01: Creación Dinámica de una Tercera Sucursal sin Tocar Código
- **Dado** que el sistema cuenta con las sucursales de Sucre (`IdSucursal=1`) y Potosí (`IdSucursal=2`).
- **Cuando** un Administrador registra a través de la interfaz o API una nueva sucursal "Tupiza" (`Ciudad = 'Tupiza'`) y da de alta 2 choferes asignados a dicha sucursal.
- **Entonces** la sucursal y los choferes quedan plenamente operativos en base de datos.
- **Y** los choferes de Tupiza pueden iniciar sesión, recibir inventario móvil y registrar rutas sin requerir cambios de código fuente ni reinicio de servicios.

### TC-F1-02: Independencia de Listas de Precios entre Sucursales
- **Dado** que el producto "Megarrollo Blanquita" tiene un precio de $40,00\text{ Bs.}$ tanto en Sucre como en Potosí.
- **Cuando** el encargado de ventas actualiza el precio del Megarrollo en Potosí a $42,00\text{ Bs.}$ con fecha de vigencia inmediata.
- **Entonces** las notas de venta y cotizaciones en Potosí toman el nuevo valor de $42,00\text{ Bs.}$.
- **Y** el precio en Sucre se mantiene inalterado en $40,00\text{ Bs.}$.

### TC-F1-03: Revalorización Automática de Inventario de Choferes por Cambio de Tarifa
- **Dado** que un chofer de Potosí tiene en su camión un saldo remanente de 24 Megarrollos cargados a $40,00\text{ Bs.}$ (Valor inicial: $960,00\text{ Bs.}$).
- **Cuando** entra en vigencia el nuevo precio de $42,00\text{ Bs.}$ ($+2,00\text{ Bs.}$ por unidad).
- **Entonces** el sistema ejecuta el ajuste automático generando un registro en `RevalorizacionInventarioChofer` por $+48,00\text{ Bs.}$ ($24 \times 2$).
- **Y** el nuevo cargo de inventario del chofer pasa a ser de $1.008,00\text{ Bs.}$.
- **Y** se genera una alerta destacada en rojo (24 horas) en la campana de notificaciones de Gerencia.

### TC-F1-04: Aislamiento Estricto de Datos para Rol Contador de Sucursal
- **Dado** un usuario autenticado con rol `ContadorSucursal` asignado exclusivamente a Potosí (`IdSucursal = 2`).
- **Cuando** intenta consultar los endpoints `/api/cxc/cuentas`, `/api/tesoreria/cajas` o `/api/logistica/choferes`.
- **Entonces** la respuesta contiene únicamente registros pertenecientes a Potosí.
- **Y** si intenta solicitar un registro específico de Sucre (ej. `?id_sucursal=1` o por ID de Sucre), el backend responde con error `403 Forbidden`.

### TC-F1-05: Guardia Automática de Zona Protegida en Verde
- **Dado** el repositorio con código nuevo o migraciones de la Fase 1.
- **Cuando** se ejecuta el script de verificación `docs/scripts/verificar_zona_protegida.py`.
- **Entonces** el script escanea el `git diff` y confirma que ningún archivo de `app/Models/Bobina*`, `app/Repository/Bobina*`, `src/components/PapelBobina`, etc. ha sido modificado.
- **Y** valida que ninguna migración contenga sentencias destructivas contra las 43 tablas de planta, retornando código `0` exitoso.

---

## 2. CASOS DE PRUEBA NUMÉRICOS (MÓDULOS DEL NEGOCIO)

### TC-RRHH-01: Cálculo de Valor Hora y Horas a Favor
- **Dado** un empleado con sueldo básico mensual de $3.300,00\text{ Bs.}$
- **Cuando** el sistema calcula su valor hora laboral para liquidar 1,5 horas a favor.
- **Entonces** el valor hora unitario resulta exactamente en $13,75\text{ Bs.}$ ($\frac{3300}{240}$).
- **Y** el monto bruto liquidable por 1,5 horas resulta en $20,63\text{ Bs.}$ ($1,5 \times 13,75$).

### TC-RRHH-02: Descuento de Faltas en Trabajo Mensual Normal
- **Dado** un trabajador con sueldo básico de $3.000,00\text{ Bs.}$ que acumula 7 días de falta en el mes (detectados con números negativos en el Excel de asistencia).
- **Cuando** se procesa la planilla salarial.
- **Entonces** los días pagables computables son $23\text{ días}$ ($30 - 7$).
- **Y** el haber básico ganado liquidado es de $2.300,00\text{ Bs.}$ ($\frac{3000}{30} \times 23$).

### TC-RRHH-03: Descuento Compartido por "No Venta"
- **Dado** que un cliente desaparece dejando una deuda de $1.185,00\text{ Bs.}$ y se registra un faltante de cobranza de ruta de $66,00\text{ Bs.}$ imputable al equipo de 2 vendedores (Carlos y María).
- **Cuando** se aplica la retención en la planilla del mes de octubre.
- **Entonces** a cada vendedor se le descuenta exactamente $33,00\text{ Bs.}$ por faltante y $592,50\text{ Bs.}$ por No Venta.

### TC-RRHH-04: Cálculo Exacto de Finiquito por Fechas Calendario
- **Dado** un trabajador con fecha de ingreso $18/11/2025$ y fecha de retiro $30/10/2026$, cuyos últimos 3 salarios mensuales fueron $3.400,00\text{ Bs.}$, $3.400,00\text{ Bs.}$ y $3.400,00\text{ Bs.}$ (Promedio: $3.400,00\text{ Bs.}$).
- **Cuando** se genera la liquidación de finiquito.
- **Entonces** el sistema determina una antigüedad exacta de **0 años, 11 meses y 12 días** (antigüedad $\ge 3\text{ meses}$, finiquito habilitado).
- **Y** la indemnización calculada resulta exactamente en $3.230,00\text{ Bs.}$ ($\frac{3400}{12} \times 11 + \frac{3400}{360} \times 12$).

### TC-LOG-01: Venta con Promoción de Bandeo Automático
- **Dado** que el producto "Megarrollo Blanquita" tiene configurado `EsBandeo = TRUE` con `ValorBandeo = 1`.
- **Cuando** un chofer genera una Nota de Venta por 4 Megarrollos a $40,00\text{ Bs.}$ cada uno.
- **Entonces** el total de venta a cobrar al cliente es de $160,00\text{ Bs.}$.
- **Y** el sistema incluye automáticamente una línea bonificada de 4 paquetes de servilleta de bandeo con precio $0,00\text{ Bs.}$.

### TC-LOG-02: Cierre de Turno y Detección de Faltante en Camión
- **Dado** un chofer que partió con 100 Megarrollos, reporta ventas por 80 Megarrollos y al cierre de turno solo devuelve 18 Megarrollos físicos al almacén.
- **Cuando** Kevin procesa el cierre de turno en `RendicionRuta`.
- **Entonces** el sistema detecta una discrepancia de 2 unidades faltantes ($100 - 80 - 18$).
- **Y** registra automáticamente un faltante al chofer de $80,00\text{ Bs.}$ ($2 \times 40$) para descuento inmediato o conciliación.

### TC-TES-01: Caja Chica: Entrega, Rendición con Comprobante y Vuelto
- **Dado** que Kevin solicita un vale de caja chica por $700,00\text{ Bs.}$ para compras menores de fábrica.
- **Cuando** se le entregan los fondos (`Estado = 'ENTREGADO'`) y luego rinde gastos adjuntando comprobante por $600,00\text{ Bs.}$ (`Estado = 'RENDIDO'`).
- **Entonces** el sistema calcula un reintegro/vuelto a devolver a caja de $100,00\text{ Bs.}$ ($700 - 600$).
- **Y** el egreso neto computado para el libro de caja chica es de $600,00\text{ Bs.}$.
- **Y** el vale bloquea su impresión oficial hasta que Don Osvaldo registre `AprobacionGerencia = 'APROBADO'`.

### TC-CXC-01: Exigencia de Foto en Pagos por QR
- **Dado** un chofer que registra un cobro de un cliente bajo la modalidad QR.
- **Cuando** intenta guardar el registro sin adjuntar el archivo de imagen del comprobante.
- **Entonces** el sistema rechaza la transacción con código `422 Unprocessable Entity` y mensaje "La fotografía del comprobante QR es obligatoria".
- **Y** el cobro permanece en estado `PENDIENTE_APROBACION` hasta que Kevin lo valide en su bandeja de cobranzas.
