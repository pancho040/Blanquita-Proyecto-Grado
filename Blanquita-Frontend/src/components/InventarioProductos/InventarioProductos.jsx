import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Minus,
  X,
  Search,
  Loader2,
  MoreVertical,
  ShoppingCart,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  Boxes,
  Layers,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  verInventarioProductoTerminado,
  insertarIngresoProductoTerminado,
  insertarSalidaProductoTerminado,
  ajustePositivoInventarioProductoTerminado,
  ajusteNegativoInventarioProductoTerminado,
} from "../../services/Inventario/Inventario";
import Header from "@/components/layout/Header";

const FILTROS = [
  { id: "todos", texto: "Todos" },
  { id: "disponible", texto: "Con stock" },
  { id: "bajo", texto: "Stock bajo" },
  { id: "agotado", texto: "Sin stock" },
];

const UMBRAL_BAJO = 10;

const estadoStock = (cantidad) => {
  const valor = Number(cantidad || 0);
  if (valor === 0) return "agotado";
  if (valor < UMBRAL_BAJO) return "bajo";
  return "disponible";
};

const ESTILO_ESTADO = {
  disponible: { texto: "Disponible", clase: "bg-emerald-50 text-emerald-700" },
  bajo: { texto: "Stock bajo", clase: "bg-amber-50 text-amber-700" },
  agotado: { texto: "Sin stock", clase: "bg-slate-100 text-slate-500" },
};

const descripcionContenido = (p) => {
  const partes = [];
  if (p.CantidadRollosUnidades) partes.push(`${p.CantidadRollosUnidades} u/paq`);
  if (p.CantidadPorUnidadTerminada)
    partes.push(`${p.CantidadPorUnidadTerminada} por unidad`);
  return partes.length > 0 ? partes.join(" · ") : "—";
};

function TarjetaResumen({ icono: Icono, valor, etiqueta, tono }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", tono)}>
        <Icono size={22} strokeWidth={2.5} />
      </div>
      <div className="flex flex-col">
        <div className="text-3xl font-extrabold tabular-nums text-slate-900">
          {valor}
        </div>
        <div className="text-[12.5px] font-semibold text-slate-500">
          {etiqueta}
        </div>
      </div>
    </div>
  );
}

