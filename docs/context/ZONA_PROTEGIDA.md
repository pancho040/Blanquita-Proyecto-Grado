# ZONA PROTEGIDA - MÓDULOS DE PLANTA Y PRODUCCIÓN
*Regla de Seguridad Absoluta para Todos los Agentes y Subagentes*

---

## 1. DECLARACIÓN DE PROTECCIÓN
Los módulos de planta y producción son desarrollados de forma autónoma por otro integrante del equipo (Fabricio). Cualquier cambio accidental en estos archivos o esquemas corrompería las órdenes de fabricación, pesajes y mermas de planta.

**REGLA DE ORO:**
1. **Inmutabilidad Estructural (DDL):** Está estrictamente prohibido alterar la estructura de cualquier tabla de planta (prohibido `ALTER`, `DROP`, `RENAME`, `TRUNCATE`, cambiar tipos o borrar columnas).
2. **Operabilidad DML Restringida por Adaptador:** Solo las tablas `InventarioProductoTerminado` y `MovimientoProductoTerminado` admiten operaciones DML de descuento de inventario y registro de egreso, y están **autorizadas EXCLUSIVAMENTE a través de `FabricioLegacyAdapter`** (`app/adapters/planta_fabricio_adapter.py`). Queda terminantemente prohibido que cualquier otro archivo, servicio o controlador escriba en ellas.
3. **Resto de Tablas de Planta:** Materia prima, bobinas, recetas y producción son estrictamente **SOLO LECTURA**.

---

## 2. LISTA EXACTA DE TABLAS PROTEGIDAS EN BASE DE DATOS

Bajo ninguna circunstancia se emitirán comandos `ALTER`, `DROP`, `RENAME`, `TRUNCATE`, `UPDATE` o `DELETE` sobre las siguientes tablas:

### Materias Primas y Lotes
1. `public.TipoBobina`
2. `public.EstadoMateriaPrima`
3. `public.LoteBobina`
4. `public.BobinaPapel`
5. `public.MovimientoBobina`
6. `public.TipoBobinaServilleta`
7. `public.FormatoSubBobina`
8. `public.TipoMedidaSubBobina`
9. `public.LoteBobinaServilleta`
10. `public.BobinaServilleta`
11. `public.UnidadBobinaServilleta`
12. `public.SubBobinaServilleta`
13. `public.MovimientoSubBobina`
14. `public.LoteRodela`
15. `public.TipoRodela`
16. `public.Rodela`
17. `public.MovimientoRodela`
18. `public.LoteEmpaque`
19. `public.TipoEmpaque`
20. `public.Empaque`
21. `public.MovimientoEmpaque`
22. `public.TipoMovimientoMateriaPrima`

### Producción de Fábrica
23. `public.EstadoProduccion`
24. `public.ProduccionBobinaTubo`
25. `public.ProduccionServilleta`
26. `public.PausaProduccionBobinaTubo`
27. `public.PausaProduccionServilleta`
28. `public.CancelacionProduccionBobinaTubo`
29. `public.CancelacionProduccionServilleta`

### Insumos, Empaques Secundarios e Inventario de Planta
30. `public.TipoInsumo`
31. `public.MovimientoInsumo`
32. `public.InventarioInsumo`
33. `public.TipoEmpaqueBolsa`
34. `public.MovimientoEmpaqueBolsa`
35. `public.InventarioEmpaqueBolsa`
36. `public.TipoBolsaJava`
37. `public.MovimientoBolsaJava`
38. `public.InventarioBolsaJava`
39. `public.TipoMovimientoInventario`
40. `public.MovimientoProductoTerminado`
41. `public.InventarioProductoTerminado`
42. `public.TipoMovimientoOperadorLogs`
43. `public.MovimientoOperadorLogs`

---

## 3. LISTA EXACTA DE CARPETAS Y ARCHIVOS PROTEGIDOS

### Backend (`Blanquita-Backend/`)
- `app/Models/BobinaPapel/**`
- `app/Models/BobinaServilleta/**`
- `app/Models/Empaque/**`
- `app/Models/Pallet/**`
- `app/Models/Rodela/**`
- `app/Models/InventarioFinal/**`
- `app/Repository/BobinaPapel/**`
- `app/Repository/BobinaServilleta/**`
- `app/Repository/Empaque/**`
- `app/Repository/Pallet/**`
- `app/Repository/Rodela/**`
- `app/Repository/InventarioFinal/**`
- `app/Routes/BobinaPapel/**`
- `app/Routes/BobinaServilleta/**`
- `app/Routes/Empaque/**`
- `app/Routes/Pallet/**`
- `app/Routes/Rodela/**`
- `app/Routes/InventarioFinal/**`
- `app/Services/BobinaPapel/**`
- `app/Services/BobinaServilleta/**`
- `app/Services/Empaque/**`
- `app/Services/Pallet/**`
- `app/Services/Rodela/**`
- `app/Services/InventarioFinal/**`
- `functionsServilleta.sql`
- `reportsFunctions.sql`

