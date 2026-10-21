INSERT INTO "Turno" ("NombreTurno", "HoraInicio", "HoraFin", "DescripcionTurno") VALUES
('Mañana', '06:00:00', '11:59:59', 'Turno regular, el más habitual (entra 06:00, suele extenderse hasta las 15:00)'),
('Tarde', '12:00:00', '15:00:00', 'Segundo turno regular, poco frecuente'),
('Horas Extra', '15:01:00', '05:59:59', 'Extensión del turno mañana para completar 8 horas; no aplica a todo el personal, solo al área que lo requiera (ej. rebobinado)');

INSERT INTO "Rol" ("NombreRol", "Descripcion") VALUES
('Operador', 'Personal encargado de registrar movimientos de materia prima y producción'),
('Líder de Inventario y Producción', 'Encargado de validar los ajustes/movimientos de inventario y producción');

INSERT INTO "EstadoUsuario" ("NombreEstadoUsuario", "DescripcionEstadoUsuario") VALUES
('Activo', 'Usuario habilitado para operar el sistema'),
('Inactivo', 'Usuario deshabilitado temporalmente'),
('Suspendido', 'Usuario bloqueado por incumplimiento de políticas');





INSERT INTO "TipoBobina" ("NombreTipoBobina", "DiametroMm", "Formato", "TaraKg", "StockMinimo", "StockPreventivo") VALUES
('Higiénico', 1210, 2760, 38, 6, 12),
('Toalla', 1210, 2760, 38, 2, 4),
('Económico', 1210, 2760, 38, 2, 4);

INSERT INTO "TipoBobinaServilleta" ("NombreTipoBobinaServilleta", "DiametroMm", "CrepadoPorcentaje", "ResistenciaKgf", "CantidadUnidades", "StockMinimo", "StockPreventivo") VALUES
('G-18 CR-14%', 1210, 14, 1.35, 2, 2, 4);



INSERT INTO "EstadoMateriaPrima" ("TipoEstado") VALUES
('En almacén'),
('En producción'),
('Agotado'),
('Dado de baja'),
('Fuera de Inventario'),
('Abierta'),
('Terminada');

INSERT INTO "TipoEmpaque" ("NombreTipoEmpaque", "StockMinimo", "StockPreventivo") VALUES
('Luxury 24', 1, 2),
('Luxury 12', 1, 2),
('Luxury 6', 1, 2),
('EcoPack 12', 1, 2),
('EcoPack 6', 1, 2),
('EcoPack 4', 1, 2);

INSERT INTO "TipoMovimientoMateriaPrima" ("NombreMovimiento", "AplicaA", "DescripcionTipoMovimientoMateriaPrima") VALUES
('Ingreso a almacén', 'Todos', 'Registro de ingreso inicial de materia prima al almacén'),
('Traslado a producción', 'Todos', 'Movimiento de materia prima desde almacén hacia planta de producción'),
('Devolución a almacén', 'Todos', 'Retorno de materia prima no utilizada a almacén (evento raro)'),
('Baja por defecto', 'Todos', 'Retiro definitivo de materia prima por daño o defecto confirmado'),
('Retiro por falla operativa', 'Todos', 'Retiro de materia prima ya cargada en producción que no pudo procesarse; pasa a "Fuera de Inventario"'),
('Reingreso a inventario', 'Todos', 'Materia prima "Fuera de Inventario" regresa a "En almacén" para recontarse'),
('Producción terminada', 'Todos', 'Registra el cierre de una producción.'),
('Corrección de registro', 'Todos', 'Corrección de datos registrados por error (código, pesos, gramaje). No cambia el estado de la materia prima; la observación guarda el valor anterior, el nuevo y el motivo.'),
('Cambio de línea', 'Bobina Papel', 'La producción cambia de producto con las mismas bobinas; la bobina sigue En producción. La observación indica el producto anterior, el nuevo y las producciones involucradas.');

INSERT INTO "EstadoProduccion" ("NombreEstadoProduccion", "DescripcionEstadoProduccion") VALUES
('En Producción', 'Proceso de producción activo y en curso'),
('Pausa', 'Producción detenida temporalmente (motivo libre: empalme, falta de pegamento, falta de personal, falla de maquinaria, limpieza, etc.)'),
('Finalizado', 'Proceso de producción concluido'),
('Cancelada', 'Producción interrumpida de forma definitiva por falla; no se reanuda con el mismo par de bobinas'),
('Cambio de línea', 'Producción cerrada por cambio de producto; las bobinas continúan en producción en una nueva producción');

