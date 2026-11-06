import React, { useState, useEffect } from "react";
import {
  Truck,
  Users,
  Route,
  Tag,
  MapPin,
  RefreshCw,
  Clock,
  Radio,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ChevronRight,
  TrendingUp,
  Package,
  CircleDollarSign,
  Navigation
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { invalidarCache } from "@/lib/api-cache";

import {
  ObtenerAsignaciones,
  ObtenerRepartidores,
  ObtenerZonas,
  ObtenerRutas,
} from "@/services/Logistica/RutaService";
import { ObtenerClientesSimple } from "@/services/Logistica/ClienteService";

export default function InicioSupervisor({ usuario }) {
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [fechaActual, setFechaActual] = useState("");

  const [asignaciones, setAsignaciones] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [clientesCount, setClientesCount] = useState(0);

  useEffect(() => {
    const f = new Intl.DateTimeFormat("es-BO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
    setFechaActual(f.charAt(0).toUpperCase() + f.slice(1));
    cargarLogistica();
  }, []);

  const cargarLogistica = async (forzar = false) => {
    if (forzar) {
      setRefrescando(true);
      invalidarCache("/api/logistica");
    } else {
      setCargando(true);
    }

    try {
      const hoyStr = new Date().toISOString().split("T")[0];

      const [asigRes, repartRes, zonasRes, rutasRes, clientesRes] = await Promise.all([
        ObtenerAsignaciones(hoyStr).catch(() => []),
        ObtenerRepartidores().catch(() => []),
        ObtenerZonas().catch(() => []),
        ObtenerRutas().catch(() => []),
        ObtenerClientesSimple().catch(() => []),
      ]);

      setAsignaciones(Array.isArray(asigRes) ? asigRes : (asigRes?.items || []));
      setRepartidores(Array.isArray(repartRes) ? repartRes : (repartRes?.items || []));
      setZonas(Array.isArray(zonasRes) ? zonasRes : (zonasRes?.items || []));
      setRutas(Array.isArray(rutasRes) ? rutasRes : (rutasRes?.items || []));
      setClientesCount(Array.isArray(clientesRes) ? clientesRes.length : 0);
    } catch (err) {
      console.error("Error al cargar dashboard logístico:", err);
      toast.error("Error al sincronizar operaciones de logística.");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  const repartidoresEnRuta = repartidores.filter(
    (r) => r.Estado === "EN_RUTA" || r.IdEstadoRepartidor === 2
  ).length;

  const totalDespachos = asignaciones.length;
  const despachosEntregados = asignaciones.filter(
    (a) => a.Estado === "ENTREGADO" || a.Completado
  ).length;

  const totalMontoRecaudadoRuta = asignaciones.reduce(
    (acc, a) => acc + (parseFloat(a.TotalCobrado || a.MontoCobrado || 0) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* 1. ENCABEZADO MINIMALISTA LOGÍSTICO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <Truck className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                Logística & Distribución
              </span>
              <span className="text-xs text-slate-400 tabular-nums">Flota de Reparto Sucre</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Centro de Control Logístico
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {fechaActual} · Despacho de vehículos, seguimiento de rutas de entrega y liquidaciones de campo.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => cargarLogistica(true)}
              disabled={refrescando || cargando}
              className="text-xs border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 h-9 font-medium"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 text-slate-500 ${refrescando ? "animate-spin" : ""}`} />
              {refrescando ? "Sincronizando..." : "Actualizar"}
            </Button>
            <a href="/supervisor/asignaciones">
              <Button size="sm" className="text-xs bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 h-9 font-medium">
                <Truck className="h-3.5 w-3.5 mr-1.5" />
                Programar Despacho
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* 2. MATRIZ DE KPIS LOGÍSTICOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Flota en Ruta */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Flota en Calle
              </span>
              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {cargando ? "---" : `${repartidoresEnRuta} de ${repartidores.length}`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>Repartidores activos</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {repartidores.length - repartidoresEnRuta} en base
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Operación en Sucre</span>
              <a href="/supervisor/rutas/rastreo" className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center">
                Rastreo GPS <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Despachos del Día */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Despachos Programados
              </span>
              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {cargando ? "---" : `${totalDespachos} asignaciones`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>{despachosEntregados} entregados</span>
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {totalDespachos - despachosEntregados} en tránsito
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Jornada de entregas</span>
              <a href="/supervisor/asignaciones" className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center">
                Despachos <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Clientes Georreferenciados */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Puntos de Entrega
              </span>
              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {cargando ? "---" : `${clientesCount} clientes`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>{zonas.length} zonas delimitadas</span>
                <span className="tabular-nums text-slate-600 dark:text-slate-300 font-medium">
                  {rutas.length} rutas
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Directorio de tiendas y almacenes</span>
              <a href="/supervisor/clientes" className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center">
                Clientes <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Recaudación en Ruta */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cobranza en Tránsito
              </span>
              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <CircleDollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {cargando ? "---" : `Bs. ${totalMontoRecaudadoRuta.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>Cobrado en campo hoy</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Pendiente liquidación
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Rendición directa a caja</span>
              <a href="/contador/caja" className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center">
                Caja <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. DOS COLUMNAS: DESPACHOS EN CURSO Y ZONAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMNA 1 & 2: TABLA DE ASIGNACIONES DEL DÍA (2 COLS) */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-slate-500" />
                    Despachos y Cuadrillas en Ruta
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Seguimiento operativo de choferes y paradas de entrega
                  </p>
                </div>
                <a href="/supervisor/asignaciones">
                  <Button variant="outline" size="sm" className="h-7 text-xs border-slate-200 dark:border-slate-700">
                    Administrar
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {asignaciones.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <div className="p-3 rounded-full bg-slate-50 dark:bg-slate-800 w-fit mx-auto text-slate-400">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="text-xs text-slate-500">No se registran despachos activos para el día de hoy.</div>
                  <a href="/supervisor/asignaciones">
                    <Button variant="link" size="sm" className="text-xs text-blue-600">
                      Crear nueva asignación de ruta
                    </Button>
                  </a>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50/50 dark:bg-slate-800/40 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Repartidor & Vehículo</th>
                        <th className="py-2.5 px-4 font-semibold">Ruta / Zona</th>
                        <th className="py-2.5 px-4 font-semibold">Paradas</th>
                        <th className="py-2.5 px-4 font-semibold">Cobrado</th>
                        <th className="py-2.5 px-4 font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {asignaciones.map((asig, idx) => (
                        <tr key={asig.IdAsignacionRuta || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {asig.Repartidor || asig.NombreRepartidor || "Repartidor"}
                            </div>
                            <div className="text-[11px] text-slate-400 tabular-nums">
                              Placa: {asig.Placa || asig.Vehiculo || "---"}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-800 dark:text-slate-200">
                              {asig.NombreRuta || "Ruta de reparto"}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {asig.NombreZona || "Zona Sucre"}
                            </div>
                          </td>
                          <td className="py-3 px-4 tabular-nums">
                            {asig.TotalParadas ? `${asig.ParadasCompletadas || 0} / ${asig.TotalParadas}` : "En tránsito"}
                          </td>
                          <td className="py-3 px-4 tabular-nums font-semibold text-slate-900 dark:text-white">
                            Bs. {parseFloat(asig.TotalCobrado || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-normal ${
                                asig.Estado === "ENTREGADO" || asig.Completado
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                              }`}
                            >
                              {asig.Estado || "EN RUTA"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA 3: DIRECTORIO DE ZONAS & ATRIBUTOS (1 COL) */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  Zonas de Distribución
                </CardTitle>
                <a href="/supervisor/rutas">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500">
                    Configurar
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {zonas.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  {cargando ? "Cargando sectores..." : "No hay zonas configuradas."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {zonas.slice(0, 5).map((z) => (
                    <div key={z.IdZona || z.NombreZona} className="p-3.5 px-5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{z.NombreZona}</div>
                        <div className="text-[11px] text-slate-400">{z.Ciudad || "Sucre"} · {z.TotalRutas || 1} rutas</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        Activa
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Accesos Rápidos del Supervisor */}
          <div className="space-y-2">
            <a
              href="/supervisor/clientes"
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Directorio de Clientes</div>
                <div className="text-[10px] text-slate-400">Alta y georreferenciación GPS</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <a
              href="/supervisor/precios"
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Lista de Precios</div>
                <div className="text-[10px] text-slate-400">Tarifas mayoristas y minoristas</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <a
              href="/supervisor/reportes"
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Reportes de Entrega</div>
                <div className="text-[10px] text-slate-400">Cobertura y desempeño de rutas</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

