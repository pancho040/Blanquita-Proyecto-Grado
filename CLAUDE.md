# CLAUDE.md — Sistema de Inventario y Producción "Papel Blanquita"

## Preferencias de código
- Escribir código limpio y sin comentarios.
- Entregar siempre archivos completos, nunca fragmentos ni diffs parciales ni "el resto igual".
- Respetar las convenciones ya existentes en el proyecto antes de introducir nuevas.

Estas preferencias son obligatorias en todas las sesiones. Reglas de trabajo acordadas:
- Tras cada tarea relevante, actualizar este archivo (corto, sin duplicar).
- Si el usuario plantea una idea ("estaba pensando…", "tal vez…"), discutir y planear; no editar hasta que diga "vamos con ello"/"hagámoslo".
- Funciones SQL nuevas o modificadas: pegar el `CREATE OR REPLACE FUNCTION` completo en el chat (el usuario lo aplica a mano en Supabase). No editar los `.sql` del repo salvo pedido.
- Todo desarrollo se basa en lo que pidió el cliente (`Client/*.md` = `Documentación/Entrevistas`). Distinguir lo documentado de lo interpretado.

## Visión general
Proyecto de grado (PG9 de Fabricio Montero Gonzales, tutor Alex Jiménez; metodología XP) para Papel Blanquita (papel higiénico, toalla y servilletas). Alcance: inventario de materia prima (bobina papel, bobina servilleta, rodela, empaques, insumos), producción e inventario de producto terminado (PT); ventas/contabilidad fuera. Actores: Operador, Líder de Inventario y Producción (Carlos), gerente (don Osvaldo). Objetivos: trazabilidad por código de bobina, registro rápido en planta desde celular con carteles QR, reportes PDF, mínimo dato manual (fecha, turno y usuario los pone el sistema).

## Arquitectura y stack
- **Backend** `Blanquita-Backend/`: Python ≥3.13, FastAPI, SQLAlchemy 2 ORM, psycopg2, PyJWT ES256 (JWKS de Supabase), httpx (GoTrue), slowapi (login 5/min, refresh 20/min), reportlab, openpyxl, segno, argon2, uv. Docs en `/documentacion`. Zona `America/La_Paz`. Env: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **BD**: PostgreSQL en Supabase. Lógica en servicios Python con ORM; la única función SQL vigente es `custom_access_token_hook` (inyecta `IdUsuario`, `IdRol`, `IdEstadoUsuario`, `IsAdmin` en `app_metadata` si el usuario está Activo).
- **Frontend** `Blanquita-Frontend/`: Astro 7 SSR (adapter node standalone) con islas **solo React 19**, Tailwind 4 + shadcn (base-ui, estilo base-nova), lucide-react/@lucide/lab, sonner, date-fns, react-day-picker, recharts (`ui/chart`), jose, qr-scanner, print-js. Alias `@`=`src`. bun; dev `astro dev --background` (4321). Env: `SUPABASE_URL`, `BACKEND_URL`.
- **Auth**: CI+clave → `POST /api/auth/login` (Astro) → backend `/auth/login` (correo sintético `{ci}@papelblanquita.invalid`) → Astro verifica el JWT y guarda cookies httpOnly `token` (15 min) y `refresh_token` (12 h). `middleware.js` protege `/operador`, `/encargado`, `/admin` (este exige `IsAdmin`), refresca y redirige por rol. El navegador solo llama a `/api/...`; el proxy `pages/api/[...path].js` añade `Authorization: Bearer` (reenvía PDFs y `Content-Disposition`). Cerrar sesión usa `/auth/logout-todos`.

