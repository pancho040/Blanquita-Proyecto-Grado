from sqlalchemy import Integer, func, literal, select
from sqlalchemy.orm import Session

from app.Models.Empaque.Reporte import ClaseEmpaque
from app.Repository.Consultas import filtro_rango
from app.Repository.DbCaller import DbCaller
from app.Schemas.Empaque import (
    Empaque,
    InventarioBolsaJava,
    InventarioEmpaqueBolsa,
    LoteEmpaque,
    MovimientoBolsaJava,
    MovimientoEmpaque,
    MovimientoEmpaqueBolsa,
    TipoBolsaJava,
    TipoEmpaque,
    TipoEmpaqueBolsa,
)
from app.Schemas.MateriaPrima import TipoMovimientoMateriaPrima
from app.Schemas.Proveedor import Proveedor
from app.Schemas.Usuario import Rol, Usuario

ID_ESTADO_EN_ALMACEN = 1

TABLAS_CONTEO = {
    ClaseEmpaque.bolsa: {
        "movimiento": MovimientoEmpaqueBolsa,
        "id_movimiento": MovimientoEmpaqueBolsa.IdMovimientoEmpaqueBolsa,
        "id_tipo_movimiento": MovimientoEmpaqueBolsa.IdTipoEmpaqueBolsa,
        "tipo": TipoEmpaqueBolsa,
        "id_tipo": TipoEmpaqueBolsa.IdTipoEmpaqueBolsa,
        "nombre_tipo": TipoEmpaqueBolsa.NombreEmpaqueBolsa,
        "descripcion_tipo": TipoEmpaqueBolsa.DescripcionEmpaqueBolsa,
        "inventario": InventarioEmpaqueBolsa,
        "id_tipo_inventario": InventarioEmpaqueBolsa.IdTipoEmpaqueBolsa,
    },
    ClaseEmpaque.jaba: {
        "movimiento": MovimientoBolsaJava,
        "id_movimiento": MovimientoBolsaJava.IdMovimientoBolsaJava,
        "id_tipo_movimiento": MovimientoBolsaJava.IdTipoBolsaJava,
        "tipo": TipoBolsaJava,
        "id_tipo": TipoBolsaJava.IdTipoBolsaJava,
        "nombre_tipo": TipoBolsaJava.NombreBolsaJava,
        "descripcion_tipo": TipoBolsaJava.DescripcionBolsaJava,
        "inventario": InventarioBolsaJava,
        "id_tipo_inventario": InventarioBolsaJava.IdTipoBolsaJava,
    },
}


class ReporteEmpaqueRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def ObtenerTipos(self, clase: ClaseEmpaque) -> list[dict]:
        if clase == ClaseEmpaque.bobina:
            id_tipo, nombre_tipo = TipoEmpaque.IdTipoEmpaque, TipoEmpaque.NombreTipoEmpaque
        else:
            tablas = TABLAS_CONTEO[clase]
            id_tipo, nombre_tipo = tablas["id_tipo"], tablas["nombre_tipo"]

        consulta = select(
            id_tipo.label("IdTipo"), nombre_tipo.label("NombreTipo")
        ).order_by(nombre_tipo)
        return self.caller.Consultar(consulta)

    def StockActual(self, clase: ClaseEmpaque, ids_tipo: list[int] | None) -> list[dict]:
        if clase == ClaseEmpaque.bobina:
            en_almacen = func.count(Empaque.IdEmpaque).filter(
                Empaque.IdEstadoMateriaPrima == ID_ESTADO_EN_ALMACEN
            )
            consulta = (
                select(
                    TipoEmpaque.IdTipoEmpaque.label("IdTipo"),
                    TipoEmpaque.NombreTipoEmpaque.label("NombreTipo"),
                    en_almacen.label("CantidadActual"),
                )
                .outerjoin(Empaque, Empaque.IdTipoEmpaque == TipoEmpaque.IdTipoEmpaque)
                .group_by(TipoEmpaque.IdTipoEmpaque, TipoEmpaque.NombreTipoEmpaque)
                .order_by(TipoEmpaque.NombreTipoEmpaque)
            )
            id_tipo = TipoEmpaque.IdTipoEmpaque
        else:
            tablas = TABLAS_CONTEO[clase]
            inventario = tablas["inventario"]
            consulta = (
                select(
                    tablas["id_tipo"].label("IdTipo"),
                    tablas["nombre_tipo"].label("NombreTipo"),
                    func.coalesce(func.sum(inventario.CantidadActual), 0)
                    .cast(Integer)
                    .label("CantidadActual"),
                )
                .outerjoin(inventario, tablas["id_tipo_inventario"] == tablas["id_tipo"])
                .group_by(tablas["id_tipo"], tablas["nombre_tipo"])
                .order_by(tablas["nombre_tipo"])
            )
            id_tipo = tablas["id_tipo"]

        if ids_tipo:
            consulta = consulta.where(id_tipo.in_(ids_tipo))

        return self.caller.Consultar(consulta)

    def Inventario(self, clase: ClaseEmpaque) -> list[dict]:
        if clase == ClaseEmpaque.bobina:
            return self._InventarioBobina()

        tablas = TABLAS_CONTEO[clase]
        movimiento = tablas["movimiento"]

        ultimo_movimiento = (
            select(func.max(movimiento.FechaMovimiento))
            .where(tablas["id_tipo_movimiento"] == tablas["id_tipo"])
            .correlate(tablas["tipo"])
            .scalar_subquery()
            .label("FechaUltimoMovimiento")
        )

        consulta = (
            select(
                tablas["id_tipo"].label("IdTipo"),
                tablas["nombre_tipo"].label("NombreTipo"),
                tablas["descripcion_tipo"].label("DescripcionTipo"),
                func.coalesce(tablas["inventario"].CantidadActual, 0)
                .cast(Integer)
                .label("CantidadActual"),
                ultimo_movimiento,
            )
            .outerjoin(tablas["inventario"], tablas["id_tipo_inventario"] == tablas["id_tipo"])
            .order_by(tablas["nombre_tipo"])
        )

        return self.caller.Consultar(consulta)

    def UnidadesBobinaEnAlmacen(self) -> list[dict]:
        consulta = (
            select(
                Empaque.IdEmpaque,
                Empaque.CodigoEmpaque,
                TipoEmpaque.NombreTipoEmpaque.label("NombreTipo"),
                Empaque.PesoKg,
                LoteEmpaque.IdLoteEmpaque,
                LoteEmpaque.FechaRecepcion,
                Proveedor.NombreProveedor,
            )
            .join(TipoEmpaque, Empaque.IdTipoEmpaque == TipoEmpaque.IdTipoEmpaque)
            .join(LoteEmpaque, Empaque.IdLoteEmpaque == LoteEmpaque.IdLoteEmpaque)
            .join(Proveedor, LoteEmpaque.IdProveedor == Proveedor.IdProveedor)
            .where(Empaque.IdEstadoMateriaPrima == ID_ESTADO_EN_ALMACEN)
            .order_by(TipoEmpaque.NombreTipoEmpaque, Empaque.CodigoEmpaque)
        )

        return self.caller.Consultar(consulta)

    def _InventarioBobina(self) -> list[dict]:
        en_almacen = Empaque.IdEstadoMateriaPrima == ID_ESTADO_EN_ALMACEN

        ultimo_movimiento = (
            select(func.max(MovimientoEmpaque.FechaMovimiento))
            .join(Empaque, MovimientoEmpaque.IdEmpaque == Empaque.IdEmpaque)
            .where(Empaque.IdTipoEmpaque == TipoEmpaque.IdTipoEmpaque)
            .correlate(TipoEmpaque)
            .scalar_subquery()
            .label("FechaUltimoMovimiento")
        )

        consulta = (
            select(
                TipoEmpaque.IdTipoEmpaque.label("IdTipo"),
                TipoEmpaque.NombreTipoEmpaque.label("NombreTipo"),
                func.count(Empaque.IdEmpaque).filter(en_almacen).label("CantidadActual"),
                func.coalesce(func.sum(Empaque.PesoKg).filter(en_almacen), 0).label("PesoKg"),
                ultimo_movimiento,
            )
            .outerjoin(Empaque, Empaque.IdTipoEmpaque == TipoEmpaque.IdTipoEmpaque)
            .group_by(TipoEmpaque.IdTipoEmpaque, TipoEmpaque.NombreTipoEmpaque)
            .order_by(TipoEmpaque.NombreTipoEmpaque)
        )

        return self.caller.Consultar(consulta)

    def Movimientos(self, clase: ClaseEmpaque, params: dict) -> list[dict]:
        if clase == ClaseEmpaque.bobina:
            consulta, fecha, id_movimiento, id_tipo, id_tipo_movimiento = self._MovimientosBobina()
        else:
            consulta, fecha, id_movimiento, id_tipo, id_tipo_movimiento = self._MovimientosConteo(clase)

        consulta = (
            consulta.join(
                TipoMovimientoMateriaPrima,
                id_tipo_movimiento == TipoMovimientoMateriaPrima.IdTipoMovimiento,
            )
            .outerjoin(Proveedor, LoteEmpaque.IdProveedor == Proveedor.IdProveedor)
            .where(*filtro_rango(fecha, params.get("p_FechaInicio"), params.get("p_FechaFin")))
            .order_by(fecha.desc(), id_movimiento.desc())
        )

        if params.get("p_IdsTipo"):
            consulta = consulta.where(id_tipo.in_(params["p_IdsTipo"]))

        if params.get("p_IdTipoMovimiento") is not None:
            consulta = consulta.where(id_tipo_movimiento == params["p_IdTipoMovimiento"])

        if params.get("p_SoloLotes"):
            consulta = consulta.where(LoteEmpaque.IdLoteEmpaque.is_not(None))

        return self.caller.Consultar(consulta)

    def _ColumnasComunes(self):
        return (
            TipoMovimientoMateriaPrima.NombreMovimiento,
            Usuario.Ci,
            Usuario.PrimerNombre,
            Usuario.ApellidoPaterno,
            Rol.NombreRol,
            LoteEmpaque.IdLoteEmpaque,
            LoteEmpaque.FechaRecepcion,
            LoteEmpaque.CantidadToneladasPedida,
            Proveedor.NombreProveedor,
        )

    def _MovimientosBobina(self):
        me = MovimientoEmpaque

        consulta = (
            select(
                me.IdMovimientoEmpaque.label("IdMovimiento"),
                me.FechaMovimiento,
                Empaque.IdTipoEmpaque.label("IdTipo"),
                TipoEmpaque.NombreTipoEmpaque.label("NombreTipo"),
                me.IdTipoMovimiento,
                literal(1).label("Cantidad"),
                Empaque.CodigoEmpaque,
                Empaque.PesoKg,
                me.Observacion,
                *self._ColumnasComunes(),
            )
            .join(Empaque, me.IdEmpaque == Empaque.IdEmpaque)
            .join(TipoEmpaque, Empaque.IdTipoEmpaque == TipoEmpaque.IdTipoEmpaque)
            .join(Usuario, me.IdUsuario == Usuario.IdUsuario)
            .join(Rol, Usuario.IdRol == Rol.IdRol)
            .outerjoin(LoteEmpaque, Empaque.IdLoteEmpaque == LoteEmpaque.IdLoteEmpaque)
        )

        return (
            consulta,
            me.FechaMovimiento,
            me.IdMovimientoEmpaque,
            Empaque.IdTipoEmpaque,
            me.IdTipoMovimiento,
        )

    def _MovimientosConteo(self, clase: ClaseEmpaque):
        tablas = TABLAS_CONTEO[clase]
        movimiento = tablas["movimiento"]

        consulta = (
            select(
                tablas["id_movimiento"].label("IdMovimiento"),
                movimiento.FechaMovimiento,
                tablas["id_tipo_movimiento"].label("IdTipo"),
                tablas["nombre_tipo"].label("NombreTipo"),
                movimiento.IdTipoMovimiento,
                movimiento.CantidadMovimiento.cast(Integer).label("Cantidad"),
                literal(None).label("CodigoEmpaque"),
                literal(None).label("PesoKg"),
                movimiento.Observacion,
                *self._ColumnasComunes(),
            )
            .join(tablas["tipo"], tablas["id_tipo_movimiento"] == tablas["id_tipo"])
            .join(Usuario, movimiento.IdUsuario == Usuario.IdUsuario)
            .join(Rol, Usuario.IdRol == Rol.IdRol)
            .outerjoin(LoteEmpaque, movimiento.IdLoteEmpaque == LoteEmpaque.IdLoteEmpaque)
        )

        return (
            consulta,
            movimiento.FechaMovimiento,
            tablas["id_movimiento"],
            tablas["id_tipo_movimiento"],
            movimiento.IdTipoMovimiento,
        )
