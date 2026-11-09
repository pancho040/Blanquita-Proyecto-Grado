# BRIEF TÉCNICO: SUBAGENTE F
*Fase de Ejecución: Fase 4 (Paralelo / Consolidación)*
*Módulos Asignados: Módulo 6 (Panel Gerencial Don Osvaldo y Buscador por Código) y Módulo 9 (Bancos y Saldos Financieros)*

---

## 1. MISIÓN DEL SUBAGENTE (3 Líneas)
Implementar el centro de comando gerencial para Don Osvaldo: panel ejecutivo de alta velocidad con buscador global por código numérico de 4 dígitos, módulo de aprobación ágil con foto de firma/sello, registro referencial de movimientos en los 3 bancos de la empresa (MSC, Unión, BNB) y reporte financiero consolidado con saldos de materia prima y producto terminado (en estricto modo solo lectura).

---

## 2. REQUISITOS DETALLADOS DEL NEGOCIO

### Panel Gerencial y Buscador por Código (Módulo 6)
- **Panel Simplificado y Rápido:** Interfaz minimalista diseñada para Don Osvaldo, enfocada en resúmenes ejecutivos clave: ventas globales del día, cobranzas pendientes, vales de caja chica por autorizar y saldos bancarios.
- **Buscador por Código Numérico:** Campo de búsqueda prominente en el header o dashboard donde Don Osvaldo introduce un número de 4 dígitos (ej. `2208`) y el sistema localiza de inmediato el documento exacto (nota de venta, vale de caja chica, arqueo o reporte) sin navegar por árboles de menús.
- **Firma y Sello Digital:** Mecanismo para que Don Osvaldo apruebe autorizaciones ejecutivas con un clic, permitiendo adjuntar opcionalmente la fotografía del documento con su firma y sello físico.

### Registro de Bancos y Saldos de Planta (Módulo 9)
- **Los 3 Bancos Referenciales:**
  - Banco Mercantil Santa Cruz (MSC): recaudación de repartidores y choferes.
  - Banco Unión: depósitos de distribuidores mayoristas, Alcaldía y supermercados.
  - Banco Nacional de Bolivia (BNB): operaciones institucionales.
  - *Nota:* Registro referencial manual/conciliado; las APIs directas de bancos quedan fuera de alcance por costos.
- **Consolidación Financiera con Saldos de Planta (Solo Lectura):**
  - Generación de informe gerencial que consolida el valor monetario de materias primas (bobinas de papel, bobinas de servilleta, rodelas, insumos) y stock de producto terminado en planta consumiendo exclusivamente `PlantaDataReader`.

---

## 3. PROPIEDAD DE TABLAS Y ARCHIVOS

### Tablas que Posee (Puede crear y modificar):
- `public.CuentaBancariaEmpresa` (extensión: saldos conciliados, tipo de cuenta, clasificación para choferes/distribuidores)
- `public.FirmaDigitalDocumento` (registro de autorizaciones y sellos gerenciales)
- Vistas analíticas ejecutivas de consolidación.

### Tablas que Solo Puede Leer o Consumir:
- Tablas protegidas de planta (`BobinaPapel`, `BobinaServilleta`, `InventarioProductoTerminado`) consumidas **exclusivamente a través de `PlantaDataReader`**.
- `public.NotaVenta`, `public.CuentaCobrar`, `public.SolicitudCajaChica`, `public.Planilla`: para alimentar los KPIs gerenciales y el buscador numérico.

---

## 4. SERVICIOS TRANSVERSALES A REUTILIZAR
- **Capa `PlantaDataReader`:** Consultar saldos de materias primas y productos sin escribir en planta.
- **Servicio `NotificationService`:** Alimentar el centro de notificaciones de Don Osvaldo con alertas destacadas (cambios de precio en rojo por 24h, notas editadas).
- **Servicio `AuditLogService`:** Trazabilidad de cada búsqueda y aprobación emitida por Gerencia.
- **Motor de Reportes:** Impresión ejecutiva formal con `@media print`.

---

## 5. ZONA PROTEGIDA Y PUNTOS DE INTEGRACIÓN CON PLANTA
- **Prohibido:** Modificar cualquier tabla de planta o inventario de fábrica.
- **Integración:** Solo lectura para reportes de saldos de materia prima y producto terminado (ver `docs/context/INTEGRACIONES_PLANTA.md`).

---

## 6. DEPENDENCIAS PREVIAS
- Fases 1, 2 y 3 concluidas (módulos de ventas, cobranzas, caja chica y planillas operativos).

---

## 7. PUNTOS DE CHOQUE Y REGLAS DE RESOLUCIÓN
- **Choque con Módulos de Subagentes Anteriores:** Centralización de estados y autorizaciones.
- **Regla:** El Subagente F no modifica la lógica interna de los módulos anteriores; consume sus endpoints y servicios existentes para consolidarlos en el dashboard de Don Osvaldo.

---

## 8. ENTREGABLES Y TESTS OBLIGATORIOS
- [ ] Endpoint de búsqueda rápida por código numérico (`/api/gerencia/buscar-reporte?codigo=X`).
- [ ] Endpoint de KPIs ejecutivos consolidados para Don Osvaldo.
- [ ] Endpoints para conciliación y registro de movimientos de los 3 bancos referenciales.
- [ ] Endpoint de reporte consolidado de saldos de materias primas y productos (solo lectura).
- [ ] Dashboard Gerencial minimalista para Don Osvaldo.
- [ ] **Tests:**
  - Test: Búsqueda con código 2208 devuelve de inmediato la entidad exacta correspondiente.
  - Test: Reporte consolidado de saldos de planta se genera sin emitir ninguna sentencia de escritura.

---

## 9. PROTOCOLO DE CIERRE
1. Marcar los checkboxes de la sección Subagente F en `ROADMAP.md`.
2. Actualizar `docs/context/DB_ESQUEMA.md`.
3. Registrar entrada en `docs/progress/LOG.md`.
4. Si la tarea queda en progreso, generar reporte en `docs/progress/HANDOFF_TEMPLATE.md`.
