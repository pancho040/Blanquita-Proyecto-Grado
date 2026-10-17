from collections import Counter
from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Cantidades import LONGITUD_MAXIMA_DESCRIPCION, LONGITUD_MINIMA_DESCRIPCION
from app.Constants.Estados import (
    ESTADO_MATERIA_PRIMA_EN_ALMACEN,
    MOVIMIENTO_MATERIA_PRIMA_CORRECCION,
)
from app.Models.BobinaPapel.BobinaPapel import (
    EditarBobinaPapelRequest,
    EditarBobinaPapelResponse,
    IngresoLoteBobinaPapelResponse,
    IngresoModelo,
    TipoBobinaPapelIngreso,
)
from app.Repository.BobinaPapel.BobinaPapelRepository import BobinaPapelRepository
from app.Schemas.BobinaPapel import BobinaPapel, LoteBobina, MovimientoBobina
from app.utils.dates import ZONA_BOLIVIA
from app.utils.validators import REGLA_CARACTERES_OBSERVACION, ValidarTexto

OBSERVACION_INGRESO_BOBINA = "Ingreso automático al almacén por registro de bobina"

CAMPOS_CORRECCION_BOBINA = {
    "CodigoBobina": "Código",
    "PesoBrutoKg": "Peso bruto",
    "PesoNetoKg": "Peso neto",
    "Gramaje": "Gramaje",
}


def _mostrar(valor) -> str:
    if valor is None:
        return "sin dato"
    if isinstance(valor, Decimal):
        return format(valor.normalize(), "f")
    return str(valor)


class BobinaPapelService:
    def __init__(self, db: Session):
        self.repository = BobinaPapelRepository(db)

    def InsertarBobinasPapel(self, data: IngresoModelo, id_usuario: int) -> IngresoLoteBobinaPapelResponse:
        if not data.Bobinas:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe enviar al menos una bobina para registrar",
            )

        codigos = [bobina.CodigoBobina.strip() for bobina in data.Bobinas]
        if any(not codigo for codigo in codigos):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="El código de la bobina es obligatorio",
            )

        repetidos = sorted(codigo for codigo, veces in Counter(codigos).items() if veces > 1)
        if repetidos:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Los códigos {', '.join(repetidos)} están repetidos en el lote",
            )

        proveedor = self.repository.ObtenerProveedor(data.IdProveedor)
        if proveedor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El proveedor con id {data.IdProveedor} no existe",
            )

        if not proveedor["Activo"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El proveedor {proveedor['NombreProveedor']} está inactivo, no se puede registrar el lote",
            )

        tipo = self.repository.ObtenerTipo(data.IdTipoBobina)
        if tipo is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El tipo de bobina con id {data.IdTipoBobina} no existe",
            )

        if not tipo["Activo"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El tipo de bobina {tipo['NombreTipoBobina']} está inactivo, no se puede registrar el lote",
            )

        registrados = self.repository.CodigosRegistrados(codigos)
        if registrados:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existen bobinas registradas con los códigos {', '.join(sorted(registrados))}",
            )

        lote = self.repository.RegistrarLote(
            LoteBobina(
                IdProveedor=data.IdProveedor,
                IdUsuario=id_usuario,
                FechaRecepcion=datetime.now(ZONA_BOLIVIA).date(),
            ),
            [
                BobinaPapel(
                    CodigoBobina=codigo,
                    IdTipoBobina=data.IdTipoBobina,
                    IdEstadoMateriaPrima=ESTADO_MATERIA_PRIMA_EN_ALMACEN,
                    PesoBrutoKg=bobina.PesoBrutoKg,
                    Gramaje=bobina.Gramaje,
                    PesoNetoKg=bobina.PesoNetoKg,
                )
                for codigo, bobina in zip(codigos, data.Bobinas)
            ],
            id_usuario,
            OBSERVACION_INGRESO_BOBINA,
        )

        return IngresoLoteBobinaPapelResponse(
            FechaRecepcion=lote.FechaRecepcion,
            CantidadBobinas=len(codigos),
        )

    def ObtenerTiposBobinaPapel(self) -> list[TipoBobinaPapelIngreso]:
        return [TipoBobinaPapelIngreso(**tipo) for tipo in self.repository.ObtenerTipoBobinaPapel()]

    def EditarBobinaPapel(self, data: EditarBobinaPapelRequest, id_usuario: int) -> EditarBobinaPapelResponse:
        motivo = (data.Observacion or "").strip()
        if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, motivo):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El motivo de la corrección es obligatorio, debe tener entre {LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, {REGLA_CARACTERES_OBSERVACION}",
            )

        codigo = data.CodigoBobina.strip()
        if not codigo:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="El código de la bobina es obligatorio",
            )

        bobina = self.repository.ObtenerBobinaBloqueada(data.IdBobinaPapel)
        if bobina is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No existe la bobina con id {data.IdBobinaPapel}",
            )

        nuevos = {
            "CodigoBobina": codigo,
            "PesoBrutoKg": data.PesoBrutoKg,
            "PesoNetoKg": data.PesoNetoKg,
            "Gramaje": data.Gramaje,
        }
        cambios = {
            campo: valor
            for campo, valor in nuevos.items()
            if getattr(bobina, campo) != valor
        }

        if not cambios:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No hay cambios para guardar",
            )

        if "CodigoBobina" in cambios and self.repository.CodigosRegistrados([codigo], bobina.IdBobinaPapel):
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una bobina registrada con el código {codigo}",
            )

        detalle = " · ".join(
            f"{CAMPOS_CORRECCION_BOBINA[campo]}: {_mostrar(getattr(bobina, campo))} → {_mostrar(valor)}"
            for campo, valor in cambios.items()
        )

        movimiento = self.repository.RegistrarCorreccion(
            bobina,
            cambios,
            MovimientoBobina(
                IdBobinaPapel=bobina.IdBobinaPapel,
                IdTipoMovimiento=MOVIMIENTO_MATERIA_PRIMA_CORRECCION,
                IdUsuario=id_usuario,
                Observacion=f"{detalle} · Motivo: {motivo}",
            ),
        )

        return EditarBobinaPapelResponse(
            IdBobinaPapel=bobina.IdBobinaPapel,
            CodigoBobina=bobina.CodigoBobina,
            PesoBrutoKg=bobina.PesoBrutoKg,
            PesoNetoKg=bobina.PesoNetoKg,
            Gramaje=bobina.Gramaje,
            FechaMovimiento=movimiento.FechaMovimiento,
        )
