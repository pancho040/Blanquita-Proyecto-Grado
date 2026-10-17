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





INSERT INTO "TipoBobina" ("NombreTipoBobina", "DiametroMm", "Formato", "TaraKg") VALUES
('Higiénico', 1210, 2760, 38),
('Toalla', 1210, 2760, 38),
('Económico', 1210, 2760, 38);

INSERT INTO "TipoBobinaServilleta" ("NombreTipoBobinaServilleta", "DiametroMm", "CrepadoPorcentaje", "ResistenciaKgf") VALUES
('G-18 CR-14%', 1210, 14, 1.35);



INSERT INTO "EstadoMateriaPrima" ("TipoEstado") VALUES
('En almacén'),
('En producción'),
('Agotado'),
('Dado de baja'),
('Fuera de Inventario'),
('Abierta'),
('Terminada');

INSERT INTO "TipoEmpaque" ("NombreTipoEmpaque") VALUES
('Luxury 24'),
('Luxury 12'),
('Luxury 6'),
('EcoPack 12'),
('EcoPack 6'),
('EcoPack 4');

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

INSERT INTO "InventarioProductoTerminado" ("IdPresentacion", "CantidadActual")
SELECT "IdPresentacion", 0
FROM "PresentacionProducto";

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

INSERT INTO "InventarioEmpaqueBolsa" ("IdTipoEmpaqueBolsa", "CantidadActual")
SELECT "IdTipoEmpaqueBolsa", 0
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

INSERT INTO "InventarioBolsaJava" ("IdTipoBolsaJava", "CantidadActual")
SELECT "IdTipoBolsaJava", 0
FROM "TipoBolsaJava";



INSERT INTO "TipoInsumo" ("NombreInsumo", "DescripcionInsumo") VALUES
('Pegamento de tubos', 'Pegamento exclusivo de la máquina de tubos; llega en turriles'),
('Pegamento de laminado', 'Une ambas láminas en la rebobinadora; llega en tanques o turriles, a veces se mezclan'),
('Pegamento de Turril', 'Sella la cola del log en la rebobinadora; llega en turriles'),
('Vaselina', 'Consumible de mantenimiento; llega en bidones'),
('Maicena', 'Consumible de uso ocasional'),
('Talco', 'Consumible de uso ocasional'),
('Ligas', 'Ligas negras; llegan en bolsas grandes');

INSERT INTO "InventarioInsumo" ("IdTipoInsumo", "CantidadActual")
SELECT "IdTipoInsumo", 0
FROM "TipoInsumo";



INSERT INTO "TipoMedidaSubBobina" ("MedidaMm", "Descripcion") VALUES
(435, 'Sub-bobina 435mm'),
(220, 'Sub-bobina 220mm');

INSERT INTO "FormatoSubBobina" ("DescripcionFormato", "CantidadBobina435", "CantidadBobina220") VALUES
('435x3', 3, 0),
('435x2+220x1', 2, 1);




INSERT INTO "Proveedor" ("NombreProveedor", "CelularProveedor", "CorreoProveedor", "Activo") VALUES
('Papelera del Sur S.R.L.', '70012345', 'ventas@papeleradelsur.com', true);
