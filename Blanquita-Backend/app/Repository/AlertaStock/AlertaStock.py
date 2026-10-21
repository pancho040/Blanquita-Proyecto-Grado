from fastapi import HTTPException, status
from sqlalchemy import Text, and_, case, cast, func, literal, select, union_all
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.Constants.AlertaStock import (
    DOMINIO_STOCK_BOBINA_PAPEL,
    DOMINIO_STOCK_BOBINA_SERVILLETA,
    DOMINIO_STOCK_BOLSA_JAVA,
    DOMINIO_STOCK_EMPAQUE_BOBINA,
    DOMINIO_STOCK_EMPAQUE_BOLSA,
    DOMINIO_STOCK_INSUMO,
    DOMINIO_STOCK_PRODUCTO,
    DOMINIO_STOCK_RODELA,
    DOMINIO_STOCK_SUB_BOBINA,
    DOMINIOS_STOCK,
    NIVEL_STOCK_CRITICO,
    NIVELES_STOCK_ALERTA,
)
from app.Constants.Estados import ESTADO_MATERIA_PRIMA_EN_ALMACEN
from app.Repository.Consultas import nivel_stock, visible_en_inventario
from app.Repository.DbCaller import DbCaller
from app.Schemas.BobinaPapel import BobinaPapel, TipoBobina
from app.Schemas.BobinaServilleta import (
    BobinaServilleta,
    SubBobinaServilleta,
    TipoBobinaServilleta,
    TipoMedidaSubBobina,
)
from app.Schemas.Empaque import (
    Empaque,
    InventarioBolsaJava,
    InventarioEmpaqueBolsa,
    TipoBolsaJava,
    TipoEmpaque,
    TipoEmpaqueBolsa,
)
from app.Schemas.HistorialAdmin import HistorialAdmin
from app.Schemas.Insumo import InventarioInsumo, TipoInsumo
from app.Schemas.Producto import InventarioProductoTerminado, PresentacionProducto, Producto
from app.Schemas.Rodela import Rodela, TipoRodela

REGISTROS_UMBRAL = {
    DOMINIO_STOCK_PRODUCTO: (InventarioProductoTerminado, InventarioProductoTerminado.IdPresentacion),
    DOMINIO_STOCK_INSUMO: (InventarioInsumo, InventarioInsumo.IdTipoInsumo),
    DOMINIO_STOCK_EMPAQUE_BOLSA: (InventarioEmpaqueBolsa, InventarioEmpaqueBolsa.IdTipoEmpaqueBolsa),
    DOMINIO_STOCK_BOLSA_JAVA: (InventarioBolsaJava, InventarioBolsaJava.IdTipoBolsaJava),
    DOMINIO_STOCK_EMPAQUE_BOBINA: (TipoEmpaque, TipoEmpaque.IdTipoEmpaque),
    DOMINIO_STOCK_BOBINA_PAPEL: (TipoBobina, TipoBobina.IdTipoBobina),
    DOMINIO_STOCK_BOBINA_SERVILLETA: (TipoBobinaServilleta, TipoBobinaServilleta.IdTipoBobinaServilleta),
    DOMINIO_STOCK_SUB_BOBINA: (TipoMedidaSubBobina, TipoMedidaSubBobina.IdTipoMedidaSubBobina),
    DOMINIO_STOCK_RODELA: (TipoRodela, TipoRodela.IdTipoRodela),
}


def _columnas(dominio, id_item, nombre, cantidad, umbral, activo):
    return (
        literal(dominio).label("Dominio"),
        id_item.label("Id"),
        nombre.label("Nombre"),
        cantidad.label("CantidadActual"),
        umbral.StockMinimo.label("StockMinimo"),
        umbral.StockPreventivo.label("StockPreventivo"),
        activo.label("Activo"),
    )


def _producto():
    return (
        select(
            *_columnas(
                DOMINIO_STOCK_PRODUCTO,
                PresentacionProducto.IdPresentacion,
                Producto.NombreProducto + " · " + PresentacionProducto.CodigoPresentacion,
                InventarioProductoTerminado.CantidadActual,
                InventarioProductoTerminado,
                and_(Producto.Activo, PresentacionProducto.Activo),
            )
        )
        .select_from(InventarioProductoTerminado)
        .join(
            PresentacionProducto,
            PresentacionProducto.IdPresentacion == InventarioProductoTerminado.IdPresentacion,
        )
        .join(Producto, Producto.IdProducto == PresentacionProducto.IdProducto)
    )


