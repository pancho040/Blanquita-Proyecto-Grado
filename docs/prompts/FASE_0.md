Actúa como un Arquitecto de Software Senior. **NO modifiques ningún archivo de código fuente, migración ni configuración existente todavía.** Tu único objetivo en este turno es analizar el repositorio y la base de datos actuales y generar la **documentación maestra de arquitectura, contexto y planificación**, de modo que múltiples subagentes (y sesiones futuras sin memoria) puedan trabajar sobre este proyecto sin conflictos y sin perder contexto.

Los únicos archivos que puedes crear o editar en este turno son documentos `.md` (y carpetas para contenerlos). Si un archivo con el mismo nombre ya existe (ej. `AGENTS.md`, `README.md`), **no lo sobrescribas**: agrega una sección nueva al final.

---

## REGLAS PERMANENTES (aplican a este turno y a todo el proyecto; cópialas a `AGENT_RULES.md`)

1. **ZONA PROTEGIDA: producción e inventario de planta no se tocan.** Módulos de producción, órdenes/recetas, materia prima, inventario de materia prima, inventario de producto terminado/final de planta, mermas de producción y despacho de planta (los desarrolla otro integrante). Prohibido: `ALTER`/`DROP`/`RENAME` de sus tablas, escribir datos desde código nuevo, editar sus archivos, cambiar sus rutas o permisos. Permitido: **solo lectura**, y solo mediante una **capa de lectura única** (ej. `StockProductoFinalReader`, `CatalogoProductosReader`). Las tablas nuevas pueden referenciar tablas de planta con FK `ON DELETE RESTRICT`. Si una función parece necesitar escribir en planta (ej. descontar stock al despachar), **no se implementa**: se registra como "INTEGRACIÓN PENDIENTE CON PLANTA". Ante la duda, una tabla/módulo se trata como PROTEGIDO.
2. **Una sola base de datos principal. Adaptar, no duplicar.** El esquema real manda sobre cualquier nombre sugerido en este prompt. Si ya existe una tabla equivalente fuera de la zona protegida (personal, notas de venta, precios, cuentas por cobrar, rutas, zonas, caja...), **se extiende** con migraciones **aditivas** (columnas nuevas `nullable` o con `default`, más backfill hacia Sucre). Se pueden crear tablas, columnas (en módulos extensibles), índices, vistas y jobs nuevos. Nunca borrar ni renombrar lo existente. El catálogo de productos si es compartido con planta no se altera: usar tablas satélite (ej. `producto_config_comercial` con `es_bandeo`, `valor_bandeo`).
3. **Dinero** en `decimal` (nunca `float`), Bs con 2 decimales, redondeo half-up solo al final. **Fechas** en tipo `date`/`datetime` (nunca número ni texto), zona `America/La_Paz` (UTC-4).
4. **Memoria persistente:** todo lo que un agente necesite saber debe quedar escrito en los documentos de este turno. Ningún agente debe depender de recordar la conversación.

---

## PASO 1: Exploración del proyecto actual

Inspecciona y registra (con evidencia: rutas de archivos, nombres reales):
- Estructura de carpetas, archivos de configuración (`package.json`, `requirements`, `.env.example`, Docker, CI), scripts, tests existentes y cómo se ejecutan, linter/formatter, `git log` reciente (últimos ~30 commits) y ramas.
- **Esquema real de la base de datos por introspección** (Prisma, SQL, migraciones o modelos ORM): todas las tablas, columnas, tipos, `null`/`default`, PK/FK, índices, enums y relaciones.
- Autenticación, roles y permisos actuales: dónde se definen, cómo se verifican en backend y frontend.
- Cómo están construidos los módulos existentes (Personal, Reportes, Cuentas por cobrar/pagar, Notas de venta, Caja chica, Bancos, Precios Producto, Zonas y rutas, Clientes, Despachos, Planta/Inventario, etc.): rutas, controladores/servicios, pantallas, y qué **ya existe** de lo que pide el negocio.
- Mecanismo actual de subida de archivos, notificaciones, generación de PDF/Excel y manejo de estado en el frontend.
- **Clasifica cada tabla y módulo** como `PROTEGIDO` (planta), `EXTENSIBLE` (comercial/contable/RRHH) o `NUEVO` (aún no existe). Ante la duda, `PROTEGIDO`.

