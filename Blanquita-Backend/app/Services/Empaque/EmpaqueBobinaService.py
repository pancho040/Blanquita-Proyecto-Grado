from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Cantidades import (
    LONGITUD_MAXIMA_DESCRIPCION,
    LONGITUD_MINIMA_DESCRIPCION,
    MINUTOS_REINGRESO_EMPAQUE_BOBINA,
)
from app.Constants.Estados import (
    ESTADO_MATERIA_PRIMA_AGOTADO,
    ESTADO_MATERIA_PRIMA_EN_ALMACEN,
    MOVIMIENTO_MATERIA_PRIMA_REINGRESO,
    MOVIMIENTO_MATERIA_PRIMA_TRASLADO,
)
from app.Models.Empaque.EmpaqueBobina import (
    DetalleInventarioEmpaqueRequest,
    DetalleInventarioEmpaqueResponse,
    EmpaqueReingresableResponse,
    IngresoEmpaqueRequest,
    IngresoEmpaqueResponse,
    IngresoEmpaqueResponseItem,
    ReingresarEmpaqueRequest,
    ReingresarEmpaqueResponse,
    ResumenInventarioEmpaqueResponse,
    TipoEmpaque,
    TrasladarEmpaquesProduccionRequest,
    TrasladarEmpaquesProduccionResponseItem,
)
from app.Repository.Empaque.EmpaqueBobina import EmpaqueBobinaRepository
from app.Schemas.Empaque import Empaque, LoteEmpaque, MovimientoEmpaque
from app.utils.dates import ZONA_BOLIVIA
from app.utils.validators import CodigoMateriaPrima, REGLA_CARACTERES_OBSERVACION, ValidarTexto

OBSERVACION_INGRESO_EMPAQUE = "Ingreso automático al almacén por registro de empaque"
OBSERVACION_TRASLADO_EMPAQUE = "Empaque trasladado a producción"


