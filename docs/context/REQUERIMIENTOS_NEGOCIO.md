# REQUERIMIENTOS COMPLETOS DEL NEGOCIO - PAPELERA BLANQUITA

Este documento constituye la fuente de la verdad funcional y operativa del negocio. Cualquier subagente o desarrollador puede consultar este archivo para entender a cabalidad las necesidades de la empresa sin requerir historial de conversaciones previas.

---

## 1. ACTORES Y ROLES DEL NEGOCIO

| Persona / Actor | Rol en el Negocio | Responsabilidades Clave |
| :--- | :--- | :--- |
| **Don Osvaldo** | Propietario / Gerente General | Máxima autoridad. Revisa paneles ejecutivos simplificados, busca reportes por código numérico de 4 dígitos, aprueba vales de caja chica con su respaldo, firma/sella cheques y supervisa estados financieros consolidados. Controla asistencia con su propio Excel de horas trabajadas. |
| **Kevin** | Encargado General de Contabilidad | Opera la tesorería general, flujo de caja, arqueos, vales de caja chica, cartera de cuentas por cobrar, cuentas por pagar a proveedores y liquidación de planillas salariales. Revisa rendiciones de choferes, ajusta notas de venta y pedidos de distribuidores. |
| **Leslie** | Comercial / Ventas | Define y consulta listas de precios por sucursal y pedidos mayoristas/minoristas. Supervisa promociones y campañas de bandeo. |
| **Carlos y María** | Vendedores / Personal Comercial | Personal de ventas y distribución directa en calle. Sujetos a control de cobros, rendiciones y eventuales descuentos por "No venta" o faltantes de cobranza. |
| **Choferes / Repartidores** | Distribución Móvil | Manejan camiones de reparto en Sucre y Potosí. Reciben carga física diaria, entregan en puntos de venta con nota NV-501, cobran en efectivo o QR con foto obligatoria, obtienen firma digital táctil en celular y rinden turno el mismo día con liquidación de mermas y faltantes. |
| **Distribuidores Externos** | Clientes mayoristas departamentales | Operan en Oruro, Tarija, La Paz y Tupiza. Realizan pedidos exclusivamente sobre stock real de producto terminado, esperan ajuste de Kevin y adjuntan comprobante de depósito bancario. |
| **Fabricio** | Desarrollador de Planta y Producción | Integrante del equipo encargado de los módulos de planta (bobinas, rodelas, empaques, órdenes de producción y producto terminado en fábrica). Su zona es **ESTRICTAMENTE PROTEGIDA**. |

---

## 2. MAPA DE MÓDULOS, SUBAGENTES Y FASES

| Módulo del Negocio | Descripción General | Subagente Responsable | Fase de Ejecución |
| :--- | :--- | :---: | :---: |
| **Módulo 1: Multi-Sucursal e Inventario Comercial** | Sucursales Potosí y Sucre, inventarios independientes por sucursal y camión/chofer, envíos fábrica-sucursal, precios con fecha de vigencia, revalorización automática de choferes, roles y servicios transversales. | **Agente Principal** | **Fase 1** |
| **Módulo 3: Control Diario de Repartidores** | Cierre de turno diario, comparación stock físico vs sistema, mermas y faltantes imputables al chofer el mismo día, eliminación de talonarios de papel. | **Subagente A** | **Fase 2** |
| **Módulo 7: Notas de Venta y Despacho** | Notas NV-501 con datos de camión y chofer, cálculo automático de precios, pagos mixtos (efectivo/QR/saldo), motor de promociones de bandeo (1 megarrollo = 1 servilleta), firma digital en celular y botón Editar para Kevin con notificación al chofer. | **Subagente A** | **Fase 2** |
| **Módulo 4: Cuentas por Cobrar y Cobros QR** | Todo registro de chofer nace `Pendiente de aprobación`, foto de comprobante QR obligatoria (drag & drop desde WhatsApp), abonos manuales y por Excel, alertas de mora para clientes con crédito. | **Subagente B** | **Fase 2** |
| **Módulo 8: Distribuidores Externos** | Portal de distribuidores de Oruro, Tarija, La Paz y Tupiza, pedido restringido a stock real de planta (solo lectura), ajuste de cantidades por Kevin y comprobante de depósito. | **Subagente C** | **Fase 2** |
| **Módulo 2: Personal, Planillas y Finiquitos** | Pestañas Asegurado y Externo, Planilla Oficial (Ministerio/Gestora) y Planilla Interna (horas extra, faltas, adelantos, "No venta" compartido), papeleta de pago en 2 copias, finiquito exacto por fechas y lector de Excel de asistencia de Don Osvaldo (columna AJ). | **Subagente D** | **Fase 3** |
| **Módulo 5: Caja Chica** | Solicitud exclusiva para Kevin, ciclo desacoplado: flujo operativo `Pendiente -> Entregado -> Rendido`, con comprobante y cálculo automático de vuelto/reintegro; aprobación gerencial de Don Osvaldo viendo solo el gasto final rendido con respaldo; bloqueo de impresión hasta aprobación. | **Subagente E** | **Fase 3** |
| **Módulo 6: Panel Gerencial Don Osvaldo** | Panel simplificado de alta velocidad, buscador global por código numérico de 4 dígitos (ej. 2208) y firma/sello digital de cheques y autorizaciones. | **Subagente F** | **Fase 4** |
| **Módulo 9: Bancos y Saldos Financieros** | Registro referencial de los 3 bancos (MSC, Unión, BNB) y reporte financiero con saldos de materia prima y producto terminado (vía capa de solo lectura de planta). | **Subagente F** | **Fase 4** |
| **Cierre y Limpieza** | Depuración de datos de prueba en módulos de Kevin y consolidación final. | **Agente Principal** | **Fase 5** |

