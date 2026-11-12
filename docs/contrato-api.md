# CONTRATO DE API Y ESQUEMA — MÓVIL, BACKEND Y WEB (FASE REPARTIDORES)

Este documento define de forma vinculante los contratos de datos, nuevas columnas en base de datos y endpoints para la sincronización entre `Blanquita-Mobile`, `Blanquita-Backend` y `Blanquita-Frontend`.

---

## 1. MIGRACIÓN DE BASE DE DATOS (Alembic: `c1d2e3f4a5b6`)

### 1.1 Tabla `Cliente`
* **Nueva Columna:**
  ```sql
  ALTER TABLE public."Cliente" ADD COLUMN IF NOT EXISTS "NombrePropietario" VARCHAR(150);
  ```

### 1.2 Tabla `NotaVenta`
* **Nuevas Columnas (Doble Firma Digital en Entrega):**
  ```sql
  ALTER TABLE public."NotaVenta" ADD COLUMN IF NOT EXISTS "FirmaClienteUrl" TEXT;
  ALTER TABLE public."NotaVenta" ADD COLUMN IF NOT EXISTS "FirmaClienteNombre" VARCHAR(150);
  ALTER TABLE public."NotaVenta" ADD COLUMN IF NOT EXISTS "FirmaClienteCi" VARCHAR(30);
  ```

### 1.3 Tabla `ComprobanteArchivo`
* **Nuevas Columnas (Storage Híbrido Supabase / Local):**
  ```sql
  ALTER TABLE public."ComprobanteArchivo" ADD COLUMN IF NOT EXISTS "StorageProvider" VARCHAR(30) DEFAULT 'local';
  ALTER TABLE public."ComprobanteArchivo" ADD COLUMN IF NOT EXISTS "StoragePath" TEXT;
  ```

### 1.4 Tabla `RendicionRuta`
* **Nuevas Columnas (Sobrante que Permanece en Camión):**
  ```sql
  ALTER TABLE public."RendicionRuta" ADD COLUMN IF NOT EXISTS "SobrantePermaneceEnCamion" BOOLEAN DEFAULT TRUE;
  ALTER TABLE public."RendicionRuta" ADD COLUMN IF NOT EXISTS "ValorSobranteRevalorizado" NUMERIC(12,2) DEFAULT 0.00;
  ```

---

## 2. ENDPOINTS Y CONTRATOS DE PAYLOAD

### 2.1 Entrega con Doble Firma Táctil
* **Endpoint:** `POST /api/movil/v1/chofer/entregar`
* **Cabecera requerida:** `X-Idempotency-Key: <UUIDv4>`
* **Payload:**
  ```json
  {
    "id_pedido": 104,
    "latitud": -19.0435,
    "longitud": -65.2580,
    "tipo_entrega": "TOTAL",
    "recibido_por": "Juan Pérez",
    "ci_receptor": "5839201 CH",
    "firma_chofer": "storage_path_o_base64_chofer",
    "firma_cliente": "storage_path_o_base64_cliente",
    "items_entregados": [
      {
        "presentacion_id": 1,
        "cantidad": 5.0,
        "es_cortesia_bandeo": false
      }
    ]
  }
  ```
* **Regla de Negocio:** La entrega exige **ambas firmas**. El backend almacena la firma del chofer y la firma del cliente en `FirmaDigitalDocumento` y actualiza inmediatamente `NotaVenta.FirmaDigitalUrl` y `NotaVenta.FirmaClienteUrl` para visualización en la Web.

---

