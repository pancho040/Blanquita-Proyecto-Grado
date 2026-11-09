# BRIEF TÉCNICO: SUBAGENTE A
*Fase de Ejecución: Fase 2 (En Paralelo)*
*Módulos Asignados: Módulo 3 (Repartidores y Cierre Diario) y Módulo 7 (Notas de Venta y Despacho)*

---

## 1. MISIÓN DEL SUBAGENTE (3 Líneas)
Implementar el ciclo operativo completo de distribución móvil: cierre de turno diario con liquidación inmediata de mermas y faltantes, eliminación del talonario de papel, emisión de Notas de Venta formales (NV-501) con cálculo automático de precios por sucursal, motor de promociones de bandeo (servilleta de regalo), captura de firma digital táctil en celular y edición controlada por Kevin con notificación al chofer.

---

## 2. REQUISITOS DETALLADOS DEL NEGOCIO

### Control Diario de Repartidores (Módulo 3)
- Conciliación de turno diario al final de cada jornada comparando el stock físico retornado al almacén versus el stock cargado inicialmente menos las notas de venta emitidas.
- Registro inmediato de mermas y faltantes imputables al chofer el mismo día, evitando arrastrar saldos no justificados.
- Eliminación de talonarios manuales físicos reemplazándolos por comprobantes electrónicos.

### Notas de Venta y Despacho (Módulo 7)
- Emisión de notas de venta formales numeradas (ej. NV-501) con datos del camión (placa), chofer, cliente, destino y precios automáticos según la sucursal del chofer.
- Soporte para pagos mixtos en el punto de entrega: efectivo, QR bancario y saldo a crédito (cuenta por cobrar).
- Motor de promociones automáticas: por la venta de 1 Megarrollo se asigna automáticamente 1 paquete de servilleta de bandeo con precio $0,00\text{ Bs.}$, descontándolo del inventario comercial del camión.
- Captura de **Firma Digital Táctil obligatoria** en el teléfono móvil del chofer mediante el componente reutilizable `FirmaDigital`.
- Botón "Editar" exclusivo para Kevin en Contabilidad: permite ajustar montos en caso de discrepancias físicas (ej. "chofer registró 200, recibido 190" -> ajuste de -10 Bs con notificación automática al chofer y auditoría).

---

## 3. PROPIEDAD DE TABLAS Y ARCHIVOS

### Tablas que Posee (Puede crear y modificar):
- `public.NotaVenta` (extensión de columnas: `NroNotaVenta`, `FirmaDigitalUrl`, `ObservacionAjuste`, `EditadoPorKevin`)
- `public.DetalleNotaVenta` (vinculado a `presentacion_id` / `IdPresentacion`; extensión: `EsBonificacionBandeo`)
- `public.RendicionRuta` (extensión: `MontoFaltante`, `CantidadMerma`, `ObservacionesCierre`, `EstadoConciliacion`)
- `public.AsignacionRuta` (gestión de estados `EN_RUTA`, `COMPLETADA`)

### Tablas que Solo Puede Leer o Consumir:
- `public.sucursales` (Fase 1): para asociar la nota de venta a la sucursal del chofer.
- `public.PrecioProducto` (Fase 1): para obtener el precio vigente de la sucursal por presentación.
- `public.inventario_chofer` (Fase 1): stock cargado al camión indexado por `presentacion_id`.
- `public.ProductoConfigComercial` (Fase 1): para validar la regla de bandeo de servilletas.
- `public.Cliente` y `public.PuntoVenta`: para datos del receptor.

---

## 4. SERVICIOS TRANSVERSALES A REUTILIZAR
- **Componente `FirmaDigital.jsx`:** Consumir desde `src/components/common/FirmaDigital.jsx` en la pantalla de entrega móvil.
- **Servicio `NotificationService`:** Invocar para enviar notificación a la campana del chofer cuando Kevin edite una nota.
- **Servicio `AuditLogService`:** Registrar cualquier edición de montos o anulación de notas.
- **Exportación de Reportes:** Consumir `exportarAExcelCSV` y estilos `@media print` para la impresión de la NV-501.

---

## 5. ZONA PROTEGIDA Y PUNTOS DE INTEGRACIÓN CON PLANTA
- **Prohibido:** Tocar tablas de fabricación de planta (`Produccion*`, `Bobina*`, `Empaque`, `InventarioProductoTerminado`).
- **Integración:** La nota de despacho de fábrica se simula mediante la carga inicial de camión (`InventarioChofer` / `CargaInventarioRuta`). No se descuenta stock de fábrica (ver `docs/context/INTEGRACIONES_PLANTA.md`).

---

## 6. DEPENDENCIAS PREVIAS
- Fase 1 completada (tablas `Sucursal`, `InventarioChofer`, `PrecioProducto` y servicios transversales operativos).

---

## 7. PUNTOS DE CHOQUE Y REGLAS DE RESOLUCIÓN
- **Choque con Subagente B (Cuentas por Cobrar):** Cuando una nota de venta tiene pago parcial o saldo a crédito.
- **Regla:** El Subagente A crea la `NotaVenta` con `saldo_pendiente > 0` e inserta el registro inicial en `public.CuentaCobrar`. El Subagente B se encarga exclusivamente de la gestión posterior de cobros, planes de pago y comprobantes QR de esa cuenta.

---

## 8. ENTREGABLES Y TESTS OBLIGATORIOS
- [ ] Endpoints de Notas de Venta con cálculo automático de bandeo y registro de pagos mixtos.
- [ ] Endpoint de Cierre de Turno y Rendición Diaria con detección de mermas y faltantes.
- [ ] Endpoint de ajuste/edición de nota para Kevin con notificación al chofer.
- [ ] Pantalla móvil de entrega con canvas de firma digital.
- [ ] Pantalla de Cierre de Turno para choferes y supervisor.
- [ ] **Tests:**
  - `TC-LOG-01`: Venta de Megarrollo aplica bonificación de bandeo sin costo.
  - `TC-LOG-02`: Detección de faltante físico en cierre de turno y cargo al chofer.

---

## 9. PROTOCOLO DE CIERRE
1. Marcar los checkboxes de la sección Subagente A en `ROADMAP.md`.
2. Actualizar `docs/context/DB_ESQUEMA.md` si hubo cambios en columnas.
3. Registrar entrada en `docs/progress/LOG.md`.
4. Si la tarea queda en progreso, generar reporte en `docs/progress/HANDOFF_TEMPLATE.md`.
