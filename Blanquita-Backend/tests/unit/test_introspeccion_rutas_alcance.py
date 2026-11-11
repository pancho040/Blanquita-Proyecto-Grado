import pytest
from fastapi.routing import APIRoute
from app.main import app
from app.Auth.AlcanceSucursal import DependenciaAlcanceSucursal

def tiene_dependencia_alcance(dependant) -> bool:
    if dependant.call == DependenciaAlcanceSucursal:
        return True
    for sub in getattr(dependant, "dependencies", []):
        if tiene_dependencia_alcance(sub):
            return True
    return False

def aplanar_rutas_app(app_obj):
    todas = []
    for r in app_obj.routes:
        if isinstance(r, APIRoute):
            todas.append(("", r))
        elif hasattr(r, "original_router"):
            prefix = getattr(r.include_context, "prefix", "") or ""
            for sub_r in r.original_router.routes:
                if isinstance(sub_r, APIRoute):
                    full_path = (prefix + sub_r.path).rstrip("/") or "/"
                    todas.append((full_path, sub_r))
    return todas

def normalizar_path(path: str) -> str:
    p = path.lower().strip()
    while p.startswith("/api") or p.startswith("/contabilidad"):
        if p.startswith("/api"):
            p = p[4:]
        elif p.startswith("/contabilidad"):
            p = p[13:]
    p = p.rstrip("/")
    return p or "/"

# Módulos globales por diseño clasificados como Categoría (b)
MODULOS_GLOBALES_CATEGORIA_B = {
    "auth",
    "usuario",
    "bobinapapel",
    "bobinaservilleta",
    "papelbobina",
    "rodela",
    "empaquebobina",
    "empaquebolsa",
    "productofinal",
    "proveedor",
    "cxp",
    "distribuidores",
    "plantas",
    "scan",
    "sucursales",
    "importacion",
    "importar",
    "movil"
}

# Rutas puntuales permitidas como categoría (b) dentro de módulos transaccionales
RUTAS_EXCEPCION_CATEGORIA_B = {
    # Raíz y Monitoreo
    "/",
    "/health",
    # Catálogos bancarios y conceptos centrales a nivel empresa
    "/tesoreria/bancos",
    "/tesoreria/bancos/simple",
    "/tesoreria/bancos/{id_cuenta}",
    "/tesoreria/caja/categorias",
    "/tesoreria/categorias-caja",
    # App móvil chofer y telemetría de campo (aislado por token JWT y asignación)
    "/logistica/chofer/mi-ruta-activa",
    "/logistica/chofer/entregar",
    "/logistica/chofer/cobrar",
    "/logistica/chofer/sincronizar-batch",
    "/logistica/chofer/resumen-turno/{id_asignacion}",
    "/logistica/telemetria/ping",
    "/logistica/telemetria/asignacion/{id_asignacion}",
    "/logistica/telemetria/entrega",
    "/logistica/telemetria/cobro",
    # Turnos base, configuración laboral y periodos de nómina
    "/rrhh/turnos",
    "/rrhh/turnos/{id_turno}",
    "/rrhh/configuracion",
    "/rrhh/configuracion/{id_config}",
    "/rrhh/periodos",
    "/rrhh/asistencia/{id_asistencia}",
    "/rrhh/asistencia/marca-manual",
    "/rrhh/biometrico/importar",
    "/rrhh/biometrico/marcas",
    "/rrhh/planillas/detalle/{id_detalle}",
    "/rrhh/planillas/{id_planilla}/aprobar",
    # Reportes y Gerencia: Planta monoplanta Sucre, bancos y firmas
    "/reportes/contabilidad/cuentas-pagar",
    "/gerencia/firmar-documento",
    "/gerencia/firmas-historial",
    "/gerencia/bancos-referenciales",
    "/gerencia/bancos-referenciales/{id_cuenta}/conciliar",
    "/gerencia/reporte-consolidado-planta",
}