## Estructura de carpetas y archivos clave
Backend `app/` por dominio (BobinaPapel, BobinaServilleta, Rodela, Empaque, Insumo, InventarioFinal, Proveedor, Qr, Usuario, AlertaStock, Notificacion, MateriaPrima, Inicio):
- `Routes/` (APIRouter) → `Services/` (reglas, `HTTPException` en español) → `Repository/` (`DbCaller.Consultar(select)` para lecturas; `with_for_update()` + `add/flush/commit` y `Revertir()` para escrituras). `Repository/Consultas.py`: `turno_actual`, `nivel_stock`, `visible_en_inventario`, `filtro_rango`, `nombre_operador`.
- `Models/` = Pydantic; `Schemas/` = tablas ORM; `Reportes/` PDFs (`reporte.py` clase `Reporte`) y Excel; `Auth/` (`Dependencies.py`: `get_current_user`, `require_role`, `require_admin_db`, `get_generado_por`; `Jwt.py`, `Security.py`, `Limiter.py`); `Constants/` (`Roles`, `Estados`, `Cantidades`, `AlertaStock`, `HistorialAdmin`, `Producto`); `utils/` (`validators.py`, `dates.py`, `inicio.py`); `Config/supabase.py` (NullPool, sslmode require); `Middleware/Middleware.py`.
- `bd.sql` (tablas), `data.sql` (semillas), `Funciones.sql` (dump histórico plpgsql, no usado). `scripts/probar_admin_usuarios.py` (E2E admin), `app/testBd.py` (prueba Auth con credenciales hardcodeadas), `test.md` (copias de código viejo).

Frontend `src/`:
- `pages/` por rol: `operador/…`, `encargado/…` (+ `ingreso`, `reportes/…`, `producto/salidas`), `admin/…` (usuarios, proveedores, insumos, bobina-papel, bobina-servilleta(+formatos), rodela, empaques/[clase], productos(+presentacion/[id]), accesos, acciones); `api/` proxy y auth. Cada página: `NavBar` (móvil) / `SideBar` (desktop) + componente `client:load` + `BottomBar` (QR).
- `components/<Dominio>/`, compartidos en `Produccion/`, `Inventario/`, `IngresoLote/`, `Inicio/comunes.jsx`, `Reportes/comunes.jsx`, `Admin/MateriaPrima/comunes.jsx` (`PaginaTipos`, `PaginaFormularioTipo`), `layout/`, `ui/` (shadcn).
- `services/<Dominio>/*.js` (`pedirJson`/`pedir` de `utils/api.js`), `models/<Dominio>/*.js` (mapeadores `XRequest`/`XResponse`, campos PascalCase como el backend), `hooks/` (`useProduccion`, `useReporte`, `useCatalogo`, `useEjecutar`, `useIngresoLote`, `useDetalleInventario`, `useDescarga`, `useOpciones`), `constants/` (`Values.js` límites/roles/turnos, `Estados.js`, `NavBarRoutes.js`, `OperadorConfig.js` áreas y motivos, `BottomBarOptions.js`), `utils/` (`stock.js`, `validators.js`, `dates.js`, `catalogo.js`, `QR.js`, `downloadFile.js`, `mensajeFlash.js`).
- `astro.config.mjs`: toda dependencia de cliente (incl. cada `@base-ui/react/<x>`) va en `vite.optimizeDeps.include`.

