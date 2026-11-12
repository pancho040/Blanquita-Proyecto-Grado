# Guía de Despliegue en Render - Backend FastAPI (Papelera Blanquita)

Este documento detalla las consideraciones de arquitectura, variables de entorno requeridas y comportamiento del backend FastAPI de Papelera Blanquita al desplegarse como un **Web Service** en la plataforma Render.

---

## 1. Variables de Entorno Requeridas

Al configurar el servicio web en el panel de Render (o mediante `render.yaml`), deben registrarse las siguientes variables de entorno. **Nunca incluir valores secretos en el repositorio.**

| Variable | Tipo | Descripción | Ejemplo / Valor por defecto |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Secreto | Cadena de conexión PostgreSQL (Supabase Transaction Pooler o Session Pooler). | `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres` |
| `SUPABASE_URL` | Público | URL base del proyecto Supabase. | `https://[ref].supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secreto | Clave de servicio de Supabase con permisos de administración (necesaria para firmar URLs y escribir en buckets privados de Storage). | `eyJhbGci...` |
| `STORAGE_SUPABASE_ACTIVO` | Configuración | Activa el almacenamiento particionado en Supabase Storage. Debe ser `true` en producción. | `true` |
| `SUPABASE_STORAGE_BUCKET` | Configuración | Nombre del bucket privado creado en Supabase. | `comprobantes-privados` |
| `STORAGE_RETENCION_DIAS` | Configuración | Días de vigencia antes de la depuración automática (unificado a 60 días). | `60` |
| `JWT_SECRET_KEY` | Secreto | Clave secreta simétrica o JWKS para validar tokens de usuarios internos. | `...` |
| `PORT` | Render | Puerto asignado por Render (FastAPI/Uvicorn lo escucha automáticamente). | `10000` |
| `VERSION_MINIMA_CLIENTE` | Configuración | Versión mínima compatible para la app móvil React Native. | `1.0.0` |

---

## 2. Almacenamiento y Disco Efímero (Render)

### Advertencia Crítica sobre Disco Local
> [!WARNING]
> En Render Web Services, el disco local es **estrictamente efímero**. Cualquier archivo guardado en el sistema de archivos local (`uploads/comprobantes/`) se **destruye de manera irrecuperable** en cada reinicio de contenedor, cambio de versión o nuevo despliegue.

### Estrategia Implementada
1. **Almacenamiento Primario en Supabase Storage:**
   - Todas las fotos de comprobantes y firmas se envían directamente al bucket privado `comprobantes-privados` mediante la API de Supabase Storage.
   - Particionado ordenado: `sucursal/{id_sucursal}/chofer/{id_chofer}/{uuid}.{ext}`.
   - El registro en la base de datos almacena `StorageProvider = 'supabase'` y `ResubidaPendiente = false`.
2. **Fallback a Disco Local con Alerta:**
   - Si la conexión con Supabase Storage sufre un fallo transitorio de red, el archivo se deposita en disco local efímero para no abortar la venta o cobro del repartidor.
   - Se emite un `WARNING` visible en los logs con el contador acumulado `[STORAGE-FALLBACK-ALERTA] Fallback #N`.
   - Se marca en la base de datos `ResubidaPendiente = true`.
3. **Mecanismo de Resubida Automática:**
   - Al arrancar la instancia en Render (`startup_event`), el backend ejecuta `FileStorageService.reintentar_subidas_pendientes()`.
   - Si existen archivos pendientes y el contenedor aún no ha sido reiniciado, se transfieren a Supabase Storage y se libera el archivo local.

---

## 3. Conexiones WebSocket y Mapa de Flota en Tiempo Real

### Características de Render Web Services
- Render soporta WebSockets de larga duración mediante HTTP Upgrade.
- **Heartbeat obligatorio:** Los proxies perimetrales de Render (Cloudflare/Envoy) cierran automáticamente conexiones inactivas tras 30 a 55 segundos. Por tanto, el backend y el cliente web implementan un ping/pong periódico cada **25 segundos**.
- **Autenticación por Ticket de Un Solo Uso:** Los navegadores no pueden enviar cabeceras `Authorization` estándar en el protocolo `new WebSocket()`. Por seguridad, la web solicita previamente un ticket efímero de 60 segundos vía `POST /api/logistica/flota/ws-ticket` con su Bearer Token, evitando exponer JWTs en URLs o logs del proxy.

### Arquitectura de Instancia Única vs Multi-Instancia
- **Escala Actual (1 instancia):** El hub de WebSockets (`FlotaWebSocketManager`) opera en la memoria de la instancia única de FastAPI. Todos los repartidores que envían pings GPS y todos los operadores web de logística conectados a esa instancia se comunican directamente en tiempo real con latencia inferior a 50 ms.
- **Escalado Horizontal (Multi-instancia futuro):**
  > [!NOTE]
  > Si en el futuro se escala el servicio a 2 o más réplicas en Render, las conexiones en memoria no se comparten entre contenedores. Para ese escenario, se requerirá conectar el hub a un canal Pub/Sub centralizado (como **Redis** o **Dragonfly**) para que los eventos emitidos por un chofer en el contenedor A se difundan a los clientes conectados al contenedor B.