INSERT INTO "Producto" ("NombreProducto", "SiglasProducto", "IdTipoBobina", "IdTipoBobinaServilleta") VALUES
('Luxury', 'LUX', (SELECT "IdTipoBobina" FROM "TipoBobina" WHERE "NombreTipoBobina" = 'Higiénico'), NULL),
('EcoPack', 'ECO', (SELECT "IdTipoBobina" FROM "TipoBobina" WHERE "NombreTipoBobina" = 'Higiénico'), NULL),
('Servilleta', 'SRV', NULL, (SELECT "IdTipoBobinaServilleta" FROM "TipoBobinaServilleta" WHERE "NombreTipoBobinaServilleta" = 'G-18 CR-14%')),
('Mega Rollo', 'MRO', (SELECT "IdTipoBobina" FROM "TipoBobina" WHERE "NombreTipoBobina" = 'Higiénico'), NULL),
('Economico', 'ECN', (SELECT "IdTipoBobina" FROM "TipoBobina" WHERE "NombreTipoBobina" = 'Económico'), NULL),
('Merma', 'MER', NULL, NULL),
('Toalla', 'TOA', (SELECT "IdTipoBobina" FROM "TipoBobina" WHERE "NombreTipoBobina" = 'Toalla'), NULL);

INSERT INTO "PresentacionProducto" ("IdProducto", "TipoContenedor", "CantidadRollosUnidades", "CantidadPorUnidadTerminada", "CodigoPresentacion") VALUES
((SELECT "IdProducto" FROM "Producto" WHERE "NombreProducto" = 'Luxury'), 'Jaba', 6, 6, 'LUX-J06'),
((SELECT "IdProducto" FROM "Producto" WHERE "NombreProducto" = 'Luxury'), 'Jaba', 12, 12, 'LUX-J12'),
((SELECT "IdProducto" FROM "Producto" WHERE "NombreProducto" = 'Luxury'), 'Jaba', 24, 24, 'LUX-J24'),
((SELECT "IdProducto" FROM "Producto" WHERE "NombreProducto" = 'EcoPack'), 'Jaba', 4, 4, 'ECO-J04'),
((SELECT "IdProducto" FROM "Producto" WHERE "NombreProducto" = 'EcoPack'), 'Jaba', 6, 6, 'ECO-J06'),
((SELECT "IdProducto" FROM "Producto" WHERE "NombreProducto" = 'EcoPack'), 'Jaba', 12, 12, 'ECO-J12'),
((SELECT "IdProducto" FROM "Producto" WHERE "NombreProducto" = 'Servilleta'), 'Jaba', 50, 28, 'SRV-J50'),
((SELECT "IdProducto" FROM "Producto" WHERE "NombreProducto" = 'Servilleta'), 'Jaba', 200, 12, 'SRV-J200'),
((SELECT "IdProducto" FROM "Producto" WHERE "NombreProducto" = 'Servilleta'), 'Jaba', 500, 6, 'SRV-J500'),
((SELECT "IdProducto" FROM "Producto" WHERE "NombreProducto" = 'Mega Rollo'), 'Plancha', 12, 1, 'MRO-P12'),
((SELECT "IdProducto" FROM "Producto" WHERE "NombreProducto" = 'Economico'), 'Plancha', 20, 1, 'ECN-P20'),
((SELECT "IdProducto" FROM "Producto" WHERE "NombreProducto" = 'Toalla'), 'Jaba', 2, 12, 'TOA-J06'),
((SELECT "IdProducto" FROM "Producto" WHERE "NombreProducto" = 'Merma'), 'Plancha', 1, 1, 'MER-P01'),
((SELECT "IdProducto" FROM "Producto" WHERE "NombreProducto" = 'Merma'), 'Jaba', 1, 1, 'MER-S01'),
((SELECT "IdProducto" FROM "Producto" WHERE "NombreProducto" = 'Merma'), 'Jaba', 1, 1, 'MER-T01');




