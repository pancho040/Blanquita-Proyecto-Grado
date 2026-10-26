from sqlalchemy.orm import Session
from app.Repository.DbCaller import DbCaller

class TesoreriaRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    # --- Cuentas Bancarias ---
    def ListarCuentasBancarias(self) -> list[dict]:
        sql = """
            SELECT "IdCuentaBancaria", "NombreBanco", "Sigla", "NumeroCuenta", 
                   "TipoCuenta", "Moneda", "SaldoActual", "Activa", "FechaCreacion"
            FROM "CuentaBancariaEmpresa"
            ORDER BY "IdCuentaBancaria" ASC;
        """
        return self.caller.LlamarFuncion(sql)

    def ObtenerCuentaBancariaPorId(self, id_cuenta: int) -> dict | None:
        sql = """
            SELECT "IdCuentaBancaria", "NombreBanco", "Sigla", "NumeroCuenta", 
                   "TipoCuenta", "Moneda", "SaldoActual", "Activa", "FechaCreacion"
            FROM "CuentaBancariaEmpresa"
            WHERE "IdCuentaBancaria" = :id_cuenta;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_cuenta": id_cuenta})

    def ObtenerCuentaBancariaPorSigla(self, sigla: str) -> dict | None:
        sql = """
            SELECT "IdCuentaBancaria", "NombreBanco", "Sigla", "NumeroCuenta", 
                   "TipoCuenta", "Moneda", "SaldoActual", "Activa", "FechaCreacion"
            FROM "CuentaBancariaEmpresa"
            WHERE "Sigla" = :sigla;
        """
        return self.caller.LlamarUnRegistro(sql, {"sigla": sigla})

    def CrearCuentaBancaria(self, datos: dict) -> dict:
        sql = """
            INSERT INTO "CuentaBancariaEmpresa" (
                "NombreBanco", "Sigla", "NumeroCuenta", "TipoCuenta", "Moneda", "SaldoActual", "Activa"
            ) VALUES (
                :NombreBanco, :Sigla, :NumeroCuenta, :TipoCuenta, :Moneda, :SaldoActual, :Activa
            )
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, datos)

    def ActualizarSaldoCuentaBancaria(self, id_cuenta: int, delta: float) -> dict | None:
        sql = """
            UPDATE "CuentaBancariaEmpresa"
            SET "SaldoActual" = "SaldoActual" + :delta
            WHERE "IdCuentaBancaria" = :id_cuenta
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_cuenta": id_cuenta, "delta": delta})


    # --- Apertura y Cierre de Caja ---
    def ObtenerCajaAbierta(self, id_caja: int = 1) -> dict | None:
        sql = """
            SELECT ac.*, c."NombreCaja", e."NombreEstado",
                   u1."PrimerNombre" || ' ' || u1."ApellidoPaterno" as "NombreUsuarioApertura"
            FROM "AperturaCierreCaja" ac
            JOIN "Caja" c ON ac."IdCaja" = c."IdCaja"
            JOIN "EstadoAperturaCaja" e ON ac."IdEstadoAperturaCaja" = e."IdEstadoAperturaCaja"
            JOIN "Usuario" u1 ON ac."IdUsuarioApertura" = u1."IdUsuario"
            WHERE ac."IdCaja" = :id_caja AND ac."FechaCierre" IS NULL
            ORDER BY ac."FechaApertura" DESC
            LIMIT 1;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_caja": id_caja})

    def AbrirCaja(self, id_caja: int, id_usuario: int, saldo_inicial: float, observacion: str | None = None) -> dict:
        sql = """
            INSERT INTO "AperturaCierreCaja" (
                "IdCaja", "IdUsuarioApertura", "IdEstadoAperturaCaja", "SaldoInicial", "Observacion"
            ) VALUES (
                :id_caja, :id_usuario, 1, :saldo_inicial, :observacion
            )
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, {
            "id_caja": id_caja,
            "id_usuario": id_usuario,
            "saldo_inicial": saldo_inicial,
            "observacion": observacion
        })

    def CerrarCaja(self, id_apertura: int, id_usuario_cierre: int, saldo_real: float,
                   saldo_teorico: float, diferencia: float, numero_arqueo: str | None = None,
                   hora_inicio = None, hora_termino = None, observacion: str | None = None) -> dict:
        id_estado = 2 if diferencia == 0 else 3 # 2=Cerrada, 3=Cerrada con Diferencia
        sql = """
            UPDATE "AperturaCierreCaja"
            SET "IdUsuarioCierre" = :id_usuario,
                "IdEstadoAperturaCaja" = :id_estado,
                "FechaCierre" = now(),
                "SaldoTeorico" = :saldo_teorico,
                "SaldoReal" = :saldo_real,
                "Diferencia" = :diferencia,
                "NumeroArqueo" = :numero_arqueo,
                "HoraInicio" = :hora_inicio,
                "HoraTermino" = :hora_termino,
                "Observacion" = :observacion
            WHERE "IdAperturaCierreCaja" = :id_apertura
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, {
            "id_apertura": id_apertura,
            "id_usuario": id_usuario_cierre,
            "id_estado": id_estado,
            "saldo_teorico": saldo_teorico,
            "saldo_real": saldo_real,
            "diferencia": diferencia,
            "numero_arqueo": numero_arqueo,
            "hora_inicio": hora_inicio,
            "hora_termino": hora_termino,
            "observacion": observacion
        })

    def RegistrarDesgloseCortes(self, id_apertura: int, cortes: list[dict]):
        for corte in cortes:
            sql = """
                INSERT INTO "ArqueoCajaDetalle" (
                    "IdAperturaCierreCaja", "TipoEfectivo", "Corte", "Cantidad"
                ) VALUES (
                    :id_apertura, :TipoEfectivo, :Corte, :Cantidad
                );
            """
            self.caller.LlamarFuncion(sql, {
                "id_apertura": id_apertura,
                "TipoEfectivo": corte["TipoEfectivo"],
                "Corte": corte["Corte"],
                "Cantidad": corte["Cantidad"]
            })

    def ObtenerDesgloseCortes(self, id_apertura: int) -> list[dict]:
        sql = """
            SELECT "IdArqueoCajaDetalle", "IdAperturaCierreCaja", "TipoEfectivo", "Corte", "Cantidad", "Subtotal"
            FROM "ArqueoCajaDetalle"
            WHERE "IdAperturaCierreCaja" = :id_apertura
            ORDER BY "Corte" DESC;
        """
        return self.caller.LlamarFuncion(sql, {"id_apertura": id_apertura})


    # --- Categorías de Movimiento de Caja ---
    def ListarCategoriasMovimiento(self, tipo: str | None = None) -> list[dict]:
        where_sql = "WHERE \"TipoMovimiento\" = :tipo" if tipo else ""
        sql = f"""
            SELECT "IdCategoriaMovimientoCaja", "NombreCategoria", "TipoMovimiento", "Descripcion"
            FROM "CategoriaMovimientoCaja"
            {where_sql}
            ORDER BY "TipoMovimiento" DESC, "NombreCategoria" ASC;
        """
        params = {"tipo": tipo} if tipo else {}
        return self.caller.LlamarFuncion(sql, params)


    # --- Movimientos de Caja (Libro Diario de Caja) ---
    def ListarMovimientosCaja(self, id_apertura: int | None = None, fecha_inicio = None, fecha_fin = None, tipo: str | None = None) -> list[dict]:
        where_clauses = []
        params = {}

        if id_apertura is not None:
            where_clauses.append('m."IdAperturaCierreCaja" = :id_apertura')
            params["id_apertura"] = id_apertura
        if fecha_inicio:
            where_clauses.append('m."FechaMovimiento"::date >= :fecha_inicio')
            params["fecha_inicio"] = fecha_inicio
        if fecha_fin:
            where_clauses.append('m."FechaMovimiento"::date <= :fecha_fin')
            params["fecha_fin"] = fecha_fin
        if tipo:
            where_clauses.append('cat."TipoMovimiento" = :tipo')
            params["tipo"] = tipo

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        sql = f"""
            SELECT 
                m."IdMovimientoCaja",
                m."IdAperturaCierreCaja",
                m."IdCategoriaMovimientoCaja",
                cat."NombreCategoria",
                cat."TipoMovimiento",
                m."IdUsuario",
                u."PrimerNombre" || ' ' || u."ApellidoPaterno" as "NombreUsuario",
                m."Monto",
                m."MetodoPago",
                m."NumeroReferencia",
                m."FechaMovimiento",
                m."NotaCodigo",
                m."Solicitante",
                m."Respaldo",
                m."IdCuentaBancaria",
                b."NombreBanco",
                m."Descripcion",
                m."Anulado"
            FROM "MovimientoCaja" m
            JOIN "CategoriaMovimientoCaja" cat ON m."IdCategoriaMovimientoCaja" = cat."IdCategoriaMovimientoCaja"
            LEFT JOIN "Usuario" u ON m."IdUsuario" = u."IdUsuario"
            LEFT JOIN "CuentaBancariaEmpresa" b ON m."IdCuentaBancaria" = b."IdCuentaBancaria"
            {where_sql}
            ORDER BY m."FechaMovimiento" DESC, m."IdMovimientoCaja" DESC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def CrearMovimientoCaja(self, datos: dict, id_usuario: int | None = None) -> dict:
        sql = """
            INSERT INTO "MovimientoCaja" (
                "IdAperturaCierreCaja", "IdCategoriaMovimientoCaja", "IdUsuario",
                "Monto", "MetodoPago", "NumeroReferencia", "NotaCodigo",
                "Solicitante", "Respaldo", "IdCuentaBancaria", "Descripcion"
            ) VALUES (
                :IdAperturaCierreCaja, :IdCategoriaMovimientoCaja, :IdUsuario,
                :Monto, :MetodoPago, :NumeroReferencia, :NotaCodigo,
                :Solicitante, :Respaldo, :IdCuentaBancaria, :Descripcion
            )
            RETURNING *;
        """
        payload = dict(datos)
        payload["IdUsuario"] = id_usuario
        return self.caller.LlamarUnRegistro(sql, payload)

    def ObtenerTotalesCaja(self, id_apertura: int) -> dict:
        sql = """
            SELECT 
                COALESCE(SUM(CASE WHEN cat."TipoMovimiento" = 'Ingreso' AND NOT m."Anulado" THEN m."Monto" ELSE 0 END), 0) as "TotalIngresos",
                COALESCE(SUM(CASE WHEN cat."TipoMovimiento" = 'Egreso' AND NOT m."Anulado" THEN m."Monto" ELSE 0 END), 0) as "TotalEgresos"
            FROM "MovimientoCaja" m
            JOIN "CategoriaMovimientoCaja" cat ON m."IdCategoriaMovimientoCaja" = cat."IdCategoriaMovimientoCaja"
            WHERE m."IdAperturaCierreCaja" = :id_apertura;
        """
        res = self.caller.LlamarUnRegistro(sql, {"id_apertura": id_apertura})
        return res or {"TotalIngresos": 0.0, "TotalEgresos": 0.0}


    def ObtenerMovimientoCajaPorId(self, id_movimiento: int) -> dict | None:
        sql = """
            SELECT m.*, cat."TipoMovimiento", cat."NombreCategoria"
            FROM "MovimientoCaja" m
            JOIN "CategoriaMovimientoCaja" cat ON m."IdCategoriaMovimientoCaja" = cat."IdCategoriaMovimientoCaja"
            WHERE m."IdMovimientoCaja" = :id_mov;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_mov": id_movimiento})

    def AnularMovimientoCaja(self, id_movimiento: int, id_usuario: int | None, motivo: str = "") -> dict | None:
        sql = """
            UPDATE "MovimientoCaja"
            SET "Anulado" = true,
                "Descripcion" = COALESCE("Descripcion", '') || ' [ANULADO: ' || :motivo || ']'
            WHERE "IdMovimientoCaja" = :id_mov
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, {
            "id_mov": id_movimiento,
            "motivo": motivo or "Anulación solicitada por administración"
        })

    def RegistrarAuditLog(self, id_usuario: int | None, accion: str, tabla: str, id_registro: str, detalle: str):
        try:
            sql = """
                INSERT INTO "AuditLog" (
                    "IdUsuario", "Accion", "TablaAfectada", "IdRegistroAfectado", "Detalle", "FechaHora"
                ) VALUES (
                    :id_u, :acc, :tabla, :id_reg, :det, now()
                );
            """
            self.caller.LlamarFuncion(sql, {
                "id_u": id_usuario,
                "acc": accion,
                "tabla": tabla,
                "id_reg": id_registro,
                "det": detalle
            })
        except Exception as e:
            print(f"Error al registrar log de auditoría: {e}")

    # --- Solicitudes de Caja Chica ---
    def ListarSolicitudesCajaChica(self, estado: str | None = None, fecha_inicio = None, fecha_fin = None) -> list[dict]:
        where_clauses = []
        params = {}
        if estado:
            where_clauses.append('s."Estado" = :estado')
            params["estado"] = estado
        if fecha_inicio:
            where_clauses.append('s."FechaSolicitud" >= :fecha_inicio')
            params["fecha_inicio"] = fecha_inicio
        if fecha_fin:
            where_clauses.append('s."FechaSolicitud" <= :fecha_fin')
            params["fecha_fin"] = fecha_fin

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        sql = f"""
            SELECT s.*, c."NombreCaja", cat."NombreCategoria"
            FROM "SolicitudCajaChica" s
            JOIN "Caja" c ON s."IdCaja" = c."IdCaja"
            LEFT JOIN "CategoriaMovimientoCaja" cat ON s."IdCategoriaMovimientoCaja" = cat."IdCategoriaMovimientoCaja"
            {where_sql}
            ORDER BY s."FechaSolicitud" DESC, s."IdSolicitudCajaChica" DESC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def ObtenerSolicitudCajaChicaPorId(self, id_solicitud: int) -> dict | None:
        sql = """
            SELECT s.*, c."NombreCaja", cat."NombreCategoria"
            FROM "SolicitudCajaChica" s
            JOIN "Caja" c ON s."IdCaja" = c."IdCaja"
            LEFT JOIN "CategoriaMovimientoCaja" cat ON s."IdCategoriaMovimientoCaja" = cat."IdCategoriaMovimientoCaja"
            WHERE s."IdSolicitudCajaChica" = :id_solicitud;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_solicitud": id_solicitud})

    def GenerarCodigoSolicitud(self, fecha_solicitud) -> str:
        # Generar formato SC + YYMM + Correlativo de 2 dígitos, ej: SC260801
        anio_mes = fecha_solicitud.strftime("%y%m")
        prefijo = f"SC{anio_mes}"
        sql = """
            SELECT "CodigoSolicitud" 
            FROM "SolicitudCajaChica"
            WHERE "CodigoSolicitud" LIKE :patron
            ORDER BY "CodigoSolicitud" DESC
            LIMIT 1;
        """
        ultimo = self.caller.LlamarUnRegistro(sql, {"patron": f"{prefijo}%"})
        if ultimo and ultimo.get("CodigoSolicitud"):
            try:
                num = int(ultimo["CodigoSolicitud"][-2:]) + 1
                return f"{prefijo}{num:02d}"
            except Exception:
                pass
        return f"{prefijo}01"

    def CrearSolicitudCajaChica(self, datos: dict) -> dict:
        sql = """
            INSERT INTO "SolicitudCajaChica" (
                "CodigoSolicitud", "IdCaja", "FechaSolicitud", "NombreSolicitante",
                "CargoSolicitante", "MontoSolicitado", "DestinoJustificacion",
                "NombreEntregadoPor", "NombreAprobadoPor", "Estado",
                "IdCategoriaMovimientoCaja", "RespaldoDoc"
            ) VALUES (
                :CodigoSolicitud, :IdCaja, :FechaSolicitud, :NombreSolicitante,
                :CargoSolicitante, :MontoSolicitado, :DestinoJustificacion,
                :NombreEntregadoPor, :NombreAprobadoPor, :Estado,
                :IdCategoriaMovimientoCaja, :RespaldoDoc
            )
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, datos)

    def ActualizarSolicitudCajaChica(self, id_solicitud: int, datos: dict) -> dict | None:
        set_clauses = [f'"{k}" = :{k}' for k in datos.keys()]
        sql = f"""
            UPDATE "SolicitudCajaChica"
            SET {", ".join(set_clauses)}
            WHERE "IdSolicitudCajaChica" = :id_solicitud
            RETURNING *;
        """
        params = dict(datos)
        params["id_solicitud"] = id_solicitud
        return self.caller.LlamarUnRegistro(sql, params)
