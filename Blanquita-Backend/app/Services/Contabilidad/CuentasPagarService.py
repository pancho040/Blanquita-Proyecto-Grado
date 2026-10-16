from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.Repository.Contabilidad.CuentasPagarRepository import CuentasPagarRepository
from app.Repository.Contabilidad.TesoreriaRepository import TesoreriaRepository
from app.Models.Contabilidad.CuentasPagarModel import (
    CuentaPagarCrear, PagoCuentaPagarCrear, DevolucionProveedorCrear
)

class CuentasPagarService:
    def __init__(self, db: Session):
        self.repo = CuentasPagarRepository(db)
        self.tesoreria_repo = TesoreriaRepository(db)

    # --- Proveedores ---
    def ListarProveedores(self) -> list[dict]:
        return self.repo.ListarProveedores()

    # --- Cuentas por Pagar ---
    def ListarCuentasPagar(self, id_proveedor: int | None = None, estado: str | None = None,
                           fecha_inicio = None, fecha_fin = None) -> list[dict]:
        return self.repo.ListarCuentasPagar(id_proveedor, estado, fecha_inicio, fecha_fin)

    def ObtenerCuentaPagarDetalle(self, id_cxp: int) -> dict:
        cxp = self.repo.ObtenerCuentaPagarPorId(id_cxp)
        if not cxp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta por pagar no encontrada")
        cxp["DetallesInsumos"] = self.repo.ListarDetallesInsumos(id_cxp)
        cxp["Pagos"] = self.repo.ListarPagosPorCuenta(id_cxp)
        return cxp

    def CrearCuentaPagar(self, dto: CuentaPagarCrear, id_usuario: int | None = None) -> dict:
        datos_cxp = dto.model_dump(exclude={"DetallesInsumos"})
        cxp = self.repo.CrearCuentaPagar(datos_cxp, id_usuario)
        id_cxp = cxp["IdCuentaPagar"]

        if dto.DetallesInsumos:
            self.repo.CrearDetalleInsumos(id_cxp, [d.model_dump() for d in dto.DetallesInsumos])

        return self.ObtenerCuentaPagarDetalle(id_cxp)

    def RegistrarPagoProveedor(self, dto: PagoCuentaPagarCrear, id_usuario: int | None = None) -> dict:
        cxp = self.repo.ObtenerCuentaPagarPorId(dto.IdCuentaPagar)
        if not cxp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta por pagar no encontrada")

        if float(cxp["SaldoPendiente"]) <= 0 and not dto.EsCompensacion:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta cuenta ya se encuentra totalmente saldada.")

        pago = self.repo.RegistrarPagoProveedor(dto.model_dump(), id_usuario)

        # Si el pago salió de una cuenta bancaria y no es compensación interna, debitar del banco
        if dto.IdCuentaBancaria and not dto.EsCompensacion:
            self.tesoreria_repo.ActualizarSaldoCuentaBancaria(dto.IdCuentaBancaria, -dto.MontoPagado)

        return pago

    # --- Devoluciones ---
    def RegistrarDevolucion(self, dto: DevolucionProveedorCrear) -> dict:
        return self.repo.RegistrarDevolucion(dto.model_dump())

    def ListarDevoluciones(self, id_proveedor: int | None = None) -> list[dict]:
        return self.repo.ListarDevoluciones(id_proveedor)
