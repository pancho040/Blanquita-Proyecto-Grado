"""
Pruebas Unitarias de Alcance de Sucursal y Autorización Multisede (Fase 1)
Sistema Integral ERP Papelera Blanquita

Verifica los tres perfiles:
1. Multisede (Gerencia General / Admin con puede_ver_todas = True)
2. Dos sucursales asignadas (puede alternar entre 1 y 2, no consolidado)
3. Sede fija (Sucre: id_sucursal = 1, bloqueo estricto 403 ante Potosí e IDOR)
"""

import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException
from app.Auth.AlcanceSucursal import (
    AlcanceUsuario,
    resolver_alcance_usuario,
    obtener_caja_para_alcance,
)

class TestAlcanceSucursal:

    # =========================================================================
    # PERFIL 1: MULTISEDE (puede_ver_todas = True)
    # =========================================================================
    def test_perfil_multisede_sin_parametro_autoriza_consolidado(self):
        """Usuario con puede_ver_todas sin sucursal solicitada recibe sucursal_efectiva=None (consolidado)."""
        db_mock = MagicMock()
        # Mock de usuario_sucursal_permiso: fila con id_sucursal=None, puede_ver_todas=True
        db_mock.execute.return_value.fetchall.return_value = [
            (None, True, True),
            (1, False, True),
            (2, False, True),
        ]
        db_mock.execute.return_value.fetchone.return_value = (None, True, 3)

        alcance = resolver_alcance_usuario(id_usuario=12, db=db_mock, sucursal_solicitada=None)

        assert alcance.puede_ver_todas is True
        assert alcance.sucursal_efectiva is None # Consolidado
        assert 1 in alcance.sucursales_permitidas
        assert 2 in alcance.sucursales_permitidas

    def test_perfil_multisede_filtrando_por_sede_especifica(self):
        """Usuario multisede puede elegir ver solo Sucre o solo Potosí."""
        db_mock = MagicMock()
        db_mock.execute.return_value.fetchall.return_value = [
            (None, True, True),
            (1, False, True),
            (2, False, True),
        ]
        db_mock.execute.return_value.fetchone.return_value = (None, True, 3)

        alcance_sucre = resolver_alcance_usuario(id_usuario=12, db=db_mock, sucursal_solicitada=1)
        assert alcance_sucre.sucursal_efectiva == 1

        alcance_potosi = resolver_alcance_usuario(id_usuario=12, db=db_mock, sucursal_solicitada="2")
        assert alcance_potosi.sucursal_efectiva == 2

    def test_perfil_multisede_validar_recursos_e_idor(self):
        """Usuario multisede puede acceder a recursos de cualquier sede sin excepción."""
        alcance = AlcanceUsuario(
            id_usuario=12,
            puede_ver_todas=True,
            sucursales_permitidas=[1, 2],
            sucursal_efectiva=None,
            sucursal_asignada_defecto=None
        )
        # No debe lanzar excepción
        alcance.validar_recurso(id_sucursal_recurso=1, nombre_recurso="vale")
        alcance.validar_recurso(id_sucursal_recurso=2, nombre_recurso="vale")
        alcance.validar_envio(id_origen=1, id_destino=2)

    # =========================================================================
    # PERFIL 2: DOS SUCURSALES ASIGNADAS (sin permiso consolidado "todas")
    # =========================================================================
    def test_perfil_dos_sucursales_alternancia_permitida(self):
        """Usuario con sedes 1 y 2 pero puede_ver_todas=False."""
        db_mock = MagicMock()
        db_mock.execute.return_value.fetchall.return_value = [
            (1, False, True),
            (2, False, True),
        ]
        db_mock.execute.return_value.fetchone.return_value = (1, False, 5)

        # Puede alternar a 1 y a 2
        alc1 = resolver_alcance_usuario(id_usuario=4, db=db_mock, sucursal_solicitada=1)
        assert alc1.sucursal_efectiva == 1

        alc2 = resolver_alcance_usuario(id_usuario=4, db=db_mock, sucursal_solicitada=2)
        assert alc2.sucursal_efectiva == 2

    def test_perfil_dos_sucursales_sin_parametro_fuerza_defecto(self):
        """Si no envía parámetro y no puede_ver_todas, se fuerza su sucursal por defecto, no consolidado."""
        db_mock = MagicMock()
        db_mock.execute.return_value.fetchall.return_value = [
            (1, False, True),
            (2, False, True),
        ]
        db_mock.execute.return_value.fetchone.return_value = (1, False, 5)

        alc = resolver_alcance_usuario(id_usuario=4, db=db_mock, sucursal_solicitada=None)
        assert alc.sucursal_efectiva == 1 # Forzado seguro
        assert alc.puede_ver_todas is False

    def test_perfil_dos_sucursales_rechaza_sucursal_ajena(self):
        """Intento de acceder a sucursal 3 no asignada responde 403 Forbidden."""
        db_mock = MagicMock()
        db_mock.execute.return_value.fetchall.return_value = [
            (1, False, True),
            (2, False, True),
        ]
        db_mock.execute.return_value.fetchone.return_value = (1, False, 5)

        with pytest.raises(HTTPException) as exc:
            resolver_alcance_usuario(id_usuario=4, db=db_mock, sucursal_solicitada=3)
        assert exc.value.status_code == 403

    # =========================================================================
    # PERFIL 3: SEDE FIJA (Sucre: id_sucursal = 1)
    # =========================================================================
    def test_perfil_sede_fija_sin_parametro_fuerza_su_sede(self):
        """Un usuario de sede fija sin parámetro siempre recibe su propia sede (fallo seguro)."""
        db_mock = MagicMock()
        db_mock.execute.return_value.fetchall.return_value = [
            (1, False, True),
        ]
        db_mock.execute.return_value.fetchone.return_value = (1, False, 6)

        alc = resolver_alcance_usuario(id_usuario=9, db=db_mock, sucursal_solicitada=None)
        assert alc.sucursal_efectiva == 1
        assert alc.puede_ver_todas is False
        assert alc.sucursales_permitidas == [1]

    def test_perfil_sede_fija_solicitando_otra_sucursal_es_403(self):
        """Usuario de Sucre que intenta solicitar id_sucursal=2 (Potosí) recibe 403 Forbidden."""
        db_mock = MagicMock()
        db_mock.execute.return_value.fetchall.return_value = [
            (1, False, True),
        ]
        db_mock.execute.return_value.fetchone.return_value = (1, False, 6)

        with pytest.raises(HTTPException) as exc:
            resolver_alcance_usuario(id_usuario=9, db=db_mock, sucursal_solicitada=2)
        assert exc.value.status_code == 403
        assert "No tiene autorización" in exc.value.detail

    def test_perfil_sede_fija_idor_en_recurso_ajeno_es_403(self):
        """Validación por recurso (IDOR) lanza 403 si el registro pertenece a otra sede."""
        alcance = AlcanceUsuario(
            id_usuario=9,
            puede_ver_todas=False,
            sucursales_permitidas=[1],
            sucursal_efectiva=1,
            sucursal_asignada_defecto=1
        )
        # Recurso de su sede: permitido
        alcance.validar_recurso(id_sucursal_recurso=1, nombre_recurso="solicitud")

        # Recurso de Potosí (2): bloqueado con 403
        with pytest.raises(HTTPException) as exc:
            alcance.validar_recurso(id_sucursal_recurso=2, nombre_recurso="solicitud")
        assert exc.value.status_code == 403
        assert "fuera de su alcance autorizado" in exc.value.detail

    def test_perfil_sede_fija_envio_sin_su_sede_es_403(self):
        """Envíos que no involucren su sucursal ni como origen ni como destino son bloqueados."""
        alcance = AlcanceUsuario(
            id_usuario=9,
            puede_ver_todas=False,
            sucursales_permitidas=[1],
            sucursal_efectiva=1,
            sucursal_asignada_defecto=1
        )
        # Envío Sucre -> Potosí: permitido (Sucre es origen)
        alcance.validar_envio(id_origen=1, id_destino=2)

        # Envío Potosí -> Cochabamba (2 -> 3): bloqueado (no involucra a Sucre)
        with pytest.raises(HTTPException) as exc:
            alcance.validar_envio(id_origen=2, id_destino=3)
        assert exc.value.status_code == 403

    def test_fallo_cerrado_usuario_sin_permisos_ni_sucursal(self):
        """Fallo cerrado: si no existe en usuario_sucursal_permiso ni tiene IdSucursal, 403 Forbidden."""
        db_mock = MagicMock()
        db_mock.execute.return_value.fetchall.return_value = []
        db_mock.execute.return_value.fetchone.return_value = (None, False, 1) # Sin IdSucursal

        with pytest.raises(HTTPException) as exc:
            resolver_alcance_usuario(id_usuario=99, db=db_mock, sucursal_solicitada=None)
        assert exc.value.status_code == 403

    # =========================================================================
    # CAJAS: RESOLUCIÓN DINÁMICA POR SUCURSAL
    # =========================================================================
    def test_obtener_caja_dinamica_segun_alcance(self):
        """Caja se resuelve según la sucursal del alcance, eliminando id_caja=1 hardcodeado."""
        db_mock = MagicMock()
        db_mock.execute.return_value.mappings.return_value.fetchone.return_value = {
            "IdCaja": 2,
            "NombreCaja": "Caja Sucursal Potosí",
            "Descripcion": "Caja de Potosí",
            "Activa": True,
            "IdSucursal": 2
        }

        alcance_potosi = AlcanceUsuario(
            id_usuario=12,
            puede_ver_todas=True,
            sucursales_permitidas=[1, 2],
            sucursal_efectiva=2,
            sucursal_asignada_defecto=1
        )

        caja = obtener_caja_para_alcance(db=db_mock, alcance=alcance_potosi)
        assert caja["IdCaja"] == 2
        assert caja["IdSucursal"] == 2

    # =========================================================================
    # VERIFICACIÓN DE REGLAS DE SEGURIDAD (IS_ADMIN NO DA ACCESO Y USUARIOS TEST)
    # =========================================================================
    def test_is_admin_true_sin_permiso_multisede_no_puede_acceder_a_otra_sede(self):
        """
        Regla de Oro: IsAdmin = True NO otorga alcance multisede.
        Si usuario_sucursal_permiso solo tiene sede 1, intentar sede 2 arroja 403 Forbidden.
        """
        db_mock = MagicMock()
        # Usuario es Administrador (IsAdmin=True) pero su permiso solo tiene sucursal 1 y puede_ver_todas=False
        db_mock.execute.return_value.fetchall.return_value = [
            (1, False, True), # Solo Sucre, puede_ver_todas = False
        ]
        db_mock.execute.return_value.fetchone.return_value = (1,) # IdSucursal = 1

        # Si pide sucursal 1 -> Permitido
        alcance_sucre = resolver_alcance_usuario(id_usuario=5, db=db_mock, sucursal_solicitada=1)
        assert alcance_sucre.sucursal_efectiva == 1
        assert alcance_sucre.puede_ver_todas is False

        # Si pide sucursal 2 -> 403 Forbidden estricto
        with pytest.raises(HTTPException) as exc:
            resolver_alcance_usuario(id_usuario=5, db=db_mock, sucursal_solicitada=2)
        assert exc.value.status_code == 403
        assert "No tiene autorización para acceder a los datos de la sucursal 2" in exc.value.detail

    def test_usuarios_de_prueba_entorno_fixtures(self, user_prueba_sucre, user_prueba_potosi, user_prueba_multisede):
        """Verifica que los fixtures de prueba representen exactamente los tres perfiles requeridos."""
        assert user_prueba_sucre["IdSucursal"] == 1
        assert user_prueba_sucre["IsAdmin"] is False

        assert user_prueba_potosi["IdSucursal"] == 2
        assert user_prueba_potosi["IsAdmin"] is False

        assert user_prueba_multisede["IdRol"] == 3
        assert user_prueba_multisede["IsAdmin"] is True

    # =========================================================================
    # REGLA DE ORO DE ESCRITURAS (VALIDACIÓN ESTRICTA EN BACKEND)
    # =========================================================================
    def test_escritura_multisede_sin_sucursal_arroja_400(self):
        """Con alcance consolidado, toda escritura sin sucursal explícita es rechazada con 400 Bad Request."""
        alcance_multi = AlcanceUsuario(
            id_usuario=12,
            puede_ver_todas=True,
            sucursales_permitidas=[1, 2],
            sucursal_efectiva=None, # Consolidado
            sucursal_asignada_defecto=1
        )
        with pytest.raises(HTTPException) as exc:
            alcance_multi.validar_escritura(id_sucursal_operacion=None)
        assert exc.value.status_code == 400
        assert "debe especificar explícitamente la sucursal" in exc.value.detail

    def test_escritura_multisede_con_sucursal_valida(self):
        """Con alcance consolidado, si especifica sucursal permitida, se valida correctamente."""
        alcance_multi = AlcanceUsuario(
            id_usuario=12,
            puede_ver_todas=True,
            sucursales_permitidas=[1, 2],
            sucursal_efectiva=None,
            sucursal_asignada_defecto=1
        )
        assert alcance_multi.validar_escritura(1) == 1
        assert alcance_multi.validar_escritura("2") == 2

    def test_escritura_sede_fija_intentando_otra_sede_es_403(self):
        """Usuario de sede fija intentando escribir en otra sucursal recibe 403 Forbidden."""
        alcance_sucre = AlcanceUsuario(
            id_usuario=9,
            puede_ver_todas=False,
            sucursales_permitidas=[1],
            sucursal_efectiva=1,
            sucursal_asignada_defecto=1
        )
        with pytest.raises(HTTPException) as exc:
            alcance_sucre.validar_escritura(id_sucursal_operacion=2)
        assert exc.value.status_code == 403
        assert "No puede registrar operaciones en la sucursal 2" in exc.value.detail

    def test_escritura_sede_fija_sin_sucursal_fuerza_su_sede(self):
        """Usuario de sede fija que no envía sucursal en el payload adopta automáticamente su sede autorizada."""
        alcance_sucre = AlcanceUsuario(
            id_usuario=9,
            puede_ver_todas=False,
            sucursales_permitidas=[1],
            sucursal_efectiva=1,
            sucursal_asignada_defecto=1
        )
        assert alcance_sucre.validar_escritura(None) == 1

    def test_admin_con_rol_no_gerente_sin_multisede_aislado_a_su_sede(self):
        """Un usuario con IsAdmin=True (ej. Líder de Inventario) pero sin fila puede_ver_todas=True en permisos NO es multisede."""
        db_mock = MagicMock()
        # Solo tiene permiso para Sucre (id_sucursal=1)
        db_mock.execute.return_value.fetchall.return_value = [
            (1, False, True),
        ]
        # En tabla Usuario tiene IdSucursal=1, IsAdmin=True, IdRol=2 (Encargado/Líder)
        db_mock.execute.return_value.fetchone.return_value = (1, True, 2)

        alcance = resolver_alcance_usuario(id_usuario=88, db=db_mock, sucursal_solicitada=None)

        # Confirmación estricta de regla: IsAdmin NO otorga multisede
        assert alcance.puede_ver_todas is False
        assert alcance.sucursales_permitidas == [1]
        assert alcance.sucursal_efectiva == 1
        with pytest.raises(HTTPException) as exc:
            alcance.validar_recurso(id_sucursal_recurso=2, nombre_recurso="usuarios", responder_404=True)
        assert exc.value.status_code == 404
