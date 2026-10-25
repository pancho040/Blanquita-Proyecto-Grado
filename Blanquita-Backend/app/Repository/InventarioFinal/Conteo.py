from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, aliased

from app.Constants.Estados import (
    ESTADO_CONTEO_ABIERTO,
    ESTADO_CONTEO_CERRADO,
    MOVIMIENTO_PT_AJUSTE_NEGATIVO,
    MOVIMIENTO_PT_AJUSTE_POSITIVO,
)
from app.Repository.Consultas import filtro_rango, nombre_operador, visible_en_inventario
from app.Repository.DbCaller import DbCaller
from app.Schemas.Producto import (
    ConteoProductoTerminado,
    ConteoProductoTerminadoDetalle,
    InventarioProductoTerminado,
    MovimientoProductoTerminado,
    PresentacionProducto,
    Producto,
    TipoMovimientoInventario,
)
from app.Schemas.Usuario import Usuario


class ConteoProductoTerminadoRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def _ConsultaResumen(self):
        inicio = aliased(Usuario)
        cierre = aliased(Usuario)
        detalle = ConteoProductoTerminadoDetalle
        diferencia = detalle.CantidadFisica - detalle.CantidadSistema
        totales = (
            select(
                detalle.IdConteoProductoTerminado,
                func.count().label("TotalPresentaciones"),
                func.count(detalle.CantidadFisica).label("Contadas"),
                func.count().filter(diferencia != 0).label("ConDiferencia"),
                func.coalesce(func.sum(-diferencia).filter(diferencia < 0), 0).label("Faltante"),
                func.coalesce(func.sum(diferencia).filter(diferencia > 0), 0).label("Sobrante"),
            )
            .group_by(detalle.IdConteoProductoTerminado)
            .subquery()
        )
        return (
            select(
                ConteoProductoTerminado.IdConteoProductoTerminado,
                ConteoProductoTerminado.Estado,
                nombre_operador(inicio).label("UsuarioInicio"),
                ConteoProductoTerminado.FechaHoraInicio,
                ConteoProductoTerminado.MotivoInicio,
                nombre_operador(cierre).label("UsuarioCierre"),
                ConteoProductoTerminado.FechaHoraCierre,
                ConteoProductoTerminado.MotivoAnulacion,
                func.coalesce(totales.c.TotalPresentaciones, 0).label("TotalPresentaciones"),
                func.coalesce(totales.c.Contadas, 0).label("Contadas"),
                func.coalesce(totales.c.ConDiferencia, 0).label("ConDiferencia"),
                func.coalesce(totales.c.Faltante, 0).label("Faltante"),
                func.coalesce(totales.c.Sobrante, 0).label("Sobrante"),
            )
            .join(inicio, inicio.IdUsuario == ConteoProductoTerminado.IdUsuarioInicio)
            .outerjoin(cierre, cierre.IdUsuario == ConteoProductoTerminado.IdUsuarioCierre)
            .outerjoin(
                totales,
                totales.c.IdConteoProductoTerminado == ConteoProductoTerminado.IdConteoProductoTerminado,
            )
        )

    def ObtenerConteoAbierto(self) -> dict | None:
        filas = self.caller.Consultar(
            self._ConsultaResumen().where(ConteoProductoTerminado.Estado == ESTADO_CONTEO_ABIERTO)
        )
        return filas[0] if filas else None

    def ObtenerConteo(self, id_conteo: int) -> dict | None:
        filas = self.caller.Consultar(
            self._ConsultaResumen().where(
                ConteoProductoTerminado.IdConteoProductoTerminado == id_conteo
            )
        )
        return filas[0] if filas else None

    def ListarConteos(
        self, fecha_inicio: date | None, fecha_fin: date | None, estados: list[str] | None = None
    ) -> list[dict]:
        consulta = (
            self._ConsultaResumen()
            .where(*filtro_rango(ConteoProductoTerminado.FechaHoraInicio, fecha_inicio, fecha_fin))
            .order_by(ConteoProductoTerminado.FechaHoraInicio.desc())
        )
        if estados:
            consulta = consulta.where(ConteoProductoTerminado.Estado.in_(estados))
        return self.caller.Consultar(consulta)

    def DiferenciasPorPresentacion(self, fecha_inicio: date, fecha_fin: date) -> list[dict]:
        detalle = ConteoProductoTerminadoDetalle
        diferencia = detalle.CantidadFisica - detalle.CantidadSistema
        return self.caller.Consultar(
            select(
                PresentacionProducto.IdPresentacion,
                PresentacionProducto.CodigoPresentacion,
                Producto.IdProducto,
                Producto.NombreProducto,
                PresentacionProducto.CantidadRollosUnidades,
                func.count().label("VecesConDiferencia"),
                func.coalesce(func.sum(-diferencia).filter(diferencia < 0), 0).label("Faltante"),
                func.coalesce(func.sum(diferencia).filter(diferencia > 0), 0).label("Sobrante"),
            )
            .join(
                ConteoProductoTerminado,
                ConteoProductoTerminado.IdConteoProductoTerminado == detalle.IdConteoProductoTerminado,
            )
            .join(PresentacionProducto, PresentacionProducto.IdPresentacion == detalle.IdPresentacion)
            .join(Producto, Producto.IdProducto == PresentacionProducto.IdProducto)
            .where(
                ConteoProductoTerminado.Estado == ESTADO_CONTEO_CERRADO,
                diferencia != 0,
                *filtro_rango(ConteoProductoTerminado.FechaHoraInicio, fecha_inicio, fecha_fin),
            )
            .group_by(
                PresentacionProducto.IdPresentacion,
                PresentacionProducto.CodigoPresentacion,
                Producto.IdProducto,
                Producto.NombreProducto,
                PresentacionProducto.CantidadRollosUnidades,
            )
            .order_by(func.count().desc(), PresentacionProducto.CodigoPresentacion)
        )

    def ObtenerDetalle(self, id_conteo: int) -> list[dict]:
        detalle = ConteoProductoTerminadoDetalle
        return self.caller.Consultar(
            select(
                PresentacionProducto.IdPresentacion,
                PresentacionProducto.CodigoPresentacion,
                Producto.IdProducto,
                Producto.NombreProducto,
                PresentacionProducto.CantidadRollosUnidades,
                PresentacionProducto.TipoContenedor,
                PresentacionProducto.CantidadPorUnidadTerminada,
                and_(Producto.Activo, PresentacionProducto.Activo).label("Activo"),
                detalle.CantidadSistema,
                detalle.CantidadFisica,
                detalle.MotivoDiferencia,
                nombre_operador(Usuario).label("UsuarioConteo"),
                detalle.FechaHoraConteo,
                detalle.IdMovimientoProductoTerminado,
            )
            .join(PresentacionProducto, PresentacionProducto.IdPresentacion == detalle.IdPresentacion)
            .join(Producto, Producto.IdProducto == PresentacionProducto.IdProducto)
            .outerjoin(Usuario, Usuario.IdUsuario == detalle.IdUsuarioConteo)
            .where(detalle.IdConteoProductoTerminado == id_conteo)
            .order_by(Producto.IdProducto, PresentacionProducto.CodigoPresentacion)
        )

    def PresentacionesParaConteo(self) -> list[dict]:
        cantidad = func.coalesce(InventarioProductoTerminado.CantidadActual, 0)
        activo = and_(Producto.Activo, PresentacionProducto.Activo)
        return self.caller.Consultar(
            select(
                PresentacionProducto.IdPresentacion,
                PresentacionProducto.CodigoPresentacion,
                Producto.IdProducto,
                Producto.NombreProducto,
                PresentacionProducto.CantidadRollosUnidades,
                PresentacionProducto.TipoContenedor,
                PresentacionProducto.CantidadPorUnidadTerminada,
                activo.label("Activo"),
                cantidad.label("CantidadActual"),
            )
            .join(Producto, Producto.IdProducto == PresentacionProducto.IdProducto)
            .outerjoin(
                InventarioProductoTerminado,
                InventarioProductoTerminado.IdPresentacion == PresentacionProducto.IdPresentacion,
            )
            .where(visible_en_inventario(activo, cantidad))
            .order_by(Producto.IdProducto, PresentacionProducto.CodigoPresentacion)
        )

    def IniciarConteo(self, id_usuario: int, motivo: str) -> int:
        try:
            self.db.execute(select(InventarioProductoTerminado).with_for_update()).all()
            presentaciones = self.PresentacionesParaConteo()
            if not presentaciones:
                self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="No hay presentaciones de producto terminado para contar",
                )

            conteo = ConteoProductoTerminado(IdUsuarioInicio=id_usuario, MotivoInicio=motivo)
            self.db.add(conteo)
            self.db.flush()
            self.db.add_all(
                ConteoProductoTerminadoDetalle(
                    IdConteoProductoTerminado=conteo.IdConteoProductoTerminado,
                    IdPresentacion=fila["IdPresentacion"],
                    CantidadSistema=fila["CantidadActual"],
                )
                for fila in presentaciones
            )
            self.db.commit()
            return conteo.IdConteoProductoTerminado
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya hay un conteo físico de producto terminado en curso",
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo iniciar el conteo físico de producto terminado",
            )

    def BloquearConteo(self, id_conteo: int) -> ConteoProductoTerminado | None:
        try:
            return self.db.execute(
                select(ConteoProductoTerminado)
                .where(ConteoProductoTerminado.IdConteoProductoTerminado == id_conteo)
                .with_for_update()
            ).scalar_one_or_none()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener el conteo físico de producto terminado",
            )

    def DetallesBloqueados(self, id_conteo: int) -> dict[int, ConteoProductoTerminadoDetalle]:
        try:
            filas = self.db.execute(
                select(ConteoProductoTerminadoDetalle)
                .where(ConteoProductoTerminadoDetalle.IdConteoProductoTerminado == id_conteo)
                .order_by(ConteoProductoTerminadoDetalle.IdPresentacion)
                .with_for_update()
            ).scalars().all()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener el detalle del conteo físico",
            )
        return {detalle.IdPresentacion: detalle for detalle in filas}

    def InventariosBloqueados(self, ids_presentacion: list[int]) -> dict[int, InventarioProductoTerminado]:
        try:
            filas = self.db.execute(
                select(InventarioProductoTerminado)
                .where(InventarioProductoTerminado.IdPresentacion.in_(ids_presentacion))
                .order_by(InventarioProductoTerminado.IdPresentacion)
                .with_for_update()
            ).scalars().all()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener el inventario de producto terminado",
            )
        return {inventario.IdPresentacion: inventario for inventario in filas}

    def Agregar(self, entidad) -> None:
        self.db.add(entidad)

    def Enlazar(self) -> None:
        try:
            self.db.flush()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el conteo físico de producto terminado",
            )

    def Guardar(self, mensaje_error: str) -> None:
        try:
            self.db.commit()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=mensaje_error,
            )

    def Revertir(self) -> None:
        self.db.rollback()

    def FechaCierreAnterior(self, id_conteo: int, fecha_inicio: datetime) -> datetime | None:
        filas = self.caller.Consultar(
            select(func.max(ConteoProductoTerminado.FechaHoraCierre).label("FechaHoraCierre")).where(
                ConteoProductoTerminado.Estado == ESTADO_CONTEO_CERRADO,
                ConteoProductoTerminado.IdConteoProductoTerminado != id_conteo,
                ConteoProductoTerminado.FechaHoraCierre <= fecha_inicio,
            )
        )
        return filas[0]["FechaHoraCierre"] if filas else None

    def AjustesManuales(self, desde: datetime | None, hasta: datetime) -> list[dict]:
        mpt = MovimientoProductoTerminado
        generados = select(ConteoProductoTerminadoDetalle.IdMovimientoProductoTerminado).where(
            ConteoProductoTerminadoDetalle.IdMovimientoProductoTerminado.is_not(None)
        )
        consulta = (
            select(
                mpt.IdMovimientoProductoTerminado,
                mpt.FechaMovimiento,
                PresentacionProducto.CodigoPresentacion,
                Producto.NombreProducto,
                PresentacionProducto.CantidadRollosUnidades,
                TipoMovimientoInventario.NombreTipoMovimientoInventario,
                mpt.CantidadIngresoInventario.label("Cantidad"),
                nombre_operador(Usuario).label("Usuario"),
                mpt.Observacion,
            )
            .join(PresentacionProducto, PresentacionProducto.IdPresentacion == mpt.IdPresentacion)
            .join(Producto, Producto.IdProducto == PresentacionProducto.IdProducto)
            .join(
                TipoMovimientoInventario,
                TipoMovimientoInventario.IdTipoMovimientoInventario == mpt.IdTipoMovimientoInventario,
            )
            .join(Usuario, Usuario.IdUsuario == mpt.IdUsuario)
            .where(
                mpt.IdTipoMovimientoInventario.in_(
                    (MOVIMIENTO_PT_AJUSTE_POSITIVO, MOVIMIENTO_PT_AJUSTE_NEGATIVO)
                ),
                mpt.FechaMovimiento < hasta,
                mpt.IdMovimientoProductoTerminado.not_in(generados),
            )
            .order_by(mpt.FechaMovimiento, mpt.IdMovimientoProductoTerminado)
        )
        if desde is not None:
            consulta = consulta.where(mpt.FechaMovimiento > desde)
        return self.caller.Consultar(consulta)