function AccionesFila({ presentacion, onAgregar, onAjustar }) {
  const sinStock = Number(presentacion.CantidadActual || 0) === 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-9 w-9 p-0 text-slate-500 hover:text-slate-900"
          >
            <MoreVertical size={17} strokeWidth={2.5} />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-mono text-[12.5px]">
            {presentacion.CodigoPresentacion}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onAgregar(presentacion, "ingreso")}
            className="gap-2.5 font-semibold"
          >
            <ArrowDownToLine size={15} strokeWidth={2.5} className="text-emerald-600" />
            Agregar ingreso
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={sinStock}
            onClick={() => onAgregar(presentacion, "salida")}
            className="gap-2.5 font-semibold"
          >
            <ArrowUpFromLine size={15} strokeWidth={2.5} className="text-c3" />
            Agregar salida
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onAjustar(presentacion)}
            className="gap-2.5 font-semibold"
          >
            <SlidersHorizontal size={15} strokeWidth={2.5} className="text-slate-500" />
            Ajustar inventario
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilaEnCarrito({ linea, presentacion, onCantidad, onQuitar }) {
  const esIngreso = linea.Tipo === "ingreso";
  const maximo = esIngreso ? null : Number(presentacion.CantidadActual || 0);

  const ajustar = (delta) => {
    let siguiente = Number(linea.Cantidad || 0) + delta;
    if (siguiente < 1) siguiente = 1;
    if (maximo !== null && siguiente > maximo) siguiente = maximo;
    onCantidad(linea.IdPresentacion, siguiente);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "border-0 text-[11px] font-extrabold uppercase",
                esIngreso
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-c4/10 text-c3",
              )}
            >
              {esIngreso ? "Ingreso" : "Salida"}
            </Badge>
            <span className="font-mono text-sm font-extrabold text-slate-900">
              {presentacion.CodigoPresentacion}
            </span>
          </div>
          <div className="text-[12.5px] text-slate-500">
            {presentacion.NombreProducto} · stock {presentacion.CantidadActual}
          </div>
        </div>
        <button
          onClick={() => onQuitar(linea.IdPresentacion)}
          className="text-slate-400 transition-colors hover:text-red-600"
        >
          <Trash2 size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2.5">
        <div className="text-[12px] font-bold uppercase tracking-wide text-slate-400">
          Cantidad
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => ajustar(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-slate-200 text-slate-600 hover:border-slate-300"
          >
            <Minus size={14} strokeWidth={3} />
          </button>
          <Input
            type="number"
            min={1}
            value={linea.Cantidad}
            onChange={(e) => {
              const valor = Number(e.target.value);
              if (Number.isNaN(valor)) return;
              if (maximo !== null && valor > maximo) {
                onCantidad(linea.IdPresentacion, maximo);
                return;
              }
              onCantidad(linea.IdPresentacion, valor < 1 ? 1 : valor);
            }}
            className="h-8 w-16 text-center font-bold tabular-nums"
          />
          <button
            onClick={() => ajustar(1)}
            disabled={maximo !== null && Number(linea.Cantidad) >= maximo}
            className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-40"
          >
            <Plus size={14} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InventarioProductoTerminado({ usuario }) {
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [productoFiltro, setProductoFiltro] = useState("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");

  const [carrito, setCarrito] = useState([]);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [observacionGlobal, setObservacionGlobal] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [ajuste, setAjuste] = useState(null);
  const [cantidadAjuste, setCantidadAjuste] = useState("");
  const [observacionAjuste, setObservacionAjuste] = useState("");
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);

  useEffect(() => {
    cargarInventario();
  }, []);

  const cargarInventario = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await verInventarioProductoTerminado();
      setInventario(data);
    } catch (e) {
      setError(e.message);
      setInventario([]);
    } finally {
      setLoading(false);
    }
  };

  const productos = useMemo(() => {
    const nombres = new Set();
    inventario.forEach((p) => nombres.add(p.NombreProducto));
    return Array.from(nombres);
  }, [inventario]);

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return inventario.filter((p) => {
      if (productoFiltro !== "todos" && p.NombreProducto !== productoFiltro)
        return false;
      if (estadoFiltro !== "todos" && estadoStock(p.CantidadActual) !== estadoFiltro)
        return false;
      if (!termino) return true;
      return (
        p.CodigoPresentacion.toLowerCase().includes(termino) ||
        p.NombreProducto.toLowerCase().includes(termino) ||
        p.TipoContenedor.toLowerCase().includes(termino)
      );
    });
  }, [inventario, busqueda, productoFiltro, estadoFiltro]);

  const totalUnidades = inventario.reduce(
    (s, p) => s + Number(p.CantidadActual || 0),
    0,
  );
  const totalAgotadas = inventario.filter(
    (p) => Number(p.CantidadActual || 0) === 0,
  ).length;

  const buscarPresentacion = (idPresentacion) =>
    inventario.find((p) => p.IdPresentacion === idPresentacion);

  const lineasIngreso = carrito.filter((l) => l.Tipo === "ingreso");
  const lineasSalida = carrito.filter((l) => l.Tipo === "salida");

  const agregarLinea = (presentacion, tipo) => {
    setCarrito((prev) => {
      const existente = prev.find(
        (l) => l.IdPresentacion === presentacion.IdPresentacion,
      );
      if (existente) {
        if (existente.Tipo === tipo) {
          toast.info(`${presentacion.CodigoPresentacion} ya está en la lista`);
          return prev;
        }
        return prev.map((l) =>
          l.IdPresentacion === presentacion.IdPresentacion
            ? { ...l, Tipo: tipo, Cantidad: 1 }
            : l,
        );
      }
      return [
        ...prev,
        { IdPresentacion: presentacion.IdPresentacion, Tipo: tipo, Cantidad: 1 },
      ];
    });
    setCarritoAbierto(true);
  };

  const cambiarCantidadLinea = (idPresentacion, cantidad) => {
    setCarrito((prev) =>
      prev.map((l) =>
        l.IdPresentacion === idPresentacion ? { ...l, Cantidad: cantidad } : l,
      ),
    );
  };

  const quitarLinea = (idPresentacion) => {
    setCarrito((prev) => prev.filter((l) => l.IdPresentacion !== idPresentacion));
  };

  const vaciarCarrito = () => {
    setCarrito([]);
    setObservacionGlobal("");
  };

  const confirmarMovimientos = async () => {
    if (carrito.length === 0) return;

    const observacion = observacionGlobal.trim() ? observacionGlobal.trim() : null;
    const payloadIngreso = lineasIngreso.map((l) => ({
      IdPresentacion: l.IdPresentacion,
      Cantidad: Number(l.Cantidad),
      Observacion: observacion,
    }));
    const payloadSalida = lineasSalida.map((l) => ({
      IdPresentacion: l.IdPresentacion,
      Cantidad: Number(l.Cantidad),
      Observacion: observacion,
    }));

    setEnviando(true);
    try {
      if (payloadIngreso.length > 0) {
        await insertarIngresoProductoTerminado(payloadIngreso);
      }
      if (payloadSalida.length > 0) {
        await insertarSalidaProductoTerminado(payloadSalida);
      }
      const resumen = [];
      if (payloadIngreso.length > 0) resumen.push(`${payloadIngreso.length} ingreso(s)`);
      if (payloadSalida.length > 0) resumen.push(`${payloadSalida.length} salida(s)`);
      toast.success(`Registrado: ${resumen.join(" y ")}`);
      vaciarCarrito();
      setCarritoAbierto(false);
      cargarInventario();
    } catch (e) {
      toast.error(e.message);
      cargarInventario();
    } finally {
      setEnviando(false);
    }
  };

  const abrirAjuste = (presentacion) => {
    setAjuste({ Presentacion: presentacion, Tipo: "positivo" });
    setCantidadAjuste("");
    setObservacionAjuste("");
  };

  const cerrarAjuste = () => {
    setAjuste(null);
    setCantidadAjuste("");
    setObservacionAjuste("");
  };

  const confirmarAjuste = async () => {
    if (!ajuste) return;

    const cantidad = Number(cantidadAjuste);
    if (!cantidad || cantidad <= 0) {
      toast.error("Ingresa una cantidad válida");
      return;
    }
    if (
      ajuste.Tipo === "negativo" &&
      cantidad > Number(ajuste.Presentacion.CantidadActual || 0)
    ) {
      toast.error("La cantidad supera el stock disponible");
      return;
    }
    if (!observacionAjuste.trim()) {
      toast.error("La observación es obligatoria para un ajuste");
      return;
    }

    setGuardandoAjuste(true);
    try {
      if (ajuste.Tipo === "positivo") {
        await ajustePositivoInventarioProductoTerminado(
          ajuste.Presentacion.IdPresentacion,
          cantidad,
          observacionAjuste.trim(),
        );
      } else {
        await ajusteNegativoInventarioProductoTerminado(
          ajuste.Presentacion.IdPresentacion,
          cantidad,
          observacionAjuste.trim(),
        );
      }
      toast.success(
        `Ajuste aplicado a ${ajuste.Presentacion.CodigoPresentacion}`,
      );
      cerrarAjuste();
      cargarInventario();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardandoAjuste(false);
    }
  };

  return (
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header
        titulo="Almacén · Producto Terminado"
        subtitulo="Inventario de Producto Terminado"
        contador={carrito.length}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TarjetaResumen
            icono={Boxes}
            valor={totalUnidades}
            etiqueta="Unidades en almacén"
            tono="bg-c4/10 text-c3"
          />
          <TarjetaResumen
            icono={Layers}
            valor={inventario.length}
            etiqueta="Presentaciones registradas"
            tono="bg-slate-100 text-slate-700"
          />
          <TarjetaResumen
            icono={AlertTriangle}
            valor={totalAgotadas}
            etiqueta="Presentaciones sin stock"
            tono="bg-amber-50 text-amber-700"
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3.5 border-b border-slate-100 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[220px] flex-1">
                <Search
                  size={16}
                  strokeWidth={2.5}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por código, producto o contenedor..."
                  className="h-11 pl-9"
                />
                {busqueda && (
                  <button
                    onClick={() => setBusqueda("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X size={15} strokeWidth={2.75} />
                  </button>
                )}
              </div>
              <Button
                onClick={() => setCarritoAbierto(true)}
                disabled={carrito.length === 0}
                className="h-11 gap-2 bg-slate-900 font-extrabold text-white hover:bg-slate-800"
              >
                <ShoppingCart size={16} strokeWidth={2.75} />
                Movimientos
                {carrito.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-white/20 px-2 py-0.5 text-[12px] tabular-nums">
                    {carrito.length}
                  </span>
                )}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setProductoFiltro("todos")}
                className={cn(
                  "rounded-full border-2 px-3.5 py-1.5 text-[12.5px] font-bold transition-colors",
                  productoFiltro === "todos"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-600 hover:border-slate-300",
                )}
              >
                Todos los productos
              </button>
              {productos.map((nombre) => (
                <button
                  key={nombre}
                  onClick={() => setProductoFiltro(nombre)}
                  className={cn(
                    "rounded-full border-2 px-3.5 py-1.5 text-[12.5px] font-bold transition-colors",
                    productoFiltro === nombre
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 text-slate-600 hover:border-slate-300",
                  )}
                >
                  {nombre}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setEstadoFiltro(f.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-colors",
                    estadoFiltro === f.id
                      ? "bg-c4/10 text-c3"
                      : "text-slate-500 hover:bg-slate-50",
                  )}
                >
                  {f.texto}
                </button>
              ))}
              <div className="ml-auto text-[12.5px] font-semibold text-slate-500">
                {filtradas.length} de {inventario.length}
              </div>
            </div>
          </div>

          {loading && (
            <div className="space-y-2 p-5">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {error && (
            <div className="p-5 text-center text-sm font-semibold text-red-600">
              {error}
            </div>
          )}

          {!loading && !error && filtradas.length === 0 && (
            <div className="p-10 text-center text-sm text-slate-400">
              Ninguna presentación coincide con los filtros aplicados.
            </div>
          )}

          {!loading && !error && filtradas.length > 0 && (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5">Código</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Contenedor</TableHead>
                      <TableHead>Contenido</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="w-14 pr-5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.map((p) => {
                      const estado = estadoStock(p.CantidadActual);
                      const enCarrito = carrito.some(
                        (l) => l.IdPresentacion === p.IdPresentacion,
                      );
                      return (
                        <TableRow
                          key={p.IdPresentacion}
                          className={cn(
                            "hover:bg-slate-50",
                            enCarrito && "bg-c4/5 hover:bg-c4/5",
                          )}
                        >
                          <TableCell className="pl-5 font-mono font-bold text-c3">
                            {p.CodigoPresentacion}
                          </TableCell>
                          <TableCell className="font-semibold text-slate-900">
                            {p.NombreProducto}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {p.TipoContenedor}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {descripcionContenido(p)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "border-0 font-bold",
                                ESTILO_ESTADO[estado].clase,
                              )}
                            >
                              {ESTILO_ESTADO[estado].texto}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-[15px] font-extrabold tabular-nums text-slate-900">
                            {p.CantidadActual}
                          </TableCell>
                          <TableCell className="pr-5">
                            <div className="flex justify-end">
                              <AccionesFila
                                presentacion={p}
                                onAgregar={agregarLinea}
                                onAjustar={abrirAjuste}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-2.5 p-3.5 md:hidden">
                {filtradas.map((p) => {
                  const estado = estadoStock(p.CantidadActual);
                  const enCarrito = carrito.some(
                    (l) => l.IdPresentacion === p.IdPresentacion,
                  );
                  return (
                    <div
                      key={p.IdPresentacion}
                      className={cn(
                        "flex flex-col gap-3 rounded-2xl border-2 p-3.5",
                        enCarrito
                          ? "border-c4/30 bg-c4/8"
                          : "border-slate-200 bg-white",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex flex-col gap-1">
                          <div className="font-mono text-[15px] font-extrabold text-c3">
                            {p.CodigoPresentacion}
                          </div>
                          <div className="text-[13px] font-semibold text-slate-900">
                            {p.NombreProducto}
                          </div>
                          <div className="text-[12.5px] text-slate-600">
                            {p.TipoContenedor} · {descripcionContenido(p)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="text-xl font-extrabold tabular-nums text-slate-900">
                            {p.CantidadActual}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "border-0 text-[11px] font-bold",
                              ESTILO_ESTADO[estado].clase,
                            )}
                          >
                            {ESTILO_ESTADO[estado].texto}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => agregarLinea(p, "ingreso")}
                          className="h-10 flex-1 gap-1.5 bg-emerald-600 font-bold text-white hover:bg-emerald-700"
                        >
                          <ArrowDownToLine size={15} strokeWidth={2.75} />
                          Ingreso
                        </Button>
                        <Button
                          onClick={() => agregarLinea(p, "salida")}
                          disabled={Number(p.CantidadActual || 0) === 0}
                          variant="outline"
                          className="h-10 flex-1 gap-1.5 border-2 border-slate-300 font-bold text-slate-700"
                        >
                          <ArrowUpFromLine size={15} strokeWidth={2.75} />
                          Salida
                        </Button>
                        <Button
                          onClick={() => abrirAjuste(p)}
                          variant="ghost"
                          className="h-10 w-10 p-0 text-slate-500"
                        >
                          <SlidersHorizontal size={16} strokeWidth={2.5} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {carrito.length > 0 && !carritoAbierto && (
        <button
          onClick={() => setCarritoAbierto(true)}
          className="fixed bottom-24 right-5 z-30 flex items-center gap-2.5 rounded-full bg-slate-900 px-5 py-3.5 font-extrabold text-white shadow-lg md:bottom-8"
        >
          <ShoppingCart size={18} strokeWidth={2.75} />
          {carrito.length} pendientes
        </button>
      )}

      <Sheet open={carritoAbierto} onOpenChange={setCarritoAbierto}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-lg font-extrabold">
              Movimientos pendientes
            </SheetTitle>
            <SheetDescription>
              {lineasIngreso.length} ingreso(s) · {lineasSalida.length} salida(s)
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {carrito.length === 0 && (
              <div className="py-16 text-center text-sm text-slate-400">
                No hay movimientos cargados.
              </div>
            )}

            {lineasIngreso.length > 0 && (
              <div className="mb-4 flex flex-col gap-2.5">
                <div className="text-[12px] font-bold uppercase tracking-wide text-emerald-700">
                  Ingresos
                </div>
                {lineasIngreso.map((l) => {
                  const presentacion = buscarPresentacion(l.IdPresentacion);
                  if (!presentacion) return null;
                  return (
                    <FilaEnCarrito
                      key={l.IdPresentacion}
                      linea={l}
                      presentacion={presentacion}
                      onCantidad={cambiarCantidadLinea}
                      onQuitar={quitarLinea}
                    />
                  );
                })}
              </div>
            )}

            {lineasSalida.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="text-[12px] font-bold uppercase tracking-wide text-c3">
                  Salidas
                </div>
                {lineasSalida.map((l) => {
                  const presentacion = buscarPresentacion(l.IdPresentacion);
                  if (!presentacion) return null;
                  return (
                    <FilaEnCarrito
                      key={l.IdPresentacion}
                      linea={l}
                      presentacion={presentacion}
                      onCantidad={cambiarCantidadLinea}
                      onQuitar={quitarLinea}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {carrito.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-3 px-4 py-4">
                <div className="flex flex-col gap-1.5">
                  <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
                    Observación general
                  </div>
                  <Textarea
                    value={observacionGlobal}
                    onChange={(e) => setObservacionGlobal(e.target.value)}
                    placeholder="Se aplica a todas las líneas (opcional)"
                    className="min-h-16 resize-none"
                  />
                </div>
              </div>
            </>
          )}

          <SheetFooter className="flex-row gap-2 border-t border-slate-100 px-4 py-4">
            <Button
              variant="ghost"
              onClick={vaciarCarrito}
              disabled={carrito.length === 0 || enviando}
              className="h-11 font-bold text-slate-500 hover:text-slate-900"
            >
              Vaciar
            </Button>
            <Button
              onClick={confirmarMovimientos}
              disabled={carrito.length === 0 || enviando}
              className="h-11 flex-1 gap-2 bg-slate-900 font-extrabold text-white hover:bg-slate-800"
            >
              {enviando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Procesando...
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog
        open={ajuste !== null}
        onOpenChange={(abierto) => !abierto && cerrarAjuste()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">
              Ajuste de inventario
            </DialogTitle>
            <DialogDescription>
              {ajuste
                ? `${ajuste.Presentacion.CodigoPresentacion} · ${ajuste.Presentacion.NombreProducto} · stock actual ${ajuste.Presentacion.CantidadActual}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {ajuste && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setAjuste({ ...ajuste, Tipo: "positivo" })}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border-2 px-3.5 py-3 text-left transition-colors",
                    ajuste.Tipo === "positivo"
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 bg-white",
                  )}
                >
                  <div className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-700">
                    <Plus size={14} strokeWidth={3} />
                    Positivo
                  </div>
                  <div className="text-[12px] text-slate-500">
                    Suma unidades al stock
                  </div>
                </button>
                <button
                  onClick={() => setAjuste({ ...ajuste, Tipo: "negativo" })}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border-2 px-3.5 py-3 text-left transition-colors",
                    ajuste.Tipo === "negativo"
                      ? "border-red-400 bg-red-50"
                      : "border-slate-200 bg-white",
                  )}
                >
                  <div className="flex items-center gap-1.5 text-sm font-extrabold text-red-600">
                    <Minus size={14} strokeWidth={3} />
                    Negativo
                  </div>
                  <div className="text-[12px] text-slate-500">
                    Resta unidades del stock
                  </div>
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
                  Cantidad
                </div>
                <Input
                  type="number"
                  min={1}
                  value={cantidadAjuste}
                  onChange={(e) => setCantidadAjuste(e.target.value)}
                  placeholder="0"
                  className="h-11 font-bold tabular-nums"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
                  Observación
                </div>
                <Textarea
                  value={observacionAjuste}
                  onChange={(e) => setObservacionAjuste(e.target.value)}
                  placeholder="Motivo del ajuste..."
                  className="min-h-20 resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={cerrarAjuste}
              className="h-11 font-bold text-slate-500 hover:text-slate-900"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarAjuste}
              disabled={guardandoAjuste}
              className={cn(
                "h-11 gap-2 font-extrabold text-white",
                ajuste && ajuste.Tipo === "negativo"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700",
              )}
            >
              {guardandoAjuste ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                "Aplicar ajuste"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}