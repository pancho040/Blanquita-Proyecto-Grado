# ROADMAP - PLAN MAESTRO DE EJECUCIÓN POR FASES Y SUBAGENTES

> **Instrucción de Edición:** El Agente Principal edita el Resumen Ejecutivo. Cada Subagente (`A`, `B`, `C`, `D`, `E`, `F`) edita **únicamente su propia sección** para prevenir conflictos de merge.

---

## RESUMEN EJECUTIVO DE AVANCE

| Fase | Enfoque / Módulos | Estado | Responsable |
| :---: | :--- | :---: | :--- |
| **Fase 0** | Análisis profundo, introspección de BD y documentación maestra | `[x] COMPLETADO` | Agente Principal |
| **Fase 1** | Cimiento Prioritario: Multi-Sucursal, Precios, Inventarios y Servicios | `[x] COMPLETADO` | Agente Principal |
| **Fase 2** | Repartidores, Cierre Diario, Ventas, CXC, QR y Distribuidores | `[ ] PENDIENTE` | Subagentes A, B, C |
| **Fase 3** | Personal, Planillas Duales, Finiquito y Caja Chica de 3 Estados | `[ ] PENDIENTE` | Subagentes D, E |
| **Fase 4** | Panel Gerencial de Don Osvaldo, Buscador por Código y Bancos | `[ ] PENDIENTE` | Subagente F |
| **Fase 5** | Limpieza de datos de prueba controlada y Cierre Final (`CAMBIOS.md`) | `[ ] PENDIENTE` | Agente Principal |

---

## FASE 0: CONTEXTO, INTROSPECCIÓN Y ARQUITECTURA (Turno Actual)
- **Dependencias:** Ninguna.
- **Dueño:** Agente Principal.
- **Entregables:**
  - [x] Introspección exhaustiva del código fuente, modelos, base de datos y scripts SQL.
  - [x] Generación de `ARCHITECTURE.md` y `AGENT_RULES.md`.
  - [x] Creación de `AGENTS.md` para arranque de agentes.
  - [x] Estructuración de `docs/context/` (`REQUERIMIENTOS_NEGOCIO.md`, `REGLAS_CALCULO.md`, `GLOSARIO.md`, `DB_ESQUEMA.md`, `ZONA_PROTEGIDA.md`, `INTEGRACIONES_PLANTA.md`, `SUPUESTOS_Y_DUDAS.md`, `DECISIONES.md`, `TEST_CASES.md`).
  - [x] Elaboración de briefs autosuficientes para subagentes A, B, C, D, E y F en `docs/context/briefs/`.
  - [x] Creación de bitácora `docs/progress/LOG.md` y plantilla `HANDOFF_TEMPLATE.md`.
  - [x] Presentación de reporte ejecutivo y espera de validación del usuario sin tocar código fuente.

---

