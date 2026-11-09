from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.Repository.DbCaller import DbCaller
from app.Services.Common.NotificationService import NotificationService
from app.Services.Usuario.AuditService import AuditService


class PrecioRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def ListarPreciosVigentes(self, id_sucursal: int = 1) -> list[dict]:
        sql = """
            SELECT 
                p."IdPresentacion",
                prod."NombreProducto",
                p."TipoContenedor",
                p."CantidadRollosUnidades",
                p."CodigoPresentacion",
                pp."IdPrecioProducto",
                pp."PrecioUnitario",
                pp."PrecioMayorista",
                pp."CantidadMinimaMayorista",
                pp."VigenteDesde",
                COALESCE(pp."IdSucursal", :id_sucursal) as "IdSucursal",
                COALESCE(pp."Activo", FALSE) as "Activo"
            FROM "PresentacionProducto" p
            JOIN "Producto" prod ON p."IdProducto" = prod."IdProducto"
            LEFT JOIN "PrecioProducto" pp ON p."IdPresentacion" = pp."IdPresentacion" 
                 AND (pp."IdSucursal" = :id_sucursal OR pp."IdSucursal" IS NULL)
                 AND pp."Activo" = TRUE
            ORDER BY prod."NombreProducto", p."TipoContenedor";
        """
        return self.caller.LlamarFuncion(sql, {"id_sucursal": id_sucursal})

    def GuardarPrecio(self, datos: dict, id_usuario: int | None = None) -> dict:
        id_presentacion = datos["IdPresentacion"]
        id_sucursal = datos.get("IdSucursal") or 1
        precio_nuevo = float(datos["PrecioUnitario"])
        
        # 1. Obtener precio anterior para la sucursal
        sql_ant = """
            SELECT "PrecioUnitario", "PrecioMayorista" 
            FROM "PrecioProducto" 
            WHERE "IdPresentacion" = :id_p 
              AND ("IdSucursal" = :sucursal OR "IdSucursal" IS NULL)
              AND "Activo" = TRUE 
            ORDER BY "IdPrecioProducto" DESC 
            LIMIT 1;
        """
        precio_ant = self.caller.LlamarUnRegistro(sql_ant, {"id_p": id_presentacion, "sucursal": id_sucursal})
        precio_ant_val = float(precio_ant["PrecioUnitario"]) if precio_ant and precio_ant.get("PrecioUnitario") is not None else 0.0

        # 2. Desactivar precio anterior vigente en esa sucursal
        self.caller.LlamarFuncion(
            """
            UPDATE "PrecioProducto" 
            SET "Activo" = FALSE 
            WHERE "IdPresentacion" = :id_presentacion 
              AND ("IdSucursal" = :sucursal OR "IdSucursal" IS NULL);
            """,
            {"id_presentacion": id_presentacion, "sucursal": id_sucursal}
        )

        # 3. Insertar nuevo precio
        sql_ins = """
            INSERT INTO "PrecioProducto" (
                "IdPresentacion", "IdSucursal", "PrecioUnitario", "PrecioMayorista",
                "CantidadMinimaMayorista", "VigenteDesde", "Activo"
            ) VALUES (
                :IdPresentacion, :IdSucursal, :PrecioUnitario, :PrecioMayorista,
                :CantidadMinimaMayorista, :VigenteDesde, TRUE
            ) RETURNING "IdPrecioProducto";
        """
        datos_insert = dict(datos)
        datos_insert["IdSucursal"] = id_sucursal
        res = self.caller.LlamarUnRegistro(sql_ins, datos_insert)

        # 4. Trigger de Revalorización Automática de Choferes
        # Si el precio varió y hay inventario remanente en los camiones de esa sucursal
        if precio_ant_val > 0.0 and abs(precio_nuevo - precio_ant_val) > 0.001:
            diferencia_unitaria = Decimal(str(precio_nuevo)) - Decimal(str(precio_ant_val))
            
            stmt_choferes = text("""
                SELECT id, chofer_id, cantidad_remanente
                FROM public.inventario_chofer
                WHERE sucursal_id = :sucursal 
                  AND presentacion_id = :pid 
                  AND cantidad_remanente > 0;
            """)
            cargas_afectadas = self.db.execute(stmt_choferes, {
                "sucursal": id_sucursal,
                "pid": id_presentacion
            }).fetchall()

            for carga in cargas_afectadas:
                remanente = Decimal(str(carga.cantidad_remanente))
                monto_ajuste = diferencia_unitaria * remanente

                detalle_notif = (
                    f"Ajuste por cambio de precio: presentación #{id_presentacion}. "
                    f"Precio anterior: Bs. {precio_ant_val:.2f} -> Nuevo: Bs. {precio_nuevo:.2f}. "
                    f"Remanente en camión: {remanente}. Monto ajuste: Bs. {monto_ajuste:.2f}."
                )

                # Registrar en RevalorizacionInventarioChofer
                stmt_reval = text("""
                    INSERT INTO public."RevalorizacionInventarioChofer" (
                        "IdChofer", "IdSucursal", "IdPresentacion",
                        "CantidadRemanente", "PrecioAnterior", "PrecioNuevo",
                        "MontoAjuste", "FechaRevalorizacion", "DetalleNotificacion"
                    ) VALUES (
                        :chofer, :sucursal, :pid,
                        :remanente, :ant, :nuevo,
                        :ajuste, NOW(), :detalle
                    );
                """)
                self.db.execute(stmt_reval, {
                    "chofer": carga.chofer_id,
                    "sucursal": id_sucursal,
                    "pid": id_presentacion,
                    "remanente": remanente,
                    "ant": Decimal(str(precio_ant_val)),
                    "nuevo": Decimal(str(precio_nuevo)),
                    "ajuste": monto_ajuste,
                    "detalle": detalle_notif
                })

                # Actualizar precio vigente en el inventario del chofer
                stmt_upd_chofer = text("""
                    UPDATE public.inventario_chofer
                    SET precio_vigente_carga = :nuevo
                    WHERE id = :cid;
                """)
                self.db.execute(stmt_upd_chofer, {"nuevo": Decimal(str(precio_nuevo)), "cid": carga.id})

                # Notificación al chofer (campana)
                NotificationService.crear_notificacion(
                    self.db,
                    titulo="Alerta: Revalorización de Inventario en Camión",
                    mensaje=detalle_notif,
                    tipo="REVALORIZACION_PRECIO",
                    id_usuario_destinatario=carga.chofer_id,
                    codigo_referencia=carga.id
                )

        # 5. Notificación general a gerencia y supervisor (Alerta de cambio de precio 24h)
        NotificationService.crear_notificacion(
            self.db,
            titulo="Cambio de Precio Oficial Registrado",
            mensaje=f"Se actualizó el precio de la presentación #{id_presentacion} en sucursal #{id_sucursal} a Bs. {precio_nuevo:.2f}.",
            tipo="CAMBIO_PRECIO",
            id_usuario_destinatario=None,
            codigo_referencia=res.get("IdPrecioProducto") if res else None
        )

        # 6. Auditoría Forense
        try:
            AuditService.registrar_evento(
                self.db,
                id_usuario=id_usuario or 1,
                usuario_nombre="Sistema",
                rol="Supervisor/Gerente",
                modulo_tabla="PrecioProducto",
                accion="ACTUALIZACION_PRECIO",
                id_registro=str(id_presentacion),
                detalle=f"Precio presentación #{id_presentacion} en sucursal #{id_sucursal}: Bs. {precio_ant_val:.2f} -> Bs. {precio_nuevo:.2f}",
                datos_anteriores={"PrecioUnitario": precio_ant_val},
                datos_nuevos={"PrecioUnitario": precio_nuevo, "IdSucursal": id_sucursal}
            )
        except Exception:
            pass

        self.db.commit()
        return res

    def ListarHistorialPrecios(self, id_presentacion: int, id_sucursal: int = 1) -> list[dict]:
        sql = """
            SELECT 
                pp."IdPrecioProducto",
                pp."IdPresentacion",
                COALESCE(pp."IdSucursal", :id_sucursal) as "IdSucursal",
                pp."PrecioUnitario",
                pp."PrecioMayorista",
                pp."CantidadMinimaMayorista",
                pp."VigenteDesde",
                pp."Activo"
            FROM "PrecioProducto" pp
            WHERE pp."IdPresentacion" = :id_p
              AND (pp."IdSucursal" = :id_sucursal OR pp."IdSucursal" IS NULL)
            ORDER BY pp."VigenteDesde" DESC, pp."IdPrecioProducto" DESC;
        """
        return self.caller.LlamarFuncion(sql, {"id_p": id_presentacion, "id_sucursal": id_sucursal})