INSERT INTO "TipoMovimientoInventario" ("NombreTipoMovimientoInventario", "DescripcionTipoMovimientoInventario") VALUES
('Entrada', 'Ingreso de producto terminado desde producción'),
('Salida', 'Salida de producto por despacho/venta'),
('Descuento', 'Reducción por causa operativa distinta a venta'),
('Aumento', 'Incremento por causa operativa distinta a producción'),
('Ajuste Positivo', 'Corrección manual que incrementa el saldo'),
('Ajuste Negativo', 'Corrección manual que reduce el saldo');

INSERT INTO "InventarioProductoTerminado" ("IdPresentacion", "CantidadActual", "StockMinimo", "StockPreventivo")
SELECT pp."IdPresentacion", 0, u."StockMinimo", u."StockPreventivo"
FROM "PresentacionProducto" AS pp
LEFT JOIN (VALUES
  ('LUX-J06', 15, 30),
  ('LUX-J12', 20, 40),
  ('LUX-J24', 10, 20),
  ('ECO-J04', 15, 30),
  ('ECO-J06', 20, 40),
  ('ECO-J12', 10, 20),
  ('SRV-J50', 10, 20),
  ('SRV-J200', 10, 20),
  ('SRV-J500', 5, 10),
  ('MRO-P12', 20, 40),
  ('ECN-P20', 20, 40),
  ('TOA-J06', 10, 20)
) AS u("CodigoPresentacion", "StockMinimo", "StockPreventivo")
  ON u."CodigoPresentacion" = pp."CodigoPresentacion";

INSERT INTO "TipoMovimientoOperadorLogs" ("NombreMovimiento", "DescripcionTipoMovimientoOperadorLogs") VALUES
('Ingreso', 'Registro de logs producidos por el operador durante el turno'),
('Descuento', 'Corrección que resta logs registrados por error'),
('Aumento', 'Corrección que suma logs no contabilizados previamente');




INSERT INTO "TipoEmpaqueBolsa" ("NombreEmpaqueBolsa", "DescripcionEmpaqueBolsa") VALUES
('MegaRollo', 'Plancha, papel higiénico MegaRollo'),
('Económico', 'Plancha, papel higiénico Económico'),
('Servilleta 50', 'Bolsa, servilleta de bandeo 50 unidades'),
('Servilleta 200', 'Bolsa, servilleta 200 unidades'),
('Servilleta 500', 'Bolsa, servilleta 500 unidades');

INSERT INTO "InventarioEmpaqueBolsa" ("IdTipoEmpaqueBolsa", "CantidadActual", "StockMinimo", "StockPreventivo")
SELECT "IdTipoEmpaqueBolsa", 0, 10, 20
FROM "TipoEmpaqueBolsa";

INSERT INTO "TipoBolsaJava" ("NombreBolsaJava", "DescripcionBolsaJava") VALUES
('Luxury 24', 'Ancho plegado 49 cm, fuelle 12 cm por lado, ancho total 73 cm, largo 77 cm, 40 g'),
('Luxury 6', 'Ancho plegado 49 cm, fuelle 12 cm por lado, ancho total 73 cm, largo 77 cm, 40 g'),
('Luxury 12', 'Ancho plegado 44 cm, fuelle 10 cm por lado, ancho total 64 cm, largo 91 cm, 40 g'),
('Servilleta 50', 'Ancho plegado 44 cm, fuelle 10 cm por lado, ancho total 64 cm, largo 91 cm, 40 g'),
('Mega 20', 'Ancho plegado 38 cm, fuelle 5 cm por lado, ancho total 48 cm, largo 64 cm, 40 g'),
('Plancha servilletas', 'Ancho plegado 38 cm, fuelle 5 cm por lado, ancho total 48 cm, largo 64 cm, 40 g'),
('EcoPack 4', 'Ancho plegado 42 cm, fuelle 10 cm por lado, ancho total 62 cm, largo 61 cm, 40 g'),
('Servilleta 200', 'Ancho plegado 42 cm, fuelle 10 cm por lado, ancho total 62 cm, largo 61 cm, 40 g'),
('Servilleta 500', 'Ancho plegado 49 cm, fuelle 11 cm por lado, ancho total 71 cm, largo 63 cm, 40 g'),
('EcoPack 6', 'Ancho plegado 45 cm, fuelle 11 cm por lado, ancho total 67 cm, largo 75 cm, 40 g'),
('Papel Toalla', 'Ancho plegado 45 cm, fuelle 11 cm por lado, ancho total 67 cm, largo 75 cm, 40 g'),
('EcoPack 12', 'Ancho plegado 41 cm, fuelle 9 cm por lado, ancho total 59 cm, largo 82 cm, 40 g');

