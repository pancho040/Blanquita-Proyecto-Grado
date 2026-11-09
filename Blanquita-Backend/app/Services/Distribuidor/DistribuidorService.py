from typing import Optional, List, Dict
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi import HTTPException, status

from app.Repository.Distribuidor.DistribuidorRepository import DistribuidorRepository
from app.Services.Planta.PlantaDataReader import PlantaDataReader
from app.Services.Common.NotificationService import NotificationService
from app.Services.Usuario.AuditService import AuditService
from app.Models.Distribuidor.DistribuidorModel import (
    PedidoDistribuidorCrear, AjustePedidoKevinRequest, SubirBoletaPagoRequest
)

class DistribuidorService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = DistribuidorRepository(db)
        self.planta_reader = PlantaDataReader(db)
        self.notif_service = NotificationService(db)
        self.audit_service = AuditService(db)

    def ListarDistribuidores(self, activo: Optional[bool] = None) -> List[Dict]:
        return self.repo.ListarDistribuidores(activo)

    def ObtenerDistribuidorPorId(self, distribuidor_id: int) -> Dict:
        dist = self.repo.ObtenerDistribuidorPorId(distribuidor_id)
        if not dist:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Distribuidor no encontrado")
        return dist

    def ConsultarStockDisponibleMayorista(self) -> List[Dict]:
        """Consulta el stock físico real en planta disponible para pedidos de distribuidores."""
        return self.planta_reader.get_catalogo_productos()

    def CrearPedidoDistribuidor(self, dto: PedidoDistribuidorCrear, id_usuario: int) -> Dict:
        dist = self.repo.ObtenerDistribuidorPorId(dto.distribuidor_id)
        if not dist:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Distribuidor no encontrado")

        if not dto.detalles:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El pedido debe incluir al menos un producto")

        # 1. Validación estricta de existencias reales en planta Sucre (id_planta=1)
        detalles_procesados = []
        monto_total = Decimal("0.00")

        for d in dto.detalles:
            stock_disponible = self.planta_reader.get_stock_disponible(1, d.presentacion_id)
            if d.cantidad_solicitada > stock_disponible:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Stock insuficiente en planta para presentación #{d.presentacion_id}: solicitados {d.cantidad_solicitada}, disponibles {stock_disponible}."
                )

            # Obtener precio comercial mayorista vigente (Sucursal Sucre = 1)
            sql_precio = """
                SELECT "PrecioUnitario" 
                FROM "PrecioProducto" 
                WHERE "IdPresentacion" = :p AND "IdSucursal" = 1 
                ORDER BY "FechaVigenciaDesde" DESC LIMIT 1;
            """
            p_unit = self.db.execute(text(sql_precio), {"p": d.presentacion_id}).scalar()
            precio_u = Decimal(str(p_unit or 22.50))
            subtotal = Decimal(str(d.cantidad_solicitada)) * precio_u
            monto_total += subtotal

            detalles_procesados.append({
                "presentacion_id": d.presentacion_id,
                "cantidad": d.cantidad_solicitada,
                "precio_u": float(precio_u),
                "subtotal": float(subtotal)
            })

        # 2. Generar código único de pedido (ej: PED-DIST-20261109-1)
        codigo_pedido = f"PED-DIST-{int(datetime.now().timestamp())}"
        pedido = self.repo.CrearPedido(
            codigo_pedido=codigo_pedido,
            distribuidor_id=dto.distribuidor_id,
            monto_total=float(monto_total),
            obs_distribuidor=dto.observacion_distribuidor
        )
        pedido_id = pedido["id"]

        for dp in detalles_procesados:
            self.repo.CrearDetallePedido(
                pedido_id=pedido_id,
                presentacion_id=dp["presentacion_id"],
                cantidad=dp["cantidad"],
                precio_u=dp["precio_u"],
                subtotal=dp["subtotal"]
            )

        # 3. Notificar a Kevin en Contabilidad
        self.notif_service.CrearNotificacion(
            id_usuario_destino=1, # Admin / Kevin
            titulo="Nuevo Pedido de Distribuidor",
            mensaje=f"{dist['nombre_comercial']} ({dist['ciudad']}) envió el pedido {codigo_pedido} por Bs. {float(monto_total):.2f}.",
            tipo="INFO"
        )

        self.db.commit()
        return self.ObtenerPedidoDetalle(pedido_id)

    def ObtenerPedidoDetalle(self, pedido_id: int) -> Dict:
        pedido = self.repo.ObtenerPedidoPorId(pedido_id)
        if not pedido:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
        pedido["detalles"] = self.repo.ListarDetallesPedido(pedido_id)
        return pedido

    def ListarPedidos(self, distribuidor_id: Optional[int] = None, estado: Optional[str] = None) -> List[Dict]:
        pedidos = self.repo.ListarPedidos(distribuidor_id, estado)
        for p in pedidos:
            p["detalles"] = self.repo.ListarDetallesPedido(p["id"])
        return pedidos

    def AjustarPedidoKevin(self, pedido_id: int, dto: AjustePedidoKevinRequest, id_kevin: int) -> Dict:
        """Kevin revisa existencias y ajusta cantidades pactadas con el distribuidor."""
        pedido = self.repo.ObtenerPedidoPorId(pedido_id)
        if not pedido:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")

        detalles_actuales = {d["id"]: d for d in self.repo.ListarDetallesPedido(pedido_id)}
        nuevo_total = Decimal("0.00")

        # Aplicar ajustes
        ajustes_dict = {a.detalle_id: Decimal(str(a.cantidad_aprobada)) for a in dto.detalles_ajuste}

        for det_id, det in detalles_actuales.items():
            cant_aprobada = ajustes_dict.get(det_id, Decimal(str(det["cantidad_aprobada"] or det["cantidad_solicitada"])))
            precio_u = Decimal(str(det["precio_unitario"]))
            subtotal = cant_aprobada * precio_u
            nuevo_total += subtotal

            self.repo.AjustarCantidadDetalle(det_id, float(cant_aprobada), float(subtotal))

        obs = dto.observacion_kevin or "Proforma revisada y ajustada por Kevin"
        self.repo.ActualizarEstadoPedido(
            pedido_id=pedido_id,
            nuevo_estado="PROFORMA_AJUSTADA",
            nuevo_monto=float(nuevo_total),
            observacion_kevin=obs
        )

        # Notificar al distribuidor si tiene usuario asignado
        dist = self.repo.ObtenerDistribuidorPorId(pedido["distribuidor_id"])
        if dist and dist.get("id_usuario"):
            self.notif_service.CrearNotificacion(
                id_usuario_destino=dist["id_usuario"],
                titulo="Proforma Ajustada por Kevin",
                mensaje=f"Tu pedido {pedido['codigo_pedido']} fue ajustado a Bs. {float(nuevo_total):.2f}. Ya puedes cargar tu boleta de pago.",
                tipo="INFO"
            )

        self.audit_service.RegistrarAccion(
            id_usuario=id_kevin,
            accion="AJUSTE_PEDIDO_DISTRIBUIDOR",
            tabla="pedidos_distribuidores",
            id_registro=str(pedido_id),
            detalles={"monto_anterior": str(pedido["monto_total"]), "nuevo_monto": str(nuevo_total)}
        )

        self.db.commit()
        return self.ObtenerPedidoDetalle(pedido_id)

    def AdjuntarBoletaPagoDistribuidor(self, pedido_id: int, dto: SubirBoletaPagoRequest, id_usuario: int) -> Dict:
        """El distribuidor sube el comprobante de pago de Banco Unión."""
        pedido = self.repo.ObtenerPedidoPorId(pedido_id)
        if not pedido:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")

        self.repo.ActualizarEstadoPedido(
            pedido_id=pedido_id,
            nuevo_estado="COMPROBANTE_SUBIDO",
            id_comprobante=dto.id_comprobante_archivo
        )

        # Notificar a Kevin que la boleta está lista para validación bancaria
        self.notif_service.CrearNotificacion(
            id_usuario_destino=1,
            titulo="Boleta de Pago Subida",
            mensaje=f"El distribuidor adjuntó la boleta de pago para el pedido {pedido['codigo_pedido']}. Pendiente de confirmación.",
            tipo="ALERTA"
        )

        self.db.commit()
        return self.ObtenerPedidoDetalle(pedido_id)

    def AprobarDespachoKevin(self, pedido_id: int, id_kevin: int, observacion: Optional[str] = None) -> Dict:
        """Kevin valida el ingreso en cuenta bancaria y autoriza el despacho mayorista."""
        pedido = self.repo.ObtenerPedidoPorId(pedido_id)
        if not pedido:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")

        self.repo.ActualizarEstadoPedido(
            pedido_id=pedido_id,
            nuevo_estado="APROBADO_DESPACHO",
            observacion_kevin=observacion or "Depósito verificado en banco. Despacho autorizado."
        )

        dist = self.repo.ObtenerDistribuidorPorId(pedido["distribuidor_id"])
        if dist and dist.get("id_usuario"):
            self.notif_service.CrearNotificacion(
                id_usuario_destino=dist["id_usuario"],
                titulo="Despacho Autorizado",
                mensaje=f"Tu pedido {pedido['codigo_pedido']} fue aprobado para despacho hacia {dist['ciudad']}.",
                tipo="INFO"
            )

        self.audit_service.RegistrarAccion(
            id_usuario=id_kevin,
            accion="APROBACION_DESPACHO_DISTRIBUIDOR",
            tabla="pedidos_distribuidores",
            id_registro=str(pedido_id),
            detalles={"distribuidor": dist.get("nombre_comercial"), "ciudad": dist.get("ciudad")}
        )

        self.db.commit()
        return self.ObtenerPedidoDetalle(pedido_id)
