from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Models.BobinaServilleta.FormatoSubBobina import (
    CrearFormatoSubBobinaRequest,
    FormatoSubBobinaAdminItem,
)
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CambiarEstadoTipoRequest,
    CambiarEstadoTipoResponse,
)
from app.Repository.BobinaServilleta.FormatoSubBobina import FormatoSubBobinaRepository
from app.Schemas.BobinaServilleta import FormatoSubBobina, TipoMedidaSubBobina
from app.Services.AlertaStock.AlertaStock import mostrar_umbral, validar_umbral_stock
from app.Services.MateriaPrima.TipoMateriaPrima import cambiar_estado, mostrar

ETIQUETA = "formato de sub-bobina"


def descripcion_formato(detalle: list[tuple[int, int]]) -> str:
    return "+".join(f"{medida}x{cantidad}" for medida, cantidad in detalle)


class FormatoSubBobinaService:
    def __init__(self, db: Session):
        self.repository = FormatoSubBobinaRepository(db)

    def ListarFormatos(self, id_formato: int | None = None) -> list[FormatoSubBobinaAdminItem]:
        return [
            FormatoSubBobinaAdminItem(**fila) for fila in self.repository.ListarFormatos(id_formato)
        ]

    def CrearFormato(self, data: CrearFormatoSubBobinaRequest, id_admin: int) -> FormatoSubBobinaAdminItem:
        medidas_mm = [item.MedidaMm for item in data.Detalle]
        if len(medidas_mm) != len(set(medidas_mm)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="No se puede repetir una medida en el mismo formato",
            )

        for item in data.Detalle:
            validar_umbral_stock(item.StockMinimo, item.StockPreventivo)
        umbrales = {item.MedidaMm: (item.StockMinimo, item.StockPreventivo) for item in data.Detalle}

        detalle = sorted(
            ((item.MedidaMm, item.Cantidad) for item in data.Detalle),
            key=lambda fila: fila[0],
            reverse=True,
        )
        descripcion = descripcion_formato(detalle)

        if self.repository.NombreEnUso(descripcion):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe el formato {descripcion}",
            )

        medidas = self.repository.ObtenerMedidasBloqueadas(medidas_mm)
        inactivas = [f"{mm} mm" for mm in sorted(medidas, reverse=True) if not medidas[mm].Activo]
        if inactivas:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Las medidas de sub-bobina están inactivas: {', '.join(inactivas)}",
            )

        nuevas = sorted(mm for mm in medidas_mm if mm not in medidas)
        for medida_mm in nuevas:
            medidas[medida_mm] = TipoMedidaSubBobina(
                MedidaMm=medida_mm,
                Descripcion=f"Sub-bobina {medida_mm}mm",
                StockMinimo=umbrales[medida_mm][0],
                StockPreventivo=umbrales[medida_mm][1],
                Activo=True,
            )

        texto_nuevas = (
            f", medidas nuevas: {mostrar([f'{mm} mm (stock: {mostrar_umbral(*umbrales[mm])})' for mm in nuevas])}"
            if nuevas
            else ""
        )
        creado = self.repository.CrearFormato(
            FormatoSubBobina(DescripcionFormato=descripcion, Activo=True),
            medidas,
            detalle,
            lambda f: (
                f"Crear formato de sub-bobina · #{f.IdFormatoSubBobina} {f.DescripcionFormato} "
                f"({mostrar([f'{mm} mm × {cantidad}' for mm, cantidad in detalle])}{texto_nuevas})"
            ),
            id_admin,
        )
        return self.ListarFormatos(creado.IdFormatoSubBobina)[0]

    def CambiarEstado(self, data: CambiarEstadoTipoRequest, id_admin: int) -> CambiarEstadoTipoResponse:
        return cambiar_estado(
            self.repository,
            data,
            id_admin,
            ETIQUETA,
            "DescripcionFormato",
            self._ValidarDesactivacion,
        )

    def _ValidarDesactivacion(self, formato: FormatoSubBobina, activo: bool) -> None:
        if activo:
            return

        tipos = self.repository.TiposSinOtroFormatoActivo(formato.IdFormatoSubBobina)
        if tipos:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"El formato {formato.DescripcionFormato} es el único formato activo de: "
                    f"{', '.join(tipos)}. Asigna otro formato a esos tipos antes de desactivarlo"
                ),
            )
