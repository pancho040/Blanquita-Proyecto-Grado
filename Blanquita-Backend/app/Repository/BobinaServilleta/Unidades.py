from sqlalchemy import select

from app.Schemas.BobinaServilleta import (
    FormatoSubBobina,
    FormatoSubBobinaDetalle,
    TipoBobinaServilletaFormato,
    TipoMedidaSubBobina,
    UnidadBobinaServilleta,
)


def unidades_de_bobinas(caller, ids_bobina: list[int]) -> dict[int, list[dict]]:
    if not ids_bobina:
        return {}

    filas = caller.Consultar(
        select(
            UnidadBobinaServilleta.IdUnidadBobinaServilleta,
            UnidadBobinaServilleta.IdBobinaServilleta,
            UnidadBobinaServilleta.CodigoBobina,
            UnidadBobinaServilleta.IdFormatoSubBobina,
            FormatoSubBobina.DescripcionFormato,
            UnidadBobinaServilleta.PesoBrutoKg,
            UnidadBobinaServilleta.GramajeGr,
        )
        .join(
            FormatoSubBobina,
            FormatoSubBobina.IdFormatoSubBobina == UnidadBobinaServilleta.IdFormatoSubBobina,
        )
        .where(UnidadBobinaServilleta.IdBobinaServilleta.in_(ids_bobina))
        .order_by(UnidadBobinaServilleta.IdUnidadBobinaServilleta)
    )

    unidades: dict[int, list[dict]] = {}
    for fila in filas:
        unidades.setdefault(fila["IdBobinaServilleta"], []).append(fila)
    return unidades


def con_unidades(caller, filas: list[dict]) -> list[dict]:
    unidades = unidades_de_bobinas(caller, [fila["IdBobinaServilleta"] for fila in filas])
    return [
        {**fila, "Unidades": unidades.get(fila["IdBobinaServilleta"], [])} for fila in filas
    ]


def detalle_de_formatos(caller, ids_formato: list[int]) -> dict[int, list[dict]]:
    if not ids_formato:
        return {}

    filas = caller.Consultar(
        select(
            FormatoSubBobinaDetalle.IdFormatoSubBobina,
            TipoMedidaSubBobina.IdTipoMedidaSubBobina,
            TipoMedidaSubBobina.MedidaMm,
            TipoMedidaSubBobina.Descripcion.label("DescripcionMedida"),
            FormatoSubBobinaDetalle.Cantidad,
        )
        .join(
            TipoMedidaSubBobina,
            TipoMedidaSubBobina.IdTipoMedidaSubBobina == FormatoSubBobinaDetalle.IdTipoMedidaSubBobina,
        )
        .where(FormatoSubBobinaDetalle.IdFormatoSubBobina.in_(ids_formato))
        .order_by(FormatoSubBobinaDetalle.IdFormatoSubBobina, TipoMedidaSubBobina.MedidaMm.desc())
    )

    detalle: dict[int, list[dict]] = {}
    for fila in filas:
        detalle.setdefault(fila["IdFormatoSubBobina"], []).append(fila)
    return detalle


def formatos_permitidos(caller, ids_tipo: list[int]) -> dict[int, list[dict]]:
    if not ids_tipo:
        return {}

    filas = caller.Consultar(
        select(
            TipoBobinaServilletaFormato.IdTipoBobinaServilleta,
            FormatoSubBobina.IdFormatoSubBobina,
            FormatoSubBobina.DescripcionFormato,
            FormatoSubBobina.Activo,
        )
        .join(
            FormatoSubBobina,
            FormatoSubBobina.IdFormatoSubBobina == TipoBobinaServilletaFormato.IdFormatoSubBobina,
        )
        .where(TipoBobinaServilletaFormato.IdTipoBobinaServilleta.in_(ids_tipo))
        .order_by(FormatoSubBobina.IdFormatoSubBobina)
    )

    detalle = detalle_de_formatos(caller, sorted({fila["IdFormatoSubBobina"] for fila in filas}))
    formatos: dict[int, list[dict]] = {}
    for fila in filas:
        formatos.setdefault(fila["IdTipoBobinaServilleta"], []).append(
            {
                "IdFormatoSubBobina": fila["IdFormatoSubBobina"],
                "DescripcionFormato": fila["DescripcionFormato"],
                "Activo": fila["Activo"],
                "Detalle": detalle.get(fila["IdFormatoSubBobina"], []),
            }
        )
    return formatos
