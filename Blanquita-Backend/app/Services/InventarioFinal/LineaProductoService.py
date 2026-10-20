import re

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Constants.AlertaStock import DOMINIO_STOCK_PRODUCTO
from app.Constants.Cantidades import LONGITUD_MAXIMA_SUFIJO_CODIGO_PRESENTACION
from app.Constants.Producto import (
    CONTENEDOR_PLANCHA,
    CONTENEDORES_PRESENTACION,
    LETRAS_CONTENEDOR,
    PATRON_SIGLAS_PRODUCTO,
)
from app.Models.InventarioFinal.LineaProducto import (
    CrearLineaProductoRequest,
    CrearPresentacionRequest,
    EditarLineaProductoRequest,
    LineaProductoAdminItem,
    OrigenLineaRequest,
    PresentacionAdminItem,
    PresentacionRequest,
    TipoOrigenItem,
    TiposOrigenResponse,
)
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CambiarEstadoTipoRequest,
    CambiarEstadoTipoResponse,
)
from app.Repository.AlertaStock.AlertaStock import AlertaStockRepository
from app.Repository.InventarioFinal.LineaProducto import (
    LineaProductoRepository,
    PresentacionProductoRepository,
)
from app.Schemas.BobinaPapel import TipoBobina
from app.Schemas.BobinaServilleta import TipoBobinaServilleta
from app.Schemas.Producto import Producto
from app.Services.AlertaStock.AlertaStock import mostrar_umbral, validar_umbral_stock
from app.Services.MateriaPrima.TipoMateriaPrima import cambiar_estado, limpiar, mostrar, validar_nombre

ETIQUETA_LINEA = "línea de producto"
ETIQUETA_PRESENTACION = "presentación"
SIN_MATERIA_PRIMA = "sin materia prima (merma o segunda)"


def texto_presentacion(presentacion: dict) -> str:
    contenido = f"{presentacion['CantidadRollosUnidades']} u/paq"
    if presentacion["TipoContenedor"] != CONTENEDOR_PLANCHA:
        contenido += f", {presentacion['CantidadPorUnidadTerminada']} paq por {presentacion['TipoContenedor'].lower()}"
    return (
        f"{presentacion['CodigoPresentacion']} ({presentacion['TipoContenedor']}, {contenido}, "
        f"stock: {mostrar_umbral(presentacion['StockMinimo'], presentacion['StockPreventivo'])})"
    )


def validar_siglas(siglas: str) -> str:
    siglas = limpiar(siglas).upper()
    if not re.fullmatch(PATRON_SIGLAS_PRODUCTO, siglas):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Las siglas deben ser exactamente 3 letras sin acentos (A-Z)",
        )
    return siglas


def validar_contenedor(contenedor: str) -> str:
    contenedor = limpiar(contenedor).lower()
    for valido in CONTENEDORES_PRESENTACION:
        if valido.lower() == contenedor:
            return valido
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail=f"El contenedor debe ser uno de: {', '.join(CONTENEDORES_PRESENTACION)}",
    )


def paquetes_por_contenedor(contenedor: str, paquetes: int | None) -> int:
    if contenedor == CONTENEDOR_PLANCHA:
        if paquetes not in (None, 1):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="La plancha se cuenta por unidad: los paquetes por contenedor siempre son 1",
            )
        return 1

    if paquetes is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Indica cuántos paquetes lleva cada {contenedor.lower()}",
        )
    return paquetes


def codigo_sugerido(siglas: str, contenedor: str, unidades: int) -> str:
    return f"{siglas}-{LETRAS_CONTENEDOR[contenedor]}{unidades:02d}"


