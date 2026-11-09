# AGENT RULES - SISTEMA BLANQUITA
*Reglas Estrictas de Operación y Desarrollo para Agentes y Subagentes*

---

## 1. REGLAS PERMANENTES DE ARQUITECTURA

### 1.1 ZONA PROTEGIDA: Planta de Fabricio (DDL Blindado y DML Restringido por Adaptador)
Los módulos de planta y producción son desarrollados y mantenidos por otro integrante del equipo (Fabricio).
- **Alcance Protegido:** Órdenes/recetas de fabricación, materia prima (bobina papel, bobina servilleta, rodelas, empaques, tubos), producción de tubos y servilletas, pausas y cancelaciones de producción, inventario de producto terminado de planta, mermas de planta y despacho de fábrica.
- **Acciones Estrictamente Prohibidas (DDL y Archivos):**
  - Ejecutar `ALTER`, `DROP`, `RENAME`, o `TRUNCATE` sobre cualquier tabla de planta.
  - Modificar archivos en carpetas protegidas:
    - Backend: `app/Models/Bobina*`, `app/Models/Empaque`, `app/Models/Pallet`, `app/Models/Rodela`, `app/Models/InventarioFinal`, `app/Repository/Bobina*`, `app/Repository/Empaque`, `app/Repository/Pallet`, `app/Repository/Rodela`, `app/Repository/InventarioFinal`, `app/Routes/Bobina*`, `app/Routes/Empaque`, `app/Routes/Pallet`, `app/Routes/Rodela`, `app/Routes/InventarioFinal`, `functionsServilleta.sql`, `reportsFunctions.sql`.
    - Frontend: `src/components/PapelBobina`, `src/components/ServilletaBobina`, `src/components/Rodela`, `src/components/Empaque`, `src/components/InventarioProductos`, `src/pages/encargado`, `src/pages/operador`.
  - Alterar sus rutas, controladores, permisos o navegación.
- **DML Restringido y Arquitectura de Adaptador:**
  - **Materia prima, recetas y producción:** Son estrictamente **SOLO LECTURA**.
  - **`InventarioProductoTerminado` y `MovimientoProductoTerminado`:** La escritura (`UPDATE` de descuento de stock / `INSERT` de egreso por despacho) está **PERMITIDA EXCLUSIVAMENTE a través de `FabricioLegacyAdapter`** (implementando `InventarioProductoTerminadoPort`).
  - Queda terminantemente prohibido que cualquier otro archivo, servicio o controlador ejecute queries SQL o llamadas ORM sobre estas tablas.
  - **Unidad de Trabajo Única:** El adaptador **NUNCA ejecuta `commit()` ni `rollback()`**. La transacción completa la orquesta el servicio despachador (`EnviosService`), garantizando atomicidad total entre la planta, el envío y la sucursal.
  - **Single Source of Truth para Sucre:** Queda prohibido crear tablas duplicadas como `inventario_planta_sucre`. Para la Planta Sucre, la tabla `InventarioProductoTerminado` de Fabricio ES el inventario físico real.
  - **Control de Doble Descuento:** La deducción física opera detrás del interruptor `DESCONTAR_PLANTA_ACTIVO` (default `false`) y registra `descuento_planta_aplicado (bool)` en cada registro de `envios_inventario` para su reconciliación.

### 1.2 Una Sola Base de Datos Principal: Adaptar, No Duplicar
- El esquema real de la base de datos PostgreSQL (Supabase) prevalece sobre cualquier nombre sugerido.
- Si ya existe una tabla equivalente fuera de la zona protegida (`Usuario`, `Rol`, `Cliente`, `NotaVenta`, `PrecioProducto`, `CuentaCobrar`, `RutaDistribucion`, `Caja`, `Planilla`...), **se extiende con migraciones aditivas**.
- Toda columna nueva debe ser `NULLABLE` o contar con un `DEFAULT` compatible, incluyendo backfill de datos históricos hacia la sucursal de Sucre.
- Se pueden crear nuevas tablas, índices, vistas y jobs. **Queda estrictamente prohibido borrar o renombrar tablas o columnas existentes**.
- El catálogo de productos (`Producto`), al ser compartido con planta, no se altera estructuralmente: se deben utilizar **tablas satélite** (ej. `ProductoConfigComercial` con `EsBandeo`, `ValorBandeo`, `ActivoVenta`).

