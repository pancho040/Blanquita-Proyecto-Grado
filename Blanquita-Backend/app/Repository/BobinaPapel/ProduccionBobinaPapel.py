from sqlalchemy import or_, select
from sqlalchemy.orm import Session, aliased
from app.Repository.DbCaller import DbCaller
from app.Schemas.BobinaPapel import BobinaPapel, TipoBobina
from app.Schemas.Produccion import (
    EstadoProduccion,
    PausaProduccionBobinaTubo,
    ProduccionBobinaTubo,
    Turno,
)
from app.Schemas.Producto import Producto
from app.Constants.Estados import (
    ESTADO_PRODUCCION_EN_PRODUCCION as ID_ESTADO_EN_PRODUCCION,
    ESTADO_PRODUCCION_PAUSA as ID_ESTADO_PAUSA,
)


class ProduccionBobinaPapelRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    def IniciarProduccionBobinaTubo(self, params: dict) -> dict | None:
        sql = """
            SELECT * FROM "IniciarProduccionBobinaTubo"(
                :p_IdBobina1,
                :p_IdBobina2,
                :p_IdUsuario,
                :p_IdProducto
            )
        """
        return self.caller.LlamarUnRegistro(sql, params)

    def CambiarLineaProduccionBobinaTubo(self, params: dict) -> dict | None:
        sql = """
            SELECT * FROM "CambiarLineaProduccionBobinaTubo"(
                :p_IdProduccionBobinaTubo,
                :p_IdProducto,
                :p_IdUsuario
            )
        """
        return self.caller.LlamarUnRegistro(sql, params)

    def ObtenerTipoBobinaProduccion(self, id_produccion: int) -> int | None:
        consulta = (
            select(BobinaPapel.IdTipoBobina)
            .join(
                ProduccionBobinaTubo,
                ProduccionBobinaTubo.IdBobina_1 == BobinaPapel.IdBobinaPapel,
            )
            .where(ProduccionBobinaTubo.IdProduccionBobinaTubo == id_produccion)
        )
        filas = self.caller.Consultar(consulta)
        return filas[0]["IdTipoBobina"] if filas else None

    def PausaProduccionBobinaTubo(self, params: dict) -> dict | None:
        sql = """
            SELECT * FROM "FnPausarProduccionBobinaTubo"(
                :p_IdProduccionBobinaTubo,
                :p_IdUsuario,
                :p_MotivoPausaProduccion
            )
        """
        return self.caller.LlamarUnRegistro(sql, params)

    def ReanudarProduccionBobinaTubo(self, params: dict) -> dict | None:
        sql = """
            SELECT * FROM "ReanudarProduccionBobinaTubo"(
                :p_IdProduccionBobinaTubo,
                :p_IdUsuario
            )
        """
        return self.caller.LlamarUnRegistro(sql, params)

    def FinalizarProduccionBobinaTubo(self, params: dict) -> dict | None:
        sql = """
            SELECT * FROM "FinalizarProduccionBobinaTubo"(
                :p_IdProduccionBobinaTubo,
                :p_IdUsuario
            )
        """
        return self.caller.LlamarUnRegistro(sql, params)

    def CancelarProduccionBobinaTubo(self, params: dict) -> dict | None:
        sql = """
            SELECT * FROM "CancelarProduccionBobinaTubo"(
                :p_id_produccion,
                :p_id_usuario,
                :p_motivo_cancelacion
            )
        """
        return self.caller.LlamarUnRegistro(sql, params)

    def InsertarMovimientoOperadorLogs(self, params: dict) -> dict | None:
        sql = """
            SELECT * FROM "InsertarMovimientoOperadorLogs"(
                :p_IdProduccionBobinaTubo,
                :p_IdTipoMovimientoOperadorLogs,
                :p_IdUsuario,
                :p_CantidadLogs,
                :p_Observacion
            )
        """
        return self.caller.LlamarUnRegistro(sql, params)

    def VerProduccionBobinaTubo(self, params: dict) -> list[dict]:
        pb = ProduccionBobinaTubo
        b1 = aliased(BobinaPapel)
        b2 = aliased(BobinaPapel)

        consulta = (
            select(
                pb.IdProduccionBobinaTubo,
                TipoBobina.IdTipoBobina,
                TipoBobina.NombreTipoBobina,
                Producto.IdProducto,
                Producto.NombreProducto,
                EstadoProduccion.NombreEstadoProduccion,
                b1.CodigoBobina.label("CodigoBobina1"),
                b2.CodigoBobina.label("CodigoBobina2"),
                Turno.NombreTurno,
                pb.FechaInicioProduccion,
                pb.CantidadLogsActual,
            )
            .join(EstadoProduccion, EstadoProduccion.IdEstadoProduccion == pb.IdEstadoProduccion)
            .join(b1, b1.IdBobinaPapel == pb.IdBobina_1)
            .join(b2, b2.IdBobinaPapel == pb.IdBobina_2)
            .join(TipoBobina, TipoBobina.IdTipoBobina == b1.IdTipoBobina)
            .join(Producto, Producto.IdProducto == pb.IdProducto)
            .join(Turno, Turno.IdTurno == pb.IdTurno)
            .where(pb.IdEstadoProduccion == ID_ESTADO_EN_PRODUCCION)
            .order_by(TipoBobina.NombreTipoBobina, pb.FechaInicioProduccion)
        )

        id_tipo = params.get("p_IdTipoBobina")
        if id_tipo is not None:
            consulta = consulta.where(
                or_(b1.IdTipoBobina == id_tipo, b2.IdTipoBobina == id_tipo)
            )

        id_producto = params.get("p_IdProducto")
        if id_producto is not None:
            consulta = consulta.where(pb.IdProducto == id_producto)

        return self.caller.Consultar(consulta)

    def VerPausasProduccionBobinaTuboActivas(self, params: dict) -> list[dict]:
        pausa = PausaProduccionBobinaTubo
        pb = ProduccionBobinaTubo
        b1 = aliased(BobinaPapel)
        b2 = aliased(BobinaPapel)

        consulta = (
            select(
                pausa.IdPausaProduccionBobinaTubo,
                pausa.IdProduccionBobinaTubo,
                Producto.IdProducto,
                Producto.NombreProducto,
                b1.CodigoBobina.label("CodigoBobina1"),
                b2.CodigoBobina.label("CodigoBobina2"),
                pausa.FechaHoraPausa,
                EstadoProduccion.NombreEstadoProduccion,
                pb.CantidadLogsActual,
            )
            .join(pb, pb.IdProduccionBobinaTubo == pausa.IdProduccionBobinaTubo)
            .join(EstadoProduccion, EstadoProduccion.IdEstadoProduccion == pb.IdEstadoProduccion)
            .join(b1, b1.IdBobinaPapel == pb.IdBobina_1)
            .join(b2, b2.IdBobinaPapel == pb.IdBobina_2)
            .join(Producto, Producto.IdProducto == pb.IdProducto)
            .where(
                pb.IdEstadoProduccion == ID_ESTADO_PAUSA,
                pausa.FechaHoraReanudacion.is_(None),
            )
            .order_by(pausa.FechaHoraPausa)
        )

        id_tipo = params.get("p_FiltroIdTipoBobina")
        if id_tipo is not None:
            consulta = consulta.where(
                or_(b1.IdTipoBobina == id_tipo, b2.IdTipoBobina == id_tipo)
            )

        id_producto = params.get("p_FiltroIdProducto")
        if id_producto is not None:
            consulta = consulta.where(pb.IdProducto == id_producto)

        return self.caller.Consultar(consulta)