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

export default function GestionCajaChicaOperativa({ usuario, modo = "operativo" }) {
  // modo: "operativo" (Kevin) | "gerencial" (Don Osvaldo)
  const [vista, setVista] = useState(modo === "gerencial" ? "gerencial" : "solicitudes");
  const [solicitudes, setSolicitudes] = useState([]);
  const [pendientesGerencia, setPendientesGerencia] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  // Modales
  const [modalNuevaOpen, setModalNuevaOpen] = useState(false);
  const [modalEntregaOpen, setModalEntregaOpen] = useState(false);
  const [modalRendirOpen, setModalRendirOpen] = useState(false);
  const [modalGerenciaOpen, setModalGerenciaOpen] = useState(false);
  const [modalImprimirOpen, setModalImprimirOpen] = useState(false);

  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState(null);
  const [datosImpresion, setDatosImpresion] = useState(null);

  // Formulario Solicitud (Kevin)
  const [formNueva, setFormNueva] = useState({
    solicitante: usuario?.NombreCompleto || "Kevin Poveda",
    departamento: "Contabilidad",
    monto_solicitado: "",
    justificacion: "",
    IdSucursal: 1
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
  }, [vista, filtroEstado]);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      if (vista === "gerencial") {
        const data = await ListarPendientesGerencia();
        setPendientesGerencia(Array.isArray(data) ? data : (data.items || []));
      } else {
        const data = await ObtenerSolicitudesCajaChica({
          estado: filtroEstado === "TODOS" ? null : filtroEstado,
          limit: 50
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
        IdSucursal: 1
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
        "ACCESO DENEGADO (403): La impresión formal está bloqueada hasta contar con la firma y aprobación de Don Osvaldo (Gerencia)."
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-lg">
            <Receipt className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
              Administración de Caja Chica Desacoplada
            </h1>
            <p className="text-xs text-slate-500">
              Ciclo Operativo: Solicitud → Entrega Fondos → Rendición con Respaldos → Aprobación Don Osvaldo → Egreso en Caja
            </p>
          </div>
        </div>

        {/* Selector de Vista: Operativa (Kevin) vs Gerencial (Don Osvaldo) */}
        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold">
          <button
            onClick={() => setVista("solicitudes")}
            className={`px-3 py-1.5 rounded-md transition-all ${
              vista === "solicitudes"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
            }`}
          >
            Bandeja Operativa (Kevin)
          </button>
          <button
            onClick={() => setVista("gerencial")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              vista === "gerencial"
                ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs font-bold"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Aprobación Don Osvaldo (Gerencia)
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA OPERATIVA (KEVIN) */}
      {/* ========================================================================= */}
      {vista === "solicitudes" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Filtrar Estado:</span>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
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
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold gap-1.5 h-8"
            >
              <PlusCircle className="h-4 w-4" />
              Nuevo Vale de Caja Chica
            </Button>
          </div>

          {/* Tabla de Vales */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 font-semibold uppercase text-[11px] border-b">
                  <tr>
                    <th className="p-3">Código / Fecha</th>
                    <th className="p-3">Solicitante</th>
                    <th className="p-3">Justificación</th>
                    <th className="p-3 text-right">Monto Pedido</th>
                    <th className="p-3 text-right">Monto Entregado</th>
                    <th className="p-3 text-right">Gasto Real</th>
                    <th className="p-3 text-right text-emerald-600">Reintegro</th>
                    <th className="p-3 text-center">Estado Flujo</th>
                    <th className="p-3 text-center">Firma Gerencia</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cargando ? (
                    <tr>
                      <td colSpan="10" className="p-8 text-center text-slate-400">
                        Cargando vales de caja chica...
                      </td>
                    </tr>
                  ) : solicitudes.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="p-8 text-center text-slate-400">
                        No se encontraron vales con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    solicitudes.map((sol) => {
                      const idSol = sol.IdSolicitudCajaChica || sol.id;
                      const estado = sol.Estado || "PENDIENTE";
                      const estadoGerencia = sol.AprobacionGerencia || "PENDIENTE";

                      return (
                        <tr key={idSol} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-100">
                            {sol.CodigoSolicitud || `VALE-${idSol}`}
                            <span className="block font-normal text-[10px] text-slate-400">
                              {sol.FechaSolicitud ? sol.FechaSolicitud.split("T")[0] : "-"}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-slate-700 dark:text-slate-200">
                            {sol.NombreSolicitante || sol.solicitante}
                          </td>
                          <td className="p-3 text-slate-600 max-w-xs truncate">
                            {sol.DestinoJustificacion || sol.justificacion}
                          </td>
                          <td className="p-3 text-right font-medium">
                            Bs. {Number(sol.MontoSolicitado || 0).toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-semibold text-amber-600">
                            {sol.MontoEntregado ? `Bs. ${Number(sol.MontoEntregado).toFixed(2)}` : "-"}
                          </td>
                          <td className="p-3 text-right font-semibold text-blue-600">
                            {sol.MontoGastoReal ? `Bs. ${Number(sol.MontoGastoReal).toFixed(2)}` : "-"}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-600">
                            {sol.MontoReintegro ? `Bs. ${Number(sol.MontoReintegro).toFixed(2)}` : "-"}
                          </td>
                          <td className="p-3 text-center">
                            <Badge
                              className={`text-[10px] font-bold ${
                                estado === "PENDIENTE"
                                  ? "bg-amber-100 text-amber-800"
                                  : estado === "ENTREGADO"
                                  ? "bg-purple-100 text-purple-800"
                                  : estado === "RENDIDO"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {estado}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            {estadoGerencia === "APROBADO" ? (
                              <Badge className="bg-emerald-100 text-emerald-800 gap-1 text-[10px]">
                                <Unlock className="h-3 w-3" /> Aprobado
                              </Badge>
                            ) : estadoGerencia === "RECHAZADO" ? (
                              <Badge className="bg-red-100 text-red-800 gap-1 text-[10px]">
                                <XCircle className="h-3 w-3" /> Rechazado
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-700 gap-1 text-[10px]">
                                <Lock className="h-3 w-3 text-amber-600" /> Pendiente
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-center">
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
                                  className="h-7 text-[11px] font-semibold text-purple-600 hover:text-purple-800"
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
                                  className="h-7 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  Rendir Cuentas
                                </Button>
                              )}

                              {/* 3. Imprimir Vale (candado si no aprobado) */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleImprimirVale(sol)}
                                className={`h-7 text-[11px] font-semibold gap-1 ${
                                  estadoGerencia === "APROBADO"
                                    ? "text-blue-600 hover:text-blue-800"
                                    : "text-slate-400 hover:text-slate-600"
                                }`}
                              >
                                {estadoGerencia === "APROBADO" ? (
                                  <Printer className="h-3.5 w-3.5" />
                                ) : (
                                  <Lock className="h-3.5 w-3.5 text-amber-500" />
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
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA GERENCIAL (DON OSVALDO) */}
      {/* ========================================================================= */}
      {vista === "gerencial" && (
        <div className="space-y-4">
          <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-xl border border-purple-200 dark:border-purple-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-bold text-sm text-purple-900 dark:text-purple-200">
                  Bandeja Ejecutiva de Don Osvaldo
                </h3>
                <p className="text-xs text-purple-700 dark:text-purple-300">
                  Vales rendidos por Kevin pendientes de revisión y firma gerencial para su registro contable en caja.
                </p>
              </div>
            </div>
            <Badge className="bg-purple-600 text-white text-xs font-bold px-2.5 py-1">
              {pendientesGerencia.length} pendientes
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cargando ? (
              <div className="col-span-2 p-12 text-center text-slate-400">
                Cargando bandeja de gerencia...
              </div>
            ) : pendientesGerencia.length === 0 ? (
              <div className="col-span-2 p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-xl border">
                🎉 No hay vales de caja chica pendientes de aprobación gerencial.
              </div>
            ) : (
              pendientesGerencia.map((sol) => (
                <div
                  key={sol.IdSolicitudCajaChica}
                  className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
                >
                  <div className="flex justify-between items-start border-b pb-3">
                    <div>
                      <span className="font-mono font-extrabold text-blue-600 block text-sm">
                        {sol.CodigoSolicitud}
                      </span>
                      <p className="text-xs text-slate-500 font-medium">
                        Solicitado por: {sol.NombreSolicitante} ({sol.DepartamentoSolicitante})
                      </p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800 font-bold">
                      RENDIDO POR KEVIN
                    </Badge>
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
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">ENTREGADO</span>
                      <span className="font-bold text-slate-700">
                        Bs. {Number(sol.MontoEntregado || 0).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-blue-500 block font-semibold">GASTADO REAL</span>
                      <span className="font-extrabold text-blue-600">
                        Bs. {Number(sol.MontoGastoReal || 0).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-500 block font-semibold">REINTEGRO</span>
                      <span className="font-bold text-emerald-600">
                        Bs. {Number(sol.MontoReintegro || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Botones de Acción de Don Osvaldo */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => {
                        setSolicitudSeleccionada(sol);
                        setModalGerenciaOpen(true);
                      }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-8 gap-1"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Aprobar Egreso (Bs. {Number(sol.MontoGastoReal || 0).toFixed(2)})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSolicitudSeleccionada(sol);
                        setObservacionGerencia("Rechazado por inconsistencia en comprobantes");
                        handleResolverGerencia(false);
                      }}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 h-8"
                    >
                      Rechazar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL NUEVA SOLICITUD (KEVIN) */}
      {/* ========================================================================= */}
      <Dialog open={modalNuevaOpen} onOpenChange={setModalNuevaOpen}>
        <DialogContent className="w-full sm:max-w-md p-6 bg-white dark:bg-slate-900 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-blue-600" />
              Solicitud de Vale de Caja Chica
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCrearSolicitud} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Solicitante:</label>
              <Input
                value={formNueva.solicitante}
                onChange={(e) => setFormNueva({ ...formNueva, solicitante: e.target.value })}
                required
                className="text-xs h-8"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Monto Solicitado (Bs):</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ej. 700"
                  value={formNueva.monto_solicitado}
                  onChange={(e) => setFormNueva({ ...formNueva, monto_solicitado: e.target.value })}
                  required
                  className="text-xs h-8"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Sucursal:</label>
                <select
                  value={formNueva.IdSucursal}
                  onChange={(e) => setFormNueva({ ...formNueva, IdSucursal: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="1">Sucursal Sucre</option>
                  <option value="2">Sucursal Potosí</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Justificación del Gasto:</label>
              <Input
                placeholder="Ej. Compra menor de repuestos para rebobinadora..."
                value={formNueva.justificacion}
                onChange={(e) => setFormNueva({ ...formNueva, justificacion: e.target.value })}
                required
                className="text-xs h-8"
              />
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9">
              Crear Solicitud (PENDIENTE)
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL ENTREGAR FONDOS */}
      {/* ========================================================================= */}
      <Dialog open={modalEntregaOpen} onOpenChange={setModalEntregaOpen}>
        <DialogContent className="w-full sm:max-w-sm p-6 bg-white dark:bg-slate-900 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Coins className="h-5 w-5 text-purple-600" />
              Entrega de Fondos en Efectivo
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEntregarFondos} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Monto Entregado (Bs):</label>
              <Input
                type="number"
                step="0.01"
                value={formEntrega.monto_entregado}
                onChange={(e) => setFormEntrega({ ...formEntrega, monto_entregado: e.target.value })}
                required
                className="text-xs h-8"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Entregado Por:</label>
              <Input
                value={formEntrega.entregado_por}
                onChange={(e) => setFormEntrega({ ...formEntrega, entregado_por: e.target.value })}
                required
                className="text-xs h-8"
              />
            </div>
            <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-9">
              Confirmar Entrega de Fondos (ENTREGADO)
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL RENDICIÓN DE CUENTAS (CON COMPROBANTE Y CÁLCULO DE REINTEGRO) */}
      {/* ========================================================================= */}
      <Dialog open={modalRendirOpen} onOpenChange={setModalRendirOpen}>
        <DialogContent className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto p-6 bg-white dark:bg-slate-900 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              Rendición de Cuentas & Facturas (Kevin)
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRendirGasto} className="space-y-4 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg flex justify-between items-center">
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">VALE:</span>
                <span className="font-bold">{solicitudSeleccionada?.CodigoSolicitud}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block font-semibold text-[10px]">FONDOS ENTREGADOS:</span>
                <span className="font-extrabold text-purple-600 text-sm">
                  Bs. {Number(solicitudSeleccionada?.MontoEntregado || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Desglose de Facturas y Recibos */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Desglose de Gastos Realizados:
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={agregarItemRendicion}
                  className="h-6 text-[10px] font-semibold"
                >
                  + Agregar Fila
                </Button>
              </div>

              {itemsRendicion.map((it, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2 items-center bg-slate-50 dark:bg-slate-800 p-2 rounded">
                  <Input
                    placeholder="Concepto"
                    value={it.Concepto}
                    onChange={(e) => {
                      const nuevo = [...itemsRendicion];
                      nuevo[idx].Concepto = e.target.value;
                      setItemsRendicion(nuevo);
                    }}
                    required
                    className="text-xs h-7"
                  />
                  <Input
                    placeholder="N° Factura / Recibo"
                    value={it.NroFactura}
                    onChange={(e) => {
                      const nuevo = [...itemsRendicion];
                      nuevo[idx].NroFactura = e.target.value;
                      setItemsRendicion(nuevo);
                    }}
                    className="text-xs h-7"
                  />
                  <Input
                    placeholder="Proveedor"
                    value={it.Proveedor}
                    onChange={(e) => {
                      const nuevo = [...itemsRendicion];
                      nuevo[idx].Proveedor = e.target.value;
                      setItemsRendicion(nuevo);
                    }}
                    className="text-xs h-7"
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
                    className="text-xs h-7 font-bold"
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
                className="text-xs cursor-pointer"
              />
            </div>

            {/* Cómputo Automático de Reintegro */}
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Total Gastado Real:</span>
                <span className="font-bold text-blue-600">Bs. {calcularTotalGastoReal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>Reintegro en Efectivo a Caja:</span>
                <span className={`text-sm ${calcularReintegro() >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  Bs. {calcularReintegro().toFixed(2)}
                </span>
              </div>
            </div>

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9">
              Enviar Rendición a Gerencia (RENDIDO)
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL RESOLUCIÓN GERENCIAL (DON OSVALDO) */}
      {/* ========================================================================= */}
      <Dialog open={modalGerenciaOpen} onOpenChange={setModalGerenciaOpen}>
        <DialogContent className="w-full sm:max-w-md p-6 bg-white dark:bg-slate-900 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
              Aprobación Gerencial - Don Osvaldo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 rounded-lg">
              <p className="font-bold text-purple-900 dark:text-purple-200">
                Al confirmar la aprobación gerencial:
              </p>
              <ul className="list-disc pl-4 text-purple-700 dark:text-purple-300 space-y-0.5 mt-1 text-[11px]">
                <li>Se registra automáticamente el egreso contable en el Libro de Caja por el monto real de Bs. {Number(solicitudSeleccionada?.MontoGastoReal || 0).toFixed(2)}.</li>
                <li>Se autoriza y desbloquea la emisión física e impresión formal del vale.</li>
              </ul>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Observaciones Gerenciales (Opcional):
              </label>
              <Input
                placeholder="Aprobado y verificado conforme por Gerencia General"
                value={observacionGerencia}
                onChange={(e) => setObservacionGerencia(e.target.value)}
                className="text-xs h-8"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleResolverGerencia(true)}
                disabled={resolviendoGerencia}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9"
              >
                {resolviendoGerencia ? "Registrando Asiento..." : "Firmar & Aprobar Egreso"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleResolverGerencia(false)}
                disabled={resolviendoGerencia}
                className="text-xs font-semibold text-red-600 hover:text-red-700 h-9"
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
        <DialogContent className="w-full sm:max-w-lg p-6 bg-white rounded-xl">
          <DialogHeader className="border-b pb-2 flex justify-between items-center">
            <DialogTitle className="text-sm font-bold text-slate-900">
              Vale Oficial de Caja Chica - Comprobante de Egreso
            </DialogTitle>
          </DialogHeader>

          {datosImpresion && (
            <div className="p-4 border border-slate-300 rounded text-xs space-y-4">
              <div className="text-center border-b pb-2">
                <h3 className="font-extrabold text-sm uppercase">PAPELERA BLANQUITA</h3>
                <p className="text-[10px] text-slate-500">VALE DE EGRESO CAJA CHICA N° {datosImpresion.CodigoSolicitud}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-slate-400">Solicitante:</span> <span className="font-bold">{datosImpresion.NombreSolicitante}</span></div>
                <div><span className="text-slate-400">Departamento:</span> <span className="font-semibold">{datosImpresion.DepartamentoSolicitante}</span></div>
                <div><span className="text-slate-400">Monto Entregado:</span> <span>Bs. {Number(datosImpresion.MontoEntregado || 0).toFixed(2)}</span></div>
                <div><span className="text-slate-400">Gasto Real Asentado:</span> <span className="font-bold text-blue-600">Bs. {Number(datosImpresion.MontoGastoReal || 0).toFixed(2)}</span></div>
                <div><span className="text-slate-400">Reintegro a Caja:</span> <span className="font-bold text-emerald-600">Bs. {Number(datosImpresion.MontoReintegro || 0).toFixed(2)}</span></div>
                <div><span className="text-slate-400">Aprobado por:</span> <span className="font-bold text-purple-700">DON OSVALDO (GERENCIA)</span></div>
              </div>

              <div className="pt-8 grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="border-t border-slate-400 pt-1">Firma Solicitante</div>
                <div className="border-t border-slate-400 pt-1">Firma Tesorería</div>
                <div className="border-t border-slate-400 pt-1 font-bold">Firma Don Osvaldo</div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button onClick={() => window.print()} className="bg-blue-600 text-white text-xs h-8">
              <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir Documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
