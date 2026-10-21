import { useState, useEffect, useMemo } from "react";
import { X, Search, Boxes, Layers, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { verInventarioProductoTerminado } from "../../services/Inventario/Inventario";
import { descargarReporteInventarioProducto } from "@/services/Inventario/Reportes";
import { Roles } from "@/constants/Values";
import Header from "@/components/layout/Header";
import { BotonDescarga } from "@/components/layout/BotonDescarga";
import { estadoStock, ESTILO_STOCK } from "@/utils/stock";
import { BadgeInactivo } from "@/components/Inventario/comunes";
import { descripcionContenido } from "./comunes";

const FILTROS = [
  { id: "todos", texto: "Todos" },
  { id: "disponible", texto: "Con stock" },
  { id: "bajo", texto: "Stock bajo" },
  { id: "critico", texto: "Stock crítico" },
  { id: "agotado", texto: "Sin stock" },
];

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

export default function InventarioProductoTerminado({ usuario }) {
  const esEncargado = usuario?.IdRol === Roles.Encargado;
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [productoFiltro, setProductoFiltro] = useState("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");

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
      if (estadoFiltro !== "todos" && estadoStock(p.CantidadActual, p) !== estadoFiltro)
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

  return (
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <TooltipProvider>
        <Header
          titulo="Almacén · Producto Terminado"
          subtitulo="Inventario de Producto Terminado"
        >
          {esEncargado && (
            <BotonDescarga
              texto="Reporte stock"
              ayuda="PDF con el stock actual de todas las líneas y el detalle de cada presentación"
              exito="Reporte de stock descargado"
              descargar={() => descargarReporteInventarioProducto(null)}
            />
          )}
        </Header>
      </TooltipProvider>

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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.map((p) => {
                      const estado = estadoStock(p.CantidadActual, p);
                      return (
                        <TableRow key={p.IdPresentacion} className="hover:bg-slate-50">
                          <TableCell className="pl-5 font-mono font-bold text-c3">
                            <div className="flex items-center gap-2">
                              {p.CodigoPresentacion}
                              {!p.Activo && <BadgeInactivo className="font-sans" />}
                            </div>
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
                                ESTILO_STOCK[estado].clase,
                              )}
                            >
                              {ESTILO_STOCK[estado].texto}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right text-[15px] font-extrabold tabular-nums",
                              ESTILO_STOCK[estado].numero,
                            )}
                          >
                            {p.CantidadActual}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-2.5 p-3.5 md:hidden">
                {filtradas.map((p) => {
                  const estado = estadoStock(p.CantidadActual, p);
                  return (
                    <div
                      key={p.IdPresentacion}
                      className="flex flex-col gap-3 rounded-2xl border-2 border-slate-200 bg-white p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 font-mono text-[15px] font-extrabold text-c3">
                            {p.CodigoPresentacion}
                            {!p.Activo && <BadgeInactivo className="font-sans" />}
                          </div>
                          <div className="text-[13px] font-semibold text-slate-900">
                            {p.NombreProducto}
                          </div>
                          <div className="text-[12.5px] text-slate-600">
                            {p.TipoContenedor} · {descripcionContenido(p)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <div
                            className={cn(
                              "text-xl font-extrabold tabular-nums",
                              ESTILO_STOCK[estado].numero,
                            )}
                          >
                            {p.CantidadActual}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "border-0 text-[11px] font-bold",
                              ESTILO_STOCK[estado].clase,
                            )}
                          >
                            {ESTILO_STOCK[estado].texto}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
