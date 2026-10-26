import re
import unicodedata
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status

from app.Constants.Cantidades import (
    DECIMALES_PESO,
    DECIMALES_TONELADAS,
    GRAMAJE_MAXIMO,
    LONGITUD_MAXIMA_CODIGO_MATERIA_PRIMA,
    LONGITUD_MINIMA_CODIGO_MATERIA_PRIMA,
    PESO_MAXIMO_UNIDAD_SERVILLETA_KG,
    PESO_MINIMO_UNIDAD_SERVILLETA_KG,
    TONELADAS_MAXIMAS_PEDIDO,
    TONELADAS_MINIMAS_PEDIDO,
)

def EsCantidadValida(CantidadIngreso: int, Limite: int) -> bool:
    if CantidadIngreso > Limite: return  False
    return True


def ValidarTexto(minLengthText:int,maxLengthText:int,texto:str)->bool:
    if not isinstance(texto,str):
        return False
    else:
        l=len(texto)
        if l<minLengthText or l>maxLengthText: return False
    if not ValidarCaracteres(texto): return False

    return True

def ValidarFormularioUsuario(texto:str)->bool:
    patron=r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,15}$"
    if re.fullmatch(patron,texto): return True
    return False

REGLA_CARACTERES_OBSERVACION='solo con letras, números, espacios y . , ; : ( ) " / # -'

def ValidarCaracteres(texto:str)->bool:
    patron=r'^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,;:()"/#-]+$'
    if re.fullmatch(patron,texto): return True
    return False


REGLA_CARACTERES_CODIGO = (
    f"debe tener entre {LONGITUD_MINIMA_CODIGO_MATERIA_PRIMA} y {LONGITUD_MAXIMA_CODIGO_MATERIA_PRIMA} "
    "caracteres, solo con letras, números y guiones"
)

def NormalizarCodigo(texto) -> str:
    if not isinstance(texto, str):
        return ""
    descompuesto = unicodedata.normalize("NFD", texto.upper()).replace("N\u0303", "Ñ")
    sin_tildes = "".join(c for c in descompuesto if not unicodedata.combining(c))
    codigo = re.sub(r"\s+", "-", sin_tildes.strip())
    return re.sub(r"-{2,}", "-", codigo).strip("-")

def ValidarCodigo(codigo: str) -> bool:
    if not LONGITUD_MINIMA_CODIGO_MATERIA_PRIMA <= len(codigo) <= LONGITUD_MAXIMA_CODIGO_MATERIA_PRIMA:
        return False
    return re.fullmatch(r"[A-ZÑ0-9]+(-[A-ZÑ0-9]+)*", codigo) is not None

def CodigoMateriaPrima(texto, etiqueta: str) -> str:
    codigo = NormalizarCodigo(texto)
    if not codigo:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"El código {etiqueta} es obligatorio",
        )
    if not ValidarCodigo(codigo):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"El código {etiqueta} «{codigo}» no es válido, {REGLA_CARACTERES_CODIGO}",
        )
    return codigo

def CodigoBusqueda(texto) -> str | None:
    return NormalizarCodigo(texto) or None


def _TextoNumero(valor) -> str:
    return format(Decimal(str(valor)).normalize(), "f").replace(".", ",")

def ValidarMedida(
    valor,
    etiqueta: str,
    unidad: str,
    maximo,
    minimo=0,
    decimales: int = DECIMALES_PESO,
    obligatorio: bool = True,
) -> Decimal | None:
    if valor is None:
        if not obligatorio:
            return None
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Falta {etiqueta}",
        )
    try:
        numero = Decimal(str(valor))
    except InvalidOperation:
        numero = None
    rango = (
        f"ser mayor a 0 y como máximo {_TextoNumero(maximo)} {unidad}"
        if Decimal(str(minimo)) == 0
        else f"estar entre {_TextoNumero(minimo)} y {_TextoNumero(maximo)} {unidad}"
    )
    if (
        numero is None
        or not numero.is_finite()
        or numero <= 0
        or numero < Decimal(str(minimo))
        or numero > Decimal(str(maximo))
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"{etiqueta[0].upper()}{etiqueta[1:]} debe {rango}",
        )
    if -numero.normalize().as_tuple().exponent > decimales:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"{etiqueta[0].upper()}{etiqueta[1:]} admite como máximo {decimales} decimales",
        )
    return numero

def ToneladasPedidas(valor, obligatorio: bool = True) -> Decimal | None:
    return ValidarMedida(
        valor,
        "la cantidad de toneladas pedidas",
        "t",
        TONELADAS_MAXIMAS_PEDIDO,
        TONELADAS_MINIMAS_PEDIDO,
        DECIMALES_TONELADAS,
        obligatorio,
    )

def MedidasUnidadServilleta(codigo: str, peso, gramaje) -> dict:
    return {
        "PesoBrutoKg": ValidarMedida(
            peso,
            f"el peso bruto de la unidad {codigo}",
            "kg",
            PESO_MAXIMO_UNIDAD_SERVILLETA_KG,
            PESO_MINIMO_UNIDAD_SERVILLETA_KG,
            obligatorio=False,
        ),
        "GramajeGr": ValidarMedida(
            gramaje,
            f"el gramaje de la unidad {codigo}",
            "g/m²",
            GRAMAJE_MAXIMO,
            obligatorio=False,
        ),
    }
