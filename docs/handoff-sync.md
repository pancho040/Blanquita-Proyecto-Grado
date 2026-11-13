# DOCUMENTO DE RELEVO Y SINCRONIZACIÓN (HANDOFF-SYNC)
**Sistema ERP Papelera Blanquita — Sincronización Móvil <-> Backend <-> Web**
**Rama:** `feat/repartidores` | **Fecha:** 2026-11-12

Este documento establece de forma vinculante los contratos de interfaz entre `Blanquita-Backend` y `Blanquita-Mobile` (Chat 1) para la Fase de Repartidores, cubriendo la autenticación resiliente y la operación transaccional unificada de entrega con cobro.

---

## 1. CONTRATO "AUTH MÓVIL" (ACCESS TOKEN CORTO + REFRESH TOKEN LARGO CON ROTACIÓN)

### 1.1 Políticas de Vigencia y Rotación
- **Access Token:** Vida corta (típico 1 hora / 3600 s, máx 2 horas).
- **Refresh Token:** Vida extendida (30 días / 2,592,000 s). Almacenado como hash seguro (SHA-256) en la base de datos vinculado al `IdUsuario` y dispositivo.
- **Rotación Estricta:** Cada invocación exitosa a `/auth/refresh` genera un nuevo par (nuevo `access_token` y nuevo `refresh_token`), invalidando el refresh token previo.
- **Detección de Reutilización (Reuse Detection):** Si un `refresh_token` previamente rotado o revocado vuelve a ser enviado, el backend detecta posible suplantación/robo de sesión y **revoca de inmediato toda la cadena de sesiones activas** de ese usuario/dispositivo.
- **Revocación:** El refresh token se revoca automáticamente en:
  1. `POST /api/movil/v1/auth/logout`
  2. Cambio de contraseña del usuario.
  3. Desactivación o suspensión del chofer (`IdEstadoUsuario != 1`).

---

### 1.2 Inicio de Sesión Móvil
- **Endpoint:** `POST /api/movil/v1/auth/login`
- **Request Body:**
```json
{
  "ci": "4859201",
  "clave": "ChoferSeguro2026*"
}
```
- **Response Exitosa (HTTP 200):**
```json
{
  "codigo": "EXITO",
  "mensaje": "Sesión iniciada correctamente",
  "request_id": "req-b4f0b2f1-628a-4d7a-b9c2-57fa231bcde4",
  "datos": {
    "access_token": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "blq_ref_8f3a09c2d1e5482390a1b2c3d4e5f6a7b8c9d0e1",
    "token_type": "bearer",
    "expires_in": 3600,
    "usuario": {
      "id_usuario": 12,
      "nombre": "Carlos",
      "apellido": "Mamani Mamani",
      "ci": "4859201",
      "id_rol": 5,
      "nombre_rol": "Chofer",
      "sucursales_permitidas": [1],
      "puede_ver_todas": false,
      "sucursal_defecto": 1
    }
  }
}
```

---

