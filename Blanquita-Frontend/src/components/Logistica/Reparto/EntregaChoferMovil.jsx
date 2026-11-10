import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Truck, 
  CheckCircle2, 
  QrCode, 
  Banknote, 
  ShieldAlert, 
  FileText, 
  UserCheck, 
  PackagePlus, 
  X,
  CreditCard,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

  // Chofer seleccionado (si es supervisor/admin puede elegir)
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

      // Determinar ID del chofer activo
      let idInicial = choferPreseleccionado ? Number(choferPreseleccionado) : null;
      if (!idInicial && esChofer && usuario?.IdUsuario) {
        idInicial = Number(usuario.IdUsuario);
      }
      if (!idInicial && reps && reps.length > 0) {
        idInicial = Number(reps[0].IdUsuario);
      }
      if (!idInicial) {
        idInicial = 9; // Fallback a chofer existente de prueba
      }
      setChoferId(idInicial);

      // Cargar inventario del chofer determinado
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

      // Si las líneas actuales están vacías o no configuradas, preseleccionar la primera
      setLineas((prevLineas) => {
        if (prevLineas.length === 1 && (!prevLineas[0].presentacion_id || prevLineas[0].presentacion_id === "")) {
          // Prioridad: primer producto con stock en camión
          if (stk && stk.length > 0) {
            return [{
              presentacion_id: String(stk[0].presentacion_id),
              cantidad: 1,
              precio_unitario: Number(stk[0].precio_vigente_carga || 20)
            }];
          }
          // Fallback: primer producto del catálogo
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

  // Reaccionar al cambio de chofer
  const handleCambioChofer = async (nuevoId) => {
    const numId = Number(nuevoId);
    setChoferId(numId);
    await cargarInventarioChofer(numId);
  };

  // Catálogo unificado de productos (Garantiza que NUNCA aparezca vacío)
  const productosDisponibles = useMemo(() => {
    const mapa = new Map();

    // 1. Incorporar todo el catálogo comercial oficial de presentaciones
    preciosCatalogo.forEach((p) => {
      const presId = Number(p.IdPresentacion);
      mapa.set(presId, {
        presentacion_id: presId,
        nombre: `${p.NombreProducto} (${p.TipoContenedor}${p.CantidadRollosUnidades ? ` x${p.CantidadRollosUnidades}` : ""})`,
        precio: Number(p.PrecioUnitario || 0),
        stockCamion: 0
      });
    });

    // 2. Sobreponer existencias en camión del chofer actual
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

  // Si cambia el catálogo y la primera línea no tiene ID, asignar el primero disponible
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

    // Si cambió la presentación, actualizar automáticamente su precio sugerido
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

      // Limpiar formulario para la siguiente entrega
      setFirmaBase64(null);
      setNombreReceptor("");
      setCiReceptor("");
      setComprobanteQRId(null);
      setArchivoQR(null);
      setClienteSeleccionado("");

      // Recargar stock remanente del camión
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
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        <p className="text-xs font-medium">Cargando catálogos y datos de entrega...</p>
      </div>
    );
  }

  return (
    <div className={`mx-auto space-y-5 ${enModal ? "max-w-full p-1" : "max-w-2xl p-4"}`}>
      {/* Cabecera Informativa */}
      <div className="bg-gradient-to-r from-sky-700 to-sky-900 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Truck className="w-5 h-5 text-sky-300" /> Registro de Entrega y Nota de Venta
          </h1>
          <p className="text-xs text-sky-200 mt-0.5">
            Emisión de comprobante en ruta con firma digital y descargo de inventario
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-white/20 text-white border-0 text-xs font-normal">
            {esChofer ? "Móvil Chofer" : "Panel Supervisor"}
          </Badge>
          {onCerrar && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCerrar}
              className="text-white hover:bg-white/20 h-7 w-7 p-0 rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
        {/* Selección de Repartidor y Camión (si es supervisor/admin o para confirmación) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Chofer Repartidor
            </label>
            {esChofer ? (
              <div className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 px-3 py-2 rounded-lg flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-sky-600" />
                <span>{usuario?.NombreCompleto || "Chofer"}</span>
              </div>
            ) : (
              <select
                value={choferId || ""}
                onChange={(e) => handleCambioChofer(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
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
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Placa del Vehículo
            </label>
            <Input
              type="text"
              value={placaCamion}
              onChange={(e) => setPlacaCamion(e.target.value.toUpperCase())}
              placeholder="Ej. 5738UPK"
              className="text-xs h-9 bg-white"
              required
            />
          </div>
        </div>

        {/* Cliente Receptor */}
        <div>
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
            Cliente Receptor
          </label>
          <select
            value={clienteSeleccionado}
            onChange={(e) => setClienteSeleccionado(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-sky-500"
            required
          >
            <option value="">-- Seleccione un cliente o punto de venta --</option>
            {clientes.map((c) => (
              <option key={c.IdCliente} value={c.IdCliente}>
                {c.RazonSocial || c.NombreCompleto} {c.Ciudad ? `• ${c.Ciudad}` : ""} {c.NitCi ? `(NIT/CI: ${c.NitCi})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Productos Entregados */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Productos Entregados
              </label>
              {cargandoStock && (
                <span className="text-xs text-sky-600 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Actualizando camión...
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={agregarLinea}
              className="h-7 text-xs gap-1 text-sky-600 border-sky-200 hover:bg-sky-50"
            >
              <PackagePlus className="w-3.5 h-3.5" /> Agregar Ítem
            </Button>
          </div>

          {productosDisponibles.length === 0 ? (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>No se encontraron presentaciones activas en el catálogo ni en el camión.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {lineas.map((linea, idx) => {
                const prodSel = productosDisponibles.find((p) => String(p.presentacion_id) === String(linea.presentacion_id));
                const stockDisponible = prodSel ? prodSel.stockCamion : 0;

                return (
                  <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="flex-1 w-full sm:w-auto">
                      <select
                        value={linea.presentacion_id}
                        onChange={(e) => actualizarLinea(idx, "presentacion_id", e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-200 text-xs bg-white focus:border-sky-500 font-medium"
                        required
                      >
                        {productosDisponibles.map((prod) => (
                          <option key={prod.presentacion_id} value={prod.presentacion_id}>
                            {prod.stockCamion > 0
                              ? `[Camión: ${prod.stockCamion} disp.] ${prod.nombre} - Bs. ${prod.precio}`
                              : `[Sin stock camión] ${prod.nombre} - Bs. ${prod.precio}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="w-24">
                        <Input
                          type="number"
                          min="1"
                          value={linea.cantidad}
                          onChange={(e) => actualizarLinea(idx, "cantidad", e.target.value)}
                          className="text-xs text-center h-8"
                          placeholder="Cant."
                          required
                        />
                      </div>

                      <div className="w-24">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          value={linea.precio_unitario}
                          onChange={(e) => actualizarLinea(idx, "precio_unitario", e.target.value)}
                          className="text-xs text-center h-8"
                          placeholder="Bs./u"
                          required
                        />
                      </div>

                      <div className="text-xs font-bold text-slate-700 w-24 text-right pr-1">
                        Bs. {(Number(linea.cantidad) * Number(linea.precio_unitario) || 0).toFixed(2)}
                      </div>

                      {lineas.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => eliminarLinea(idx)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                          title="Quitar ítem"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Resumen Total y Bonificación */}
          <div className="mt-3 p-3 bg-sky-50 rounded-xl flex flex-col sm:flex-row justify-between items-center border border-sky-100 gap-2">
            <span className="text-xs text-sky-800 font-medium">
              Bonificación automática por volumen y bandeo activa en sucursal
            </span>
            <span className="text-base font-bold text-sky-700">
              Total a Cobrar: Bs. {totalBruto.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Modalidad de Pago */}
        <div>
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
            Modalidad de Pago
          </label>
          <div className="grid grid-cols-4 gap-2">
            {["Efectivo", "QR", "Credito", "Mixto"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetodoPago(m)}
                className={`py-2 text-xs rounded-xl border font-medium transition-all ${
                  metodoPago === m
                    ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {(metodoPago === "QR" || metodoPago === "Mixto") && (
            <div className="mt-3 p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
              <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-amber-700" /> Comprobante QR Obligatorio
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleSubirQR}
                className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:bg-amber-200 file:text-amber-900 hover:file:bg-amber-300"
              />
              {subiendoQR && <p className="text-xs text-amber-700 animate-pulse">Subiendo imagen de comprobante...</p>}
              {archivoQR && <p className="text-xs text-emerald-700 font-medium">Comprobante vinculado: {archivoQR}</p>}
            </div>
          )}

          {metodoPago === "Mixto" && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div>
                <label className="text-xs text-slate-500 mb-0.5 block">Bs. Efectivo</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={montoEfectivo}
                  onChange={(e) => setMontoEfectivo(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-0.5 block">Bs. QR</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={montoQR}
                  onChange={(e) => setMontoQR(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-0.5 block">Bs. Crédito</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={montoCredito}
                  onChange={(e) => setMontoCredito(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>
          )}
        </div>

        {/* Firma Digital Táctil del Receptor */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-sky-600" /> Firma Digital del Receptor en Punto de Venta
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              placeholder="Nombre completo del receptor"
              value={nombreReceptor}
              onChange={(e) => setNombreReceptor(e.target.value)}
              className="text-xs h-9"
              required
            />
            <Input
              placeholder="C.I. del receptor"
              value={ciReceptor}
              onChange={(e) => setCiReceptor(e.target.value)}
              className="text-xs h-9"
              required
            />
          </div>

          <FirmaDigital
            onFirmaGuardada={(data) => setFirmaBase64(data.firmaBase64)}
            nombreFirmante={nombreReceptor || "Cliente Receptor"}
            cargoFirmante="Receptor en Tienda / Punto de Venta"
          />
        </div>

        {/* Botón de Emisión */}
        <Button
          type="submit"
          disabled={procesando || !firmaBase64 || lineas.length === 0}
          className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl shadow-sm gap-2"
        >
          {procesando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Emitiendo Nota de Venta...</span>
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