## Modelo de datos
Identificadores `"PascalCase"`, PK `Id<Tabla>`.
- Usuarios: `Usuario` (AuthUserId, IdRol, IdEstadoUsuario, Ci único, IsAdmin), `Rol` (1 Operador, 2 Líder), `EstadoUsuario` (1 Activo, 2 Inactivo, 3 Suspendido definitivo), `HistorialAdmin`, `RegistroIngreso` ('Ingreso' | 'Salida' | 'Intento fallido'), `Turno` (Mañana 06–11:59, Tarde 12–15, Horas Extra resto).
- `Proveedor` (`Activo`). Catálogos con `Activo`: `TipoInsumo` (inactivo = sin ingresos, salida sí), `TipoBobina`, `TipoBobinaServilleta`, `TipoRodela`, `TipoEmpaque`, `TipoEmpaqueBolsa`, `TipoBolsaJava`, `Producto`, `PresentacionProducto` (inactivo = no se ofrece en registros nuevos, el stock sigue). Fuera del admin, inventarios e inicio ocultan inactivos sin stock (`visible_en_inventario`) y marcan los que tienen con `BadgeInactivo`; `IncluirInactivos=true` en `/insumo`, `/empaquebolsa` y `/bolsajava` `/inventario` para filtros de reportes.
- Bobina papel: `TipoBobina` → `LoteBobina` → `BobinaPapel` (código único, pesos, gramaje) → `MovimientoBobina`.
- Bobina servilleta: `TipoBobinaServilleta` (`CantidadUnidades`) ↔ `TipoBobinaServilletaFormato` ↔ `FormatoSubBobina` → `FormatoSubBobinaDetalle` (medida × cantidad); `TipoMedidaSubBobina` (MedidaMm única); `LoteBobinaServilleta` → `BobinaServilleta` (madre) → `UnidadBobinaServilleta` → `SubBobinaServilleta` (se crean al abrir); movimientos de bobina y sub-bobina.
- Rodela: `TipoRodela`, `LoteRodela`, `Rodela` (pallet), `MovimientoRodela`.
- Empaque: `LoteEmpaque` (toneladas); en bobina `TipoEmpaque`/`Empaque`/`MovimientoEmpaque`; en bolsa `TipoEmpaqueBolsa`/`InventarioEmpaqueBolsa`/`MovimientoEmpaqueBolsa`; jaba `TipoBolsaJava`/`InventarioBolsaJava`/`MovimientoBolsaJava`.
- Insumo: `TipoInsumo`/`InventarioInsumo`/`MovimientoInsumo` (sin estado).
- `EstadoMateriaPrima`: 1 En almacén, 2 En producción, 3 Agotado, 4 Dado de baja, 5 Fuera de Inventario, 6 Abierta, 7 Terminada. `TipoMovimientoMateriaPrima`: 1 Ingreso, 2 Traslado, 3 Devolución, 4 Baja, 5 Retiro por falla, 6 Reingreso, 7 Producción terminada, 8 Corrección, 9 Cambio de línea.
- Producción: `EstadoProduccion` (1 En Producción, 2 Pausa, 3 Finalizado, 4 Cancelada, 5 Cambio de línea); `ProduccionBobinaTubo` (IdBobina_1/_2, IdProducto, turno, CantidadLogsActual) + `PausaProduccionBobinaTubo` (con `MotivoReanudacion`), `CancelacionProduccionBobinaTubo`, `MovimientoOperadorLogs` (1 Ingreso, 2 Descuento); `ProduccionServilleta` (IdSubBobina) + pausa/cancelación.
- PT: `Producto` (siglas 3 letras; `IdTipoBobina` o `IdTipoBobinaServilleta` o ninguno) → `PresentacionProducto` (Jaba|Plancha, `CantidadRollosUnidades`, `CantidadPorUnidadTerminada`, código `SIG-J12`) → `InventarioProductoTerminado` → `MovimientoProductoTerminado` (`TipoMovimientoInventario` 1 Entrada, 2 Salida, 3 Descuento, 4 Aumento, 5 Ajuste +, 6 Ajuste −).
- Alertas: `StockMinimo`/`StockPreventivo` (ambos o ninguno, preventivo > mínimo, ≤10000) en tipo o inventario; nivel Crítico ≤ mínimo, Bajo ≤ preventivo, calculado (`nivel_stock`, front `estadoStock`).
- Semillas (`data.sql`): tipos papel Higiénico/Toalla/Económico; servilleta `G-18 CR-14%` (2 unidades, formatos 435x3 y 435x2+220x1); productos LUX, ECO, SRV, MRO, ECN, MER, TOA; empaque bobina Luxury 24/12/6, EcoPack 12/6/4; 12 bolsas de jaba; insumos; proveedor `Papelera del Sur S.R.L.`.
- `bd_diagrama_er.sql`/diagrama de PG9 están desactualizados (EstadoProveedor, sin formatos de sub-bobina).

