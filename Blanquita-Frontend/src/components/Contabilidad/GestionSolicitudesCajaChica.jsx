import React, { useState, useEffect } from "react";
import {
  Receipt,
  PlusCircle,
  CheckCircle2,
  XCircle,
  FileCheck,
  Search,
  Calendar,
  User,
  Building,
  Printer,
  Clock,
  Coins,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  ObtenerSolicitudesCajaChica,
  ObtenerCajaChicaKpis,
  CrearSolicitudCajaChica,
  AprobarSolicitudCajaChica,
  RechazarSolicitudCajaChica,
  DescargarSolicitudCajaChica,
} from "@/services/Contabilidad/tesoreriaService";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { invalidateContabilidad } from "@/lib/cacheService";

export default function GestionSolicitudesCajaChica({ usuario }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);

  // KPIs de servidor
  const [kpis, setKpis] = useState({
    Total: 0,
    Pendientes: 0,
    Aprobadas: 0,
    Rendidas: 0,
    Rechazadas: 0,
    MontoTotalSolicitado: 0,
  });

  // Filtros y paginación
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(15);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);

  // Modales
  const [modalNuevaOpen, setModalNuevaOpen] = useState(false);
  const [modalAprobarOpen, setModalAprobarOpen] = useState(false);
  const [modalRechazarOpen, setModalRechazarOpen] = useState(false);
  const [modalRendirOpen, setModalRendirOpen] = useState(false);
  const [modalValeOpen, setModalValeOpen] = useState(false);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState(null);

  // Formulario Nueva Solicitud
  const [formNueva, setFormNueva] = useState({
    solicitante: "",
    departamento: "Producción",
    monto_solicitado: "",
    justificacion: "",
  });
  const [guardandoNueva, setGuardandoNueva] = useState(false);

  // Formulario Rendición
  const [formRendir, setFormRendir] = useState({
    monto_gastado: "",
    detalle_descargo: "",
  });
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [guardandoAccion, setGuardandoAccion] = useState(false);

  useEffect(() => {
    cargarSolicitudes();
  }, [pagina, filtroEstado]);

  // Debounce búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      cargarSolicitudes();
    }, 350);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const cargarSolicitudes = async () => {
    try {
      setCargando(true);
      const [kpisRes, data] = await Promise.all([
        ObtenerCajaChicaKpis().catch(() => null),
        ObtenerSolicitudesCajaChica({
          page: pagina,
          limit: limite,
          estado: filtroEstado !== "TODOS" ? filtroEstado : null,
          busqueda: busqueda.trim(),
        }),
      ]);

      if (kpisRes) setKpis(kpisRes);

      const items = Array.isArray(data) ? data : (data?.items || []);
      setSolicitudes(items);
      setTotalRegistros(data?.total != null ? data.total : items.length);
      setTotalPaginas(data?.total_paginas || 1);
    } catch (err) {
      toast.error("Error al cargar solicitudes: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  const handleCrearSolicitud = async (e) => {
    e.preventDefault();
    const monto = parseFloat(formNueva.monto_solicitado);
    if (isNaN(monto) || monto <= 0) {
      toast.error("Ingrese un monto válido mayor a 0");
      return;
    }
    if (!formNueva.solicitante.trim() || !formNueva.justificacion.trim()) {
      toast.error("Complete los campos requeridos");
      return;
    }

    try {
      setGuardandoNueva(true);
      await CrearSolicitudCajaChica({
        solicitante: formNueva.solicitante.trim(),
        departamento: formNueva.departamento,
        monto_solicitado: monto,
        justificacion: formNueva.justificacion.trim(),
      });
      toast.success("¡Solicitud de Caja Chica creada exitosamente!");
      invalidateContabilidad();
      setModalNuevaOpen(false);
      setFormNueva({
        solicitante: "",
        departamento: "Producción",
        monto_solicitado: "",
        justificacion: "",
      });
      await cargarSolicitudes();
    } catch (err) {
      toast.error(err.message || "Error al crear solicitud");
    } finally {
      setGuardandoNueva(false);
    }
  };

  const handleAprobar = async () => {
    if (!solicitudSeleccionada) return;
    try {
      setGuardandoAccion(true);
      await AprobarSolicitudCajaChica(solicitudSeleccionada.IdSolicitud, {
        monto_aprobado: solicitudSeleccionada.MontoSolicitado,
      });
      toast.success("Solicitud aprobada y fondo desembolsado");
      invalidateContabilidad();
      setModalAprobarOpen(false);
      await cargarSolicitudes();
    } catch (err) {
      toast.error(err.message || "Error al aprobar solicitud");
    } finally {
      setGuardandoAccion(false);
    }
  };

  const handleRechazar = async () => {
    if (!solicitudSeleccionada || !motivoRechazo.trim()) {
      toast.error("Debe ingresar un motivo de rechazo");
      return;
    }
    try {
      setGuardandoAccion(true);
      await RechazarSolicitudCajaChica(solicitudSeleccionada.IdSolicitud, {
        motivo_rechazo: motivoRechazo.trim(),
      });
      toast.success("Solicitud rechazada");
      invalidateContabilidad();
      setModalRechazarOpen(false);
      setMotivoRechazo("");
      await cargarSolicitudes();
    } catch (err) {
      toast.error(err.message || "Error al rechazar");
    } finally {
      setGuardandoAccion(false);
    }
  };

  const handleRendir = async (e) => {
    e.preventDefault();
    if (!solicitudSeleccionada) return;
    const gastado = parseFloat(formRendir.monto_gastado);
    if (isNaN(gastado) || gastado < 0) {
      toast.error("Ingrese el monto gastado real");
      return;
    }

    try {
      setGuardandoAccion(true);
      await DescargarSolicitudCajaChica(solicitudSeleccionada.IdSolicitud, {
        monto_gastado: gastado,
        detalle_descargo: formRendir.detalle_descargo.trim() || "Descargo con facturas y recibos",
      });
      toast.success("¡Descargo y rendición de caja chica asentada!");
      invalidateContabilidad();
      setModalRendirOpen(false);
      setFormRendir({ monto_gastado: "", detalle_descargo: "" });
      await cargarSolicitudes();
    } catch (err) {
      toast.error(err.message || "Error al rendir solicitud");
    } finally {
      setGuardandoAccion(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded border border-slate-200">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#1C96C5]" />
            Solicitudes de Caja Chica (Vales SC)
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Solicitudes de gastos menores, autorizaciones y rendición de descargos
          </p>
        </div>

        <Button
          onClick={() => setModalNuevaOpen(true)}
          className="bg-[#1C96C5] hover:bg-[#157A9E] text-white flex items-center gap-1.5 h-8 px-3 rounded text-xs font-medium border-0"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Nueva Solicitud
        </Button>
      </div>

      {/* Tarjetas Resumen desde el Servidor */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pendientes</span>
          <div className="text-xl font-bold font-mono tabular-nums text-[#B45309] mt-0.5">
            {kpis.Pendientes || 0}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Aprobadas / En Curso</span>
          <div className="text-xl font-bold font-mono tabular-nums text-[#0369A1] mt-0.5">
            {kpis.Aprobadas || 0}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Rendidas / Cerradas</span>
          <div className="text-xl font-bold font-mono tabular-nums text-[#15803D] mt-0.5">
            {kpis.Rendidas || 0}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Rechazadas</span>
          <div className="text-xl font-bold font-mono tabular-nums text-[#B91C1C] mt-0.5">
            {kpis.Rechazadas || 0}
          </div>
        </div>
      </div>

      {/* Tabla con Filtros */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Buscar por N° SC, solicitante, departamento..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
              className="pl-8 h-8 bg-white text-xs rounded border-slate-300"
            />
          </div>

          <div className="flex rounded border border-slate-200 bg-white p-0.5 text-xs font-medium text-slate-600">
            {["TODOS", "Pendiente", "Aprobada", "Rendida", "Rechazada"].map((est) => (
              <button
                key={est}
                onClick={() => {
                  setFiltroEstado(est);
                  setPagina(1);
                }}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  filtroEstado === est ? "bg-[#1C96C5] text-white" : "hover:text-slate-900"
                }`}
              >
                {est}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="sticky top-0 bg-slate-50 text-slate-600 text-xs uppercase font-semibold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2 px-3 text-center">N° Solicitud</th>
                <th className="py-2 px-3 text-center">Fecha</th>
                <th className="py-2 px-3">Solicitante / Dpto.</th>
                <th className="py-2 px-3">Justificación / Motivo</th>
                <th className="py-2 px-3 text-right">Monto Solicitado</th>
                <th className="py-2 px-3 text-right">Gastado Real</th>
                <th className="py-2 px-3 text-center">Estado</th>
                <th className="py-2 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td colSpan="8" className="py-6 text-center text-xs text-slate-500 font-mono">
                    Cargando solicitudes de caja chica...
                  </td>
                </tr>
              ) : solicitudes.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-6 text-center text-xs text-slate-500 font-mono">
                    No se encontraron solicitudes con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                solicitudes.map((s) => (
                  <tr key={s.IdSolicitud} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-center font-mono font-bold text-xs text-[#1C96C5]">
                      {s.NumeroSolicitud}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-slate-600">
                      {s.FechaSolicitud
                        ? new Date(s.FechaSolicitud).toLocaleDateString("es-BO")
                        : "-"}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-900 text-xs">{s.Solicitante}</div>
                      <div className="text-[11px] text-slate-500">{s.Departamento || "General"}</div>
                    </td>
                    <td className="py-2 px-3 max-w-xs text-xs text-slate-600 truncate" title={s.Justificacion}>
                      {s.Justificacion}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                      Bs. {Number(s.MontoSolicitado || 0).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-xs font-semibold text-slate-700">
                      {s.MontoGastado != null ? `Bs. ${Number(s.MontoGastado).toFixed(2)}` : "-"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                          s.Estado === "Pendiente"
                            ? "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]"
                            : s.Estado === "Aprobada"
                            ? "bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]"
                            : s.Estado === "Rendida"
                            ? "bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]"
                            : "bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]"
                        }`}
                      >
                        {s.Estado}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Ver Vale */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSolicitudSeleccionada(s);
                            setModalValeOpen(true);
                          }}
                          className="h-7 px-2 text-slate-500 hover:text-slate-800 rounded"
                          title="Ver Vale de Retiro"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>

                        {/* Acciones por Estado */}
                        {s.Estado === "Pendiente" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSolicitudSeleccionada(s);
                                setModalAprobarOpen(true);
                              }}
                              className="h-7 px-2 text-[#0369A1] border-[#BAE6FD] hover:bg-[#F0F9FF] text-xs rounded"
                            >
                              Aprobar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSolicitudSeleccionada(s);
                                setModalRechazarOpen(true);
                              }}
                              className="h-7 px-2 text-[#B91C1C] hover:bg-[#FEF2F2] text-xs rounded"
                            >
                              Rechazar
                            </Button>
                          </>
                        )}

                        {s.Estado === "Aprobada" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSolicitudSeleccionada(s);
                              setFormRendir({
                                monto_gastado: (s.MontoSolicitado || "").toString(),
                                detalle_descargo: "",
                              });
                              setModalRendirOpen(true);
                            }}
                            className="h-7 px-2 text-[#15803D] border-[#86EFAC] hover:bg-[#F0FDF4] text-xs flex items-center gap-1 rounded"
                          >
                            <FileCheck className="h-3.5 w-3.5" />
                            Rendir Cuentas
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación Estandarizada */}
        <PaginacionTabla
          paginaActual={pagina}
          totalPaginas={totalPaginas}
          totalItems={totalRegistros}
          pageSize={limite}
          indiceInicio={solicitudes.length > 0 ? (pagina - 1) * limite + 1 : 0}
          indiceFin={Math.min(pagina * limite, totalRegistros)}
          puedeRetroceder={pagina > 1}
          puedeAvanzar={pagina < totalPaginas}
          cambiarPagina={(p) => setPagina(p)}
          cambiarPageSize={(nuevo) => {
            setLimite(nuevo);
            setPagina(1);
          }}
          opcionesPageSize={[10, 15, 25, 50]}
        />
      </div>

      {/* MODAL NUEVA SOLICITUD */}
      {modalNuevaOpen && (
      <Dialog open={modalNuevaOpen} onOpenChange={setModalNuevaOpen}>
        <DialogContent className="w-full sm:max-w-2xl p-5 rounded border border-slate-300 bg-white">
          <DialogHeader className="pb-2 border-b border-slate-200">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Receipt className="h-4 w-4 text-[#1C96C5]" />
              Nueva Solicitud de Caja Chica (SC)
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCrearSolicitud} className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nombre del Solicitante *
              </label>
              <Input
                required
                value={formNueva.solicitante}
                onChange={(e) => setFormNueva({ ...formNueva, solicitante: e.target.value })}
                placeholder="Ej: Miguel Ángel Rojas (Mecánico)"
                className="h-8 text-xs rounded border-slate-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Departamento / Área *
                </label>
                <select
                  value={formNueva.departamento}
                  onChange={(e) => setFormNueva({ ...formNueva, departamento: e.target.value })}
                  className="w-full text-xs h-8 rounded border border-slate-300 bg-white px-2.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="Producción">Producción</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Logística">Logística / Choferes</option>
                  <option value="Administración">Administración</option>
                  <option value="Ventas">Ventas</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Monto Solicitado (Bs.) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.10"
                  required
                  value={formNueva.monto_solicitado}
                  onChange={(e) => setFormNueva({ ...formNueva, monto_solicitado: e.target.value })}
                  placeholder="0.00"
                  className="h-8 font-mono tabular-nums text-right font-bold text-xs rounded border-slate-300"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Motivo / Justificación del Gasto *
              </label>
              <Textarea
                rows={3}
                required
                value={formNueva.justificacion}
                onChange={(e) => setFormNueva({ ...formNueva, justificacion: e.target.value })}
                placeholder="Detalle los insumos, repuestos, almuerzos de personal o compras menores a realizar..."
                className="text-xs rounded border-slate-300"
              />
            </div>

            <DialogFooter className="gap-2 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalNuevaOpen(false)}
                className="h-8 px-3 rounded text-xs border border-slate-300 text-slate-700"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={guardandoNueva}
                className="h-8 px-3 rounded text-xs bg-[#1C96C5] hover:bg-[#157A9E] text-white font-medium border-0"
              >
                {guardandoNueva ? "Guardando..." : "Generar Vale SC"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

      {/* MODAL APROBAR */}
      {modalAprobarOpen && (
      <Dialog open={modalAprobarOpen} onOpenChange={setModalAprobarOpen}>
        <DialogContent className="w-full sm:max-w-lg p-5 rounded border border-slate-300 bg-white">
          <DialogHeader className="pb-2 border-b border-slate-200">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <CheckCircle2 className="h-4 w-4 text-[#15803D]" />
              Aprobar Vale {solicitudSeleccionada?.NumeroSolicitud}
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs text-slate-700 py-2">
            <p>
              ¿Confirma la entrega de <strong className="font-mono tabular-nums">Bs. {Number(solicitudSeleccionada?.MontoSolicitado || 0).toFixed(2)}</strong> en efectivo a <strong>{solicitudSeleccionada?.Solicitante}</strong>?
            </p>
          </div>
          <DialogFooter className="gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={() => setModalAprobarOpen(false)}
              className="h-8 px-3 rounded text-xs border border-slate-300 text-slate-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAprobar}
              disabled={guardandoAccion}
              className="h-8 px-3 rounded text-xs bg-[#15803D] hover:bg-green-800 text-white font-medium border-0"
            >
              {guardandoAccion ? "Aprobando..." : "Confirmar y Desembolsar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* MODAL RECHAZAR */}
      {modalRechazarOpen && (
      <Dialog open={modalRechazarOpen} onOpenChange={setModalRechazarOpen}>
        <DialogContent className="w-full sm:max-w-lg p-5 rounded border border-slate-300 bg-white">
          <DialogHeader className="pb-2 border-b border-slate-200">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <XCircle className="h-4 w-4 text-[#B91C1C]" />
              Rechazar Solicitud
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <label className="text-xs font-semibold text-slate-700 block">
              Motivo del Rechazo *
            </label>
            <Textarea
              rows={2}
              required
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Indique el motivo por el cual no procede..."
              className="text-xs rounded border-slate-300"
            />
          </div>
          <DialogFooter className="gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={() => setModalRechazarOpen(false)}
              className="h-8 px-3 rounded text-xs border border-slate-300 text-slate-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRechazar}
              disabled={guardandoAccion}
              className="h-8 px-3 rounded text-xs bg-[#B91C1C] hover:bg-red-800 text-white font-medium border-0"
            >
              {guardandoAccion ? "Rechazando..." : "Confirmar Rechazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* MODAL RENDIR / DESCARGO */}
      {modalRendirOpen && (
      <Dialog open={modalRendirOpen} onOpenChange={setModalRendirOpen}>
        <DialogContent className="w-full sm:max-w-2xl p-5 rounded border border-slate-300 bg-white">
          <DialogHeader className="pb-2 border-b border-slate-200">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <FileCheck className="h-4 w-4 text-[#15803D]" />
              Rendición de Cuentas: {solicitudSeleccionada?.NumeroSolicitud}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRendir} className="space-y-3 pt-2">
            <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs grid grid-cols-2 gap-2">
              <div><strong className="text-slate-800">Solicitante:</strong> <span className="text-slate-700">{solicitudSeleccionada?.Solicitante}</span></div>
              <div><strong className="text-slate-800">Monto Entregado:</strong> <span className="font-mono tabular-nums text-slate-900">Bs. {Number(solicitudSeleccionada?.MontoSolicitado || 0).toFixed(2)}</span></div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Monto Gastado Real (Bs.) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                value={formRendir.monto_gastado}
                onChange={(e) => setFormRendir({ ...formRendir, monto_gastado: e.target.value })}
                className="h-8 font-mono tabular-nums text-right font-bold text-xs rounded border-slate-300"
              />
              {solicitudSeleccionada && (
                <div className="text-xs mt-1 font-medium font-mono">
                  {parseFloat(formRendir.monto_gastado || 0) < Number(solicitudSeleccionada.MontoSolicitado || 0) ? (
                    <span className="text-[#15803D]">
                      Vuelto a devolver en caja: Bs.{" "}
                      {(Number(solicitudSeleccionada.MontoSolicitado || 0) - parseFloat(formRendir.monto_gastado || 0)).toFixed(2)}
                    </span>
                  ) : parseFloat(formRendir.monto_gastado || 0) > Number(solicitudSeleccionada.MontoSolicitado || 0) ? (
                    <span className="text-[#B45309]">
                      Saldo a favor del solicitante: Bs.{" "}
                      {(parseFloat(formRendir.monto_gastado || 0) - Number(solicitudSeleccionada.MontoSolicitado || 0)).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-slate-500">Gasto exacto sin vuelto</span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Detalle de Descargo y Números de Factura / Recibo
              </label>
              <Textarea
                rows={3}
                value={formRendir.detalle_descargo}
                onChange={(e) => setFormRendir({ ...formRendir, detalle_descargo: e.target.value })}
                placeholder="Ej: Factura N° 1245 Ferretería Sucre por tornillos y arandelas; Recibo N° 45 por almuerzos..."
                className="text-xs rounded border-slate-300"
              />
            </div>

            <DialogFooter className="gap-2 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalRendirOpen(false)}
                className="h-8 px-3 rounded text-xs border border-slate-300 text-slate-700"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={guardandoAccion}
                className="h-8 px-3 rounded text-xs bg-[#15803D] hover:bg-green-800 text-white font-medium border-0"
              >
                {guardandoAccion ? "Registrando..." : "Asentar Rendición"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

      {/* MODAL VISTA VALE DE CAJA CHICA (FORMATO OFICIAL BLANQUITA) */}
      {modalValeOpen && (
      <Dialog open={modalValeOpen} onOpenChange={setModalValeOpen}>
        <DialogContent className="w-full sm:max-w-3xl p-5 rounded border border-slate-300 bg-white print:border-none print:p-0">
          <DialogHeader className="pb-2 border-b border-slate-200 print:hidden">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Printer className="h-4 w-4 text-[#1C96C5]" />
              Vale de Retiro de Caja Chica
            </DialogTitle>
          </DialogHeader>

          {solicitudSeleccionada && (
            <div className="border border-slate-300 rounded p-4 bg-white space-y-3 font-sans text-xs print:border-none print:p-2">
              {/* Encabezado Vale */}
              <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                <div>
                  <div className="font-bold text-sm text-slate-900 uppercase">SHEMA ASOCIADOS S.R.L.</div>
                  <div className="text-slate-600 text-[11px]">Papel Blanquita - Sucre, Bolivia</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-sm text-[#1C96C5]">
                    {solicitudSeleccionada.NumeroSolicitud}
                  </div>
                  <div className="text-slate-500 font-mono text-[10px]">
                    {new Date(solicitudSeleccionada.FechaSolicitud).toLocaleDateString("es-BO")}
                  </div>
                </div>
              </div>

              {/* Cuerpo Vale */}
              <div className="grid grid-cols-2 gap-3 py-1">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Solicitado por:</span>
                  <span className="font-bold text-slate-900 text-xs">{solicitudSeleccionada.Solicitante}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Área:</span>
                  <span className="font-medium text-slate-800">{solicitudSeleccionada.Departamento}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase">Concepto / Justificación:</span>
                <p className="text-slate-800 mt-0.5">{solicitudSeleccionada.Justificacion}</p>
              </div>

              <div className="flex justify-between items-center p-2.5 bg-[#F0F9FF] rounded border border-[#BAE6FD]">
                <span className="font-bold text-slate-800 uppercase text-xs">Importe Total Entregado:</span>
                <span className="font-bold font-mono tabular-nums text-base text-[#0369A1]">
                  Bs. {Number(solicitudSeleccionada?.MontoSolicitado || 0).toFixed(2)}
                </span>
              </div>

              {/* Firmas de Autorización */}
              <div className="grid grid-cols-3 gap-2 pt-6 text-center text-[10px] text-slate-600">
                <div className="border-t border-slate-300 pt-1">
                  <div>Solicitante</div>
                  <div className="font-medium text-slate-900 truncate">{solicitudSeleccionada.Solicitante}</div>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <div>Autorizado por</div>
                  <div className="font-medium text-slate-900">Contabilidad / Gerencia</div>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <div>Recibido conforme</div>
                  <div className="font-medium text-slate-900">Firma y C.I.</div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2 print:hidden">
            <Button
              variant="outline"
              onClick={() => setModalValeOpen(false)}
              className="h-8 px-3 rounded text-xs border border-slate-300 text-slate-700"
            >
              Cerrar
            </Button>
            <Button
              onClick={() => {
                window.print();
              }}
              className="bg-[#1C96C5] hover:bg-[#157A9E] text-white flex items-center gap-1.5 h-8 px-3 rounded text-xs font-medium border-0"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir Vale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
