import React, { useState, useEffect } from "react";
import { Factory, UploadCloud, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/common/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ObtenerCatalogoStock,
  ListarDistribuidores,
  ListarPedidos,
  CrearPedidoDistribuidor,
  AjustarPedidoKevin,
  SubirBoletaPago,
  AprobarDespachoKevin
} from "@/services/Distribuidor/distribuidorService";
import { SubirArchivoComprobante } from "@/services/Logistica/EnvioService";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";

export default function GestionDistribuidoresMayoristas({ usuario }) {
  const [tabActiva, setTabActiva] = useState("pedidos"); // 'pedidos' | 'nuevo_pedido' | 'catalogo'
  const [distribuidores, setDistribuidores] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Paginación
  const paginacionPedidos = usePaginacion(pedidos, 8);
  const paginacionCatalogo = usePaginacion(catalogo, 9);

  // Formulario nuevo pedido
  const [distribuidorId, setDistribuidorId] = useState("");
  const [carrito, setCarrito] = useState({}); // presentacion_id -> cantidad
  const [observacionDist, setObservacionDist] = useState("");
  const [enviandoPedido, setEnviandoPedido] = useState(false);

  // Modal Ajuste Supervisión
  const [modalAjuste, setModalAjuste] = useState(null);
  const [cantidadesAjustadas, setCantidadesAjustadas] = useState({});
  const [obsSupervision, setObsSupervision] = useState("");
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);

  // Modal Subir Boleta
  const [modalBoleta, setModalBoleta] = useState(null);
  const [subiendoBoleta, setSubiendoBoleta] = useState(false);

  const esSupervisorOAdmin = usuario?.IsAdmin || usuario?.IdRol === 1 || usuario?.IdRol === 2;

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
    pedido.detalles.forEach((d) => {
      cantInit[d.id] = d.cantidad_aprobada ?? d.cantidad_solicitada;
    });
    setCantidadesAjustadas(cantInit);
    setObsSupervision(pedido.observacion_kevin || "");
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
        observacion_kevin: obsSupervision
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
    <div className="max-w-6xl mx-auto space-y-4">
      {/* CABECERA INDUSTRIAL MODO OPERATE */}
      <div className="bg-white border border-slate-200 rounded p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Factory className="w-5 h-5 text-slate-700" /> Portal de Distribuidores Externos
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión mayorista para Oruro, Tarija, La Paz y Tupiza con validación estricta en planta
          </p>
        </div>
        <div className="flex items-center gap-1.5 self-stretch sm:self-auto">
          {[
            { id: "pedidos", label: "Bandeja de Pedidos" },
            { id: "nuevo_pedido", label: "+ Crear Pedido" },
            { id: "catalogo", label: "Stock en Planta" }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTabActiva(tab.id)}
              className={`h-8 px-3 rounded text-xs font-medium transition-colors ${
                tabActiva === tab.id
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="bg-white border border-slate-200 rounded p-8 text-center text-xs text-slate-500">
          Cargando datos mayoristas...
        </div>
      ) : tabActiva === "pedidos" ? (
        <div className="space-y-3">
          {pedidos.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded p-8 text-center text-xs text-slate-500">
              No hay pedidos mayoristas registrados.
            </div>
          ) : (
            paginacionPedidos.itemsPaginados.map((ped, idx) => (
              <div key={`ped-${ped.id || idx}`} className="bg-white border border-slate-200 rounded p-4 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm font-mono">{ped.codigo_pedido}</span>
                      <StatusBadge status={ped.estado} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{ped.nombre_distribuidor} ({ped.ciudad}) • {new Date(ped.fecha_pedido).toLocaleDateString()}</span>
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-xs text-slate-500 block">Monto Total</span>
                    <p className="text-base font-semibold font-mono tabular-nums text-slate-900">
                      Bs. {Number(ped.monto_total).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded p-2.5 bg-slate-50 divide-y divide-slate-200 text-xs">
                  {ped.detalles.map((d) => (
                    <div key={d.id} className="py-1.5 flex justify-between items-center">
                      <span className="font-medium text-slate-800">
                        {d.nombre_producto || `Presentación #${d.presentacion_id}`}
                      </span>
                      <div className="flex items-center gap-4 text-slate-600 font-mono tabular-nums">
                        <span>Sol: {d.cantidad_solicitada}</span>
                        {d.cantidad_aprobada !== null && (
                          <span className="text-slate-900 font-medium">Aprob: {d.cantidad_aprobada}</span>
                        )}
                        <span className="font-semibold">Bs. {d.subtotal.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  {esSupervisorOAdmin && ped.estado === "PENDIENTE_REVISION" && (
                    <Button
                      size="sm"
                      onClick={() => abrirModalAjuste(ped)}
                      className="h-8 text-xs font-medium rounded bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      Revisar y Ajustar Cantidades
                    </Button>
                  )}
                  {ped.estado === "PROFORMA_AJUSTADA" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setModalBoleta(ped)}
                      className="h-8 text-xs font-medium rounded border-slate-200 text-slate-700 hover:bg-slate-50 gap-1"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-slate-500" /> Adjuntar Boleta de Depósito
                    </Button>
                  )}
                  {ped.url_comprobante && (
                    <a
                      href={ped.url_comprobante}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#0369A1] hover:underline font-medium self-center px-1"
                    >
                      Ver Boleta
                    </a>
                  )}
                  {esSupervisorOAdmin && ped.estado === "COMPROBANTE_SUBIDO" && (
                    <Button
                      size="sm"
                      onClick={() => handleAprobarDespacho(ped.id)}
                      className="h-8 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Autorizar Despacho
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
          {pedidos.length > 0 && <PaginacionTabla {...paginacionPedidos} />}
        </div>
      ) : tabActiva === "nuevo_pedido" ? (
        <form onSubmit={handleCrearPedido} className="bg-white border border-slate-200 rounded p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase block mb-1">
              Distribuidor Destino
            </label>
            <select
              value={distribuidorId}
              onChange={(e) => setDistribuidorId(e.target.value)}
              className="w-full h-8 px-2.5 rounded border border-slate-200 text-xs bg-white text-slate-800"
              required
            >
              {distribuidores.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre_comercial} ({d.ciudad}) - Contacto: {d.contacto_nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-slate-700 uppercase mb-2">
              Catálogo Mayorista y Stock en Planta (Planta Sucre)
            </h2>
            <div className="border border-slate-200 rounded overflow-hidden divide-y divide-slate-100 text-xs">
              <div className="bg-slate-50 p-2.5 font-medium grid grid-cols-12 text-slate-700 uppercase text-xs">
                <span className="col-span-6">Producto</span>
                <span className="col-span-3 text-center">Stock Disponible</span>
                <span className="col-span-3 text-center">Cantidad Solicitada</span>
              </div>
              {catalogo.map((c) => (
                <div key={c.presentacion_id} className="p-2.5 grid grid-cols-12 items-center hover:bg-slate-50">
                  <div className="col-span-6">
                    <p className="font-medium text-slate-900">{c.producto_nombre}</p>
                    <p className="text-xs text-slate-500">{c.codigo_presentacion} • {c.tipo_contenedor}</p>
                  </div>
                  <span className="col-span-3 text-center font-mono tabular-nums font-semibold text-slate-800">
                    {c.stock_disponible} paq.
                  </span>
                  <div className="col-span-3 flex justify-center">
                    <Input
                      type="number"
                      min="0"
                      max={c.stock_disponible}
                      value={carrito[c.presentacion_id] || ""}
                      onChange={(e) => handleCantidadCarrito(c.presentacion_id, e.target.value)}
                      placeholder="0"
                      className="w-24 text-center text-xs h-7 rounded border-slate-200 font-mono tabular-nums"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase block mb-1">
              Observaciones Adicionales
            </label>
            <Input
              type="text"
              placeholder="Notas opcionales de entrega o transporte..."
              value={observacionDist}
              onChange={(e) => setObservacionDist(e.target.value)}
              className="text-xs h-8 rounded border-slate-200"
            />
          </div>

          <Button
            type="submit"
            disabled={enviandoPedido}
            className="w-full bg-[#1C96C5] hover:bg-[#157A9E] text-white font-medium h-9 text-xs rounded"
          >
            {enviandoPedido ? "Enviando Pedido..." : "Enviar Pedido a Revisión"}
          </Button>
        </form>
      ) : (
        <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
          <h2 className="text-xs font-bold text-slate-900 uppercase">
            Stock Físico de Planta Sucre (Solo Lectura)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {paginacionCatalogo.itemsPaginados.map((c, idx) => (
              <div key={`cat-${c.presentacion_id || idx}`} className="p-3 bg-white border border-slate-200 rounded">
                <p className="font-medium text-slate-900 text-xs">{c.producto_nombre}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.tipo_contenedor}</p>
                <p className="text-base font-semibold font-mono tabular-nums text-slate-900 mt-2">
                  {c.stock_disponible} paq.
                </p>
              </div>
            ))}
          </div>
          {catalogo.length > 0 && <PaginacionTabla {...paginacionCatalogo} />}
        </div>
      )}

      {/* Modal Ajuste Supervisión */}
      <Dialog open={!!modalAjuste} onOpenChange={() => setModalAjuste(null)}>
        <DialogContent className="max-w-lg rounded border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900">Ajustar Proforma de Pedido</DialogTitle>
          </DialogHeader>
          {modalAjuste && (
            <div className="space-y-3 pt-2 text-xs">
              <div className="divide-y divide-slate-100 border border-slate-200 rounded p-2.5 bg-slate-50">
                {modalAjuste.detalles.map((d) => (
                  <div key={d.id} className="py-2 flex justify-between items-center">
                    <span className="font-medium text-slate-800">{d.nombre_producto}</span>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span className="text-slate-500 text-xs">Sol: {d.cantidad_solicitada}</span>
                      <Input
                        type="number"
                        value={cantidadesAjustadas[d.id] ?? d.cantidad_solicitada}
                        onChange={(e) =>
                          setCantidadesAjustadas({
                            ...cantidadesAjustadas,
                            [d.id]: e.target.value
                          })
                        }
                        className="w-20 text-center text-xs h-7 rounded border-slate-200 font-mono tabular-nums"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Input
                placeholder="Observación de ajuste para el distribuidor"
                value={obsSupervision}
                onChange={(e) => setObsSupervision(e.target.value)}
                className="text-xs h-8 rounded border-slate-200"
              />
              <Button
                onClick={handleGuardarAjuste}
                disabled={guardandoAjuste}
                className="w-full bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs font-medium h-8 rounded"
              >
                {guardandoAjuste ? "Guardando..." : "Confirmar Ajuste de Proforma"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Subir Boleta */}
      <Dialog open={!!modalBoleta} onOpenChange={() => setModalBoleta(null)}>
        <DialogContent className="max-w-md rounded border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900">Adjuntar Boleta de Depósito Bancario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            <p className="text-slate-600">
              Adjunte la fotografía o comprobante de transferencia a Banco Unión por el pedido {modalBoleta?.codigo_pedido}:
            </p>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleSubirBoleta}
              className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
            />
            {subiendoBoleta && <p className="text-slate-700 font-medium">Subiendo archivo a storage...</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
