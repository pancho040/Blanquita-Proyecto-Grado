from collections import Counter
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Estados import ESTADO_MATERIA_PRIMA_EN_ALMACEN
from app.Models.Rodela.Rodela import (
    IngresoRodelaRequest,
    IngresoRodelaResponse,
    TipoRodela,
)
from app.Repository.Rodela.RodelaRepository import RodelaRepository
from app.Schemas.Rodela import LoteRodela, Rodela
from app.utils.dates import ZONA_BOLIVIA
from app.utils.validators import CodigoMateriaPrima

OBSERVACION_INGRESO_RODELA = "Ingreso automático al almacén por registro de rodela"


class RodelaService:
    def __init__(self, db: Session):
        self.repository = RodelaRepository(db)

    def InsertarRodelas(self, data: IngresoRodelaRequest, id_usuario: int) -> IngresoRodelaResponse:
        if not data.Rodelas:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe enviar al menos una rodela para registrar",
            )

        codigos = [CodigoMateriaPrima(rodela.CodigoRodela, "de la rodela") for rodela in data.Rodelas]

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

        tipo = self.repository.ObtenerTipo(data.IdTipoRodela)
        if tipo is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El tipo de rodela con id {data.IdTipoRodela} no existe",
            )

        if not tipo["Activo"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El tipo de rodela {tipo['NombreTipoRodela']} está inactivo, no se puede registrar el lote",
            )

        registrados = self.repository.CodigosRegistrados(codigos)
        if registrados:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existen rodelas registradas con los códigos {', '.join(sorted(registrados))}",
            )

        lote = self.repository.RegistrarLote(
            LoteRodela(
                IdProveedor=data.IdProveedor,
                IdUsuario=id_usuario,
                FechaRecepcion=datetime.now(ZONA_BOLIVIA).date(),
            ),
            [
                Rodela(
                    CodigoRodela=codigo,
                    IdTipoRodela=data.IdTipoRodela,
                    IdEstadoMateriaPrima=ESTADO_MATERIA_PRIMA_EN_ALMACEN,
                )
                for codigo in codigos
            ],
            id_usuario,
            OBSERVACION_INGRESO_RODELA,
        )

        return IngresoRodelaResponse(
            FechaRecepcion=lote.FechaRecepcion,
            CantidadRodelas=len(codigos),
        )

    def ObtenerTiposRodela(self) -> list[TipoRodela]:
        return [TipoRodela(**tipo) for tipo in self.repository.ObtenerTipoRodela()]
