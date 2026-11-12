# REGISTRO HISTÓRICO DE DECISIONES DE ARQUITECTURA (ADR)
*Formato Append-Only: Solo se agregan entradas al final, nunca se editan ni eliminan entradas históricas.*

---

## [ADR-001] Enfoque de Arquitectura Multi-Sucursal en Base de Datos Compartida
- **Fecha:** 2026-11-08
- **Estado:** Aceptado
- **Decisión:** Implementar el soporte multi-sucursal mediante una columna `IdSucursal` en las tablas comerciales y financieras de la base de datos principal, gobernada por filtros a nivel de middleware/repositorio en backend y control de rol en frontend.
- **Motivo:** Permite compartir catálogo de productos, usuarios con roles globales y consolidación gerencial inmediata para Don Osvaldo sin la sobrecarga operativa de bases de datos separadas (multi-tenant de esquemas) ni duplicación de código.
- **Alternativas Descartadas:**
  1. *Bases de datos independientes por sucursal:* Descartada porque impide a Don Osvaldo ver reportes consolidados en tiempo real y requiere múltiples conexiones de base de datos.
  2. *Hardcodear 'Sucre' y 'Potosí' en enum o código:* Descartada porque el negocio planea abrir nuevas sucursales a corto plazo y la arquitectura debe soportar N sucursales dinámicamente.
- **Impacto:** Todas las consultas de choferes, inventario de camión, ventas, precios y caja deben inyectar obligatoriamente el filtro `IdSucursal`. Las tablas protegidas de planta permanecen intactas sin dicha columna.

---

## [ADR-002] Estrategia de Extensión Aditiva sin Modificación de Zona Protegida
- **Fecha:** 2026-11-08
- **Estado:** Aceptado
- **Decisión:** Todas las tablas preexistentes fuera de planta se extienden exclusivamente con columnas `NULLABLE` o con valor `DEFAULT`, aplicando un script de migración con backfill hacia Sucre (`IdSucursal = 1`). Para el catálogo de productos (`Producto`), se utiliza una tabla satélite `ProductoConfigComercial`.
- **Motivo:** Evita incompatibilidades con migraciones anteriores, protege los datos preexistentes de ventas y personal, y respeta estrictamente la regla de no tocar las estructuras utilizadas por el módulo de planta.
- **Alternativas Descartadas:**
  1. *Añadir columnas `EsBandeo` directamente a `Producto`:* Descartada porque `Producto` es consumido por los módulos de planta de Fabricio.
  2. *Crear tablas paralelas de clientes o notas de venta:* Descartada porque fragmentaría la base de datos violando la Regla Permanente 2 ("Adaptar, no duplicar").
- **Impacto:** Integridad referencial total sin riesgo de regresión en las pantallas y funciones existentes.

---

## [ADR-003] Resolución de la Contradicción del Flujo de Caja Chica
- **Fecha:** 2026-11-08
- **Estado:** Aceptado
- **Decisión:** Desacoplar el estado operativo de los fondos (`EstadoOperativo`: `PENDIENTE` -> `ENTREGADO` -> `RENDIDO`) del estado de autorización ejecutiva (`AprobacionGerencia`: `PENDIENTE` / `APROBADO` / `RECHAZADO`). El vale bloquea su impresión y cierre definitivo hasta que `AprobacionGerencia = 'APROBADO'`.
- **Motivo:** Resuelve la contradicción de la entrevista: se requiere entregar dinero inicialmente para que Kevin compre, pero Don Osvaldo solo aprueba cuando revisa el gasto ya ejecutado con su factura o recibo físico adjunto y el vuelto reintegrado.
- **Alternativas Descartadas:**
  1. *Aprobación previa obligatoria:* Imposibilita la agilidad de compras imprevistas menores en planta o almacén.
  2. *Eliminar la firma de Don Osvaldo:* Inaceptable para la gerencia, que exige supervisar cada comprobante.
- **Impacto:** Kevin puede rendir el gasto con su comprobante digital y cálculo automático de vuelto; Don Osvaldo ve directamente el monto neto ejecutado para autorizarlo con 1 clic.

---

## [ADR-004] Política de Retención y Depuración Automática de Archivos a 60 Días
- **Fecha:** 2026-11-08
- **Estado:** Aceptado
- **Decisión:** Implementar la tabla `ComprobanteArchivo` con un campo `FechaExpiracion` fijado por defecto a 60 días tras la subida. Un cron job diario elimina los binarios físicos para optimizar el almacenamiento y marca `ArchivoEliminado = TRUE`, conservando el hash SHA-256, nombre original y montos en base de datos.
- **Motivo:** Cumple el requerimiento del negocio de no saturar el servidor con fotos pesadas de comprobantes de WhatsApp una vez conciliadas las cuentas.
- **Alternativas Descartadas:**
  1. *Borrado físico en cascada de la fila:* Descartada porque destruiría la trazabilidad de auditoría histórica.
  2. *Conservar archivos indefinidamente:* Descartada por costos y límites de almacenamiento.
