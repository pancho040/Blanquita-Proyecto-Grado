import re
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.Cantidades import LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION
from app.Models.Proveedor.Proveedor import (
    CambiarEstadoProveedorRequest,
    CambiarEstadoProveedorResponse,
    CrearProveedorRequest,
    EditarProveedorRequest,
    ListarProveedoresRequest,
    ListarProveedoresResponse,
    ProveedorForm,
    ProveedorItem,
    ProveedorResponse,
)
from app.Repository.Proveedor.Proveedor import ProveedorRepository
from app.Schemas.Proveedor import Proveedor
from app.utils.validators import REGLA_CARACTERES_OBSERVACION, ValidarTexto

PATRON_NOMBRE_PROVEEDOR = r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,&-]+$"

ETIQUETAS_CAMPOS = {
    "CelularProveedor": "celular",
    "CorreoProveedor": "correo",
}


def _limpiar(texto: str) -> str:
    return " ".join(texto.split())


def _mostrar(valor: str | None) -> str:
    return valor if valor else "sin dato"


def _estado(activo: bool) -> str:
    return "Activo" if activo else "Inactivo"


class ProveedorService:
    def __init__(self, db: Session):
        self.repository = ProveedorRepository(db)

    def ObtenerProveedoresForm(self) -> List[ProveedorForm]:
        return [ProveedorForm(**pf) for pf in self.repository.ObtenerProveedorForm()]

    def ListarProveedores(self, data: ListarProveedoresRequest) -> ListarProveedoresResponse:
        total, filas = self.repository.ListarProveedores(data.model_dump())

        return ListarProveedoresResponse(
            Total=total,
            Pagina=data.Pagina,
            TamanoPagina=data.TamanoPagina,
            Proveedores=[ProveedorItem(**fila) for fila in filas],
        )

    def _ValidarNombre(self, nombre: str) -> str:
        nombre = _limpiar(nombre)

        if not re.fullmatch(PATRON_NOMBRE_PROVEEDOR, nombre):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="El nombre del proveedor solo puede tener letras, números, espacios y . , & -",
            )

        if self.repository.NombreEnUso(nombre):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un proveedor llamado {nombre}",
            )
        return nombre

    def _Respuesta(self, proveedor: Proveedor) -> ProveedorResponse:
        return ProveedorResponse(
            IdProveedor=proveedor.IdProveedor,
            NombreProveedor=proveedor.NombreProveedor,
            CelularProveedor=proveedor.CelularProveedor,
            CorreoProveedor=proveedor.CorreoProveedor,
            Activo=proveedor.Activo,
        )

    def CrearProveedor(self, datos: CrearProveedorRequest, id_admin: int) -> ProveedorResponse:
        nombre = self._ValidarNombre(datos.NombreProveedor)
        correo = datos.CorreoProveedor.lower() if datos.CorreoProveedor else None

        creado = self.repository.CrearProveedor(
            Proveedor(
                NombreProveedor=nombre,
                CelularProveedor=datos.CelularProveedor,
                CorreoProveedor=correo,
                Activo=True,
            ),
            lambda p: (
                f"Crear proveedor · #{p.IdProveedor} {p.NombreProveedor} "
                f"(celular: {_mostrar(p.CelularProveedor)}, correo: {_mostrar(p.CorreoProveedor)})"
            ),
            id_admin,
        )
        return self._Respuesta(creado)

    def EditarProveedor(self, datos: EditarProveedorRequest, id_admin: int) -> ProveedorResponse:
        proveedor = self.repository.ObtenerProveedorBloqueado(datos.IdProveedor)
        if proveedor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El proveedor no existe",
            )

        nuevos = {
            "CelularProveedor": datos.CelularProveedor,
            "CorreoProveedor": datos.CorreoProveedor.lower() if datos.CorreoProveedor else None,
        }
        cambios = {
            campo: valor
            for campo, valor in nuevos.items()
            if getattr(proveedor, campo) != valor
        }

        if not cambios:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No hay cambios para guardar",
            )

        detalle = "; ".join(
            f"{ETIQUETAS_CAMPOS[campo]}: {_mostrar(getattr(proveedor, campo))} → {_mostrar(valor)}"
            for campo, valor in cambios.items()
        )
        observacion = f"Editar proveedor · #{proveedor.IdProveedor} {proveedor.NombreProveedor}: {detalle}"

        editado = self.repository.EditarProveedor(proveedor, cambios, observacion, id_admin)
        return self._Respuesta(editado)

    def CambiarEstadoProveedor(
        self, data: CambiarEstadoProveedorRequest, id_admin: int
    ) -> CambiarEstadoProveedorResponse:
        motivo = _limpiar(data.Motivo or "")
        if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, motivo):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=(
                    "El motivo es obligatorio, debe tener entre "
                    f"{LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, "
                    f"{REGLA_CARACTERES_OBSERVACION}"
                ),
            )

        proveedor = self.repository.ObtenerProveedorBloqueado(data.IdProveedor)
        if proveedor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El proveedor no existe",
            )

        anterior = proveedor.Activo
        if anterior == data.Activo:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El proveedor ya se encuentra {_estado(anterior)}",
            )

        observacion = (
            f"Cambio de estado · Proveedor #{proveedor.IdProveedor} ({proveedor.NombreProveedor}): "
            f"{_estado(anterior)} → {_estado(data.Activo)}. Motivo: {motivo}"
        )

        self.repository.CambiarEstado(proveedor, data.Activo, observacion, id_admin)

        return CambiarEstadoProveedorResponse(
            IdProveedor=proveedor.IdProveedor,
            NombreProveedor=proveedor.NombreProveedor,
            ActivoAnterior=anterior,
            Activo=data.Activo,
        )
