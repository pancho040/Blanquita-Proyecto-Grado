import pytest
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi import HTTPException

from app.Config.supabase import SessionLocal
from app.Services.Gerencia.GerenciaService import GerenciaService

@pytest.fixture
def db_session():
    session = SessionLocal()
    yield session
    session.close()
from app.Models.Gerencia.GerenciaModel import (
    RegistrarFirmaSelloRequest,
    ConciliarBancoRequest
)
from app.Services.Contabilidad.TesoreriaService import TesoreriaService
from app.Models.Contabilidad.TesoreriaModel import SolicitudCajaChicaCrear


# =============================================================================
# PRUEBAS SUBAGENTE F: PANEL GERENCIAL, BUSCADOR NUMÉRICO Y CONSOLIDACIÓN (FASE 4)
# =============================================================================

def test_tc_ger_01_buscador_codigo_numerico_2208(db_session: Session):
    """
    TC-GER-01: Búsqueda por código numérico de 4 dígitos (ej. 2208) localiza de
    inmediato el documento exacto (vale, nota o recibo) sin navegar menús.
    """
    tes_service = TesoreriaService(db_session)
    ger_service = GerenciaService(db_session)

    # 1. Crear un vale con código o referencia 2208 para asegurar existencia
    db_session.execute(text("""
        INSERT INTO public."SolicitudCajaChica" (
            "IdSolicitudCajaChica", "CodigoSolicitud", "NombreSolicitante", 
            "CargoSolicitante", "MontoSolicitado", "MontoEntregado",
            "MontoGastoReal", "DestinoJustificacion", "Estado", "AprobacionGerencia"
        ) VALUES (
            2208, 'VALE-2208', 'Kevin Poveda', 
            'Contabilidad', 500.00, 500.00,
            450.00, 'Compra insumos de limpieza y desinfección', 'RENDIDO', 'PENDIENTE'
        ) ON CONFLICT ("IdSolicitudCajaChica") DO UPDATE 
        SET "CodigoSolicitud" = 'VALE-2208', "MontoGastoReal" = 450.00, "Estado" = 'RENDIDO';
    """))
    db_session.commit()

    # 2. Ejecutar búsqueda por el código "2208"
    resp = ger_service.BuscarReporteOGlobal("2208")

    assert resp.codigo_buscado == "2208"
    assert resp.coincidencia_exacta is True
    assert resp.total_encontrados >= 1

    # Verificar que el documento 2208 está en la lista de resultados
    doc = next((d for d in resp.documentos if "2208" in d.codigo or d.id_registro == 2208), None)
    assert doc is not None
    assert doc.tipo_documento == "CAJA_CHICA"
    assert "VALE-2208" in doc.codigo
    assert doc.solicitante_o_cliente == "Kevin Poveda"
    assert float(doc.monto) == 450.00


def test_tc_ger_02_reporte_consolidado_planta_solo_lectura(db_session: Session):
    """
    TC-GER-02: Consolidación de saldos de materias primas y producto terminado
    se genera exitosamente en modo SOLO LECTURA sin alterar ninguna tabla de planta.
    """
    ger_service = GerenciaService(db_session)

    reporte = ger_service.ObtenerReporteConsolidadoPlanta()

    assert reporte.total_valor_inventario_planta > Decimal("0.00")
    assert reporte.total_materias_primas_valor >= Decimal("0.00")
    assert reporte.total_producto_terminado_valor >= Decimal("0.00")
    assert len(reporte.materias_primas) >= 3 # Papel, Servilleta, Rodelas
    assert len(reporte.producto_terminado) >= 1
    assert "SOLO LECTURA" in reporte.nota_auditoria

    # Verificar que los tipos son Decimals correctos
    for mp in reporte.materias_primas:
        assert isinstance(mp.valor_total_estimado, Decimal)
        assert mp.cantidad_unidades >= 0

    for pt in reporte.producto_terminado:
        assert isinstance(pt.valor_total_estimado, Decimal)
        assert pt.stock_paquetes >= Decimal("0.00")


