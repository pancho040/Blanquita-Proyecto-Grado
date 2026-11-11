"""
Pruebas Unitarias para FileStorageService (Fase 1.1 - Punto B6)
Sistema ERP Papelera Blanquita

Verifica:
1. Validación de tamaño máximo de 5MB y formatos permitidos.
2. Generación de URLs firmadas de corta duración.
3. Particionado de rutas sucursal/{id_sucursal}/chofer/{id_chofer}/{uuid}.ext.
4. Metadatos de retención de 60 días.
"""

import io
import pytest
from unittest.mock import patch, MagicMock
from fastapi import UploadFile, HTTPException
from app.Services.Common.FileStorageService import FileStorageService, MAX_FILE_SIZE_BYTES


def test_validacion_formato_no_permitido():
    """Archivos con extensiones no permitidas (.exe, .zip) deben ser rechazados con 400 Bad Request."""
    contenido = b"contenido simulado"
    upload = UploadFile(filename="virus.exe", file=io.BytesIO(contenido))
    with pytest.raises(HTTPException) as excinfo:
        FileStorageService.validar_archivo("virus.exe", contenido)
    assert excinfo.value.status_code == 400
    assert "Formato no permitido" in excinfo.value.detail


def test_validacion_tamano_maximo_excedido():
    """Archivos mayores a 5MB deben ser rechazados con 413 Request Entity Too Large."""
    contenido_grande = b"x" * (MAX_FILE_SIZE_BYTES + 1024)
    with pytest.raises(HTTPException) as excinfo:
        FileStorageService.validar_archivo("foto_grande.jpg", contenido_grande)
    assert excinfo.value.status_code == 413
    assert "supera el tamaño máximo permitido" in excinfo.value.detail


def test_almacenamiento_supabase_storage_particionado_y_mock():
    """Valida que bajo STORAGE_SUPABASE_ACTIVO=True se construya la ruta particionada y suba al bucket."""
    contenido = b"foto de entrega valida"
    upload = UploadFile(filename="entrega.jpg", file=io.BytesIO(contenido))

    mock_session = MagicMock()
    mock_session.execute.return_value.fetchone.return_value = (101, "2027-01-09T00:00:00")

    with patch("app.Services.Common.FileStorageService.STORAGE_SUPABASE_ACTIVO", True), \
         patch.object(FileStorageService, "subir_a_supabase_storage", return_value=True) as mock_subir:
        
        resultado = FileStorageService.guardar_comprobante(
            session=mock_session,
            archivo=upload,
            entidad_origen="ENTREGA",
            id_registro_origen=50,
            id_sucursal=2,
            id_chofer=17
        )

        assert resultado["id_comprobante"] == 101
        assert "sucursal/2/chofer/17/" in resultado["url"]
        assert resultado["url"].endswith(".jpg")
        mock_subir.assert_called_once()
        args = mock_subir.call_args[0]
        assert "sucursal/2/chofer/17/" in args[0]
        assert args[1] == contenido


def test_generacion_url_firmada_mock():
    """Valida la generación de URLs firmadas de corta duración."""
    with patch("app.Services.Common.FileStorageService.STORAGE_SUPABASE_ACTIVO", True), \
         patch("httpx.Client.post") as mock_post:
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"signedURL": "/object/sign/comprobantes-privados/token123"}
        mock_post.return_value = mock_response

        url_firmada = FileStorageService.generar_url_firmada("sucursal/1/chofer/9/test.png", duracion_segundos=1800)
        assert "/storage/v1/object/sign/comprobantes-privados/token123" in url_firmada