def _insumo():
    return (
        select(
            *_columnas(
                DOMINIO_STOCK_INSUMO,
                TipoInsumo.IdTipoInsumo,
                TipoInsumo.NombreInsumo,
                InventarioInsumo.CantidadActual,
                InventarioInsumo,
                TipoInsumo.Activo,
            )
        )
        .select_from(InventarioInsumo)
        .join(TipoInsumo, TipoInsumo.IdTipoInsumo == InventarioInsumo.IdTipoInsumo)
    )


def _empaque_bolsa():
    return (
        select(
            *_columnas(
                DOMINIO_STOCK_EMPAQUE_BOLSA,
                TipoEmpaqueBolsa.IdTipoEmpaqueBolsa,
                TipoEmpaqueBolsa.NombreEmpaqueBolsa,
                InventarioEmpaqueBolsa.CantidadActual,
                InventarioEmpaqueBolsa,
                TipoEmpaqueBolsa.Activo,
            )
        )
        .select_from(InventarioEmpaqueBolsa)
        .join(
            TipoEmpaqueBolsa,
            TipoEmpaqueBolsa.IdTipoEmpaqueBolsa == InventarioEmpaqueBolsa.IdTipoEmpaqueBolsa,
        )
    )


def _bolsa_java():
    return (
        select(
            *_columnas(
                DOMINIO_STOCK_BOLSA_JAVA,
                TipoBolsaJava.IdTipoBolsaJava,
                TipoBolsaJava.NombreBolsaJava,
                InventarioBolsaJava.CantidadActual,
                InventarioBolsaJava,
                TipoBolsaJava.Activo,
            )
        )
        .select_from(InventarioBolsaJava)
        .join(TipoBolsaJava, TipoBolsaJava.IdTipoBolsaJava == InventarioBolsaJava.IdTipoBolsaJava)
    )


def _empaque_bobina():
    return (
        select(
            *_columnas(
                DOMINIO_STOCK_EMPAQUE_BOBINA,
                TipoEmpaque.IdTipoEmpaque,
                TipoEmpaque.NombreTipoEmpaque,
                func.count(Empaque.IdEmpaque),
                TipoEmpaque,
                TipoEmpaque.Activo,
            )
        )
        .select_from(TipoEmpaque)
        .outerjoin(
            Empaque,
            and_(
                Empaque.IdTipoEmpaque == TipoEmpaque.IdTipoEmpaque,
                Empaque.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN,
            ),
        )
        .group_by(TipoEmpaque.IdTipoEmpaque)
    )


def _bobina_papel():
    return (
        select(
            *_columnas(
                DOMINIO_STOCK_BOBINA_PAPEL,
                TipoBobina.IdTipoBobina,
                TipoBobina.NombreTipoBobina,
                func.count(BobinaPapel.IdBobinaPapel),
                TipoBobina,
                TipoBobina.Activo,
            )
        )
        .select_from(TipoBobina)
        .outerjoin(
            BobinaPapel,
            and_(
                BobinaPapel.IdTipoBobina == TipoBobina.IdTipoBobina,
                BobinaPapel.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN,
            ),
        )
        .group_by(TipoBobina.IdTipoBobina)
    )


def _bobina_servilleta():
    return (
        select(
            *_columnas(
                DOMINIO_STOCK_BOBINA_SERVILLETA,
                TipoBobinaServilleta.IdTipoBobinaServilleta,
                TipoBobinaServilleta.NombreTipoBobinaServilleta,
                func.count(BobinaServilleta.IdBobinaServilleta),
                TipoBobinaServilleta,
                TipoBobinaServilleta.Activo,
            )
        )
        .select_from(TipoBobinaServilleta)
        .outerjoin(
            BobinaServilleta,
            and_(
                BobinaServilleta.IdTipoBobinaServilleta == TipoBobinaServilleta.IdTipoBobinaServilleta,
                BobinaServilleta.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN,
            ),
        )
        .group_by(TipoBobinaServilleta.IdTipoBobinaServilleta)
    )


