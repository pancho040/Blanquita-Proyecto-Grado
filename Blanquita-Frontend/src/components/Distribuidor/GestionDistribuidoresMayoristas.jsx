import React, { useState, useEffect } from "react";
import { Factory, ShoppingCart, UploadCloud, CheckCircle2, Clock, MapPin, AlertCircle, FileText, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ObtenerCatalogoStock, ListarDistribuidores, ListarPedidos,
  CrearPedidoDistribuidor, AjustarPedidoKevin, SubirBoletaPago, AprobarDespachoKevin
} from "@/services/Distribuidor/distribuidorService";
import { SubirArchivoComprobante } from "@/services/Logistica/EnvioService";

export default function GestionDistribuidoresMayoristas({ usuario }) {
  const [tabActiva, setTabActiva] = useState("pedidos"); // 'pedidos' | 'nuevo_pedido' | 'catalogo'
  const [distribuidores, setDistribuidores] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Formulario nuevo pedido
  const [distribuidorId, setDistribuidorId] = useState("");
  const [carrito, setCarrito] = useState({}); // presentacion_id -> cantidad
  const [observacionDist, setObservacionDist] = useState("");
  const [enviandoPedido, setEnviandoPedido] = useState(false);

  // Modal Ajuste Kevin
  const [modalAjuste, setModalAjuste] = useState(null);
  const [cantidadesAjustadas, setCantidadesAjustadas] = useState({});
  const [obsKevin, setObsKevin] = useState("");
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);

  // Modal Subir Boleta
  const [modalBoleta, setModalBoleta] = useState(null);
  const [subiendoBoleta, setSubiendoBoleta] = useState(false);

  const esKevinOAdmin = usuario?.IsAdmin || usuario?.IdRol === 1 || usuario?.IdRol === 2;

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [dists, cat, peds] = await Promise.all([
        ListarDistribuidores(true),
        ObtenerCatalogoStock(),
        ListarPedidos()
      ]);
      setDistribuidores(dists || []);
      setCatalogo(cat || []);
      setPedidos(peds || []);
      if (dists && dists.length > 0) {
        setDistribuidorId(dists[0].id);
      }
    } catch (err) {
      toast.error("Error al cargar módulo de distribuidores mayoristas");
    } finally {
      setCargando(false);
    }
  };

  const handleCantidadCarrito = (presId, cant) => {
    setCarrito({
      ...carrito,
      [presId]: Number(cant) || 0
    });
  };

  const handleCrearPedido = async (e) => {
    e.preventDefault();
    const items = Object.entries(carrito)
      .filter(([_, cant]) => cant > 0)
      .map(([presId, cant]) => ({
        presentacion_id: Number(presId),
        cantidad_solicitada: cant
      }));

    if (items.length === 0) {
      toast.error("Debe agregar al menos un producto al pedido");
      return;
    }

    try {
      setEnviandoPedido(true);
      await CrearPedidoDistribuidor({
        distribuidor_id: Number(distribuidorId),
        observacion_distribuidor: observacionDist,
        detalles: items
      });
      toast.success("Pedido mayorista enviado correctamente");
      setCarrito({});
      setObservacionDist("");
      setTabActiva("pedidos");
      cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al crear pedido");
    } finally {
      setEnviandoPedido(false);
    }
  };

  const abrirModalAjuste = (pedido) => {
    setModalAjuste(pedido);
    const cantInit = {};
    pedido.detalles.forEach(d => {
      cantInit[d.id] = d.cantidad_aprobada ?? d.cantidad_solicitada;
    });
    setCantidadesAjustadas(cantInit);
    setObsKevin(pedido.observacion_kevin || "");
  };

  const handleGuardarAjuste = async () => {
    try {
      setGuardandoAjuste(true);
      const itemsAjuste = Object.entries(cantidadesAjustadas).map(([detId, cant]) => ({
        detalle_id: Number(detId),
        cantidad_aprobada: Number(cant)
      }));

      await AjustarPedidoKevin(modalAjuste.id, {
        detalles_ajuste: itemsAjuste,
        observacion_kevin: obsKevin
      });
      toast.success("Proforma y cantidades ajustadas con éxito");
      setModalAjuste(null);
      cargarDatos();
    } catch (err) {
      toast.error("Error ajustando pedido: " + err.message);
    } finally {
      setGuardandoAjuste(false);
    }
  };

  const handleSubirBoleta = async (e) => {
    const file = e.target.files[0];
    if (!file || !modalBoleta) return;
    try {
      setSubiendoBoleta(true);
      const res = await SubirArchivoComprobante(file, "BoletaDistribuidor", usuario?.IdUsuario || 1);
      await SubirBoletaPago(modalBoleta.id, res.comprobante_id);
      toast.success("Boleta de depósito adjuntada con éxito");
      setModalBoleta(null);
      cargarDatos();
    } catch (err) {
      toast.error("Error subiendo boleta: " + err.message);
    } finally {
      setSubiendoBoleta(false);
    }
  };

  const handleAprobarDespacho = async (pedidoId) => {
    try {
      await AprobarDespachoKevin(pedidoId, { observacion: "Depósito confirmado. Despacho autorizado a transporte." });
      toast.success("Despacho mayorista autorizado");
      cargarDatos();
    } catch (err) {
      toast.error("Error aprobando despacho: " + err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="bg-sky-600 text-white p-6 rounded-2xl shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Factory className="w-6 h-6" /> Portal de Distribuidores Externos
          </h1>
          <p className="text-xs text-sky-100 mt-1">
            Gestión mayorista para Oruro, Tarija, La Paz y Tupiza con validación estricta en planta
          </p>
        </div>
        <div className="flex gap-2">
          {["pedidos", "nuevo_pedido", "catalogo"].map((tab) => (
            <button
              key={tab}
              onClick={() => setTabActiva(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                tabActiva === tab ? "bg-white text-sky-700 shadow-sm" : "bg-white/20 text-white"
              }`}
            >
              {tab === "pedidos" ? "Bandeja de Pedidos" : tab === "nuevo_pedido" ? "+ Crear Pedido" : "Stock en Planta"}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="p-8 text-center text-slate-500">Cargando datos mayoristas...</div>
      ) : tabActiva === "pedidos" ? (
        <div className="space-y-4">
          {pedidos.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border text-center text-slate-500">
              No hay pedidos mayoristas registrados.
            </div>
          ) : (
            pedidos.map((ped) => (
              <div key={ped.id} className="bg-white p-5 rounded-2xl border shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-base">{ped.codigo_pedido}</span>
                      <Badge className={
                        ped.estado === "APROBADO_DESPACHO" ? "bg-emerald-500" :
                        ped.estado === "COMPROBANTE_SUBIDO" ? "bg-sky-600" :
                        ped.estado === "PROFORMA_AJUSTADA" ? "bg-amber-500" : "bg-slate-500"
                      }>
                        {ped.estado}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-sky-600" />
                      {ped.nombre_distribuidor} ({ped.ciudad}) • {new Date(ped.fecha_pedido).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-medium">Monto Total</span>
                    <p className="text-lg font-bold text-sky-700">Bs. {Number(ped.monto_total).toFixed(2)}</p>
                  </div>
                </div>

                <div className="border rounded-xl p-3 bg-slate-50 divide-y text-xs">
                  {ped.detalles.map(d => (
                    <div key={d.id} className="py-2 flex justify-between items-center">
                      <span className="font-medium text-slate-800">{d.nombre_producto || `Presentación #${d.presentacion_id}`}</span>
                      <div className="flex gap-4 text-slate-600">
                        <span>Sol: {d.cantidad_solicitada}</span>
                        {d.cantidad_aprobada !== null && (
                          <span className="text-sky-700 font-semibold">Aprob: {d.cantidad_aprobada}</span>
                        )}
                        <span>Bs. {d.subtotal.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  {esKevinOAdmin && ped.estado === "PENDIENTE_REVISION" && (
                    <Button size="sm" onClick={() => abrirModalAjuste(ped)} className="text-xs bg-amber-600 hover:bg-amber-700">
                      Revisar y Ajustar Cantidades
                    </Button>
                  )}
                  {ped.estado === "PROFORMA_AJUSTADA" && (
                    <Button size="sm" variant="outline" onClick={() => setModalBoleta(ped)} className="text-xs gap-1">
                      <UploadCloud className="w-4 h-4 text-sky-600" /> Adjuntar Boleta de Depósito
                    </Button>
                  )}
                  {ped.url_comprobante && (
                    <a href={ped.url_comprobante} target="_blank" rel="noreferrer" className="text-xs text-sky-600 underline self-center px-2">
                      Ver Boleta
                    </a>
                  )}
                  {esKevinOAdmin && ped.estado === "COMPROBANTE_SUBIDO" && (
                    <Button size="sm" onClick={() => handleAprobarDespacho(ped.id)} className="text-xs bg-emerald-600 hover:bg-emerald-700 gap-1">
                      <Check className="w-4 h-4" /> Autorizar Despacho
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : tabActiva === "nuevo_pedido" ? (
        <form onSubmit={handleCrearPedido} className="bg-white p-6 rounded-2xl border shadow-sm space-y-6">
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase">Distribuidor Destino</label>
            <select
              value={distribuidorId}
              onChange={(e) => setDistribuidorId(e.target.value)}
              className="w-full mt-1.5 p-2.5 rounded-lg border text-sm bg-slate-50"
              required
            >
              {distribuidores.map(d => (
                <option key={d.id} value={d.id}>
                  {d.nombre_comercial} ({d.ciudad}) - Contacto: {d.contacto_nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-slate-700 uppercase mb-3">
              Catálogo Mayorista y Stock en Planta (Planta Sucre)
            </h2>
            <div className="border rounded-xl overflow-hidden divide-y text-xs">
              <div className="bg-slate-100 p-3 font-semibold grid grid-cols-12 text-slate-700">
                <span className="col-span-6">Producto</span>
                <span className="col-span-3 text-center">Stock Disponible en Planta</span>
                <span className="col-span-3 text-center">Cantidad Solicitada</span>
              </div>
              {catalogo.map(c => (
                <div key={c.presentacion_id} className="p-3 grid grid-cols-12 items-center hover:bg-slate-50">
                  <div className="col-span-6">
                    <p className="font-semibold text-slate-800">{c.producto_nombre}</p>
                    <p className="text-[11px] text-slate-400">{c.codigo_presentacion} • {c.tipo_contenedor}</p>
                  </div>
                  <span className="col-span-3 text-center font-bold text-sky-700">
                    {c.stock_disponible} paquetes
                  </span>
                  <div className="col-span-3 flex justify-center">
                    <Input
                      type="number"
                      min="0"
                      max={c.stock_disponible}
                      value={carrito[c.presentacion_id] || ""}
                      onChange={(e) => handleCantidadCarrito(c.presentacion_id, e.target.value)}
                      placeholder="0"
                      className="w-24 text-center text-xs h-8"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={enviandoPedido} className="w-full bg-sky-600 hover:bg-sky-700 font-bold py-3 rounded-xl">
            {enviandoPedido ? "Enviando Pedido..." : "Enviar Pedido a Revisión"}
          </Button>
        </form>
      ) : (
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Stock Físico de Planta Sucre (Solo Lectura)</h2>
          <div className="grid grid-cols-3 gap-4">
            {catalogo.map(c => (
              <div key={c.presentacion_id} className="p-4 bg-slate-50 rounded-xl border">
                <p className="font-semibold text-slate-800 text-sm">{c.producto_nombre}</p>
                <p className="text-xs text-slate-400 mt-0.5">{c.tipo_contenedor}</p>
                <p className="text-xl font-bold text-sky-700 mt-2">{c.stock_disponible} paq.</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Ajuste Kevin */}
      <Dialog open={!!modalAjuste} onOpenChange={() => setModalAjuste(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Ajustar Proforma Mayorista (Kevin)</DialogTitle>
          </DialogHeader>
          {modalAjuste && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="divide-y border rounded-xl p-3 bg-slate-50">
                {modalAjuste.detalles.map(d => (
                  <div key={d.id} className="py-2 flex justify-between items-center">
                    <span className="font-medium text-slate-800">{d.nombre_producto}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Sol: {d.cantidad_solicitada}</span>
                      <Input
                        type="number"
                        value={cantidadesAjustadas[d.id] ?? d.cantidad_solicitada}
                        onChange={(e) => setCantidadesAjustadas({
                          ...cantidadesAjustadas,
                          [d.id]: e.target.value
                        })}
                        className="w-20 text-center text-xs h-7"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Input
                placeholder="Observación de ajuste para el distribuidor"
                value={obsKevin}
                onChange={(e) => setObsKevin(e.target.value)}
                className="text-xs"
              />
              <Button onClick={handleGuardarAjuste} disabled={guardandoAjuste} className="w-full bg-sky-600 hover:bg-sky-700 text-xs">
                {guardandoAjuste ? "Guardando..." : "Confirmar Ajuste de Proforma"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Subir Boleta */}
      <Dialog open={!!modalBoleta} onOpenChange={() => setModalBoleta(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Adjuntar Boleta de Depósito Bancario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-xs">
            <p className="text-slate-500">
              Adjunte la fotografía o comprobante de transferencia a Banco Unión por el pedido {modalBoleta?.codigo_pedido}:
            </p>
            <input type="file" accept="image/*,application/pdf" onChange={handleSubirBoleta} className="text-xs" />
            {subiendoBoleta && <p className="text-sky-600 animate-pulse font-medium">Subiendo archivo a storage...</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
