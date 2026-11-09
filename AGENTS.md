# AGENTS.md - Sistema ERP Papelera Blanquita (Sucre y Potosí)

Sistema Integral de Gestión de Producción, Distribución, Ventas y Finanzas para Papelera Blanquita.

## 1. Orden de Inicio Obligatoria
Antes de iniciar cualquier tarea, lee en este orden:
1. `ARCHITECTURE.md` (arquitectura técnica general y matriz de zonas)
2. `ROADMAP.md` (fases, dependencias y tus tareas asignadas)
3. `AGENT_RULES.md` (reglas estrictas y estándares)
4. Tu brief asignado en `docs/context/briefs/SUBAGENTE_X.md`

## 2. Regla de Zona Protegida (Planta de Fabricio) e Integración de Inventario
- **PROHIBICIÓN DDL TOTAL:** Prohibido modificar esquemas, alterar tipos, renombrar columnas o borrar tablas de planta/producción.
- **DML RESTRINGIDO POR ADAPTADOR:** La escritura en tablas de planta está estrictamente limitada a operaciones transaccionales de descuento/salida en `InventarioProductoTerminado` y registro de egreso en `MovimientoProductoTerminado`, ejecutadas **EXCLUSIVAMENTE a través de `FabricioLegacyAdapter`** (implementando `InventarioProductoTerminadoPort`).
- **PROHIBIDO COMMIT EN EL ADAPTADOR:** El adaptador nunca hace commit; la unidad de trabajo la gobierna el servicio orquestador (`EnviosService`).
- **RESTO DE PLANTA:** Materia prima, bobinas, recetas y producción son estrictamente **SOLO LECTURA** (`StockProductoFinalReader`, `CatalogoProductosReader`).
- **RIESGO DE DOBLE DESCUENTO:** El descuento en planta opera bajo el interruptor de seguridad `DESCONTAR_PLANTA_ACTIVO` (default `false`) y registra `descuento_planta_aplicado` en `envios_inventario`.

## 3. Comandos de Verificación y Ejecución
- **Backend Tests:** `cd Blanquita-Backend && .\.venv\Scripts\pytest.exe -v`
- **Backend Lint/Check:** `cd Blanquita-Backend && .\.venv\Scripts\python.exe -m flake8 app/` (o lint configurado)
- **Frontend Dev:** `cd Blanquita-Frontend && npm run dev`
- **Frontend Build Check:** `cd Blanquita-Frontend && npm run build`
- **Guardia Zona Protegida:** `.\.venv\Scripts\python.exe docs/scripts/verificar_zona_protegida.py`

## 4. Índice de Documentación de Contexto (`docs/context/`)
- `README.md`: Índice general y matriz de propiedad de documentos.
- `REQUERIMIENTOS_NEGOCIO.md`: Requerimientos textuales completos del negocio y roles de actores.
- `REGLAS_CALCULO.md`: Fórmulas numéricas exactas (valor hora, faltas, finiquito, revalorización).
- `GLOSARIO.md`: Términos de negocio y su correspondencia técnica y de base de datos.
- `DB_ESQUEMA.md`: Esquema real actual, tabla de mapeo de nombres y modificaciones por módulo.
- `ZONA_PROTEGIDA.md`: Lista exhaustiva de tablas/rutas protegidas y diseño de la guardia.
- `INTEGRACIONES_PLANTA.md`: Puntos de contacto con módulos de planta pendientes de coordinar.
- `SUPUESTOS_Y_DUDAS.md`: Supuestos parametrizables adoptados y dudas pendientes de confirmación.
- `DECISIONES.md`: Registro histórico de decisiones de arquitectura (append-only).
- `TEST_CASES.md`: Casos de prueba de aceptación formal (Dado/Cuando/Entonces).
- `briefs/`: Briefs individuales y autosuficientes para cada subagente (A, B, C, D, E, F).
- `progress/LOG.md`: Bitácora append-only de avances de cada turno y subagente.
- `progress/HANDOFF_TEMPLATE.md`: Plantilla de relevo y traspaso de turno entre agentes.

## 5. Protocolo de Cierre
Al terminar tu tarea: actualiza tus checkboxes en `ROADMAP.md`, registra tu entrada en `docs/progress/LOG.md`, actualiza `docs/context/DB_ESQUEMA.md` si hubo cambios en base de datos, y llena un handoff si quedan pendientes.