## Endpoints y flujos importantes
- `/auth` (login, refresh, logout, logout-todos) · `/Usuario` (admin: crear con cuenta Auth, listar, editar, estado, clave; `ver` = perfil) · `/registroingreso` y `/historialadmin` (admin: listar, reporte, usuario/resumen, usuario/reporte).
- Bobina papel: `/bobinapapel` (cargarlote, obtenertipos, editar, tipo/*) · `/papelbobina/inventario` (resumen, detalle, reingresar, fuera) · `/papelbobina/produccion` (iniciar con 2 bobinas + producto, cambiarlinea, pausar, reanudar, finalizar → bobinas Agotado, cancelar solo en Pausa → Fuera de Inventario, insertarlog, activas, pausadas) · `/papelbobina/reportes/*` · `/papelbobina/inicio/resumen`.
- Servilleta: `/bobinaservilleta` (cargarlote, obtenertipos, inventario/*, produccion: abrir libera sub-bobinas, iniciar 1 sub-bobina, pausar, reanudar, finalizar, cancelar; activas/pausadas muestran medida y formato; reporte/*, tipo/*, formato/*, inicio/resumen).
- Rodela: `/rodela` (cargarlote, obtenertipos, inventario: trasladar → Abierta, corregir, reingresables, deshacer ≤30 min, editar; reportes/*, tipo/*, inicio/resumen).
- Empaque: `/empaquebobina` (cargarlote, trasladarproduccion → Agotado, reingresables/reingresar ≤30 min), `/empaquebolsa` y `/bolsajava` (inventario, cargarlote, salida, reingreso ≤5), `/empaque/reportes/{clase}`, `/empaque/tipo/{clase}`, `/empaque/inicio/{clase}/resumen`.
- Insumo: `/insumo` (inventario, ingreso, salida 1–100; admin listar (filtro Activo)/detalle/crear/editar/estado; reportes/*; inicio/resumen).
- PT: `/productofinal` (insertar, salida = despacho de varias presentaciones, ajuste/positivo, ajuste/negativo, correccion, inventario/ver, obtenerproductos, `aumento` obsoleto sin uso en el front) · `/productofinal/reportes` (produccion/diaria, inventario, salidas PDF/Excel, salidas/despacho/{id}) · `/productofinal/inicio/*` · `/producto` admin (linea/*, presentacion/*). Despacho = movimientos con misma `FechaMovimiento` + usuario; N° = menor IdMovimiento.
- `/proveedor` (formulario solo activos; admin listar/crear/editar/estado) · `/alertastock` (resumen, umbrales, PATCH umbral) · `/notificaciones/resumen` (stock solo para líder) · `/qr` (carteles PDF; el QR codifica la ruta sin prefijo de rol y el escáner le antepone el del usuario).
- PDFs con "Generado por" (nombre, CI, rol); el front descarga con `descargarDesdeUrl`/`imprimirPDF`.

## Requerimientos y reglas de negocio del cliente
- Ingreso por lote: un tipo por lote, proveedor de catálogo, se respeta el código del proveedor; espacios → guion; todo ingreso se registra antes de usarse. Confirmación con casilla antes de guardar.
- Bobina papel: producción = par de bobinas ("cargada", doble hoja); logs por cargada y producto, solo Ingreso/Descuento, inicia en 0, máx. 100 por registro (cliente dijo 1000; se eligió 100). Cambio de línea solo líder y solo en tipos con >1 producto activo (hoy Higiénico): cierra como "Cambio de línea" y abre otra con contador en 0. Pausas con motivo y reanudación con motivo. Cancelar solo pausada → Fuera de Inventario → solo reingreso (marcado "reingresada"). Dar de baja: raro, desde admin.
- Servilleta: bobina madre de 2 unidades; abrir libera sub-bobinas (435/220); dos máquinas en paralelo; línea única "servilletas"; sin selección de producto.
- Rodela: por pallet; traslado reversible 30 min. Empaque en bobina igual (30 min).
- Empaques: bobina (código, peso, toneladas) y bolsa (conteo); según el cliente cada presentación tiene su propio empaque (Luxury 6/12/24, EcoPack 4/6/12); bolsas de jaba.
- Insumos (pegamentos en turriles/tanques, vaselina, maicena, talco, ligas): solo conteo de entrada/salida.
- PT: por jabas, salvo planchas (MegaRollo, Económico) y merma; QR único y se elige presentación; manual + máquina suman igual; sin trazabilidad PT→producción. Ingreso 1–100, corrección (descuento) 1–50 también operador, ajustes ±1–500 solo líder, salida hasta 5000 por presentación con observación.
- Reportes diarios/semanales/mensuales, trazabilidad por bobina, lotes por proveedor/rango. Gerente (charlaGerente): vistas de consulta (producciones activas/pausadas/finalizadas, duración de pausas, stock, salidas), reportes rápidos, sin comparación mensual obligatoria.
- Clave 8–12 con mayúscula, número y símbolo; sesión 12 h. El cliente confirmó (2026-10-09) que no habrá nuevos tipos de materia prima ni líneas.

## Estado actual
Implementado (backend + front): auth con refresh, roles y auditoría de accesos; panel admin (usuarios, proveedores, insumos, tipos de bobina papel/servilleta/rodela, formatos de sub-bobina, tipos de empaque, líneas y presentaciones, umbrales de stock, accesos, acciones con `HistorialAdmin`); ingreso por lote, inventario, edición, reingreso y producción completa de bobina papel y servilleta; rodela; empaques en bobina, bolsa y jaba (ingreso, salida, reingreso); insumos; PT (ingreso, corrección, ajustes, salidas/despachos con PDF y Excel); reportes PDF de todos los dominios; inicio del líder por área con indicadores semanales y gráficos; notificaciones (alertas de stock, producciones activas/pausadas atrasadas); carteles QR y escáner.

Falta:
- Dar de baja materia prima desde admin (sin API).
- Rediseño de empaques por presentación (vincular `TipoEmpaque` con `PresentacionProducto`); confirmar "Mega 20" y si Papel Toalla lleva empaque en bobina.
- Quitar endpoint `/productofinal/aumento`.
- Panel de solo lectura del gerente; cobertura en días de PT; gráfico mensual de producción.
- Lógica que pase la bobina servilleta a Terminada (7); validar "una producción activa por formato/máquina" en servilleta.
- Pendiente del cliente: proveedores oficiales, empaques, layout de planta, fichas de materia prima.

## Convenciones de código observadas
- Todo en español. Python: clases, métodos de servicio/repositorio y campos en PascalCase; helpers y dependencias en snake_case; constantes en MAYÚSCULAS en `Constants/`. Validación de textos con `ValidarTexto(5,150)` + `REGLA_CARACTERES_OBSERVACION`; motivos obligatorios en correcciones, pausas, reanudaciones, cancelaciones y cambios de estado. Repos de reportes reciben `params` con claves `p_*`. Acciones admin: ORM + `with_for_update()` + `HistorialAdmin` en la misma transacción (al agregar una acción nueva, sumar su prefijo en `Constants/HistorialAdmin.py`).
- Front: componentes `.jsx` PascalCase, servicios camelCase, modelos `XRequest/XResponse`; errores con `toast`; límites en `constants/Values.js`; acciones irreversibles con casilla de confirmación; mobile-first; el botón de base-ui no admite `asChild` (navegar con `onClick`/`render`). Componentes de catálogo admin configurados por un objeto `CONFIG`. Atajos de período compartidos en `components/Reportes/Empaque/filtros.js`.

## Decisiones tomadas y pendientes
- Migración total a ORM (2026-10-17); las funciones plpgsql viejas se borran en Supabase tras validar. `EditarRodela`, `EditarBobinaPapel`, `EditarBobinaServilleta`, `CambiarLineaProduccionBobinaTubo` y reportes de PT se reconstruyeron sin el original.
- Empalmes como motivo de pausa; PT sin vínculo con producción; perfil solo editable por admin; catálogos en panel admin (Carlos y Osvaldo con `IsAdmin`); no existe rol "Gerente general" en código (sí en PG9).
- Observaciones a revisar (interpretación del análisis, no pedidas por el cliente):
  - Roles: `cargarlote` de servilleta, rodela y empaque bobina permiten Operador (papel, bolsa y jaba solo líder); reanudar lo permite el operador (PG9 dice solo líder); reportes de servilleta permiten operador y los demás solo líder.
  - Hardcodeos: reporte PT `IDS_PRODUCTO_EN_UNIDADES={4,5,6}`/`ID_PRODUCTO_MERMA=6` (debería usar `TipoContenedor`); `UMBRAL_STOCK_BAJO=6` en `Reportes/Insumo.py` y `components/Reportes/Insumo/filtros.js` en vez de los umbrales configurados; `InventarioOperador.jsx` detecta servilleta por nombre.
  - `DOMINIOS_STOCK_NOTIFICACION` solo bobina papel y PT. `main.py`: CORS `*`, `debug=True`, `LoggingErrorMiddleware` sin registrar, `precargar_jwks` sin uso.
  - Restos: `Routes/Insumo/InsumoRouter.py` vacío, `Constants/TipoBobina.py` vacío, `models/Usuario/UsuarioLogIn.js` sin uso, `pages/encargado/reportes/bobina-papel/producción.astro` vacío, `pages/sidebar-test.astro`, carpetas vacías `components/Qr/`; campo Tara del ingreso de bobina papel no se usa; saludo de turno en `InicioOperador` (<15 h Mañana) no coincide con `Turno`; comentarios/docstrings en `UsuarioRepository`, `UsuarioService`, `Security.py`, `reporte.py`, `Produccion/Concluidas.jsx`, `constants/Estados.js`.
  - Credenciales de prueba hardcodeadas en `app/testBd.py`.
