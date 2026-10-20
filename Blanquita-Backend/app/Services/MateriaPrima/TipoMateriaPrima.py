import re
from decimal import Decimal

from fastapi import HTTPException, status

from app.Constants.Cantidades import LONGITUD_MAXIMA_DESCRIPCION, LONGITUD_MINIMA_DESCRIPCION
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CambiarEstadoTipoRequest,
    CambiarEstadoTipoResponse,
)
from app.Schemas.Producto import Producto
from app.utils.validators import REGLA_CARACTERES_OBSERVACION, ValidarTexto

PATRON_NOMBRE_TIPO = r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,%()/-]+$"


def limpiar(texto: str | None) -> str:
    return " ".join((texto or "").split())


def mostrar(valor) -> str:
    if valor is None or valor == "":
        return "sin dato"
    if isinstance(valor, Decimal):
        return f"{valor.normalize():f}"
    if isinstance(valor, (list, tuple)):
        return ", ".join(str(v) for v in valor) if valor else "ninguno"
    return str(valor)


def estado(activo: bool) -> str:
    return "Activo" if activo else "Inactivo"


def validar_nombre(repository, nombre: str, etiqueta: str) -> str:
    nombre = limpiar(nombre)
    if not re.fullmatch(PATRON_NOMBRE_TIPO, nombre):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"El nombre del {etiqueta} solo puede tener letras, números, espacios y . , % ( ) / -",
        )

    if repository.NombreEnUso(nombre):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un {etiqueta} llamado {nombre}",
        )
    return nombre


def validar_descripcion(descripcion: str | None) -> str | None:
    descripcion = limpiar(descripcion)
    if not descripcion:
        return None

    if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, descripcion):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "La descripción es opcional; si se registra debe tener entre "
                f"{LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, "
                f"{REGLA_CARACTERES_OBSERVACION}"
            ),
        )
    return descripcion


def validar_motivo(motivo: str | None) -> str:
    motivo = limpiar(motivo)
    if not ValidarTexto(LONGITUD_MINIMA_DESCRIPCION, LONGITUD_MAXIMA_DESCRIPCION, motivo):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "El motivo es obligatorio, debe tener entre "
                f"{LONGITUD_MINIMA_DESCRIPCION} y {LONGITUD_MAXIMA_DESCRIPCION} caracteres, "
                f"{REGLA_CARACTERES_OBSERVACION}"
            ),
        )
    return motivo


def detalle_campos(etiquetas: dict[str, str], valores: dict) -> str:
    return ", ".join(f"{etiquetas[campo]}: {mostrar(valor)}" for campo, valor in valores.items())


def cambios_campos(registro, nuevos: dict) -> dict:
    return {
        campo: valor
        for campo, valor in nuevos.items()
        if getattr(registro, campo) != valor
    }


def detalle_cambios(etiquetas: dict[str, str], registro, cambios: dict) -> list[str]:
    return [
        f"{etiquetas[campo]}: {mostrar(getattr(registro, campo))} → {mostrar(valor)}"
        for campo, valor in cambios.items()
    ]


def validar_ids_unicos(ids: list[int], etiqueta: str) -> list[int]:
    if len(ids) != len(set(ids)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"No se pueden repetir {etiqueta}",
        )
    return sorted(ids)


def preparar_productos(
    repository,
    ids_producto: list[int],
    id_tipo: int | None,
    campo_tipo: str,
    campo_otro_tipo: str,
    etiqueta_otro_tipo: str,
) -> tuple[list, list, list[str], list[str]]:
    ids_nuevos = set(validar_ids_unicos(ids_producto, "productos"))
    actuales = (
        repository.ProductosDeTipos(getattr(Producto, campo_tipo), [id_tipo]).get(id_tipo, [])
        if id_tipo is not None
        else []
    )
    ids_actuales = {producto["IdProducto"] for producto in actuales}

    productos = repository.ObtenerProductosBloqueados(sorted(ids_nuevos | ids_actuales))

    faltantes = sorted(ids_nuevos - set(productos))
    if faltantes:
        repository.Revertir()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existen los productos con id {', '.join(map(str, faltantes))}",
        )

    de_otro = [
        productos[i].NombreProducto
        for i in sorted(ids_nuevos)
        if getattr(productos[i], campo_otro_tipo) is not None
    ]
    if de_otro:
        repository.Revertir()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya están asociados a un tipo de {etiqueta_otro_tipo}: {', '.join(de_otro)}",
        )

    agregados = [productos[i] for i in sorted(ids_nuevos - ids_actuales)]
    quitados = [productos[i] for i in sorted(ids_actuales - ids_nuevos)]

    afectados = [p.IdProducto for p in quitados] + [
        p.IdProducto for p in agregados if getattr(p, campo_tipo) is not None
    ]
    en_produccion = repository.ProductosEnProduccion(afectados)
    if en_produccion:
        repository.Revertir()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "No se puede cambiar la asociación de productos con una producción en curso o en pausa: "
                f"{', '.join(en_produccion)}"
            ),
        )

    nombres_antes = sorted(productos[i].NombreProducto for i in ids_actuales)
    nombres_despues = sorted(productos[i].NombreProducto for i in ids_nuevos)
    return agregados, quitados, nombres_antes, nombres_despues


def asignar_productos(agregados: list, quitados: list, campo_tipo: str, id_tipo: int) -> None:
    for producto in agregados:
        setattr(producto, campo_tipo, id_tipo)
    for producto in quitados:
        setattr(producto, campo_tipo, None)


def cambiar_estado(
    repository,
    data: CambiarEstadoTipoRequest,
    id_admin: int,
    etiqueta: str,
    campo_nombre: str,
    validar_cambio=None,
) -> CambiarEstadoTipoResponse:
    motivo = validar_motivo(data.Motivo)

    tipo = repository.ObtenerTipoBloqueado(data.Id)
    if tipo is None:
        repository.Revertir()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El {etiqueta} no existe",
        )

    anterior = tipo.Activo
    nombre = getattr(tipo, campo_nombre)
    if anterior == data.Activo:
        repository.Revertir()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El {etiqueta} {nombre} ya se encuentra {estado(anterior)}",
        )

    if validar_cambio is not None:
        validar_cambio(tipo, data.Activo)

    tipo.Activo = data.Activo
    repository.Guardar(
        (
            f"Cambio de estado · {etiqueta.capitalize()} #{data.Id} ({nombre}): "
            f"{estado(anterior)} → {estado(data.Activo)}. Motivo: {motivo}"
        ),
        id_admin,
        f"No se pudo cambiar el estado del {etiqueta}",
    )

    return CambiarEstadoTipoResponse(
        Id=data.Id,
        Nombre=nombre,
        ActivoAnterior=anterior,
        Activo=data.Activo,
    )
