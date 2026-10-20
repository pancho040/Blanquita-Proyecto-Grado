from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.Repository.Consultas import nivel_stock
from app.Repository.DbCaller import DbCaller
from app.Schemas.HistorialAdmin import HistorialAdmin
from app.Schemas.Insumo import InventarioInsumo, MovimientoInsumo, TipoInsumo


class InsumoRepository:
    def __init__(self, db: Session):
        self.db = db
        self.caller = DbCaller(db)

    def VerCatalogoInsumo(self) -> list[dict]:
        consulta = (
            select(
                InventarioInsumo.IdInventarioInsumo,
                InventarioInsumo.IdTipoInsumo,
                InventarioInsumo.CantidadActual,
                TipoInsumo.NombreInsumo,
                TipoInsumo.DescripcionInsumo,
                TipoInsumo.Activo,
                InventarioInsumo.StockMinimo,
                InventarioInsumo.StockPreventivo,
                nivel_stock(InventarioInsumo.CantidadActual, InventarioInsumo.StockMinimo, InventarioInsumo.StockPreventivo).label("NivelStock"),
            )
            .join(TipoInsumo, InventarioInsumo.IdTipoInsumo == TipoInsumo.IdTipoInsumo)
            .order_by(TipoInsumo.NombreInsumo)
        )
        return self.caller.Consultar(consulta)

    def ObtenerInventarioBloqueado(self, id_tipo_insumo: int) -> tuple[InventarioInsumo, TipoInsumo] | None:
        try:
            fila = self.db.execute(
                select(InventarioInsumo, TipoInsumo)
                .join(TipoInsumo, InventarioInsumo.IdTipoInsumo == TipoInsumo.IdTipoInsumo)
                .where(InventarioInsumo.IdTipoInsumo == id_tipo_insumo)
                .order_by(InventarioInsumo.IdInventarioInsumo)
                .limit(1)
                .with_for_update(of=InventarioInsumo)
            ).first()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener el inventario del insumo",
            )
        return (fila[0], fila[1]) if fila else None

    def RegistrarMovimiento(
        self, inventario: InventarioInsumo, movimiento: MovimientoInsumo, cantidad_nueva: int
    ) -> MovimientoInsumo:
        try:
            inventario.CantidadActual = cantidad_nueva
            self.db.add(movimiento)
            self.db.commit()
            self.db.refresh(movimiento)
            self.db.refresh(inventario)
            return movimiento
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo registrar el movimiento del insumo",
            )

    def _ConsultaInsumos(self):
        cantidad = func.coalesce(InventarioInsumo.CantidadActual, 0)
        return select(
            TipoInsumo.IdTipoInsumo,
            TipoInsumo.NombreInsumo,
            TipoInsumo.DescripcionInsumo,
            cantidad.label("CantidadActual"),
            InventarioInsumo.StockMinimo,
            InventarioInsumo.StockPreventivo,
            nivel_stock(
                cantidad, InventarioInsumo.StockMinimo, InventarioInsumo.StockPreventivo
            ).label("NivelStock"),
        ).outerjoin(InventarioInsumo, InventarioInsumo.IdTipoInsumo == TipoInsumo.IdTipoInsumo)

    def ListarInsumos(self, params: dict) -> tuple[int, list[dict]]:
        consulta = self._ConsultaInsumos()

        busqueda = (params.get("Busqueda") or "").strip()
        if busqueda:
            consulta = consulta.where(
                or_(
                    TipoInsumo.NombreInsumo.ilike(f"%{busqueda}%"),
                    TipoInsumo.DescripcionInsumo.ilike(f"%{busqueda}%"),
                )
            )

        total = self.caller.Consultar(
            select(func.count().label("Total")).select_from(consulta.subquery())
        )[0]["Total"]

        pagina = consulta.order_by(
            TipoInsumo.NombreInsumo, TipoInsumo.IdTipoInsumo
        ).limit(params["TamanoPagina"]).offset((params["Pagina"] - 1) * params["TamanoPagina"])

        return total, self.caller.Consultar(pagina)

    def NombreEnUso(self, nombre: str) -> bool:
        consulta = select(TipoInsumo.IdTipoInsumo).where(
            func.lower(func.btrim(TipoInsumo.NombreInsumo)) == nombre.lower()
        )
        return bool(self.caller.Consultar(consulta.limit(1)))

    def ObtenerTipoInsumoBloqueado(self, id_tipo_insumo: int) -> TipoInsumo | None:
        try:
            return self.db.execute(
                select(TipoInsumo)
                .where(TipoInsumo.IdTipoInsumo == id_tipo_insumo)
                .with_for_update()
            ).scalar_one_or_none()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener el insumo",
            )

    def ObtenerInsumo(self, id_tipo_insumo: int) -> dict | None:
        filas = self.caller.Consultar(
            self._ConsultaInsumos().where(TipoInsumo.IdTipoInsumo == id_tipo_insumo)
        )
        return filas[0] if filas else None

    def ObtenerInventarioDeTipoBloqueado(self, id_tipo_insumo: int) -> InventarioInsumo | None:
        try:
            return self.db.execute(
                select(InventarioInsumo)
                .where(InventarioInsumo.IdTipoInsumo == id_tipo_insumo)
                .order_by(InventarioInsumo.IdInventarioInsumo)
                .limit(1)
                .with_for_update()
            ).scalars().first()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener el inventario del insumo",
            )

    def CrearInsumo(
        self,
        tipo: TipoInsumo,
        stock_minimo: int | None,
        stock_preventivo: int | None,
        observacion,
        id_admin: int,
    ) -> TipoInsumo:
        nombre = tipo.NombreInsumo
        try:
            self.db.add(tipo)
            self.db.flush()
            self.db.add(
                InventarioInsumo(
                    IdTipoInsumo=tipo.IdTipoInsumo,
                    CantidadActual=0,
                    StockMinimo=stock_minimo,
                    StockPreventivo=stock_preventivo,
                )
            )
            self.db.add(HistorialAdmin(IdUsuario=id_admin, Observacion=observacion(tipo)))
            self.db.commit()
            self.db.refresh(tipo)
            return tipo
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un insumo llamado {nombre}",
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo crear el insumo",
            )

    def EditarInsumo(
        self,
        tipo: TipoInsumo,
        inventario: InventarioInsumo,
        descripcion: str,
        stock_minimo: int | None,
        stock_preventivo: int | None,
        observacion: str,
        id_admin: int,
    ) -> TipoInsumo:
        try:
            tipo.DescripcionInsumo = descripcion
            inventario.StockMinimo = stock_minimo
            inventario.StockPreventivo = stock_preventivo
            self.db.add(HistorialAdmin(IdUsuario=id_admin, Observacion=observacion))
            self.db.commit()
            self.db.refresh(tipo)
            return tipo
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo editar el insumo",
            )

    def Revertir(self) -> None:
        self.db.rollback()
