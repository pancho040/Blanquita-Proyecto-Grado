import os
import logging
from decimal import Decimal
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.Repository.Logistica.EnvioRepository import EnvioRepository
from app.adapters.planta_fabricio_adapter import FabricioLegacyAdapter
from app.Models.Logistica.EnvioInventarioModel import EnvioCrearDTO, EnvioRecepcionarDTO
from app.Services.Common.NotificationService import NotificationService

logger = logging.getLogger(__name__)


class EnviosService:
    """
    Servicio Orquestador de Envíos de Inventario (Unit of Work).
    Gobierna la transacción atómica completa entre fábrica/planta, tránsito,
    recepción en sucursal y registro de mermas.
    Es el ÚNICO componente responsable de ejecutar session.commit() o session.rollback().
    """

    def __init__(self, db: Session):
        self.db = db
        self.repo = EnvioRepository(db)
        self.planta_adapter = FabricioLegacyAdapter()

    def listar_envios(self, estado: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.repo.listar_envios(estado)

    def obtener_envio(self, envio_id: int) -> Dict[str, Any]:
        envio = self.repo.obtener_envio(envio_id)
        if not envio:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Envío #{envio_id} no encontrado.")
        return envio

    def crear_envio(self, dto: EnvioCrearDTO, usuario_id: int) -> Dict[str, Any]:
        """Crea el documento de remisión en estado PENDIENTE."""
        try:
            # Validar que no exista la guía
            existe = self.db.execute(
                text("SELECT id FROM public.envios_inventario WHERE numero_guia = :guia"),
                {"guia": dto.numero_guia}
            ).fetchone()
            if existe:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe un envío con el número de guía '{dto.numero_guia}'."
                )

            stmt_envio = text("""
                INSERT INTO public.envios_inventario (
                    numero_guia, origen_tipo, origen_id, destino_tipo, destino_id,
                    estado, descuento_planta_aplicado, chofer_nombre, camion_placa,
                    usuario_despacho_id, observaciones, created_at
                ) VALUES (
                    :guia, :ot, :oid, :dt, :did,
                    'PENDIENTE', false, :chofer, :placa,
                    :uid, :obs, NOW()
                ) RETURNING id;
            """)
            envio_id = self.db.execute(stmt_envio, {
                "guia": dto.numero_guia,
                "ot": dto.origen_tipo.upper(),
                "oid": dto.origen_id,
                "dt": dto.destino_tipo.upper(),
                "did": dto.destino_id,
                "chofer": dto.chofer_nombre,
                "placa": dto.camion_placa,
                "uid": usuario_id,
                "obs": dto.observaciones
            }).fetchone()[0]

            stmt_detalle = text("""
                INSERT INTO public.detalles_envio_inventario (
                    envio_id, presentacion_id, cantidad_enviada, cantidad_recibida
                ) VALUES (
                    :envio_id, :pid, :cant, 0
                );
            """)
            for item in dto.detalles:
                if item.cantidad_enviada <= 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"La cantidad enviada debe ser mayor a 0 (presentación {item.presentacion_id})."
                    )
                self.db.execute(stmt_detalle, {
                    "envio_id": envio_id,
                    "pid": item.presentacion_id,
                    "cant": item.cantidad_enviada
                })

            self.db.commit()
            return self.obtener_envio(envio_id)
        except Exception as e:
            self.db.rollback()
            if isinstance(e, HTTPException):
                raise e
            logger.error(f"Error al crear envío: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def despachar_envio(self, envio_id: int, usuario_id: int) -> Dict[str, Any]:
        """
        Orquesta el despacho del camión pasando de PENDIENTE a EN_TRANSITO.
        Si el origen es PLANTA, descuenta atómicamente de InventarioProductoTerminado
        mediante el adaptador oficial de Fabricio.
        """
        envio = self.obtener_envio(envio_id)
        if envio["estado"] != "PENDIENTE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Solo se pueden despachar envíos en estado PENDIENTE (estado actual: {envio['estado']})."
            )

        detalles = envio["detalles"]
        if not detalles:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El envío no contiene ítems.")

        try:
            descuento_aplicado = False

            # Si el origen es PLANTA, procesar descuento de producto terminado
            if envio["origen_tipo"] == "PLANTA":
                planta_id = envio["origen_id"]
                for d in detalles:
                    pid = d["presentacion_id"]
                    cant = Decimal(str(d["cantidad_enviada"]))
                    # Invocar adaptador (NUNCA hace commit)
                    descontado = self.planta_adapter.descontar_stock_despacho(
                        session=self.db,
                        planta_id=planta_id,
                        presentacion_id=pid,
                        cantidad=cant,
                        usuario_id=usuario_id,
                        referencia_guia=envio["numero_guia"]
                    )
                    if descontado:
                        descuento_aplicado = True

            elif envio["origen_tipo"] == "SUCURSAL":
                # Descontar del inventario de la sucursal de origen
                sucursal_id = envio["origen_id"]
                for d in detalles:
                    pid = d["presentacion_id"]
                    cant = Decimal(str(d["cantidad_enviada"]))
                    stmt_suc = text("""
                        UPDATE public.inventario_sucursal
                        SET cantidad_disponible = cantidad_disponible - :cant,
                            updated_at = NOW()
                        WHERE sucursal_id = :sid AND presentacion_id = :pid AND cantidad_disponible >= :cant
                        RETURNING id;
                    """)
                    res = self.db.execute(stmt_suc, {"sid": sucursal_id, "pid": pid, "cant": cant}).fetchone()
                    if not res:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Stock insuficiente en la sucursal origen #{sucursal_id} para la presentación #{pid}."
                        )

            # Actualizar estado a EN_TRANSITO
            stmt_upd = text("""
                UPDATE public.envios_inventario
                SET estado = 'EN_TRANSITO',
                    descuento_planta_aplicado = :desc_aplicado,
                    usuario_despacho_id = :uid,
                    fecha_despacho = NOW()
                WHERE id = :id;
            """)
            self.db.execute(stmt_upd, {
                "id": envio_id,
                "desc_aplicado": descuento_aplicado,
                "uid": usuario_id
            })

            # Emitir alerta para la sucursal receptora
            NotificationService.crear_notificacion(
                self.db,
                titulo="Envío en Tránsito Despachado",
                mensaje=f"La guía {envio['numero_guia']} ha salido rumbo a su destino ({envio['destino_nombre']}).",
                tipo="ENVIO_DESPACHADO",
                codigo_referencia=envio_id
            )

            # UNIDAD DE TRABAJO: Commit único de toda la operación combinada
            self.db.commit()
            return self.obtener_envio(envio_id)

        except Exception as e:
            self.db.rollback()
            if isinstance(e, HTTPException):
                raise e
            logger.error(f"Error durante el despacho del envío #{envio_id}: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    def recepcionar_envio(self, envio_id: int, dto: EnvioRecepcionarDTO, usuario_id: int) -> Dict[str, Any]:
        """
        Recepciona el envío en destino (pasando de EN_TRANSITO a RECEPCIONADO).
        Si el destino es SUCURSAL, incrementa inventario_sucursal con cantidad_recibida.
        Si cantidad_recibida < cantidad_enviada, registra la diferencia en mermas_envio.
        """
        envio = self.obtener_envio(envio_id)
        if envio["estado"] != "EN_TRANSITO":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Solo se pueden recepcionar envíos en estado EN_TRANSITO (estado actual: {envio['estado']})."
            )

        detalles_dict = {d["presentacion_id"]: Decimal(str(d["cantidad_enviada"])) for d in envio["detalles"]}

        try:
            destino_tipo = envio["destino_tipo"]
            destino_id = envio["destino_id"]

            for item in dto.items:
                pid = item.presentacion_id
                if pid not in detalles_dict:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"La presentación #{pid} no forma parte de este envío."
                    )
                
                cant_enviada = detalles_dict[pid]
                cant_recibida = item.cantidad_recibida

                if cant_recibida < 0 or cant_recibida > cant_enviada:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cantidad recibida ({cant_recibida}) inválida para presentación #{pid} (enviada: {cant_enviada})."
                    )

                # Actualizar cantidad_recibida en el detalle
                self.db.execute(text("""
                    UPDATE public.detalles_envio_inventario
                    SET cantidad_recibida = :rec
                    WHERE envio_id = :eid AND presentacion_id = :pid;
                """), {"eid": envio_id, "pid": pid, "rec": cant_recibida})

                # Si el destino es SUCURSAL, sumar al stock de la sucursal
                if destino_tipo == "SUCURSAL":
                    stmt_upsert_stock = text("""
                        INSERT INTO public.inventario_sucursal (
                            sucursal_id, presentacion_id, cantidad_disponible, cantidad_reservada, updated_at
                        ) VALUES (
                            :sid, :pid, :cant, 0, NOW()
                        )
                        ON CONFLICT (sucursal_id, presentacion_id) DO UPDATE SET
                            cantidad_disponible = public.inventario_sucursal.cantidad_disponible + EXCLUDED.cantidad_disponible,
                            updated_at = NOW();
                    """)
                    self.db.execute(stmt_upsert_stock, {
                        "sid": destino_id,
                        "pid": pid,
                        "cant": cant_recibida
                    })

                # Si hubo faltante/merma, registrar en mermas_envio
                diferencia_merma = cant_enviada - cant_recibida
                if diferencia_merma > 0:
                    motivo = item.motivo_merma or "Faltante o merma física no justificada en recepción"
                    self.db.execute(text("""
                        INSERT INTO public.mermas_envio (
                            envio_id, presentacion_id, cantidad_merma, motivo, fecha_registro
                        ) VALUES (
                            :eid, :pid, :cant_merma, :motivo, NOW()
                        );
                    """), {
                        "eid": envio_id,
                        "pid": pid,
                        "cant_merma": diferencia_merma,
                        "motivo": motivo
                    })

            # Actualizar estado del envío a RECEPCIONADO
            stmt_fin = text("""
                UPDATE public.envios_inventario
                SET estado = 'RECEPCIONADO',
                    usuario_recepcion_id = :uid,
                    fecha_recepcion = NOW(),
                    observaciones = CASE 
                        WHEN :obs IS NOT NULL AND :obs != '' THEN COALESCE(observaciones || ' | ', '') || :obs
                        ELSE observaciones 
                    END
                WHERE id = :id;
            """)
            self.db.execute(stmt_fin, {
                "id": envio_id,
                "uid": usuario_id,
                "obs": dto.observaciones
            })

            # Notificación a Don Osvaldo / Kevin
            NotificationService.crear_notificacion(
                self.db,
                titulo="Envío Recepcionado Exitosamente",
                mensaje=f"La guía {envio['numero_guia']} fue recepcionada en {envio['destino_nombre']}.",
                tipo="ENVIO_RECEPCIONADO",
                codigo_referencia=envio_id
            )

            # UNIDAD DE TRABAJO: Commit único
            self.db.commit()
            return self.obtener_envio(envio_id)

        except Exception as e:
            self.db.rollback()
            if isinstance(e, HTTPException):
                raise e
            logger.error(f"Error en recepción de envío #{envio_id}: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    def anular_envio(self, envio_id: int, usuario_id: int, motivo: str) -> Dict[str, Any]:
        """
        Anula un envío. Si estaba en EN_TRANSITO y se había descontado stock de planta,
        ejecuta el reintegro inverso hacia InventarioProductoTerminado de Fabricio.
        """
        envio = self.obtener_envio(envio_id)
        if envio["estado"] in ("RECEPCIONADO", "ANULADO"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede anular un envío en estado {envio['estado']}."
            )

        try:
            # Reintegrar stock si ya había sido despachado
            if envio["estado"] == "EN_TRANSITO":
                if envio["origen_tipo"] == "PLANTA" and envio["descuento_planta_aplicado"]:
                    planta_id = envio["origen_id"]
                    for d in envio["detalles"]:
                        pid = d["presentacion_id"]
                        cant = Decimal(str(d["cantidad_enviada"]))
                        self.planta_adapter.reintegrar_stock_anulacion(
                            session=self.db,
                            planta_id=planta_id,
                            presentacion_id=pid,
                            cantidad=cant,
                            usuario_id=usuario_id,
                            referencia_guia=envio["numero_guia"]
                        )
                elif envio["origen_tipo"] == "SUCURSAL":
                    sucursal_id = envio["origen_id"]
                    for d in envio["detalles"]:
                        pid = d["presentacion_id"]
                        cant = Decimal(str(d["cantidad_enviada"]))
                        self.db.execute(text("""
                            UPDATE public.inventario_sucursal
                            SET cantidad_disponible = cantidad_disponible + :cant,
                                updated_at = NOW()
                            WHERE sucursal_id = :sid AND presentacion_id = :pid;
                        """), {"sid": sucursal_id, "pid": pid, "cant": cant})

            # Cambiar estado a ANULADO
            obs_anulacion = f"ANULADO por usuario #{usuario_id}. Motivo: {motivo}"
            self.db.execute(text("""
                UPDATE public.envios_inventario
                SET estado = 'ANULADO',
                    observaciones = CASE 
                        WHEN observaciones IS NOT NULL THEN observaciones || ' | ' || :obs
                        ELSE :obs 
                    END
                WHERE id = :id;
            """), {"id": envio_id, "obs": obs_anulacion})

            self.db.commit()
            return self.obtener_envio(envio_id)

        except Exception as e:
            self.db.rollback()
            if isinstance(e, HTTPException):
                raise e
            logger.error(f"Error al anular envío #{envio_id}: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
