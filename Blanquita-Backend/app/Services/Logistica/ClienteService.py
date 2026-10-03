from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.Repository.Logistica.ClienteRepository import ClienteRepository
from app.Models.Logistica.ClienteModel import ClienteCrear, ClienteActualizar, PuntoVentaCrear

class ClienteService:
    def __init__(self, db: Session):
        self.repo = ClienteRepository(db)

    def ListarClientes(self, busqueda: str = "", id_estado: int | None = None) -> list[dict]:
        return self.repo.ListarClientes(busqueda, id_estado)

    def ObtenerClienteDetalle(self, id_cliente: int) -> dict:
        cliente = self.repo.ObtenerClientePorId(id_cliente)
        if not cliente:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
        
        puntos = self.repo.ListarPuntosVentaPorCliente(id_cliente)
        cliente["PuntosVenta"] = puntos
        return cliente

    def CrearCliente(self, dto: ClienteCrear, id_usuario_registro: int) -> dict:
        # Validar NIT/CI duplicado
        existente = self.repo.ObtenerClientePorNit(dto.NitCi)
        if existente:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un cliente registrado con el NIT/CI {dto.NitCi} ({existente['RazonSocial']})"
            )

        cliente_res = self.repo.CrearCliente(dto.model_dump(), id_usuario_registro)
        id_cliente = cliente_res["IdCliente"]

        # Crear punto de venta principal si se proporcionó o por defecto
        nombre_pv = dto.NombrePuntoVentaPrincipal or f"Central - {dto.RazonSocial}"
        pv_datos = {
            "NombrePuntoVenta": nombre_pv,
            "Direccion": dto.Direccion or "Sin dirección especificada",
            "Latitud": dto.Latitud,
            "Longitud": dto.Longitud,
            "Referencia": dto.ReferenciaUbicacion,
            "Activo": True
        }
        self.repo.CrearPuntoVenta(id_cliente, pv_datos)

        return self.ObtenerClienteDetalle(id_cliente)

    def ActualizarCliente(self, id_cliente: int, dto: ClienteActualizar) -> dict:
        self.ObtenerClienteDetalle(id_cliente)
        self.repo.ActualizarCliente(id_cliente, dto.model_dump(exclude_unset=True))
        return self.ObtenerClienteDetalle(id_cliente)

    def AgregarPuntoVenta(self, id_cliente: int, dto: PuntoVentaCrear) -> dict:
        self.ObtenerClienteDetalle(id_cliente)
        pv_res = self.repo.CrearPuntoVenta(id_cliente, dto.model_dump())
        return pv_res

    def ListarTodosPuntosVentaActivos(self) -> list[dict]:
        return self.repo.ListarTodosPuntosVentaActivos()
