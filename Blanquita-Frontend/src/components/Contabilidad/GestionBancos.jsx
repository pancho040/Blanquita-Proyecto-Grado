import React, { useState, useEffect } from "react";
import {
  Landmark,
  PlusCircle,
  Building2,
  CreditCard,
  Edit,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ObtenerCuentasBancarias,
  CrearCuentaBancaria,
  ActualizarCuentaBancaria,
  ObtenerMovimientosCaja,
} from "@/services/Contabilidad/tesoreriaService";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { cache, invalidateContabilidad } from "@/lib/cacheService";

export default function GestionBancos({ usuario }) {
  const [bancos, setBancos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [bancoSeleccionado, setBancoSeleccionado] = useState(null);
  const [movimientosBanco, setMovimientosBanco] = useState([]);
  const [cargandoMovs, setCargandoMovs] = useState(false);

  // Paginación de movimientos de la cuenta
  const [paginaMovs, setPaginaMovs] = useState(1);
  const [limiteMovs, setLimiteMovs] = useState(25);
  const [totalMovs, setTotalMovs] = useState(0);
  const [totalPaginasMovs, setTotalPaginasMovs] = useState(1);

  // Modales
  const [modalNuevoOpen, setModalNuevoOpen] = useState(false);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);

  // Formulario
  const [formBanco, setFormBanco] = useState({
    nombre_banco: "",
    numero_cuenta: "",
    tipo_cuenta: "Corriente",
    tipo_moneda: "BOB",
    titular: "Shema Asociados S.R.L.",
    saldo_actual: "0",
  });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarBancos();
  }, []);

  const cargarBancos = async (forzar = false) => {
    try {
      if (!forzar) {
        const cached = cache.get("contabilidad:cuentasBancarias");
        if (cached) {
          setBancos(cached);
          setCargando(false);
          if (cached.length > 0 && !bancoSeleccionado) {
            seleccionarBanco(cached[0], 1);
          }
          return;
        }
      }

      setCargando(true);
      const data = await ObtenerCuentasBancarias(false);
      const lista = Array.isArray(data) ? data : (data?.items || []);
      setBancos(lista);
      cache.set("contabilidad:cuentasBancarias", lista, 300);

      if (lista.length > 0 && !bancoSeleccionado) {
        seleccionarBanco(lista[0], 1);
      }
    } catch (err) {
      toast.error("Error al cargar cuentas bancarias: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  const seleccionarBanco = async (banco, pag = 1) => {
    setBancoSeleccionado(banco);
    try {
      setCargandoMovs(true);
      const res = await ObtenerMovimientosCaja({
        idCuentaBancaria: banco.IdCuentaBancaria,
        page: pag,
        limit: limiteMovs,
      });
      const items = Array.isArray(res) ? res : (res?.items || []);
      setMovimientosBanco(items);
      setTotalMovs(res?.total != null ? res.total : items.length);
      setTotalPaginasMovs(res?.total_paginas || 1);
      setPaginaMovs(pag);
    } catch (err) {
      toast.error("Error al cargar movimientos del banco: " + err.message);
    } finally {
      setCargandoMovs(false);
    }
  };

  const handleCrearBanco = async (e) => {
    e.preventDefault();
    if (!formBanco.nombre_banco.trim() || !formBanco.numero_cuenta.trim()) {
      toast.error("Complete el nombre del banco y número de cuenta");
      return;
    }

    try {
      setGuardando(true);
      await CrearCuentaBancaria({
        nombre_banco: formBanco.nombre_banco.trim(),
        numero_cuenta: formBanco.numero_cuenta.trim(),
        tipo_cuenta: formBanco.tipo_cuenta,
        tipo_moneda: formBanco.tipo_moneda,
        titular: formBanco.titular.trim() || "Shema Asociados S.R.L.",
        saldo_actual: parseFloat(formBanco.saldo_actual) || 0,
      });

      toast.success("¡Cuenta bancaria registrada exitosamente!");
      invalidateContabilidad();
      setModalNuevoOpen(false);
      setFormBanco({
        nombre_banco: "",
        numero_cuenta: "",
        tipo_cuenta: "Corriente",
        tipo_moneda: "BOB",
        titular: "Shema Asociados S.R.L.",
        saldo_actual: "0",
      });
      await cargarBancos(true);
    } catch (err) {
      toast.error(err.message || "Error al crear cuenta bancaria");
    } finally {
      setGuardando(false);
    }
  };

  const handleEditarBanco = async (e) => {
    e.preventDefault();
    if (!bancoSeleccionado) return;

    try {
      setGuardando(true);
      await ActualizarCuentaBancaria(bancoSeleccionado.IdCuentaBancaria, {
        nombre_banco: formBanco.nombre_banco.trim(),
        numero_cuenta: formBanco.numero_cuenta.trim(),
        tipo_cuenta: formBanco.tipo_cuenta,
        tipo_moneda: formBanco.tipo_moneda,
        titular: formBanco.titular.trim(),
        saldo_actual: parseFloat(formBanco.saldo_actual) || 0,
      });

      toast.success("Cuenta bancaria actualizada");
      invalidateContabilidad();
      setModalEditarOpen(false);
      await cargarBancos(true);
    } catch (err) {
      toast.error(err.message || "Error al actualizar");
    } finally {
      setGuardando(false);
    }
  };

  const abrirEditar = (b) => {
    setFormBanco({
      nombre_banco: b.NombreBanco,
      numero_cuenta: b.NumeroCuenta,
      tipo_cuenta: b.TipoCuenta || "Corriente",
      tipo_moneda: b.TipoMoneda || "BOB",
      titular: b.Titular || "Shema Asociados S.R.L.",
      saldo_actual: b.SaldoActual.toString(),
    });
    setModalEditarOpen(true);
  };

  // Calcular saldo total en BOB y USD
  const totalBOB = bancos
    .filter((b) => b.TipoMoneda === "BOB")
    .reduce((acc, b) => acc + (parseFloat(b.SaldoActual) || 0), 0);

  const totalUSD = bancos
    .filter((b) => b.TipoMoneda === "USD")
    .reduce((acc, b) => acc + (parseFloat(b.SaldoActual) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2.5">
            <Landmark className="h-7 w-7 text-[#20A7DB]" />
            Cuentas Bancarias
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Control de saldos y movimientos bancarios.
          </p>
        </div>

        <Button
          onClick={() => setModalNuevoOpen(true)}
          className="bg-[#20A7DB] hover:bg-[#1992c0] text-white flex items-center gap-2 shadow-xs"
        >
          <PlusCircle className="h-4 w-4" />
          Nueva Cuenta
        </Button>
      </div>

      {/* Resumen de Fondos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#20A7DB] to-[#1479a0] text-white p-5 rounded-2xl shadow-sm">
          <span className="text-xs uppercase font-semibold text-white/80">Disponibilidad en Bolivianos (BOB)</span>
          <div className="text-3xl font-extrabold mt-2">
            Bs. {totalBOB.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-white/80 mt-1 block">Consolidado en cuentas nacionales</span>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white p-5 rounded-2xl shadow-sm">
          <span className="text-xs uppercase font-semibold text-white/80">Disponibilidad en Dólares (USD)</span>
          <div className="text-3xl font-extrabold mt-2">
            $us. {totalUSD.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-white/80 mt-1 block">Cuentas en moneda extranjera</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs uppercase font-semibold text-slate-400">Total Cuentas Activas</span>
          <div className="text-3xl font-bold text-slate-800 mt-2">
            {bancos.filter((b) => b.Activo).length} de {bancos.length}
          </div>
          <span className="text-xs text-slate-400">Banco Unión, BNB, BMSC</span>
        </div>
      </div>

      {/* Grid de Tarjetas Bancarias */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {bancos.map((b) => {
          const esUnion = b.NombreBanco.toLowerCase().includes("unión") || b.NombreBanco.toLowerCase().includes("union");
          const esBnb = b.NombreBanco.toLowerCase().includes("bnb");
          const esSeleccionado = bancoSeleccionado?.IdCuentaBancaria === b.IdCuentaBancaria;

          return (
            <div
              key={b.IdCuentaBancaria}
              onClick={() => seleccionarBanco(b, 1)}
              className={`cursor-pointer rounded-2xl p-5 transition-all relative overflow-hidden border-2 ${
                esSeleccionado
                  ? "border-[#20A7DB] shadow-md ring-2 ring-[#20A7DB]/20"
                  : "border-slate-200 hover:border-slate-300 shadow-xs bg-white"
              }`}
            >
              {/* Encabezado Tarjeta */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Building2
                    className={`h-5 w-5 ${
                      esUnion ? "text-blue-600" : esBnb ? "text-emerald-700" : "text-[#20A7DB]"
                    }`}
                  />
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">{b.NombreBanco}</h3>
                    <span className="text-[11px] text-slate-400">{b.TipoCuenta}</span>
                  </div>
                </div>

                <Badge
                  className={
                    b.TipoMoneda === "USD"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold"
                      : "bg-blue-100 text-blue-800 border-blue-300 font-bold"
                  }
                >
                  {b.TipoMoneda}
                </Badge>
              </div>

              {/* Número de Cuenta y Titular */}
              <div className="mt-4 text-xs font-semibold text-slate-600 tracking-wider">
                {b.NumeroCuenta}
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">{b.Titular}</div>

              {/* Saldo y Acción */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-end">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Saldo Actual</span>
                  <span className="text-xl font-extrabold text-slate-800">
                    {b.TipoMoneda === "USD" ? "$us. " : "Bs. "}
                    {Number(b.SaldoActual || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirEditar(b);
                  }}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700"
                  title="Editar cuenta"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Historial de Movimientos de la Cuenta Seleccionada */}
      {bancoSeleccionado && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#20A7DB]" />
              <h2 className="font-bold text-sm text-slate-800">
                Movimientos: {bancoSeleccionado.NombreBanco} ({bancoSeleccionado.NumeroCuenta})
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Total {totalMovs} transacciones
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">N° Comprobante</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Beneficiario / Glosa</th>
                  <th className="py-3 px-4 text-center">Tipo</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cargandoMovs ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      Cargando movimientos bancarios...
                    </td>
                  </tr>
                ) : movimientosBanco.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      No se registran movimientos asociados a esta cuenta bancaria.
                    </td>
                  </tr>
                ) : (
                  movimientosBanco.map((m) => (
                    <tr key={m.IdMovimiento} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {m.FechaMovimiento ? new Date(m.FechaMovimiento).toLocaleDateString("es-BO") : "-"}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                        {m.NumeroComprobante || `MOV-${m.IdMovimiento}`}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-800">
                        {m.NombreCategoria || "General"}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-xs text-slate-600" title={m.Glosa}>
                        {m.Beneficiario ? <strong>{m.Beneficiario} - </strong> : null}
                        {m.Glosa}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {m.Tipo === "Ingreso" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">
                            + Ingreso
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-xs">
                            - Egreso
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                        <span className={m.Tipo === "Ingreso" ? "text-emerald-700" : "text-rose-700"}>
                          Bs. {Number(m.Monto || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación Estandarizada de Movimientos */}
          <PaginacionTabla
            paginaActual={paginaMovs}
            totalPaginas={totalPaginasMovs}
            totalItems={totalMovs}
            pageSize={limiteMovs}
            indiceInicio={movimientosBanco.length > 0 ? (paginaMovs - 1) * limiteMovs + 1 : 0}
            indiceFin={Math.min(paginaMovs * limiteMovs, totalMovs)}
            puedeRetroceder={paginaMovs > 1}
            puedeAvanzar={paginaMovs < totalPaginasMovs}
            cambiarPagina={(p) => seleccionarBanco(bancoSeleccionado, p)}
            cambiarPageSize={(nuevo) => {
              setLimiteMovs(nuevo);
              seleccionarBanco(bancoSeleccionado, 1);
            }}
            opcionesPageSize={[10, 25, 50, 100]}
          />
        </div>
      )}

      {/* MODAL NUEVA CUENTA */}
      {modalNuevoOpen && (
      <Dialog open={modalNuevoOpen} onOpenChange={setModalNuevoOpen}>
        <DialogContent className="w-full sm:max-w-2xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Landmark className="h-5 w-5 text-[#20A7DB]" />
              Registrar Cuenta Bancaria
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCrearBanco} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Entidad Financiera / Banco *
              </label>
              <Input
                required
                value={formBanco.nombre_banco}
                onChange={(e) => setFormBanco({ ...formBanco, nombre_banco: e.target.value })}
                placeholder="Ej: Banco Unión S.A."
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  N° de Cuenta *
                </label>
                <Input
                  required
                  value={formBanco.numero_cuenta}
                  onChange={(e) => setFormBanco({ ...formBanco, numero_cuenta: e.target.value })}
                  placeholder="Ej: 1000003429182"
                  className="text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Moneda *
                </label>
                <select
                  value={formBanco.tipo_moneda}
                  onChange={(e) => setFormBanco({ ...formBanco, tipo_moneda: e.target.value })}
                  className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700"
                >
                  <option value="BOB">Bolivianos (BOB)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Tipo de Cuenta
                </label>
                <select
                  value={formBanco.tipo_cuenta}
                  onChange={(e) => setFormBanco({ ...formBanco, tipo_cuenta: e.target.value })}
                  className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700"
                >
                  <option value="Corriente">Cuenta Corriente</option>
                  <option value="Ahorro">Caja de Ahorro</option>
                  <option value="Efectivo">Caja Efectivo</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Saldo Inicial
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formBanco.saldo_actual}
                  onChange={(e) => setFormBanco({ ...formBanco, saldo_actual: e.target.value })}
                  placeholder="0.00"
                  className="font-bold text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Titular de la Cuenta
              </label>
              <Input
                value={formBanco.titular}
                onChange={(e) => setFormBanco({ ...formBanco, titular: e.target.value })}
                placeholder="Shema Asociados S.R.L."
                className="text-sm"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalNuevoOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando} className="bg-[#20A7DB] hover:bg-[#1992c0] text-white">
                {guardando ? "Guardando..." : "Guardar Cuenta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

      {/* MODAL EDITAR CUENTA */}
      {modalEditarOpen && (
      <Dialog open={modalEditarOpen} onOpenChange={setModalEditarOpen}>
        <DialogContent className="w-full sm:max-w-2xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Edit className="h-5 w-5 text-[#20A7DB]" />
              Actualizar Cuenta Bancaria
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditarBanco} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Entidad Financiera *
              </label>
              <Input
                required
                value={formBanco.nombre_banco}
                onChange={(e) => setFormBanco({ ...formBanco, nombre_banco: e.target.value })}
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  N° de Cuenta *
                </label>
                <Input
                  required
                  value={formBanco.numero_cuenta}
                  onChange={(e) => setFormBanco({ ...formBanco, numero_cuenta: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Saldo Actual
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formBanco.saldo_actual}
                  onChange={(e) => setFormBanco({ ...formBanco, saldo_actual: e.target.value })}
                  className="font-bold text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Titular
              </label>
              <Input
                value={formBanco.titular}
                onChange={(e) => setFormBanco({ ...formBanco, titular: e.target.value })}
                className="text-sm"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalEditarOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando} className="bg-[#20A7DB] hover:bg-[#1992c0] text-white">
                {guardando ? "Actualizando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
