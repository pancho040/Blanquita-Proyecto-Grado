from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Models.Empaque.Reporte import ClaseEmpaque
from app.Models.Empaque.TipoEmpaque import (
    CrearTipoEmpaqueRequest,
    EditarTipoEmpaqueRequest,
    TipoEmpaqueAdminItem,
)
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CambiarEstadoTipoRequest,
    CambiarEstadoTipoResponse,
)
from app.Repository.Empaque.TipoEmpaque import TipoEmpaqueRepository
from app.Services.AlertaStock.AlertaStock import mostrar_umbral, validar_umbral_stock
from app.Services.MateriaPrima.TipoMateriaPrima import (
    cambiar_estado,
    limpiar,
    mostrar,
    validar_descripcion,
    validar_nombre,
)

ETIQUETAS = {
    ClaseEmpaque.bobina: "tipo de empaque en bobina",
    ClaseEmpaque.bolsa: "tipo de empaque en bolsa",
    ClaseEmpaque.jaba: "tipo de bolsa de jaba",
}


class TipoEmpaqueService:
    def __init__(self, db: Session, clase: ClaseEmpaque):
        self.clase = clase
        self.etiqueta = ETIQUETAS[clase]
        self.repository = TipoEmpaqueRepository(db, clase)
        self.con_descripcion = self.repository.clase["descripcion"] is not None
        self.con_inventario = self.repository.clase["inventario"] is not None

    def ListarTipos(self, id_tipo: int | None = None) -> list[TipoEmpaqueAdminItem]:
        return [TipoEmpaqueAdminItem(**fila) for fila in self.repository.ListarTipos(id_tipo)]

    def ObtenerTipo(self, id_tipo: int) -> TipoEmpaqueAdminItem:
        tipos = self.ListarTipos(id_tipo)
        if not tipos:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El {self.etiqueta} no existe",
            )
        return tipos[0]

    def CrearTipo(self, data: CrearTipoEmpaqueRequest, id_admin: int) -> TipoEmpaqueAdminItem:
        nombre = validar_nombre(self.repository, data.Nombre, self.etiqueta)
        descripcion = validar_descripcion(data.Descripcion) if self.con_descripcion else None
        validar_umbral_stock(data.StockMinimo, data.StockPreventivo)

        valores = {self.repository.clase["nombre"].key: nombre, "Activo": True}
        if self.con_descripcion:
            valores[self.repository.clase["descripcion"].key] = descripcion
        if not self.con_inventario:
            valores["StockMinimo"] = data.StockMinimo
            valores["StockPreventivo"] = data.StockPreventivo

        def inventario(tipo) -> list:
            if not self.con_inventario:
                return []
            return [
                self.repository.NuevoInventario(
                    getattr(tipo, self.repository.clase["id"].key),
                    data.StockMinimo,
                    data.StockPreventivo,
                )
            ]

        texto_descripcion = f"descripción: {mostrar(descripcion)}, " if self.con_descripcion else ""
        creado = self.repository.CrearTipo(
            self.repository.modelo(**valores),
            inventario,
            lambda t: (
                f"Crear {self.etiqueta} · #{getattr(t, self.repository.clase['id'].key)} {nombre} "
                f"({texto_descripcion}stock: {mostrar_umbral(data.StockMinimo, data.StockPreventivo)})"
            ),
            id_admin,
            f"No se pudo crear el {self.etiqueta}",
        )
        return self.ObtenerTipo(getattr(creado, self.repository.clase["id"].key))

    def EditarTipo(self, data: EditarTipoEmpaqueRequest, id_admin: int) -> TipoEmpaqueAdminItem:
        validar_umbral_stock(data.StockMinimo, data.StockPreventivo)

        tipo = self.repository.ObtenerTipoBloqueado(data.Id)
        inventario = self.repository.ObtenerInventarioBloqueado(data.Id) if tipo else None
        if tipo is None or (self.con_inventario and inventario is None):
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El {self.etiqueta} no existe",
            )

        nombre = getattr(tipo, self.repository.clase["nombre"].key)
        detalle = []

        if self.con_descripcion:
            campo = self.repository.clase["descripcion"].key
            anterior = getattr(tipo, campo)
            descripcion = limpiar(data.Descripcion)
            if descripcion != limpiar(anterior):
                descripcion = validar_descripcion(descripcion)
                detalle.append(f"descripción: {mostrar(anterior)} → {mostrar(descripcion)}")
                setattr(tipo, campo, descripcion)

        destino_stock = inventario if self.con_inventario else tipo
        stock_anterior = (destino_stock.StockMinimo, destino_stock.StockPreventivo)
        stock_nuevo = (data.StockMinimo, data.StockPreventivo)
        if stock_anterior != stock_nuevo:
            detalle.append(f"stock: {mostrar_umbral(*stock_anterior)} → {mostrar_umbral(*stock_nuevo)}")
            destino_stock.StockMinimo, destino_stock.StockPreventivo = stock_nuevo

        if not detalle:
            self.repository.Revertir()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No hay cambios para guardar",
            )

        self.repository.Guardar(
            f"Editar {self.etiqueta} · #{data.Id} {nombre}: {'; '.join(detalle)}",
            id_admin,
            f"No se pudo editar el {self.etiqueta}",
        )
        return self.ObtenerTipo(data.Id)

    def CambiarEstado(self, data: CambiarEstadoTipoRequest, id_admin: int) -> CambiarEstadoTipoResponse:
        return cambiar_estado(
            self.repository, data, id_admin, self.etiqueta, self.repository.clase["nombre"].key
        )
