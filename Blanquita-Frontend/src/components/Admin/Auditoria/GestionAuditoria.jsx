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
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/stores/branchStore";


const ACCIONES_COLOR = {
  CREACION: "bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]",
  INSERT: "bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]",
  MODIFICACION: "bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]",
  UPDATE: "bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]",
  ELIMINACION: "bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]",
  DELETE: "bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]",
  CIERRE: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
  AUTORIZACION: "bg-purple-50 text-purple-800 border-purple-200"
};

export default function GestionAuditoria({ usuario = null }) {
  const {
    sucursal,
    setSucursal,
    esMultisede,
    listoParaConsultar,
    sucursalesPermitidas
  } = usePaginaSucursal({
    permiteTodas: true,
    usuario
  });

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
        busqueda: busqueda.trim(),
        id_sucursal: sucursal === "todas" ? null : Number(sucursal)
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
    if (listoParaConsultar) {
      cargarLogs();
    }
  }, [pagina, limite, filtroAccion, filtroTabla, fechaInicio, fechaFin, sucursal, listoParaConsultar]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPagina(1);
      if (listoParaConsultar) {
        cargarLogs(true);
      }
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
    <div className="space-y-4">
      {/* 1. CABECERA CON PAGEHEADER Y BRANCHFILTER */}
      <PageHeader
        title="Historial de Modificaciones y Acciones"
        subtitle="Registro de trazabilidad y auditoría de eventos de usuarios en el sistema."
        branchFilter={
          <BranchFilter
            sucursal={sucursal}
            onChange={setSucursal}
            sucursales={sucursalesPermitidas}
            esMultisede={esMultisede}
            permiteTodas={true}
          />
        }
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => cargarLogs()}
          disabled={cargando}
          className="h-8 text-xs font-semibold rounded hover:bg-slate-50 text-slate-700"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${cargando ? "animate-spin text-[#1C96C5]" : ""}`} />
          <span>Actualizar</span>
        </Button>

        <a href="/admin/auditoria/reportes">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs font-semibold rounded hover:bg-slate-50 text-slate-700 gap-1.5"
          >
            <FileText className="h-3.5 w-3.5 text-[#1C96C5]" />
            <span>Centro de Reportes</span>
          </Button>
        </a>

        <Button
          type="button"
          size="sm"
          onClick={handleImprimir}
          className="h-8 bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs font-semibold rounded gap-1.5 cursor-pointer border border-transparent shadow-none"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Imprimir</span>
        </Button>
      </PageHeader>

      {/* 2. BARRA DE FILTROS */}
      <div className="bg-white p-3 rounded border border-slate-200 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por detalle, tabla o ID de registro..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8 h-8 text-xs rounded border-slate-300"
            />
          </div>

          <div>
            <select
              value={filtroAccion}
              onChange={(e) => {
                setFiltroAccion(e.target.value);
                setPagina(1);
              }}
              className="w-full h-8 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
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
              className="h-8 text-xs rounded border-slate-300 font-mono"
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
              className="h-8 text-xs rounded border-slate-300 font-mono"
            />
          </div>
        </div>
      </div>

      {/* 3. TABLA DE REGISTROS DE AUDITORÍA */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-700 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Fecha y Hora</th>
                <th className="py-2.5 px-3">Usuario Responsable</th>
                <th className="py-2.5 px-3">Acción</th>
                <th className="py-2.5 px-3">Módulo / Tabla</th>
                <th className="py-2.5 px-3">Registro Afectado</th>
                <th className="py-2.5 px-3">Detalle Operativo</th>
                <th className="py-2.5 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-[#1C96C5] mb-2" />
                    <span>Cargando registros...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-slate-400 text-xs">
                    No se encontraron eventos registrados con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                logs.map((item) => {
                  const badgeClass =
                    ACCIONES_COLOR[item.Accion] || "bg-slate-100 text-slate-700 border-slate-200";

                  return (
                    <tr key={item.IdAuditLog} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap font-mono tabular-nums text-[11px]">
                        {item.FechaHora
                          ? new Date(item.FechaHora).toLocaleString("es-BO", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit"
                            })
                          : "—"}
                      </td>

                      <td className="py-2 px-3">
                        <span className="font-semibold text-slate-900 block truncate max-w-[170px]">
                          {item.NombreUsuario || `Usuario #${item.IdUsuario}`}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          {item.NombreRol || "Personal Operativo"}
                        </span>
                      </td>

                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeClass}`}
                        >
                          {item.Accion}
                        </span>
                      </td>

                      <td className="py-2 px-3 font-medium text-slate-700">
                        {item.TablaAfectada}
                      </td>

                      <td className="py-2 px-3 text-slate-600 font-mono tabular-nums">
                        {item.IdRegistroAfectado ? `#${item.IdRegistroAfectado}` : "—"}
                      </td>

                      <td className="py-2 px-3 text-slate-600 max-w-[250px] truncate" title={item.Detalle}>
                        {item.Detalle || "Operación regular"}
                      </td>

                      <td className="py-2 px-3 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleVerDetalle(item)}
                          className="h-6 w-6 text-slate-400 hover:text-slate-900 rounded cursor-pointer"
                          title="Inspeccionar trazabilidad y cambios de datos"
                        >
                          <Eye className="h-3.5 w-3.5 text-[#1C96C5]" />
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
        <DialogContent className="w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto p-5 rounded border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3 flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#1C96C5]" />
              <span>Inspección de Auditoría #{logSeleccionado?.IdAuditLog}</span>
            </DialogTitle>
          </DialogHeader>

          {cargandoDetalle ? (
            <div className="py-16 flex flex-col justify-center items-center gap-2.5">
              <Loader2 className="h-6 w-6 animate-spin text-[#1C96C5]" />
              <p className="text-xs text-slate-500 font-medium">Recuperando trazabilidad transaccional...</p>
            </div>
          ) : !logSeleccionado ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No se pudo obtener el detalle del evento.
            </div>
          ) : (
            <div className="space-y-4">
              {/* FICHA INFORMATIVA */}
              <div className="bg-slate-50 border border-slate-200 rounded p-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">Usuario Responsable:</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block">
                    {logSeleccionado.NombreUsuario}
                  </span>
                  <span className="text-[10px] text-slate-500">{logSeleccionado.NombreRol}</span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">Fecha y Hora Exacta:</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block font-mono tabular-nums">
                    {logSeleccionado.FechaHora
                      ? new Date(logSeleccionado.FechaHora).toLocaleString("es-BO")
                      : "—"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">Acción & Entidad:</span>
                  <div className="flex items-center gap-1.5 mt-0.5 font-semibold text-slate-900">
                    <span>{logSeleccionado.Accion}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-700">{logSeleccionado.TablaAfectada}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">Registro Afectado:</span>
                  <span className="font-mono tabular-nums text-slate-800 mt-0.5 block font-medium">
                    {logSeleccionado.IdRegistroAfectado ? `#${logSeleccionado.IdRegistroAfectado}` : "N/A"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Descripción Operativa del Evento:
                </span>
                <p className="text-xs text-slate-800 bg-white border border-slate-200 p-2.5 rounded">
                  {logSeleccionado.Detalle || "Operación registrada automáticamente por el servidor."}
                </p>
              </div>

              {/* TABLA VISUAL DE MODIFICACIONES REALIZADAS */}
              {(() => {
                const diffs = calcularDiferencias(logSeleccionado.DatosAnteriores, logSeleccionado.DatosNuevos);
                if (diffs.length > 0) {
                  return (
                    <div className="bg-white border border-slate-200 rounded p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#1C96C5]"></span>
                          Modificaciones Realizadas ({diffs.length} {diffs.length === 1 ? "campo" : "campos"})
                        </span>
                        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border border-sky-200 bg-sky-50 text-sky-800">
                          Acción: {logSeleccionado.Accion}
                        </span>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 rounded">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-700 border-b border-slate-200 uppercase">
                            <tr>
                              <th className="py-2 px-2.5">Campo / Propiedad</th>
                              <th className="py-2 px-2.5 bg-red-50 text-red-800">Valor Anterior</th>
                              <th className="py-2 px-2.5 bg-emerald-50 text-emerald-800">Valor Modificado / Nuevo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {diffs.map((d) => (
                              <tr key={d.campo} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2 px-2.5 font-semibold text-slate-800">
                                  {d.campo}
                                </td>
                                <td className="py-2 px-2.5 text-red-700 bg-red-50/20 font-mono">
                                  <span className="line-through opacity-85 mr-1">{d.anterior}</span>
                                </td>
                                <td className="py-2 px-2.5 text-emerald-700 font-medium bg-emerald-50/20 font-mono">
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
                    className="h-7 text-[11px] text-slate-600 font-medium rounded"
                  >
                    {mostrarJsonTecnico ? "Ocultar JSON" : "Ver Datos en Crudo (JSON)"}
                  </Button>
                </div>

                {mostrarJsonTecnico && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                        Estado Anterior
                      </span>
                      <div className="bg-slate-950 text-slate-200 rounded border border-slate-800 p-2.5 text-[11px] font-mono max-h-52 overflow-y-auto">
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
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#1C96C5] block mb-1">
                        Estado Posterior / Modificado
                      </span>
                      <div className="bg-slate-950 text-slate-200 rounded border border-slate-800 p-2.5 text-[11px] font-mono max-h-52 overflow-y-auto">
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
                <Button type="button" variant="outline" size="sm" onClick={() => setModalDetalleAbierto(false)} className="h-8 text-xs rounded">
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
