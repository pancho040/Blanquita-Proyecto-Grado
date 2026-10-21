from fastapi import HTTPException, status
from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.Constants.Estados import ESTADO_PRODUCCION_EN_PRODUCCION, ESTADO_PRODUCCION_PAUSA
from app.Repository.MateriaPrima.TipoMateriaPrima import TipoMateriaPrimaRepository
from app.Schemas.BobinaPapel import TipoBobina
from app.Schemas.BobinaServilleta import TipoBobinaServilleta
from app.Schemas.HistorialAdmin import HistorialAdmin
from app.Schemas.Produccion import ProduccionBobinaTubo
from app.Schemas.Producto import InventarioProductoTerminado, PresentacionProducto, Producto


class LineaProductoRepository(TipoMateriaPrimaRepository):
    def __init__(self, db: Session):
        super().__init__(db, Producto, Producto.IdProducto, Producto.NombreProducto)

    def ListarLineas(self, id_producto: int | None = None) -> list[dict]:
        en_produccion = exists().where(
            ProduccionBobinaTubo.IdProducto == Producto.IdProducto,
            ProduccionBobinaTubo.IdEstadoProduccion.in_(
                [ESTADO_PRODUCCION_EN_PRODUCCION, ESTADO_PRODUCCION_PAUSA]
            ),
        )
        consulta = (
            select(
                Producto.IdProducto,
                Producto.NombreProducto,
                Producto.SiglasProducto,
                Producto.Activo,
                Producto.IdTipoBobina,
                TipoBobina.NombreTipoBobina,
                Producto.IdTipoBobinaServilleta,
                TipoBobinaServilleta.NombreTipoBobinaServilleta,
                en_produccion.label("EnProduccion"),
            )
            .outerjoin(TipoBobina, TipoBobina.IdTipoBobina == Producto.IdTipoBobina)
            .outerjoin(
                TipoBobinaServilleta,
                TipoBobinaServilleta.IdTipoBobinaServilleta == Producto.IdTipoBobinaServilleta,
            )
            .order_by(Producto.IdProducto)
        )
        if id_producto is not None:
            consulta = consulta.where(Producto.IdProducto == id_producto)
        return self.caller.Consultar(consulta)

    def ListarPresentaciones(self, ids_producto: list[int]) -> dict[int, list[dict]]:
        if not ids_producto:
            return {}

        filas = self.caller.Consultar(
            select(
                PresentacionProducto.IdPresentacion,
                PresentacionProducto.IdProducto,
                PresentacionProducto.TipoContenedor,
                PresentacionProducto.CantidadRollosUnidades,
                PresentacionProducto.CantidadPorUnidadTerminada,
                PresentacionProducto.CodigoPresentacion,
                PresentacionProducto.Activo,
            )
            .where(PresentacionProducto.IdProducto.in_(ids_producto))
            .order_by(
                PresentacionProducto.IdProducto,
                PresentacionProducto.TipoContenedor,
                PresentacionProducto.CantidadRollosUnidades,
                PresentacionProducto.IdPresentacion,
            )
        )

        presentaciones: dict[int, list[dict]] = {}
        for fila in filas:
            presentaciones.setdefault(fila["IdProducto"], []).append(fila)
        return presentaciones

    def SiglasEnUso(self, siglas: str) -> bool:
        consulta = select(Producto.IdProducto).where(func.upper(Producto.SiglasProducto) == siglas)
        return bool(self.caller.Consultar(consulta.limit(1)))

    def CodigosEnUso(self, codigos: list[str]) -> list[str]:
        if not codigos:
            return []

        filas = self.caller.Consultar(
            select(PresentacionProducto.CodigoPresentacion)
            .where(func.upper(PresentacionProducto.CodigoPresentacion).in_(codigos))
            .order_by(PresentacionProducto.CodigoPresentacion)
        )
        return [fila["CodigoPresentacion"] for fila in filas]

    def TiposOrigen(self, modelo, columna_id, columna_nombre) -> list[dict]:
        return self.caller.Consultar(
            select(columna_id.label("Id"), columna_nombre.label("Nombre"))
            .where(modelo.Activo)
            .order_by(columna_nombre)
        )

    def ObtenerTipoOrigenBloqueado(self, modelo, columna_id, id_tipo: int):
        try:
            return self.db.execute(
                select(modelo).where(columna_id == id_tipo).with_for_update()
            ).scalar_one_or_none()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener el tipo de materia prima",
            )

    def UnicoProductoActivoDeTipo(self, producto: Producto) -> str | None:
        if producto.IdTipoBobina is None or not producto.Activo:
            return None

        otros_activos = exists().where(
            Producto.IdTipoBobina == TipoBobina.IdTipoBobina,
            Producto.IdProducto != producto.IdProducto,
            Producto.Activo,
        )
        filas = self.caller.Consultar(
            select(TipoBobina.NombreTipoBobina).where(
                TipoBobina.IdTipoBobina == producto.IdTipoBobina,
                TipoBobina.Activo,
                ~otros_activos,
            )
        )
        return filas[0]["NombreTipoBobina"] if filas else None

    def CrearLinea(
        self,
        producto: Producto,
        presentaciones: list[dict],
        observacion,
        id_admin: int,
    ) -> Producto:
        try:
            self.db.add(producto)
            self.db.flush()
            self._AgregarPresentaciones(producto.IdProducto, presentaciones)
            self.db.add(HistorialAdmin(IdUsuario=id_admin, Observacion=observacion(producto)))
            self.db.commit()
            self.db.refresh(producto)
            return producto
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No se pudo crear la línea de producto: el nombre, las siglas o un código ya están registrados",
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo crear la línea de producto",
            )

    def CrearPresentacion(
        self,
        id_producto: int,
        presentacion: dict,
        observacion,
        id_admin: int,
    ) -> PresentacionProducto:
        try:
            creada = self._AgregarPresentaciones(id_producto, [presentacion])[0]
            self.db.add(HistorialAdmin(IdUsuario=id_admin, Observacion=observacion(creada)))
            self.db.commit()
            self.db.refresh(creada)
            return creada
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"No se pudo crear la presentación: el código {presentacion['CodigoPresentacion']} ya está registrado",
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo crear la presentación",
            )

    def _AgregarPresentaciones(self, id_producto: int, presentaciones: list[dict]) -> list[PresentacionProducto]:
        creadas = [
            PresentacionProducto(
                IdProducto=id_producto,
                TipoContenedor=p["TipoContenedor"],
                CantidadRollosUnidades=p["CantidadRollosUnidades"],
                CantidadPorUnidadTerminada=p["CantidadPorUnidadTerminada"],
                CodigoPresentacion=p["CodigoPresentacion"],
                Activo=True,
            )
            for p in presentaciones
        ]
        self.db.add_all(creadas)
        self.db.flush()

        for creada, p in zip(creadas, presentaciones):
            self.db.add(
                InventarioProductoTerminado(
                    IdPresentacion=creada.IdPresentacion,
                    CantidadActual=0,
                    StockMinimo=p["StockMinimo"],
                    StockPreventivo=p["StockPreventivo"],
                )
            )
        return creadas


class PresentacionProductoRepository(TipoMateriaPrimaRepository):
    def __init__(self, db: Session):
        super().__init__(
            db,
            PresentacionProducto,
            PresentacionProducto.IdPresentacion,
            PresentacionProducto.CodigoPresentacion,
        )
