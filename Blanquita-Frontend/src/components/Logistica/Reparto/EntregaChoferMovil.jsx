import React, { useState, useEffect } from "react";
import { Truck, CheckCircle2, QrCode, Banknote, ShieldAlert, FileText, UserCheck, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import FirmaDigital from "@/components/common/FirmaDigital";
import { CrearNotaVenta, ObtenerClientesCxC } from "@/services/Contabilidad/cuentasCobrarService";
import { ListarInventarioChofer } from "@/services/Logistica/InventarioComercialService";
import { SubirArchivoComprobante } from "@/services/Logistica/EnvioService";

export default function EntregaChoferMovil({ usuario }) {
  const [clientes, setClientes] = useState([]);
  const [stockChofer, setStockChofer] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Formulario
  const [clienteSeleccionado, setClienteSeleccionado] = useState("");
  const [placaCamion, setPlacaCamion] = useState("5738UPK");
  const [metodoPago, setMetodoPago] = useState("Efectivo"); // Efectivo, QR, Credito, Mixto
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoQR, setMontoQR] = useState("");
  const [montoCredito, setMontoCredito] = useState("");
  const [archivoQR, setArchivoQR] = useState(null);
  const [comprobanteQRId, setComprobanteQRId] = useState(null);
  const [subiendoQR, setSubiendoQR] = useState(false);

  // Líneas de producto
  const [lineas, setLineas] = useState([{ presentacion_id: "", cantidad: 1, precio_unitario: 20 }]);

  // Firma
  const [firmaBase64, setFirmaBase64] = useState(null);
  const [nombreReceptor, setNombreReceptor] = useState("");
  const [ciReceptor, setCiReceptor] = useState("");

  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [cls, stk] = await Promise.all([
        ObtenerClientesCxC(),
        ListarInventarioChofer(usuario?.IdUsuario || 4)
      ]);
      setClientes(cls || []);
      setStockChofer(stk || []);
      if (stk && stk.length > 0) {
        setLineas([{ presentacion_id: stk[0].presentacion_id, cantidad: 1, precio_unitario: 20 }]);
      }
    } catch (err) {
      toast.error("Error al cargar datos del chofer");
    } finally {
      setCargando(false);
    }
  };

  const agregarLinea = () => {
    setLineas([...lineas, { presentacion_id: stockChofer[0]?.presentacion_id || "", cantidad: 1, precio_unitario: 20 }]);
  };

  const actualizarLinea = (idx, campo, valor) => {
    const copia = [...lineas];
    copia[idx][campo] = valor;
    setLineas(copia);
  };

  const eliminarLinea = (idx) => {
    if (lineas.length === 1) return;
    setLineas(lineas.filter((_, i) => i !== idx));
  };

  const totalBruto = lineas.reduce((acc, l) => acc + (Number(l.cantidad) * Number(l.precio_unitario) || 0), 0);

  const handleSubirQR = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setSubiendoQR(true);
      const res = await SubirArchivoComprobante(file, "CobroQR", usuario?.IdUsuario || 1);
      setComprobanteQRId(res.comprobante_id);
      setArchivoQR(file.name);
      toast.success("Comprobante QR cargado correctamente");
    } catch (err) {
      toast.error("Error subiendo comprobante QR");
    } finally {
      setSubiendoQR(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clienteSeleccionado) {
      toast.error("Seleccione un cliente receptor");
      return;
    }
    if ((metodoPago === "QR" || metodoPago === "Mixto") && Number(montoQR) > 0 && !comprobanteQRId) {
      toast.error("Es obligatorio adjuntar la fotografía del comprobante QR");
      return;
    }
    if (!firmaBase64) {
      toast.error("La firma digital del receptor es obligatoria en canvas táctil");
      return;
    }

    try {
      setProcesando(true);
      const numeroNota = `NV-${Math.floor(100000 + Math.random() * 900000)}`;

      const payload = {
        numero_nota: numeroNota,
        id_cliente: Number(clienteSeleccionado),
        chofer: usuario?.NombreCompleto || "Luis Repartidor",
        id_chofer: usuario?.IdUsuario || 4,
        placa: placaCamion,
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
        detalles: lineas.map(l => ({
          presentacion_id: Number(l.presentacion_id),
          paquetes_entregados: Number(l.cantidad),
          precio_unitario: Number(l.precio_unitario),
          subtotal: Number(l.cantidad) * Number(l.precio_unitario)
        }))
      };

      await CrearNotaVenta(payload);
      toast.success(`Nota de Venta ${numeroNota} emitida con éxito`);

      // Reset
      setFirmaBase64(null);
      setNombreReceptor("");
      setCiReceptor("");
      setComprobanteQRId(null);
      setArchivoQR(null);
      cargarDatos();
    } catch (err) {
      toast.error("Error al emitir Nota de Venta: " + err.message);
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) return <div className="p-8 text-center text-slate-500">Cargando inventario de camión...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="bg-sky-600 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Truck className="w-6 h-6" /> Entrega y Nota de Venta
          </h1>
          <p className="text-xs text-sky-100 mt-1">Camión Placa: {placaCamion} • Chofer: {usuario?.NombreCompleto || "Luis"}</p>
        </div>
        <Badge className="bg-white/20 text-white border-0 text-xs">Móvil Chofer</Badge>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border p-5 shadow-sm space-y-5">
        <div>
          <label className="text-xs font-semibold text-slate-700 uppercase">Cliente Receptor</label>
          <select
            value={clienteSeleccionado}
            onChange={(e) => setClienteSeleccionado(e.target.value)}
            className="w-full mt-1.5 p-2.5 rounded-lg border text-sm bg-slate-50 focus:bg-white"
            required
          >
            <option value="">-- Seleccione un cliente --</option>
            {clientes.map(c => (
              <option key={c.IdCliente} value={c.IdCliente}>
                {c.RazonSocial} ({c.Ciudad || 'Sucre'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-slate-700 uppercase">Productos Entregados</label>
            <Button type="button" variant="outline" size="sm" onClick={agregarLinea} className="h-7 text-xs gap-1 text-sky-600">
              <PackagePlus className="w-3.5 h-3.5" /> Agregar Ítem
            </Button>
          </div>

          <div className="space-y-2.5">
            {lineas.map((linea, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2.5 rounded-xl border">
                <select
                  value={linea.presentacion_id}
                  onChange={(e) => actualizarLinea(idx, "presentacion_id", e.target.value)}
                  className="flex-1 p-2 rounded-lg border text-xs bg-white"
                  required
                >
                  {stockChofer.map(s => (
                    <option key={s.presentacion_id} value={s.presentacion_id}>
                      {s.producto_nombre} ({s.cantidad_remanente} disp.)
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min="1"
                  value={linea.cantidad}
                  onChange={(e) => actualizarLinea(idx, "cantidad", e.target.value)}
                  className="w-20 text-xs text-center"
                  placeholder="Cant"
                  required
                />
                <Input
                  type="number"
                  step="0.5"
                  value={linea.precio_unitario}
                  onChange={(e) => actualizarLinea(idx, "precio_unitario", e.target.value)}
                  className="w-20 text-xs text-center"
                  placeholder="Bs."
                  required
                />
                {lineas.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => eliminarLinea(idx)} className="text-red-500 h-8 px-2">
                    ✕
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 p-3 bg-sky-50 rounded-xl flex justify-between items-center border border-sky-100">
            <span className="text-xs text-sky-800 font-medium">Bonificación Automática de Bandeo Activa:</span>
            <span className="text-base font-bold text-sky-700">Total: Bs. {totalBruto.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 uppercase">Modalidad de Pago</label>
          <div className="grid grid-cols-4 gap-2 mt-1.5">
            {["Efectivo", "QR", "Credito", "Mixto"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetodoPago(m)}
                className={`py-2 text-xs rounded-xl border font-medium transition-all ${
                  metodoPago === m ? "bg-sky-600 text-white border-sky-600 shadow-sm" : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {(metodoPago === "QR" || metodoPago === "Mixto") && (
            <div className="mt-3 p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
              <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                <QrCode className="w-4 h-4" /> Comprobante QR Obligatorio
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleSubirQR}
                className="text-xs text-slate-600"
              />
              {subiendoQR && <p className="text-xs text-amber-700 animate-pulse">Subiendo imagen...</p>}
              {archivoQR && <p className="text-xs text-emerald-700 font-medium">✓ Archivo: {archivoQR}</p>}
            </div>
          )}

          {metodoPago === "Mixto" && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Input
                type="number"
                placeholder="Bs. Efectivo"
                value={montoEfectivo}
                onChange={(e) => setMontoEfectivo(e.target.value)}
                className="text-xs"
              />
              <Input
                type="number"
                placeholder="Bs. QR"
                value={montoQR}
                onChange={(e) => setMontoQR(e.target.value)}
                className="text-xs"
              />
              <Input
                type="number"
                placeholder="Bs. Crédito"
                value={montoCredito}
                onChange={(e) => setMontoCredito(e.target.value)}
                className="text-xs"
              />
            </div>
          )}
        </div>

        <div className="space-y-3 pt-2">
          <label className="text-xs font-semibold text-slate-700 uppercase flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-sky-600" /> Firma Digital Táctil del Receptor
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Nombre del receptor"
              value={nombreReceptor}
              onChange={(e) => setNombreReceptor(e.target.value)}
              className="text-xs"
              required
            />
            <Input
              placeholder="C.I. del receptor"
              value={ciReceptor}
              onChange={(e) => setCiReceptor(e.target.value)}
              className="text-xs"
              required
            />
          </div>

          <FirmaDigital
            onFirmaGuardada={(data) => setFirmaBase64(data.firmaBase64)}
            nombreFirmante={nombreReceptor || "Cliente Receptor"}
            cargoFirmante="Receptor en Tienda / Punto de Venta"
          />
        </div>

        <Button
          type="submit"
          disabled={procesando || !firmaBase64}
          className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl shadow-md gap-2"
        >
          {procesando ? "Emitiendo Nota de Venta..." : "Finalizar Entrega y Generar NV"}
        </Button>
      </form>
    </div>
  );
}