---

## 3. TEXTO OFICIAL: REQUERIMIENTOS COMPLETOS DEL NEGOCIO

*(Copia textual y exhaustiva del bloque de especificaciones)*

- **Prioridad 1 (Sucursales e Inventario Potosí):** Entidad Sucursal (nombre, ciudad, activo/inactivo) ligada a rutas, zonas, usuarios, choferes, inventario y precios. Cargar Sucre y Potosí dinámicamente (no hardcodear; N sucursales, N camiones, N vendedores). Filtros por sucursal. Inventario independiente por sucursal y por chofer (sin límite, con precio vigente). Envíos fábrica -> sucursal -> chofer -> descuento por venta/entrega y bandeo (servilleta de regalo). Carga por pantalla o Excel. Precios por sucursal con fecha "vigente a partir de", revalorización automática del stock de choferes al cambiar precio, historial de cambios, resaltado en rojo (24h) y notificación al admin. Reporte actual valorizado e histórico a fecha pasada (ej. 31 oct). Roles de contabilidad (Encargado de Contabilidad y Contador de sucursal) y limpieza de datos de prueba en módulos de Kevin. Este inventario es el **comercial/de distribución** y es independiente del inventario de planta.
- **Módulo 2 (Personal y Planillas):** Pestañas Asegurado y Externo. Campos: ingreso, retiro, contrato, asegurado, área, sucursal. Planilla Excel/PDF (versión Ministerio/Caja solo con descuentos de ley de Gestora configurable, y versión General interna con horas extra de fábrica, faltas, permisos, adelantos, faltantes de cobro y descuentos por "No venta" compartidos entre vendedores). Papeleta de pago con 2 copias. Finiquito habilitado a los >=3 meses con cálculo exacto por fechas y formato Ministerio. Importador del Excel de asistencia de don Osvaldo leyendo columna AJ ("horas trabajadas" y negativos como faltas).
- **Módulo 3 y 7 (Repartidores y Notas de Venta):** Cierre de turno diario comparando stock físico vs sistema (merma/faltante el mismo día). Notas de venta desde despacho (NV-501) con datos de transporte, precios automáticos, pagos parciales (efectivo/QR/abono), promociones automáticas (1 megarrollo = 1 servilleta) o manuales, firma digital en celular obligatoria para cerrar envío, y botón Editar para Kevin con ajuste y notificación al chofer. La nota de despacho proviene de un módulo de planta (zona protegida): se consume en solo lectura o se ofrece carga manual, y se anota como integración pendiente.
- **Módulo 4 (Cuentas por cobrar y QR):** Todo registro de chofer nace "Pendiente" hasta aprobación de Kevin/encargado de sucursal. Foto de comprobante QR obligatoria (drag & drop desde WhatsApp). Eliminación automática de fotos a los 2-3 meses manteniendo el registro. Abonos manuales/Excel y alerta de mora.
- **Módulo 5 (Caja chica):** Solo Kevin solicita. Flujo: Pendiente -> Aprobado (don Osvaldo) -> Entregado -> Rendido (con comprobante y cálculo de cambio/vuelto). Impresión bloqueada hasta aprobación. Fotos se borran a los 2 meses.
- **Módulo 6, 8 y 9 (Gerencia, Distribuidores y Bancos):** Panel simplificado para don Osvaldo con buscador de reportes por código numérico (ej. 2208) y firma/sello. Rol Distribuidor externo (Oruro, Tarija, La Paz, Tupiza) que solo pide sobre stock real (lectura de planta), Kevin edita cantidades y el distribuidor sube comprobante. Reporte de materia prima/producto terminado (solo lectura) y 3 bancos referenciales (MSC, Unión, BNB).

---

## 4. ANEXO TEXTUAL DE LA ENTREVISTA

