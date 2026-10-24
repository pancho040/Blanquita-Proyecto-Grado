import re
import unicodedata

from fastapi import HTTPException, status

from app.Constants.Cantidades import (
    LONGITUD_MAXIMA_CODIGO_MATERIA_PRIMA,
    LONGITUD_MINIMA_CODIGO_MATERIA_PRIMA,
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