## FASE 1: CIMIENTO PRIORITARIO Y MULTI-SUCURSAL (Secuencial)
- **Módulos:** Módulo 1 (Multi-Sucursal, Precios con Vigencia, Revalorización e Inventario Comercial) + Servicios Transversales.
- **Dependencias:** Fase 0 validada.
- **Dueño:** Agente Principal.
- **Tablas Propias:** `Sucursal`, `InventarioSucursal`, `InventarioChofer`, `EnvioFabricaSucursal`, `DetalleEnvioFabrica`, `PrecioProducto` (extensión), `RevalorizacionInventarioChofer`, `ProductoConfigComercial`, `NotificacionInterna`, `ComprobanteArchivo`.
- **Entregables:**
  - [x] **Tablas y Migraciones SQL:**
    - [x] Crear tabla `Sucursal` y precargar Sucre (`IdSucursal=1`) y Potosí (`IdSucursal=2`).
    - [x] Agregar `IdSucursal` a `Usuario`, `PrecioProducto`, `Cliente`, `RutaDistribucion`, `NotaVenta`, `Caja`, `CuentaCobrar`, `CuentaPagarProveedor` con migración aditiva y backfill a Sucre.
    - [x] Crear tabla satélite `ProductoConfigComercial` vinculada a `Producto` (con `EsBandeo`, `ValorBandeo`).
    - [x] Crear tablas `InventarioSucursal`, `InventarioChofer`, `EnvioFabricaSucursal` y `DetalleEnvioFabrica`.
    - [x] Extender `PrecioProducto` con `FechaVigenciaDesde` y crear `RevalorizacionInventarioChofer`.
  - [x] **Servicios Transversales Base:**
    - [x] Implementar `FileStorageService` (límite 5MB, JPG/PNG/PDF, compresión y metadatos en `ComprobanteArchivo`).
    - [x] Diseñar cron job de depuración a los 60 días para comprobantes con `archivo_eliminado = true`.
    - [x] Implementar componente frontend `FirmaDigital.jsx` (canvas táctil móvil con metadatos).
    - [x] Implementar `FabricioLegacyAdapter` (implementando `InventarioProductoTerminadoPort`) para descuento atómico en planta Sucre sin inventario duplicado.
    - [x] Configurar interruptor `DESCONTAR_PLANTA_ACTIVO` y columna `descuento_planta_aplicado` en envíos, con script CLI de conciliación pendiente.
    - [x] Implementar `NotificationService` (campana de alertas para gerencia y choferes).
    - [x] Implementar `PlantaDataReader` (capa de lectura estricta para saldos y catálogo sin escribir en planta).
    - [x] Reforzar `AuditLogService` para trazabilidad de precios y revalorizaciones.
    - [x] Implementar script de guardia automática de zona protegida (`docs/scripts/verificar_zona_protegida.py` con AST y regex).
  - [x] **Endpoints Backend:**
    - [x] CRUD y conmutación de Sucursales (`/api/sucursales`) y catálogo de Plantas (`/api/plantas`).
    - [x] Gestión de Precios por Sucursal indexados por presentación (`/api/logistica/precios`) y trigger de revalorización automática de choferes.
    - [x] Notificación automática en rojo (24 horas) para cambios de precio.
    - [x] Módulo polimórfico de Envíos de Inventario (`/api/logistica/envios`) con ciclo de vida (`PENDIENTE` -> `EN_TRANSITO` -> `RECEPCIONADO` / `ANULADO`) y control de mermas en recepción.
    - [x] Reporte de inventario valorizado actual e histórico a fecha arbitraria (ej. 31 de octubre).
  - [x] **Pantallas Frontend:**
    - [x] Selector global de sucursal en Navbar para Gerencia/Admin y bloqueo fijo para sucursal.
    - [x] Pantalla de Administración de Precios por Sucursal con fecha de vigencia y alertas.
    - [x] Pantalla de Inventario Comercial de Sucursal y Carga a Choferes.
    - [x] Reporte valorizado de inventario con selector de fecha histórica y exportación formal.
  - [x] **Diseño del Script de Limpieza:**
    - [x] Script de limpieza selectiva de datos de prueba para módulos de Kevin (diseñado, no ejecutado).
  - [x] **Tests Unitarios e Integración:**
    - [x] Test: crear tercera sucursal con 2 choferes sin tocar código fuente.
    - [x] Test: cambiar precio en Potosí no altera precios en Sucre.
    - [x] Test: revalorización automática del inventario de choferes y cálculo de ajuste de valor.
    - [x] Test: usuario de Potosí no puede leer datos de Sucre (aislamiento estricto).

---

## FASE 2: DISTRIBUCIÓN, COBRANZAS Y VENTAS (Paralelo - 3 Subagentes)

### Subagente A: Módulos 3 y 7 (Repartidores, Cierre Diario y Notas de Venta)
- **Dependencias:** Fase 1 terminada.
- **Tablas Propias:** `RendicionRuta`, `AsignacionRuta` (extensión), `NotaVenta` (extensión), `DetalleNotaVenta` (extensión).
- **Puntos de Choque con Subagente B:** `NotaVenta` y pagos con saldo a crédito (`CuentaCobrar`). Regla: Subagente A genera la `NotaVenta` y emite el evento/registro inicial; Subagente B gestiona el ciclo de vida del saldo en `CuentaCobrar`.
- **Entregables:**
  - [x] **Backend:**
    - [x] Control de cierre de turno diario: comparativa stock cargado vs ventas vs stock devuelto físico.
    - [x] Registro inmediato de mermas y faltantes imputables al chofer en el cierre diario.
    - [x] Emisión de Nota de Venta NV-501 con datos de chofer, camión, precios automáticos y bandera de bandeo.
    - [x] Soporte de pagos mixtos (Efectivo + QR + Saldo a crédito).
    - [x] Motor de promociones automáticas (1 Megarrollo = 1 Servilleta de regalo).
    - [x] Endpoint de edición de nota para Kevin con registro de ajuste (ej. -10 Bs) y notificación al chofer.
  - [x] **Frontend:**
    - [x] Pantalla móvil de entrega para chofer con firma digital obligatoria en canvas táctil.
    - [x] Pantalla de Cierre de Turno y Rendición Diaria con conciliación de efectivo y comprobantes.
    - [x] Interfaz de visualización y edición controlada de Notas de Venta para Kevin.
  - [x] **Tests:**
    - [x] Test: cierre de turno detecta discrepancia de stock físico y genera registro de faltante.
    - [x] Test: nota de venta aplica promoción de bandeo sin alterar tablas de planta.

