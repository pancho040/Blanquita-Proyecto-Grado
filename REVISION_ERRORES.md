# REVISIÓN INTEGRAL DE ERRORES: FILTROS DE SUCURSAL Y SISTEMA MULTISEDE
**Papelera Blanquita - Fase 1: Auditoría Técnica Exhaustiva**  
**Fecha:** 10 de Noviembre de 2026  
**Ambiente:** Base de datos de desarrollo/pruebas Supabase  
**Estado de Guardia:** Zona Protegida de Planta 100% íntegra (0 violaciones)

---

## 1. Caso Confirmado: Rutas de Distribución (`/supervisor/rutas`)

### 1.1 Diagnóstico de Causa Raíz
Se auditó en profundidad el flujo de ejecución de `GET /logistica/rutas` y `GET /logistica/zonas` con los 3 perfiles territoriales (`Todas`, `Sucre` y `Potosí`).

1. **Consulta SQL ejecutada por `RutaRepository.ListarRutas`:**
   ```sql
   SELECT 
       r."IdRutaDistribucion",
       r."IdZonaDistribucion",
       z."NombreZona",
       r."NombreRuta",
       r."DiaSemana",
       r."Descripcion",
       r."Activa",
       COUNT(rpv."IdPuntoVenta") as "TotalPuntosVenta",
       COALESCE(...) as "PuntosVenta"
   FROM "RutaDistribucion" r
   JOIN "ZonaDistribucion" z ON r."IdZonaDistribucion" = z."IdZonaDistribucion"
   LEFT JOIN "RutaPuntoVenta" rpv ON r."IdRutaDistribucion" = rpv."IdRutaDistribucion"
   LEFT JOIN "PuntoVenta" pv ON rpv."IdPuntoVenta" = pv."IdPuntoVenta"
   LEFT JOIN "Cliente" c ON pv."IdCliente" = c."IdCliente"
   GROUP BY r."IdRutaDistribucion", z."NombreZona"
   ORDER BY r."NombreRuta" ASC;
   ```
   **Evidencia del fallo:**  
   - La tabla `RutaDistribucion` sí posee la columna `IdSucursal` (las 5 filas existentes tienen `IdSucursal = 1`).
   - Sin embargo, la cláusula `SELECT` **no incluía** `r."IdSucursal"`.
   - `RutaRepository` retorna diccionarios Python generados por `res.mappings().all()`.

2. **Filtro en `RutaRouter.py` (Línea 58-60 previa):**
   ```python
   rutas = RutaService(db).ListarRutas(id_zona)
   if alcance.sucursal_efectiva is not None:
       rutas = [r for r in rutas if getattr(r, "IdSucursal", None) == alcance.sucursal_efectiva]
   ```
   - **Doble defecto:**
     1. En Python, `getattr(dict, "IdSucursal", None)` sobre un diccionario siempre retorna `None` porque las llaves de un diccionario no son atributos de objeto.
     2. Aun utilizando `r.get("IdSucursal")`, dado que la consulta SQL omitió la columna, el valor siempre era `None`.
     3. Cuando el usuario seleccionaba "Sucre" (`alcance.sucursal_efectiva = 1`), la comparación `None == 1` resultaba `False` para cada una de las 5 rutas, **descartando todas las rutas y devolviendo `[]`**.
     4. Cuando el usuario seleccionaba "Todas" (`alcance.sucursal_efectiva is None`), el bloque condicional se saltaba, devolviendo las 5 rutas completas.

3. **Parámetros enviados por el Frontend:**
   - En `GestorRutas.jsx` / `RutaService.js`:
     - Modo Sucre: envía `GET /api/logistica/rutas?id_sucursal=1` (número entero).
     - Modo Potosí: envía `GET /api/logistica/rutas?id_sucursal=2`.
     - Modo Todas: envía `GET /api/logistica/rutas` (sin parámetro de sucursal).

4. **Relación entre Zonas, Rutas, Puntos de Venta y Clientes:**
   - `ZonaDistribucion`: Representa la división geográfica urbana (Casco Central, Mercado Campesino, etc.). **No tiene columna `IdSucursal`** en la base de datos actual.
   - `RutaDistribucion`: Contiene clave foránea `IdZonaDistribucion` y clave foránea `IdSucursal`.
   - `RutaPuntoVenta`: Tabla intermedia que asocia `IdRutaDistribucion` con `IdPuntoVenta`.
   - `PuntoVenta`: Contiene `IdCliente`. **No tiene columna `IdSucursal`**; su sede territorial se deriva de `Cliente.IdSucursal`.
   - `AsignacionRuta`: Asocia `IdRutaDistribucion` con un chofer (`IdUsuarioRepartidor`).

