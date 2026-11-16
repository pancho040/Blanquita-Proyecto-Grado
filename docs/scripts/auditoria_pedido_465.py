"""
Auditoría formal de solo lectura del Pedido 465 (Jaime Villegas, Bs. 3.100 en efectivo).
Papelera Blanquita - Sistema ERP
"""
import sys
import os
import json
from decimal import Decimal

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "Blanquita-Backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.Config.supabase import SessionLocal
from sqlalchemy import text


def auditar_pedido_465():
    db = SessionLocal()
    try:
        # 1. Cabecera del pedido, cliente y punto de venta
        pedido_sql = """
            SELECT 
                p."IdPedido",
                p."IdCliente",
                c."RazonSocial",
                c."NombreComercial",
                c."Telefono",
                p."IdPuntoVenta",
                pv."NombrePuntoVenta",
                pv."Direccion",
                pv."Latitud",
                pv."Longitud",
                p."IdEstadoPedido",
                ep."NombreEstado" AS "EstadoPedido",
                p."MontoTotal" AS "TotalPedido",
                p."FechaPedido",
                p."FechaEntrega",
                p."IdAsignacionRuta",
                p."IdUsuarioRepartidor",
                u."PrimerNombre" || ' ' || COALESCE(u."ApellidoPaterno", '') AS "NombreRepartidor"
            FROM public."Pedido" p
            LEFT JOIN public."Cliente" c ON c."IdCliente" = p."IdCliente"
            LEFT JOIN public."PuntoVenta" pv ON pv."IdPuntoVenta" = p."IdPuntoVenta"
            LEFT JOIN public."EstadoPedido" ep ON ep."IdEstadoPedido" = p."IdEstadoPedido"
            LEFT JOIN public."Usuario" u ON u."IdUsuario" = p."IdUsuarioRepartidor"
            WHERE p."IdPedido" = 465;
        """
        row_ped = db.execute(text(pedido_sql)).mappings().fetchone()

        # 2. Detalle de ítems
        detalle_sql = """
            SELECT 
                dp."IdDetallePedido",
                dp."IdPresentacion",
                COALESCE(pres."TipoContenedor", 'Presentación ' || dp."IdPresentacion") AS "NombrePresentacion",
                dp."Cantidad",
                dp."PrecioUnitarioAplicado",
                dp."Subtotal"
            FROM public."DetallePedido" dp
            LEFT JOIN public."PresentacionProducto" pres ON pres."IdPresentacion" = dp."IdPresentacion"
            WHERE dp."IdPedido" = 465;
        """
        rows_det = db.execute(text(detalle_sql)).mappings().fetchall()

        # 3. Pagos asociados
        pago_sql = """
            SELECT 
                pp."IdPagoPedido",
                pp."IdPedido",
                pp."IdMetodoPago",
                mp."NombreMetodoPago",
                pp."Monto",
                pp."FechaPago",
                pp."NumeroReferencia",
                pp."Observacion"
            FROM public."PagoPedido" pp
            LEFT JOIN public."MetodoPago" mp ON mp."IdMetodoPago" = pp."IdMetodoPago"
            WHERE pp."IdPedido" = 465;
        """
        rows_pago = db.execute(text(pago_sql)).mappings().fetchall()

        # 4. Parada en la asignación de ruta
        row_parada = None

        # 5. Comparativa de cifras con y sin el pedido 465 para la asignación 254
        totales_sql = """
            SELECT 
                COUNT(pp."IdPagoPedido") AS "TotalCobros",
                COALESCE(SUM(pp."Monto"), 0) AS "TotalCobradoTotal",
                COALESCE(SUM(CASE WHEN pp."IdPedido" = 465 THEN pp."Monto" ELSE 0 END), 0) AS "CobradoPedido465",
                COALESCE(SUM(CASE WHEN pp."IdPedido" <> 465 THEN pp."Monto" ELSE 0 END), 0) AS "CobradoSinPedido465",
                COALESCE(SUM(CASE WHEN mp."NombreMetodoPago" ILIKE '%efectivo%' THEN pp."Monto" ELSE 0 END), 0) AS "TotalEfectivo",
                COALESCE(SUM(CASE WHEN mp."NombreMetodoPago" ILIKE '%qr%' OR mp."NombreMetodoPago" ILIKE '%transf%' THEN pp."Monto" ELSE 0 END), 0) AS "TotalDigital"
            FROM public."PagoPedido" pp
            JOIN public."Pedido" p ON p."IdPedido" = pp."IdPedido"
            LEFT JOIN public."MetodoPago" mp ON mp."IdMetodoPago" = pp."IdMetodoPago"
            WHERE p."IdAsignacionRuta" = 254;
        """
        row_totales = db.execute(text(totales_sql)).mappings().fetchone()

        resultado = {
            "pedido": dict(row_ped) if row_ped else None,
            "detalle_items": [dict(r) for r in rows_det],
            "pagos": [dict(r) for r in rows_pago],
            "parada": dict(row_parada) if row_parada else None,
            "resumen_asignacion_254": dict(row_totales) if row_totales else None
        }

        # Imprimir reporte formal formateado
        print("======================================================================")
        print("          AUDITORÍA FORMAL DE SOLO LECTURA: PEDIDO #465               ")
        print("======================================================================")
        if not row_ped:
            print("El pedido 465 no existe en la base de datos.")
            return

        print(f"Pedido ID:         {row_ped['IdPedido']}")
        print(f"Cliente:           ID {row_ped['IdCliente']} - {row_ped['RazonSocial']} ({row_ped['NombreComercial'] or 'S/N'})")
        print(f"Teléfono:          {row_ped['Telefono'] or 'No registrado'}")
        print(f"Punto de Venta:    ID {row_ped['IdPuntoVenta']} - {row_ped['NombrePuntoVenta']}")
        print(f"Dirección:         {row_ped['Direccion']}")
        print(f"Coordenadas:       Lat: {row_ped['Latitud']}, Lng: {row_ped['Longitud']}")
        print(f"Estado del Pedido: {row_ped['EstadoPedido']} (ID {row_ped['IdEstadoPedido']})")
        print(f"Total del Pedido:  Bs. {row_ped['TotalPedido']}")
        print(f"Fecha Creación:    {row_ped['FechaPedido']}")
        print(f"Asignación Ruta:   #{row_ped['IdAsignacionRuta']}")
        print(f"Repartidor:        ID {row_ped['IdUsuarioRepartidor']} - {row_ped['NombreRepartidor']}")

        print("\n--- DETALLE DE ÍTEMS (PRODUCTOS ENTREGADOS) ---")
        suma_items = Decimal("0.00")
        for it in rows_det:
            sub = Decimal(str(it["Subtotal"] or 0))
            suma_items += sub
            print(f"  • {it['NombrePresentacion']} | Cant: {it['Cantidad']} paq. | P.U: Bs. {it['PrecioUnitarioAplicado']} | Subtotal: Bs. {sub:.2f}")
        print(f"  TOTAL CALCULADO ÍTEMS: Bs. {suma_items:.2f} | TOTAL EN CABECERA: Bs. {row_ped['TotalPedido']}")

        print("\n--- PAGOS Y COBROS REGISTRADOS ---")
        total_pagado = Decimal("0.00")
        for pg in rows_pago:
            monto = Decimal(str(pg["Monto"] or 0))
            total_pagado += monto
            print(f"  • Pago ID #{pg['IdPagoPedido']} | Método: {pg['NombreMetodoPago']} | Monto: Bs. {monto:.2f} | Fecha: {pg['FechaPago']}")
            print(f"    Referencia: {pg['NumeroReferencia'] or 'N/A'}")
            print(f"    Observaciones: {pg['Observacion'] or 'Sin observaciones'}")

        print("\n--- COMPARATIVA DE CIFRAS EN ASIGNACIÓN 254 (JAIME VILLEGAS) ---")
        if row_totales:
            cobrado_total = Decimal(str(row_totales["TotalCobradoTotal"]))
            cobrado_465 = Decimal(str(row_totales["CobradoPedido465"]))
            cobrado_sin_465 = Decimal(str(row_totales["CobradoSinPedido465"]))
            efectivo = Decimal(str(row_totales["TotalEfectivo"]))
            digital = Decimal(str(row_totales["TotalDigital"]))
            print(f"  Total cobrado general en ruta:  Bs. {cobrado_total:.2f}")
            print(f"  Cobrado del Pedido 465 solo:    Bs. {cobrado_465:.2f} (100% en efectivo)")
            print(f"  Total cobrado SIN Pedido 465:   Bs. {cobrado_sin_465:.2f}")
            print(f"  Desglose Efectivo con Pedido:   Bs. {efectivo:.2f}")
            print(f"  Desglose Digital (QR/Banco):    Bs. {digital:.2f}")
            print(f"  Proporción de efectivo del 465: {(cobrado_465 / cobrado_total * 100 if cobrado_total > 0 else 0):.1f}% del total")

        print("======================================================================")
        return resultado
    finally:
        db.close()


if __name__ == "__main__":
    auditar_pedido_465()