def validar_codigo(siglas: str, contenedor: str, unidades: int, codigo: str | None) -> str:
    codigo = "".join((codigo or "").split()).upper()
    if not codigo:
        return codigo_sugerido(siglas, contenedor, unidades)

    patron = rf"^{siglas}-[A-Z0-9]{{1,{LONGITUD_MAXIMA_SUFIJO_CODIGO_PRESENTACION}}}$"
    if not re.fullmatch(patron, codigo):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                f"El código {codigo} debe empezar con {siglas}- seguido de 1 a "
                f"{LONGITUD_MAXIMA_SUFIJO_CODIGO_PRESENTACION} letras o números (p. ej. "
                f"{codigo_sugerido(siglas, contenedor, unidades)})"
            ),
        )
    return codigo


def preparar_presentaciones(
    presentaciones: list[PresentacionRequest],
    siglas: str,
    existentes: list[dict],
) -> list[dict]:
    combinaciones = {
        (p["TipoContenedor"], p["CantidadRollosUnidades"], p["CantidadPorUnidadTerminada"])
        for p in existentes
    }
    codigos: set[str] = set()
    preparadas = []

    for item in presentaciones:
        contenedor = validar_contenedor(item.TipoContenedor)
        paquetes = paquetes_por_contenedor(contenedor, item.CantidadPorUnidadTerminada)
        validar_umbral_stock(item.StockMinimo, item.StockPreventivo)
        codigo = validar_codigo(siglas, contenedor, item.CantidadRollosUnidades, item.CodigoPresentacion)

        combinacion = (contenedor, item.CantidadRollosUnidades, paquetes)
        if combinacion in combinaciones:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Ya existe una presentación en {contenedor.lower()} de "
                    f"{item.CantidadRollosUnidades} u/paq y {paquetes} paq por {contenedor.lower()}"
                ),
            )
        if codigo in codigos:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"No se puede repetir el código {codigo}",
            )

        combinaciones.add(combinacion)
        codigos.add(codigo)
        preparadas.append(
            {
                "TipoContenedor": contenedor,
                "CantidadRollosUnidades": item.CantidadRollosUnidades,
                "CantidadPorUnidadTerminada": paquetes,
                "CodigoPresentacion": codigo,
                "StockMinimo": item.StockMinimo,
                "StockPreventivo": item.StockPreventivo,
            }
        )
    return preparadas


