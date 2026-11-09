# INTEGRACIONES CON PLANTA - PAPELERA BLANQUITA

Este documento registra formalmente todos los puntos de contacto e integración operativa entre los módulos comerciales/administrativos y los módulos de planta y producción de Fabricio.

---

## 1. DESCUENTO DE STOCK DE PRODUCTO TERMINADO AL DESPACHAR A SUCURSAL / CLIENTE (ACTIVA)

- **Situación y Diseño Acordado:**
  Cuando un camión sale de la fábrica matriz en Sucre con destino a Potosí u otra sucursal, la mercadería física abandona el almacén central. 
  La deducción se ejecuta a través del adaptador oficial `FabricioLegacyAdapter` implementando la interfaz `InventarioProductoTerminadoPort`.
  - **Single Source of Truth:** La tabla `InventarioProductoTerminado` de Fabricio es el inventario real para Sucre (no se crea ningún inventario duplicado).
  - **Operación:** Descuenta `CantidadActual` mediante `UPDATE` condicional (`CantidadActual >= cantidad`) e inserta en `MovimientoProductoTerminado` con `IdTipoMovimientoInventario = 2` ('Salida').
  - **Momento:** Se ejecuta en el momento que el envío pasa al estado `EN_TRANSITO`. En caso de anulación, reintegra stock con tipo `5` ('Ajuste Positivo').
  - **Unidad de Trabajo:** El adaptador **nunca hace commit**; la transacción completa la gobierna el orquestador `EnviosService`.

### [RIESGO ABIERTO R-PLANTA-01] Prevención de Doble Descuento
- **Riesgo:** Si el operador de planta de Fabricio cuenta con una pantalla local que ya descuenta unidades de `InventarioProductoTerminado` al registrar la salida física del camión, la ejecución automática desde el sistema comercial causaría un **doble descuento** de stock (reduciendo el doble de lo enviado).
- **Mecanismo de Mitigación Implementado:**
  1. **Interruptor de Configuración:** Parámetro en `.env`:
     `DESCONTAR_PLANTA_ACTIVO=false` (valor por defecto hasta validación formal).
  2. **Auditoría de Envíos:** La tabla `envios_inventario` incluye la columna `descuento_planta_aplicado (bool)`. Si el interruptor está en `false`, el envío sale con `descuento_planta_aplicado = FALSE`.
  3. **Script de Conciliación Posterior:** Al confirmarse con Fabricio que su módulo no descuenta, se activa `DESCONTAR_PLANTA_ACTIVO=true` y se ejecuta el script CLI de reconciliación:
     `python -m app.cli.conciliar_envios_pendientes`
     que descuenta atómicamente de la planta Sucre únicamente los envíos pendientes con `descuento_planta_aplicado = FALSE` y los actualiza a `TRUE`.
- **Responsable de Confirmación:** Fabricio (planta) y Kevin (contabilidad). Estado: `ABIERTO`.

---

## 2. NOTA DE ENTREGA / GUÍA DE SALIDA DE DESPACHO DE FÁBRICA

- **Situación Actual:**
  Las notas de venta comerciales del chofer (NV-501) requieren en teoría nacer a partir de una orden o nota de despacho generada por el pesaje y control de salida en la puerta de planta.
- **Qué se Lee Hoy:**
  Se ofrece carga manual o se consume la información de la asignación de ruta existente (`AsignacionRuta`, `CargaInventarioRuta`).
- **Qué Faltaría Escribir:**
  Vincular bidireccionalmente el ID de despacho generado por el sistema de balanza/despacho de planta con la `NotaVenta` o la `GuiaRemision`.
- **Quién lo Coordina:**
  Fabricio (planta) y el Agente de Logística comercial.
- **Propuesta de Contrato de Integración:**
  ```json
  GET /api/planta/despachos-pendientes-carga?fecha=2026-11-15
  Response: [
    {
      "id_despacho_planta": 1042,
      "codigo_despacho": "DSP-FAB-1042",
      "chofer_ci": "10000001",
      "placa": "3456-XYZ",
      "productos": [
        { "id_producto": 1, "nombre": "Megarrollo Blanquita", "cantidad": 300 }
      ]
    }
  ]
  ```

---

## 3. VALIDACIÓN DE STOCK DISPONIBLE PARA PEDIDOS DE DISTRIBUIDORES EXTERNOS

- **Situación Actual:**
  Los distribuidores de Oruro, Tarija, La Paz y Tupiza no pueden solicitar mercadería inexistente. Se debe validar que haya stock en planta antes de formalizar la proforma.
- **Qué se Lee Hoy:**
  `PlantaDataReader.obtener_stock_producto_terminado(id_producto)` en tiempo real. Si la cantidad solicitada supera el disponible, la UI bloquea el botón de confirmación.
- **Qué Faltaría Escribir:**
  Un mecanismo de **reserva temporal de inventario** en planta (ej. retener 500 bultos durante 24 horas mientras el distribuidor acude al banco a depositar y Kevin valida el comprobante).
- **Quién lo Coordina:**
  Fabricio (planta) y Leslie / Kevin (ventas y contabilidad).
- **Propuesta de Contrato de Integración:**
  ```json
  POST /api/planta/bloquear-reserva
  Body: {
    "id_pedido_distribuidor": 88,
    "tiempo_expiracion_horas": 24,
    "items": [
      { "id_producto": 1, "cantidad": 500 }
    ]
  }
  ```

---

## 4. SALDOS DE MATERIA PRIMA Y PRODUCTO TERMINADO PARA BALANCES GENERALES

- **Situación Actual:**
  Don Osvaldo y Kevin requieren visualizar a final de mes el valor económico inmovilizado en fábrica (bobinas de papel, bobinas de servilleta, rodelas, tubos y producto terminado) para contrastarlo con el sistema Contagen.
- **Qué se Lee Hoy:**
  Consultas de agregación en solo lectura (`COUNT`, `SUM(PesoKilos)`) sobre `BobinaPapel`, `BobinaServilleta` y `InventarioProductoTerminado`.
- **Qué Faltaría Escribir:**
  Ninguna escritura requerida; únicamente formalizar un endpoint o vista optimizada compartida de solo lectura que calcule el costo promedio ponderado de inventario.
- **Quién lo Coordina:**
  Kevin (contabilidad) con la supervisión de Don Osvaldo.
- **Propuesta de Contrato de Integración:**
  ```json
  GET /api/planta/reportes/valorizacion-materia-prima?corte_fecha=2026-10-31
  Response: {
    "total_kilos_bobina_papel": 14250.50,
    "total_kilos_bobina_servilleta": 6300.20,
    "total_unidades_rodelas": 12400,
    "total_paquetes_producto_terminado": 8500,
    "fecha_corte": "2026-10-31T23:59:59Z"
  }
  ```
