# BRIEF TÉCNICO: SUBAGENTE C
*Fase de Ejecución: Fase 2 (En Paralelo)*
*Módulos Asignados: Módulo 8 (Distribuidores Externos: Oruro, Tarija, La Paz y Tupiza)*

---

## 1. MISIÓN DEL SUBAGENTE (3 Líneas)
Implementar el portal comercial para distribuidores mayoristas de Oruro, Tarija, La Paz y Tupiza: visualización estricta sobre stock real de producto terminado en planta (solo lectura), bloqueo automático de pedidos que superen existencias, interfaz para que Kevin edite cantidades y carga de comprobante bancario por el distribuidor.

---

## 2. REQUISITOS DETALLADOS DEL NEGOCIO

### Distribuidores Externos (Módulo 8)
- **Rol y Acceso Diferenciado:** Usuario con rol `DistribuidorExterno` que accede a una interfaz simplificada donde únicamente visualiza el catálogo de productos y el stock real disponible para despacho mayorista.
- **Validación Estricta de Stock Real (Solo Lectura):** El pedido solo puede realizarse sobre mercadería efectivamente disponible en planta consultada a través de `PlantaDataReader`. Si el distribuidor solicita 1.000 fardos y solo hay 800 disponibles, el sistema bloquea el pedido y avisa el límite máximo.
- **Edición de Pedido por Kevin:** Una vez recibido el pedido preliminar, Kevin en Contabilidad puede revisar la disponibilidad, ajustar cantidades pactadas con el cliente (ej. rebajar a 750 bultos por compromisos previos) y emitir la cotización/proforma final.
- **Adjunto de Comprobante de Depósito:** El distribuidor acude al banco (Banco Unión habitualmente), realiza la transferencia o depósito y sube la foto o PDF de la boleta al portal.
- **Aprobación de Despacho:** Kevin valida el ingreso del dinero en la cuenta de Banco Unión y aprueba el despacho para que se coordine con transporte.

---

## 3. PROPIEDAD DE TABLAS Y ARCHIVOS

### Tablas que Posee (Puede crear y modificar):
- `public.DistribuidorExterno` (datos de contacto, ciudad: Oruro/Tarija/La Paz/Tupiza, NIT, condición comercial)
- `public.PedidoDistribuidor` (`IdPedidoDistribuidor`, `IdDistribuidor`, `FechaPedido`, `Estado`, `MontoTotal`, `IdComprobanteArchivo`, `ObservacionKevin`)
- `public.DetallePedidoDistribuidor` (`IdDetalle`, `IdPedidoDistribuidor`, `presentacion_id` FK a `PresentacionProducto`, `CantidadSolicitada`, `CantidadAprobadaKevin`, `PrecioUnitario`, `Subtotal`)

### Tablas que Solo Puede Leer o Consumir:
- `public.InventarioProductoTerminado` (mediante `PlantaDataReader` en estricto modo solo lectura).
- `public.Producto` y `public.PresentacionProducto`: para el catálogo comercial unificado.
- `public.ComprobanteArchivo` (Fase 1): para registrar la boleta de depósito bancario.

---

## 4. SERVICIOS TRANSVERSALES A REUTILIZAR
- **Capa `PlantaDataReader`:** Consultar existencias reales de fábrica sin escribir en tablas de planta.
- **Servicio `FileStorageService`:** Validar y almacenar el comprobante de depósito del distribuidor (límite 5MB, JPG/PDF).
- **Servicio `NotificationService`:** Notificar a Kevin ante un nuevo pedido y al distribuidor cuando Kevin ajuste o apruebe la proforma.

---

## 5. ZONA PROTEGIDA Y PUNTOS DE INTEGRACIÓN CON PLANTA
- **Prohibido:** Modificar `InventarioProductoTerminado` o insertar movimientos de salida en planta.
- **Integración:** El descuento físico de stock se registrará en el documento `docs/context/INTEGRACIONES_PLANTA.md` como "Pendiente de coordinación con Fabricio".

---

## 6. DEPENDENCIAS PREVIAS
- Fase 1 completada (`PlantaDataReader`, `ComprobanteArchivo`, `FileStorageService`, `NotificationService`).

---

## 7. PUNTOS DE CHOQUE Y REGLAS DE RESOLUCIÓN
- **Choque con Subagente A y B:** Pedidos de distribuidores vs ventas locales de choferes.
- **Regla:** El módulo de distribuidores es completamente mayorista e interdepartamental; opera con sus propias tablas (`PedidoDistribuidor`), no interfiere con las notas de venta locales (`NotaVenta`).

---

## 8. ENTREGABLES Y TESTS OBLIGATORIOS
- [ ] Endpoints para creación de pedidos por distribuidores con validación en tiempo real contra `PlantaDataReader`.
- [ ] Endpoint de ajuste y aprobación de pedido para Kevin.
- [ ] Endpoint para adjuntar comprobante de depósito bancario.
- [ ] Pantalla de catálogo y pedidos para Distribuidores Externos.
- [ ] Panel de revisión y ajuste de pedidos mayoristas para Kevin.
- [ ] **Tests:**
  - Test: Pedido que excede el stock real disponible en planta es bloqueado con error 400.
  - Test: Kevin edita cantidades de un pedido y el importe neto total se recalcula con precisión decimal.

---

## 9. PROTOCOLO DE CIERRE
1. Marcar los checkboxes de la sección Subagente C en `ROADMAP.md`.
2. Actualizar `docs/context/DB_ESQUEMA.md`.
3. Registrar entrada en `docs/progress/LOG.md`.
4. Si la tarea queda en progreso, generar reporte en `docs/progress/HANDOFF_TEMPLATE.md`.