### 2.2 Consulta de Mi Inventario y Revalorización
* **Endpoint:** `GET /api/movil/v1/chofer/mi-inventario`
* **Respuesta Exitosa (`datos`):**
  ```json
  {
    "chofer_id": 12,
    "sucursal_id": 1,
    "total_bultos_cargados": 50.0,
    "total_bultos_entregados": 35.0,
    "total_saldo_camion": 15.0,
    "valor_total_camion_bs": 300.00,
    "valor_total_revalorizado_bs": 345.00,
    "total_ajuste_revalorizacion_bs": 45.00,
    "items": [
      {
        "presentacion_id": 3,
        "nombre_producto": "Papel Higiénico Blanquita Clásico 4 rollos",
        "codigo_presentacion": "BLAN-4R",
        "tipo_contenedor": "Fardo",
        "cantidad_cargada": 20.0,
        "cantidad_vendida": 15.0,
        "cantidad_remanente": 5.0,
        "precio_vigente_carga": 20.00,
        "precio_vigente_actual": 23.00,
        "valor_remanente": 100.00,
        "valor_remanente_revalorizado": 115.00,
        "diferencia_revalorizacion_bs": 15.00,
        "es_bandeo": true,
        "valor_bandeo": 2,
        "cortesia_bandeo_descripcion": "Incluye 2 servilletas de cortesía por fardo"
      }
    ]
  }
  ```

---

### 2.3 Registro de Cliente Nuevo con Propietario
* **Endpoint:** `POST /api/movil/v1/chofer/clientes`
* **Payload:**
  ```json
  {
    "razon_social": "Comercial San José",
    "nombre_comercial": "Tienda Doña María",
    "nombre_propietario": "María Elena Flores",
    "nit_ci": "489201019",
    "telefono": "71234567",
    "direccion": "Av. Jaime Mendoza #420",
    "zona": "Sucre",
    "tipo_negocio": "TIENDA_BARRIO",
    "latitud": -19.0345,
    "longitud": -65.2512
  }
  ```

---

### 2.4 Cierre de Turno con Permanencia en Camión
* **Endpoint:** `POST /api/movil/v1/chofer/cierre-turno`
* **Payload:**
  ```json
  {
    "id_asignacion": 45,
    "monto_efectivo_entregado": 1200.00,
    "monto_qr_reportado": 450.00,
    "monto_transferencia_reportada": 0.00,
    "monto_credito_reportado": 150.00,
    "sobrante_permanece_en_camion": true,
    "stock_devuelto": [],
    "mermas_declaradas": [
      {
        "presentacion_id": 3,
        "cantidad_merma": 1.0,
        "motivo": "Empaque roto en transporte",
        "imputable_chofer": false
      }
    ],
    "firma_chofer": "storage_path_o_base64_cierre",
    "observaciones": "Cierre normal, sobrante queda en camión para mañana"
  }
  ```
* **Regla de Negocio:** Si `sobrante_permanece_en_camion` es `true`, no se devuelven físicamente los productos a la sucursal; `inventario_chofer` retiene `cantidad_remanente` y esta pasa a ser la base inicial del día siguiente valorizada al precio vigente de la sucursal.

---

### 2.5 Subida de Comprobantes a Storage con Fallback
* **Endpoint:** `POST /api/movil/v1/chofer/subir-archivo`
* **Payload (Multipart):**
  - `archivo`: Archivo binario (JPEG comprimido <= 1280px o PNG de firma).
  - `entidad_origen`: `"COMPROBANTE_COBRO"` | `"FIRMA_ENTREGA"` | `"FIRMA_CIERRE"`.
  - `id_registro_origen`: ID de pedido o asignación.
* **Comportamiento:**
  1. Si `STORAGE_SUPABASE_ACTIVO=true`: Sube al bucket `comprobantes-privados` particionado por sucursal y chofer.
  2. Si falla Supabase o `STORAGE_SUPABASE_ACTIVO=false`: Fallback automático a almacenamiento local en `/uploads/comprobantes` sin interrumpir la operación del repartidor.
  3. Retención: Se programa expiración unificada de 60 días (2 meses) en `ComprobanteArchivo` conforme a ADR-004.

---

### 2.6 Cobro de Cuentas Atrasadas en Ruta
* **Endpoint:** `POST /api/cxc/cuentas/{id_cuenta}/abono-ruta`
* **Payload:**
  ```json
  {
    "monto": 300.00,
    "metodo_pago": "EFECTIVO",
    "numero_referencia": null,
    "id_comprobante_archivo": null,
    "latitud": -19.0435,
    "longitud": -65.2580,
    "observaciones": "Cobro de factura pendiente semana pasada"
  }
  ```