### Subagente B: Módulo 4 (Cuentas por Cobrar, QR y Cobranzas)
- **Dependencias:** Fase 1 terminada.
- **Tablas Propias:** `CuentaCobrar`, `PlanPago`, `AbonoCuentaCobrar`, `ComprobanteArchivo` (uso).
- **Puntos de Choque con Subagente A:** Recepción de abonos iniciales de notas de venta.
- **Entregables:**
  - [x] **Backend:**
    - [x] Flujo de aprobación: todo cobro/abono registrado por chofer nace `PENDIENTE_APROBACION`.
    - [x] Validación estricta de foto de comprobante QR obligatoria (usando `FileStorageService`).
    - [x] Registro de abonos manuales individuales y carga masiva por planilla Excel.
    - [x] Motor de alertas de mora para créditos vencidos (ej. supermercados a 30 días).
  - [x] **Frontend:**
    - [x] Bandeja de aprobación de cobros QR para Kevin y encargados de sucursal.
    - [x] Visor de comprobantes con drag & drop y zoom rápido.
    - [x] Módulo de cobranzas y cartera de clientes con indicador de días de mora.
  - [x] **Tests:**
    - [x] Test: intento de registrar cobro QR sin foto es rechazado con error 422.
    - [x] Test: abono de chofer no reduce saldo deudor hasta ser aprobado por Kevin.

### Subagente C: Módulo 8 (Distribuidores Externos: Oruro, Tarija, La Paz, Tupiza)
- **Dependencias:** Fase 1 terminada.
- **Tablas Propias:** `DistribuidorExterno`, `PedidoDistribuidor`, `DetallePedidoDistribuidor`.
- **Integración con Planta:** Lectura obligatoria de stock real mediante `PlantaDataReader`.
- **Entregables:**
  - [x] **Backend:**
    - [x] Portal/Endpoints para Distribuidores Externos con visualización exclusiva de stock disponible.
    - [x] Bloqueo estricto de pedidos que superen el stock real de producto terminado.
    - [x] Endpoint para que Kevin edite cantidades del pedido y confirme la proforma.
    - [x] Subida de comprobante de depósito/transferencia bancaria por el distribuidor.
  - [x] **Frontend:**
    - [x] Vista simplificada para distribuidores (catálogo, carrito de pedidos y carga de boleta).
    - [x] Panel de Kevin para revisión, ajuste y aprobación de despachos a distribuidores.
  - [x] **Tests:**
    - [x] Test: pedido de distribuidor por encima del stock de planta es bloqueado automáticamente.
    - [x] Test: Kevin ajusta cantidad y el monto total se recalcula con precisión decimal.

---

## FASE 3: PERSONAL, PLANILLAS Y CAJA CHICA (Paralelo - 2 Subagentes)

### Subagente D: Módulo 2 (Personal, Planillas Duales, Biométrico y Finiquitos)
- **Dependencias:** Fase 1 terminada.
- **Tablas Propias:** `DatosLaboralesEmpleado`, `PeriodoNomina`, `Planilla`, `DetallePlanilla`, `AsistenciaDiaria`, `ConfiguracionLaboral`, `Finiquito`, `deudas_no_venta`, `detalles_no_venta_empleado`.
- **Entregables:**
  - [x] **Backend:**
    - [x] Gestión de personal diferenciada en pestañas: `Asegurado` (oficial) y `Externo` (eventual).
    - [x] Generación de Planilla Oficial (Ministerio de Trabajo / Gestora con porcentajes configurables).
    - [x] Generación de Planilla Interna (sueldo base + horas extra fábrica - faltas - permisos - adelantos - faltantes - descuento "No venta" compartido).
    - [x] Importador del Excel de asistencia de Don Osvaldo (lectura de columna AJ, horas y días faltados negativos).
    - [x] Emisión de Papeletas de Pago en formato formal imprimible en 2 copias por hoja.
    - [x] Módulo de Finiquitos con activación para antigüedad >= 3 meses y cálculo exacto por diferencia de fechas calendario.
  - [x] **Frontend:**
    - [x] Interfaz de personal con pestañas Asegurados / Externos y filtros por sucursal.
    - [x] Pantalla de procesamiento de planillas con switch de vista Oficial / Interna.
    - [x] Asistente de importación de asistencia de Don Osvaldo con vista previa de errores.
    - [x] Módulo y modal de cálculo y emisión de Finiquito en formato oficial del Ministerio.
  - [x] **Tests:**
    - [x] Test: fórmula de valor hora (`sueldo / 30 / 8`) y descuento de faltas.
    - [x] Test: descuento compartido de "No venta" prorrateado entre 2 vendedores.
    - [x] Test: finiquito de empleado con 11 meses y 12 días calcula exactamente el monto ministerial.