def test_tc_ger_03_kpis_ejecutivos_don_osvaldo(db_session: Session):
    """
    TC-GER-03: Dashboard ejecutivo consolida ventas, cuentas por cobrar en mora,
    vales de caja chica por autorizar y los 3 bancos referenciales del negocio.
    """
    ger_service = GerenciaService(db_session)

    kpis = ger_service.ObtenerKPIsEjecutivos()

    assert kpis.fecha_consulta is not None
    assert kpis.ventas_hoy_monto >= Decimal("0.00")
    assert kpis.cuentas_cobrar_saldo_total >= Decimal("0.00")
    assert kpis.saldos_bancarios_total >= Decimal("0.00")

    # Verificar presencia de los 3 bancos referenciales
    bancos_siglas = [b.sigla.upper() for b in kpis.bancos]
    assert any("BMSC" in s or "MSC" in s for s in bancos_siglas)
    assert any("BU" in s or "UNION" in s for s in bancos_siglas)
    assert any("BNB" in s for s in bancos_siglas)

    # Verificar propósitos asignados
    propositos = [b.proposito for b in kpis.bancos]
    assert "RECAUDACION_CHOFERES" in propositos
    assert "DISTRIBUIDORES_MAYORISTAS" in propositos
    assert "OPERACIONES_INSTITUCIONALES" in propositos


def test_tc_ger_04_registro_firma_y_sello_digital(db_session: Session):
    """
    TC-GER-04: Registro de firma y sello digital de Don Osvaldo para autorizaciones
    ejecutivas con trazabilidad y resolución automática de vales.
    """
    ger_service = GerenciaService(db_session)

    dto_firma = RegistrarFirmaSelloRequest(
        tipo_documento="SOLICITUD_CAJA_CHICA",
        id_registro_documento=2208,
        codigo_referencia="VALE-2208",
        url_foto_firma_sello="https://storage.blanquita.com/firmas/sello_don_osvaldo_2208.jpg",
        observaciones="Autorizado y sellado por Don Osvaldo - Fondo conforme"
    )

    firma = ger_service.RegistrarFirmaGerencial(id_gerente=1, dto=dto_firma)

    assert firma.id_firma > 0
    assert firma.tipo_documento == "SOLICITUD_CAJA_CHICA"
    assert firma.id_registro_documento == 2208
    assert "Don Osvaldo" in firma.firmado_por
    assert firma.url_foto_firma_sello is not None

    # Verificar que el historial lista la firma
    historial = ger_service.ListarFirmasHistorial(limit=10)
    assert any(h["IdFirma"] == firma.id_firma for h in historial)


def test_tc_ger_05_conciliacion_banco_referencial(db_session: Session):
    """
    TC-GER-05: Conciliación manual de saldos en los bancos referenciales (ej. Banco Unión)
    con registro de auditoría en ConciliacionBancariaHistorial.
    """
    ger_service = GerenciaService(db_session)

    # Conciliar Banco Unión (Id 1)
    dto_conciliar = ConciliarBancoRequest(
        saldo_conciliado=Decimal("280000.00"),
        observaciones="Conciliación semanal contra extracto oficial de Banco Unión"
    )

    cta = ger_service.ConciliarBancoReferencial(id_cuenta=1, dto=dto_conciliar, id_usuario=1)

    assert cta["IdCuentaBancaria"] == 1
    assert Decimal(str(cta["SaldoConciliado"])) == Decimal("280000.00")
    assert cta["FechaUltimaConciliacion"] is not None

    # Verificar que se registró en ConciliacionBancariaHistorial
    hist = db_session.execute(text("""
        SELECT * FROM public."ConciliacionBancariaHistorial"
        WHERE "IdCuentaBancaria" = 1
        ORDER BY "IdConciliacion" DESC
        LIMIT 1;
    """)).fetchone()

    assert hist is not None
    assert Decimal(str(hist.SaldoNuevo)) == Decimal("280000.00")
    assert hist.IdUsuario == 1