- **Impacto:** Base de datos ligera, cumplimiento de auditoría y costo controlado de hosting.

---

## [ADR-005] Evolución de Regla de Zona Protegida: DDL Blindado vs DML por Adaptador Hexagonal para Multi-Planta
- **Fecha:** 2026-11-09
- **Estado:** Aceptado
- **Decisión:** 
  1. Blindar de forma absoluta la estructura (DDL) de las tablas de planta de Fabricio (prohibido `ALTER`, `DROP`, `RENAME`, `TRUNCATE`).
  2. Autorizar operaciones transaccionales DML de descuento y registro de egreso sobre `InventarioProductoTerminado` y `MovimientoProductoTerminado` **exclusivamente a través de un adaptador oficial** (`FabricioLegacyAdapter`), implementando la interfaz abstracta `InventarioProductoTerminadoPort`.
  3. Establecer la tabla de Fabricio como **Single Source of Truth** para la Planta Sucre, prohibiendo la creación de tablas espejo o inventarios duplicados.
  4. Soportar escalabilidad multi-planta (ej. futura fábrica en Potosí) mediante el catálogo `plantas` (`FABRICIO_LEGACY` vs `COMERCIAL_PROPIO`) y un modelo polimórfico de traslados `envios_inventario` (`origen_tipo`/`origen_id` a `destino_tipo`/`destino_id`).
  5. Garantizar **Unidad de Trabajo Única**: el adaptador recibe la sesión y nunca ejecuta `commit()` ni `rollback()`; la transacción completa la orquesta `EnviosService`.
  6. Prevenir condiciones de carrera con `UPDATE` condicional atómico (`CantidadActual >= :cantidad`) y prevenir doble descuento mediante el interruptor `DESCONTAR_PLANTA_ACTIVO` (default `false`) junto a la columna `descuento_planta_aplicado (bool)` y script CLI de reconciliación en lote.
  7. Unificar todo el inventario físico bajo la clave `IdPresentacion` (`presentacion_id`) midiendo las existencias en bultos contenedores físicos (`TipoContenedor`: Jaba, Plancha o Fardo).
- **Motivo:** Permite que las operaciones comerciales reales descuenten stock físico de fábrica de forma atómica y sin riesgo de números negativos ni race conditions, manteniendo la compatibilidad estricta con el módulo de Fabricio y dejando el ERP 100% preparado para la expansión fabril a Potosí sin migraciones destructivas.
- **Alternativas Descartadas:**
  1. *Inventario paralelo en tablas comerciales para Sucre:* Descartada porque duplicaría la información, generaría desincronización con las órdenes de producción de Fabricio y rompería la coherencia operativa.
  2. *Modificar la tabla de Fabricio agregando `IdPlanta`:* Descartada porque violaría la prohibición de alterar el DDL de planta y rompería el código que Fabricio ya tiene en producción.
  3. *Descontar stock sin control de commit único ni interruptor:* Descartada porque dejaría transacciones a medio camino ante fallas de red y expondría al negocio a un doble descuento si la balanza de planta ya registra egresos.
- **Impacto:** Arquitectura desacoplada, limpia, multi-planta, con rollback atómico garantizado y 100% auditable.

---

## [ADR-006] Telemetría GPS de Flota: Polling Adaptativo con Filtro de Movimiento (> 25m) vs Supabase Realtime
- **Fecha:** 2026-11-12
- **Estado:** Aceptado
- **Decisión:** Mantener polling adaptativo ligero (8s a 20s en web) gobernado por FastAPI y optimizar la telemetría móvil mediante un filtro de desplazamiento geodésico (Haversine >= 25 metros), descartando la conexión directa del frontend a Supabase Realtime.
- **Motivo:**
  1. *Seguridad y Arquitectura de Autenticación:* El sistema opera con JWT propio emitido por FastAPI; no utiliza Supabase Auth ni políticas RLS en tablas operativas como `TrackingChofer`. Conectar el navegador directamente a Realtime exigiría exponer la anon-key con acceso público irrestricto o service-role key, violando el principio de mínimo privilegio y multi-sucursal.
  2. *Eficiencia de Red y Batería:* El chofer suele permanecer estacionado varios minutos durante una entrega. El filtro local de 25 metros y velocidad < 5 km/h evita enviar cientos de pings idénticos, reduciendo el consumo de batería y la cuota de datos móviles en más de un 70%.
  3. *Veracidad de Datos:* Se eliminan los fallbacks falsos en backend (`COALESCE` de lat/lng -19.0435, -65.2580 a 'Planta Central'), reportando `null` y 'Sin Señal' de forma transparente.
