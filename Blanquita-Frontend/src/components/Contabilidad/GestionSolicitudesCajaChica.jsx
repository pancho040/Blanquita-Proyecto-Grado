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
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2.5">
            <Receipt className="h-7 w-7 text-[#20A7DB]" />
            Caja Chica
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Solicitudes de gastos menores, autorizaciones y rendición de descargos.
          </p>
        </div>

        <Button
          onClick={() => setModalNuevaOpen(true)}
          className="bg-[#20A7DB] hover:bg-[#1992c0] text-white flex items-center gap-2 shadow-xs"
        >
          <PlusCircle className="h-4 w-4" />
          Nueva Solicitud
        </Button>
      </div>

      {/* Tarjetas Resumen desde el Servidor */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase">Pendientes</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {kpis.Pendientes || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase">Aprobadas / En Curso</span>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {kpis.Aprobadas || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase">Rendidas / Cerradas</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {kpis.Rendidas || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase">Rechazadas</span>
          <div className="text-2xl font-bold text-rose-600 mt-1">
            {kpis.Rechazadas || 0}
          </div>
        </div>
      </div>

      {/* Tabla con Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por N° SC, solicitante, departamento..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
              className="pl-9 h-9 bg-white text-sm"
            />
          </div>

          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium text-slate-600">
            {["TODOS", "Pendiente", "Aprobada", "Rendida", "Rechazada"].map((est) => (
              <button
                key={est}
                onClick={() => {
                  setFiltroEstado(est);
                  setPagina(1);
                }}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  filtroEstado === est ? "bg-[#20A7DB] text-white" : "hover:text-slate-900"
                }`}
              >
                {est}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">N° Solicitud</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Solicitante / Dpto.</th>
                <th className="py-3 px-4">Justificación / Motivo</th>
                <th className="py-3 px-4 text-right">Monto Solicitado</th>
                <th className="py-3 px-4 text-right">Gastado Real</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    Cargando solicitudes de caja chica...
                  </td>
                </tr>
              ) : solicitudes.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    No se encontraron solicitudes con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                solicitudes.map((s) => (
                  <tr key={s.IdSolicitud} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-xs text-[#20A7DB]">
                      {s.NumeroSolicitud}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {s.FechaSolicitud
                        ? new Date(s.FechaSolicitud).toLocaleDateString("es-BO")
                        : "-"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 text-xs">{s.Solicitante}</div>
                      <div className="text-xs text-slate-400">{s.Departamento || "General"}</div>
                    </td>
                    <td className="py-3 px-4 max-w-xs text-xs text-slate-600 truncate" title={s.Justificacion}>
                      {s.Justificacion}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800">
                      Bs. {Number(s.MontoSolicitado || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-slate-600">
                      {s.MontoGastado != null ? `Bs. ${Number(s.MontoGastado).toFixed(2)}` : "-"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        className={
                          s.Estado === "Pendiente"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : s.Estado === "Aprobada"
                            ? "bg-blue-100 text-blue-800 border-blue-300"
                            : s.Estado === "Rendida"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : "bg-rose-100 text-rose-800 border-rose-300"
                        }
                      >
                        {s.Estado}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Ver Vale */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSolicitudSeleccionada(s);
                            setModalValeOpen(true);
                          }}
                          className="h-7 px-2 text-slate-500 hover:text-slate-800"
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
                              className="h-7 px-2 text-blue-600 border-blue-200 hover:bg-blue-50 text-xs"
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
                              className="h-7 px-2 text-rose-600 hover:bg-rose-50 text-xs"
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
                            className="h-7 px-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-xs flex items-center gap-1"
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
        <DialogContent className="w-full sm:max-w-2xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Receipt className="h-5 w-5 text-[#20A7DB]" />
              Nueva Solicitud de Caja Chica (SC)
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCrearSolicitud} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nombre del Solicitante *
              </label>
              <Input
                required
                value={formNueva.solicitante}
                onChange={(e) => setFormNueva({ ...formNueva, solicitante: e.target.value })}
                placeholder="Ej: Miguel Ángel Rojas (Mecánico)"
                className="text-sm"
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
                  className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#20A7DB]"
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
                  className="font-bold text-base h-9"
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
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalNuevaOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardandoNueva} className="bg-[#20A7DB] hover:bg-[#1992c0] text-white">
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
        <DialogContent className="w-full sm:max-w-lg p-6 sm:p-7">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              Aprobar Vale {solicitudSeleccionada?.NumeroSolicitud}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600 py-1">
            <p>
              ¿Confirma la entrega de <strong>Bs. {Number(solicitudSeleccionada?.MontoSolicitado || 0).toFixed(2)}</strong> en efectivo a <strong>{solicitudSeleccionada?.Solicitante}</strong>?
            </p>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalAprobarOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAprobar} disabled={guardandoAccion} className="bg-blue-600 hover:bg-blue-700 text-white">
              {guardandoAccion ? "Aprobando..." : "Confirmar y Desembolsar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* MODAL RECHAZAR */}
      {modalRechazarOpen && (
      <Dialog open={modalRechazarOpen} onOpenChange={setModalRechazarOpen}>
        <DialogContent className="w-full sm:max-w-lg p-6 sm:p-7">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <XCircle className="h-5 w-5 text-rose-600" />
              Rechazar Solicitud
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-700 block">
              Motivo del Rechazo *
            </label>
            <Textarea
              rows={2}
              required
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Indique el motivo por el cual no procede..."
              className="text-xs"
            />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalRechazarOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRechazar} disabled={guardandoAccion} className="bg-rose-600 hover:bg-rose-700 text-white">
              {guardandoAccion ? "Rechazando..." : "Confirmar Rechazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* MODAL RENDIR / DESCARGO */}
      {modalRendirOpen && (
      <Dialog open={modalRendirOpen} onOpenChange={setModalRendirOpen}>
        <DialogContent className="w-full sm:max-w-2xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <FileCheck className="h-5 w-5 text-emerald-600" />
              Rendición de Cuentas: {solicitudSeleccionada?.NumeroSolicitud}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRendir} className="space-y-3.5 pt-1">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs grid grid-cols-2 gap-2">
              <div><strong>Solicitante:</strong> {solicitudSeleccionada?.Solicitante}</div>
              <div><strong>Monto Entregado:</strong> Bs. {Number(solicitudSeleccionada?.MontoSolicitado || 0).toFixed(2)}</div>
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
                className="font-bold text-base h-9"
              />
              {solicitudSeleccionada && (
                <div className="text-xs mt-1 font-semibold">
                  {parseFloat(formRendir.monto_gastado || 0) < Number(solicitudSeleccionada.MontoSolicitado || 0) ? (
                    <span className="text-emerald-700">
                       Vuelto a devolver en caja: Bs.{" "}
                      {(Number(solicitudSeleccionada.MontoSolicitado || 0) - parseFloat(formRendir.monto_gastado || 0)).toFixed(2)}
                    </span>
                  ) : parseFloat(formRendir.monto_gastado || 0) > Number(solicitudSeleccionada.MontoSolicitado || 0) ? (
                    <span className="text-amber-700">
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
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalRendirOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardandoAccion} className="bg-emerald-600 hover:bg-emerald-700 text-white">
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
        <DialogContent className="w-full sm:max-w-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Printer className="h-5 w-5 text-[#20A7DB]" />
              Vale de Retiro de Caja Chica
            </DialogTitle>
          </DialogHeader>

          {solicitudSeleccionada && (
            <div className="border-2 border-slate-300 rounded-xl p-5 bg-white space-y-4 font-sans text-xs">
              {/* Encabezado Vale */}
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <div className="font-extrabold text-base text-slate-800">SHEMA ASOCIADOS S.R.L.</div>
                  <div className="text-slate-500 text-[11px]">Papel Blanquita - Sucre, Bolivia</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-sm text-[#20A7DB]">
                    {solicitudSeleccionada.NumeroSolicitud}
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    {new Date(solicitudSeleccionada.FechaSolicitud).toLocaleDateString("es-BO")}
                  </div>
                </div>
              </div>

              {/* Cuerpo Vale */}
              <div className="grid grid-cols-2 gap-3 py-1">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Solicitado por:</span>
                  <span className="font-bold text-slate-800 text-sm">{solicitudSeleccionada.Solicitante}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Área:</span>
                  <span className="font-semibold text-slate-700">{solicitudSeleccionada.Departamento}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase">Concepto / Justificación:</span>
                <p className="text-slate-700 mt-1 font-medium">{solicitudSeleccionada.Justificacion}</p>
              </div>

              <div className="flex justify-between items-center p-3 bg-[#20A7DB]/10 rounded-lg border border-[#20A7DB]/30">
                <span className="font-bold text-slate-700 uppercase">Importe Total Entregado:</span>
                <span className="font-extrabold text-lg text-[#20A7DB]">
                  Bs. {Number(solicitudSeleccionada?.MontoSolicitado || 0).toFixed(2)}
                </span>
              </div>

              {/* Firmas de Autorización */}
              <div className="grid grid-cols-3 gap-2 pt-8 text-center text-[10px] text-slate-500">
                <div className="border-t border-slate-300 pt-1">
                  <div>Solicitante</div>
                  <div className="font-semibold text-slate-700 truncate">{solicitudSeleccionada.Solicitante}</div>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <div>Autorizado por</div>
                  <div className="font-semibold text-slate-700">Contabilidad / Gerencia</div>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <div>Recibido conforme</div>
                  <div className="font-semibold text-slate-700">Firma y C.I.</div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalValeOpen(false)}>
              Cerrar
            </Button>
            <Button
              onClick={() => {
                window.print();
              }}
              className="bg-[#20A7DB] hover:bg-[#1992c0] text-white flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" />
              Imprimir Vale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
