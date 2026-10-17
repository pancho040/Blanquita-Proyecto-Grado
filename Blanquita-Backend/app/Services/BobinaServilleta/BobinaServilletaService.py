from collections import Counter
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Estados import ESTADO_MATERIA_PRIMA_EN_ALMACEN
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

        if not proveedor["Activo"]:
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

        cantidad_unidades = tipo["CantidadUnidades"]
        if any(len(bobina.Unidades) != cantidad_unidades for bobina in data.Bobinas):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Cada bobina {tipo['NombreTipoBobinaServilleta']} debe tener exactamente {cantidad_unidades} {'unidad' if cantidad_unidades == 1 else 'unidades'}",
            )

        formatos = {
            formato["IdFormatoSubBobina"]: formato
            for formato in self.repository.FormatosPermitidos([tipo["IdTipoBobinaServilleta"]]).get(
                tipo["IdTipoBobinaServilleta"], []
            )
        }
        ids_formato = sorted({unidad.IdFormatoSubBobina for unidad in unidades})

        no_permitidos = [str(id_formato) for id_formato in ids_formato if id_formato not in formatos]
        if no_permitidos:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Los formatos {', '.join(no_permitidos)} no están permitidos para el tipo {tipo['NombreTipoBobinaServilleta']}",
            )

        inactivos = [
            formatos[id_formato]["DescripcionFormato"]
            for id_formato in ids_formato
            if not formatos[id_formato]["Activo"]
        ]
        if inactivos:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Los formatos {', '.join(inactivos)} están inactivos, no se puede registrar el lote",
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
