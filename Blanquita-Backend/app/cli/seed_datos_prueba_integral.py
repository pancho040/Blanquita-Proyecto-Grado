"""
Script de Sembrado Integral de Datos de Prueba (Fases 1 a 4).
Puebla datos coherentes y relacionados para probar todos los módulos en conjunto:
- Multi-sucursal y multi-planta
- Configuración de precios e inventario comercial
- Envíos entre planta y sucursales (con mermas)
- Choferes, notas de venta (NV-501), firmas táctiles, pagos mixtos y promociones de bandeo
- Cuentas por cobrar y abonos QR pendientes de aprobación por Kevin
- Distribuidores mayoristas y ciclo de pedidos
- Personal, planillas duales (Oficial vs Interna), horas extra AJ, faltas, deducción "No venta" y finiquito
- Caja chica desacoplada (ciclo entregado -> rendido con comprobantes -> reintegro -> aprobación Don Osvaldo)
- Bancos referenciales con historial de conciliaciones y buscador numérico 2208
"""

import sys
import os
from datetime import datetime, date, timezone
from decimal import Decimal

# Asegurar que el path del proyecto esté disponible
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.Config.supabase import SessionLocal
from sqlalchemy import text


def seed_all():
    db = SessionLocal()
    print("🌱 Iniciando Sembrado Integral de Datos de Prueba...")

    try:
        # =========================================================================
        # 1. PLANTAS Y MULTI-SUCURSAL
        # =========================================================================
        print("  [1/9] Configurando Plantas y Sucursales...")
        # Planta 2 (Potosí Futura)
        db.execute(text("""
            INSERT INTO plantas (id, nombre, sucursal_id, activa, proveedor_inventario)
            VALUES (2, 'Planta Potosí Futura', 2, TRUE, 'COMERCIAL_PROPIO')
            ON CONFLICT (id) DO UPDATE SET
                nombre = EXCLUDED.nombre,
                sucursal_id = EXCLUDED.sucursal_id,
                proveedor_inventario = EXCLUDED.proveedor_inventario;
        """))

        # =========================================================================
        # 2. PRODUCTO CONFIG COMERCIAL & PRECIOS VIGENTES
        # =========================================================================
        print("  [2/9] Configurando Reglas Comerciales de Productos y Precios...")
        # IdProducto 6 = Servilletas para bandeo
        db.execute(text("""
            INSERT INTO "ProductoConfigComercial" ("IdProducto", "EsBandeo", "ValorBandeo", "ActivoParaVenta", "UpdatedAt")
            VALUES 
                (4, FALSE, 0, TRUE, CURRENT_TIMESTAMP),
                (5, FALSE, 0, TRUE, CURRENT_TIMESTAMP),
                (6, TRUE, 2.50, TRUE, CURRENT_TIMESTAMP)
            ON CONFLICT ("IdProducto") DO UPDATE SET
                "EsBandeo" = EXCLUDED."EsBandeo",
                "ValorBandeo" = EXCLUDED."ValorBandeo",
                "ActivoParaVenta" = EXCLUDED."ActivoParaVenta";
        """))

        # Precios vigentes para Sucursal 1 (Sucre) y Sucursal 2 (Potosí)
        for suc_id, factor in [(1, Decimal('1.00')), (2, Decimal('1.08'))]:
            for pres_id, base_price in [(10, Decimal('35.00')), (11, Decimal('25.00')), (13, Decimal('4.50')), (14, Decimal('3.00'))]:
                p_unit = (base_price * factor).quantize(Decimal('0.01'))
                db.execute(text("""
                    INSERT INTO "PrecioProducto" ("IdPresentacion", "PrecioUnitario", "PrecioMayorista", "VigenteDesde", "Activo", "IdSucursal")
                    VALUES (:pres_id, :precio, :precio, CURRENT_TIMESTAMP, TRUE, :suc_id)
                    ON CONFLICT DO NOTHING;
                """), {"pres_id": pres_id, "precio": p_unit, "suc_id": suc_id})

        # =========================================================================
        # 3. INVENTARIO COMERCIAL EN SUCURSALES Y ENVÍOS
        # =========================================================================
        print("  [3/9] Poblando Inventario Comercial de Sucursales y Envíos...")
        # Inventario Sucursal 1 (Sucre)
        for pres_id, qty in [(10, 480), (11, 350), (13, 200), (14, 150)]:
            db.execute(text("""
                INSERT INTO inventario_sucursal (sucursal_id, presentacion_id, cantidad_disponible, cantidad_reservada, updated_at)
                VALUES (1, :pres_id, :qty, 0, CURRENT_TIMESTAMP)
                ON CONFLICT (sucursal_id, presentacion_id) DO UPDATE SET
                    cantidad_disponible = EXCLUDED.cantidad_disponible,
                    updated_at = CURRENT_TIMESTAMP;
            """), {"pres_id": pres_id, "qty": qty})

        # Inventario Sucursal 2 (Potosí)
        for pres_id, qty in [(10, 220), (11, 190), (13, 80)]:
            db.execute(text("""
                INSERT INTO inventario_sucursal (sucursal_id, presentacion_id, cantidad_disponible, cantidad_reservada, updated_at)
                VALUES (2, :pres_id, :qty, 0, CURRENT_TIMESTAMP)
                ON CONFLICT (sucursal_id, presentacion_id) DO UPDATE SET
                    cantidad_disponible = EXCLUDED.cantidad_disponible,
                    updated_at = CURRENT_TIMESTAMP;
            """), {"pres_id": pres_id, "qty": qty})

        # Envíos de inventario
        # Envío 1: Completado Planta 1 -> Sucursal 1
        db.execute(text("""
            INSERT INTO envios_inventario (
                numero_guia, origen_tipo, origen_id, destino_tipo, destino_id,
                estado, descuento_planta_aplicado, chofer_nombre, camion_placa,
                usuario_despacho_id, usuario_recepcion_id, fecha_despacho, fecha_recepcion, observaciones
            ) VALUES (
                'GUIA-2026-001', 'PLANTA', 1, 'SUCURSAL', 1,
                'COMPLETADO', TRUE, 'Grover Chofer', '4521-XTR',
                4, 7, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day',
                'Despacho regular de producción semanal a almacén central Sucre'
            ) ON CONFLICT (numero_guia) DO NOTHING;
        """))

        # Envío 2: En tránsito Planta 1 -> Sucursal 2 (Potosí)
        db.execute(text("""
            INSERT INTO envios_inventario (
                numero_guia, origen_tipo, origen_id, destino_tipo, destino_id,
                estado, descuento_planta_aplicado, chofer_nombre, camion_placa,
                usuario_despacho_id, fecha_despacho, observaciones
            ) VALUES (
                'GUIA-2026-002', 'PLANTA', 1, 'SUCURSAL', 2,
                'EN_TRANSITO', FALSE, 'Marcos Condori', '3128-LMB',
                4, CURRENT_TIMESTAMP - INTERVAL '4 hours',
                'Abastecimiento de stock para Sucursal Potosí en camión mediano'
            ) ON CONFLICT (numero_guia) DO NOTHING;
        """))

        # Obtener IDs de envíos para asociar detalles
        e1_id = db.execute(text("SELECT id FROM envios_inventario WHERE numero_guia = 'GUIA-2026-001'")).scalar()
        if e1_id:
            db.execute(text("""
                INSERT INTO detalles_envio_inventario (envio_id, presentacion_id, cantidad_enviada, cantidad_recibida)
                VALUES 
                    (:eid, 10, 150, 150),
                    (:eid, 11, 100, 100)
                ON CONFLICT DO NOTHING;
            """), {"eid": e1_id})

        e2_id = db.execute(text("SELECT id FROM envios_inventario WHERE numero_guia = 'GUIA-2026-002'")).scalar()
        if e2_id:
            db.execute(text("""
                INSERT INTO detalles_envio_inventario (envio_id, presentacion_id, cantidad_enviada, cantidad_recibida)
                VALUES 
                    (:eid, 10, 100, 0),
                    (:eid, 11, 120, 0)
                ON CONFLICT DO NOTHING;
            """), {"eid": e2_id})

        # =========================================================================
        # 4. CHOFERES, INVENTARIO A BORDO Y RENDICIÓN DE RUTA
        # =========================================================================
        print("  [4/9] Sembrando Carga a Choferes y Rendición de Ruta...")
        # Chofer Marcos Condori (IdUsuario = 9)
        db.execute(text("""
            INSERT INTO inventario_chofer (
                chofer_id, sucursal_id, presentacion_id, cantidad_cargada,
                cantidad_vendida, cantidad_remanente, precio_vigente_carga, fecha_carga
            ) VALUES 
                (9, 1, 10, 120, 45, 75, 35.00, CURRENT_DATE),
                (9, 1, 11, 80, 30, 50, 25.00, CURRENT_DATE)
            ON CONFLICT DO NOTHING;
        """))

        # Chofer Alejandro Vargas (IdUsuario = 10)
        db.execute(text("""
            INSERT INTO inventario_chofer (
                chofer_id, sucursal_id, presentacion_id, cantidad_cargada,
                cantidad_vendida, cantidad_remanente, precio_vigente_carga, fecha_carga
            ) VALUES 
                (10, 1, 10, 90, 20, 70, 35.00, CURRENT_DATE),
                (10, 1, 11, 50, 15, 35, 25.00, CURRENT_DATE)
            ON CONFLICT DO NOTHING;
        """))

        # Rendición de ruta para Marcos Condori
        db.execute(text("""
            INSERT INTO "RendicionRuta" (
                "IdUsuarioRepartidor", "IdAperturaCierreCaja", "FechaRendicion", "MontoTotalCobradoRuta",
                "MontoEfectivoEntregado", "MontoTransferenciaReportada", "MontoQrReportado",
                "Conciliada", "IdUsuarioAprueba", "Observacion",
                "MontoFaltante", "CantidadMerma", "ObservacionesCierre", "EstadoConciliacion", "IdSucursal"
            ) VALUES (
                9, 1, CURRENT_DATE, 1850.00,
                1350.00, 0.00, 500.00,
                TRUE, 4, 'Ruta Mercado Campesino completada sin novedades de dinero',
                0.00, 1, '1 paquete con plástico rasgado en descarga', 'CONCILIADA', 1
            ) ON CONFLICT DO NOTHING;
        """))

        # =========================================================================
        # 5. NOTAS DE VENTA (NV-501), FIRMAS DIGITALES Y PROMOCIÓN BANDEO
        # =========================================================================
        print("  [5/9] Generando Notas de Venta con Firma Táctil y Promociones...")
        # NV-1001: Efectivo y Firma Táctil
        db.execute(text("""
            INSERT INTO "NotaVenta" (
                "NumeroNotaVenta", "NroNotaVenta", "NumeroNotaEntrega", "FechaVenta",
                "IdCliente", "DestinoDepartamento", "Chofer", "PlacaCamion",
                "TotalVentaBruto", "DescuentoBonificacion", "ImporteNeto", "TotalCancelado",
                "SaldoPendiente", "EstadoCobranza", "FechaRegistro", "IdUsuarioRegistro",
                "IdSucursal", "IdChofer", "FirmaDigitalUrl", "FirmaNombre", "FirmaCi",
                "MetodoPago", "MontoEfectivo", "MontoQR", "MontoCredito"
            ) VALUES (
                'NV-1001', '1001', 'ENT-1001', CURRENT_TIMESTAMP - INTERVAL '1 day',
                1, 'Chuquisaca', 'Marcos Condori', '3128-LMB',
                350.00, 0.00, 350.00, 350.00,
                0.00, 'PAGADO', CURRENT_TIMESTAMP - INTERVAL '1 day', 9,
                1, 9, 'data:image/svg+xml;utf8,<svg>FirmaJavierCaceres</svg>', 'Javier Caceres', '1034592-CH',
                'EFECTIVO', 350.00, 0.00, 0.00
            ) ON CONFLICT ("NumeroNotaVenta") DO NOTHING;
        """))

        # NV-1002: Promoción de Bandeo (Servilletas de Cortesía)
        db.execute(text("""
            INSERT INTO "NotaVenta" (
                "NumeroNotaVenta", "NroNotaVenta", "NumeroNotaEntrega", "FechaVenta",
                "IdCliente", "DestinoDepartamento", "Chofer", "PlacaCamion",
                "TotalVentaBruto", "DescuentoBonificacion", "Promocion", "ImporteNeto", "TotalCancelado",
                "SaldoPendiente", "EstadoCobranza", "FechaRegistro", "IdUsuarioRegistro",
                "IdSucursal", "IdChofer", "Observacion", "MetodoPago", "MontoEfectivo", "MontoQR", "MontoCredito"
            ) VALUES (
                'NV-1002', '1002', 'ENT-1002', CURRENT_TIMESTAMP - INTERVAL '6 hours',
                2, 'Chuquisaca', 'Marcos Condori', '3128-LMB',
                700.00, 0.00, 0.00, 700.00, 700.00,
                0.00, 'PAGADO', CURRENT_TIMESTAMP - INTERVAL '6 hours', 9,
                1, 9, 'Bandeo 2x Servilletas de Cortesía por Plancha aplicado', 'EFECTIVO', 700.00, 0.00, 0.00
            ) ON CONFLICT ("NumeroNotaVenta") DO NOTHING;
        """))

        # NV-1003: Pago Mixto (Efectivo + QR)
        db.execute(text("""
            INSERT INTO "NotaVenta" (
                "NumeroNotaVenta", "NroNotaVenta", "NumeroNotaEntrega", "FechaVenta",
                "IdCliente", "DestinoDepartamento", "Chofer", "PlacaCamion",
                "TotalVentaBruto", "DescuentoBonificacion", "ImporteNeto", "TotalCancelado",
                "SaldoPendiente", "EstadoCobranza", "FechaRegistro", "IdUsuarioRegistro",
                "IdSucursal", "IdChofer", "MetodoPago", "MontoEfectivo", "MontoQR", "MontoCredito"
            ) VALUES (
                'NV-1003', '1003', 'ENT-1003', CURRENT_TIMESTAMP - INTERVAL '3 hours',
                3, 'Chuquisaca', 'Alejandro Vargas', '1892-KPT',
                500.00, 0.00, 500.00, 500.00,
                0.00, 'PAGADO', CURRENT_TIMESTAMP - INTERVAL '3 hours', 10,
                1, 10, 'MIXTO', 200.00, 300.00, 0.00
            ) ON CONFLICT ("NumeroNotaVenta") DO NOTHING;
        """))

        # NV-1004: A Crédito (Genera Cuenta por Cobrar)
        db.execute(text("""
            INSERT INTO "NotaVenta" (
                "NumeroNotaVenta", "NroNotaVenta", "NumeroNotaEntrega", "FechaVenta",
                "IdCliente", "DestinoDepartamento", "Chofer", "PlacaCamion",
                "TotalVentaBruto", "DescuentoBonificacion", "ImporteNeto", "TotalCancelado",
                "SaldoPendiente", "EstadoCobranza", "FechaRegistro", "IdUsuarioRegistro",
                "IdSucursal", "IdChofer", "MetodoPago", "MontoEfectivo", "MontoQR", "MontoCredito"
            ) VALUES (
                'NV-1004', '1004', 'ENT-1004', CURRENT_TIMESTAMP - INTERVAL '2 days',
                4, 'Chuquisaca', 'Alejandro Vargas', '1892-KPT',
                800.00, 0.00, 800.00, 0.00,
                800.00, 'PENDIENTE', CURRENT_TIMESTAMP - INTERVAL '2 days', 10,
                1, 10, 'CREDITO', 0.00, 0.00, 800.00
            ) ON CONFLICT ("NumeroNotaVenta") DO NOTHING;
        """))

        # NV-2208: Búsqueda Rápida de Don Osvaldo (Ajustada por Kevin)
        db.execute(text("""
            INSERT INTO "NotaVenta" (
                "NumeroNotaVenta", "NroNotaVenta", "NumeroNotaEntrega", "FechaVenta",
                "IdCliente", "DestinoDepartamento", "Chofer", "PlacaCamion",
                "TotalVentaBruto", "DescuentoBonificacion", "ImporteNeto", "TotalCancelado",
                "SaldoPendiente", "EstadoCobranza", "FechaRegistro", "IdUsuarioRegistro",
                "IdSucursal", "IdChofer", "EditadoPorKevin", "ObservacionAjuste",
                "MetodoPago", "MontoEfectivo", "MontoQR", "MontoCredito"
            ) VALUES (
                'NV-2208', '2208', 'ENT-2208', CURRENT_TIMESTAMP - INTERVAL '1 day',
                5, 'Chuquisaca', 'Marcos Condori', '3128-LMB',
                2208.00, 0.00, 2208.00, 2208.00,
                0.00, 'PAGADO', CURRENT_TIMESTAMP - INTERVAL '1 day', 9,
                1, 9, TRUE, 'Ajuste comercial aplicado por Kevin: Descuento autorizado por volumen de compra mayorista.',
                'EFECTIVO', 2208.00, 0.00, 0.00
            ) ON CONFLICT ("NumeroNotaVenta") DO NOTHING;
        """))

        # Detalles de Notas de Venta
        nv1 = db.execute(text("SELECT \"IdNotaVenta\" FROM \"NotaVenta\" WHERE \"NumeroNotaVenta\" = 'NV-1001'")).scalar()
        if nv1:
            db.execute(text("""
                INSERT INTO "DetalleNotaVenta" ("IdNotaVenta", "IdPresentacion", "NombreProducto", "Cantidad", "PrecioUnitario", "Subtotal", "EsBonificacionBandeo")
                VALUES (:nvid, 10, 'Papel Higiénico MRO-P12 Plancha', 10, 35.00, 350.00, FALSE)
                ON CONFLICT DO NOTHING;
            """), {"nvid": nv1})

        nv2 = db.execute(text("SELECT \"IdNotaVenta\" FROM \"NotaVenta\" WHERE \"NumeroNotaVenta\" = 'NV-1002'")).scalar()
        if nv2:
            db.execute(text("""
                INSERT INTO "DetalleNotaVenta" ("IdNotaVenta", "IdPresentacion", "NombreProducto", "Cantidad", "PrecioUnitario", "Subtotal", "EsBonificacionBandeo")
                VALUES 
                    (:nvid, 10, 'Papel Higiénico MRO-P12 Plancha', 20, 35.00, 700.00, FALSE),
                    (:nvid, 14, 'Servilleta MER-S01 Cortesía Bandeo', 4, 0.00, 0.00, TRUE)
                ON CONFLICT DO NOTHING;
            """), {"nvid": nv2})

        # =========================================================================
        # 6. CUENTAS POR COBRAR Y ABONOS QR PENDIENTES DE APROBACIÓN POR KEVIN
        # =========================================================================
        print("  [6/9] Creando Cuentas por Cobrar y Abonos QR para Aprobación de Kevin...")
        # Cuenta por cobrar para NV-1004
        db.execute(text("""
            INSERT INTO "CuentaCobrar" (
                "IdCliente", "IdEstadoCuentaCobrar", "MontoTotal", "SaldoPendiente", "FechaEmision", "FechaVencimiento",
                "IdUsuarioRegistro", "NumeroNotaVenta", "IdSucursal", "EstadoCobranza", "EstadoAprobacion"
            ) VALUES (
                4, 2, 800.00, 450.00, CURRENT_DATE - 2, CURRENT_DATE + 15,
                10, 'NV-1004', 1, 'EN_MORA', 'APROBADO'
            ) ON CONFLICT DO NOTHING;
        """))

        cxc_id = db.execute(text("SELECT \"IdCuentaCobrar\" FROM \"CuentaCobrar\" WHERE \"NumeroNotaVenta\" = 'NV-1004'")).scalar()
        if cxc_id:
            # Abono 1: Aprobado
            db.execute(text("""
                INSERT INTO "AbonoCuentaCobrar" (
                    "IdCuentaCobrar", "IdMetodoPago", "MontoAbonado", "FechaAbono", "IdUsuario",
                    "NumeroReferencia", "Observacion", "IdCuentaBancaria", "BancoSigla",
                    "EstadoAprobacion", "AprobadoPor", "FechaAprobacion", "MetodoPago"
                ) VALUES (
                    :cid, 2, 350.00, CURRENT_TIMESTAMP - INTERVAL '1 day', 9,
                    'TRANSF-BNB-78912', 'Transferencia bancaria regular confirmada', 2, 'BNB',
                    'APROBADO', 4, CURRENT_TIMESTAMP - INTERVAL '18 hours', 'Transferencia'
                ) ON CONFLICT DO NOTHING;
            """), {"cid": cxc_id})

            # Abono 2: PENDIENTE DE APROBACIÓN (para la pantalla de Kevin /contador/aprobacion-qr)
            db.execute(text("""
                INSERT INTO "AbonoCuentaCobrar" (
                    "IdCuentaCobrar", "IdMetodoPago", "MontoAbonado", "FechaAbono", "IdUsuario",
                    "NumeroReferencia", "Observacion", "IdCuentaBancaria", "BancoSigla",
                    "EstadoAprobacion", "MetodoPago"
                ) VALUES (
                    :cid, 3, 450.00, CURRENT_TIMESTAMP - INTERVAL '2 hours', 10,
                    'QR-BMSC-45901', 'Cobro QR escaneado en tienda Gustavo Tellez', 3, 'BMSC',
                    'PENDIENTE_APROBACION', 'QR'
                ) ON CONFLICT DO NOTHING;
            """), {"cid": cxc_id})

        # =========================================================================
        # 7. DISTRIBUIDORES MAYORISTAS Y PEDIDOS (ORURO, TARIJA, TUPIZA, LA PAZ)
        # =========================================================================
        print("  [7/9] Sembrando Distribuidores Mayoristas y Pedidos Especiales...")
        distribuidores = [
            (1, 'Distribuidora Oruro Central', 'Roberto Oruñes', '71829304', 'Oruro', 'Calle Bolívar 450'),
            (2, 'Comercializadora del Sur Tarija', 'Lucía Vallejos', '72839405', 'Tarija', 'Av. Las Panosas 120'),
            (3, 'Distribuciones Tupiza SRL', 'Marcos Churata', '73940516', 'Tupiza', 'Calle Suipacha 88'),
            (4, 'Almacenes La Paz Titikaka', 'Hernán Quisbert', '74051627', 'La Paz', 'Zona Villa Fátima Av. Tejada 1200'),
        ]
        for d in distribuidores:
            db.execute(text("""
                INSERT INTO distribuidores_externos (
                    id, id_usuario, nombre_comercial, contacto_nombre, telefono, ciudad, direccion, activo
                ) VALUES (
                    :id, 1, :nombre, :contacto, :tel, :ciudad, :dir, TRUE
                ) ON CONFLICT (id) DO UPDATE SET
                    nombre_comercial = EXCLUDED.nombre_comercial,
                    contacto_nombre = EXCLUDED.contacto_nombre,
                    telefono = EXCLUDED.telefono,
                    ciudad = EXCLUDED.ciudad;
            """), {"id": d[0], "nombre": d[1], "contacto": d[2], "tel": d[3], "ciudad": d[4], "dir": d[5]})

        # Pedidos mayoristas
        # Pedido 1: PENDIENTE (Oruro)
        db.execute(text("""
            INSERT INTO pedidos_distribuidores (
                codigo_pedido, distribuidor_id, fecha_pedido, estado, monto_total, observacion_distribuidor
            ) VALUES (
                'PED-ORU-001', 1, CURRENT_TIMESTAMP - INTERVAL '1 day', 'PENDIENTE', 7000.00,
                'Pedido mensual para abarrotes de Oruro'
            ) ON CONFLICT (codigo_pedido) DO NOTHING;
        """))

        # Pedido 2: AJUSTADO POR KEVIN (Tarija)
        db.execute(text("""
            INSERT INTO pedidos_distribuidores (
                codigo_pedido, distribuidor_id, fecha_pedido, estado, monto_total,
                observacion_kevin, observacion_distribuidor
            ) VALUES (
                'PED-TAR-002', 2, CURRENT_TIMESTAMP - INTERVAL '2 days', 'AJUSTADO', 5250.00,
                'Ajustado por Kevin: Se redujo cantidad de planchas MRO-P12 por stock comprometido en planta.',
                'Pedido quincenal Tarija'
            ) ON CONFLICT (codigo_pedido) DO NOTHING;
        """))

        # Pedido 3: APROBADO_DESPACHO (La Paz)
        db.execute(text("""
            INSERT INTO pedidos_distribuidores (
                codigo_pedido, distribuidor_id, fecha_pedido, estado, monto_total,
                observacion_kevin, fecha_aprobacion
            ) VALUES (
                'PED-LPZ-003', 4, CURRENT_TIMESTAMP - INTERVAL '3 days', 'APROBADO_DESPACHO', 14000.00,
                'Depósito bancario en Banco Unión verificado y stock separado en planta.', CURRENT_TIMESTAMP - INTERVAL '1 day'
            ) ON CONFLICT (codigo_pedido) DO NOTHING;
        """))

        # =========================================================================
        # 8. PERSONAL, PLANILLAS DUALES, HORAS AJ, NO VENTA Y FINIQUITOS
        # =========================================================================
        print("  [8/9] Sembrando RRHH: Empleados, Planillas Duales, No Venta y Finiquito...")
        # Datos laborales
        empleados = [
            (1, Decimal('5200.00'), date(2022, 3, 1), 'Jefe de Operaciones', 'OPERACIONES', 1, True, None),
            (7, Decimal('4500.00'), date(2023, 1, 15), 'Contador General', 'ADMINISTRACION', 1, True, None),
            (8, Decimal('3600.00'), date(2023, 6, 1), 'Técnico Maquinista', 'PLANTA', 1, True, None),
            (9, Decimal('2800.00'), date(2024, 2, 1), 'Chofer Distribuidor', 'DISTRIBUCION', 1, False, None),
            (10, Decimal('2800.00'), date(2024, 4, 1), 'Chofer Repartidor', 'DISTRIBUCION', 1, False, None),
        ]
        for emp in empleados:
            db.execute(text("""
                INSERT INTO "DatosLaboralesEmpleado" (
                    "IdUsuario", "SueldoBasico", "FechaIngreso", "Cargo", "Area", "IdSucursal", "EsAsegurado", "Activo"
                ) VALUES (
                    :uid, :sueldo, :ingreso, :cargo, :area, :suc, :asegurado, TRUE
                ) ON CONFLICT ("IdUsuario") DO UPDATE SET
                    "SueldoBasico" = EXCLUDED."SueldoBasico",
                    "Cargo" = EXCLUDED."Cargo",
                    "EsAsegurado" = EXCLUDED."EsAsegurado";
            """), {
                "uid": emp[0], "sueldo": emp[1], "ingreso": emp[2],
                "cargo": emp[3], "area": emp[4], "suc": emp[5], "asegurado": emp[6]
            })

        # Deuda compartida "No venta"
        db.execute(text("""
            INSERT INTO deudas_no_venta (
                concepto, monto_total, num_responsables, fecha_incidente, estado, id_sucursal
            ) VALUES (
                'Pérdida por mercadería aplastada en frenada de emergencia', 400.00, 2, CURRENT_DATE - 10, 'EN_DESCUENTO', 1
            ) ON CONFLICT DO NOTHING;
        """))

        deuda_id = db.execute(text("SELECT id FROM deudas_no_venta WHERE concepto LIKE '%frenada de emergencia%'")).scalar()
        if deuda_id:
            db.execute(text("""
                INSERT INTO detalles_no_venta_empleado (deuda_no_venta_id, id_usuario, cuota_descuento, aplicado)
                VALUES 
                    (:did, 9, 200.00, TRUE),
                    (:did, 10, 200.00, TRUE)
                ON CONFLICT DO NOTHING;
            """), {"did": deuda_id})

        # Planilla OFICIAL Sucre
        db.execute(text("""
            INSERT INTO "Planilla" (
                "IdPeriodoNomina", "IdUsuarioGenera", "FechaGeneracion",
                "TotalSueldoBruto", "TotalDeducciones", "TotalLiquido",
                "Aprobada", "Observacion", "TipoPlanilla", "IdSucursal"
            ) VALUES (
                1, 7, CURRENT_TIMESTAMP - INTERVAL '5 days',
                13300.00, 1690.43, 11609.57,
                TRUE, 'Planilla Oficial Declarada a la Gestora Pública (Asegurados)', 'OFICIAL', 1
            ) ON CONFLICT DO NOTHING;
        """))

        # Planilla INTERNA Sucre (con horas extra AJ, faltas y No Venta)
        db.execute(text("""
            INSERT INTO "Planilla" (
                "IdPeriodoNomina", "IdUsuarioGenera", "FechaGeneracion",
                "TotalSueldoBruto", "TotalDeducciones", "TotalLiquido",
                "Aprobada", "Observacion", "TipoPlanilla", "IdSucursal"
            ) VALUES (
                1, 7, CURRENT_TIMESTAMP - INTERVAL '5 days',
                18900.00, 1250.00, 17650.00,
                TRUE, 'Planilla Interna Operativa Sucre con AJ de Don Osvaldo y Deducción No Venta', 'INTERNA', 1
            ) ON CONFLICT DO NOTHING;
        """))

        plan_int_id = db.execute(text("SELECT \"IdPlanilla\" FROM \"Planilla\" WHERE \"TipoPlanilla\" = 'INTERNA' AND \"IdSucursal\" = 1 LIMIT 1")).scalar()
        if plan_int_id:
            # Detalle Chofer Marcos Condori (Id 9): Sueldo 2800, ValorHora 11.6667, Falta 1 día (93.33), No Venta 200.00
            db.execute(text("""
                INSERT INTO "DetallePlanilla" (
                    "IdPlanilla", "IdUsuario", "SueldoBasico", "MontoHorasExtra",
                    "DescuentoFaltas", "DescuentoNoVenta", "TotalGanado", "TotalDescuento",
                    "LiquidoPagable", "HorasTrabajadasAJ", "ValorHora", "Observacion"
                ) VALUES (
                    :pid, 9, 2800.00, 150.00,
                    93.33, 200.00, 2950.00, 293.33,
                    2656.67, 180.00, 11.6667, 'Descuento No Venta aplicado por mercadería dañada'
                ) ON CONFLICT DO NOTHING;
            """), {"pid": plan_int_id})

        # Finiquito calculado (Art. 13 LGT)
        db.execute(text("""
            INSERT INTO "Finiquito" (
                "IdUsuario", "FechaIngreso", "FechaRetiro", "MotivoRetiro",
                "Anios", "Meses", "Dias", "Sueldo1", "Sueldo2", "Sueldo3", "SueldoPromedio",
                "MontoIndemnizacion", "AguinaldoDuodecimas", "VacacionDuodecimas",
                "Desahucios", "Deducciones", "MontoTotal", "AprobadoPorGerencia"
            ) VALUES (
                8, '2023-01-15', '2025-07-15', 'RETIRO_VOLUNTARIO',
                2, 6, 0, 3600.00, 3600.00, 3600.00, 3600.00,
                9000.00, 1950.00, 1800.00,
                0.00, 0.00, 12750.00, TRUE
            ) ON CONFLICT DO NOTHING;
        """))

        # =========================================================================
        # 9. CAJA CHICA DESACOPLADA, FIRMAS DIGITALES Y CONCILIACIÓN BANCARIA
        # =========================================================================
        print("  [9/9] Sembrando Caja Chica Desacoplada, Firmas Digitales y Conciliaciones...")
        # Vale 1: ENTREGADO (700 Bs)
        db.execute(text("""
            INSERT INTO "SolicitudCajaChica" (
                "CodigoSolicitud", "IdCaja", "FechaSolicitud", "NombreSolicitante", "CargoSolicitante",
                "MontoSolicitado", "MontoEntregado", "MontoGastoReal", "MontoReintegro",
                "DestinoJustificacion", "NombreEntregadoPor", "Estado", "AprobacionGerencia", "IdSucursal"
            ) VALUES (
                'VALE-CCH-101', 1, CURRENT_DATE - 1, 'David Condo', 'Técnico Maquinista',
                700.00, 700.00, 0.00, 0.00,
                'Compra de rodamientos de repuesto para máquina rebobinadora', 'Carlos Mamani',
                'ENTREGADO', 'PENDIENTE', 1
            ) ON CONFLICT DO NOTHING;
        """))

        # Vale 2: RENDIDO (Entregado: 600, Real: 510, Reintegro a caja: 90)
        db.execute(text("""
            INSERT INTO "SolicitudCajaChica" (
                "CodigoSolicitud", "IdCaja", "FechaSolicitud", "NombreSolicitante", "CargoSolicitante",
                "MontoSolicitado", "MontoEntregado", "MontoGastoReal", "MontoReintegro",
                "DestinoJustificacion", "NombreEntregadoPor", "Estado", "AprobacionGerencia", "IdSucursal"
            ) VALUES (
                'VALE-CCH-102', 1, CURRENT_DATE - 2, 'Marcos Condori', 'Chofer Distribuidor',
                600.00, 600.00, 510.00, 90.00,
                'Gastos de emergencia en ruta: parchado de llanta y compra de aceite motor', 'Carlos Mamani',
                'RENDIDO', 'PENDIENTE', 1
            ) ON CONFLICT DO NOTHING;
        """))

        # Vale 3: APROBADO POR DON OSVALDO (380 Bs)
        db.execute(text("""
            INSERT INTO "SolicitudCajaChica" (
                "CodigoSolicitud", "IdCaja", "FechaSolicitud", "NombreSolicitante", "CargoSolicitante",
                "MontoSolicitado", "MontoEntregado", "MontoGastoReal", "MontoReintegro",
                "DestinoJustificacion", "NombreEntregadoPor", "NombreAprobadoPor", "Estado", "AprobacionGerencia", "IdSucursal"
            ) VALUES (
                'VALE-CCH-103', 1, CURRENT_DATE - 3, 'David Condo', 'Técnico Maquinista',
                380.00, 380.00, 380.00, 0.00,
                'Compra de material de limpieza industrial y bolsas plásticas', 'Carlos Mamani', 'Osvaldo Tellez',
                'Aprobada', 'APROBADO', 1
            ) ON CONFLICT DO NOTHING;
        """))

        v2_id = db.execute(text("SELECT \"IdSolicitudCajaChica\" FROM \"SolicitudCajaChica\" WHERE \"CodigoSolicitud\" = 'VALE-CCH-102'")).scalar()
        if v2_id:
            db.execute(text("""
                INSERT INTO "DetalleGastoCajaChica" (solicitud_id, concepto, nro_factura, proveedor, monto)
                VALUES 
                    (:sid, 'Aceite 20W50 para motor camión', 'F-10293', 'Lubricentro El Tuercas', 320.00),
                    (:sid, 'Parchado de llanta delantera derecha', 'REC-084', 'Gomería San Cristóbal', 90.00),
                    (:sid, 'Líquido para frenos DOT4', 'F-8841', 'AutoRepuestos Sucre', 100.00)
                ON CONFLICT DO NOTHING;
            """), {"sid": v2_id})

        v3_id = db.execute(text("SELECT \"IdSolicitudCajaChica\" FROM \"SolicitudCajaChica\" WHERE \"CodigoSolicitud\" = 'VALE-CCH-103'")).scalar()
        if v3_id:
            # Registrar firma digital de Don Osvaldo sobre el vale 3
            db.execute(text("""
                INSERT INTO "FirmaDigitalDocumento" (
                    "IdUsuario", "TipoDocumento", "IdRegistroDocumento", "CodigoReferencia",
                    "UrlFotoFirmaSello", "Observaciones"
                ) VALUES (
                    13, 'SOLICITUD_CAJA_CHICA', :vid, 'VALE-CCH-103',
                    'data:image/svg+xml;utf8,<svg>SelloDonOsvaldoGerencia</svg>',
                    'Aprobado y autorizado formalmente por Gerencia General'
                ) ON CONFLICT DO NOTHING;
            """), {"vid": v3_id})

        # Registrar historial de conciliaciones bancarias para los 3 bancos
        db.execute(text("""
            INSERT INTO "ConciliacionBancariaHistorial" (
                "IdCuentaBancaria", "SaldoAnterior", "SaldoNuevo", "Diferencia", "IdUsuario", "Observacion"
            ) VALUES 
                (1, 275367.00, 280000.00, 4633.00, 13, 'Conciliación mensual Banco Unión depósitos mayoristas'),
                (2, 150000.00, 154200.00, 4200.00, 13, 'Conciliación BNB operaciones institucionales'),
                (3, 45000.00, 48500.00, 3500.00, 13, 'Conciliación BMSC liquidación choferes fin de semana')
            ON CONFLICT DO NOTHING;
        """))

        # Actualizar saldos conciliados en CuentaBancariaEmpresa
        db.execute(text("""
            UPDATE "CuentaBancariaEmpresa" SET "SaldoConciliado" = 280000.00, "FechaUltimaConciliacion" = CURRENT_TIMESTAMP WHERE "IdCuentaBancaria" = 1;
            UPDATE "CuentaBancariaEmpresa" SET "SaldoConciliado" = 154200.00, "FechaUltimaConciliacion" = CURRENT_TIMESTAMP WHERE "IdCuentaBancaria" = 2;
            UPDATE "CuentaBancariaEmpresa" SET "SaldoConciliado" = 48500.00, "FechaUltimaConciliacion" = CURRENT_TIMESTAMP WHERE "IdCuentaBancaria" = 3;
        """))

        db.commit()
        print("✅ ¡Sembrado Integral completado exitosamente sin errores!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error durante el sembrado integral: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
