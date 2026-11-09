import pytest
from pathlib import Path
import sys

# Asegurar import de verificar_zona_protegida
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "docs" / "scripts"))

from verificar_zona_protegida import (
    verificar_ddl_en_archivos,
    verificar_ast_dml_producto_terminado,
    verificar_git_diff
)


def test_guardia_zona_protegida_ddl():
    """Verifica que ningún archivo del proyecto ejecute DDL sobre tablas de planta de Fabricio."""
    errores = verificar_ddl_en_archivos()
    assert len(errores) == 0, f"Se detectaron violaciones DDL: {errores}"


def test_guardia_zona_protegida_ast_dml():
    """Verifica que ningún archivo fuera del adaptador oficial importe o ejecute DML sobre producto terminado."""
    errores = verificar_ast_dml_producto_terminado()
    assert len(errores) == 0, f"Se detectaron violaciones DML de producto terminado: {errores}"
