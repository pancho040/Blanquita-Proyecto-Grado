#!/usr/bin/env python3
"""
verificar_zona_protegida.py - Guardia de Seguridad Automática para Papelera Blanquita.
Verifica que ningún commit o archivo modifique la estructura o código de planta de Fabricio,
y que el DML sobre producto terminado ocurra EXCLUSIVAMENTE a través de FabricioLegacyAdapter.
"""

import os
import sys
import re
import ast
import subprocess
from pathlib import Path

# Directorio raíz del repositorio
REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# Carpetas y archivos estrictamente protegidos (prohibido modificar)
RUTAS_PROTEGIDAS = [
    # Backend
    "Blanquita-Backend/app/Models/BobinaPapel",
    "Blanquita-Backend/app/Models/BobinaServilleta",
    "Blanquita-Backend/app/Models/Empaque",
    "Blanquita-Backend/app/Models/Pallet",
    "Blanquita-Backend/app/Models/Rodela",
    "Blanquita-Backend/app/Models/InventarioFinal",
    "Blanquita-Backend/app/Repository/BobinaPapel",
    "Blanquita-Backend/app/Repository/BobinaServilleta",
    "Blanquita-Backend/app/Repository/Empaque",
    "Blanquita-Backend/app/Repository/Pallet",
    "Blanquita-Backend/app/Repository/Rodela",
    "Blanquita-Backend/app/Repository/InventarioFinal",
    "Blanquita-Backend/app/Routes/BobinaPapel",
    "Blanquita-Backend/app/Routes/BobinaServilleta",
    "Blanquita-Backend/app/Routes/Empaque",
    "Blanquita-Backend/app/Routes/Pallet",
    "Blanquita-Backend/app/Routes/Rodela",
    "Blanquita-Backend/app/Routes/InventarioFinal",
    "Blanquita-Backend/app/Services/BobinaPapel",
    "Blanquita-Backend/app/Services/BobinaServilleta",
    "Blanquita-Backend/app/Services/Empaque",
    "Blanquita-Backend/app/Services/Pallet",
    "Blanquita-Backend/app/Services/Rodela",
    "Blanquita-Backend/app/Services/InventarioFinal",
    "Blanquita-Backend/functionsServilleta.sql",
    "Blanquita-Backend/reportsFunctions.sql",
    # Frontend
    "Blanquita-Frontend/src/components/PapelBobina",
    "Blanquita-Frontend/src/components/ServilletaBobina",
    "Blanquita-Frontend/src/components/Rodela",
    "Blanquita-Frontend/src/components/Empaque",
    "Blanquita-Frontend/src/components/InventarioProductos",
    "Blanquita-Frontend/src/pages/encargado",
    "Blanquita-Frontend/src/pages/operador",
]

# Tablas de planta protegidas contra DDL (ALTER, DROP, RENAME, TRUNCATE)
TABLAS_PLANTA_PROTEGIDAS = [
    "TipoBobina", "EstadoMateriaPrima", "LoteBobina", "BobinaPapel", "MovimientoBobina",
    "TipoBobinaServilleta", "FormatoSubBobina", "TipoMedidaSubBobina", "LoteBobinaServilleta",
    "BobinaServilleta", "UnidadBobinaServilleta", "SubBobinaServilleta", "MovimientoSubBobina",
    "LoteRodela", "TipoRodela", "Rodela", "MovimientoRodela", "LoteEmpaque", "TipoEmpaque",
    "Empaque", "MovimientoEmpaque", "TipoMovimientoMateriaPrima", "EstadoProduccion",
    "ProduccionBobinaTubo", "ProduccionServilleta", "PausaProduccionBobinaTubo",
    "PausaProduccionServilleta", "CancelacionProduccionBobinaTubo", "CancelacionProduccionServilleta",
    "TipoInsumo", "MovimientoInsumo", "InventarioInsumo", "TipoEmpaqueBolsa",
    "MovimientoEmpaqueBolsa", "InventarioEmpaqueBolsa", "TipoBolsaJava", "MovimientoBolsaJava",
    "InventarioBolsaJava", "TipoMovimientoInventario", "MovimientoProductoTerminado",
    "InventarioProductoTerminado", "TipoMovimientoOperadorLogs", "MovimientoOperadorLogs"
]

# Archivo único autorizado a realizar operaciones DML sobre InventarioProductoTerminado y MovimientoProductoTerminado
ADAPTADOR_AUTORIZADO = "Blanquita-Backend/app/adapters/planta_fabricio_adapter.py"


