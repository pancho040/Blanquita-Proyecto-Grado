# GLOSARIO DE TÉRMINOS DEL NEGOCIO Y EQUIVALENCIAS TÉCNICAS

Este documento homologa la terminología operativa utilizada por los propietarios, contadores y choferes de Papelera Blanquita con los nombres de tablas, columnas y conceptos técnicos en el código fuente y la base de datos.

---

| Término de Negocio | Definición Operativa en Blanquita | Equivalencia Técnica / Entidad | Tabla / Columna en BD |
| :--- | :--- | :--- | :--- |
| **Sucursal** | Sede física u operativa de la empresa (Sucre, Potosí, N futuras). Cada una maneja inventario comercial, clientes, rutas y precios propios. | Entidad `Sucursal` | `public.Sucursal`<br>FK `IdSucursal` |
| **Megarrollo** | Producto estrella de papel higiénico institucional de gran metraje y rendimiento producido en planta Sucre. | Registro en Catálogo | `public.Producto`<br>(ej. `NombreProducto = 'Megarrollo'`) |
| **Bandeo** | Estrategia promocional donde por la compra de un Megarrollo se obsequia una servilleta de papel como bonificación. | Flag y relación de bonificación comercial | `public.ProductoConfigComercial.EsBandeo`, `ValorBandeo` |
| **Ecopack / Jaba** | Presentación comercial agrupada de papel higiénico (fardo o paquete institucional de 6 unidades empaquetadas). | Presentación de producto | `public.PresentacionProducto`, `public.TipoBolsaJava` |
| **Inventario Comercial** | Stock físico disponible en los almacenes de la sucursal para distribución y venta. Es independiente del inventario de fábrica. | Stock de sucursal | `public.InventarioSucursal`<br>`CantidadDisponible` |
| **Inventario Chofer / Camión** | Mercadería cargada en el camión de un chofer al inicio de su turno para venta ambulante o entrega de pedidos. | Stock móvil en tránsito | `public.InventarioChofer`<br>`CantidadCargada`, `CantidadActual` |
| **Revalorizar** | Recálculo automático del valor del stock remanente en poder del chofer al cambiar el precio oficial de la sucursal. | Trigger / Job de ajuste contable | `public.RevalorizacionInventarioChofer`<br>`MontoAjuste`, `PrecioAnterior`, `PrecioNuevo` |
| **Nota de Venta (NV-501)** | Comprobante de venta y entrega emitido al despachar mercadería a un cliente, con detalle de productos, precios y pagos. | Cabecera y detalle de venta | `public.NotaVenta` (`NroNotaVenta`),<br>`public.DetalleNotaVenta` |
| **Nota de Entrega / Despacho** | Documento emitido en planta/fábrica que acompaña la salida física de mercadería. | Módulo protegido de planta | `public.AsignacionRuta`, `public.EnvioFabricaSucursal` |
| **Cierre de Turno** | Conciliación obligatoria al final de la jornada donde el chofer rinde el dinero cobrado, comprobantes QR y stock devuelto. | Rendición de ruta | `public.RendicionRuta`,<br>`EstadoAsignacion = 'COMPLETADA'` |
| **Merma / Faltante** | Mercadería dañada o dinero faltante detectado en el camión al cerrar el turno; se imputa de inmediato al chofer. | Ajuste diario de cierre | `public.RendicionRuta.MontoFaltante`,<br>`public.RendicionRuta.CantidadMerma` |
| **Repartidor / Chofer** | Empleado o contratista responsable del transporte, custodia de stock móvil, cobranzas en calle y entrega. | Usuario con rol repartidor | `public.Usuario` (`IdRol = 6`),<br>`public.DatosLaboralesEmpleado` |
| **Distribuidor Externo** | Clientes mayoristas en otras ciudades (Oruro, Tarija, La Paz, Tupiza) que compran sobre stock disponible y pagan por banco. | Rol y entidad de distribuidor | `public.DistribuidorExterno`,<br>`public.PedidoDistribuidor` |
| **Comprobante QR** | Imagen o captura de pantalla de transferencia bancaria por código QR (habitualmente enviada por WhatsApp). Obligatoria. | Archivo con metadata y hash | `public.ComprobanteArchivo`<br>`UrlArchivo`, `FechaExpiracion` (60 días) |
| **Mora** | Estado de impago de una cuenta por cobrar que ha superado la fecha límite de vencimiento pactada (ej. 30 días supermercados). | Flag y cálculo de días de mora | `public.CuentaCobrar.DiasMora`,<br>`EstadoCuentaCobrar = 'VENCIDO'` |
| **Caja Chica** | Fondo fijo rotativo administrado por Kevin para compras menores operativas bajo ciclo `Pendiente -> Entregado -> Rendido`. | Solicitudes y vales de caja chica | `public.SolicitudCajaChica`<br>`MontoEntregado`, `MontoRendido`, `MontoReintegro` |
| **Personal Asegurado** | Trabajadores formales registrados en la Caja de Salud y Gestora Pública con planilla oficial del Ministerio de Trabajo. | Clasificación laboral | `public.DatosLaboralesEmpleado`<br>`EsAsegurado = TRUE` |
| **Personal Externo** | Trabajadores eventuales, jornaleros o colaboradores liquidados por planilla interna sin aportes de ley. | Clasificación laboral | `public.DatosLaboralesEmpleado`<br>`EsAsegurado = FALSE` |
| **Gestora Pública** | Entidad de seguridad social de largo plazo en Bolivia que retiene los aportes de jubilación de ley (aprox. 12.71%). | Parámetro de descuento de ley | `public.ConfiguracionLaboral.PorcentajeGestora` |
| **Finiquito** | Liquidación legal de beneficios sociales obligatoria para personal con antigüedad mayor o igual a 3 meses continuos. | Cálculo y documento formal | `public.Finiquito`<br>`Anios`, `Meses`, `Dias`, `MontoTotal` |
| **No Venta** | Penalización económica aplicada a vendedores cuando un cliente desaparece dejando deuda impaga; se descuenta de planilla. | Deducción compartida en planilla | `public.DetallePlanilla.DescuentoNoVenta` |
| **Contagen** | Software contable externo utilizado actualmente por la empresa para asientos de diario y balances generales (fuera de alcance). | Sistema legado de referencia | *N/A (Integración por exportación/capturas)* |
| **Bancos Referenciales** | Las 3 entidades financieras de la empresa: MSC (choferes), Banco Unión (distribuidores/Alcaldía) y BNB. | Cuentas bancarias de tesorería | `public.CuentaBancariaEmpresa`<br>`BancoNombre` |
| **Código Numérico Gerencial** | Número identificador de 4 dígitos (ej. 2208) con el que Don Osvaldo archiva y busca rápidamente cualquier reporte físico. | Identificador numérico rápido | `public.AuditLog.CodigoReferencia`,<br>`public.NotaVenta.IdNotaVenta` |