### 1.3 Manejo Riguroso de Dinero y Fechas
- **Dinero:** Siempre en tipo `decimal` / `Numeric(12,2)` o equivalente en Python (`Decimal`). Nunca usar `float` para montos monetarios. Moneda base: Bolivianos (Bs) con 2 decimales. Redondeo formal mitad hacia arriba (*half-up*) únicamente al final de la operación.
- **Fechas y Horas:** Siempre en tipos `date` o `timestamp with time zone` / `datetime` en zona horaria oficial `America/La_Paz` (UTC-4). Queda prohibido almacenar fechas como enteros o cadenas sin normalizar. En cálculos de antigüedad laboral y finiquito se debe usar diferencia exacta de fechas calendario (sin aproximaciones de 365.25 días).

### 1.4 Memoria Persistente y Documentación
- Todo lo que un subagente o sesión futura necesite saber debe quedar documentado en los archivos correspondientes de `docs/context/` y `docs/progress/`.
- Ningún subagente debe depender de información efímera de la conversación.

---

## 2. PROTOCOLOS OBLIGATORIOS PARA SUBAGENTES

### 2.1 Protocolo de Arranque
Antes de escribir cualquier línea de código, el subagente DEBE:
1. Leer `AGENTS.md`.
2. Leer `ARCHITECTURE.md` y `ROADMAP.md`.
3. Leer `AGENT_RULES.md` (este documento).
4. Leer su **brief individual asignado** en `docs/context/briefs/SUBAGENTE_X.md`.
5. Si el código fuente real contradice algún documento, **prevalece el código fuente real**, notificándolo y actualizando el documento correspondiente.

### 2.2 Protocolo de Cierre de Tarea
Al finalizar cualquier tarea o sprint:
1. Marcar los checkboxes `[x]` que correspondan **únicamente a su sección** en `ROADMAP.md`.
2. Actualizar `docs/context/DB_ESQUEMA.md` y `ARCHITECTURE.md` en caso de haber incorporado o extendido tablas o columnas.
3. Registrar una nueva entrada al final de `docs/progress/LOG.md` con el formato append-only estándar.
4. Si la tarea queda incompleta o requiere pase de guardia a otro turno/agente, redactar el `HANDOFF` en base a la plantilla `docs/progress/HANDOFF_TEMPLATE.md`.
5. Asegurar que las suites de pruebas unitarias/integración pasen y que la verificación de zona protegida esté en verde.

### 2.3 Filtro de Multi-Sucursal Obligatorio
- Toda consulta, listado, reporte o cálculo relacionado con clientes, inventario comercial, camiones/choferes, precios, pedidos, notas de venta, cuentas por cobrar y flujo de caja **debe incluir el filtro `sucursal_id`** basado en el contexto del usuario autenticado.
- La validación del aislamiento por sucursal debe ejecutarse en el Backend y corroborarse en el Frontend.
- Los usuarios con rol `GerenteGeneral` o `Administrador` tienen capacidad de conmutar o consultar todas las sucursales; los usuarios de sucursal (`Contador`, `Supervisor`, `Chofer`) están estrictamente restringidos a su `sucursal_id`.

### 2.4 Reutilización de Componentes y Servicios Transversales
Queda terminantemente prohibido reimplementar librerías o utilitarios particulares. Los subagentes deben consumir los servicios oficiales de la Fase 1:
- Subida de archivos y drag & drop (`FileStorageService`).
- Componente de firma digital táctil (`FirmaDigital`).
- Notificaciones internas del sistema (`NotificacionesService`).
- Exportación e importación de reportes (PDF / Excel).
- Capa de lectura de planta (`StockProductoFinalReader`, `CatalogoProductosReader`).
- Servicio de auditoría transaccional (`AuditLogService`).

### 2.5 Manejo de Ambigüedades
- Si un requerimiento presenta ambigüedad, el subagente **no se detiene**.
- Aplica un parámetro configurable con el valor por defecto indicado en las especificaciones del negocio.
- Registra inmediatamente el supuesto en `docs/context/SUPUESTOS_Y_DUDAS.md` marcándolo como `ABIERTO` y asignando al responsable de confirmación (Kevin, don Osvaldo, etc.).

### 2.6 Propiedad y Edición de Documentos
- Cada subagente solo puede modificar la sección que le compete de los documentos compartidos (`ROADMAP.md`, `DB_ESQUEMA.md`).
- Los documentos `LOG.md` y `DECISIONES.md` son estrictamente **append-only**: solo se agregan registros al final, jamás se borran ni reordenan entradas anteriores.
