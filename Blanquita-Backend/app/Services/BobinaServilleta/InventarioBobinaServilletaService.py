from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Cantidades import LONGITUD_MAXIMA_DESCRIPCION, LONGITUD_MINIMA_DESCRIPCION
from app.Constants.Estados import (
    ESTADO_MATERIA_PRIMA_EN_ALMACEN,
    ESTADO_MATERIA_PRIMA_FUERA_INVENTARIO,
    MOVIMIENTO_MATERIA_PRIMA_CORRECCION,
    MOVIMIENTO_MATERIA_PRIMA_REINGRESO,
)
from app.Models.BobinaServilleta.InventarioBobinaServilleta import (
    DetalleInventarioBobinaServilletaRequest,
    DetalleInventarioBobinaServilletaResponse,
    DetalleInventarioSubBobinaServilletaRequest,
    DetalleInventarioSubBobinaServilletaResponse,
    EditarBobinaServilletaRequest,
    EditarBobinaServilletaResponse,
    ReingresarSubBobinaInventarioRequest,
    ReingresarSubBobinaInventarioResponse,
    ResumenInventarioBobinaServilletaResponse,
    ResumenInventarioSubBobinaServilletaResponse,
    SubBobinaServilletaFueraInventarioResponse,
)
from app.Repository.BobinaServilleta.InventarioBobinaServilleta import (
    InventarioBobinaServilletaRepository,
)
from app.Schemas.BobinaServilleta import MovimientoBobinaServilleta, MovimientoSubBobina
from app.utils.validators import REGLA_CARACTERES_OBSERVACION, ValidarTexto

CAMPOS_CORRECCION_UNIDAD = {
    "CodigoBobina": "Código",
    "PesoBrutoKg": "Peso bruto",
    "GramajeGr": "Gramaje",
}


def _mostrar(valor) -> str:
    if valor is None:
        return "sin dato"
    if isinstance(valor, (Decimal, float)):
        return format(Decimal(str(valor)).normalize(), "f")
    return str(valor)


def _igual(actual, nuevo) -> bool:
    if actual is None or nuevo is None:
        return actual is None and nuevo is None
    if isinstance(actual, Decimal):
        return actual == Decimal(str(nuevo))
    return actual == nuevo