---

## PASO 2: Generación de documentos base

Crea esta estructura (sin tocar nada fuera de ella, salvo agregar a `AGENTS.md`/`README.md` si ya existen):

```text
/ARCHITECTURE.md
/ROADMAP.md
/AGENT_RULES.md
/AGENTS.md                      ← índice automático para el agente (ver A.4)
/docs/
  context/
    README.md                   ← índice de este directorio y quién edita qué
    REQUERIMIENTOS_NEGOCIO.md
    REGLAS_CALCULO.md
    GLOSARIO.md
    DB_ESQUEMA.md
    ZONA_PROTEGIDA.md
    INTEGRACIONES_PLANTA.md
    SUPUESTOS_Y_DUDAS.md
    DECISIONES.md
    TEST_CASES.md
    briefs/
      SUBAGENTE_A.md  SUBAGENTE_B.md  SUBAGENTE_C.md
      SUBAGENTE_D.md  SUBAGENTE_E.md  SUBAGENTE_F.md
  progress/
    LOG.md                      ← bitácora append-only
    HANDOFF_TEMPLATE.md
```

### A. Archivos raíz

**A.1 `ARCHITECTURE.md` (La fuente de la verdad técnica para todos los agentes):**
- Stack tecnológico exacto detectado (Frontend, Backend, DB, ORM, librerías de PDF/Excel, manejo de estado, auth, hosting/despliegue, tests).
- **Matriz de zonas** (`PROTEGIDO`/`EXTENSIBLE`/`NUEVO`) de todas las tablas y módulos detectados.
- Resumen del diseño del Esquema de Base de Datos (actual + nuevas tablas y relaciones). Los **nombres exactos** de tablas y columnas (ej. `sucursal_id`, `chofer_id`) van en `docs/context/DB_ESQUEMA.md`; aquí solo el resumen y un enlace. Incluye la **tabla de mapeo "nombre sugerido → nombre real"**.
- Arquitectura Multi-Sucursal (Sucre, Potosí, N sucursales): cómo se filtrarán los datos por `sucursal_id` a nivel de backend/middleware (ej. scope global del ORM o capa de repositorio) y frontend (selector fijo para usuarios de sucursal). Indica qué tablas **no** llevan `sucursal_id` (las protegidas de planta).
- Matriz de Roles y Permisos (Administrador, Don Osvaldo/Gerencia, Kevin/Encargado Contabilidad, Contador de sucursal, Chofer/Vendedor, Despacho, Distribuidor externo) con acciones permitidas: ver, crear, editar, eliminar, aprobar, cerrar, por módulo.
- Servicios transversales reutilizables que se crean en la Fase 1 (con su firma/contrato público: nombre, parámetros, retorno, dónde vivirán):
  a) Servicio de subida de archivos (drag & drop de imágenes de WhatsApp/PDFs, límite de tamaño, compresión) y Cron Job de limpieza automática de archivos a los 2-3 meses (configurable, default 60 días) conservando el registro en BD con `archivo_eliminado=true`.
  b) Motor generador de reportes (PDF con logo/firmas y exportación/importación de Excel; plantillas descargables).
  c) Sistema de notificaciones internas (campana de alertas para cambios de precio, ajustes de notas y movimientos para gerencia) + buscador global de reportes por código numérico.
  d) Componente `FirmaDigital` (canvas táctil en celular, guarda PNG con usuario/fecha/IP).
  e) **Capa de lectura de planta** (solo lectura): `StockProductoFinalReader`, `CatalogoProductosReader`, y la de materia prima/saldos para reportes.
  f) Servicio de auditoría (quién, cuándo, valor anterior/nuevo).
- Convenciones de código detectadas (nombres, estructura de carpetas, estilo de commits) para que los subagentes las sigan.