### 1.3 Refresco de Token Móvil
- **Endpoint:** `POST /api/movil/v1/auth/refresh`
- **Cabeceras:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "refresh_token": "blq_ref_8f3a09c2d1e5482390a1b2c3d4e5f6a7b8c9d0e1"
}
```
- **Response Exitosa (HTTP 200):**
```json
{
  "codigo": "EXITO",
  "mensaje": "Token renovado exitosamente",
  "request_id": "req-a721d01f-0e83-4a11-b01c-6d96205842ef",
  "datos": {
    "access_token": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.nuevo...",
    "refresh_token": "blq_ref_99ab12cd34ef56781234567890abcdef12345678",
    "token_type": "bearer",
    "expires_in": 3600
  }
}
```

---

### 1.4 Manejo de Errores HTTP 401 en el Cliente Móvil
Todas las respuestas de fallo de autenticación devuelven un código estructurado en el cuerpo (`codigo`) y en el detalle para permitir toma de decisiones determinística en los interceptores de red de la app:

| Situación | HTTP Status | Código de Error | Mensaje / Detalle | Acción que debe tomar la App Móvil |
| :--- | :--- | :--- | :--- | :--- |
| **Access Token Expirado** | `401 Unauthorized` | `TOKEN_EXPIRADO` | "Token expirado" | Pausar peticiones, llamar a `POST /auth/refresh` con el `refresh_token` guardado, actualizar tokens y reintentar la petición original. |
| **Token Inválido o Malformado** | `401 Unauthorized` | `TOKEN_INVALIDO` | "Token inválido o firma incorrecta" | Limpiar credenciales almacenadas y redirigir inmediatamente a pantalla de Login. |
| **Refresh Token Expirado o Inexistente** | `401 Unauthorized` | `TOKEN_INVALIDO` | "Refresh token expirado o inexistente" | Limpiar credenciales almacenadas y redirigir a Login. |
| **Reutilización de Refresh Token (Robo)** | `401 Unauthorized` | `TOKEN_INVALIDO` | "Sesión revocada por actividad sospechosa" | Limpiar credenciales almacenadas, alertar al usuario y redirigir a Login. |
| **Chofer Desactivado / Inactivo** | `403 Forbidden` | `USUARIO_INACTIVO` | "Usuario inactivo, no puede operar el sistema" | Bloquear pantalla y mostrar advertencia de contactar al Administrador. |

**Formato JSON de Error 401:**
```json
{
  "codigo": "TOKEN_EXPIRADO",
  "detail": "Token expirado",
  "mensaje": "El token de acceso ha expirado, use refresh_token"
}
```

---

## 2. CONTRATO "ENTREGA CON COBRO" (OPERACIÓN TRANSACCIONAL UNIFICADA)

Para garantizar consistencia transaccional absoluta en escenarios de conectividad inestable en ruta (Sucre y Potosí), se extiende el endpoint `POST /api/movil/v1/chofer/entregar` para soportar un bloque opcional `"cobro"`.

- Si el bloque `"cobro"` no se envía, el endpoint opera en modo tradicional (solo entrega física, firma y descuento de camión).
- Si el bloque `"cobro"` está presente, **se ejecuta una única transacción ACID**:
  1. Valida saldo y descuenta inventario del camión (`inventario_chofer`).
  2. Registra entrega física, observaciones y doble firma digital (chofer y cliente).
  3. Registra los tramos de pago:
     - `EFECTIVO`: Registrado como `CONFIRMADO` en pagos del pedido.
     - `QR` o `TRANSFERENCIA`: Registrado como `PENDIENTE_APROBACION` con su `id_comprobante_archivo` asociado para auditoría de Kevin (Contabilidad).
  4. Si existe saldo remanente a crédito o se especifica el bloque `"credito"`: se crea o asienta la Cuenta por Cobrar (`CuentaCobrar`) con su plazo o cuotas.
  5. Sincroniza `NotaVenta` (firmas, estados).
  6. Si cualquier paso falla, **se revierte la transacción completa (Rollback total)** sin dejar cobros huérfanos ni mermas ficticias.
- **Idempotencia Estricta:** Exige cabecera `X-Idempotency-Key: <UUIDv4>`. Ante reintentos con la misma clave y payload, responde con el resultado previo sin duplicar cobros ni entregas.

### 2.1 Endpoint
- **URL:** `POST /api/movil/v1/chofer/entregar`
- **Cabeceras Obligatorias:**
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
  - `X-Idempotency-Key: <UUIDv4>` (ejemplo: `8e9f50cb-2292-48ec-9252-ebf6fa088d22`)

---

### 2.2 Payload de Petición (Ejemplo Completo: Entrega Parcial + Cobro Mixto Efectivo/QR + Saldo a Crédito)
```json
{
  "id_pedido": 104,
  "latitud": -19.0435,
  "longitud": -65.2580,
  "tipo_entrega": "TOTAL",
  "recibido_por": "Dña. Martha Flores",
  "ci_receptor": "5839201 CH",
  "observacion": "Entregado en tienda central. Pago mixto con QR verificado.",
  "firma_chofer": "data:image/svg+xml;utf8,<svg>...</svg>",
  "firma_cliente": "data:image/svg+xml;utf8,<svg>...</svg>",
  "items_entregados": [
    {
      "presentacion_id": 1,
      "cantidad": 10.0,
      "es_cortesia_bandeo": false
    },
    {
      "presentacion_id": 2,
      "cantidad": 2.0,
      "es_cortesia_bandeo": true
    }
  ],
  "cobro": {
    "monto_total": 450.00,
    "pagos": [
      {
        "metodo": "EFECTIVO",
        "monto": 200.00,
        "numero_referencia": null,
        "id_comprobante_archivo": null
      },
      {
        "metodo": "QR",
        "monto": 150.00,
        "numero_referencia": "BNB-QR-892341",
        "id_comprobante_archivo": 42
      }
    ],
    "credito": {
      "saldo": 100.00,
      "plazo_dias": 15,
      "cuotas": 1,
      "fecha_vencimiento": "2026-11-27"
    }
  }
}
```

#### Validaciones del Servidor en el Bloque Cobro:
1. `suma(pagos[i].monto) + (credito.saldo || 0) == cobro.monto_total`.
2. Para cualquier pago con `metodo == "QR"` o `metodo == "TRANSFERENCIA"`, es **obligatorio** proveer `id_comprobante_archivo` (o `url_comprobante`). Si falta, retorna HTTP 422.
3. El `monto_total` del cobro no debe superar el total valorizado de la entrega o pedido.
4. Las cantidades en `items_entregados` deben ser $\le$ cantidad pendiente del pedido y $\le$ cantidad remanente en `inventario_chofer`.

---

### 2.3 Respuesta Exitosa del Servidor (HTTP 200)
```json
{
  "codigo": "EXITO",
  "mensaje": "Entrega y cobro registrados exitosamente en una sola transacción",
  "request_id": "req-94301a2c-15ab-4c3e-8219-c17876a3b091",
  "datos": {
    "id_pedido": 104,
    "tipo_entrega": "TOTAL",
    "recibido_por": "Dña. Martha Flores",
    "items_entregados": [
      {
        "presentacion_id": 1,
        "cantidad": 10.0
      },
      {
        "presentacion_id": 2,
        "cantidad": 2.0
      }
    ],
    "alerta_revalorizacion": null,
    "cobro": {
      "monto_total": 450.00,
      "monto_pagado": 350.00,
      "saldo_credito": 100.00,
      "tramos": [
        {
          "metodo": "EFECTIVO",
          "monto": 200.00,
          "numero_referencia": "MOVIL-179456-A12F",
          "estado": "CONFIRMADO",
          "id_pago_pedido": 88
        },
        {
          "metodo": "QR",
          "monto": 150.00,
          "numero_referencia": "BNB-QR-892341",
          "estado": "PENDIENTE_APROBACION",
          "id_pago_pedido": 89,
          "id_comprobante_archivo": 42,
          "id_abono_cuenta_cobrar": 34
        }
      ],
      "cuenta_cobrar": {
        "id_cuenta_cobrar": 15,
        "saldo_pendiente": 100.00,
        "plazo_dias": 15,
        "fecha_vencimiento": "2026-11-27",
        "estado": "PENDIENTE"
      }
    }
  }
}
```

---

## 3. PEDIDOS DEL BACKEND AL MÓVIL (`Blanquita-Mobile` - Chat 1)

1. **Implementar Interceptor de Refresh Token en Axios / Redux / Fetch:**
   - Detectar respuesta HTTP `401` con `response.data.codigo === 'TOKEN_EXPIRADO'`.
   - Encolar las peticiones en vuelo para evitar llamadas duplicadas de refresh.
   - Invocar `POST /api/movil/v1/auth/refresh` con el `refresh_token` almacenado en `expo-secure-store`.
   - Guardar el nuevo par `access_token` y `refresh_token` que devuelve el servidor.
   - Reintentar la petición original con el nuevo token en la cabecera `Authorization: Bearer <nuevo_access_token>`.
   - Si `/auth/refresh` devuelve `TOKEN_INVALIDO` (401), cerrar la sesión de forma limpia en el dispositivo y redirigir al chofer al Login.

2. **Generación Obligatoria de `X-Idempotency-Key`:**
   - Toda llamada a `POST /api/movil/v1/chofer/entregar` y `POST /api/movil/v1/chofer/cobrar` debe enviar una clave UUID v4 en la cabecera `X-Idempotency-Key`.
   - Si la petición se reintenta por reconexión o timeout de red móvil en carretera, **mantener la misma clave UUID** para garantizar que el servidor devuelva la respuesta cacheada sin duplicar registros.

3. **Adopción del Bloque Compuesto `cobro`:**
   - En la pantalla de entrega del pedido, cuando el chofer cobre en el mismo acto, enviar el bloque `"cobro"` dentro de `POST /api/movil/v1/chofer/entregar`.
   - Esto evita llamar primero a `/entregar` y luego a `/cobrar`, impidiendo que el pedido quede entregado sin cobro si la batería o red fallan entre una pantalla y otra.
   - El endpoint individual `POST /api/movil/v1/chofer/cobrar` se mantiene activo para abonos posteriores o cobros diferidos de ruta.

4. **Flujo de Comprobante para QR o Transferencia:**
   - Antes de enviar el bloque `cobro`, la app debe capturar la foto del comprobante QR/transferencia, subirla a `POST /api/movil/v1/chofer/subir-archivo`, y enviar el `id_comprobante_archivo` retornado dentro del tramo de pago correspondiente.

---

## 4. PEDIDOS DEL MÓVIL AL BACKEND (`Blanquita-Backend` - Chat 2)

1. **Compatibilidad de campos de texto en Entrega (`observaciones` / `observacion`):**
   - El cliente móvil envía preferentemente `observaciones` y mapea `observacion` como fallback. Solicitar que el schema Pydantic acepte ambos nombres o tenga un alias para evitar fallos de validación 422.

2. **Respuesta completa en Entrega Compuesta con Cobro:**
   - Al procesar con éxito `POST /api/movil/v1/chofer/entregar` con bloque `"cobro"`, confirmar que el payload de respuesta incluya el objeto `datos.cobro` con los `tramos` generados (`id_pago_pedido`, `estado`, `numero_referencia`) y el detalle de `cuenta_cobrar` si se creó saldo a crédito, tal como se especifica en la sección 2.3. Esto permite actualizar de inmediato los saldos y notas en la base local del móvil.

3. **Idempotencia Estricta ante Reintentos con `X-Idempotency-Key`:**
   - Garantizar que si el chofer pierde señal en carretera justo tras enviar la petición (o sufre timeout de cliente) y la cola offline reenvía la petición con la misma `X-Idempotency-Key`, el backend responda con HTTP 200 y el cuerpo original previamente persistido, sin lanzar error 400/409 ("Pedido ya entregado") ni duplicar los pagos en `pago_pedido`.

4. **Tratamiento de Comprobantes de Archivo (`id_comprobante_archivo`):**
   - Confirmar que `POST /api/movil/v1/chofer/subir-archivo` acepte archivos de imagen (`image/jpeg`, `image/png`) bajo multipart/form-data y retorne `{ "codigo": "EXITO", "datos": { "id_comprobante": <int>, "url_archivo": <str> } }` con timeout holgado, permitiendo vincularlo sin ambigüedad en el tramo de pago QR/transferencia.

5. **Estado de Sesión Expirada Diferenciado (401 `TOKEN_EXPIRADO` vs `TOKEN_INVALIDO`):**
   - Mantener la diferenciación estricta en el cuerpo JSON (`codigo: "TOKEN_EXPIRADO"` para access token vencido renovable vía refresh token, vs `codigo: "TOKEN_INVALIDO"` cuando el refresh token expiró o fue revocado). Esto asegura que la app móvil no cierre intempestivamente la jornada del chofer y le permita seguir operando de forma autónoma offline.

---

## 5. CONTRATO DE CICLO DE RUTA, CARGA DE CAMIÓN, HISTORIAL DE APROBACIONES Y WEBSOCKET (PLAN GRATUITO)

### 5.1 Solicitar Carga de Camión
- **Endpoint:** `POST /api/movil/v1/chofer/solicitar-carga`
- **Request Body:**
```json
{
  "id_asignacion": 12,
  "usar_remanente": true,
  "observacion": "Carga inicial de mañana con stock remanente verificado",
  "items": [
    {
      "presentacion_id": 1,
      "cantidad_solicitada": 50.0
    },
    {
      "presentacion_id": 2,
      "cantidad_solicitada": 30.0
    }
  ]
}
```
- **Response Exitosa (HTTP 200):**
```json
{
  "codigo": "EXITO",
  "mensaje": "Solicitud de carga registrada exitosamente",
  "datos": {
    "id_solicitud": 45,
    "estado_operativo": "CARGA_SOLICITADA",
    "habilitada_para_reparto": false
  }
}
```

---

### 5.2 Resumen de Sincronización Manual (Ahorro Plan Gratuito)
- **Endpoint:** `GET /api/movil/v1/chofer/resumen-sincronizacion`
- **Descripción:** Endpoint único para el botón manual "Actualizar" del móvil, minimizando llamadas recurrentes y consumo de cuota en planes gratuitos.
- **Response Exitosa (HTTP 200):**
```json
{
  "codigo": "EXITO",
  "mensaje": "Resumen de sincronización obtenido exitosamente",
  "datos": {
    "asignacion_activa": {
      "id_asignacion": 12,
      "estado_operativo": "APROBADA_EN_RUTA",
      "habilitada_para_reparto": true,
      "paradas": [
        {
          "id_parada": 101,
          "orden": 1,
          "id_pedido": 501,
          "cliente": "Abarrotes Don Pepe",
          "estado": "ENTREGADO"
        },
        {
          "id_parada": 102,
          "orden": 2,
          "id_pedido": 502,
          "cliente": "Farmacia Central",
          "estado": "PENDIENTE"
        }
      ]
    },
    "inventario_camion": [
      {
        "presentacion_id": 1,
        "nombre_producto": "Papel Higiénico Blanquita Clásico",
        "cantidad_disponible": 40.0
      }
    ],
    "historial_operaciones_hoy": [
      {
        "id_operacion": 88,
        "tipo": "ENTREGA",
        "cliente": "Abarrotes Don Pepe",
        "monto": 250.0,
        "estado_revision_web": "APROBADO",
        "observacion_revision": "Validado en sistema",
        "fecha": "2026-11-12T10:30:00"
      }
    ]
  }
}
```
*Valores posibles para `estado_operativo`:* `"SIN_RUTA" | "PENDIENTE_CARGA" | "CARGA_SOLICITADA" | "APROBADA_EN_RUTA" | "FINALIZADA"`.
*Valores posibles para `estado_revision_web`:* `"PENDIENTE" | "APROBADO" | "OBSERVADO" | "RECHAZADO"`.

---

### 5.3 Registro de Cliente en Ruta (Venta Inmediata o Programada)
- **Endpoint:** `POST /api/movil/v1/chofer/cliente-en-ruta`
- **Request Body:**
```json
{
  "datos_cliente": {
    "razon_social": "Tienda Doña Rosa",
    "ci_nit": "6789123",
    "telefono": "71234567",
    "direccion": "Av. Las Américas #120",
    "latitud": -19.042,
    "longitud": -65.259
  },
  "modalidad": "ENTREGA_INMEDIATA",
  "dia_semana_programado": null,
  "items_programados": null,
  "parada_actual_orden": 2,
  "entrega_con_cobro": {
    "latitud": -19.042,
    "longitud": -65.259,
    "tipo_entrega": "TOTAL",
    "recibido_por": "Doña Rosa",
    "ci_receptor": "6789123",
    "items_entregados": [
      {
        "presentacion_id": 1,
        "cantidad": 5.0
      }
    ],
    "cobro": {
      "monto_total": 125.0,
      "pagos": [
        {
          "metodo": "EFECTIVO",
          "monto": 125.0
        }
      ]
    }
  }
}
```
- **Modalidades soportadas:** `"SOLO_REGISTRO" | "PROGRAMAR_ENTREGA" | "ENTREGA_INMEDIATA"`.
- **Comportamiento en `ENTREGA_INMEDIATA`:** Inserta la nueva parada en `parada_actual_orden + 1`, desplaza las paradas siguientes en `+1`, ejecuta la entrega con cobro en transacción ACID y devuelve la ruta reordenada compactamente de `1..N`.

---

### 5.4 Eventos WebSocket (`/ws/logistica`)
Canal bidireccional en tiempo real para optimización de cuota y sincronización instantánea:
- **Hacia Móvil (Chofer):**
  - `ruta_asignada`: Notifica nueva ruta programada o asignada.
  - `carga_camion_aprobada`: Habilita al chofer a iniciar reparto (`habilitada_para_reparto: true`).
  - `ruta_reordenada`: Avisa cambio en la secuencia de paradas de la jornada.
  - `operacion_revisada`: Informa al chofer si una entrega o cobro fue aprobado u observado por Web.
  - `ruta_finalizada_admin`: Notifica el cierre oficial de la jornada por parte del supervisor.
  - `solicitar_ubicacion_actual`: Demanda emisión puntual del GPS actual del chofer.
- **Hacia Web (Panel de Control y Supervisor):**
  - `solicitud_carga_recibida`: Alerta de nueva petición de stock enviada por chofer.
  - `operacion_ruta_registrada`: Notifica entrega o cobro realizado en tiempo real.
  - `ubicacion_chofer_actualizada`: Envía coordenadas GPS reportadas bajo demanda.

