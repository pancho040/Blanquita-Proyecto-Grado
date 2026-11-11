import logging
from decimal import Decimal
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.Repository.Gerencia.GerenciaRepository import GerenciaRepository
from app.Services.Planta.PlantaDataReader import PlantaDataReader
from app.Models.Gerencia.GerenciaModel import (
    BuscadorGlobalResponse,
    DocumentoEncontrado,
    KPIsEjecutivosResponse,
    RegistrarFirmaSelloRequest,
    FirmaSelloResponse,
    ConciliarBancoRequest,
    ReporteConsolidadoPlantaResponse,
    MateriaPrimaItem,
    ProductoTerminadoItem,
    SaldoBancoItem,
    AlertaGerencialItem
)

logger = logging.getLogger(__name__)


class GerenciaService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = GerenciaRepository(session)

    # =========================================================================
    # 1. BUSCADOR GLOBAL POR CÓDIGO NUMÉRICO O PREFIJO
    # =========================================================================
    def BuscarReporteOGlobal(self, codigo: str, id_sucursal: int | None = None) -> BuscadorGlobalResponse:
        if not codigo or not codigo.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe proporcionar un código o término de búsqueda"
            )

        codigo_limpio = codigo.strip()
        documentos_raw = self.repo.BuscarDocumentosGlobal(codigo_limpio, id_sucursal)
        
        # Verificar coincidencia exacta
        coincidencia_exacta = any(
            doc["codigo"].upper() == codigo_limpio.upper() or
            doc["codigo"].upper() == f"NV-{codigo_limpio}".upper() or
            doc["codigo"].upper() == f"VALE-{codigo_limpio}".upper()
            for doc in documentos_raw
        )

        documentos_model = [DocumentoEncontrado(**d) for d in documentos_raw]

        return BuscadorGlobalResponse(
            codigo_buscado=codigo_limpio,
            coincidencia_exacta=coincidencia_exacta,
            total_encontrados=len(documentos_model),
            documentos=documentos_model
        )

    # =========================================================================
    # 2. KPIS EJECUTIVOS GLOBALES (DON OSVALDO)
    # =========================================================================
    def ObtenerKPIsEjecutivos(self, id_sucursal: int | None = None) -> KPIsEjecutivosResponse:
        data = self.repo.ObtenerKPIsEjecutivos(id_sucursal)
        bancos_model = [SaldoBancoItem(**b) for b in data["bancos"]]
        alertas_model = [AlertaGerencialItem(**a) for a in data["alertas"]]

        return KPIsEjecutivosResponse(
            fecha_consulta=data["fecha_consulta"],
            ventas_hoy_monto=data["ventas_hoy_monto"],
            ventas_hoy_cantidad=data["ventas_hoy_cantidad"],
            cuentas_cobrar_saldo_total=data["cuentas_cobrar_saldo_total"],
            cuentas_cobrar_en_mora=data["cuentas_cobrar_en_mora"],
            vales_caja_chica_pendientes_cantidad=data["vales_caja_chica_pendientes_cantidad"],
            vales_caja_chica_pendientes_monto=data["vales_caja_chica_pendientes_monto"],
            saldos_bancarios_total=data["saldos_bancarios_total"],
            bancos=bancos_model,
            alertas=alertas_model
        )

    # =========================================================================
    # 3. REGISTRAR FIRMA Y SELLO DIGITAL DE GERENCIA
    # =========================================================================
    def RegistrarFirmaGerencial(self, id_gerente: int, dto: RegistrarFirmaSelloRequest) -> FirmaSelloResponse:
        # Registrar la firma en FirmaDigitalDocumento
        firma = self.repo.RegistrarFirmaDigital(id_gerente, dto.model_dump())

        # Si el documento firmado es una solicitud de caja chica, resolverla automáticamente
        if dto.tipo_documento.upper() in ["SOLICITUD_CAJA_CHICA", "CAJA_CHICA", "VALE_CAJA_CHICA"]:
            try:
                from app.Services.Contabilidad.TesoreriaService import TesoreriaService
                from app.Models.Contabilidad.TesoreriaModel import ResolverAprobacionGerenciaRequest
                ts = TesoreriaService(self.session)
                ts.ResolverAprobacionGerencia(
                    dto.id_registro_documento,
                    ResolverAprobacionGerenciaRequest(
                        Aprobado=True,
                        Observaciones=dto.observaciones or "Firmado y sellado digitalmente por Don Osvaldo (Gerencia)"
                    ),
                    id_gerente
                )
            except Exception as e:
                logger.warning(f"No se aplicó auto-resolución de caja chica en firma: {e}")

        # Si el documento firmado es un pedido de distribuidor mayorista
        if dto.tipo_documento.upper() in ["PEDIDO_DISTRIBUIDOR", "DISTRIBUIDOR"]:
            try:
                from sqlalchemy import text
                self.session.execute(
                    text("UPDATE public.pedidos_distribuidores SET estado = 'APROBADO_DESPACHO' WHERE id = :pid"),
                    {"pid": dto.id_registro_documento}
                )
                self.session.commit()
            except Exception as e:
                logger.warning(f"No se aplicó auto-aprobación de pedido distribuidor: {e}")

        return FirmaSelloResponse(
            id_firma=firma["IdFirma"],
            tipo_documento=firma["TipoDocumento"],
            id_registro_documento=firma["IdRegistroDocumento"],
            codigo_referencia=firma.get("CodigoReferencia"),
            url_foto_firma_sello=firma.get("UrlFotoFirmaSello"),
            observaciones=firma.get("Observaciones"),
            fecha_firma=str(firma["FechaFirma"]),
            firmado_por=f"Don Osvaldo - Gerencia General (Usuario #{id_gerente})"
        )

    def ListarFirmasHistorial(self, limit: int = 20) -> List[dict]:
        return self.repo.ListarFirmasHistorial(limit)

    # =========================================================================
    # 4. CONCILIACIÓN REFERENCIAL DE LOS 3 BANCOS
    # =========================================================================
    def ConciliarBancoReferencial(self, id_cuenta: int, dto: ConciliarBancoRequest, id_usuario: int) -> dict:
        cta = self.repo.ConciliarCuentaBancaria(id_cuenta, dto.saldo_conciliado, id_usuario, dto.observaciones)
        return cta

    # =========================================================================
    # 5. REPORTE FINANCIERO CONSOLIDADO DE PLANTA (SOLO LECTURA)
    # =========================================================================
    def ObtenerReporteConsolidadoPlanta(self) -> ReporteConsolidadoPlantaResponse:
        """
        Genera el informe de consolidación financiera de activos en planta
        consumiendo EXCLUSIVAMENTE PlantaDataReader sin emitir ninguna sentencia de escritura.
        """
        reader = PlantaDataReader(self.session)

        # 1. Saldos de materia prima (bobinas papel, servilleta, rodelas)
        saldos_mp = reader.obtener_saldos_materia_prima(self.session)
        
        costo_kg_papel = Decimal("7.50") # 7.50 Bs por kg referencial
        costo_bobina_serv = Decimal("320.00") # 320 Bs por bobina referencial
        costo_rodela = Decimal("0.85") # 0.85 Bs por rodela

        peso_papel = Decimal(str(saldos_mp.get("bobinas_papel_peso_kg", 0)))
        cant_papel = int(saldos_mp.get("bobinas_papel_almacen", 0))
        valor_papel = (peso_papel * costo_kg_papel).quantize(Decimal("0.01"))

        cant_serv = int(saldos_mp.get("bobinas_servilleta_almacen", 0))
        valor_serv = (Decimal(cant_serv) * costo_bobina_serv).quantize(Decimal("0.01"))

        cant_rodelas = int(saldos_mp.get("rodelas_total", 0))
        valor_rodelas = (Decimal(cant_rodelas) * costo_rodela).quantize(Decimal("0.01"))

        materias_primas = [
            MateriaPrimaItem(
                categoria="Bobinas de Papel Higiénico",
                cantidad_unidades=cant_papel,
                peso_o_medida=f"{peso_papel:.2f} kg",
                costo_unitario_estimado=costo_kg_papel,
                valor_total_estimado=valor_papel
            ),
            MateriaPrimaItem(
                categoria="Bobinas de Servilleta",
                cantidad_unidades=cant_serv,
                peso_o_medida=f"{cant_serv} bobinas",
                costo_unitario_estimado=costo_bobina_serv,
                valor_total_estimado=valor_serv
            ),
            MateriaPrimaItem(
                categoria="Rodelas y Conos",
                cantidad_unidades=cant_rodelas,
                peso_o_medida=f"{cant_rodelas} unidades",
                costo_unitario_estimado=costo_rodela,
                valor_total_estimado=valor_rodelas
            )
        ]
        total_mp_valor = valor_papel + valor_serv + valor_rodelas

        # 2. Saldos de producto terminado en planta
        catalogo = reader.obtener_catalogo_productos(self.session)
        productos_terminados = []
        total_pt_valor = Decimal("0.00")

        # Precios referenciales de costo industrial
        for item in catalogo:
            stock = Decimal(str(item.get("stock_planta_sucre", 0)))
            # Costo referencial estimado de fábrica (ej. 35 Bs por fardo/paquete)
            precio_ref = Decimal("38.50") if "MEGARROLLO" in item["producto_nombre"].upper() else Decimal("28.00")
            valor_item = (stock * precio_ref).quantize(Decimal("0.01"))
            total_pt_valor += valor_item

            productos_terminados.append(
                ProductoTerminadoItem(
                    producto_nombre=item["producto_nombre"],
                    presentacion_codigo=item["codigo_presentacion"] or f"PRES-{item['presentacion_id']}",
                    tipo_contenedor=item["tipo_contenedor"] or "Paquete",
                    stock_paquetes=stock,
                    precio_referencial=precio_ref,
                    valor_total_estimado=valor_item
                )
            )

        from sqlalchemy import text
        fecha_corte = str(self.session.execute(text("SELECT CURRENT_TIMESTAMP")).scalar())

        return ReporteConsolidadoPlantaResponse(
            fecha_corte=fecha_corte,
            total_valor_inventario_planta=total_mp_valor + total_pt_valor,
            total_materias_primas_valor=total_mp_valor,
            total_producto_terminado_valor=total_pt_valor,
            materias_primas=materias_primas,
            producto_terminado=productos_terminados,
            nota_auditoria="CONSULTA EN SOLO LECTURA: Información física extraída mediante PlantaDataReader sin emitir DML/DDL sobre tablas de producción."
        )
