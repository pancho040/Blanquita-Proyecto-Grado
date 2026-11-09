# BRIEF TÉCNICO: SUBAGENTE E
*Fase de Ejecución: Fase 3 (En Paralelo)*
*Módulos Asignados: Módulo 5 (Caja Chica, Rendición con Comprobantes y Vueltos)*

---

## 1. MISIÓN DEL SUBAGENTE (3 Líneas)
Implementar la administración integral de Caja Chica para gastos operativos menores: solicitud exclusiva para Kevin, ciclo desacoplado de 3 estados operativos (`Pendiente -> Entregado -> Rendido`), cálculo automático de reintegro/cambio de fondos, vista ejecutiva simplificada para Don Osvaldo (solo monto final y respaldo) y bloqueo estricto de impresión hasta aprobación gerencial.

---

## 2. REQUISITOS DETALLADOS DEL NEGOCIO

### Caja Chica y Ciclo de Vida de Vales (Módulo 5)
- **Solicitante Exclusivo:** Únicamente Kevin (Encargado de Contabilidad) puede solicitar vales de caja chica para compras menores de fábrica o gastos administrativos de emergencia.
- **Resolución de la Contradicción Operativa vs Gerencial:**
  - El ciclo operativo tiene 3 estados: `PENDIENTE` (solicitud inicial de fondos), `ENTREGADO` (dinero en efectivo entregado a Kevin para realizar la compra, ej. 700 Bs) y `RENDIDO` (Kevin presenta facturas/recibos y devuelve el vuelto).
  - El estado de supervisión es `AprobacionGerencia` (`PENDIENTE`, `APROBADO`, `RECHAZADO`). Don Osvaldo no aprueba la solicitud inicial a ciegas; aprueba al final mirando el gasto ya rendido con sus comprobantes físicos/digitales adjuntos.
- **Cálculo Automático de Reintegro / Vuelto:**
  - Se entregan 700 Bs, se rinden gastos por 600 Bs con comprobante -> El sistema calcula automáticamente un reintegro de 100 Bs a devolver a la caja.
  - El libro de caja chica refleja únicamente el egreso neto real de 600 Bs.
- **Bloqueo de Impresión Oficial:** El botón de imprimir vale o comprobante formal permanece bloqueado hasta que Don Osvaldo registre `AprobacionGerencia = 'APROBADO'`.
- **Depuración de Comprobantes:** Los comprobantes adjuntos se gestionan mediante `ComprobanteArchivo` con purga automática del binario a los 60 días.

---

## 3. PROPIEDAD DE TABLAS Y ARCHIVOS

### Tablas que Posee (Puede crear y modificar):
- `public.SolicitudCajaChica` (extensión: `EstadoOperativo`, `AprobacionGerencia`, `MontoEntregado`, `MontoGastoReal`, `MontoReintegroDevuelto`, `IdComprobanteArchivo`, `IdSucursal`)
- `public.DetalleGastoCajaChica` (desglose de ítems comprados en el vale: `id`, `solicitud_id`, `concepto`, `nro_factura`, `proveedor`, `monto`)

### Tablas que Solo Puede Leer o Consumir:
- `public.Caja` y `public.AperturaCierreCaja`: para registrar la afectación en el saldo de caja chica.
- `public.Usuario`: para solicitante (Kevin) y aprobador (Don Osvaldo).
- `public.ComprobanteArchivo`: para el archivo del comprobante digital.
- `public.Sucursal`: para aislar la caja chica por sucursal.

---

## 4. SERVICIOS TRANSVERSALES A REUTILIZAR
- **Servicio `FileStorageService`:** Almacenar y comprimir facturas/recibos de respaldo de caja chica.
- **Servicio `NotificationService`:** Notificar a Don Osvaldo cuando un vale esté rendido listo para su firma.
- **Servicio `AuditLogService`:** Trazabilidad de entregas de dinero, rendición y aprobación gerencial.
- **Estilos `@media print`:** Impresión formal minimalista del vale una vez autorizado.

---

## 5. ZONA PROTEGIDA Y PUNTOS DE INTEGRACIÓN CON PLANTA
- **Prohibido:** Tocar tablas de producción o inventario de planta.
- **Integración:** Compras menores de repuestos o insumos de planta cargadas en caja chica no alteran las tablas de materias primas; son egresos puramente contables.

---

## 6. DEPENDENCIAS PREVIAS
- Fase 1 completada (`Sucursal`, `ComprobanteArchivo`, `FileStorageService`, `NotificationService`).

---

## 7. PUNTOS DE CHOQUE Y REGLAS DE RESOLUCIÓN
- **Choque con Subagente F (Panel Gerencial):** Vista de aprobación de caja chica para Don Osvaldo.
- **Regla:** El Subagente E provee el endpoint `/api/caja-chica/pendientes-aprobacion-gerencia` y la lógica de negocio; el Subagente F consume este endpoint en el dashboard ejecutivo de Don Osvaldo.

---

## 8. ENTREGABLES Y TESTS OBLIGATORIOS
- [ ] Endpoints para creación de solicitud, entrega de fondos, rendición con comprobante y aprobación gerencial.
- [ ] Lógica y cálculo automático de reintegro/cambio devuelto a caja.
- [ ] Validación de bloqueo de impresión mientras no esté aprobado por Gerencia.
- [ ] Pantalla de gestión de caja chica para Kevin con subida de comprobantes drag & drop.
- [ ] Vista simplificada para Don Osvaldo con visualización directa de comprobante y botón de firma en 1 clic.
- [ ] **Tests:**
  - `TC-TES-01`: Entrega de 700 Bs y gasto de 600 Bs genera reintegro de 100 Bs y egreso en caja de 600 Bs.
  - Test: Intento de imprimir o descargar vale con `AprobacionGerencia = 'PENDIENTE'` retorna error 403.

---

## 9. PROTOCOLO DE CIERRE
1. Marcar los checkboxes de la sección Subagente E en `ROADMAP.md`.
2. Actualizar `docs/context/DB_ESQUEMA.md`.
3. Registrar entrada en `docs/progress/LOG.md`.
4. Si la tarea queda en progreso, generar reporte en `docs/progress/HANDOFF_TEMPLATE.md`.
