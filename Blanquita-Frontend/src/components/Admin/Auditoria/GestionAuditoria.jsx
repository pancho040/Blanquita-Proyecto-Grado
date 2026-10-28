import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  Eye,
  FileText,
  Clock,
  User,
  Database,
  ArrowRight,
  Download,
  Printer,
  RefreshCw,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ObtenerLogsAuditoria, ObtenerDetalleAuditoria } from "@/services/Admin/AuditService";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import ModuloAdminNav from "@/components/Admin/Common/ModuloAdminNav";

const ACCIONES_COLOR = {
  CREACION: "bg-emerald-100 text-emerald-800 border-emerald-300",
  INSERT: "bg-emerald-100 text-emerald-800 border-emerald-300",
  MODIFICACION: "bg-blue-100 text-blue-800 border-blue-300",
  UPDATE: "bg-blue-100 text-blue-800 border-blue-300",
  ELIMINACION: "bg-rose-100 text-rose-800 border-rose-300",
  DELETE: "bg-rose-100 text-rose-800 border-rose-300",
  CIERRE: "bg-amber-100 text-amber-800 border-amber-300",
  AUTORIZACION: "bg-purple-100 text-purple-800 border-purple-300"
};

export default function GestionAuditoria() {
  const [logs, setLogs] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Filtros y paginación
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(15);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const [busqueda, setBusqueda] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("TODAS");
  const [filtroTabla, setFiltroTabla] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  // Modal detalle de log
  const [modalDetalleAbierto, setModalDetalleAbierto] = useState(false);
  const [logSeleccionado, setLogSeleccionado] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [mostrarJsonTecnico, setMostrarJsonTecnico] = useState(false);

  const calcularDiferencias = (anteriores, nuevos) => {
    if (!anteriores && !nuevos) return [];
    const ant = anteriores && typeof anteriores === "object" ? anteriores : {};
    const nue = nuevos && typeof nuevos === "object" ? nuevos : {};
    const todasLasClaves = Array.from(new Set([...Object.keys(ant), ...Object.keys(nue)]));

    return todasLasClaves
      .map((clave) => {
        const valAnt = ant[clave];
        const valNue = nue[clave];
        const modificado = JSON.stringify(valAnt) !== JSON.stringify(valNue);
        return {
          campo: clave,
          anterior: valAnt !== undefined ? (typeof valAnt === "object" ? JSON.stringify(valAnt) : String(valAnt)) : "—",
          nuevo: valNue !== undefined ? (typeof valNue === "object" ? JSON.stringify(valNue) : String(valNue)) : "—",
          modificado,
        };
      })
      .filter((item) => item.modificado);
  };

  const cargarLogs = async (silencioso = false) => {
    try {
      if (!silencioso) setCargando(true);
      const res = await ObtenerLogsAuditoria({
        page: pagina,
        limit: limite,
        accion: filtroAccion !== "TODAS" ? filtroAccion : "",
        tabla: filtroTabla,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        busqueda: busqueda.trim()
      });

      setLogs(res.items || []);
      setTotalRegistros(res.total || 0);
      setTotalPaginas(res.total_paginas || 1);
    } catch (err) {
      if (!silencioso) toast.error("Error al cargar registros de auditoría");
    } finally {
      if (!silencioso) setCargando(false);
    }
  };

  useEffect(() => {
    cargarLogs();
  }, [pagina, limite, filtroAccion, filtroTabla, fechaInicio, fechaFin]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPagina(1);
      cargarLogs(true);
    }, 350);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const handleVerDetalle = async (item) => {
    try {
      setMostrarJsonTecnico(false);
      setCargandoDetalle(true);
      setModalDetalleAbierto(true);
      const detalle = await ObtenerDetalleAuditoria(item.IdAuditLog);
      setLogSeleccionado(detalle);
    } catch (err) {
      toast.error("Error al obtener detalle del evento de auditoría");
      setModalDetalleAbierto(false);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <ModuloAdminNav pestanaActiva="modificaciones" />
      {/* 1. CABECERA */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Historial de Modificaciones y Acciones
          </h2>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => cargarLogs()}
            disabled={cargando}
            className="h-9 text-xs font-semibold text-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${cargando ? "animate-spin text-[#20A7DB]" : ""}`} />
            <span>Actualizar</span>
          </Button>

          <a href="/admin/auditoria/reportes">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 border-sky-300 text-sky-700 hover:bg-sky-50 text-xs font-semibold gap-1.5 shadow-2xs"
            >
              <FileText className="h-4 w-4 text-sky-600" />
              <span>Centro de Reportes</span>
            </Button>
          </a>

          <Button
            type="button"
            size="sm"
            onClick={handleImprimir}
            className="h-9 bg-[#20A7DB] hover:bg-[#188cba] text-white text-xs font-semibold gap-1.5 shadow-2xs"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimir</span>
          </Button>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por detalle, tabla o ID de registro..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div>
            <select
              value={filtroAccion}
              onChange={(e) => {
                setFiltroAccion(e.target.value);
                setPagina(1);
              }}
              className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-800 shadow-xs focus:border-[#20A7DB] focus:outline-none"
            >
              <option value="TODAS">Todas las Acciones</option>
              <option value="CREACION">Creación / Inserción</option>
              <option value="MODIFICACION">Modificación / Edición</option>
              <option value="ELIMINACION">Eliminación / Borrado</option>
              <option value="CIERRE">Cierre de Caja / Turno</option>
              <option value="AUTORIZACION">Autorización / Aprobación</option>
            </select>
          </div>

          <div>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => {
                setFechaInicio(e.target.value);
                setPagina(1);
              }}
              title="Fecha inicial"
              className="h-9 text-xs font-mono"
            />
          </div>

          <div>
            <Input
              type="date"
              value={fechaFin}
              onChange={(e) => {
                setFechaFin(e.target.value);
                setPagina(1);
              }}
              title="Fecha final"
              className="h-9 text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* 3. TABLA DE REGISTROS DE AUDITORÍA */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Fecha y Hora</th>
                <th className="py-3 px-4">Usuario Responsable</th>
                <th className="py-3 px-4">Acción</th>
                <th className="py-3 px-4">Módulo / Tabla</th>
                <th className="py-3 px-4">Registro Afectado</th>
                <th className="py-3 px-4">Detalle Operativo</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#20A7DB] mb-2" />
                    <span>Cargando registros...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    No se encontraron eventos registrados con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                logs.map((item) => {
                  const badgeClass =
                    ACCIONES_COLOR[item.Accion] || "bg-slate-100 text-slate-700 border-slate-300";

                  return (
                    <tr key={item.IdAuditLog} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {item.FechaHora
                          ? new Date(item.FechaHora).toLocaleString("es-BO", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit"
                            })
                          : "-"}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block truncate max-w-[180px]">
                          {item.NombreUsuario || `Usuario #${item.IdUsuario}`}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          {item.NombreRol || "Personal Operativo"}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}
                        >
                          {item.Accion}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {item.TablaAfectada}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-500">
                        {item.IdRegistroAfectado ? `#${item.IdRegistroAfectado}` : "-"}
                      </td>

                      <td className="py-3 px-4 text-slate-600 max-w-[260px] truncate" title={item.Detalle}>
                        {item.Detalle || "Operación regular"}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerDetalle(item)}
                          className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                          title="Inspeccionar trazabilidad y cambios de datos"
                        >
                          <Eye className="h-4 w-4 text-[#20A7DB]" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <PaginacionTabla
          paginaActual={pagina}
          totalPaginas={totalPaginas}
          totalItems={totalRegistros}
          itemsPorPagina={limite}
          onCambiarPagina={(p) => setPagina(p)}
          onCambiarLimite={(l) => {
            setLimite(l);
            setPagina(1);
          }}
        />
      </div>

      {/* 4. MODAL DETALLE DE TRAZABILIDAD (DATOS ANTERIORES VS NUEVOS) */}
      <Dialog open={modalDetalleAbierto} onOpenChange={setModalDetalleAbierto}>
        <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
          <DialogHeader className="border-b border-slate-100 pb-3 flex flex-row items-center justify-between">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#20A7DB]" />
              <span>Inspección de Registro de Auditoría #{logSeleccionado?.IdAuditLog}</span>
            </DialogTitle>
          </DialogHeader>

          {cargandoDetalle ? (
            <div className="py-20 flex flex-col justify-center items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#20A7DB]" />
              <p className="text-xs text-slate-500 font-medium">Recuperando trazabilidad transaccional...</p>
            </div>
          ) : !logSeleccionado ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No se pudo obtener el detalle del evento.
            </div>
          ) : (
            <div className="space-y-5">
              {/* FICHA INFORMATIVA */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block font-medium">Usuario Responsable:</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {logSeleccionado.NombreUsuario}
                  </span>
                  <span className="text-[11px] text-slate-500">{logSeleccionado.NombreRol}</span>
                </div>

                <div>
                  <span className="text-slate-500 block font-medium">Fecha y Hora Exacta:</span>
                  <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                    {logSeleccionado.FechaHora
                      ? new Date(logSeleccionado.FechaHora).toLocaleString("es-BO")
                      : "-"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block font-medium">Acción & Entidad:</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-bold text-slate-900">{logSeleccionado.Accion}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-mono text-slate-700">{logSeleccionado.TablaAfectada}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block font-medium">Registro Afectado:</span>
                  <span className="font-mono font-medium text-slate-700 mt-0.5 block">
                    {logSeleccionado.IdRegistroAfectado ? `#${logSeleccionado.IdRegistroAfectado}` : "N/A"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Descripción Operativa del Evento:
                </span>
                <p className="text-xs text-slate-800 bg-white border border-slate-200 p-3 rounded-lg">
                  {logSeleccionado.Detalle || "Operación registrada automáticamente por el servidor."}
                </p>
              </div>

              {/* TABLA VISUAL DE MODIFICACIONES REALIZADAS */}
              {(() => {
                const diffs = calcularDiferencias(logSeleccionado.DatosAnteriores, logSeleccionado.DatosNuevos);
                if (diffs.length > 0) {
                  return (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                          Modificaciones Realizadas ({diffs.length} {diffs.length === 1 ? "campo modificado" : "campos modificados"})
                        </span>
                        <Badge variant="outline" className="text-[11px] font-semibold text-blue-700 border-blue-200 bg-blue-50">
                          Acción: {logSeleccionado.Accion}
                        </Badge>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200 uppercase">
                            <tr>
                              <th className="py-2.5 px-3">Campo / Propiedad</th>
                              <th className="py-2.5 px-3 bg-rose-50/60 text-rose-800">Valor Anterior</th>
                              <th className="py-2.5 px-3 bg-emerald-50/60 text-emerald-800">Valor Modificado / Nuevo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            {diffs.map((d) => (
                              <tr key={d.campo} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                  {d.campo}
                                </td>
                                <td className="py-2.5 px-3 text-rose-700 bg-rose-50/30">
                                  <span className="inline-block line-through opacity-85 mr-1">{d.anterior}</span>
                                </td>
                                <td className="py-2.5 px-3 text-emerald-700 font-medium bg-emerald-50/30">
                                  {d.nuevo}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* REGISTRO TÉCNICO JSON PLEGABLE */}
              <div className="pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    Estructura técnica de datos
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMostrarJsonTecnico(!mostrarJsonTecnico)}
                    className="h-7 text-[11px] text-slate-600 font-medium"
                  >
                    {mostrarJsonTecnico ? "Ocultar JSON" : "Ver Datos en Crudo (JSON)"}
                  </Button>
                </div>

                {mostrarJsonTecnico && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                        Estado Anterior
                      </span>
                      <div className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-[11px] max-h-56 overflow-y-auto">
                        {logSeleccionado.DatosAnteriores ? (
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(logSeleccionado.DatosAnteriores, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-slate-500">
                            Sin estado previo (Registro nuevo / Creación inicial)
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#20A7DB] block mb-1.5">
                        Estado Posterior / Modificado
                      </span>
                      <div className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-[11px] max-h-56 overflow-y-auto">
                        {logSeleccionado.DatosNuevos ? (
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(logSeleccionado.DatosNuevos, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-slate-500">
                            Sin datos posteriores (Registro eliminado)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="border-t border-slate-100 pt-3">
                <Button type="button" variant="outline" onClick={() => setModalDetalleAbierto(false)}>
                  Cerrar Inspección
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
