from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.Constants.Estados import ESTADO_PRODUCCION_EN_PRODUCCION, ESTADO_PRODUCCION_PAUSA
from app.Repository.DbCaller import DbCaller
from app.Schemas.HistorialAdmin import HistorialAdmin
from app.Schemas.Produccion import ProduccionBobinaTubo
from app.Schemas.Producto import Producto


class TipoMateriaPrimaRepository:
    def __init__(self, db: Session, modelo, columna_id, columna_nombre):
        self.db = db
        self.caller = DbCaller(db)
        self.modelo = modelo
        self.columna_id = columna_id
        self.columna_nombre = columna_nombre

    def NombreEnUso(self, nombre: str) -> bool:
        consulta = select(self.columna_id).where(
            func.lower(func.btrim(self.columna_nombre)) == nombre.lower()
        )
        return bool(self.caller.Consultar(consulta.limit(1)))

    def ObtenerTipoBloqueado(self, id_tipo: int):
        try:
            return self.db.execute(
                select(self.modelo).where(self.columna_id == id_tipo).with_for_update()
            ).scalar_one_or_none()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener el tipo de materia prima",
            )

    def ProductosDeTipos(self, columna_tipo, ids_tipo: list[int]) -> dict[int, list[dict]]:
        if not ids_tipo:
            return {}

        filas = self.caller.Consultar(
            select(
                columna_tipo.label("IdTipo"),
                Producto.IdProducto,
                Producto.NombreProducto,
                Producto.Activo,
            )
            .where(columna_tipo.in_(ids_tipo))
            .order_by(Producto.NombreProducto)
        )

        productos: dict[int, list[dict]] = {}
        for fila in filas:
            id_tipo = fila.pop("IdTipo")
            productos.setdefault(id_tipo, []).append(fila)
        return productos

    def ProductosDisponibles(self, columna_tipo, columna_otro_tipo) -> list[dict]:
        consulta = (
            select(
                Producto.IdProducto,
                Producto.NombreProducto,
                Producto.Activo,
                columna_tipo.label("IdTipoActual"),
                self.columna_nombre.label("NombreTipoActual"),
            )
            .select_from(Producto)
            .outerjoin(self.modelo, self.columna_id == columna_tipo)
            .where(columna_otro_tipo.is_(None))
            .order_by(Producto.NombreProducto)
        )
        return self.caller.Consultar(consulta)

    def ObtenerProductosBloqueados(self, ids_producto: list[int]) -> dict[int, Producto]:
        if not ids_producto:
            return {}

        try:
            productos = self.db.execute(
                select(Producto)
                .where(Producto.IdProducto.in_(ids_producto))
                .order_by(Producto.IdProducto)
                .with_for_update()
            ).scalars().all()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener los productos",
            )
        return {producto.IdProducto: producto for producto in productos}

    def ProductosEnProduccion(self, ids_producto: list[int]) -> list[str]:
        if not ids_producto:
            return []

        filas = self.caller.Consultar(
            select(Producto.NombreProducto)
            .join(ProduccionBobinaTubo, ProduccionBobinaTubo.IdProducto == Producto.IdProducto)
            .where(
                Producto.IdProducto.in_(ids_producto),
                ProduccionBobinaTubo.IdEstadoProduccion.in_(
                    [ESTADO_PRODUCCION_EN_PRODUCCION, ESTADO_PRODUCCION_PAUSA]
                ),
            )
            .distinct()
            .order_by(Producto.NombreProducto)
        )
        return [fila["NombreProducto"] for fila in filas]

    def CrearTipo(self, tipo, despues_de_crear, observacion, id_admin: int, mensaje_error: str):
        try:
            self.db.add(tipo)
            self.db.flush()
            for registro in despues_de_crear(tipo):
                self.db.add(registro)
            self.db.add(HistorialAdmin(IdUsuario=id_admin, Observacion=observacion(tipo)))
            self.db.commit()
            self.db.refresh(tipo)
            return tipo
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{mensaje_error}: el nombre ya está registrado o los datos no son válidos",
            )
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=mensaje_error,
            )

    def Guardar(
        self,
        observacion: str,
        id_admin: int,
        mensaje_error: str,
        nuevos: list | None = None,
        eliminados: list | None = None,
    ) -> None:
        try:
            for registro in eliminados or []:
                self.db.delete(registro)
            for registro in nuevos or []:
                self.db.add(registro)
            self.db.add(HistorialAdmin(IdUsuario=id_admin, Observacion=observacion))
            self.db.commit()
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=mensaje_error,
            )

    def Revertir(self) -> None:
        self.db.rollback()
