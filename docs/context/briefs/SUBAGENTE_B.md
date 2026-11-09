# BRIEF TÉCNICO: SUBAGENTE B
*Fase de Ejecución: Fase 2 (En Paralelo)*
*Módulos Asignados: Módulo 4 (Cuentas por Cobrar, Validación de Cobros QR y Mora)*

---

## 1. MISIÓN DEL SUBAGENTE (3 Líneas)
Implementar la gestión rigurosa de cuentas por cobrar y cobranzas móviles: flujo de aprobación donde todo abono registrado por chofer nace `Pendiente de aprobación`, exigencia estricta de fotografía del comprobante QR mediante drag & drop, abonos manuales y masivos por Excel, y alertas de mora para créditos vencidos.

---

## 2. REQUISITOS DETALLADOS DEL NEGOCIO

### Cuentas por Cobrar y Cobros QR (Módulo 4)
- **Flujo de Aprobación Obligatorio:** Todo registro de cobranza o abono capturado por un chofer en calle nace en estado `PENDIENTE_APROBACION`. Ningún abono reduce el saldo deudor del cliente hasta que Kevin o el encargado de sucursal verifique el dinero o la transferencia bancaria.
- **Fotografía de Comprobante QR Obligatoria:** Si el método de pago seleccionado es QR / transferencia, el sistema exige adjuntar obligatoriamente la imagen del comprobante (típicamente arrastrada desde WhatsApp Web o seleccionada desde la galería móvil). Sin archivo, la transacción es rechazada.
- **Depuración Automática:** La imagen se asocia mediante `ComprobanteArchivo` con vencimiento a 60 días para no saturar el servidor, conservando el registro y auditoría en BD.
- **Abonos Manuales y por Excel:** Kevin puede registrar abonos directos en oficina y procesar planillas Excel de conciliación bancaria para saldar múltiples facturas (ej. cadenas de supermercados que pagan a 30 días en una sola cuota).
- **Alertas de Mora:** Notificación automática en el panel de cuentas por cobrar para clientes con facturas vencidas según sus días de crédito pactados.

---

## 3. PROPIEDAD DE TABLAS Y ARCHIVOS

### Tablas que Posee (Puede crear y modificar):
- `public.CuentaCobrar` (extensión: `DiasMora`, `EstadoCobranza`, `FechaUltimoAbono`)
- `public.AbonoCuentaCobrar` (extensión: `EstadoAprobacion`, `AprobadoPor`, `FechaAprobacion`, `IdComprobanteArchivo`)
- `public.PlanPago` (control de cuotas cuando aplique)

### Tablas que Solo Puede Leer o Consumir:
- `public.Sucursal` (Fase 1): para aislar la cartera por sucursal.
- `public.NotaVenta` (Subagente A): para vincular las cuentas por cobrar con su venta origen.
- `public.Cliente`: para límites de crédito y datos de contacto.
- `public.ComprobanteArchivo` (Fase 1): para registrar metadatos de las fotos de comprobantes.

---

## 4. SERVICIOS TRANSVERSALES A REUTILIZAR
- **Servicio `FileStorageService`:** Validar extensión, peso máximo (5MB) y almacenar el comprobante QR.
- **Servicio `NotificationService`:** Enviar notificación a Kevin cuando un chofer suba un cobro QR pendiente de validar.
- **Servicio `AuditLogService`:** Registrar la aprobación o rechazo del cobro por Kevin.

---

## 5. ZONA PROTEGIDA Y PUNTOS DE INTEGRACIÓN CON PLANTA
- **Prohibido:** Tocar tablas de fabricación de planta o catálogos protegidos.
- **Integración:** Ninguna directa con planta; módulo 100% comercial y contable.

---

## 6. DEPENDENCIAS PREVIAS
- Fase 1 completada (`Sucursal`, `ComprobanteArchivo`, `FileStorageService`).
- Subagente A: Creación inicial de `CuentaCobrar` a partir de notas de venta con saldo a crédito.

---

## 7. PUNTOS DE CHOQUE Y REGLAS DE RESOLUCIÓN
- **Choque con Subagente A (Notas de Venta):** Saldo inicial de la cuenta por cobrar.
- **Regla:** Subagente B asume que la cuenta ya fue creada por Subagente A al emitirse la nota con saldo pendiente; Subagente B lidera toda la lógica posterior de abonos, estados de aprobación y mora.

---

## 8. ENTREGABLES Y TESTS OBLIGATORIOS
- [ ] Endpoint de registro de abono por chofer (con validación de comprobante obligatorio si es QR).
- [ ] Endpoint de aprobación/rechazo de abonos para Kevin.
- [ ] Importador de abonos masivos mediante planilla Excel.
- [ ] Motor y listado de cuentas con alerta visual de mora.
- [ ] Pantalla de aprobación de cobros QR con visor rápido de imagen.
- [ ] **Tests:**
  - `TC-CXC-01`: Intento de registrar cobro QR sin foto es rechazado con error 422.
  - Test: Abono de chofer en estado `PENDIENTE_APROBACION` no reduce el saldo deudor del cliente hasta ser aprobado.

---

## 9. PROTOCOLO DE CIERRE
1. Marcar los checkboxes de la sección Subagente B en `ROADMAP.md`.
2. Actualizar `docs/context/DB_ESQUEMA.md`.
3. Registrar entrada en `docs/progress/LOG.md`.
4. Si la tarea queda incompleta, generar reporte en `docs/progress/HANDOFF_TEMPLATE.md`.
