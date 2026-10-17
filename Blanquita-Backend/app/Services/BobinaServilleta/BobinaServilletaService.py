from collections import Counter
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Estados import ESTADO_MATERIA_PRIMA_EN_ALMACEN, ESTADO_PROVEEDOR_ACTIVO
from app.Models.BobinaServilleta.BobinaServilleta import (
    IngresoBobinaServilletaRequest,
    IngresoBobinaServilletaResponse,
    TipoBobinaServilletaIngreso,
)
from app.Repository.BobinaServilleta.BobinaServilleta import BobinaServilletaRepository
from app.Schemas.BobinaServilleta import (
    BobinaServilleta,
    LoteBobinaServilleta,
    UnidadBobinaServilleta,
)
from app.utils.dates import ZONA_BOLIVIA

UNIDADES_POR_BOBINA_SERVILLETA = 2


class BobinaServilletaService:
    def __init__(self, db: Session):
        self.repository = BobinaServilletaRepository(db)

    def InsertarBobinasServilleta(
        self, data: IngresoBobinaServilletaRequest, id_usuario: int
    ) -> IngresoBobinaServilletaResponse:
        if not data.Bobinas:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe proporcionar al menos una bobina servilleta",
            )

        for bobina in data.Bobinas:
            if len(bobina.Unidades) != UNIDADES_POR_BOBINA_SERVILLETA:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Cada bobina servilleta debe tener exactamente {UNIDADES_POR_BOBINA_SERVILLETA} unidades",
                )

        unidades = [unidad for bobina in data.Bobinas for unidad in bobina.Unidades]
        codigos = [unidad.CodigoBobina.strip() for unidad in unidades]
        if any(not codigo for codigo in codigos):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="El código es obligatorio para cada unidad de bobina servilleta",
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

        if proveedor["IdEstadoProveedor"] != ESTADO_PROVEEDOR_ACTIVO:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El proveedor {proveedor['NombreProveedor']} está inactivo, no se puede registrar el lote",
            )

        tipo = self.repository.ObtenerTipo(data.IdTipoBobinaServilleta)
        if tipo is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El tipo de bobina servilleta con id {data.IdTipoBobinaServilleta} no existe",
            )

        if not tipo["Activo"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El tipo de bobina servilleta {tipo['NombreTipoBobinaServilleta']} está inactivo, no se puede registrar el lote",
            )

        ids_formato = sorted({unidad.IdFormatoSubBobina for unidad in unidades})
        faltantes = set(ids_formato) - self.repository.IdsFormatos(ids_formato)
        if faltantes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Los formatos de sub-bobina {', '.join(map(str, sorted(faltantes)))} no existen",
            )

        registrados = self.repository.CodigosRegistrados(codigos)
        if registrados:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existen unidades registradas con los códigos {', '.join(sorted(registrados))}",
            )

        lote = self.repository.RegistrarLote(
            LoteBobinaServilleta(
                IdProveedor=data.IdProveedor,
                IdUsuario=id_usuario,
                FechaRecepcion=datetime.now(ZONA_BOLIVIA).date(),
            ),
            [
                (
                    BobinaServilleta(
                        IdTipoBobinaServilleta=data.IdTipoBobinaServilleta,
                        IdEstadoMateriaPrima=ESTADO_MATERIA_PRIMA_EN_ALMACEN,
                    ),
                    [
                        UnidadBobinaServilleta(
                            IdFormatoSubBobina=unidad.IdFormatoSubBobina,
                            CodigoBobina=unidad.CodigoBobina.strip(),
                            PesoBrutoKg=unidad.PesoBrutoKg,
                            GramajeGr=unidad.GramajeGr,
                        )
                        for unidad in bobina.Unidades
                    ],
                )
                for bobina in data.Bobinas
            ],
            id_usuario,
        )

        return IngresoBobinaServilletaResponse(
            FechaRecepcion=lote.FechaRecepcion,
            CantidadBobinasServilleta=len(data.Bobinas),
            CantidadUnidades=len(unidades),
        )

    def ObtenerTiposBobinaServilleta(self) -> list[TipoBobinaServilletaIngreso]:
        return [
            TipoBobinaServilletaIngreso(**tipo)
            for tipo in self.repository.ObtenerTipoBobinaServilleta()
        ]