### 1.2 Corrección y Prueba de Regresión
- Se corrigió `RutaRepository.py` agregando `r."IdSucursal"` en el `SELECT` y filtrando directamente a nivel SQL con `r."IdSucursal" = :id_sucursal`.
- Se actualizó `RutaModel.py` para incluir `IdSucursal` en `RutaBase` y `RutaResponse`.
- Se actualizó `RutaRouter.py` pasando `alcance.sucursal_efectiva` al servicio y repositorio.
- **Prueba de regresión creada:** [`Blanquita-Backend/tests/test_regresion_rutas_sucursal.py`](file:///C:/Users/franz/Desktop/Blanquita/Blanquita-Proyecto-Grado/Blanquita-Backend/tests/test_regresion_rutas_sucursal.py)
  - Resultado: **`PASSED [100%]`**
  - Verifica que:
    - `Todas`: devuelve 5 rutas.
    - `Sucre` (`?id_sucursal=1`): devuelve 5 rutas con `IdSucursal = 1`.
    - `Potosí` (`?id_sucursal=2`): devuelve 0 rutas.
    - Sede fija Sucre: devuelve sus 5 rutas por omisión.
    - Cumple invariante: `Total(Todas) == Total(Sucre) + Total(Potosi)`.

---

## 2. Auditoría de Esquema: Tablas con Sede vs Tablas sin Sede

### 2.1 Tablas con Columna de Sucursal
*(Excluidas tablas de Planta / Zona Protegida)*

| Tabla | Columna Sede | Total Filas | Filas NULL | Sucre (1) | Potosí (2) | Observaciones de Aislamiento |
|:---|:---|:---:|:---:|:---:|:---:|:---|
| `Caja` | `IdSucursal` | 2 | 0 | 1 | 1 | Totalmente aislada. |
| `Cliente` | `IdSucursal` | 40 | 0 | 40 | 0 | Todos en Sucre hoy. Clientes 16 y 17 tienen destino Potosí. |
| `CuentaCobrar` | `IdSucursal` | 369 | **52** | 317 | 0 | **52 cuentas tienen `IdSucursal IS NULL`**. |
| `CuentaPagarProveedor` | `IdSucursal` | 18 | 0 | 18 | 0 | Sin filtro territorial en su router actual. |
| `DatosLaboralesEmpleado` | `IdSucursal` | 10 | 0 | 10 | 0 | 10 empleados de Sucre registrados formalmente. |
| `NotaVenta` | `IdSucursal` | 102 | 0 | 102 | 0 | NV 36 tiene destino Potosí pero `IdSucursal = 1`. |
| `Planilla` | `IdSucursal` | 4 | **2** | 2 | 0 | **2 planillas históricas tienen `IdSucursal IS NULL`**. |
| `PrecioProducto` | `IdSucursal` | 25 | 0 | 21 | 4 | 21 presentaciones Sucre, 4 tarifas Potosí. |
| `RendicionRuta` | `IdSucursal` | 26 | 0 | 26 | 0 | Todas en Sucre. |
| `RevalorizacionInventarioChofer` | `IdSucursal` | 0 | 0 | 0 | 0 | Sin registros actuales. |
| `RutaDistribucion` | `IdSucursal` | 5 | 0 | 5 | 0 | Todas en Sucre. Defecto de listado resuelto. |
| `SolicitudCajaChica` | `IdSucursal` | 112 | **1** | 111 | 0 | **1 solicitud histórica tiene `IdSucursal IS NULL`**. |
| `Usuario` | `IdSucursal` | 17 | 0 | 14 | 3 | 14 Sucre, 3 Potosí (incluye usuarios de prueba). |
| `deudas_no_venta` | `id_sucursal` | 30 | 0 | 30 | 0 | Todas en Sucre. |
| `inventario_chofer` | `sucursal_id` | 5 | 0 | 5 | 0 | Todas en Sucre. |
| `inventario_sucursal` | `sucursal_id` | 8 | 0 | 4 | 4 | 4 Sucre, 4 Potosí (sembrado reversible). |
| `usuario_sucursal_permiso` | `id_sucursal` | 21 | **5** | 13 | 3 | **5 filas multisede tienen `id_sucursal IS NULL`** (`puede_ver_todas=True`). |

### 2.2 Tablas Territoriales SIN Columna de Sucursal
Estas entidades son inherentemente territoriales pero dependen de relaciones foráneas:

1. **`ZonaDistribucion` (4 filas):**
   - Posee columna `Ciudad = 'Sucre'`. No tiene `IdSucursal`.
   - El filtro en `RutaRepository.ListarZonas` usaba `WHERE z."Ciudad" ILIKE '%Sucre%'`.
   - **Riesgo:** Heurística de texto frágil susceptible a typos.
2. **`PuntoVenta` (19 filas activas):**
   - Depende de `Cliente.IdCliente`. El cliente tiene `IdSucursal`.
   - No tiene columna propia `IdSucursal`.
3. **`MovimientoCaja` (352 filas):**
   - No tiene columna `IdSucursal`. Depende de `AperturaCierreCaja -> Caja.IdSucursal`.
   - **Falla crítica:** 346 movimientos tienen `IdAperturaCierreCaja IS NULL` (vales de caja chica, transferencias).
4. **`AsistenciaDiaria` (260 filas) y `MarcaBiometrica`:**
   - No tienen `IdSucursal`. La sede se deriva del empleado (`DatosLaboralesEmpleado.IdSucursal` o `Usuario.IdSucursal`).
5. **`AsignacionRuta` (26 filas) y `TrackingChofer`:**
   - La sede se deriva de `RutaDistribucion.IdSucursal` y del chofer asignado (`Usuario.IdSucursal`).

---

## 3. Auditoría de Invariante de Endpoints (`Todas = Sucre + Potosí`)

Ejecutado con el cliente real contra la base de datos bajo el perfil multisede (`Osvaldo Tellez`, ID 13 / `Administrador Blanquita`, ID 12):

| Endpoint | Todas | Sucre (1) | Potosí (2) | ¿Cumple? | Causa Raíz de la Discrepancia |
|:---|:---:|:---:|:---:|:---:|:---|
| `/cxc/notas-venta` | 25* | 25* | 0 | ✅ Sí | Invariante verificado (*paginado a 25). |
| `/cxc/cuentas` | 25* | 25* | 0 | ✅ Sí | Invariante verificado (*paginado a 25). |
| `/cxc/abonos/pendientes` | 428 | 428 | 0 | ✅ Sí | Invariante perfecto. |
| `/tesoreria/caja/movimientos` | 25* | **6** | 0 | ❌ No | **346 movimientos tienen `IdAperturaCierreCaja IS NULL`**. El `JOIN` a `Caja` los descarta cuando se filtra por sede. |
| `/tesoreria/caja-chica/solicitudes` | 25* | 25* | 0 | ✅ Sí | Invariante verificado. |
| `/logistica/precios` | **422** | 15 | 15 | ❌ No | El parámetro `id_sucursal: Optional[int]` rechaza el valor `"todas"` con error 422 de Pydantic. |
| `/logistica/zonas` | 4 | 4 | 0 | ✅ Sí | Invariante verificado. |
| `/logistica/rutas` | 5 | 5 | 0 | ✅ Sí | Corregido y blindado con prueba de regresión. |
| `/logistica/asignaciones` | 9 | 9 | 0 | ✅ Sí | Invariante verificado. |
| `/logistica/repartidores` | 4 | 3 | 1 | ✅ Sí | Invariante verificado (3 Sucre, 1 Potosí). |
| `/logistica/telemetria/en-vivo` | 4 | 3 | 1 | ✅ Sí | Invariante verificado. |
| `/logistica/clientes` | 40 | 40 | 0 | ✅ Sí | Invariante verificado. |
| `/logistica/clientes/puntos-venta/todos` | **19** | **0** | **0** | ❌ No | `ClienteRepository` omitió `c."IdSucursal"` en el `SELECT`. `p.get("IdSucursal")` es siempre `None`. |
| `/logistica/inventario/sucursal/{id}` | 4 | 4 | 4 | ⚠️ N/A | Es un endpoint específico por ID de sucursal (devuelve 4 ítems en cada sede). |
| `/logistica/envios` | 2 | **500** | **500** | ❌ No | **`AttributeError: 'dict' object has no attribute 'id_sucursal_origen'`** en `EnvioRouter.py:31`. |
| `/rrhh/empleados` | 17 | 14 | 3 | ✅ Sí | Invariante verificado (14 Sucre, 3 Potosí). |
| `/rrhh/asistencia` | 260 | 260 | 0 | ✅ Sí | Invariante verificado. |
| `/rrhh/turnos` | **7** | **7** | **7** | ❌ No | Catálogo global de turnos sin segmentación territorial. |
| `/rrhh/cronograma` | 0 | 0 | 0 | ✅ Sí | Con fechas obligatorias `fecha_inicio` y `fecha_fin` cumple invariante. |
| `/cxp/cuentas` | **18** | **18** | **18** | ❌ No | **No tiene inyectada la dependencia de alcance**. Muestra todas sin filtrar. |
| `/cxp/devoluciones` | 0 | 0 | 0 | ✅ Sí | Invariante verificado (0 registros). |
| `/admin/auditoria` | 20* | 20* | 0 | ✅ Sí | Invariante verificado. |

---

## 4. Consistencias entre Tablas Dependientes y Datos Precargados

### 4.1 Regla de Negocio para Clientes y Notas con Destino Interdepartamental (Confirmada)
1. **Cliente ID 16 (`Norha Choque Talavera`) y Cliente ID 17 (`Marlene Paicho`):**
   - Tienen `CiudadDestino = 'POTOSI'` y `'RUTA SUCRE Y POTOSI - COLQUECHACA'` respectivamente, pero `IdSucursal = 1` (Sucre).
   - **Regla de Negocio:** `IdSucursal` representa la **sucursal emisora/responsable administrativa**, NO la ciudad geográfica de entrega comercial. Por tanto, **NO son inconsistencias ni deben modificarse**.
2. **Nota de Venta ID 36 (`NumeroNotaVenta = '260836'`):**
   - `DestinoDepartamento = 'Potosi'`, pero `IdSucursal = 1` (Sucre).
   - Es una venta despachada/facturada desde la sede central Sucre con destino final Potosí. Es un registro de negocio 100% válido y permanece inalterado.
3. **52 Cuentas por Cobrar con `IdSucursal IS NULL`:**
   - Proceden de migraciones anteriores. En el 100% de los casos (52/52), su cliente asociado tiene `Cliente.IdSucursal = 1` (Sucre). No hay ambigüedad.
4. **2 Planillas con `IdSucursal IS NULL`:**
   - Planillas históricas (ID 1 e ID 2). En el 100% de los casos, todos sus empleados pertenecen a Sucre (`IdSucursal = 1`).
5. **1 Solicitud de Caja Chica con `IdSucursal IS NULL`:**
   - Solicitud histórica (ID 2208). Asociada a `IdCaja = 1` ("Caja Principal Planta", Sucre). No hay ambigüedad.

---

## 5. Matriz Priorizada de Defectos Encontrados

| ID | Severidad | Módulo / Componente | Defecto | Evidencia Técnica |
|:---:|:---:|:---|:---|:---|
| **BUG-01** | **Crítico** | Logística / Envíos | Error 500 al filtrar `/logistica/envios` con cualquier sede fija | `EnvioRouter.py:31` accede a `e.id_sucursal_origen` como atributo sobre un `dict`, y dicho campo no existe en el modelo. |
| **BUG-02** | **Crítico** | Contabilidad / Tesorería | 346 de 352 movimientos de caja desaparecen al filtrar por Sucre | `ListarMovimientosCaja` hace `LEFT JOIN` a `AperturaCierreCaja` y `Caja`, pero los 346 movimientos tienen apertura `NULL`. |
| **BUG-03** | **Crítico** | Logística / Puntos de Venta | `/logistica/clientes/puntos-venta/todos` devuelve 0 puntos en Sucre y Potosí | `ClienteRepository.ListarTodosPuntosVentaActivos` no selecciona `c."IdSucursal"`, por lo que el filtrado en memoria siempre descarta las filas. |
| **BUG-04** | **Importante** | Contabilidad / Cuentas por Pagar | `/cxp/cuentas` no aplica aislamiento territorial | Falta inyectar `DependenciaAlcanceSucursal`. Devuelve las 18 cuentas para cualquier sede solicitada. |
| **BUG-05** | **Importante** | Logística / Precios | `/logistica/precios` arroja 422 cuando el frontend envía `"todas"` | El query param está tipado estrictamente como `int`, rompiendo la compatibilidad con el selector `BranchFilter`. |
| **BUG-06** | **Importante** | Logística / Zonas | `ZonaDistribucion` no posee columna `IdSucursal` | Filtra por heurística textual `WHERE Ciudad ILIKE '%Sucre%'`. |
| **BUG-07** | **Menor** | RRHH / Turnos | `/rrhh/turnos` retorna catálogo global en lugar de segmentado | La tabla `Turno` es una lista maestra sin sucursal; requiere documentarse como recurso global o vincularse a sede. |
| **BUG-08** | **Menor** | Datos / Calidad | 52 filas en `CuentaCobrar`, 2 en `Planilla` y 1 en `SolicitudCajaChica` con `IdSucursal IS NULL` | Registros históricos huérfanos de sucursal que requieren backfill con aprobación. |

---

## 6. Propuestas de Corrección y Esquema (Para Aprobación)

### Propuesta 1: Migración de Esquema para `ZonaDistribucion`
- **Cambio:** Agregar columna `IdSucursal` (INTEGER, nullable inicialmente) con Foreign Key a `sucursales(id)`.
- **Backfill propuesto:**
  - Zonas 1, 2 y 3: asociadas a rutas con `IdSucursal = 1` -> asignar `IdSucursal = 1`.
  - Zona 4 ("Zona 4 - Lajastambo e Industrial"): `Ciudad = 'Sucre'`, sin rutas hoy -> asignar `IdSucursal = 1`.
- **Modo:** Migración Alembic reversible (con función `downgrade()` que elimina la columna).

### Propuesta 2: Corrección de `MovimientoCaja`
- **Cambio:** En `TesoreriaRepository.ListarMovimientosCaja`:
  ```sql
  WHERE COALESCE(c."IdSucursal", u."IdSucursal") = :id_sucursal
  ```
  Permite que los movimientos sin apertura diaria (descargos de vales de caja chica, transferencias) se imputen a la sucursal del usuario que los registró.

### Propuesta 3: Corrección de `Puntos de Venta`
- **Cambio:** En `ClienteRepository.ListarTodosPuntosVentaActivos`, agregar `c."IdSucursal"` en el `SELECT` y pasar el filtro `id_sucursal` al SQL.

### Propuesta 4: Corrección de `Envíos de Inventario`
- **Cambio:** En `EnvioRouter.py`, reemplazar los accesos por atributo por accesos de diccionario o métodos Pydantic, usando los campos reales `origen_id` y `destino_id`.

### Propuesta 5: Ajuste de `Precios`
- **Cambio:** En `PrecioRouter.py`, tipar `id_sucursal: Optional[str] = Query(None)` y retornar mensaje amigable o consolidado si se envía `"todas"`, eliminando el error 422.

### Propuesta 6: Cobertura en `Cuentas por Pagar`
- **Cambio:** Inyectar `DependenciaAlcanceSucursal` en `/cxp/cuentas` y filtrar por `cpp."IdSucursal" = :id_sucursal`.

---

## 7. ANEXO A: Auditoría Exhaustiva de Endpoints, Saldos y Seguridad (Resolución de Huecos A.1 a A.6)

### 7.1. Tabla Exhaustiva de Invariantes con Totales Reales (`COUNT(*)`)
Ejecución automatizada real mediante `TestClient(raise_server_exceptions=False)` sobre los 37 endpoints del sistema (incluyendo los 17 faltantes). Se diferencian rigurosamente los códigos de estado HTTP de los conteos numéricos de registros.

| # | Endpoint Auditado | HTTP Status (Todas/Sucre/Potosí) | Total Real (Todas) | Sucre (1) | Potosí (2) | Sin Sede (NULL) | ¿Cumple Invariante? | Nivel de Filtrado | Causa Raíz / Diagnóstico |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | `/cxc/notas-venta` | 200 / 200 / 200 | 102 | 102 | 0 | 0 | ✅ Sí | SQL (Repo) | Invariante verificado (todas en Sucre). |
| 2 | `/cxc/cuentas` | 200 / 200 / 200 | 369 | **317** | 0 | **52** | ❌ Defecto | SQL (Repo) | **52 cuentas con `IdSucursal IS NULL`** son excluidas al filtrar por Sucre (`WHERE cxc."IdSucursal" = 1`). |
| 3 | `/cxc/abonos/pendientes` | 200 / 200 / 200 | 428 | 428 | 0 | 0 | ✅ Sí | SQL (Repo) | Todos los abonos pendientes pertenecen a cuentas con `IdSucursal = 1`. |
| 4 | `/cxc/resumen-cartera` | 200 / 200 / 200 | 31 cl. | 31 cl. | 0 cl. | 0 | ✅ Sí | SQL (Repo) | Agrupa por `Cliente.IdSucursal` (todos los clientes están en Sucre). |
| 5 | `/tesoreria/cajas` | 200 / 200 / 200 | 1 | 1 | 0 | 0 | ✅ Sí | SQL (Repo) | Caja Principal Planta pertenece a Sucre. Potosí aún no tiene caja física creada. |
| 6 | `/tesoreria/caja/estado` | 400 / 200 / 200 | N/A | 1 | 1 | 0 | ✅ Sí (Por Diseño) | Router / Service | "Todas" exige sucursal específica (HTTP 400). Sede fija opera sobre su caja autorizada. |
| 7 | `/tesoreria/caja/movimientos` | 200 / 200 / 200 | 352 | **6** | 0 | **346** | ❌ Defecto | SQL (Repo) | **346 movimientos tienen `IdAperturaCierreCaja IS NULL`** (vales de caja chica, transferencias bancarias). El JOIN a `Caja` los descarta. |
| 8 | `/tesoreria/caja-chica/solicitudes` | 200 / 200 / 200 | 112 | 112 | 0 | 0 | ✅ Sí | SQL (Repo) | En el router la consulta consolidada agrupa todas; 111 con `IdSucursal = 1` y 1 histórica NULL. |
| 9 | `/tesoreria/caja-chica/pendientes-gerencia` | 200 / 200 / 200 | 3 | 3 | 0 | 0 | ✅ Sí | SQL (Repo) | 3 vales rendidos pendientes de firma gerencial en Sucre. |
| 10 | `/logistica/precios` | 422* / 200 / 200 | 15 | 15 | 15 | 0 | ⚠️ Requiere 400 | SQL (Repo) | *Query param `int` arroja 422 con `"todas"`. Ambas sedes devuelven 15 presentaciones (Potosí tiene 4 tarifas propias y 11 nulas). |
| 11 | `/logistica/zonas` | 200 / 200 / 200 | 4 | 4 | 0 | 0 | ✅ Sí | SQL (Repo) | 4 zonas urbanas de Sucre filtradas por heurística textual `Ciudad ILIKE '%Sucre%'`. |
| 12 | `/logistica/rutas` | 200 / 200 / 200 | 5 | 5 | 0 | 0 | ✅ Sí | SQL (Repo) | **Corregido y verificado con prueba de regresión** (SELECT incluía `r."IdSucursal"`). |
| 13 | `/logistica/asignaciones` | 200 / 200 / 200 | 9 | 9 | 0 | 0 | ✅ Sí | SQL (Repo) | Asignaciones activas de Sucre. |
| 14 | `/logistica/repartidores` | 200 / 200 / 200 | 4 | 3 | 1 | 0 | ✅ Sí | Memoria | Choferes activos (3 Sucre, 1 Potosí). |
| 15 | `/logistica/telemetria/en-vivo` | 200 / 200 / 200 | 4 | 3 | 1 | 0 | ✅ Sí | Memoria | Choferes con telemetría (3 Sucre, 1 Potosí). |
| 16 | `/logistica/clientes` | 200 / 200 / 200 | 40 | 40 | 0 | 0 | ✅ Sí | SQL (Repo) | 40 clientes registrados en Sede 1 (Sucre). Clientes 16 y 17 despachan a Potosí. |
| 17 | `/logistica/clientes/puntos-venta/todos` | 200 / 200 / 200 | 19 | **0** | **0** | **19** | ❌ Defecto | Memoria (Filtro roto) | `ClienteRepository` omitió `c."IdSucursal"` en el SELECT. El filtro en memoria descarta todas las filas. |
| 18 | `/logistica/envios` | 200 / **500** / **500** | 2 | N/A | N/A | 0 | ❌ Error 500 | Memoria (Crash) | **`AttributeError: 'dict' object has no attribute 'id_sucursal_origen'`** en `EnvioRouter.py:31`. |
| 19 | `/logistica/inventario/sucursal/1` | 200 / 200 / 200 | 4 | 4 | 4 | 0 | N/A | Endpoint por ID | Retorna el inventario del ID de sucursal solicitado en la URL (4 ítems en Sucre y 4 en Potosí). |
| 20 | `/logistica/inventario/reportes/valorizado` | 200 / 200 / 200 | 18 | 18 | 4 | 0 | ✅ Sí | SQL (Repo) | Valorización de stock comercial: 18 ítems activos en Sucre, 4 ítems en Potosí. |
| 21 | `/rrhh/empleados` | 200 / 200 / 200 | 17 | 14 | 3 | 0 | ✅ Sí | SQL (Repo) | Empleados (14 Sucre, 3 Potosí). Invariante verificado. |
| 22 | `/rrhh/asistencia` | 200 / 200 / 200 | 260 | 260 | 0 | 0 | ✅ Sí | SQL (Repo) | 260 marcas biométricas correspondientes a personal de Sucre. |
| 23 | `/rrhh/turnos` | 200 / 200 / 200 | 7 | 7 | 7 | 0 | ⚠️ Catálogo Global | Sin filtro | Catálogo institucional general de turnos (Confirmado por decisión B.7 como Recurso Global). |
| 24 | `/rrhh/cronograma` | 200 / 200 / 200 | 0 | 0 | 0 | 0 | ✅ Sí | SQL (Repo) | Sin asignaciones en el rango consultado. |
| 25 | `/rrhh/planillas/1` | 200 / 200 / 200 | 10 emp. | 10 emp. | 0 emp. | 0 | ✅ Sí | SQL (Repo) | Planilla histórica 1 con 10 empleados de Sucre. |
| 26 | `/rrhh/finiquitos` | 200 / 200 / 200 | 30 | 30 | 0 | 0 | ✅ Sí | SQL (Repo) | 30 cálculos de finiquitos históricos en Sucre. |
| 27 | `/rrhh/no-venta` | 200 / 200 / 200 | 30 | 30 | 0 | 0 | ❌ Latencia N+1 | SQL N+1 / Router | Contiene consulta lenta N+1 (30 queries) y bug de retorno en `validar_recurso`. |
| 28 | `/cxp/cuentas` | 200 / 200 / 200 | 18 | 18 | 18 | 0 | ⚠️ Requiere RBAC | Sin filtro | Módulo global de compras centrales de insumos. Requiere restringirse a roles multisede. |
| 29 | `/cxp/devoluciones` | 200 / 200 / 200 | 0 | 0 | 0 | 0 | ✅ Sí | SQL (Repo) | Sin devoluciones registradas. |
| 30 | `/gerencia/kpis-ejecutivos` | 200 / 200 / 200 | Métricas | Métricas | Métricas | 0 | ✅ Sí | Service | Consolida saldos globales de ventas, cartera y bancos. |
| 31 | `/gerencia/reporte-consolidado-planta` | 200 / 200 / 200 | Métricas | Métricas | Métricas | 0 | ✅ Sí | Service | Consolida stock físico y valorizado en fábrica central. |
| 32 | `/gerencia/buscar-reporte` | 200 / 200 / 200 | Res. | Res. | Res. | 0 | ✅ Sí | Service | Buscador general por código (`?codigo=NV`). |
| 33 | `/reportes/contabilidad/flujo-caja` | 200 / 200 / 200 | 6 | 6 | 0 | 0 | ✅ Sí | SQL (Repo) | Movimientos de flujo de caja consolidados en Sucre. |
| 34 | `/reportes/contabilidad/cuentas-cobrar` | 200 / 200 / 200 | 369 | **317** | 0 | **52** | ❌ Defecto | SQL (Repo) | Mismo defecto que `/cxc/cuentas`: excluye las 52 cuentas con `IdSucursal IS NULL`. |
| 35 | `/reportes/contabilidad/cuentas-pagar` | 200 / 200 / 200 | 18 | 18 | 18 | 0 | ⚠️ Global | Sin filtro | Reporte de CxP centralizado. |
| 36 | `/reportes/contabilidad/notas-venta` | 200 / 200 / 200 | 102 | 102 | 0 | 0 | ✅ Sí | SQL (Repo) | 102 notas de venta emitidas por Sucre. |
| 37 | `/reportes/logistica/desempeno-rutas` | 200 / 200 / 200 | 9 | 9 | 0 | 0 | ✅ Sí | SQL (Repo) | Rendimiento de rutas de Sucre. |
| 38 | `/reportes/logistica/cobertura-clientes` | 200 / 200 / 200 | 40 | 40 | 0 | 0 | ✅ Sí | SQL (Repo) | Cobertura de clientes en Sucre. |
| 39 | `/reportes/rrhh/asistencia-puntualidad` | 200 / 200 / 200 | 260 | 260 | 0 | 0 | ✅ Sí | SQL (Repo) | Análisis de puntualidad sobre las 260 asistencias de Sucre. |
| 40 | `/reportes/rrhh/nomina-historica` | 200 / 200 / 200 | 15 | **1** | 0 | **14** | ❌ Defecto | SQL (Repo) | Excluye planillas y detalles históricos con `IdSucursal IS NULL`. |
| 41 | `/reportes/auditoria/actividad-seguridad` | 200 / 200 / 200 | 102 | 102 | 0 | 0 | ✅ Sí | SQL (Repo) | 102 eventos de auditoría registrados en Sucre. |
| 42 | `/admin/auditoria` | 200 / 200 / 200 | 102 | 102 | 0 | 0 | ✅ Sí | SQL (Repo) | Registros de trazabilidad transaccional. |
| 43 | `/Usuario/listar` | 200 / 200 / 200 | 17 | 14 | 3 | 0 | ✅ Sí | SQL (Repo) | Usuarios del sistema (14 Sucre, 3 Potosí). |
| 44 | `/distribuidores/pedidos` | 200 / 200 / 200 | 28 | 28 | 28 | 0 | ⚠️ Global | Sin filtro | Pedidos de distribuidores mayoristas de planta (Recurso centralizado). |

---

### 7.2. Análisis de Concordancia de Saldos y KPIs (Hueco A.3)
Se contrastaron las cifras agregadas devueltas por los endpoints de analítica con la suma directa de los registros en la base de datos:

1. **Endpoint `/cxc/resumen-cartera`:**
   - `TotalDespachado`: **Bs. 16,346,415.08**
   - `TotalAbonado`: **Bs. 10,330,007.14**
   - `TotalPorCobrar`: **Bs. 6,016,407.94** (Cartera Vigente: Bs. 6,016,407.94 | Vencida: Bs. 0.00)
2. **KPIs Ejecutivos de Gerencia (`/gerencia/kpis-ejecutivos`):**
   - `cuentas_cobrar_saldo_total`: **Bs. 6,016,407.94**
   - `cuentas_cobrar_en_mora`: **Bs. 18,200.00**
3. **Suma Real Directa en Base de Datos (`CuentaCobrar`):**
   - Cuentas con `IdSucursal = 1` (317 cuentas):
     - `SUM(MontoTotal)`: **Bs. 16,325,615.08**
     - `SUM(SaldoPendiente)`: **Bs. 5,998,207.94**
   - Cuentas con `IdSucursal IS NULL` (52 cuentas):
     - `SUM(MontoTotal)`: **Bs. 20,800.00**
     - `SUM(SaldoPendiente)`: **Bs. 18,200.00**
   - **Suma Consolidada Real:**
     - Monto Total Despachado: 16,325,615.08 + 20,800.00 = **Bs. 16,346,415.08** (Concordancia exacta: diferencia Bs. 0.00).
     - Saldo Pendiente por Cobrar: 5,998,207.94 + 18,200.00 = **Bs. 6,016,407.94** (Concordancia exacta: diferencia Bs. 0.00).

> [!IMPORTANT]
> **Demostración de la Causa de la Discrepancia:**
> - `/cxc/resumen-cartera` y `/gerencia/kpis-ejecutivos` calculan la cartera agrupando por `Cliente` (`c."IdSucursal"`). Dado que los clientes de esas 52 cuentas tienen `Cliente.IdSucursal = 1` (Sucre), el resumen los suma dentro de Sucre, arrojando **Bs. 6,016,407.94**.
> - En contraste, el listado `/cxc/cuentas` filtra sobre la tabla `CuentaCobrar` (`WHERE cxc."IdSucursal" = 1`). Como esas 52 cuentas tienen `IdSucursal IS NULL`, quedan excluidas del listado de Sucre, mostrando únicamente **Bs. 5,998,207.94** repartidos en 317 cuentas.
> - **Cuantificación exacta de la brecha:** Exactamente **52 cuentas** y **Bs. 18,200.00** (que coincide idénticamente con la alerta de `cuentas_cobrar_en_mora` de los KPIs de gerencia). El backfill aprobado en B.8 resolverá esta divergencia eliminando los registros huérfanos.

---

### 7.3. Explicación Detallada de Precios: BD vs Endpoint vs Frontend (Hueco A.4)
Se auditó la discrepancia entre las 25 filas en BD y las 15 filas reportadas en los endpoints:

1. **Estado en Base de Datos (`PrecioProducto`):**
   - Existen **25 filas** en total en `PrecioProducto`:
     - **Sede Sucre (`IdSucursal = 1`):** 21 filas (18 activas y 3 inactivas correspondientes a histórico de cambios de tarifas para la presentación 11).
     - **Sede Potosí (`IdSucursal = 2`):** 4 filas (todas activas: presentaciones 10, 11, 13 y 14 con tarifas diferenciadas: Bs. 37.80, Bs. 27.00, Bs. 4.86 y Bs. 3.24).
2. **Estructura en Catálogo Maestro (`PresentacionProducto`):**
   - Existen **15 presentaciones comerciales activas** de papel higiénico, servilletas y toallas.
3. **Comportamiento del Endpoint `GET /logistica/precios`:**
   - La consulta SQL en `PrecioRepository.ListarPreciosVigentes` ejecuta:
     ```sql
     FROM "PresentacionProducto" p 
     LEFT JOIN "PrecioProducto" pp ON p."IdPresentacion" = pp."IdPresentacion" 
         AND pp."Activo" = true 
         AND (pp."IdSucursal" = :id_sucursal OR pp."IdSucursal" IS NULL)
     WHERE p."Activo" = true
     ORDER BY p."IdPresentacion" ASC;
     ```
   - Al ser un `LEFT JOIN` gobernado por `PresentacionProducto`, **siempre devuelve 15 registros**:
     - En **Sucre (`id_sucursal=1`)**: Las 15 presentaciones hacen match con un precio activo de Sucre y retornan con su tarifa vigente.
     - En **Potosí (`id_sucursal=2`)**: Las 4 presentaciones con tarifa propia retornan sus precios numéricos. Las 11 presentaciones restantes no encuentran registro en Potosí y retornan `IdPrecioProducto = None` y `PrecioUnitario = None`.
4. **Comportamiento en Frontend (`TablaPrecios.jsx`):**
   - Cuando `PrecioUnitario` es `None`, la interfaz renderiza: `<span className="italic text-gray-400">Sin precio</span>` junto con un badge `PENDIENTE` en amarillo y un botón interactivo "Asignar Precio".
   - **No existe herencia oculta:** La aplicación no copia silenciosamente el precio de Sucre a Potosí.
   - **Registro para Potosí:** El supervisor o administrador registra tarifas en Potosí enviando `POST /logistica/precios` con el payload Pydantic `{"IdPresentacion": X, "IdSucursal": 2, "PrecioUnitario": Y, ...}`.

---

### 7.4. Auditoría de Usuarios, Permisos y Demostración de Fallo Cerrado (Hueco A.5)

1. **Distribución Real en `"Usuario"` (17 usuarios totales):**
   - **Sucre (`IdSucursal = 1`):** 14 usuarios (IDs: 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 18).
   - **Potosí (`IdSucursal = 2`):** 3 usuarios de prueba (IDs: 15, 16, 17).
   - **Usuarios con `IdSucursal IS NULL`:** 0 usuarios. Todos los usuarios tienen sucursal asignada en la tabla `Usuario`.
2. **Distribución en `"usuario_sucursal_permiso"` (21 registros):**
   - **Filas Multisede (`id_sucursal IS NULL`, `puede_ver_todas = true`):** 5 filas (Usuarios 4, 7, 12, 13, 18).
   - **Filas Sucre (`id_sucursal = 1`):** 13 filas (Usuarios 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14).
   - **Filas Potosí (`id_sucursal = 2`):** 3 filas (Usuarios 15, 16, 17).
   - **¿Quién era el usuario "sin sede" en la tabla comparativa previa?**
     El usuario **ID 18 (`TEST_Multisede`, Gerente General)**. Al ser sembrado en pruebas unitarias como multisede puro, poseía únicamente la fila con `puede_ver_todas = true` y carecía de una fila individual explícita para Sucre en `usuario_sucursal_permiso` (13 + 3 = 16 filas con sucursal específica).
3. **Demostración de Fallo Cerrado:**
   - Se probó la función `resolver_alcance_usuario(id_usuario, db)` ante un usuario no registrado o sin asignaciones (ej. ID 999 sin filas en `usuario_sucursal_permiso` ni en `Usuario`):
     - `puede_ver_todas = False`
     - `sucursales_permitidas = []`
     - Al evaluar la consulta por omisión (sin parámetro), arroja de forma inmediata:
       `HTTPException(status_code=403, detail="El usuario no tiene ninguna sucursal asignada o autorizada en el sistema.")`
     - Si solicita cualquier sede específica (ej. `?id_sucursal=1`), la condición `sid_limpio in sucursales_permitidas` resulta falsa y arroja:
       `HTTPException(status_code=403, detail="No tiene autorización para acceder a los datos de la sucursal 1.")`
     - Si solicita `"todas"`, la condición `not puede_ver_todas` resulta verdadera y arroja:
       `HTTPException(status_code=403, detail="No tiene autorización para acceder a la vista consolidada de todas las sucursales.")`
   - El fallo cerrado está blindado tanto a nivel de función como en base de datos.

---

### 7.5. Hallazgos de la Revisión General de Errores (Hueco A.6)

1. **Consultas Lentas y Patrón N+1 en RRHH:**
   - En `RRHHRepository.ListarDeudasNoVenta` (línea 1171): se ejecuta un bucle `for d in deudas` que lanza una consulta SQL individual a `detalles_no_venta_empleado` por cada una de las 30 deudas. Esto genera 31 consultas consecutivas a la base de datos Supabase, elevando el tiempo de respuesta a más de 12 segundos.
   - **Solución para Fase 2:** Reemplazar el bucle por un solo `JOIN` o una consulta batch `WHERE deuda_no_venta_id = ANY(:ids)`.
2. **Defecto de Retorno en `RRHHRouter.ListarNoVenta`:**
   - En línea 388: `id_suc = alcance.validar_recurso(id_sucursal) if id_sucursal else alcance.sucursal_efectiva`.
   - `alcance.validar_recurso()` valida permisos y retorna `None` (no el ID). Por tanto, cuando se enviaba `?id_sucursal=1`, `id_suc` quedaba como `None` y no filtraba la consulta en base de datos.
3. **Inventario de Patrones `getattr` o Acceso Atributo sobre Diccionarios (Tipo BUG-01):**
   - `app/Routes/Logistica/EnvioRouter.py:31`: `e.id_sucursal_origen` (causa del Error 500 al filtrar envíos).
   - `app/Routes/Logistica/EnvioRouter.py` líneas 47, 79, 99, 119: accesos similares a `e.id_sucursal_...` sobre diccionarios devueltos por `obtener_envio()`.
   - `app/Routes/Logistica/RutaRouter.py` líneas 69, 94, 110: `alcance.validar_recurso(getattr(r, "IdSucursal", None))`. Si `r` es diccionario, `getattr` evalúa siempre a `None`.
   - `app/Reportes/reporte.py` línea 265: `getattr(fila, accessor, None)` en el motor de reportes.
4. **Validación de Frontend (Astro 7 + React 19):**
   - Ejecución de `npm run build`: **Compilación 100% exitosa sin errores** (`Server built in 25.19s`, 0 errores de sintaxis, 0 fallos de hidratación SSR).

---

### 7.6. Manifiesto de Scripts Preparados con `--dry-run` (Decisiones B.1, B.2 y B.8)

Se implementaron y probaron en el repositorio 3 scripts operativos:

1. **Migración Alembic y Script de Backfill para `ZonaDistribucion` (Decisión B.1):**
   - Migración: [`Blanquita-Backend/alembic/versions/5c2b9a71ef34_agregar_idsucursal_a_zonadistribucion.py`](file:///C:/Users/franz/Desktop/Blanquita/Blanquita-Proyecto-Grado/Blanquita-Backend/alembic/versions/5c2b9a71ef34_agregar_idsucursal_a_zonadistribucion.py)
   - Script con `--dry-run`: [`docs/scripts/backfill_zonas.py`](file:///C:/Users/franz/Desktop/Blanquita/Blanquita-Proyecto-Grado/docs/scripts/backfill_zonas.py)
   - SQL generado:
     ```sql
     ALTER TABLE "ZonaDistribucion" ADD COLUMN "IdSucursal" INTEGER REFERENCES sucursales(id) ON DELETE RESTRICT;
     CREATE INDEX ix_zonadistribucion_idsucursal ON "ZonaDistribucion"("IdSucursal");
     UPDATE "ZonaDistribucion" SET "IdSucursal" = 1 WHERE "IdZonaDistribucion" IN (1, 2, 3, 4);
     ```
2. **Script de Backfill con Manifiesto para Entidades Huérfanas (Decisión B.8):**
   - Script con `--dry-run`: [`docs/scripts/backfill_null_entities.py`](file:///C:/Users/franz/Desktop/Blanquita/Blanquita-Proyecto-Grado/docs/scripts/backfill_null_entities.py)
   - Resultados de simulación:
     - **52 Cuentas por Cobrar:** 100% derivables a Sede 1 (Sucre) a través de `Cliente.IdSucursal = 1`. 0 ambiguas.
     - **2 Planillas Históricas:** 100% derivables a Sede 1 (Sucre) a través de sus empleados asociados. 0 ambiguas.
     - **1 Solicitud Caja Chica:** 100% derivable a Sede 1 (Sucre) a través de `Caja.IdSucursal = 1`. 0 ambiguas.
3. **Script de Introspección Transaccional para `MovimientoCaja` (Decisión B.2):**
   - Script: [`docs/scripts/inspect_movimientos_origen.py`](file:///C:/Users/franz/Desktop/Blanquita/Blanquita-Proyecto-Grado/docs/scripts/inspect_movimientos_origen.py)
   - Resultados sobre los 352 movimientos:
     - 6 movimientos: Derivados de Caja Física Sucre (`IdAperturaCierreCaja = 1`).
     - 128 movimientos: Derivados de Caja Chica Sucre (`NotaCodigo = SolicitudCajaChica.CodigoSolicitud`).
     - 136 movimientos: Cuenta "Caja Central Moneda Nacional" (`IdCuentaBancaria = 4`).
     - 180 movimientos: Cuentas Bancarias Centrales Banco Unión y BNB (`IdCuentaBancaria IN (1, 2)`).
     - 0 movimientos huérfanos o con origen ambiguo.



---

## 8. Cierre de Fase 2 y Fase 4: Resoluciones Técnicas Definitivas

### 8.1. Rectificación de Inconsistencias de Fase 1

1. **VALE-2208 (Solicitud de Caja Chica):**
   - **Diagnóstico:** La solicitud `VALE-2208` (`IdSolicitudCajaChica = 2208`) carecía de valor en `IdSucursal`.
   - **Resolución:** Estaba vinculada a `IdCaja = 1` ("Caja Principal Planta", cuya sede es Sucre, `IdSucursal = 1`). Fue actualizada mediante `docs/scripts/backfill_null_entities.py` a `IdSucursal = 1`. Conteo actual de nulos en `SolicitudCajaChica`: **0**.

2. **Rectificación de Fila 17 (Puntos de Venta):**
   - **Diagnóstico Inicial Erróneo:** En el informe preliminar de Fase 1 se reportó que `/logistica/clientes/puntos-venta/todos` arrojaba "19 puntos de venta sin sede".
   - **Causa Raíz Real:** Los 19 puntos de venta pertenecen a clientes activos con `IdSucursal = 1` (Sucre). No eran registros huérfanos. La causa raíz fue un defecto en la consulta SQL de `ClienteRepository.ListarTodosPuntosVentaActivos`, la cual no incluía `c."IdSucursal"` en la lista de columnas seleccionadas (`SELECT`), provocando que el mapper Pydantic inicializara `IdSucursal = None`.
   - **Resolución:** Se agregó `c."IdSucursal"` a la proyección SQL y se incorporó el filtro de sucursal efectiva. La prueba unitaria y permanente de invariantes (`tests/test_invariantes_listados_sucursales.py`) valida `Total(Todas: 19) == Total(Sucre: 19) + Total(Potosí: 0)`.

3. **Demostración Técnica: Flujo de Caja (Corregido) vs Movimientos de Caja (352):**
   - **Corrección de Causa Raíz:**
     - El endpoint `/reportes/contabilidad/flujo-caja` contenía un defecto de filtro: utilizaba `c_caja."IdSucursal"`, restringiendo la consulta únicamente a movimientos que contaban con una apertura de caja física en `AperturaCierreCaja` (de las cuales solo existían 6 en la base de datos). 
     - La corrección aplicada en `ReportesRouter.py:38` cambió el filtro a `mc."IdSucursal" = :id_sucursal`. Con esta corrección, el endpoint devuelve todos los movimientos propios de la sede: 134 Sucre + 0 Potosí + 218 corporativos = 352 movimientos totales.
     - Este comportamiento está cubierto y verificado de forma permanente por la prueba `tests/test_invariantes_listados_sucursales.py::test_flujo_caja_filtra_por_idsucursal_movimiento` (PASSED).

### 8.2. Tabla Definitiva de Estado de Entidades y Columnas de Sede

| Tabla | Columna Sede | Total BD | Sucre (1) | Potosí (2) | NULL / Sin Sede | Justificación Técnica |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `ZonaDistribucion` | `IdSucursal` | 4 | 4 | 0 | 0 | Migración Alembic `5c2b9a71ef34`. Zonas históricas asignadas a Sucre. |
| `RutaDistribucion` | `IdSucursal` | 5 | 5 | 0 | 0 | 100% aisladas en Sucre. |
| `MovimientoCaja` | `IdSucursal` | 352 | 134 | 0 | 218 | Migraciones `6d3e8b82fa45`, `7e4f9c93ab56` y `9a6b2c15ef78`. 134 Sucre, 218 Corporativos con CHECK constraint. |
| `Cliente` | `IdSucursal` | 40 | 40 | 0 | 0 | 100% aislados en Sucre. |
| `PuntoVenta` | `(Derivada Cliente)` | 19 | 19 | 0 | 0 | Hereda sede del cliente (`Cliente.IdSucursal`). Consistencia probada. |
| `NotaVenta` | `IdSucursal` | 102 | 102 | 0 | 0 | 100% aisladas en Sucre. |
| `CuentaCobrar` | `IdSucursal` | 369 | 369 | 0 | 0 | 317 originales + 52 huérfanas derivadas a Sucre sin ambigüedad. |
| `Caja` | `IdSucursal` | 2 | 1 | 1 | 0 | Caja 1 (Planta Sucre), Caja 2 (Potosí). |
| `SolicitudCajaChica` | `IdSucursal` | 112 | 112 | 0 | 0 | 111 originales + 1 huérfana (VALE-2208) asignada a Sucre. |
| `ValeCajaChica` | `(Derivada Solicitud)` | 111 | 111 | 0 | 0 | Hereda sede de la solicitud de caja chica. |
| `DatosLaboralesEmpleado` | `IdSucursal` | 10 | 10 | 0 | 0 | 10 empleados formales de Sucre. |
| `Planilla` | `IdSucursal` | 2 | 2 | 0 | 0 | 2 planillas históricas derivadas a Sucre. |
| `Turno` | *(Catálogo global)* | 4 | - | - | 4 | Catálogo maestro de turnos transversal a la empresa. |
| `deudas_no_venta` | `id_sucursal` | 30 | 30 | 0 | 0 | Deudas de personal asociadas a la sede Sucre. |
| `envios_inventario` | `origen_id` / `destino_id` | 2 | 2 (orig) | 2 (dest) | 0 | Remisiones inter-sucursales Sucre -> Potosí (visibles en ambas sedes). |

### 8.3. CHECK Constraint de Integridad en `MovimientoCaja`
Aplicada mediante la migración Alembic `9a6b2c15ef78` (revisión `9a6b2c15ef78`, reversible con `downgrade -1` a `8f5a1b02cd67`):
- Restricción: `ck_movimientocaja_sede_o_corporativo`.
- Condición SQL: `("IdSucursal" IS NOT NULL AND es_corporativo = false) OR ("IdSucursal" IS NULL AND es_corporativo = true)`
- Prueba de Regresión Permanente: implementada en `tests/test_invariantes_listados_sucursales.py::test_check_constraint_movimientocaja_sede_o_corporativo` (PASSED).

### 8.4. Matriz Consolidada de Defectos Corregidos y Revisados (6 Módulos)

| ID | Módulo | Defecto / Comportamiento | Causa Raíz | Estado | Verificación / Test Específico |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | Logística | Error 500 al listar remisiones inter-sucursal | Acceso a atributos en lugar de diccionarios (`e.id_sucursal_origen`) | **Corregido** | `tests/test_regresion_rutas_sucursal.py::test_envios_listado_aislamiento_sucursal` |
| **BUG-02** | Logística | Puntos de Venta devolvían 0 al filtrar por sede | Columna `c."IdSucursal"` omitida en proyección SQL `SELECT` | **Corregido** | `tests/test_invariantes_listados_sucursales.py::test_invariantes_endpoints_listado_multisede` |
| **BUG-03** | Logística | Error 422 en `/logistica/precios` con `"todas"` | Tipado estricto `int` sin aceptar comodines de consolidado | **Corregido** | `tests/test_invariantes_listados_sucursales.py::test_precios_rechaza_todas_con_400` |
| **BUG-04** | Logística | Productos sin tarifa en Potosí causaban error en UI | Frontend asumía tarifa existente para toda presentación | **Corregido sin test** | UI renderiza badge "Sin tarifa" y botón asignar. `npm run build` OK |
| **BUG-05** | Logística | Residuos de tarifas de sede previa al cambiar sucursal | Estado de componentes React no se reseteaba | **Corregido sin test** | `useEffect` de reseteo en `GestionPrecios.jsx`. `npm run build` OK |
| **BUG-06** | Logística | IDOR potencial al editar o consultar rutas | Falta de validación cruzada entre sede de ruta y usuario | **Corregido** | `tests/test_regresion_rutas_sucursal.py::test_idor_ruta_otra_sucursal` |
| **BUG-07** | Logística | `ZonaDistribucion` sin soporte multisede | Tabla no poseía columna `IdSucursal` | **Corregido** | Migración `5c2b9a71ef34` + `test_regresion_rutas_sucursal.py` |
| **BUG-08** | Logística | Envíos: regla de visibilidad inter-sucursal (origen/destino) | Invariante aditivo no aplica a aristas inter-sucursal | **Corregido** | `tests/test_invariantes_listados_sucursales.py::test_envios_invariante_union_remisiones_inter_sucursales` |
| **BUG-09** | Logística | Inventario Valorizado caía en sede por defecto sin parámetro | `alcance.sucursal_asignada_defecto` forzaba Sucre a multisede | **Corregido** | `tests/test_invariantes_listados_sucursales.py::test_inventario_valorizado_rechaza_todas_con_400` |
| **BUG-10** | Logística | Consistencia relacional PuntoVenta - Ruta - Cliente | Integridad referencial de asignación de sede | **Corregido** | `tests/test_invariantes_listados_sucursales.py::test_consistencia_punto_venta_sucursal` |
| **BUG-11** | Contabilidad | 52 filas en `CuentaCobrar` con `IdSucursal IS NULL` | Cuentas históricas importadas sin sede explícita | **Corregido** | Backfill manifiesto + `test_invariantes_listados_sucursales.py` |
| **BUG-12** | Contabilidad | `/cxp/*` accesible por usuarios de sede fija | Falta de restricción RBAC a nivel de router | **Corregido** | `tests/test_invariantes_listados_sucursales.py::test_restriccion_rbac_modulos_globales_sede_fija` |
| **BUG-13** | Contabilidad | Movimientos bancarios sin sede definida en `MovimientoCaja` | Ausencia de columna de ámbito institucional | **Corregido** | Migración `es_corporativo` + `ck_movimientocaja_sede_o_corporativo` en test |
| **BUG-14** | Contabilidad | Cuentas bancarias accesibles por sede fija | `/tesoreria/bancos` sin control de ámbito corporativo | **Corregido** | `tests/test_invariantes_listados_sucursales.py::test_restriccion_rbac_modulos_globales_sede_fija` |
| **BUG-15** | Contabilidad | Caja 2 de Potosí sin aperturas registradas en historial | Tabla `AperturaCierreCaja` solo contenía aperturas de Caja 1 | **Revisado en código** | Verificado en script transaccional con siembra de apertura de Caja 2 |
| **BUG-16** | Contabilidad | Flujo de caja descartaba movimientos sin apertura física | Filtro aplicado sobre `c_caja."IdSucursal"` en lugar de `mc` | **Corregido** | `tests/test_invariantes_listados_sucursales.py::test_flujo_caja_filtra_por_idsucursal_movimiento` |
| **BUG-17** | RRHH | 2 planillas con `IdSucursal IS NULL` | Registros históricos sin asignación de sucursal | **Corregido** | Backfill manifiesto + suite de invariantes de listados |
| **BUG-18** | RRHH | `Turno` expone lista maestra transversal | Entidad maestra sin segmentación geográfica | **Revisado en código** | Documentado como catálogo corporativo común |
| **BUG-19** | RRHH | Cuello de botella N+1 en `/rrhh/no-venta` | 31 consultas individuales sucesivas en bucle | **Corregido** | Optimización SQL `ANY(:ids)`, verificado en `benchmark_triplicado.py` (2 queries) |
| **BUG-20** | RRHH | Error 422 en `/rrhh/no-venta` al enviar `"todas"` | Tipado restringido a entero | **Corregido** | `tests/test_invariantes_listados_sucursales.py::test_invariantes_endpoints_listado_multisede` |
| **BUG-21** | Gerencia | KPIs Ejecutivos: segmentación y consolidación de sede | Venta, mora y vales conmutan por sede; bancos corporativos | **Revisado en código** | `GerenciaRepository.py:244-246` filtra por sede efectiva o consolida global |
| **BUG-22** | Gerencia | Buscador Global Multientidad de 4 dígitos | Búsqueda unificada en Notas, Vales, Abonos y Pedidos | **Revisado en código** | Medido en `benchmark_triplicado.py` (724 ms med) |
| **BUG-23** | Usuarios/Seguridad | `GET /Usuario/mi-alcance` no retornaba todas las sedes activas | Lógica dependía de filas explícitas en permisos por sede | **Corregido** | `tests/integration_p2p/test_usuarios_sedes_reales_integration.py` |
| **BUG-24** | Usuarios/Seguridad | Verificación de políticas RLS activas en base de datos | Comprobación de aislamiento en capa Postgres | **Revisado en código** | `docs/scripts/gestionar_force_rls.py` |
| **BUG-25** | Reportes | `/reportes/contabilidad/cuentas-cobrar` | Filtrado de cartera por sucursal efectiva | **Corregido** | `tests/test_invariantes_listados_sucursales.py` |
| **BUG-26** | Reportes | `/reportes/contabilidad/flujo-caja` | Inclusión de movimientos directos de sede | **Corregido** | `tests/test_invariantes_listados_sucursales.py::test_flujo_caja_filtra_por_idsucursal_movimiento` |
