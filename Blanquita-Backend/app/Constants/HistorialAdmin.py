MODULO_USUARIOS = "Usuarios"
MODULO_PROVEEDORES = "Proveedores"
MODULO_INSUMOS = "Insumos"
MODULO_STOCK = "Stock"
MODULO_OTROS = "Otros"

PREFIJOS_MODULO_HISTORIAL_ADMIN = {
    MODULO_USUARIOS: (
        "Crear usuario ·",
        "Editar usuario ·",
        "Restablecer clave ·",
        "Cambio de estado · Usuario",
    ),
    MODULO_PROVEEDORES: (
        "Crear proveedor ·",
        "Editar proveedor ·",
        "Cambio de estado · Proveedor",
    ),
    MODULO_INSUMOS: (
        "Crear insumo ·",
        "Editar insumo ·",
    ),
    MODULO_STOCK: (
        "Umbral de stock ·",
    ),
}

MODULOS_HISTORIAL_ADMIN = (*PREFIJOS_MODULO_HISTORIAL_ADMIN, MODULO_OTROS)

SEPARADOR_ACCION = " · "

LONGITUD_MAXIMA_BUSQUEDA_HISTORIAL_ADMIN = 50