def clasificar_ruta(path: str) -> str:
    norm = normalizar_path(path)
    if norm in RUTAS_EXCEPCION_CATEGORIA_B:
        return "b"
    partes = norm.strip("/").split("/")
    primer_segmento = partes[0] if partes else ""
    if primer_segmento in MODULOS_GLOBALES_CATEGORIA_B:
        return "b"
    return "a"

def test_todos_los_endpoints_clasificados_como_a_tienen_alcance():
    """
    Verifica que todos los endpoints operativos y transaccionales
    que requieren aislamiento por sucursal cuenten efectivamente con DependenciaAlcanceSucursal.
    """
    rutas = aplanar_rutas_app(app)
    rutas_a_sin_alcance = []

    for path, route in rutas:
        methods = route.methods - {"HEAD", "OPTIONS"}
        if not methods:
            continue

        categoria = clasificar_ruta(path)
        if categoria == "a":
            tiene = tiene_dependencia_alcance(route.dependant)
            if not tiene:
                rutas_a_sin_alcance.append(f"{methods} {path} -> {route.endpoint.__name__}")

    assert len(rutas_a_sin_alcance) == 0, (
        f"Se encontraron endpoints de categoría (a) SIN DependenciaAlcanceSucursal:\n"
        + "\n".join(rutas_a_sin_alcance)
    )

def test_cobertura_total_y_falla_si_endpoint_nuevo_sin_clasificar():
    """
    Falla si se agrega un nuevo endpoint a la aplicación que no esté clasificado
    ni en categoría (a) con su dependencia, ni en categoría (b) explícitamente documentada.
    """
    rutas = aplanar_rutas_app(app)
    endpoints_no_clasificados = []

    for path, route in rutas:
        methods = route.methods - {"HEAD", "OPTIONS"}
        if not methods:
            continue

        tiene_alcance = tiene_dependencia_alcance(route.dependant)
        categoria = clasificar_ruta(path)

        if categoria == "a" and not tiene_alcance:
            endpoints_no_clasificados.append(f"{methods} {path} -> {route.endpoint.__name__}")

    assert len(endpoints_no_clasificados) == 0, (
        f"Se agregaron endpoints nuevos sin clasificación de sucursal:\n"
        + "\n".join(endpoints_no_clasificados)
    )

def test_rbac_endpoints_globales_rechaza_chofer(client_chofer):
    """
    Confirma el RBAC estricto de los endpoints globales clasificados como (c):
    - /cxp/proveedores: Prohibido a Chofer (403 Forbidden)
    - /tesoreria/bancos: Prohibido a Chofer (403 Forbidden)
    - /rrhh/turnos: Prohibido a Chofer (403 Forbidden)
    - /gerencia/bancos-referenciales: Prohibido a Chofer (403 Forbidden)
    """
    endpoints_globales = [
        "/cxp/proveedores",
        "/tesoreria/bancos",
        "/rrhh/turnos",
        "/gerencia/bancos-referenciales"
    ]
    for ep in endpoints_globales:
        res = client_chofer.get(ep)
        assert res.status_code == 403, (
            f"El endpoint global {ep} debe rechazar a chofer con 403 Forbidden. "
            f"Obtenido: {res.status_code}"
        )

def test_rbac_endpoints_globales_permite_administrativo(client_admin):
    """
    Confirma que los endpoints globales clasificados como (c) permiten acceso
    a los roles administrativos correspondientes (Gerente General / Contador).
    """
    endpoints_globales = [
        "/cxp/proveedores",
        "/tesoreria/bancos",
        "/rrhh/turnos",
        "/gerencia/bancos-referenciales"
    ]
    for ep in endpoints_globales:
        res = client_admin.get(ep)
        assert res.status_code in (200, 404), (
            f"El endpoint global {ep} debe permitir acceso al rol administrativo. "
            f"Obtenido: {res.status_code}"
        )