### Frontend (`Blanquita-Frontend/`)
- `src/components/PapelBobina/**`
- `src/components/ServilletaBobina/**`
- `src/components/Rodela/**`
- `src/components/Empaque/**`
- `src/components/InventarioProductos/**`
- `src/pages/encargado/**`
- `src/pages/operador/**`

---

## 4. INTEGRACIÓN OPERATIVA Y LECTURA PERMITIDA

### 4.1 Adaptador Oficial de Escritura (`FabricioLegacyAdapter`)
- **Ubicación:** `Blanquita-Backend/app/adapters/planta_fabricio_adapter.py`
- **Operaciones Autorizadas:**
  1. `descontar_stock_despacho(session, planta_id, presentacion_id, cantidad, usuario_id, guia)`: Ejecuta `UPDATE` atómico condicional (`CantidadActual >= cantidad`) en `InventarioProductoTerminado` e inserta fila en `MovimientoProductoTerminado` con `IdTipoMovimientoInventario = 2` ('Salida').
  2. `reintegrar_stock_anulacion(session, planta_id, presentacion_id, cantidad, usuario_id, guia)`: En caso de anulación de envío en tránsito, reintegra stock con `UPDATE` e inserta en `MovimientoProductoTerminado` con tipo `5` ('Ajuste Positivo').
- **Reglas de Seguridad del Adaptador:**
  - Valida que `planta_id` pertenezca a `FABRICIO_LEGACY` (rechaza cualquier otra).
  - **NUNCA ejecuta `commit()` ni `rollback()`**: la sesión es gobernada por el orquestador (`EnviosService`).
  - Opera bajo el interruptor de seguridad `DESCONTAR_PLANTA_ACTIVO` (default `false`) y registra `descuento_planta_aplicado` en `envios_inventario` para su posterior conciliación.

### 4.2 Capa de Lectura Segura de Planta (`PlantaDataReader`)
Para cualquier necesidad de visualización analítica (consultar saldos de bobinas para el balance o catálogo de productos):
- `PlantaDataReader.obtener_stock_producto_terminado(id_producto)`
- `PlantaDataReader.obtener_catalogo_productos()`
- `PlantaDataReader.obtener_saldos_materia_prima()`

---

## 5. DISEÑO DE LA GUARDIA AUTOMÁTICA (`verificar_zona_protegida.py`)

Al inicio de la Fase 1 se implementará el script de guardia en `docs/scripts/verificar_zona_protegida.py`. Este script se integrará en el pipeline de tests y CI para impedir commits que vulneren la zona protegida.

### Lógica de Verificación del Script (Inspección AST y Regex):
1. **Inspección de Archivos Protegidos (`git diff`):**
   - Comprueba si alguna ruta modificada coincide con las carpetas o archivos protegidos de la Sección 3.
2. **Inspección de Sentencias DDL:**
   - Prohíbe cualquier `ALTER`, `DROP`, `RENAME`, o `TRUNCATE` sobre las 43 tablas de planta en cualquier script o migración de Alembic.
3. **Inspección AST de Escritura DML sobre Producto Terminado:**
   - Analiza el Árbol de Sintaxis Abstracta (AST) de Python y regex en todo el backend:
   - Comprueba que **ningún archivo fuera de `app/adapters/planta_fabricio_adapter.py`** importe ni ejecute sentencias `.add()`, `.query()`, `update()`, `delete()` o SQL en crudo sobre `InventarioProductoTerminado` o `MovimientoProductoTerminado`.
   - Si detecta llamadas de escritura fuera del adaptador, el script aborta inmediatamente con código de salida `1`.

### Cómo Ejecutar la Guardia:
```bash
# Desde la raíz del repositorio:
.\Blanquita-Backend\.venv\Scripts\python.exe docs/scripts/verificar_zona_protegida.py
```
*Si la guardia arroja código 0, la zona protegida se encuentra 100% íntegra.*
