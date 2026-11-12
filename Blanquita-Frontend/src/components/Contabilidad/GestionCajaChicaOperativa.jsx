import React, { useState, useEffect } from "react";
import {
  Receipt,
  PlusCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  Calendar,
  User,
  Building,
  Printer,
  Clock,
  Coins,
  ArrowRight,
  UploadCloud,
  Lock,
  Unlock,
  AlertCircle,
  Eye,
  FileCheck,
  ShieldCheck,
  TrendingDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ObtenerSolicitudesCajaChica,
  CrearSolicitudCajaChica,
  EntregarFondosCajaChica,
  RendirGastoCajaChica,
  ResolverAprobacionGerencial,
  ImprimirValeCajaChica,
  ListarPendientesGerencia
} from "@/services/Contabilidad/tesoreriaService";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";

export default function GestionCajaChicaOperativa({ usuario, modo = "operativo" }) {
  // modo: "operativo" (Kevin) | "gerencial" (Don Osvaldo)
  const {
    sucursal,
    setSucursal,
    sucursales,
    cargando: cargandoSucursal,
    esMultisede,
    nombreSucursalActual,
  } = usePaginaSucursal({
    usuario,
    permiteTodas: modo === "gerencial",
  });

  const [vista, setVista] = useState(modo === "gerencial" ? "gerencial" : "solicitudes");
  const [solicitudes, setSolicitudes] = useState([]);
  const [pendientesGerencia, setPendientesGerencia] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  // Paginación
  const paginacionSolicitudes = usePaginacion(solicitudes, 10);
  const paginacionGerencia = usePaginacion(pendientesGerencia, 6);

  // Modales
  const [modalNuevaOpen, setModalNuevaOpen] = useState(false);
  const [modalEntregaOpen, setModalEntregaOpen] = useState(false);
  const [modalRendirOpen, setModalRendirOpen] = useState(false);
  const [modalGerenciaOpen, setModalGerenciaOpen] = useState(false);
  const [modalImprimirOpen, setModalImprimirOpen] = useState(false);

  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState(null);
  const [datosImpresion, setDatosImpresion] = useState(null);

  const sucursalEfectivaNum = sucursal !== "todas" && sucursal ? Number(sucursal) : (usuario?.IdSucursal ? Number(usuario.IdSucursal) : 1);

  // Formulario Solicitud (Kevin)
  const [formNueva, setFormNueva] = useState({
    solicitante: usuario?.NombreCompleto || "Kevin Poveda",
    departamento: "Contabilidad",
    monto_solicitado: "",
    justificacion: "",
    IdSucursal: sucursalEfectivaNum
  });

  // Formulario Entrega de Fondos
  const [formEntrega, setFormEntrega] = useState({
    monto_entregado: "",
    entregado_por: "Administración Central"
  });

  // Formulario Rendición de Cuentas (Kevin)
  const [itemsRendicion, setItemsRendicion] = useState([
    { Concepto: "", NroFactura: "", Proveedor: "", Monto: "" }
  ]);
  const [archivoComprobante, setArchivoComprobante] = useState(null);
  const [respaldoDoc, setRespaldoDoc] = useState("");

  // Formulario Aprobación Don Osvaldo
  const [observacionGerencia, setObservacionGerencia] = useState("");
  const [resolviendoGerencia, setResolviendoGerencia] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, [vista, filtroEstado, sucursal]);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      if (vista === "gerencial") {
        const data = await ListarPendientesGerencia(sucursal);
        setPendientesGerencia(Array.isArray(data) ? data : (data.items || []));
      } else {
        const data = await ObtenerSolicitudesCajaChica({
          estado: filtroEstado === "TODOS" ? null : filtroEstado,
          limit: 50,
          idSucursal: sucursal,
        });
        setSolicitudes(Array.isArray(data) ? data : (data.items || []));
      }
    } catch (err) {
      toast.error("Error al cargar vales de caja chica: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  // 1. Crear Solicitud
  const handleCrearSolicitud = async (e) => {
    e.preventDefault();
    const monto = parseFloat(formNueva.monto_solicitado);
    if (isNaN(monto) || monto <= 0) {
      toast.error("Ingrese un monto solicitado válido");
      return;
    }
    try {
      await CrearSolicitudCajaChica({
        solicitante: formNueva.solicitante,
        departamento: formNueva.departamento,
        monto_solicitado: monto,
        justificacion: formNueva.justificacion,
        IdSucursal: parseInt(formNueva.IdSucursal)
      });
      toast.success("¡Solicitud de Vale Caja Chica creada (PENDIENTE)!");
      setModalNuevaOpen(false);
      setFormNueva({
        solicitante: usuario?.NombreCompleto || "Kevin Poveda",
        departamento: "Contabilidad",
        monto_solicitado: "",
        justificacion: "",
        IdSucursal: sucursalEfectivaNum
      });
      await cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al crear la solicitud");
    }
  };

  // 2. Entregar Fondos
  const handleEntregarFondos = async (e) => {
    e.preventDefault();
    if (!solicitudSeleccionada) return;
    const monto = parseFloat(formEntrega.monto_entregado);
    if (isNaN(monto) || monto <= 0) {
      toast.error("Ingrese un monto entregado válido");
      return;
    }
    try {
      const idSol = solicitudSeleccionada.IdSolicitudCajaChica || solicitudSeleccionada.id;
      await EntregarFondosCajaChica(idSol, {
        monto_entregado: monto,
        entregado_por: formEntrega.entregado_por
      });
      toast.success("¡Fondos entregados en efectivo exitosamente (ENTREGADO)!");
      setModalEntregaOpen(false);
      await cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al entregar fondos");
    }
  };

  // 3. Rendición de Cuentas (Kevin)
  const agregarItemRendicion = () => {
    setItemsRendicion([
      ...itemsRendicion,
      { Concepto: "", NroFactura: "", Proveedor: "", Monto: "" }
    ]);
  };

  const calcularTotalGastoReal = () => {
    return itemsRendicion.reduce((sum, item) => sum + (parseFloat(item.Monto) || 0), 0);
  };

  const calcularReintegro = () => {
    const entregado = parseFloat(solicitudSeleccionada?.MontoEntregado || solicitudSeleccionada?.MontoSolicitado || 0);
    const gastado = calcularTotalGastoReal();
    return entregado - gastado;
  };

  const handleRendirGasto = async (e) => {
    e.preventDefault();
    if (!solicitudSeleccionada) return;
    const totalGasto = calcularTotalGastoReal();
    if (totalGasto <= 0) {
      toast.error("Debe ingresar al menos un ítem de gasto con monto válido");
      return;
    }

    try {
      const idSol = solicitudSeleccionada.IdSolicitudCajaChica || solicitudSeleccionada.id;
      const payload = {
        Items: itemsRendicion.map((it) => ({
          Concepto: it.Concepto || "Gasto operativo menor",
          NroFactura: it.NroFactura || null,
          Proveedor: it.Proveedor || null,
          Monto: parseFloat(it.Monto) || 0
        })),
        IdComprobanteArchivo: 1, // ID comprobante digital subido
        RespaldoDoc: respaldoDoc || "Comprobantes y recibos rendidos por solicitante"
      };
      await RendirGastoCajaChica(idSol, payload);
      toast.success("¡Rendición de cuentas asentada exitosamente (RENDIDO)!");
      setModalRendirOpen(false);
      await cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al rendir caja chica");
    }
  };

  // 4. Aprobación Gerencial (Don Osvaldo)
  const handleResolverGerencia = async (aprobado) => {
    if (!solicitudSeleccionada) return;
    try {
      setResolviendoGerencia(true);
      const idSol = solicitudSeleccionada.IdSolicitudCajaChica || solicitudSeleccionada.id;
      await ResolverAprobacionGerencial(idSol, {
        Aprobado: aprobado,
        Observaciones: observacionGerencia || (aprobado ? "Aprobado por Gerencia" : "Rechazado")
      });
      toast.success(
        aprobado
          ? "¡Vale de Caja Chica APROBADO! Egreso contable generado en caja."
          : "Vale de Caja Chica RECHAZADO por Gerencia."
      );
      setModalGerenciaOpen(false);
      setObservacionGerencia("");
      await cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al resolver aprobación");
    } finally {
      setResolviendoGerencia(false);
    }
  };

  // 5. Imprimir Vale Formal (Bloqueo si AprobacionGerencia != 'APROBADO')
  const handleImprimirVale = async (sol) => {
    const estadoGerencia = sol.AprobacionGerencia || "PENDIENTE";
    if (estadoGerencia !== "APROBADO") {
      toast.error(
        "ACCESO DENEGADO (403): La impresión formal requiere la aprobación y firma previa de Gerencia."
      );
      return;
    }

    try {
      const idSol = sol.IdSolicitudCajaChica || sol.id;
      const res = await ImprimirValeCajaChica(idSol);
      setDatosImpresion(res);
      setModalImprimirOpen(true);
    } catch (err) {
      toast.error(err.message || "Error al verificar impresión del vale");
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Encabezado */}
      <PageHeader
        title="Administración de Caja Chica"
        subtitle="Ciclo Operativo: Solicitud → Entrega Fondos → Rendición con Respaldos → Aprobación Gerencial → Egreso en Caja"
        icon={Receipt}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {esMultisede && (
              <BranchFilter
                sucursal={sucursal}
                setSucursal={setSucursal}
                sucursales={sucursales}
                cargando={cargandoSucursal}
                permiteTodas={modo === "gerencial"}
              />
            )}
            <div className="flex gap-1 bg-slate-100 p-1 rounded border border-slate-200 text-xs font-medium">
              <button
                onClick={() => setVista("solicitudes")}
                className={`px-3 py-1 rounded transition-colors ${
                  vista === "solicitudes"
                    ? "bg-[#1C96C5] text-white font-semibold"
                    : "text-slate-700 hover:text-slate-900"
                }`}
              >
                Bandeja Operativa
              </button>
              <button
                onClick={() => setVista("gerencial")}
                className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
                  vista === "gerencial"
                    ? "bg-[#1C96C5] text-white font-semibold"
                    : "text-slate-700 hover:text-slate-900"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Aprobación de Gerencia
              </button>
            </div>
          </div>
        }
      />

      {/* ========================================================================= */}
      {/* VISTA OPERATIVA (KEVIN) */}
      {/* ========================================================================= */}
      {vista === "solicitudes" && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 rounded border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Filtrar Estado:</span>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="text-xs px-2.5 h-8 rounded border border-slate-300 bg-white font-medium text-slate-700"
              >
                <option value="TODOS">Todos los Estados</option>
                <option value="PENDIENTE">1. PENDIENTE (Recién Creada)</option>
                <option value="ENTREGADO">2. ENTREGADO (Fondos en Mano)</option>
                <option value="RENDIDO">3. RENDIDO (Con Facturas/Recibos)</option>
                <option value="APROBADO">4. APROBADO (Gerencia)</option>
                <option value="RECHAZADO">5. RECHAZADO</option>
              </select>
            </div>

            <Button
              onClick={() => setModalNuevaOpen(true)}
              className="bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs font-medium gap-1.5 h-8 px-3 rounded border-0"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Nuevo Vale de Caja Chica
            </Button>
          </div>

          {/* Tabla de Vales */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 font-semibold uppercase text-xs border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 text-center">Código / Fecha</th>
                    <th className="py-2 px-3">Solicitante</th>
                    <th className="py-2 px-3">Justificación</th>
                    <th className="py-2 px-3 text-right">Monto Pedido</th>
                    <th className="py-2 px-3 text-right">Monto Entregado</th>
                    <th className="py-2 px-3 text-right">Gasto Real</th>
                    <th className="py-2 px-3 text-right">Reintegro</th>
                    <th className="py-2 px-3 text-center">Estado Flujo</th>
                    <th className="py-2 px-3 text-center">Firma Gerencia</th>
                    <th className="py-2 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cargando ? (
                    <tr>
                      <td colSpan="10" className="py-6 text-center text-xs text-slate-500 font-mono">
                        Cargando vales de caja chica...
                      </td>
                    </tr>
                  ) : solicitudes.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="py-6 text-center text-xs text-slate-500 font-mono">
                        No se encontraron vales con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    paginacionSolicitudes.itemsPaginados.map((sol, idx) => {
                      const idSol = sol.IdSolicitudCajaChica || sol.id || idx;
                      const estado = sol.Estado || "PENDIENTE";
                      const estadoGerencia = sol.AprobacionGerencia || "PENDIENTE";

                      return (
                        <tr key={`sol-${idSol}-${idx}`} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 text-center font-mono font-medium text-slate-900">
                            {sol.CodigoSolicitud || `VALE-${idSol}`}
                            <span className="block font-normal text-[11px] text-slate-500">
                              {sol.FechaSolicitud ? sol.FechaSolicitud.split("T")[0] : "-"}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {sol.NombreSolicitante || sol.solicitante}
                          </td>
                          <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={sol.DestinoJustificacion || sol.justificacion}>
                            {sol.DestinoJustificacion || sol.justificacion}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 font-medium">
                            Bs. {Number(sol.MontoSolicitado || 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-[#B45309]">
                            {sol.MontoEntregado ? `Bs. ${Number(sol.MontoEntregado).toFixed(2)}` : "-"}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-[#0369A1]">
                            {sol.MontoGastoReal ? `Bs. ${Number(sol.MontoGastoReal).toFixed(2)}` : "-"}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-[#15803D]">
                            {sol.MontoReintegro ? `Bs. ${Number(sol.MontoReintegro).toFixed(2)}` : "-"}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                                estado === "PENDIENTE"
                                  ? "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]"
                                  : estado === "ENTREGADO"
                                  ? "bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]"
                                  : estado === "RENDIDO"
                                  ? "bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]"
                                  : "bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]"
                              }`}
                            >
                              {estado}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {estadoGerencia === "APROBADO" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]">
                                <Unlock className="h-3 w-3" /> Aprobado
                              </span>
                            ) : estadoGerencia === "RECHAZADO" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]">
                                <XCircle className="h-3 w-3" /> Rechazado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border bg-slate-100 text-slate-700 border-slate-200">
                                <Lock className="h-3 w-3 text-[#B45309]" /> Pendiente
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* 1. Paso Entregar Fondos (si está PENDIENTE) */}
                              {estado === "PENDIENTE" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSolicitudSeleccionada(sol);
                                    setFormEntrega({
                                      monto_entregado: sol.MontoSolicitado || "",
                                      entregado_por: "Administración Central"
                                    });
                                    setModalEntregaOpen(true);
                                  }}
                                  className="h-7 px-2 text-[11px] font-medium text-slate-700 border-slate-300 hover:bg-slate-50 rounded"
                                >
                                  Entregar Fondos
                                </Button>
                              )}

                              {/* 2. Paso Rendir Cuentas (si está ENTREGADO) */}
                              {estado === "ENTREGADO" && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSolicitudSeleccionada(sol);
                                    setItemsRendicion([
                                      { Concepto: "", NroFactura: "", Proveedor: "", Monto: "" }
                                    ]);
                                    setModalRendirOpen(true);
                                  }}
                                  className="h-7 px-2 text-[11px] font-medium bg-[#15803D] hover:bg-green-800 text-white rounded border-0"
                                >
                                  Rendir Cuentas
                                </Button>
                              )}

                              {/* 3. Imprimir Vale (candado si no aprobado) */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleImprimirVale(sol)}
                                className={`h-7 px-2 text-[11px] font-medium gap-1 rounded ${
                                  estadoGerencia === "APROBADO"
                                    ? "text-[#1C96C5] hover:text-[#157A9E]"
                                    : "text-slate-400 hover:text-slate-600"
                                }`}
                              >
                                {estadoGerencia === "APROBADO" ? (
                                  <Printer className="h-3.5 w-3.5" />
                                ) : (
                                  <Lock className="h-3.5 w-3.5 text-[#B45309]" />
                                )}
                                Imprimir
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {solicitudes.length > 0 && <PaginacionTabla {...paginacionSolicitudes} />}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA GERENCIAL */}
      {/* ========================================================================= */}
      {vista === "gerencial" && (
        <div className="space-y-3">
          <div className="bg-slate-50 p-3 rounded border border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 bg-slate-100 text-[#1C96C5] border border-slate-200 rounded">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-bold text-xs text-slate-900">
                  Bandeja de Autorización Gerencial
                </h3>
                <p className="text-[11px] text-slate-600">
                  Vales rendidos pendientes de revisión y firma gerencial para su registro contable en caja.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]">
              {pendientesGerencia.length} pendiente{pendientesGerencia.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cargando ? (
              <div className="col-span-2 p-8 text-center text-xs text-slate-500 font-mono">
                Cargando bandeja de gerencia...
              </div>
            ) : pendientesGerencia.length === 0 ? (
              <div className="col-span-2 p-8 text-center text-xs text-slate-500 bg-white rounded border border-slate-200">
                No hay vales de caja chica pendientes de aprobación gerencial.
              </div>
            ) : (
              paginacionGerencia.itemsPaginados.map((sol, idx) => (
                <div
                  key={`ger-${sol.IdSolicitudCajaChica || idx}`}
                  className="bg-white p-4 rounded border border-slate-200 space-y-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex justify-between items-start border-b border-slate-100 pb-2.5">
                    <div>
                      <span className="font-mono font-bold text-[#1C96C5] block text-xs">
                        {sol.CodigoSolicitud}
                      </span>
                      <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                        Solicitado por: <span className="text-slate-900">{sol.NombreSolicitante}</span> ({sol.DepartamentoSolicitante})
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]">
                      RENDICIÓN PRESENTADA
                    </span>
                  </div>

                  <div className="text-xs space-y-1">
                    <p className="text-slate-600">
                      <span className="font-semibold text-slate-800">Justificación inicial:</span>{" "}
                      {sol.DestinoJustificacion}
                    </p>
                    <p className="text-slate-600">
                      <span className="font-semibold text-slate-800">Respaldo documental:</span>{" "}
                      {sol.RespaldoDoc || "Facturas y recibos adjuntos"}
                    </p>
                  </div>

                  {/* Cifras comparativas */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded border border-slate-200 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">ENTREGADO</span>
                      <span className="font-bold font-mono tabular-nums text-slate-800">
                        Bs. {Number(sol.MontoEntregado || 0).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#0369A1] block uppercase font-medium">GASTADO REAL</span>
                      <span className="font-bold font-mono tabular-nums text-[#0369A1]">
                        Bs. {Number(sol.MontoGastoReal || 0).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#15803D] block uppercase font-medium">REINTEGRO</span>
                      <span className="font-bold font-mono tabular-nums text-[#15803D]">
                        Bs. {Number(sol.MontoReintegro || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Botones de Acción de Don Osvaldo */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={() => {
                        setSolicitudSeleccionada(sol);
                        setModalGerenciaOpen(true);
                      }}
                      className="flex-1 bg-[#15803D] hover:bg-green-800 text-white text-xs font-medium h-8 gap-1 rounded border-0"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aprobar Egreso (Bs. {Number(sol.MontoGastoReal || 0).toFixed(2)})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSolicitudSeleccionada(sol);
                        setObservacionGerencia("Rechazado por inconsistencia en comprobantes");
                        handleResolverGerencia(false);
                      }}
                      className="text-xs font-medium text-[#B91C1C] border-[#FCA5A5] hover:bg-[#FEF2F2] h-8 px-3 rounded"
                    >
                      Rechazar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          {pendientesGerencia.length > 0 && <PaginacionTabla {...paginacionGerencia} />}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL NUEVA SOLICITUD (KEVIN) */}
      {/* ========================================================================= */}
      <Dialog open={modalNuevaOpen} onOpenChange={setModalNuevaOpen}>
        <DialogContent className="w-full sm:max-w-md p-5 bg-white rounded border border-slate-300">
          <DialogHeader className="pb-2 border-b border-slate-200">
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-[#1C96C5]" />
              Solicitud de Vale de Caja Chica
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCrearSolicitud} className="space-y-3 text-xs pt-2">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Solicitante:</label>
              <Input
                value={formNueva.solicitante}
                onChange={(e) => setFormNueva({ ...formNueva, solicitante: e.target.value })}
                required
                className="text-xs h-8 rounded border-slate-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Monto Solicitado (Bs):</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formNueva.monto_solicitado}
                  onChange={(e) => setFormNueva({ ...formNueva, monto_solicitado: e.target.value })}
                  required
                  className="text-xs h-8 font-mono tabular-nums text-right font-bold rounded border-slate-300"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Sucursal:</label>
                {esMultisede ? (
                  <select
                    value={formNueva.IdSucursal}
                    onChange={(e) => setFormNueva({ ...formNueva, IdSucursal: Number(e.target.value) })}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs font-medium text-slate-700"
                  >
                    {(sucursales || sucursalesPermitidas || []).filter((s) => s.id !== "todas").map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5 h-8 px-2.5 rounded border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold">
                    <Building size={13} className="text-[#1C96C5]" />
                    <span>{nombreSucursalActual}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Justificación del Gasto:</label>
              <Input
                placeholder="Ej. Compra menor de repuestos para rebobinadora..."
                value={formNueva.justificacion}
                onChange={(e) => setFormNueva({ ...formNueva, justificacion: e.target.value })}
                required
                className="text-xs h-8 rounded border-slate-300"
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
              <Button type="submit" className="h-8 px-3 rounded bg-[#1C96C5] hover:bg-[#157A9E] text-white font-medium text-xs border-0">
                Crear Solicitud (PENDIENTE)
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL ENTREGAR FONDOS */}
      {/* ========================================================================= */}
      <Dialog open={modalEntregaOpen} onOpenChange={setModalEntregaOpen}>
        <DialogContent className="w-full sm:max-w-sm p-5 bg-white rounded border border-slate-300">
          <DialogHeader className="pb-2 border-b border-slate-200">
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Coins className="h-4 w-4 text-[#1C96C5]" />
              Entrega de Fondos en Efectivo
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEntregarFondos} className="space-y-3 text-xs pt-2">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Monto Entregado (Bs):</label>
              <Input
                type="number"
                step="0.01"
                value={formEntrega.monto_entregado}
                onChange={(e) => setFormEntrega({ ...formEntrega, monto_entregado: e.target.value })}
                required
                className="text-xs h-8 font-mono tabular-nums text-right font-bold rounded border-slate-300"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Entregado Por:</label>
              <Input
                value={formEntrega.entregado_por}
                onChange={(e) => setFormEntrega({ ...formEntrega, entregado_por: e.target.value })}
                required
                className="text-xs h-8 rounded border-slate-300"
              />
            </div>
            <DialogFooter className="gap-2 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalEntregaOpen(false)}
                className="h-8 px-3 rounded text-xs border border-slate-300 text-slate-700"
              >
                Cancelar
              </Button>
              <Button type="submit" className="h-8 px-3 rounded bg-[#1C96C5] hover:bg-[#157A9E] text-white font-medium text-xs border-0">
                Confirmar Entrega (ENTREGADO)
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL RENDICIÓN DE CUENTAS */}
      {/* ========================================================================= */}
      <Dialog open={modalRendirOpen} onOpenChange={setModalRendirOpen}>
        <DialogContent className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto p-5 bg-white rounded border border-slate-300">
          <DialogHeader className="pb-2 border-b border-slate-200">
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[#15803D]" />
              Rendición de Cuentas & Facturas (Kevin)
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRendirGasto} className="space-y-3 text-xs pt-2">
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded flex justify-between items-center">
              <div>
                <span className="text-slate-500 block font-semibold text-[10px] uppercase">VALE:</span>
                <span className="font-mono font-bold text-slate-900">{solicitudSeleccionada?.CodigoSolicitud}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block font-semibold text-[10px] uppercase">FONDOS ENTREGADOS:</span>
                <span className="font-mono tabular-nums font-bold text-[#0369A1] text-xs">
                  Bs. {Number(solicitudSeleccionada?.MontoEntregado || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Desglose de Facturas y Recibos */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Desglose de Gastos Realizados:
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={agregarItemRendicion}
                  className="h-6 px-2 text-[10px] font-medium border-slate-300 rounded"
                >
                  + Agregar Fila
                </Button>
              </div>

              {itemsRendicion.map((it, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2 items-center bg-slate-50 border border-slate-200 p-2 rounded">
                  <Input
                    placeholder="Concepto"
                    value={it.Concepto}
                    onChange={(e) => {
                      const nuevo = [...itemsRendicion];
                      nuevo[idx].Concepto = e.target.value;
                      setItemsRendicion(nuevo);
                    }}
                    required
                    className="text-xs h-7 rounded border-slate-300"
                  />
                  <Input
                    placeholder="N° Factura / Recibo"
                    value={it.NroFactura}
                    onChange={(e) => {
                      const nuevo = [...itemsRendicion];
                      nuevo[idx].NroFactura = e.target.value;
                      setItemsRendicion(nuevo);
                    }}
                    className="text-xs h-7 rounded border-slate-300 font-mono"
                  />
                  <Input
                    placeholder="Proveedor"
                    value={it.Proveedor}
                    onChange={(e) => {
                      const nuevo = [...itemsRendicion];
                      nuevo[idx].Proveedor = e.target.value;
                      setItemsRendicion(nuevo);
                    }}
                    className="text-xs h-7 rounded border-slate-300"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Monto Bs."
                    value={it.Monto}
                    onChange={(e) => {
                      const nuevo = [...itemsRendicion];
                      nuevo[idx].Monto = e.target.value;
                      setItemsRendicion(nuevo);
                    }}
                    required
                    className="text-xs h-7 font-mono tabular-nums text-right font-bold rounded border-slate-300"
                  />
                </div>
              ))}
            </div>

            {/* Subida Comprobante Digital */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Comprobante Digital / Foto de Respaldo:
              </label>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setArchivoComprobante(e.target.files[0])}
                className="text-xs cursor-pointer h-8 rounded border-slate-300"
              />
            </div>

            {/* Cómputo Automático de Reintegro */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Gastado Real:</span>
                <span className="font-bold font-mono tabular-nums text-[#0369A1]">Bs. {calcularTotalGastoReal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold">
                <span className="text-slate-800">Reintegro en Efectivo a Caja:</span>
                <span className={`font-mono tabular-nums ${calcularReintegro() >= 0 ? "text-[#15803D]" : "text-[#B91C1C]"}`}>
                  Bs. {calcularReintegro().toFixed(2)}
                </span>
              </div>
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
              <Button type="submit" className="h-8 px-3 rounded bg-[#15803D] hover:bg-green-800 text-white font-medium text-xs border-0">
                Enviar Rendición a Gerencia (RENDIDO)
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL RESOLUCIÓN GERENCIAL */}
      {/* ========================================================================= */}
      <Dialog open={modalGerenciaOpen} onOpenChange={setModalGerenciaOpen}>
        <DialogContent className="w-full sm:max-w-md p-5 bg-white rounded border border-slate-300">
          <DialogHeader className="pb-2 border-b border-slate-200">
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#1C96C5]" />
              Aprobación de Gerencia
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs pt-2">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
              <p className="font-bold text-slate-900">
                Al confirmar la aprobación gerencial:
              </p>
              <ul className="list-disc pl-4 text-slate-600 space-y-0.5 mt-1 text-[11px]">
                <li>Se registra automáticamente el egreso contable en el Libro de Caja por el monto real de Bs. {Number(solicitudSeleccionada?.MontoGastoReal || 0).toFixed(2)}.</li>
                <li>Se autoriza y desbloquea la emisión física e impresión formal del vale.</li>
              </ul>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Observaciones de Gerencia (Opcional):
              </label>
              <Input
                placeholder="Aprobado y verificado conforme por Gerencia General"
                value={observacionGerencia}
                onChange={(e) => setObservacionGerencia(e.target.value)}
                className="text-xs h-8 rounded border-slate-300"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-200">
              <Button
                onClick={() => handleResolverGerencia(true)}
                disabled={resolviendoGerencia}
                className="flex-1 bg-[#15803D] hover:bg-green-800 text-white font-medium text-xs h-8 rounded border-0"
              >
                {resolviendoGerencia ? "Registrando Asiento..." : "Firmar y Aprobar Egreso"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleResolverGerencia(false)}
                disabled={resolviendoGerencia}
                className="text-xs font-medium text-[#B91C1C] border-[#FCA5A5] hover:bg-[#FEF2F2] h-8 px-3 rounded"
              >
                Rechazar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL IMPRESIÓN FORMAL VALE DE CAJA CHICA */}
      {/* ========================================================================= */}
      <Dialog open={modalImprimirOpen} onOpenChange={setModalImprimirOpen}>
        <DialogContent className="w-full sm:max-w-lg p-5 bg-white rounded border border-slate-300 print:border-none print:p-0">
          <DialogHeader className="border-b border-slate-200 pb-2 flex justify-between items-center print:hidden">
            <DialogTitle className="text-xs font-bold text-slate-900">
              Vale Oficial de Caja Chica - Comprobante de Egreso
            </DialogTitle>
          </DialogHeader>

          {datosImpresion && (
            <div className="p-4 border border-slate-300 rounded text-xs space-y-3 print:border-none print:p-2">
              <div className="text-center border-b border-slate-900 pb-2">
                <h3 className="font-bold text-sm uppercase text-slate-900">PAPELERA BLANQUITA</h3>
                <p className="text-[10px] text-slate-600 font-mono">VALE DE EGRESO CAJA CHICA N° {datosImpresion.CodigoSolicitud}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-slate-500">Solicitante:</span> <span className="font-bold text-slate-900">{datosImpresion.NombreSolicitante}</span></div>
                <div><span className="text-slate-500">Departamento:</span> <span className="font-medium text-slate-800">{datosImpresion.DepartamentoSolicitante}</span></div>
                <div><span className="text-slate-500">Monto Entregado:</span> <span className="font-mono tabular-nums">Bs. {Number(datosImpresion.MontoEntregado || 0).toFixed(2)}</span></div>
                <div><span className="text-slate-500">Gasto Real Asentado:</span> <span className="font-bold font-mono tabular-nums text-[#0369A1]">Bs. {Number(datosImpresion.MontoGastoReal || 0).toFixed(2)}</span></div>
                <div><span className="text-slate-500">Reintegro a Caja:</span> <span className="font-bold font-mono tabular-nums text-[#15803D]">Bs. {Number(datosImpresion.MontoReintegro || 0).toFixed(2)}</span></div>
                <div><span className="text-slate-500">Aprobado por:</span> <span className="font-bold text-slate-900">GERENCIA GENERAL</span></div>
              </div>

              <div className="pt-6 grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="border-t border-slate-400 pt-1 text-slate-700">Firma Solicitante</div>
                <div className="border-t border-slate-400 pt-1 text-slate-700">Firma Tesorería</div>
                <div className="border-t border-slate-400 pt-1 font-bold text-slate-900">Firma Gerencia</div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 print:hidden">
            <Button onClick={() => window.print()} className="bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs h-8 px-3 rounded font-medium border-0">
              <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir Documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