class LineaProductoService:
    def __init__(self, db: Session):
        self.repository = LineaProductoRepository(db)
        self.presentaciones = PresentacionProductoRepository(db)
        self.stock = AlertaStockRepository(db)

    def ListarLineas(self, id_producto: int | None = None) -> list[LineaProductoAdminItem]:
        lineas = self.repository.ListarLineas(id_producto)
        presentaciones = self.repository.ListarPresentaciones([linea["IdProducto"] for linea in lineas])
        stock = {
            fila["Id"]: fila for fila in self.stock.ListarStock(dominio=DOMINIO_STOCK_PRODUCTO)
        }

        return [
            LineaProductoAdminItem(
                **linea,
                Presentaciones=[
                    self._Presentacion(presentacion, stock.get(presentacion["IdPresentacion"]))
                    for presentacion in presentaciones.get(linea["IdProducto"], [])
                ],
            )
            for linea in lineas
        ]

    def ObtenerLinea(self, id_producto: int) -> LineaProductoAdminItem:
        lineas = self.ListarLineas(id_producto)
        if not lineas:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"La {ETIQUETA_LINEA} no existe",
            )
        return lineas[0]

    def TiposOrigen(self) -> TiposOrigenResponse:
        return TiposOrigenResponse(
            BobinaPapel=[
                TipoOrigenItem(**fila)
                for fila in self.repository.TiposOrigen(
                    TipoBobina, TipoBobina.IdTipoBobina, TipoBobina.NombreTipoBobina
                )
            ],
            BobinaServilleta=[
                TipoOrigenItem(**fila)
                for fila in self.repository.TiposOrigen(
                    TipoBobinaServilleta,
                    TipoBobinaServilleta.IdTipoBobinaServilleta,
                    TipoBobinaServilleta.NombreTipoBobinaServilleta,
                )
            ],
        )

    def CrearLinea(self, data: CrearLineaProductoRequest, id_admin: int) -> LineaProductoAdminItem:
        nombre = validar_nombre(self.repository, data.NombreProducto, ETIQUETA_LINEA)
        siglas = validar_siglas(data.SiglasProducto)
        if self.repository.SiglasEnUso(siglas):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Las siglas {siglas} ya pertenecen a otra línea de producto",
            )

        presentaciones = preparar_presentaciones(data.Presentaciones, siglas, [])
        self._ValidarCodigosLibres(presentaciones)
        id_tipo_bobina, id_tipo_servilleta, origen = self._ValidarOrigen(data)

        creada = self.repository.CrearLinea(
            Producto(
                NombreProducto=nombre,
                SiglasProducto=siglas,
                IdTipoBobina=id_tipo_bobina,
                IdTipoBobinaServilleta=id_tipo_servilleta,
                Activo=True,
            ),
            presentaciones,
            lambda p: (
                f"Crear línea de producto · #{p.IdProducto} {p.NombreProducto} "
                f"(siglas: {p.SiglasProducto}, materia prima: {origen}, "
                f"presentaciones: {mostrar([texto_presentacion(x) for x in presentaciones])})"
            ),
            id_admin,
        )
        return self.ObtenerLinea(creada.IdProducto)

    def EditarLinea(self, data: EditarLineaProductoRequest, id_admin: int) -> LineaProductoAdminItem:
        linea = self.repository.ObtenerTipoBloqueado(data.IdProducto)
        if linea is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"La {ETIQUETA_LINEA} no existe",
            )

        if (linea.IdTipoBobina, linea.IdTipoBobinaServilleta) == (
            data.IdTipoBobina,
            data.IdTipoBobinaServilleta,
        ):
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No hay cambios para guardar",
            )

        self._ValidarSinProduccion(linea, "cambiar su materia prima")
        if linea.IdTipoBobina is not None and linea.IdTipoBobina != data.IdTipoBobina:
            self._ValidarNoEsUnicoDelTipo(linea, "cambiar su materia prima")

        origen_anterior = self._NombreOrigen(linea)
        id_tipo_bobina, id_tipo_servilleta, origen = self._ValidarOrigen(data)

        linea.IdTipoBobina = id_tipo_bobina
        linea.IdTipoBobinaServilleta = id_tipo_servilleta
        self.repository.Guardar(
            (
                f"Editar línea de producto · #{linea.IdProducto} {linea.NombreProducto}: "
                f"materia prima: {origen_anterior} → {origen}"
            ),
            id_admin,
            "No se pudo editar la línea de producto",
        )
        return self.ObtenerLinea(data.IdProducto)

    def CambiarEstadoLinea(self, data: CambiarEstadoTipoRequest, id_admin: int) -> CambiarEstadoTipoResponse:
        return cambiar_estado(
            self.repository,
            data,
            id_admin,
            ETIQUETA_LINEA,
            "NombreProducto",
            self._ValidarDesactivacion,
            femenino=True,
        )

    def CrearPresentacion(self, data: CrearPresentacionRequest, id_admin: int) -> LineaProductoAdminItem:
        linea = self.repository.ObtenerTipoBloqueado(data.IdProducto)
        if linea is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"La {ETIQUETA_LINEA} no existe",
            )
        if not linea.Activo:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"La línea {linea.NombreProducto} está inactiva; actívala antes de agregar presentaciones",
            )

        existentes = self.repository.ListarPresentaciones([linea.IdProducto]).get(linea.IdProducto, [])
        try:
            presentacion = preparar_presentaciones([data], linea.SiglasProducto, existentes)[0]
            self._ValidarCodigosLibres([presentacion])
        except HTTPException:
            self.repository.Revertir()
            raise

        self.repository.CrearPresentacion(
            linea.IdProducto,
            presentacion,
            lambda p: (
                f"Crear presentación · #{p.IdPresentacion} de {linea.NombreProducto} "
                f"{texto_presentacion(presentacion)}"
            ),
            id_admin,
        )
        return self.ObtenerLinea(data.IdProducto)

    def CambiarEstadoPresentacion(
        self, data: CambiarEstadoTipoRequest, id_admin: int
    ) -> CambiarEstadoTipoResponse:
        return cambiar_estado(
            self.presentaciones,
            data,
            id_admin,
            ETIQUETA_PRESENTACION,
            "CodigoPresentacion",
            femenino=True,
        )

    def _Presentacion(self, presentacion: dict, stock: dict | None) -> PresentacionAdminItem:
        return PresentacionAdminItem(
            **presentacion,
            CantidadActual=stock["CantidadActual"] if stock else 0,
            StockMinimo=stock["StockMinimo"] if stock else None,
            StockPreventivo=stock["StockPreventivo"] if stock else None,
            NivelStock=stock["NivelStock"] if stock else None,
        )

    def _ValidarCodigosLibres(self, presentaciones: list[dict]) -> None:
        en_uso = self.repository.CodigosEnUso([p["CodigoPresentacion"] for p in presentaciones])
        if en_uso:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Los códigos ya están registrados: {', '.join(en_uso)}",
            )

    def _ValidarOrigen(self, data: OrigenLineaRequest) -> tuple[int | None, int | None, str]:
        if data.IdTipoBobina is not None and data.IdTipoBobinaServilleta is not None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Una línea se asocia a un tipo de bobina papel o a uno de bobina servilleta, no a ambos",
            )

        if data.IdTipoBobina is not None:
            tipo = self.repository.ObtenerTipoOrigenBloqueado(
                TipoBobina, TipoBobina.IdTipoBobina, data.IdTipoBobina
            )
            self._ValidarTipoOrigen(tipo, "bobina papel")
            return data.IdTipoBobina, None, f"bobina papel {tipo.NombreTipoBobina}"

        if data.IdTipoBobinaServilleta is not None:
            tipo = self.repository.ObtenerTipoOrigenBloqueado(
                TipoBobinaServilleta,
                TipoBobinaServilleta.IdTipoBobinaServilleta,
                data.IdTipoBobinaServilleta,
            )
            self._ValidarTipoOrigen(tipo, "bobina servilleta")
            return None, data.IdTipoBobinaServilleta, f"bobina servilleta {tipo.NombreTipoBobinaServilleta}"

        return None, None, SIN_MATERIA_PRIMA

    def _ValidarTipoOrigen(self, tipo, etiqueta: str) -> None:
        if tipo is None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El tipo de {etiqueta} no existe",
            )
        if not tipo.Activo:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El tipo de {etiqueta} está inactivo",
            )

    def _NombreOrigen(self, linea: Producto) -> str:
        fila = self.repository.ListarLineas(linea.IdProducto)[0]
        if fila["NombreTipoBobina"] is not None:
            return f"bobina papel {fila['NombreTipoBobina']}"
        if fila["NombreTipoBobinaServilleta"] is not None:
            return f"bobina servilleta {fila['NombreTipoBobinaServilleta']}"
        return SIN_MATERIA_PRIMA

    def _ValidarSinProduccion(self, linea: Producto, accion: str) -> None:
        if self.repository.ProductosEnProduccion([linea.IdProducto]):
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"No se puede {accion}: {linea.NombreProducto} tiene una producción en curso o en pausa"
                ),
            )

    def _ValidarNoEsUnicoDelTipo(self, linea: Producto, accion: str) -> None:
        tipo = self.repository.UnicoProductoActivoDeTipo(linea)
        if tipo is not None:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"No se puede {accion}: {linea.NombreProducto} es el único producto activo del tipo "
                    f"de bobina papel {tipo}. Asocia o activa otro producto de ese tipo primero"
                ),
            )

    def _ValidarDesactivacion(self, linea: Producto, activo: bool) -> None:
        if activo:
            return
        self._ValidarSinProduccion(linea, "desactivar la línea")
        self._ValidarNoEsUnicoDelTipo(linea, "desactivar la línea")