### Subagente E: Módulo 5 (Caja Chica con Ciclo Operativo y Aprobación Gerencial)
- **Dependencias:** Fase 1 terminada.
- **Tablas Propias:** `SolicitudCajaChica`, `DetalleGastoCajaChica`, `RendicionCajaChica`.
- **Resolución de Contradicción:** Flujo operativo (`PENDIENTE` -> `ENTREGADO` -> `RENDIDO`) desacoplado de `aprobacion_gerencia` (`PENDIENTE`/`APROBADO`/`RECHAZADO`). Don Osvaldo aprueba viendo el gasto final rendido con sus comprobantes; impresión bloqueada hasta su aprobación.
- **Entregables:**
  - [x] **Backend:**
    - [x] Flujo completo de solicitud exclusivo para Kevin.
    - [x] Registro de entrega de fondos (ej. 700 Bs), gasto real rendido (ej. 600 Bs) y cálculo automático de reintegro/cambio (100 Bs).
    - [x] Asignación de comprobante digital obligatorio (depuración a 60 días).
    - [x] Bloqueo de impresión de vale mientras no esté aprobado por Don Osvaldo.
  - [x] **Frontend:**
    - [x] Pantalla de gestión de caja chica para Kevin con cálculo automático de vuelto.
    - [x] Vista simplificada para Don Osvaldo: visualiza únicamente monto final rendido, concepto y comprobante para firmar con un clic.
  - [x] **Tests:**
    - [x] Test: entrega de 700 Bs con gasto de 600 Bs exige reintegro de 100 Bs y registra egreso de 600 Bs.
    - [x] Test: vale no permite impresión ni descarga mientras `aprobacion_gerencia != 'APROBADO'`.

---

## FASE 4: PANEL GERENCIAL Y CONSOLIDACIÓN FINANCIERA (1 Subagente)

### Subagente F: Módulo 6 (Panel Gerencial Don Osvaldo) y Módulo 9 (Bancos y Saldos)
- **Dependencias:** Fases 1, 2 y 3 completadas.
- **Tablas Propias:** `CuentaBancariaEmpresa`, `FirmaDigitalDocumento`, vistas analíticas gerenciales.
- **Entregables:**
  - [ ] **Backend:**
    - [ ] Panel de control gerencial optimizado de alto rendimiento para Don Osvaldo.
    - [ ] Buscador numérico global (`/api/gerencia/buscar-reporte?codigo=2208`).
    - [ ] Registro de firma/sello digital de Gerencia para autorizaciones masivas.
    - [ ] Registro referencial de movimientos en los 3 bancos de la empresa (MSC para choferes, Unión para distribuidores/supermercados, BNB).
    - [ ] Reporte financiero consolidado con saldos de materia prima y producto terminado (vía `PlantaDataReader` en solo lectura).
  - [ ] **Frontend:**
    - [ ] Dashboard gerencial minimalista, rápido y con tarjetas ejecutivas.
    - [ ] Buscador prominente por código numérico.
    - [ ] Módulo referencial de bancos y saldos conciliados.
  - [ ] **Tests:**
    - [ ] Test: búsqueda por código 2208 retorna de inmediato el reporte o comprobante exacto.
    - [ ] Test: consolidación de saldos de planta se genera sin emitir sentencias de escritura.

---

## FASE 5: CIERRE, LIMPIEZA CONTROLADA Y ENTREGA FINAL
- **Dependencias:** Fases 1 a 4 verificadas con pruebas p2p en verde.
- **Dueño:** Agente Principal.
- **Entregables:**
  - [ ] Ejecución del script de limpieza selectiva de datos de prueba en módulos de Kevin (únicamente tras confirmación explícita por escrito).
  - [ ] Auditoría de base de datos verificando integridad referencial y ausencia de datos huérfanos.
  - [ ] Redacción y publicación de `CAMBIOS.md` detallando cada componente y tabla implementada.
  - [ ] Verificación final de la guardia de zona protegida en verde.

---

## INTEGRACIONES PENDIENTES CON PLANTA
Para consultar el detalle de todos los puntos de integración que quedan deliberadamente fuera de la escritura directa en planta, consultar [`docs/context/INTEGRACIONES_PLANTA.md`](docs/context/INTEGRACIONES_PLANTA.md).
