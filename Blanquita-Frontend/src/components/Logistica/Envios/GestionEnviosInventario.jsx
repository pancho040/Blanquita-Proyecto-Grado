import React, { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
import {
  Truck,
  PlusCircle,
  FileText,
  Send,
  PackageCheck,
  RefreshCw,
  Eye,
  AlertTriangle
} from "lucide-react";
import StatusBadge from "@/components/common/StatusBadge";
import { SkeletonRow } from "@/components/common/LoadingStates";
import { toast } from "sonner";
import {
  ListarEnvios,
  CrearEnvio,
  DespacharEnvio,
  RecepcionarEnvio,
  AnularEnvio
} from "@/services/Logistica/EnvioService";

export default function GestionEnviosInventario({ usuario = null }) {
  const { sucursal, setSucursal, sucursalesPermitidas, esMultisede, cargando: cargandoAlcance } = usePaginaSucursal({
    usuario,
    permiteTodas: true,
  });

  const [envios, setEnvios] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [cargando, setCargando] = useState(true);

  // Modal Crear
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [formCrear, setFormCrear] = useState({
    numero_guia: "",
    origen_tipo: "PLANTA",
    origen_id: 1,
    destino_tipo: "SUCURSAL",
    destino_id: 2,
    chofer_nombre: "",
    camion_placa: "",
    observaciones: "",
    presentacion_id: 1,
    cantidad_enviada: 100
  });
  const [guardandoCrear, setGuardandoCrear] = useState(false);

  // Modal Recepcionar
  const [envioRecepcionar, setEnvioRecepcionar] = useState(null);
  const [cantidadesRecibidas, setCantidadesRecibidas] = useState({});
  const [motivosMermas, setMotivosMermas] = useState({});
  const [obsRecepcion, setObsRecepcion] = useState("");
  const [guardandoRecep, setGuardandoRecep] = useState(false);

  // Modal Ver Detalle
  const [envioDetalle, setEnvioDetalle] = useState(null);

  const cargarEnvios = useCallback(async () => {
    setCargando(true);
    try {
      const estadoParam = filtroEstado === "TODOS" ? null : filtroEstado;
      const sid = sucursal === "todas" ? null : sucursal;
      const data = await ListarEnvios(estadoParam, sid);
      setEnvios(data || []);
    } catch (err) {
      toast.error(err.message || "Error al cargar la lista de envíos.");
    } finally {
      setCargando(false);
    }
  }, [filtroEstado, sucursal]);

  useEffect(() => {
    if (!cargandoAlcance) {
      cargarEnvios();
    }
  }, [filtroEstado, sucursal, cargandoAlcance, cargarEnvios]);

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!formCrear.numero_guia) {
      toast.error("El número de guía es obligatorio.");
      return;
    }
    setGuardandoCrear(true);
    try {
      await CrearEnvio({
        numero_guia: formCrear.numero_guia,
        origen_tipo: formCrear.origen_tipo,
        origen_id: Number(formCrear.origen_id),
        destino_tipo: formCrear.destino_tipo,
        destino_id: Number(formCrear.destino_id),
        chofer_nombre: formCrear.chofer_nombre,
        camion_placa: formCrear.camion_placa,
        observaciones: formCrear.observaciones,
        detalles: [
          {
            presentacion_id: Number(formCrear.presentacion_id),
            cantidad_enviada: Number(formCrear.cantidad_enviada)
          }
        ]
      });
      toast.success("Envío registrado exitosamente en estado PENDIENTE.");
      setModalCrearAbierto(false);
      cargarEnvios();
    } catch (err) {
      toast.error(err.message || "Error al registrar el envío.");
    } finally {
      setGuardandoCrear(false);
    }
  };

  const handleDespachar = async (id, numeroGuia) => {
    if (!confirm(`¿Confirma el despacho del camión para la Guía ${numeroGuia}? Se descontará atómicamente el stock del origen.`)) {
      return;
    }
    try {
      await DespacharEnvio(id);
      toast.success(`Envío ${numeroGuia} despachado exitosamente (en tránsito).`);
      cargarEnvios();
    } catch (err) {
      toast.error(err.message || "Error al despachar el envío.");
    }
  };

  const abrirRecepcionar = (env) => {
    setEnvioRecepcionar(env);
    const iniciales = {};
    const motivos = {};
    env.detalles.forEach((d) => {
      iniciales[d.presentacion_id] = d.cantidad_enviada;
      motivos[d.presentacion_id] = "";
    });
    setCantidadesRecibidas(iniciales);
    setMotivosMermas(motivos);
    setObsRecepcion("");
  };

  const handleConfirmarRecepcion = async (e) => {
    e.preventDefault();
    setGuardandoRecep(true);
    try {
      const items = envioRecepcionar.detalles.map((d) => {
        const pid = d.presentacion_id;
        const cantRecibida = Number(cantidadesRecibidas[pid]);
        return {
          presentacion_id: pid,
          cantidad_recibida: cantRecibida,
          motivo_merma: cantRecibida < Number(d.cantidad_enviada) ? (motivosMermas[pid] || "Merma/Faltante en recepción") : null
        };
      });

      await RecepcionarEnvio(envioRecepcionar.id, {
        items,
        observaciones: obsRecepcion
      });

      toast.success("Envío recepcionado exitosamente en almacén de sucursal.");
      setEnvioRecepcionar(null);
      cargarEnvios();
    } catch (err) {
      toast.error(err.message || "Error al recepcionar el envío.");
    } finally {
      setGuardandoRecep(false);
    }
  };

  const handleAnular = async (id, numeroGuia) => {
    const motivo = prompt(`Ingrese el motivo de anulación para la Guía ${numeroGuia}:`);
    if (!motivo) return;

    try {
      await AnularEnvio(id, motivo);
      toast.success(`Envío ${numeroGuia} anulado y stock restituido.`);
      cargarEnvios();
    } catch (err) {
      toast.error(err.message || "Error al anular el envío.");
    }
  };

  const renderBadgeEstado = (estado) => {
    return <StatusBadge estado={estado} />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Envíos y Remisiones de Inventario"
        subtitle="Traslados entre fábrica matriz y sucursales (con descuento en planta y control de mermas)"
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
        <button
          onClick={() => setModalCrearAbierto(true)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs font-semibold rounded transition-colors cursor-pointer shadow-none"
        >
          <PlusCircle size={15} />
          Nueva Guía de Remisión
        </button>
        <button
          onClick={cargarEnvios}
          className="p-1.5 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-colors cursor-pointer"
          title="Refrescar envíos"
        >
          <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
        </button>
      </PageHeader>

      {/* Filtros de Estado */}
      <div className="flex flex-wrap gap-1.5">
        {["TODOS", "PENDIENTE", "EN_TRANSITO", "RECEPCIONADO", "ANULADO"].map((est) => (
          <button
            key={est}
            onClick={() => setFiltroEstado(est)}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
              filtroEstado === est
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {est === "TODOS" ? "Todos los Estados" : est.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Tabla de Envíos */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">N° Guía</th>
                <th className="py-2.5 px-3">Origen</th>
                <th className="py-2.5 px-3">Destino</th>
                <th className="py-2.5 px-3">Transporte</th>
                <th className="py-2.5 px-3 text-center">Estado</th>
                <th className="py-2.5 px-3 text-center">Desc. Planta</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {cargando ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <SkeletonRow key={idx} cols={7} rowIdx={idx} />
                ))
              ) : envios.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    No se encontraron remisiones en este estado.
                  </td>
                </tr>
              ) : (
                envios.map((env) => (
                  <tr key={env.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{env.numero_guia}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-slate-900">{env.origen_nombre || `${env.origen_tipo} #${env.origen_id}`}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-slate-900">{env.destino_nombre || `${env.destino_tipo} #${env.destino_id}`}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {env.chofer_nombre ? `${env.chofer_nombre} (${env.camion_placa || "S/P"})` : "Sin chofer"}
                    </td>
                    <td className="py-2.5 px-3 text-center">{renderBadgeEstado(env.estado)}</td>
                    <td className="py-2.5 px-3 text-center">
                      {env.descuento_planta_aplicado ? (
                        <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Aplicado
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-500">No</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1">
                      <button
                        onClick={() => setEnvioDetalle(env)}
                        className="px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-xs font-medium cursor-pointer"
                        title="Ver detalle"
                      >
                        <Eye size={12} className="inline mr-1" />
                        Ver
                      </button>

                      {env.estado === "PENDIENTE" && (
                        <button
                          onClick={() => handleDespachar(env.id, env.numero_guia)}
                          className="px-2.5 py-1 text-white bg-[#1C96C5] hover:bg-[#157A9E] rounded text-xs font-semibold cursor-pointer"
                        >
                          <Send size={12} className="inline mr-1" />
                          Despachar
                        </button>
                      )}

                      {env.estado === "EN_TRANSITO" && (
                        <button
                          onClick={() => abrirRecepcionar(env)}
                          className="px-2.5 py-1 text-white bg-emerald-600 hover:bg-emerald-700 rounded text-xs font-semibold cursor-pointer"
                        >
                          <PackageCheck size={12} className="inline mr-1" />
                          Recepcionar
                        </button>
                      )}

                      {env.estado !== "RECEPCIONADO" && env.estado !== "ANULADO" && (
                        <button
                          onClick={() => handleAnular(env.id, env.numero_guia)}
                          className="px-2.5 py-1 text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded text-xs font-medium cursor-pointer"
                        >
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CREAR ENVÍO */}
      {modalCrearAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-lg w-full p-5 border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText size={18} className="text-[#1C96C5]" />
                Nueva Guía de Remisión de Inventario
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Crea el traslado en estado PENDIENTE. Al despacharlo se descontará el stock en origen.
              </p>
            </div>

            <form onSubmit={handleCrear} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-800 block mb-1">N° de Guía de Remisión:</label>
                <input
                  type="text"
                  placeholder="Ej. GUIA-2026-001"
                  required
                  value={formCrear.numero_guia}
                  onChange={(e) => setFormCrear({ ...formCrear, numero_guia: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-[#1C96C5] font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-800 block mb-1">Origen:</label>
                  <select
                    value={`${formCrear.origen_tipo}_${formCrear.origen_id}`}
                    onChange={(e) => {
                      const [tipo, id] = e.target.value.split("_");
                      setFormCrear({ ...formCrear, origen_tipo: tipo, origen_id: Number(id) });
                    }}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded bg-white"
                  >
                    <option value="PLANTA_1">Planta Central Sucre (Fabricio)</option>
                    <option value="SUCURSAL_1">Sucursal Sucre</option>
                    <option value="SUCURSAL_2">Sucursal Potosí</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-800 block mb-1">Destino:</label>
                  <select
                    value={`${formCrear.destino_tipo}_${formCrear.destino_id}`}
                    onChange={(e) => {
                      const [tipo, id] = e.target.value.split("_");
                      setFormCrear({ ...formCrear, destino_tipo: tipo, destino_id: Number(id) });
                    }}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded bg-white"
                  >
                    <option value="SUCURSAL_2">Sucursal Potosí</option>
                    <option value="SUCURSAL_1">Sucursal Sucre</option>
                    <option value="PLANTA_1">Planta Sucre</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-800 block mb-1">Chofer / Repartidor:</label>
                  <input
                    type="text"
                    placeholder="Ej. Juan Pérez"
                    value={formCrear.chofer_nombre}
                    onChange={(e) => setFormCrear({ ...formCrear, chofer_nombre: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-800 block mb-1">Placa Camión:</label>
                  <input
                    type="text"
                    placeholder="Ej. 3456-XYZ"
                    value={formCrear.camion_placa}
                    onChange={(e) => setFormCrear({ ...formCrear, camion_placa: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-800 block mb-1">Presentación (ID):</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="ID presentación (ej. 1)"
                    required
                    value={formCrear.presentacion_id}
                    onChange={(e) => setFormCrear({ ...formCrear, presentacion_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-800 block mb-1">Cantidad de Bultos:</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ej. 100"
                    required
                    value={formCrear.cantidad_enviada}
                    onChange={(e) => setFormCrear({ ...formCrear, cantidad_enviada: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-800 block mb-1">Observaciones:</label>
                <textarea
                  rows="2"
                  placeholder="Notas adicionales..."
                  value={formCrear.observaciones}
                  onChange={(e) => setFormCrear({ ...formCrear, observaciones: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalCrearAbierto(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoCrear}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1C96C5] hover:bg-[#157A9E] rounded cursor-pointer disabled:opacity-50"
                >
                  {guardandoCrear ? "Registrando..." : "Guardar Envío"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RECEPCIONAR CON MERMAS */}
      {envioRecepcionar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-lg w-full p-5 border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PackageCheck size={18} className="text-emerald-600" />
                Recepción de Mercadería (Guía {envioRecepcionar.numero_guia})
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Verifique las cantidades físicas recibidas. Si hay faltantes, ingrese el motivo de merma en tránsito.
              </p>
            </div>

            <form onSubmit={handleConfirmarRecepcion} className="space-y-3">
              <div className="space-y-2.5">
                {envioRecepcionar.detalles.map((d) => {
                  const pid = d.presentacion_id;
                  const enviada = Number(d.cantidad_enviada);
                  const recibida = Number(cantidadesRecibidas[pid] || 0);
                  const merma = enviada - recibida;

                  return (
                    <div key={pid} className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-900">
                          {d.nombre_producto} ({d.codigo_presentacion} - {d.tipo_contenedor})
                        </span>
                        <span className="text-slate-600 font-mono">Enviado: {enviada}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">Recibido:</label>
                          <input
                            type="number"
                            min="0"
                            max={enviada}
                            required
                            value={cantidadesRecibidas[pid] ?? enviada}
                            onChange={(e) =>
                              setCantidadesRecibidas({ ...cantidadesRecibidas, [pid]: e.target.value })
                            }
                            className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">Diferencia (Merma):</label>
                          <input
                            type="text"
                            readOnly
                            value={merma > 0 ? `${merma} bultos` : "0"}
                            className={`w-full px-2.5 py-1 text-xs border rounded font-mono font-bold ${
                              merma > 0 ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-slate-100 text-slate-600"
                            }`}
                          />
                        </div>
                      </div>

                      {merma > 0 && (
                        <div>
                          <label className="text-[11px] font-semibold text-rose-800 block mb-0.5">
                            Motivo del Faltante / Merma:
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. Bulto roto en viaje, faltante físico..."
                            value={motivosMermas[pid] || ""}
                            onChange={(e) => setMotivosMermas({ ...motivosMermas, [pid]: e.target.value })}
                            className="w-full px-2.5 py-1 text-xs border border-rose-300 bg-rose-50/50 rounded"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-800 block mb-1">Notas de Recepción:</label>
                <textarea
                  rows="2"
                  placeholder="Observaciones de almacén..."
                  value={obsRecepcion}
                  onChange={(e) => setObsRecepcion(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEnvioRecepcionar(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoRecep}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded cursor-pointer disabled:opacity-50"
                >
                  {guardandoRecep ? "Recepcionando..." : "Confirmar Recepción"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VER DETALLE */}
      {envioDetalle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-lg w-full p-5 border border-slate-200 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Detalle de Remisión</span>
                <h3 className="text-base font-bold text-slate-900 font-mono">{envioDetalle.numero_guia}</h3>
              </div>
              <div>{renderBadgeEstado(envioDetalle.estado)}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-600 block">Origen:</span>
                <span className="font-semibold text-slate-900">{envioDetalle.origen_nombre}</span>
              </div>
              <div>
                <span className="text-slate-600 block">Destino:</span>
                <span className="font-semibold text-slate-900">{envioDetalle.destino_nombre}</span>
              </div>
              <div>
                <span className="text-slate-600 block">Chofer / Placa:</span>
                <span className="font-medium text-slate-800">{envioDetalle.chofer_nombre || "-"} ({envioDetalle.camion_placa || "-"})</span>
              </div>
              <div>
                <span className="text-slate-600 block">Descuento Planta Sucre:</span>
                <span className="font-medium text-slate-800">{envioDetalle.descuento_planta_aplicado ? "Sí (Aplicado)" : "No"}</span>
              </div>
            </div>

            {/* Lista de Ítems */}
            <div>
              <span className="text-xs font-bold text-slate-800 block mb-1.5">Ítems Enviados:</span>
              <div className="border border-slate-200 rounded overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                    <tr>
                      <th className="py-2 px-3">Código</th>
                      <th className="py-2 px-3">Producto</th>
                      <th className="py-2 px-3 text-right">Enviado</th>
                      <th className="py-2 px-3 text-right">Recibido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {envioDetalle.detalles.map((d) => (
                      <tr key={d.id}>
                        <td className="py-2 px-3 font-mono font-medium text-slate-800">{d.codigo_presentacion}</td>
                        <td className="py-2 px-3">{d.nombre_producto} ({d.tipo_contenedor})</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{Number(d.cantidad_enviada).toFixed(0)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">{Number(d.cantidad_recibida).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mermas si existen */}
            {envioDetalle.mermas && envioDetalle.mermas.length > 0 && (
              <div>
                <span className="text-xs font-bold text-rose-800 block mb-1 flex items-center gap-1">
                  <AlertTriangle size={14} /> Mermas y Faltantes Registrados:
                </span>
                <div className="bg-rose-50 border border-rose-200 rounded p-2.5 text-xs space-y-1">
                  {envioDetalle.mermas.map((m) => (
                    <div key={m.id} className="flex justify-between items-center text-rose-950">
                      <span>{m.codigo_presentacion} - Motivo: {m.motivo}</span>
                      <span className="font-bold font-mono">{Number(m.cantidad_merma).toFixed(0)} bultos</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                onClick={() => setEnvioDetalle(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