class EmpaqueBobinaService:
    def __init__(self, db: Session):
        self.repository = EmpaqueBobinaRepository(db)

    def InsertarEmpaques(self, data: IngresoEmpaqueRequest, id_usuario: int) -> IngresoEmpaqueResponse:
        if not data.Empaques:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe enviar al menos un empaque para registrar",
            )

        codigos = [CodigoMateriaPrima(empaque.CodigoEmpaque, "del empaque") for empaque in data.Empaques]
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

        ids_tipo = sorted({empaque.IdTipoEmpaque for empaque in data.Empaques})
        tipos = self.repository.ObtenerTipos(ids_tipo)

        faltantes = [str(id_tipo) for id_tipo in ids_tipo if id_tipo not in tipos]
        if faltantes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Los tipos de empaque {', '.join(faltantes)} no existen",
            )

        inactivos = [tipo["NombreTipoEmpaque"] for tipo in tipos.values() if not tipo["Activo"]]
        if inactivos:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Los tipos de empaque {', '.join(inactivos)} están inactivos, no se puede registrar el lote",
            )

        registrados = self.repository.CodigosRegistrados(codigos)
        if registrados:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existen empaques registrados con los códigos {', '.join(sorted(registrados))}",
            )

        lote = self.repository.RegistrarLote(
            LoteEmpaque(
                IdProveedor=data.IdProveedor,
                IdUsuario=id_usuario,
                FechaRecepcion=datetime.now(ZONA_BOLIVIA).date(),
                CantidadToneladasPedida=data.CantidadToneladasPedida,
            ),
            [
                Empaque(
                    CodigoEmpaque=codigo,
                    IdTipoEmpaque=empaque.IdTipoEmpaque,
                    IdEstadoMateriaPrima=ESTADO_MATERIA_PRIMA_EN_ALMACEN,
                    PesoKg=empaque.PesoKg,
                )
                for codigo, empaque in zip(codigos, data.Empaques)
            ],
            id_usuario,
            OBSERVACION_INGRESO_EMPAQUE,
        )

        cantidades = Counter(empaque.IdTipoEmpaque for empaque in data.Empaques)
        return IngresoEmpaqueResponse(
            Resumen=[
                IngresoEmpaqueResponseItem(
                    FechaRecepcion=lote.FechaRecepcion,
                    IdTipoEmpaque=id_tipo,
                    NombreTipoEmpaque=tipos[id_tipo]["NombreTipoEmpaque"],
                    CantidadEmpaques=cantidades[id_tipo],
                )
                for id_tipo in ids_tipo
            ]
        )

    def TrasladarEmpaquesAProduccion(
        self, data: TrasladarEmpaquesProduccionRequest, id_usuario: int
    ) -> list[TrasladarEmpaquesProduccionResponseItem]:
        if not data.IdsEmpaque:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe proporcionar al menos un IdEmpaque",
            )

        ids_empaque = sorted(set(data.IdsEmpaque))
        if len(ids_empaque) != len(data.IdsEmpaque):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hay empaques repetidos en el traslado",
            )

        empaques = self.repository.ObtenerEmpaquesBloqueados(ids_empaque)

        faltantes = [str(id_empaque) for id_empaque in ids_empaque if id_empaque not in empaques]
        if faltantes:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No existen los empaques {', '.join(faltantes)}",
            )

        no_disponibles = [
            empaque.CodigoEmpaque
            for empaque in empaques.values()
            if empaque.IdEstadoMateriaPrima != ESTADO_MATERIA_PRIMA_EN_ALMACEN
        ]
        if no_disponibles:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Los empaques {', '.join(no_disponibles)} no están En almacén, no pueden trasladarse a producción",
            )

        movimientos = self.repository.RegistrarMovimientos(
            list(empaques.values()),
            [
                MovimientoEmpaque(
                    IdEmpaque=id_empaque,
                    IdTipoMovimiento=MOVIMIENTO_MATERIA_PRIMA_TRASLADO,
                    IdUsuario=id_usuario,
                    Observacion=OBSERVACION_TRASLADO_EMPAQUE,
                )
                for id_empaque in ids_empaque
            ],
            ESTADO_MATERIA_PRIMA_AGOTADO,
            "No se pudo trasladar los empaques a producción",
        )

        return [
            TrasladarEmpaquesProduccionResponseItem(
                IdEmpaque=movimiento.IdEmpaque,
                CodigoEmpaque=empaques[movimiento.IdEmpaque].CodigoEmpaque,
                IdEstadoMateriaPrima=ESTADO_MATERIA_PRIMA_AGOTADO,
                FechaMovimiento=movimiento.FechaMovimiento,
            )
            for movimiento in movimientos
        ]

    def ListarEmpaquesReingresables(self) -> list[EmpaqueReingresableResponse]:
        return [
            EmpaqueReingresableResponse(**fila)
            for fila in self.repository.ListarEmpaquesReingresables()
        ]

    def ReingresarEmpaque(
        self, data: ReingresarEmpaqueRequest, id_usuario: int
    ) -> ReingresarEmpaqueResponse:
        observacion = (data.Observacion or "").strip()
        if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, observacion):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La observación es obligatoria, debe tener entre {LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, {REGLA_CARACTERES_OBSERVACION}",
            )

        empaque = self.repository.ObtenerEmpaquesBloqueados([data.IdEmpaque]).get(data.IdEmpaque)
        if empaque is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No existe el empaque con id {data.IdEmpaque}",
            )

        if empaque.IdEstadoMateriaPrima != ESTADO_MATERIA_PRIMA_AGOTADO:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El empaque {empaque.CodigoEmpaque} no fue enviado a producción, no puede reingresarse",
            )

        fecha_traslado = self.repository.UltimoTraslado(empaque.IdEmpaque)
        if fecha_traslado is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El empaque {empaque.CodigoEmpaque} no tiene un traslado a producción registrado",
            )

        if datetime.now(timezone.utc) - fecha_traslado > timedelta(
            minutes=MINUTOS_REINGRESO_EMPAQUE_BOBINA
        ):
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Pasaron más de {MINUTOS_REINGRESO_EMPAQUE_BOBINA} minutos desde el traslado; el empaque {empaque.CodigoEmpaque} ya no puede reingresarse al almacén",
            )

        movimiento = self.repository.RegistrarMovimientos(
            [empaque],
            [
                MovimientoEmpaque(
                    IdEmpaque=empaque.IdEmpaque,
                    IdTipoMovimiento=MOVIMIENTO_MATERIA_PRIMA_REINGRESO,
                    IdUsuario=id_usuario,
                    Observacion=observacion,
                )
            ],
            ESTADO_MATERIA_PRIMA_EN_ALMACEN,
            "No se pudo reingresar el empaque al almacén",
        )[0]

        return ReingresarEmpaqueResponse(
            IdEmpaque=empaque.IdEmpaque,
            CodigoEmpaque=empaque.CodigoEmpaque,
            IdEstadoMateriaPrima=ESTADO_MATERIA_PRIMA_EN_ALMACEN,
            FechaMovimiento=movimiento.FechaMovimiento,
        )

    def VerResumenInventarioEmpaque(self) -> list[ResumenInventarioEmpaqueResponse]:
        return [
            ResumenInventarioEmpaqueResponse(**fila)
            for fila in self.repository.VerResumenInventarioEmpaque()
        ]

    def VerDetalleInventarioEmpaque(
        self, data: DetalleInventarioEmpaqueRequest
    ) -> list[DetalleInventarioEmpaqueResponse]:
        return [
            DetalleInventarioEmpaqueResponse(**fila)
            for fila in self.repository.VerDetalleInventarioEmpaque(data.IdTipoEmpaque)
        ]

    def ObtenerTiposEmpaque(self) -> list[TipoEmpaque]:
        return [TipoEmpaque(**tipo) for tipo in self.repository.ObtenerTipoEmpaque()]