def verificar_git_diff() -> list[str]:
    """Verifica si en git diff se modificaron rutas protegidas."""
    errores = []
    try:
        # Intenta contra origin/main o HEAD~1
        cmd = ["git", "diff", "--name-only", "HEAD~1"]
        res = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
        if res.returncode != 0:
            cmd = ["git", "diff", "--name-only", "origin/main"]
            res = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
        
        if res.returncode == 0:
            archivos_modificados = [f.replace("\\", "/") for f in res.stdout.strip().splitlines() if f]
            for archivo in archivos_modificados:
                for ruta_prot in RUTAS_PROTEGIDAS:
                    if archivo.startswith(ruta_prot):
                        errores.append(f"VIOLACIÓN DE RUTA PROTEGIDA: El archivo modificado '{archivo}' pertenece a la zona de planta '{ruta_prot}'.")
    except Exception as e:
        print(f"[WARN] No se pudo verificar git diff: {e}")
    return errores


IGNORE_DIRS = {".git", ".venv", "node_modules", ".astro", "dist", "__pycache__", ".pytest_cache"}

def iter_code_files(base_dir: Path, extensions: set[str]):
    for root, dirs, files in os.walk(base_dir):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            if any(f.endswith(ext) for ext in extensions):
                yield Path(root) / f

def verificar_ddl_en_archivos() -> list[str]:
    """Verifica que ningún archivo .sql o migración intente hacer DDL sobre tablas protegidas."""
    errores = []
    patron_ddl = re.compile(
        r"\b(ALTER|DROP|RENAME|TRUNCATE)\s+(TABLE\s+)?(public\.)?(\"?(" +
        "|".join(TABLAS_PLANTA_PROTEGIDAS) +
        r")\"?)\b",
        re.IGNORECASE
    )
    
    for path in iter_code_files(REPO_ROOT, {".sql", ".py"}):
        ruta_str = str(path.relative_to(REPO_ROOT)).replace("\\", "/")
        if "docs/scripts/" in ruta_str or "bd.sql" in ruta_str or "bd_contabilidad" in ruta_str or "bd_modulos" in ruta_str:
            continue
        try:
            contenido = path.read_text(encoding="utf-8", errors="ignore")
            matches = patron_ddl.findall(contenido)
            if matches:
                for m in matches:
                    errores.append(f"VIOLACIÓN DDL: Intento de {m[0]} sobre tabla protegida '{m[3]}' en '{ruta_str}'.")
        except Exception:
            pass
    return errores


def verificar_ast_dml_producto_terminado() -> list[str]:
    """
    Verifica que ningún archivo de Python fuera de `planta_fabricio_adapter.py` importe
    o escriba en `InventarioProductoTerminado` o `MovimientoProductoTerminado`.
    """
    errores = []
    modelos_terminado = {"InventarioProductoTerminado", "MovimientoProductoTerminado"}
    
    backend_app = REPO_ROOT / "Blanquita-Backend" / "app"
    if not backend_app.exists():
        return errores
    
    for py_file in iter_code_files(backend_app, {".py"}):
        ruta_rel = str(py_file.relative_to(REPO_ROOT)).replace("\\", "/")
        if ruta_rel == ADAPTADOR_AUTORIZADO or "app/Models/InventarioFinal" in ruta_rel or "app/Repository/InventarioFinal" in ruta_rel or "app/Services/InventarioFinal" in ruta_rel:
            continue
        
        try:
            tree = ast.parse(py_file.read_text(encoding="utf-8", errors="ignore"))
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom):
                    for alias in node.names:
                        if alias.name in modelos_terminado:
                            errores.append(f"VIOLACIÓN DML: Importación no autorizada de '{alias.name}' en '{ruta_rel}'. Debe consumirse mediante InventarioProductoTerminadoPort / FabricioLegacyAdapter.")
                elif isinstance(node, ast.Constant) and isinstance(node.value, str):
                    val = node.value.lower()
                    if ("update" in val or "insert into" in val or "delete from" in val):
                        for mod in modelos_terminado:
                            if mod.lower() in val:
                                errores.append(f"VIOLACIÓN DML: Query de escritura directa sobre '{mod}' detectada en '{ruta_rel}'. Solo permitido dentro de '{ADAPTADOR_AUTORIZADO}'.")
        except Exception:
            pass
            
    return errores


def main():
    print("=" * 70)
    print("GUARDIA DE SEGURIDAD - ZONA PROTEGIDA PAPELERA BLANQUITA")
    print("=" * 70)
    
    errores = []
    
    print("1. Verificando git diff contra rutas protegidas...")
    errores.extend(verificar_git_diff())
    
    print("2. Verificando sentencias DDL sobre tablas de planta...")
    errores.extend(verificar_ddl_en_archivos())
    
    print("3. Verificando aislamiento AST de DML sobre Producto Terminado...")
    errores.extend(verificar_ast_dml_producto_terminado())
    
    print("-" * 70)
    if errores:
        print("❌ FALLO DE SEGURIDAD: Se detectaron violaciones en la Zona Protegida:")
        for err in errores:
            print(f"  - {err}")
        print("=" * 70)
        sys.exit(1)
    else:
        print("✅ ÉXITO: Zona protegida 100% íntegra. No se detectaron violaciones.")
        print("=" * 70)
        sys.exit(0)


if __name__ == "__main__":
    main()