**A.2 `ROADMAP.md` (Plan de ejecución por fases y asignación de subagentes):**
- Cada tarea entregable con checkbox `[ ]` (pendiente) / `[x]` (hecha), incluyendo por fase: tablas/migraciones, endpoints, pantallas y tests.
- **Cada subagente solo edita su propia sección** del ROADMAP (para evitar conflictos de merge). El agente principal edita el resumen global.
- Una sección "INTEGRACIONES PENDIENTES CON PLANTA" enlazando a `docs/context/INTEGRACIONES_PLANTA.md`.
- Estructura:
  - **Fase 0 (Contexto):** este turno.
  - **Fase 1 (Secuencial - Cimiento Prioritario):** Módulo 1 (Sucursales Potosí/Sucre, Inventario por sucursal y chofer, envíos de fábrica, bandeo, Precios por sucursal con vigencia, revalorización automática de inventario de choferes, resaltado 24h, reportes valorizados e históricos, Roles, servicios transversales a-f, y script de limpieza selectiva de datos de prueba [diseñado, no ejecutado]).
  - **Fase 2 (Paralelo - 3 Subagentes):**
    * Subagente A: Módulo 3 (Repartidores, control diario, cierre de turno con merma/faltante, eliminación de talonario, edición con notificación) y Módulo 7 (Notas de venta NV-501 desde despacho, firmas digitales en celular, motor de Promos).
    * Subagente B: Módulo 4 (Cuentas por cobrar, estado Pendiente de aprobación, QR obligatorio con foto, abonos manuales/Excel, alertas de mora).
    * Subagente C: Módulo 8 (Distribuidores externos Oruro/Tarija/La Paz/Tupiza, edición de pedido por Kevin, bloqueo sin stock).
  - **Fase 3 (Paralelo - 2 Subagentes):**
    * Subagente D: Módulo 2 (Personal asegurado/externo, Planillas Ministerio/Interna, importador Excel asistencia columna AJ, papeletas, adelantos, descuento compartido por "No venta", cálculo exacto de Finiquito por fechas).
    * Subagente E: Módulo 5 (Caja chica con flujo Pendiente -> Aprobado -> Entregado -> Rendido, cálculo de cambio/reintegro, vista resumida para don Osvaldo).
  - **Fase 4 (Paralelo - 1 Subagente):**
    * Subagente F: Módulo 6 (Panel gerencial de don Osvaldo, buscador por código numérico, aprobación con foto de firma/sello) y Módulo 9 (Saldos materia prima/producto terminado [solo lectura], registro referencial de bancos MSC, Unión, BNB).
  - **Fase 5 (Cierre):** limpieza de datos de prueba (solo tras confirmación de Kevin) y `CAMBIOS.md` final.
- Para cada fase: **dependencias** (qué debe estar terminado antes), **archivos/tablas que "posee"** cada subagente y **puntos de choque** entre subagentes con la regla para resolverlos.