class InventarioBobinaServilletaService:
    def __init__(self, db: Session):
        self.repository = InventarioBobinaServilletaRepository(db)

    def ReingresarSubBobinaAInventario(
        self, data: ReingresarSubBobinaInventarioRequest, id_usuario: int
    ) -> ReingresarSubBobinaInventarioResponse:
        observacion = self._ValidarObservacion(data.Observacion, "La observación es obligatoria")

        sub_bobina = self.repository.ObtenerSubBobinaBloqueada(data.IdSubBobina)
        if sub_bobina is None:
            self._Revertir(
                status.HTTP_404_NOT_FOUND,
                f"No existe la sub-bobina con id {data.IdSubBobina}",
            )

        if sub_bobina.IdEstadoMateriaPrima != ESTADO_MATERIA_PRIMA_FUERA_INVENTARIO:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                f"La sub-bobina {data.IdSubBobina} no está Fuera de Inventario, no puede reingresarse",
            )

        sub_bobina.IdEstadoMateriaPrima = ESTADO_MATERIA_PRIMA_EN_ALMACEN
        movimiento = MovimientoSubBobina(
            IdSubBobinaServilleta=sub_bobina.IdSubBobinaServilleta,
            IdTipoMovimiento=MOVIMIENTO_MATERIA_PRIMA_REINGRESO,
            IdUsuario=id_usuario,
            Observacion=observacion,
        )
        self.repository.Guardar(
            sub_bobina,
            movimiento,
            mensaje_error="No se pudo reingresar la sub-bobina a inventario",
        )

        return ReingresarSubBobinaInventarioResponse(
            IdSubBobina=sub_bobina.IdSubBobinaServilleta,
            IdEstadoMateriaPrima=ESTADO_MATERIA_PRIMA_EN_ALMACEN,
            FechaMovimiento=movimiento.FechaMovimiento,
        )

    def VerResumenInventarioBobinaServilleta(self) -> list[ResumenInventarioBobinaServilletaResponse]:
        return [
            ResumenInventarioBobinaServilletaResponse(**fila)
            for fila in self.repository.VerResumenInventarioBobinaServilleta()
        ]

    def VerDetalleInventarioBobinaServilleta(
        self, data: DetalleInventarioBobinaServilletaRequest
    ) -> list[DetalleInventarioBobinaServilletaResponse]:
        return [
            DetalleInventarioBobinaServilletaResponse(**fila)
            for fila in self.repository.VerDetalleInventarioBobinaServilleta(
                data.IdTipoBobinaServilleta
            )
        ]

    def VerResumenInventarioSubBobinaServilleta(
        self,
    ) -> list[ResumenInventarioSubBobinaServilletaResponse]:
        return [
            ResumenInventarioSubBobinaServilletaResponse(**fila)
            for fila in self.repository.VerResumenInventarioSubBobinaServilleta()
        ]

    def VerDetalleInventarioSubBobinaServilleta(
        self, data: DetalleInventarioSubBobinaServilletaRequest
    ) -> list[DetalleInventarioSubBobinaServilletaResponse]:
        return [
            DetalleInventarioSubBobinaServilletaResponse(**fila)
            for fila in self.repository.VerDetalleInventarioSubBobinaServilleta(
                data.IdTipoMedidaSubBobina
            )
        ]

    def VerSubBobinasServilletaFueraInventario(
        self,
    ) -> list[SubBobinaServilletaFueraInventarioResponse]:
        return [
            SubBobinaServilletaFueraInventarioResponse(**fila)
            for fila in self.repository.VerSubBobinasServilletaFueraInventario()
        ]

    def EditarBobinaServilleta(
        self, data: EditarBobinaServilletaRequest, id_usuario: int
    ) -> list[EditarBobinaServilletaResponse]:
        observacion = self._ValidarObservacion(
            data.Observacion, "El motivo de la corrección es obligatorio"
        )

        nuevos = []
        for unidad in data.Unidades:
            codigo = unidad.CodigoBobina.strip()
            if not codigo:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="El código de cada unidad es obligatorio",
                )
            nuevos.append(
                {
                    "IdUnidadBobinaServilleta": unidad.IdUnidadBobinaServilleta,
                    "CodigoBobina": codigo,
                    "PesoBrutoKg": unidad.PesoBrutoKg,
                    "GramajeGr": unidad.GramajeGr,
                }
            )

        if nuevos[0]["IdUnidadBobinaServilleta"] == nuevos[1]["IdUnidadBobinaServilleta"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Las dos unidades deben ser distintas",
            )

        if nuevos[0]["CodigoBobina"].lower() == nuevos[1]["CodigoBobina"].lower():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Las dos unidades no pueden tener el mismo código",
            )

        bobina = self.repository.ObtenerBobinaBloqueada(data.IdBobinaServilleta)
        if bobina is None:
            self._Revertir(
                status.HTTP_404_NOT_FOUND,
                f"No existe la bobina servilleta con id {data.IdBobinaServilleta}",
            )

        unidades = self.repository.ObtenerUnidadesBloqueadas(bobina.IdBobinaServilleta)
        if any(nuevo["IdUnidadBobinaServilleta"] not in unidades for nuevo in nuevos):
            self._Revertir(
                status.HTTP_409_CONFLICT,
                "Las unidades indicadas no pertenecen a la bobina servilleta",
            )

        en_uso = self.repository.CodigosEnUso(
            [nuevo["CodigoBobina"] for nuevo in nuevos], list(unidades)
        )
        if en_uso:
            self._Revertir(
                status.HTTP_409_CONFLICT,
                f"Ya existen unidades registradas con los códigos {', '.join(sorted(en_uso))}",
            )

        detalles = []
        for nuevo in nuevos:
            unidad = unidades[nuevo["IdUnidadBobinaServilleta"]]
            cambios = {
                campo: nuevo[campo]
                for campo in CAMPOS_CORRECCION_UNIDAD
                if not _igual(getattr(unidad, campo), nuevo[campo])
            }
            if not cambios:
                continue
            detalles.append(
                f"Unidad {unidad.CodigoBobina}: "
                + " · ".join(
                    f"{CAMPOS_CORRECCION_UNIDAD[campo]}: {_mostrar(getattr(unidad, campo))} → {_mostrar(valor)}"
                    for campo, valor in cambios.items()
                )
            )
            for campo, valor in cambios.items():
                setattr(unidad, campo, valor)

        if not detalles:
            self._Revertir(status.HTTP_409_CONFLICT, "No hay cambios para guardar")

        movimiento = MovimientoBobinaServilleta(
            IdBobinaServilleta=bobina.IdBobinaServilleta,
            IdTipoMovimiento=MOVIMIENTO_MATERIA_PRIMA_CORRECCION,
            IdUsuario=id_usuario,
            Observacion=f"{' | '.join(detalles)} · Motivo: {observacion}",
        )
        self.repository.Guardar(
            movimiento,
            *unidades.values(),
            mensaje_error="No se pudo editar la bobina servilleta",
        )

        return [
            EditarBobinaServilletaResponse(
                IdBobinaServilleta=bobina.IdBobinaServilleta,
                IdUnidadBobinaServilleta=fila["IdUnidadBobinaServilleta"],
                CodigoBobina=fila["CodigoBobina"],
                IdFormatoSubBobina=fila["IdFormatoSubBobina"],
                DescripcionFormato=fila["DescripcionFormato"],
                PesoBrutoKg=fila["PesoBrutoKg"],
                GramajeGr=fila["GramajeGr"],
                FechaMovimiento=movimiento.FechaMovimiento,
            )
            for fila in self.repository.UnidadesDeBobinas([bobina.IdBobinaServilleta]).get(
                bobina.IdBobinaServilleta, []
            )
        ]

    def _ValidarObservacion(self, observacion: str | None, mensaje: str) -> str:
        observacion = (observacion or "").strip()
        if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, observacion):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=(
                    f"{mensaje}, debe tener entre {LONGITUD_MINIMA_DESCRIPCION} y "
                    f"{LONGITUD_MAXIMA_DESCRIPCION} caracteres, {REGLA_CARACTERES_OBSERVACION}"
                ),
            )
        return observacion

    def _Revertir(self, codigo: int, mensaje: str) -> None:
        self.repository.Revertir()
        raise HTTPException(status_code=codigo, detail=mensaje)