def _sub_bobina():
    return (
        select(
            *_columnas(
                DOMINIO_STOCK_SUB_BOBINA,
                TipoMedidaSubBobina.IdTipoMedidaSubBobina,
                func.coalesce(
                    TipoMedidaSubBobina.Descripcion,
                    "Sub-bobina " + cast(TipoMedidaSubBobina.MedidaMm, Text) + "mm",
                ),
                func.count(SubBobinaServilleta.IdSubBobinaServilleta),
                TipoMedidaSubBobina,
                TipoMedidaSubBobina.Activo,
            )
        )
        .select_from(TipoMedidaSubBobina)
        .outerjoin(
            SubBobinaServilleta,
            and_(
                SubBobinaServilleta.IdTipoMedidaSubBobina == TipoMedidaSubBobina.IdTipoMedidaSubBobina,
                SubBobinaServilleta.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN,
            ),
        )
        .group_by(TipoMedidaSubBobina.IdTipoMedidaSubBobina)
    )


def _rodela():
    return (
        select(
            *_columnas(
                DOMINIO_STOCK_RODELA,
                TipoRodela.IdTipoRodela,
                TipoRodela.NombreTipoRodela,
                func.count(Rodela.IdRodela),
                TipoRodela,
                TipoRodela.Activo,
            )
        )
        .select_from(TipoRodela)
        .outerjoin(
            Rodela,
            and_(
                Rodela.IdTipoRodela == TipoRodela.IdTipoRodela,
                Rodela.IdEstadoMateriaPrima == ESTADO_MATERIA_PRIMA_EN_ALMACEN,
            ),
        )
        .group_by(TipoRodela.IdTipoRodela)
    )


CONSULTAS_STOCK = {
    DOMINIO_STOCK_PRODUCTO: _producto,
    DOMINIO_STOCK_INSUMO: _insumo,
    DOMINIO_STOCK_EMPAQUE_BOLSA: _empaque_bolsa,
    DOMINIO_STOCK_BOLSA_JAVA: _bolsa_java,
    DOMINIO_STOCK_EMPAQUE_BOBINA: _empaque_bobina,
    DOMINIO_STOCK_BOBINA_PAPEL: _bobina_papel,
    DOMINIO_STOCK_BOBINA_SERVILLETA: _bobina_servilleta,
    DOMINIO_STOCK_SUB_BOBINA: _sub_bobina,
    DOMINIO_STOCK_RODELA: _rodela,
}


class AlertaStockRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def ListarStock(
        self,
        dominio: str | None = None,
        id_item: int | None = None,
        solo_alertas: bool = False,
        solo_visibles: bool = False,
    ) -> list[dict]:
        dominios = [dominio] if dominio else list(DOMINIOS_STOCK)
        consultas = [CONSULTAS_STOCK[d]() for d in dominios]
        stock = (union_all(*consultas) if len(consultas) > 1 else consultas[0]).subquery()

        nivel = nivel_stock(stock.c.CantidadActual, stock.c.StockMinimo, stock.c.StockPreventivo)
        consulta = select(
            stock.c.Dominio,
            stock.c.Id,
            stock.c.Nombre,
            stock.c.CantidadActual,
            stock.c.StockMinimo,
            stock.c.StockPreventivo,
            stock.c.Activo,
            nivel.label("NivelStock"),
        )

        if id_item is not None:
            consulta = consulta.where(stock.c.Id == id_item)

        if solo_visibles:
            consulta = consulta.where(visible_en_inventario(stock.c.Activo, stock.c.CantidadActual))

        orden_dominio = case(
            {d: posicion for posicion, d in enumerate(DOMINIOS_STOCK)}, value=stock.c.Dominio
        )
        if solo_alertas:
            consulta = consulta.where(stock.c.Activo, nivel.in_(NIVELES_STOCK_ALERTA)).order_by(
                case((nivel == NIVEL_STOCK_CRITICO, 0), else_=1),
                orden_dominio,
                stock.c.Nombre,
            )
        else:
            consulta = consulta.order_by(orden_dominio, stock.c.Nombre)

        return self.caller.Consultar(consulta)

    def ObtenerRegistroBloqueado(self, dominio: str, id_item: int):
        modelo, columna = REGISTROS_UMBRAL[dominio]
        try:
            return (
                self.db.execute(
                    select(modelo).where(columna == id_item).limit(1).with_for_update()
                )
                .scalars()
                .first()
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener el umbral de stock",
            )

    def GuardarUmbral(
        self,
        registro,
        stock_minimo: int | None,
        stock_preventivo: int | None,
        observacion: str,
        id_admin: int,
    ) -> None:
        try:
            registro.StockMinimo = stock_minimo
            registro.StockPreventivo = stock_preventivo
            self.db.add(HistorialAdmin(IdUsuario=id_admin, Observacion=observacion))
            self.db.commit()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo guardar el umbral de stock",
            )

    def Revertir(self) -> None:
        self.db.rollback()
