# CONTEXTO DEL SISTEMA BLANQUITA (`docs/context/`)

Este directorio contiene la documentación maestra, formal y persistente del sistema de gestión para Papelera Blanquita (Sucre y Potosí). Toda la información necesaria para el desarrollo de cualquier fase o subagente se encuentra centralizada aquí, eliminando la dependencia de memoria contextual entre sesiones.

---

## 1. ÍNDICE DE ARCHIVOS Y PROPÓSITO

| Archivo | Propósito Principal | Cuándo se Consulta |
| :--- | :--- | :--- |
| **`README.md`** | Índice del directorio y matriz de propiedad y permisos de edición. | Al ingresar al directorio o antes de editar cualquier archivo de contexto. |
| **`REQUERIMIENTOS_NEGOCIO.md`** | Requerimientos textuales y completos del negocio, personas clave y mapeo módulo-fase. | Antes de diseñar o codificar cualquier funcionalidad de negocio. |
| **`REGLAS_CALCULO.md`** | Fórmulas matemáticas y financieras exactas con ejemplos numéricos reales. | Al implementar o testear cálculos de sueldos, finiquitos, comisiones, notas y revalorizaciones. |
| **`GLOSARIO.md`** | Diccionario de términos del negocio y su traducción a tablas y columnas técnicas. | Al nombrar variables, campos de base de datos, clases y componentes. |
| **`DB_ESQUEMA.md`** | Esquema real actual, tabla de mapeo de nombres y modificaciones por módulo (con Mermaid). | Antes de crear migraciones o ejecutar consultas a la base de datos. |
| **`ZONA_PROTEGIDA.md`** | Lista exacta de tablas, carpetas y rutas de planta protegidas, y diseño de la guardia. | Antes de tocar cualquier migración, modelo, servicio o componente de producción. |
| **`INTEGRACIONES_PLANTA.md`** | Puntos de contacto donde se requiere interacción con planta (solo lectura por ahora). | Al trabajar en despachos, inventario de distribuidores y reportes de saldos. |
| **`SUPUESTOS_Y_DUDAS.md`** | Registro de supuestos parametrizables adoptados y dudas pendientes de confirmación. | Siempre que se detecte una ambigüedad o se configure un parámetro por defecto. |
| **`DECISIONES.md`** | Registro histórico (append-only) de decisiones arquitectónicas y técnicas. | Al tomar decisiones estructurales o justificar descartes técnicos. |
| **`TEST_CASES.md`** | Casos de aceptación formal (Dado / Cuando / Entonces) con valores de prueba. | Al diseñar e implementar suites de tests unitarios y de integración. |
| **`briefs/`** | Carpeta con briefs autosuficientes para cada subagente (`SUBAGENTE_A.md` ... `F.md`). | Al iniciar la ejecución de un subagente específico en su fase respectiva. |

---

## 2. MATRIZ DE PROPIEDAD Y EDICIÓN DE ARCHIVOS

Para evitar conflictos de merge y mantener la integridad documental, cada archivo cuenta con reglas estrictas de propiedad:

| Archivo | Quién Puede Editar | Tipo de Modificación |
| :--- | :--- | :--- |
| `ARCHITECTURE.md`, `AGENT_RULES.md`, `AGENTS.md` | **Agente Principal** | Reescribible |
| `ROADMAP.md` | **Cada subagente su sección**; Agente Principal el resumen global | Reescribible por sección |
| `docs/context/README.md` | **Agente Principal** | Estable / Reescribible |
| `docs/context/REQUERIMIENTOS_NEGOCIO.md` | Solo con orden explícita del usuario | Estable |
| `docs/context/REGLAS_CALCULO.md` | Solo con orden explícita del usuario | Estable |
| `docs/context/GLOSARIO.md` | Solo con orden explícita del usuario | Estable |
| `docs/context/DB_ESQUEMA.md` | **Cada subagente su sección**; Agente Principal la base | Reescribible por sección |
| `docs/context/ZONA_PROTEGIDA.md` | **Agente Principal** | Reescribible |
| `docs/context/INTEGRACIONES_PLANTA.md` | **Agente Principal** | Reescribible |
| `docs/context/SUPUESTOS_Y_DUDAS.md` | **Cualquier agente** (solo agregar filas) | Acumulativo |
| `docs/context/DECISIONES.md` | **Cualquier agente** (solo agregar al final) | Append-only |
| `docs/context/TEST_CASES.md` | **Cualquier agente** (solo agregar casos) | Acumulativo |
| `docs/context/briefs/SUBAGENTE_X.md` | **Agente Principal** | Estable |
| `docs/progress/LOG.md` | **Cualquier agente** (solo agregar al final) | Append-only |
| `docs/progress/HANDOFF_TEMPLATE.md` | **Agente Principal** | Plantilla fija |