INSERT INTO "InventarioBolsaJava" ("IdTipoBolsaJava", "CantidadActual", "StockMinimo", "StockPreventivo")
SELECT "IdTipoBolsaJava", 0, 10, 20
FROM "TipoBolsaJava";



INSERT INTO "TipoInsumo" ("NombreInsumo", "DescripcionInsumo") VALUES
('Pegamento de tubos', 'Pegamento exclusivo de la máquina de tubos; llega en turriles'),
('Pegamento de laminado', 'Une ambas láminas en la rebobinadora; llega en tanques o turriles, a veces se mezclan'),
('Pegamento de Turril', 'Sella la cola del log en la rebobinadora; llega en turriles'),
('Vaselina', 'Consumible de mantenimiento; llega en bidones'),
('Maicena', 'Consumible de uso ocasional'),
('Talco', 'Consumible de uso ocasional'),
('Ligas', 'Ligas negras; llegan en bolsas grandes');

INSERT INTO "InventarioInsumo" ("IdTipoInsumo", "CantidadActual", "StockMinimo", "StockPreventivo")
SELECT ti."IdTipoInsumo", 0, u."StockMinimo", u."StockPreventivo"
FROM "TipoInsumo" AS ti
LEFT JOIN (VALUES
  ('Pegamento de tubos', 1, 2),
  ('Pegamento de laminado', 1, 2),
  ('Pegamento de Turril', 1, 2),
  ('Vaselina', 1, 2),
  ('Maicena', 2, 4),
  ('Talco', 2, 4),
  ('Ligas', 1, 2)
) AS u("NombreInsumo", "StockMinimo", "StockPreventivo")
  ON u."NombreInsumo" = ti."NombreInsumo";



INSERT INTO "TipoMedidaSubBobina" ("MedidaMm", "Descripcion", "StockMinimo", "StockPreventivo") VALUES
(435, 'Sub-bobina 435mm', 4, 8),
(220, 'Sub-bobina 220mm', 2, 4);

INSERT INTO "FormatoSubBobina" ("DescripcionFormato") VALUES
('435x3'),
('435x2+220x1');

INSERT INTO "FormatoSubBobinaDetalle" ("IdFormatoSubBobina", "IdTipoMedidaSubBobina", "Cantidad") VALUES
((SELECT "IdFormatoSubBobina" FROM "FormatoSubBobina" WHERE "DescripcionFormato" = '435x3'), (SELECT "IdTipoMedidaSubBobina" FROM "TipoMedidaSubBobina" WHERE "MedidaMm" = 435), 3),
((SELECT "IdFormatoSubBobina" FROM "FormatoSubBobina" WHERE "DescripcionFormato" = '435x2+220x1'), (SELECT "IdTipoMedidaSubBobina" FROM "TipoMedidaSubBobina" WHERE "MedidaMm" = 435), 2),
((SELECT "IdFormatoSubBobina" FROM "FormatoSubBobina" WHERE "DescripcionFormato" = '435x2+220x1'), (SELECT "IdTipoMedidaSubBobina" FROM "TipoMedidaSubBobina" WHERE "MedidaMm" = 220), 1);

INSERT INTO "TipoBobinaServilletaFormato" ("IdTipoBobinaServilleta", "IdFormatoSubBobina")
SELECT t."IdTipoBobinaServilleta", f."IdFormatoSubBobina"
FROM "TipoBobinaServilleta" AS t
CROSS JOIN "FormatoSubBobina" AS f
WHERE t."NombreTipoBobinaServilleta" = 'G-18 CR-14%'
  AND f."DescripcionFormato" IN ('435x3', '435x2+220x1');




INSERT INTO "Proveedor" ("NombreProveedor", "CelularProveedor", "CorreoProveedor", "Activo") VALUES
('Papelera del Sur S.R.L.', '70012345', 'ventas@papeleradelsur.com', true);