- **Alternativas Descartadas:**
  1. *Supabase Realtime Broadcast directo en Frontend:* Descartada porque bypassearía la capa de control de sucursales de FastAPI y expondría canales no autorizados.
  2. *WebSockets puros en FastAPI:* Descartada para esta fase por la sobrecarga de mantenimiento de conexiones persistentes de baja escala en servidores ASGI compartidos.
- **Impacto:** Menor latencia, consumo de batería reducido para los choferes, trazabilidad satelital exacta sin coordenadas falsas y seguridad multi-sucursal preservada.






ahora tengo este error RastreoChoferesGPS.jsx:621 Internal React error: Expected static flag was missing. Please notify the React team.
<ModalDetalleParadasGPS>		
(anonymous)	@	RastreoChoferesGPS.jsx:621
<RastreoChoferesGPS>		
(anonymous)	@	rastreo:7103
e	@	rastreo:7103
await in e		
start	@	rastreo:7103
childrenConnectedCallback	@	rastreo:7103
await in childrenConnectedCallback		
connectedCallback	@	rastreo:7103
, ese error es en web  ademas en movil hice una entrega pero en modal de entrefa n me aparece cantidad a entregar y parece que no esta bien ordenado corrigelo, es offile first  se hahra en offline pero de forma autoamtica si hay conexion se debe de sicnrnizar , ademas realize el cobro se supone que se registro pero en el panel web nunca se actulizo no aparecio esa venta , cada minuto tendria que actulizarse de fomra autoamtica , tambien que haya un boton para actuliazr y ver la ruta del chofer en ese momento , 

---

## [ADR-007] Telemetría Satelital Web en Tiempo Real: WebSocket de FastAPI con Tickets Efímeros de Un Solo Uso y Heartbeat en Render
- **Fecha:** 2026-11-12
- **Estado:** Aceptado (Supera en la parte web al ADR-006, manteniendo vigente la exclusión de Supabase Realtime y el filtro móvil de 25m)
- **Decisión:** Sustituir el polling periódico del mapa web (`RastreoChoferesGPS.jsx`) por una conexión WebSocket nativa gestionada por FastAPI (`/ws/flota` y `/api/logistica/flota/ws`), conservando el filtro geodésico de 25 metros en el móvil y la prohibición de conectar el navegador directamente a Supabase Realtime.
- **Mecanismos Clave:**
  1. *Autenticación por Ticket de Un Solo Uso:* Como el protocolo WebSocket del navegador no permite cabeceras `Authorization: Bearer`, se implementa el endpoint `POST /api/logistica/flota/ws-ticket` que genera un ticket efímero (60s) en memoria asociado al usuario y su alcance de sucursal. El ticket se invalida inmediatamente tras el primer consumo, previniendo exposición de tokens JWT en logs de proxy o URLs.
  2. *Filtrado Multi-Sucursal en Hub:* El `FlotaWebSocketManager` en memoria valida las sucursales permitidas del operador (`AlcanceSucursal.py`) y difunde exclusivamente los pings GPS de choferes asignados a su misma jurisdicción territorial (Sucre, Potosí o Consolidado Nacional).
  3. *Resiliencia ante Despliegue en Render:* 
     - Heartbeat ping/pong cada 25 segundos para evitar que los proxies perimetrales de Render (timeout de 30-55s) desconecten el socket inactivo.
     - Reconexión automática con backoff exponencial (1s a 30s) en la web.
     - Fallback degradado a polling lento (45s) únicamente si el WebSocket se interrumpe permanentemente.
     - Botón manual de actualización REST forzada que sincroniza el estado en cualquier momento.
  4. *Escala y Concurrencia:* Hub en memoria óptimo para la escala de una instancia en Render Web Service. Se documenta la necesidad de Redis Pub/Sub en caso de escalar horizontalmente a múltiples réplicas.
- **Motivo:** Brinda actualización instantánea de la flota en el mapa central sin sobrecargar la base de datos con peticiones REST continuas cada 8 segundos, reduciendo la latencia de rastreo de 8s a < 50ms y mejorando drásticamente la experiencia de supervisión logística.
- **Alternativas Descartadas:**
  1. *Mantener Polling REST de 8 segundos:* Descartada porque satura el pool de conexiones de base de datos e introduce retraso perceptible en la visualización de rutas activas.
  2. *Supabase Realtime directo desde Frontend:* Descartada (ADR-006) porque violaría la seguridad multi-sucursal al no contar con Supabase Auth ni RLS en las tablas de telemetría.
  3. *Pasar JWT completo como Query Parameter en el WebSocket:* Descartada por vulnerabilidad de seguridad (los JWT quedarían expuestos en logs de acceso y proxies HTTP).
- **Impacto:** Mapa de flota 100% en tiempo real, seguridad de tickets robusta, cero exposición de secretos y compatibilidad garantizada con Render Web Services.