**A.3 `AGENT_RULES.md` (Reglas estrictas para subagentes):**
- **Arranque obligatorio:** todo agente o subagente, al iniciar su turno, lee `AGENTS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `AGENT_RULES.md` y el **brief propio** en `docs/context/briefs/`. Si algo contradice el código real, **prevalece el código real** y se corrige el documento.
- **Cierre obligatorio:** al terminar cada tarea, el agente marca los checkboxes de su sección, actualiza `DB_ESQUEMA.md`/`ARCHITECTURE.md` si cambió el esquema, agrega una entrada en `docs/progress/LOG.md` y, si deja trabajo a medias, llena un `HANDOFF` (plantilla en `docs/progress/HANDOFF_TEMPLATE.md`).
- **Zona protegida** (regla permanente 1) y **adaptar la BD principal** (regla 2), con la lista exacta de tablas/rutas protegidas y la guardia automática.
- Prohibido modificar el esquema de base de datos sin actualizar `ARCHITECTURE.md` y `DB_ESQUEMA.md` en el mismo commit. Migraciones aditivas y, si el framework lo permite, reversibles.
- Toda consulta de choferes, inventario, ventas, precios y caja debe incluir el filtro `sucursal_id` según el rol del usuario logueado. Verificar siempre en backend.
- Reutilizar los componentes de subida de comprobantes, notificaciones, firma digital y generación de PDFs definidos en la Fase 1. No reimplementarlos.
- Convenciones de código, manejo de fechas (sin errores de redondeo de Excel: usar tipo fecha y diferencia de fechas del lenguaje/BD) y manejo de decimales para moneda (Bs).
- Todo registro hecho por choferes/vendedores nace `PENDIENTE` y lo aprueba un responsable de la misma sucursal. Auditoría de aprobaciones, ediciones de monto, cambios de precio y eliminaciones.
- Si algo es ambiguo, **no se detiene**: implementa un parámetro configurable con el valor por defecto indicado y lo anota en `SUPUESTOS_Y_DUDAS.md`.
- Un commit por tarea o fase con mensaje claro; tests y lint antes de commitear; la guardia de zona protegida en verde.
- **Dueño de cada archivo** de `docs/context/` (quién puede editarlo) según `docs/context/README.md`; los archivos append-only (`LOG.md`, `DECISIONES.md`) solo se agregan al final, nunca se reescriben.

**A.4 `AGENTS.md` (índice que el agente carga automáticamente en cada sesión):**
Debe ser corto (menos de ~60 líneas) y contener solo: (1) una línea de qué es el proyecto; (2) la orden "Antes de cualquier tarea lee `ARCHITECTURE.md`, `ROADMAP.md`, `AGENT_RULES.md` y tu brief en `docs/context/briefs/`"; (3) la **regla de zona protegida** en 3 líneas; (4) los comandos para correr tests, lint, migraciones y la guardia; (5) un índice de `docs/context/` con una línea por archivo; (6) "Al terminar: actualiza ROADMAP, LOG y esquema". Si `AGENTS.md` ya existe, agrega esto como sección nueva sin borrar nada.

### B. Archivos de contexto persistente en `docs/context/`

**B.1 `README.md`:** índice de la carpeta, para qué sirve cada archivo, **quién puede editarlo** y cuándo se consulta (ver tabla en B.11).

**B.2 `REQUERIMIENTOS_NEGOCIO.md`:** guarda **textualmente** el bloque "REQUERIMIENTOS COMPLETOS DEL NEGOCIO" y el "ANEXO" de más abajo, sin resumir ni perder datos. Agrega al inicio una tabla de personas y roles de negocio (Kevin, don Osvaldo, Leslie, Carlos y María, choferes, distribuidores externos, Fabricio como integrante de planta) y una tabla "módulo → subagente → fase". Debe poder reemplazar a esta conversación como fuente del negocio.

**B.3 `REGLAS_CALCULO.md`:** todas las fórmulas con ejemplos numéricos de la entrevista (ver ANEXO). Es la base para los tests. Incluye valor hora, días faltados, horas a favor, finiquito y revalorización.

**B.4 `GLOSARIO.md`:** términos del negocio y su equivalente técnico (ej. bandeo, megarrollo, Ecopack, jaba, nota de venta/entrega, rendición, Gestora, finiquito, asegurado/externo, repartidor/chofer, revalorizar, mora, caja chica, cierre de turno, Contagen, QR, distribuidor, sucursal), con el nombre de tabla/columna correspondiente.

**B.5 `DB_ESQUEMA.md`:** tres secciones: (1) **esquema real actual** por introspección; (2) **tabla de mapeo** nombre sugerido → nombre real; (3) **esquema nuevo/modificado por módulo**, con nombre exacto de tabla, columna, tipo, `null`/`default`, FK, índices y enums de estado. Marca cada cambio como `NUEVA TABLA`, `COLUMNA NUEVA` o `SIN CAMBIO`. Incluye el **diagrama de relaciones** (Mermaid) de la Fase 1. Los subagentes agregan aquí sus cambios, **cada uno en su propia sección**.

**B.6 `ZONA_PROTEGIDA.md`:** lista exacta de tablas, carpetas y archivos protegidos; la capa de lectura permitida; el **diseño de la guardia automática** (script que falla si `git diff` toca archivos protegidos o si una migración nueva contiene `ALTER/DROP/RENAME/UPDATE/DELETE/TRUNCATE` sobre una tabla protegida) y cómo ejecutarla. *Solo se diseña ahora; se implementa al inicio de la Fase 1.*

**B.7 `INTEGRACIONES_PLANTA.md`:** cada punto donde el negocio requiere coordinar con planta y **no se implementa por ahora**: descuento de stock de producto terminado al despachar o enviar a sucursal, nota de entrega proveniente de despacho (de otro integrante), stock disponible para validar pedidos de distribuidores, saldos de materia prima/producto terminado para estados financieros. Para cada uno: qué se lee hoy, qué faltaría escribir, quién lo coordina y propuesta de contrato (interfaz/endpoint/evento).

**B.8 `SUPUESTOS_Y_DUDAS.md`:** tabla con: nº, tema, supuesto adoptado (valor por defecto y parámetro configurable), estado (`ABIERTO`/`CONFIRMADO`), responsable de confirmar. Precárgala con la lista del ANEXO sección 4 y con cualquier ambigüedad que detectes.

**B.9 `DECISIONES.md`:** registro append-only de decisiones de arquitectura (formato: fecha, decisión, motivo, alternativas descartadas, impacto). Precárgalo con las decisiones que tomes en este turno (ej. enfoque multi-sucursal, estrategia de extensión de tablas, tablas satélite para productos).

**B.10 `TEST_CASES.md`:** casos de aceptación por módulo (Dado/Cuando/Entonces) con los datos numéricos del ANEXO, más los criterios de aceptación de la Fase 1: crear una tercera sucursal con 2 choferes sin tocar código; cambiar precio en Potosí no afecta Sucre; cambiar precio revaloriza inventario de choferes y genera notificación e historial; un `CONTADOR_SUCURSAL` de Potosí no ve datos de Sucre; la guardia de zona protegida pasa.

**B.11 Propiedad de archivos:**

| Archivo | Edita | Tipo |
| :--- | :--- | :--- |
| `ARCHITECTURE.md`, `AGENT_RULES.md`, `AGENTS.md` | Agente principal | Reescribible |
| `ROADMAP.md` | Cada subagente su sección; principal el resumen | Reescribible por sección |
| `REQUERIMIENTOS_NEGOCIO.md`, `REGLAS_CALCULO.md`, `GLOSARIO.md` | Solo con orden del usuario | Estable |
| `DB_ESQUEMA.md` | Cada subagente su sección | Reescribible por sección |
| `ZONA_PROTEGIDA.md`, `INTEGRACIONES_PLANTA.md` | Agente principal | Reescribible |
| `SUPUESTOS_Y_DUDAS.md`, `TEST_CASES.md` | Cualquiera (solo agrega filas) | Acumulativo |
| `DECISIONES.md`, `progress/LOG.md` | Cualquiera (solo al final) | Append-only |
| `briefs/SUBAGENTE_X.md` | Agente principal | Estable |

### C. Briefs de subagentes (`docs/context/briefs/SUBAGENTE_A.md` … `F.md`)

Un archivo por subagente, **autosuficiente** (el subagente puede trabajar leyendo solo sus archivos obligatorios). Cada brief contiene:
1. **Misión** en 3 líneas y fase en la que corre.
2. **Módulos y requisitos** asignados (copiados con detalle desde `REQUERIMIENTOS_NEGOCIO.md`, no solo enlazados).
3. **Tablas y archivos que posee** (puede crear/editar) y **tablas/archivos que solo puede leer o consumir** (de otros subagentes o de la Fase 1).
4. **Servicios transversales que debe reutilizar** (subida de archivos, notificaciones, PDF/Excel, firma, auditoría, capa de lectura de planta).
5. **Zona protegida:** lo que tiene prohibido tocar y los puntos de integración con planta que le conciernen.
6. **Dependencias:** qué debe estar completo antes de arrancar.
7. **Puntos de choque** con otros subagentes y cómo resolverlos.
8. **Entregables** con checkboxes, **tests obligatorios** y **criterios de aceptación** (referencia a `TEST_CASES.md` y `REGLAS_CALCULO.md`).
9. **Cierre:** qué documentos debe actualizar al terminar y qué dejar en `HANDOFF`.

### D. Bitácora (`docs/progress/`)

- `LOG.md`: encabezado + una primera entrada de este turno con fecha, agente, resumen de lo hecho y los archivos creados. Formato fijo para cada entrada: `fecha | agente/subagente | fase | qué se hizo | archivos/migraciones | pendientes`.
- `HANDOFF_TEMPLATE.md`: plantilla corta (estado actual, qué falta, decisiones tomadas, bloqueos, comandos para retomar).

---

## REQUERIMIENTOS COMPLETOS DEL NEGOCIO A INTEGRAR EN EL DISEÑO

- **Prioridad 1 (Sucursales e Inventario Potosí):** Entidad Sucursal (nombre, ciudad, activo/inactivo) ligada a rutas, zonas, usuarios, choferes, inventario y precios. Cargar Sucre y Potosí dinámicamente (no hardcodear; N sucursales, N camiones, N vendedores). Filtros por sucursal. Inventario independiente por sucursal y por chofer (sin límite, con precio vigente). Envíos fábrica -> sucursal -> chofer -> descuento por venta/entrega y bandeo (servilleta de regalo). Carga por pantalla o Excel. Precios por sucursal con fecha "vigente a partir de", revalorización automática del stock de choferes al cambiar precio, historial de cambios, resaltado en rojo (24h) y notificación al admin. Reporte actual valorizado e histórico a fecha pasada (ej. 31 oct). Roles de contabilidad (Encargado de Contabilidad y Contador de sucursal) y limpieza de datos de prueba en módulos de Kevin. Este inventario es el **comercial/de distribución** y es independiente del inventario de planta.
- **Módulo 2 (Personal y Planillas):** Pestañas Asegurado y Externo. Campos: ingreso, retiro, contrato, asegurado, área, sucursal. Planilla Excel/PDF (versión Ministerio/Caja solo con descuentos de ley de Gestora configurable, y versión General interna con horas extra de fábrica, faltas, permisos, adelantos, faltantes de cobro y descuentos por "No venta" compartidos entre vendedores). Papeleta de pago con 2 copias. Finiquito habilitado a los >=3 meses con cálculo exacto por fechas y formato Ministerio. Importador del Excel de asistencia de don Osvaldo leyendo columna AJ ("horas trabajadas" y negativos como faltas).
- **Módulo 3 y 7 (Repartidores y Notas de Venta):** Cierre de turno diario comparando stock físico vs sistema (merma/faltante el mismo día). Notas de venta desde despacho (NV-501) con datos de transporte, precios automáticos, pagos parciales (efectivo/QR/abono), promociones automáticas (1 megarrollo = 1 servilleta) o manuales, firma digital en celular obligatoria para cerrar envío, y botón Editar para Kevin con ajuste y notificación al chofer. La nota de despacho proviene de un módulo de planta (zona protegida): se consume en solo lectura o se ofrece carga manual, y se anota como integración pendiente.
- **Módulo 4 (Cuentas por cobrar y QR):** Todo registro de chofer nace "Pendiente" hasta aprobación de Kevin/encargado de sucursal. Foto de comprobante QR obligatoria (drag & drop desde WhatsApp). Eliminación automática de fotos a los 2-3 meses manteniendo el registro. Abonos manuales/Excel y alerta de mora.
- **Módulo 5 (Caja chica):** Solo Kevin solicita. Flujo: Pendiente -> Aprobado (don Osvaldo) -> Entregado -> Rendido (con comprobante y cálculo de cambio/vuelto). Impresión bloqueada hasta aprobación. Fotos se borran a los 2 meses.
- **Módulo 6, 8 y 9 (Gerencia, Distribuidores y Bancos):** Panel simplificado para don Osvaldo con buscador de reportes por código numérico (ej. 2208) y firma/sello. Rol Distribuidor externo (Oruro, Tarija, La Paz, Tupiza) que solo pide sobre stock real (lectura de planta), Kevin edita cantidades y el distribuidor sube comprobante. Reporte de materia prima/producto terminado (solo lectura) y 3 bancos referenciales (MSC, Unión, BNB).

## ANEXO: REGLAS DE CÁLCULO, CASOS DE PRUEBA Y SUPUESTOS (guardar en los archivos B.2, B.3, B.8 y B.10)

**1. Fórmulas y ejemplos de la entrevista**
- Valor hora = `sueldo / 30 / 8`. Ejemplo: `3300 / 30 / 8 = 13.75`; 1,5 horas a favor ≈ 20 Bs.
- Días faltados (trabajo normal): negativos en el Excel de asistencia son días faltados. Ejemplo: 7 faltas → `30 − 7 = 23` días pagables; pago = `sueldo/30 × 23` + horas a favor.
- Personal por horas: columna AJ = "horas trabajadas" (sin distinguir mayúsculas/acentos) → `pago = horas × valor_hora`. Ejemplo: 163 horas con mínimo 3.300.
- Planilla: dos cifras. **Oficial** (Ministerio/Gestora): total ganado menos descuentos de ley. **Interna**: más horas extra (solo fábrica) menos faltas, permisos, adelantos, faltantes de cobro y "No venta". Ejemplo: base 2.880 + extras 460,63 − descuento de 1 día → total interno 3.231,20.
- "No venta": ejemplo de 1.185 Bs de una cliente que desapareció + faltante de ventas 66 Bs (33 Bs a cada uno de dos vendedores); a una vendedora además 5 horas de permiso y adelanto de 1.200; total descontado 2.489 en octubre.
- Finiquito: corresponde con 3 meses o más. Antigüedad por diferencia de fechas exacta: ingreso 18/11/2025, retiro 30/10/2026 → **0 años, 11 meses, 12 días**. Base: últimos 3 salarios (ej. 3.400 cada uno). Fórmula (a confirmar): `promedio_3m / 12 × meses + promedio_3m / 12 / 30 × días`.
- Revalorización: el inventario restante de choferes se valoriza al nuevo precio desde "vigente a partir de"; lo ya vendido conserva su precio. Ejemplo de ajuste: inventario de 4.000 Bs más ajuste de +48 = 4.048.
- Nota de venta: cantidad × precio vigente (ej. 4 megarrollos × 40 = 160). Promo: 1 megarrollo = 1 servilleta de bandeo.
- Caja chica: se entregan 700, se gastan 600, reintegran 100; caja refleja egreso de 600; don Osvaldo solo ve el monto final y el comprobante.
- Edición de nota por Kevin: "registró 200, recibido 190" → ajuste −10 con notificación al chofer.
- Hábitos de pago de choferes: pagan por partes (ej. venta del día 14.095, pagan 7.600 + 2.700 y el resto queda en saldo).

**2. Contexto del negocio para el glosario**
Empresa productora de papel higiénico y servilletas (marca Blanquita; razón social Seoma Asociados), Sucre y sucursal Potosí. Productos: Megarrollo, servilletas, Ecopack (jaba de 6), papel higiénico. Precio unitario único por producto y sucursal. Bancos: MSC (repartidores), Unión (distribuidores, Alcaldía, supermercados) y BNB; referencial, la API bancaria cobra mensualidad (no se implementa). Hoy todo se compra y vende al contado salvo supermercados (a 30 días, una cuota). Contabilidad actual en el sistema "Contagen" (asientos/libro mayor quedan fuera de alcance por ahora).

**3. Fuera de alcance por ahora**
API bancaria; asientos contables y libro mayor (se pedirán capturas de Contagen); firma digital con USB/sello electrónico; modificar cualquier módulo de planta.

**4. Supuestos a precargar en `SUPUESTOS_Y_DUDAS.md` (todos como parámetros configurables)**
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

---

## ENTREGA DE ESTE TURNO

Confirma cuando hayas leído el repositorio y creado **todos** los archivos listados (raíz, `docs/context/`, `briefs/` y `progress/`). Luego muéstrame:
1. Stack detectado en 5 líneas.
2. La **Matriz de zonas** (qué quedó `PROTEGIDO`, `EXTENSIBLE`, `NUEVO`) y las tablas existentes que se extenderán.
3. Un resumen de la **estructura de base de datos diseñada para la Fase 1** (tablas nuevas, columnas añadidas a tablas existentes con su nombre real, relaciones y estados), idealmente en un diagrama Mermaid.
4. Lista de archivos creados con una línea cada uno.
5. Dudas, riesgos y contradicciones detectadas entre el prompt y el código real.

**No escribas código funcional ni modifiques el esquema todavía.** Espera mi validación antes de iniciar la Fase 1.