### 1. Fórmulas y ejemplos de la entrevista
- **Valor hora:** `sueldo / 30 / 8`. Ejemplo: `3300 / 30 / 8 = 13.75`; 1,5 horas a favor ≈ 20 Bs.
- **Días faltados (trabajo normal):** negativos en el Excel de asistencia son días faltados. Ejemplo: 7 faltas → `30 − 7 = 23` días pagables; pago = `sueldo/30 × 23` + horas a favor.
- **Personal por horas:** columna AJ = "horas trabajadas" (sin distinguir mayúsculas/acentos) → `pago = horas × valor_hora`. Ejemplo: 163 horas con mínimo 3.300.
- **Planilla:** dos cifras. **Oficial** (Ministerio/Gestora): total ganado menos descuentos de ley. **Interna**: más horas extra (solo fábrica) menos faltas, permisos, adelantos, faltantes de cobro y "No venta". Ejemplo: base 2.880 + extras 460,63 − descuento de 1 día → total interno 3.231,20.
- **"No venta":** ejemplo de 1.185 Bs de una cliente que desapareció + faltante de ventas 66 Bs (33 Bs a cada uno de dos vendedores); a una vendedora además 5 horas de permiso y adelanto de 1.200; total descontado 2.489 en octubre.
- **Finiquito:** corresponde con 3 meses o más. Antigüedad por diferencia de fechas exacta: ingreso 18/11/2025, retiro 30/10/2026 → **0 años, 11 meses, 12 días**. Base: últimos 3 salarios (ej. 3.400 cada uno). Fórmula (a confirmar): `promedio_3m / 12 × meses + promedio_3m / 12 / 30 × días`.
- **Revalorización:** el inventario restante de choferes se valoriza al nuevo precio desde "vigente a partir de"; lo ya vendido conserva su precio. Ejemplo de ajuste: inventario de 4.000 Bs más ajuste de +48 = 4.048.
- **Nota de venta:** cantidad × precio vigente (ej. 4 megarrollos × 40 = 160). Promo: 1 megarrollo = 1 servilleta de bandeo.
- **Caja chica:** se entregan 700, se gastan 600, reintegran 100; caja refleja egreso de 600; don Osvaldo solo ve el monto final y el comprobante.
- **Edición de nota por Kevin:** "registró 200, recibido 190" → ajuste −10 con notificación al chofer.
- **Hábitos de pago de choferes:** pagan por partes (ej. venta del día 14.095, pagan 7.600 + 2.700 y el resto queda en saldo).

### 2. Contexto del negocio para el glosario
Empresa productora de papel higiénico y servilletas (marca Blanquita; razón social Seoma Asociados), Sucre y sucursal Potosí. Productos: Megarrollo, servilletas, Ecopack (jaba de 6), papel higiénico. Precio unitario único por producto y sucursal. Bancos: MSC (repartidores), Unión (distribuidores, Alcaldía, supermercados) y BNB; referencial, la API bancaria cobra mensualidad (no se implementa). Hoy todo se compra y vende al contado salvo supermercados (a 30 días, una cuota). Contabilidad actual en el sistema "Contagen" (asientos/libro mayor quedan fuera de alcance por ahora).

### 3. Fuera de alcance por ahora
API bancaria; asientos contables y libro mayor (se pedirán capturas de Contagen); firma digital con USB/sello electrónico; modificar cualquier módulo de planta.

### 4. Supuestos a precargar en `SUPUESTOS_Y_DUDAS.md` (todos como parámetros configurables)
1. Fórmula exacta del finiquito y base (sueldo de planilla vs. salario mínimo).
2. Si se mantiene el concepto de antigüedad (default: no).
3. Porcentaje de descuento de la Gestora (default 0, exigir carga).
4. Valor del bandeo para valorización (default 0).
5. Si Leslie necesita precios mayorista/minorista (por ahora solo unitario por sucursal).
6. Cómo firma y sella don Osvaldo (por ahora: aprobación + adjunto del documento firmado).
7. Si la apertura de caja del día es útil (oculta por defecto).
8. Retención de comprobantes (default 60 días) y tamaño máximo (5 MB).
9. Si se exige firma/foto para cerrar todos los envíos o solo los de otro departamento.
10. Nombres de los 3 bancos y datos de usuarios de Potosí y distribuidores.
11. Integración con planta para descontar stock de producto terminado (pendiente con el otro integrante).
12. **Contradicción a resolver en caja chica:** el flujo declarado es Pendiente → Aprobado (don Osvaldo) → Entregado → Rendido, pero en la entrevista don Osvaldo aprueba mirando el gasto ya rendido con su respaldo y solo ve lo rendido. Diseña **estados operativos** (`PENDIENTE`, `ENTREGADO`, `RENDIDO`) más un campo independiente `aprobacion_gerencia` (`PENDIENTE`/`APROBADO`/`RECHAZADO`), y haz configurable en qué momento se solicita la aprobación. Impresión bloqueada hasta que `aprobacion_gerencia = APROBADO`.
13. Archivos que Kevin debe enviar (no inventarlos; usar formatos provisionales marcados "FORMATO PROVISIONAL"): formatos de planilla, papeleta y finiquito (Ministerio de Trabajo), Excel de asistencia, reporte de gastos/caja chica, documentos de envíos de Potosí, logo, capturas de Contagen.
