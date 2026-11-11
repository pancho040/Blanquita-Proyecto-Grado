import React, { useState, useEffect, useMemo } from "react";
import { 
  Truck, 
  CheckCircle2, 
  QrCode, 
  UserCheck, 
  Plus, 
  X,
  CreditCard,
  Loader2,
  AlertCircle,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import FirmaDigital from "@/components/common/FirmaDigital";
import { CrearNotaVenta, ObtenerClientesCxC } from "@/services/Contabilidad/cuentasCobrarService";
import { ListarInventarioChofer } from "@/services/Logistica/InventarioComercialService";
import { SubirArchivoComprobante } from "@/services/Logistica/EnvioService";
import { ObtenerPrecios } from "@/services/Logistica/PrecioService";
import { ObtenerRepartidores } from "@/services/Logistica/RutaService";

export default function EntregaChoferMovil({ 
  usuario, 
  choferPreseleccionado = null, 
  asignacionPreseleccionada = null,
  enModal = false,
  alCompletar = null,
  onCerrar = null 
}) {
  const [clientes, setClientes] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [preciosCatalogo, setPreciosCatalogo] = useState([]);
  const [stockChofer, setStockChofer] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoStock, setCargandoStock] = useState(false);

  // Chofer seleccionado
  const esChofer = Number(usuario?.IdRol) === 6;
  const [choferId, setChoferId] = useState(() => {
    if (choferPreseleccionado) return Number(choferPreseleccionado);
    if (esChofer && usuario?.IdUsuario) return Number(usuario.IdUsuario);
    return null;
  });

  // Formulario de Entrega
  const [clienteSeleccionado, setClienteSeleccionado] = useState("");
  const [placaCamion, setPlacaCamion] = useState(
    asignacionPreseleccionada?.Observacion?.match(/\(([^)]+)\)/)?.[1] || "5738UPK"
  );
  const [metodoPago, setMetodoPago] = useState("Efectivo"); // Efectivo, QR, Credito, Mixto
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoQR, setMontoQR] = useState("");
  const [montoCredito, setMontoCredito] = useState("");
  const [archivoQR, setArchivoQR] = useState(null);
  const [comprobanteQRId, setComprobanteQRId] = useState(null);
  const [subiendoQR, setSubiendoQR] = useState(false);

  // Líneas de producto
  const [lineas, setLineas] = useState([{ presentacion_id: "", cantidad: 1, precio_unitario: 20 }]);

  // Firma Digital
  const [firmaBase64, setFirmaBase64] = useState(null);
  const [nombreReceptor, setNombreReceptor] = useState("");
  const [ciReceptor, setCiReceptor] = useState("");

  const [procesando, setProcesando] = useState(false);

  // Carga inicial de datos maestros
  useEffect(() => {
    cargarCatalogos();
  }, []);

  const cargarCatalogos = async () => {
    try {
      setCargando(true);
      const [cls, reps, pre] = await Promise.all([
        ObtenerClientesCxC().catch(() => []),
        ObtenerRepartidores().catch(() => []),
        ObtenerPrecios(1).catch(() => [])
      ]);

      setClientes(cls || []);
      setRepartidores(reps || []);
      setPreciosCatalogo(pre || []);

      let idInicial = choferPreseleccionado ? Number(choferPreseleccionado) : null;
      if (!idInicial && esChofer && usuario?.IdUsuario) {
        idInicial = Number(usuario.IdUsuario);
      }
      if (!idInicial && reps && reps.length > 0) {
        idInicial = Number(reps[0].IdUsuario);
      }
      if (!idInicial) {
        idInicial = 9;
      }
      setChoferId(idInicial);

      if (idInicial) {
        await cargarInventarioChofer(idInicial, pre || []);
      }
    } catch (err) {
      toast.error("Error al cargar datos generales para la entrega");
    } finally {
      setCargando(false);
    }
  };

  const cargarInventarioChofer = async (cid, catalogoPrecios = preciosCatalogo) => {
    try {
      setCargandoStock(true);
      const stk = await ListarInventarioChofer(cid).catch(() => []);
      setStockChofer(stk || []);

      setLineas((prevLineas) => {
        if (prevLineas.length === 1 && (!prevLineas[0].presentacion_id || prevLineas[0].presentacion_id === "")) {
          if (stk && stk.length > 0) {
            return [{
              presentacion_id: String(stk[0].presentacion_id),
              cantidad: 1,
              precio_unitario: Number(stk[0].precio_vigente_carga || 20)
            }];
          }
          if (catalogoPrecios && catalogoPrecios.length > 0) {
            return [{
              presentacion_id: String(catalogoPrecios[0].IdPresentacion),
              cantidad: 1,
              precio_unitario: Number(catalogoPrecios[0].PrecioUnitario || 20)
            }];
          }
        }
        return prevLineas;
      });
    } catch (err) {
      toast.error("No se pudo obtener el inventario del camión del chofer");
    } finally {
      setCargandoStock(false);
    }
  };

  const handleCambioChofer = async (nuevoId) => {
    const numId = Number(nuevoId);
    setChoferId(numId);
    await cargarInventarioChofer(numId);
  };

  const productosDisponibles = useMemo(() => {
    const mapa = new Map();

    preciosCatalogo.forEach((p) => {
      const presId = Number(p.IdPresentacion);
      mapa.set(presId, {
        presentacion_id: presId,
        nombre: `${p.NombreProducto} (${p.TipoContenedor}${p.CantidadRollosUnidades ? ` x${p.CantidadRollosUnidades}` : ""})`,
        precio: Number(p.PrecioUnitario || 0),
        stockCamion: 0
      });
    });

    stockChofer.forEach((s) => {
      const presId = Number(s.presentacion_id);
      const remanente = Number(s.cantidad_remanente) || 0;
      const existing = mapa.get(presId);
      if (existing) {
        existing.stockCamion = remanente;
        if (s.precio_vigente_carga && (!existing.precio || existing.precio === 0)) {
          existing.precio = Number(s.precio_vigente_carga);
        }
      } else {
        mapa.set(presId, {
          presentacion_id: presId,
          nombre: `${s.nombre_producto || s.producto_nombre || "Producto"} (${s.tipo_contenedor || ""})`,
          precio: Number(s.precio_vigente_carga || 20),
          stockCamion: remanente
        });
      }
    });

    return Array.from(mapa.values());
  }, [preciosCatalogo, stockChofer]);

  useEffect(() => {
    if (productosDisponibles.length > 0 && (!lineas[0]?.presentacion_id || lineas[0]?.presentacion_id === "")) {
      const primero = productosDisponibles[0];
      setLineas([{
        presentacion_id: String(primero.presentacion_id),
        cantidad: 1,
        precio_unitario: primero.precio || 20
      }]);
    }
  }, [productosDisponibles]);

  const agregarLinea = () => {
    const primerProd = productosDisponibles[0];
    setLineas([
      ...lineas,
      {
        presentacion_id: primerProd ? String(primerProd.presentacion_id) : "",
        cantidad: 1,
        precio_unitario: primerProd ? primerProd.precio : 20
      }
    ]);
  };

  const actualizarLinea = (idx, campo, valor) => {
    const copia = [...lineas];
    copia[idx][campo] = valor;

    if (campo === "presentacion_id") {
      const prod = productosDisponibles.find((p) => String(p.presentacion_id) === String(valor));
      if (prod && prod.precio) {
        copia[idx].precio_unitario = prod.precio;
      }
    }

    setLineas(copia);
  };

  const eliminarLinea = (idx) => {
    if (lineas.length === 1) return;
    setLineas(lineas.filter((_, i) => i !== idx));
  };

  const totalBruto = lineas.reduce(
    (acc, l) => acc + (Number(l.cantidad) * Number(l.precio_unitario) || 0),
    0
  );

  const handleSubirQR = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setSubiendoQR(true);
      const res = await SubirArchivoComprobante(file, "CobroQR", usuario?.IdUsuario || choferId || 1);
      setComprobanteQRId(res.comprobante_id);
      setArchivoQR(file.name);
      toast.success("Comprobante QR cargado correctamente");
    } catch (err) {
      toast.error("Error subiendo comprobante QR: " + (err.message || "fallo al subir"));
    } finally {
      setSubiendoQR(false);
    }
  };

  const choferActualNombre = useMemo(() => {
    const c = repartidores.find((r) => Number(r.IdUsuario) === Number(choferId));
    if (c) return c.NombreCompleto;
    if (esChofer && usuario?.NombreCompleto) return usuario.NombreCompleto;
    return "Chofer Asignado";
  }, [repartidores, choferId, esChofer, usuario]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clienteSeleccionado) {
      toast.error("Seleccione un cliente receptor de la lista");
      return;
    }
    if (!choferId) {
      toast.error("Debe seleccionar un chofer de reparto");
      return;
    }
    if ((metodoPago === "QR" || metodoPago === "Mixto") && Number(montoQR || (metodoPago === "QR" ? totalBruto : 0)) > 0 && !comprobanteQRId) {
      toast.error("Es obligatorio adjuntar la fotografía del comprobante QR");
      return;
    }
    if (!firmaBase64) {
      toast.error("La firma digital del receptor es obligatoria en el recuadro");
      return;
    }

    try {
      setProcesando(true);
      const numeroNota = `NV-${Math.floor(100000 + Math.random() * 900000)}`;

      const payload = {
        numero_nota: numeroNota,
        id_cliente: Number(clienteSeleccionado),
        chofer: choferActualNombre,
        id_chofer: Number(choferId),
        placa: placaCamion || "5738UPK",
        total_neto: totalBruto,
        id_sucursal: 1,
        metodo_pago: metodoPago,
        monto_efectivo: metodoPago === "Efectivo" ? totalBruto : Number(montoEfectivo || 0),
        monto_qr: metodoPago === "QR" ? totalBruto : Number(montoQR || 0),
        monto_credito: metodoPago === "Credito" ? totalBruto : Number(montoCredito || 0),
        comprobante_qr_archivo_id: comprobanteQRId,
        firma_digital_url: firmaBase64,
        firma_nombre: nombreReceptor,
        firma_ci: ciReceptor,
        detalles: lineas.map((l) => ({
          presentacion_id: Number(l.presentacion_id),
          paquetes_entregados: Number(l.cantidad),
          precio_unitario: Number(l.precio_unitario),
          subtotal: Number(l.cantidad) * Number(l.precio_unitario)
        }))
      };

      await CrearNotaVenta(payload);
      toast.success(`Nota de Venta ${numeroNota} emitida con éxito`);

      setFirmaBase64(null);
      setNombreReceptor("");
      setCiReceptor("");
      setComprobanteQRId(null);
      setArchivoQR(null);
      setClienteSeleccionado("");

      if (choferId) {
        await cargarInventarioChofer(choferId);
      }

      if (alCompletar) {
        alCompletar(numeroNota);
      }
    } catch (err) {
      toast.error("Error al emitir Nota de Venta: " + (err.message || "Error de servidor"));
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-[#1C96C5]" />
        <p className="text-xs font-medium">Cargando catálogos y datos de entrega...</p>
      </div>
    );
  }

  const itemsEnCamion = stockChofer.filter((s) => Number(s.cantidad_remanente) > 0).length;

  return (
    <div className={`space-y-4 ${enModal ? "p-1" : "w-full max-w-4xl mx-auto"}`}>
      {/* Cabecera Sólida Industrial */}
      <div className="bg-white border border-slate-200 rounded p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-[#F0F9FF] border border-[#BAE6FD] rounded flex items-center justify-center text-[#1C96C5] shrink-0 mt-0.5">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                Registro de Entrega & Nota de Venta
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border bg-slate-50 border-slate-200 text-slate-700">
                {esChofer ? "Móvil Chofer" : "Panel Supervisor"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Emisión de comprobante en ruta con descargo de existencias del furgón y firma digital.
            </p>
          </div>
        </div>

        {onCerrar && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCerrar}
            className="h-8 px-2.5 text-xs rounded border-slate-200 text-slate-600 hover:text-slate-900"
          >
            <X className="w-3.5 h-3.5 mr-1" /> Cerrar
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded p-4 space-y-4">
        {/* Sección 1: Repartidor y Camión */}
        <div className="bg-slate-50 border border-slate-200 rounded p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
              Chofer Repartidor
            </label>
            {esChofer ? (
              <div className="h-8 text-xs font-medium text-slate-800 bg-white border border-slate-300 px-2.5 rounded flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-[#1C96C5]" />
                <span>{usuario?.NombreCompleto || "Chofer"}</span>
              </div>
            ) : (
              <select
                value={choferId || ""}
                onChange={(e) => handleCambioChofer(e.target.value)}
                className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2 text-slate-800 focus:border-slate-900 focus:outline-none"
                required
              >
                {repartidores.map((r) => (
                  <option key={r.IdUsuario} value={r.IdUsuario}>
                    {r.NombreCompleto} {r.Ci ? `(CI: ${r.Ci})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Placa del Vehículo
              </label>
              <span className="text-[11px] text-slate-500">
                {cargandoStock ? (
                  <span className="text-[#1C96C5] flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Verificando camión...
                  </span>
                ) : (
                  <span>{itemsEnCamion} presentaciones a bordo</span>
                )}
              </span>
            </div>
            <Input
              type="text"
              value={placaCamion}
              onChange={(e) => setPlacaCamion(e.target.value.toUpperCase())}
              placeholder="Ej. 5738UPK"
              className="h-8 text-xs rounded border-slate-300 font-mono uppercase bg-white"
              required
            />
          </div>
        </div>

        {/* Sección 2: Cliente Receptor */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
            Cliente Receptor / Punto de Venta *
          </label>
          <select
            value={clienteSeleccionado}
            onChange={(e) => setClienteSeleccionado(e.target.value)}
            className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2 text-slate-900 focus:border-slate-900 focus:outline-none"
            required
          >
            <option value="">-- Seleccionar cliente o punto de venta --</option>
            {clientes.map((c) => (
              <option key={c.IdCliente} value={c.IdCliente}>
                {c.RazonSocial || c.NombreCompleto} {c.Ciudad ? `• ${c.Ciudad}` : ""} {c.NitCi ? `(NIT/CI: ${c.NitCi})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Sección 3: Tabla Industrial de Productos Entregados */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Detalle de Productos Entregados
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={agregarLinea}
              className="h-7 text-xs px-2.5 rounded border-slate-300 text-slate-700 hover:bg-slate-50 gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-[#1C96C5]" /> Agregar Ítem
            </Button>
          </div>

          {productosDisponibles.length === 0 ? (
            <div className="p-3 bg-amber-50 rounded border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>No se encontraron presentaciones activas en el catálogo ni en el camión.</span>
            </div>
          ) : (
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Presentación / Producto a Bordo</th>
                    <th className="px-3 py-2 text-center w-24">Cantidad</th>
                    <th className="px-3 py-2 text-right w-28">P. Unit (Bs.)</th>
                    <th className="px-3 py-2 text-right w-28">Subtotal (Bs.)</th>
                    <th className="px-2 py-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineas.map((linea, idx) => {
                    const subtotal = Number(linea.cantidad || 0) * Number(linea.precio_unitario || 0);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3 py-1.5">
                          <select
                            value={linea.presentacion_id}
                            onChange={(e) => actualizarLinea(idx, "presentacion_id", e.target.value)}
                            className="w-full h-8 text-xs px-2 rounded border border-slate-300 bg-white focus:border-slate-900 focus:outline-none"
                            required
                          >
                            {productosDisponibles.map((prod) => (
                              <option key={prod.presentacion_id} value={prod.presentacion_id}>
                                {prod.stockCamion > 0
                                  ? `[En Camión: ${prod.stockCamion} u.] ${prod.nombre}`
                                  : `[Sin stock camión] ${prod.nombre}`}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-3 py-1.5 text-center">
                          <Input
                            type="number"
                            min="1"
                            value={linea.cantidad}
                            onChange={(e) => actualizarLinea(idx, "cantidad", e.target.value)}
                            className="h-8 text-xs text-center font-mono tabular-nums rounded border-slate-300"
                            required
                          />
                        </td>

                        <td className="px-3 py-1.5 text-right">
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={linea.precio_unitario}
                            onChange={(e) => actualizarLinea(idx, "precio_unitario", e.target.value)}
                            className="h-8 text-xs text-right font-mono tabular-nums rounded border-slate-300"
                            required
                          />
                        </td>

                        <td className="px-3 py-1.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {subtotal.toFixed(2)}
                        </td>

                        <td className="px-2 py-1.5 text-center">
                          {lineas.length > 1 && (
                            <button
                              type="button"
                              onClick={() => eliminarLinea(idx)}
                              className="text-slate-400 hover:text-red-700 p-1 rounded transition-colors inline-flex items-center justify-center"
                              title="Eliminar ítem"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="bg-slate-50 px-3 py-2 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span className="text-[11px] text-slate-500">
                  Descuento automático de inventario aplicado a la carga del chofer.
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium">Total a Cobrar:</span>
                  <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
                    Bs. {totalBruto.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sección 4: Modalidad de Pago */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
            Modalidad de Pago
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: "Efectivo", label: "Efectivo" },
              { id: "QR", label: "QR Bancario" },
              { id: "Credito", label: "Crédito CxC" },
              { id: "Mixto", label: "Mixto" }
            ].map((m) => {
              const activo = metodoPago === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetodoPago(m.id)}
                  className={`h-8 text-xs font-medium rounded border transition-colors flex items-center justify-center gap-1.5 ${
                    activo
                      ? "bg-[#1C96C5] text-white border-[#1C96C5]"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {m.id === "QR" && <QrCode className="w-3.5 h-3.5" />}
                  {m.id === "Credito" && <CreditCard className="w-3.5 h-3.5" />}
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {(metodoPago === "QR" || metodoPago === "Mixto") && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-[#1C96C5]" /> Comprobante QR Requerido
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleSubirQR}
                className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-slate-300 file:text-xs file:bg-white file:text-slate-700 hover:file:bg-slate-50"
              />
              {subiendoQR && <p className="text-xs text-[#1C96C5] animate-pulse">Subiendo comprobante QR...</p>}
              {archivoQR && (
                <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Archivo adjunto: {archivoQR}
                </p>
              )}
            </div>
          )}

          {metodoPago === "Mixto" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200 rounded">
              <div>
                <label className="text-[11px] text-slate-600 mb-0.5 block">Bs. Efectivo</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={montoEfectivo}
                  onChange={(e) => setMontoEfectivo(e.target.value)}
                  className="text-xs h-8 text-right font-mono tabular-nums rounded border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 mb-0.5 block">Bs. QR</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={montoQR}
                  onChange={(e) => setMontoQR(e.target.value)}
                  className="text-xs h-8 text-right font-mono tabular-nums rounded border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 mb-0.5 block">Bs. Crédito</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={montoCredito}
                  onChange={(e) => setMontoCredito(e.target.value)}
                  className="text-xs h-8 text-right font-mono tabular-nums rounded border-slate-300 bg-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Sección 5: Firma Digital Táctil del Receptor */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-[#1C96C5]" />
            Firma Digital del Receptor en Punto de Venta *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              placeholder="Nombre completo del receptor"
              value={nombreReceptor}
              onChange={(e) => setNombreReceptor(e.target.value)}
              className="text-xs h-8 rounded border-slate-300 bg-white"
              required
            />
            <Input
              placeholder="C.I. del receptor"
              value={ciReceptor}
              onChange={(e) => setCiReceptor(e.target.value)}
              className="text-xs h-8 rounded border-slate-300 bg-white"
              required
            />
          </div>

          <div className="border border-slate-200 rounded p-2.5 bg-slate-50">
            <FirmaDigital
              onFirmaGuardada={(data) => setFirmaBase64(data.firmaBase64)}
              nombreFirmante={nombreReceptor || "Cliente Receptor"}
              cargoFirmante="Receptor en Tienda / Punto de Venta"
            />
          </div>
        </div>

        {/* Botón Principal de Emisión */}
        <Button
          type="submit"
          disabled={procesando || !firmaBase64 || lineas.length === 0}
          className="w-full bg-[#1C96C5] hover:bg-[#157A9E] text-white font-medium h-9 text-xs rounded shadow-xs flex items-center justify-center gap-2 transition-colors"
        >
          {procesando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Emitiendo Nota de Venta & Descargando Camión...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Finalizar Entrega y Generar Nota de Venta</span>
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
