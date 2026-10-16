from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.Repository.Contabilidad.CuentasCobrarRepository import CuentasCobrarRepository
from app.Repository.Contabilidad.TesoreriaRepository import TesoreriaRepository
from app.Repository.Logistica.ClienteRepository import ClienteRepository
from app.Models.Contabilidad.CuentasCobrarModel import (
    NotaVentaCrear, AbonoCuentaCobrarCrear
)

class CuentasCobrarService:
    def __init__(self, db: Session):
        self.repo = CuentasCobrarRepository(db)
        self.tesoreria_repo = TesoreriaRepository(db)
        self.cliente_repo = ClienteRepository(db)

    # --- Notas de Venta ---
    def ListarNotasVenta(self, id_cliente: int | None = None, destino: str | None = None,
                         fecha_inicio = None, fecha_fin = None, busqueda: str = "") -> list[dict]:
        return self.repo.ListarNotasVenta(id_cliente, destino, fecha_inicio, fecha_fin, busqueda)

    def ObtenerNotaVentaDetalle(self, id_nota: int) -> dict:
        nota = self.repo.ObtenerNotaVentaPorId(id_nota)
        if not nota:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nota de venta no encontrada")
        nota["Detalles"] = self.repo.ListarDetallesNotaVenta(id_nota)
        return nota

    def CrearNotaVenta(self, dto: NotaVentaCrear, id_usuario: int | None = None) -> dict:
        existente = self.repo.ObtenerNotaVentaPorNumero(dto.NumeroNotaVenta)
        if existente:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una nota de venta con el número {dto.NumeroNotaVenta}"
            )

        # Calcular ImporteNeto si no viene
        importe_neto = dto.ImporteNeto if dto.ImporteNeto is not None else (
            dto.TotalVentaBruto - dto.DescuentoBonificacion - dto.Promocion
        )

        datos_nota = dto.model_dump(exclude={"Detalles", "EsCredito"})
        datos_nota["ImporteNeto"] = max(importe_neto, 0.0)
        
        if dto.EsCredito:
            datos_nota["TotalCancelado"] = 0.0
            datos_nota["SaldoPendiente"] = datos_nota["ImporteNeto"]
            datos_nota["EstadoCobranza"] = "Crédito Pendiente"
        else:
            datos_nota["TotalCancelado"] = datos_nota["ImporteNeto"]
            datos_nota["SaldoPendiente"] = 0.0
            datos_nota["EstadoCobranza"] = "Pagado al Contado"

        nota = self.repo.CrearNotaVenta(datos_nota, id_usuario)
        id_nota = nota["IdNotaVenta"]

        # Insertar detalles de productos despachados
        if dto.Detalles:
            self.repo.CrearDetalleNotaVenta(id_nota, [d.model_dump() for d in dto.Detalles])

        # Si es crédito y se tiene cliente, crear registro de Cuenta por Cobrar
        if dto.EsCredito and dto.IdCliente:
            self.repo.CrearCuentaCobrar({
                "IdCliente": dto.IdCliente,
                "IdPedido": None,
                "IdNotaVenta": id_nota,
                "NumeroNotaVenta": dto.NumeroNotaVenta,
                "NumeroNotaEntrega": dto.NumeroNotaEntrega,
                "FechaDespacho": dto.FechaVenta,
                "DiasMora": 0,
                "IdEstadoCuentaCobrar": 1, # 1 = Vigente
                "MontoTotal": datos_nota["ImporteNeto"],
                "SaldoPendiente": datos_nota["ImporteNeto"],
                "FechaEmision": dto.FechaVenta,
                "FechaVencimiento": None,
                "IdUsuarioRegistro": id_usuario,
                "Observacion": dto.Observacion
            })

        return self.ObtenerNotaVentaDetalle(id_nota)


    # --- Cuentas por Cobrar ---
    def ListarCuentasCobrar(self, id_cliente: int | None = None, id_estado: int | None = None, solo_con_saldo: bool = True) -> list[dict]:
        return self.repo.ListarCuentasCobrar(id_cliente, id_estado, solo_con_saldo)

    def ObtenerCuentaCobrarDetalle(self, id_cxc: int) -> dict:
        cxc = self.repo.ObtenerCuentaCobrarPorId(id_cxc)
        if not cxc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta por cobrar no encontrada")
        cxc["Abonos"] = self.repo.ListarAbonosPorCuenta(id_cxc)
        return cxc

    def RegistrarAbono(self, dto: AbonoCuentaCobrarCrear, id_usuario: int | None = None) -> dict:
        cxc = self.repo.ObtenerCuentaCobrarPorId(dto.IdCuentaCobrar)
        if not cxc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta por cobrar no encontrada")

        if float(cxc["SaldoPendiente"]) <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta cuenta ya se encuentra totalmente liquidada.")

        # Registrar abono
        abono = self.repo.RegistrarAbono(dto.model_dump(), id_usuario)

        # Actualizar saldo en la cuenta por cobrar
        self.repo.ActualizarSaldoCuentaCobrar(dto.IdCuentaCobrar, dto.MontoAbonado)

        # Si estaba asociada a una Nota de Venta, actualizar saldo en Nota de Venta
        id_nota = dto.IdNotaVenta or cxc.get("IdNotaVenta")
        if id_nota:
            self.repo.ActualizarSaldoNotaVenta(id_nota, dto.MontoAbonado)

        # Si el abono se depositó en cuenta bancaria de la empresa, actualizar saldo bancario
        if dto.IdCuentaBancaria:
            self.tesoreria_repo.ActualizarSaldoCuentaBancaria(dto.IdCuentaBancaria, dto.MontoAbonado)

        return abono

    def ObtenerResumenCartera(self) -> list[dict]:
        return self.repo.ObtenerResumenCartera()
