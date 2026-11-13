import React, { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
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
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/common/StatusBadge";
import { toast } from "sonner";
import { invalidarCache } from "@/lib/api-cache";

import {
  ObtenerAsignaciones,
  ObtenerRepartidores,
  ObtenerZonas,
  ObtenerRutas,
} from "@/services/Logistica/RutaService";
import { ObtenerClientesSimple } from "@/services/Logistica/ClienteService";
import AlertaSolicitudesCargaBanner from "./Reparto/AlertaSolicitudesCargaBanner";

export default function InicioSupervisor({ usuario }) {
  const { sucursal, setSucursal, sucursalesPermitidas, esMultisede, cargando: cargandoAlcance, listoParaConsultar } = usePaginaSucursal({
    usuario,
    permiteTodas: true,
  });

  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [fechaActual, setFechaActual] = useState("");

  const [asignaciones, setAsignaciones] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [clientesCount, setClientesCount] = useState(0);

  const cargarLogistica = useCallback(async (forzar = false) => {
    if (forzar) {
      setRefrescando(true);
      invalidarCache("/api/logistica");
    } else {
      setCargando(true);
    }

    try {
      const hoyStr = new Date().toISOString().split("T")[0];
      const sid = (!sucursal || sucursal === "todas") ? null : sucursal;

      const [asigRes, repartRes, zonasRes, rutasRes, clientesRes] = await Promise.all([
        ObtenerAsignaciones(hoyStr, null, sid).catch(() => []),
        ObtenerRepartidores(sid).catch(() => []),
        ObtenerZonas(sid).catch(() => []),
        ObtenerRutas(null, sid).catch(() => []),
        ObtenerClientesSimple(sid).catch(() => []),
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
  }, [sucursal]);

  useEffect(() => {
    const f = new Intl.DateTimeFormat("es-BO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
    setFechaActual(f.charAt(0).toUpperCase() + f.slice(1));
  }, []);

  useEffect(() => {
    if (listoParaConsultar) {
      cargarLogistica();
    }

    const handleCustomWs = (e) => {
      cargarLogistica(true);
    };
    window.addEventListener("blanquita:ws-event", handleCustomWs);

    return () => {
      window.removeEventListener("blanquita:ws-event", handleCustomWs);
    };
  }, [sucursal, listoParaConsultar, cargarLogistica]);

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
    <div className="space-y-4">
      {/* 0. BANDEJA DESTACADA DE SOLICITUDES DE CARGA */}
      <AlertaSolicitudesCargaBanner sucursal={sucursal} onAprobado={() => cargarLogistica(true)} />

      {/* 1. ENCABEZADO INDUSTRIAL OPERATIVO */}
      <PageHeader
        title="Centro de Control Logístico"
        subtitle={`${fechaActual} · Despacho de vehículos, seguimiento de rutas de entrega y liquidaciones de campo.`}
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => cargarLogistica(true)}
          disabled={refrescando || cargando}
          className="text-xs border-slate-300 hover:bg-slate-50 h-8 font-medium rounded"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 text-slate-600 ${refrescando ? "animate-spin" : ""}`} />
          {refrescando ? "Sincronizando..." : "Actualizar"}
        </Button>
        <a href="/supervisor/asignaciones">
          <Button size="sm" className="text-xs bg-slate-900 hover:bg-slate-800 text-white h-8 font-medium rounded shadow-none">
            <Truck className="h-3.5 w-3.5 mr-1.5" />
            Programar Despacho
          </Button>
        </a>
      </PageHeader>

      {/* 2. MATRIZ DE KPIS LOGÍSTICOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Flota en Ruta */}
        <div className="border border-slate-200 bg-white rounded p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-600">
              Flota en Calle
            </span>
            <div className="p-1 rounded bg-slate-100 text-slate-700">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
              {cargando ? "---" : `${repartidoresEnRuta} / ${repartidores.length}`}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 mt-1">
              <span>Repartidores activos</span>
              <span className="text-emerald-700 font-medium">
                {repartidores.length - repartidoresEnRuta} en base
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600">Operación Sucre</span>
            <a href="/supervisor/rutas/rastreo" className="font-medium text-[#1C96C5] hover:underline flex items-center">
              Rastreo GPS <ChevronRight className="h-3 w-3 ml-0.5" />
            </a>
          </div>
        </div>

        {/* Despachos del Día */}
        <div className="border border-slate-200 bg-white rounded p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-600">
              Despachos Programados
            </span>
            <div className="p-1 rounded bg-slate-100 text-slate-700">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
              {cargando ? "---" : `${totalDespachos}`}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 mt-1">
              <span>{despachosEntregados} entregados</span>
              <span className="text-[#1C96C5] font-medium">
                {totalDespachos - despachosEntregados} en tránsito
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600">Jornada de entregas</span>
            <a href="/supervisor/asignaciones" className="font-medium text-[#1C96C5] hover:underline flex items-center">
              Despachos <ChevronRight className="h-3 w-3 ml-0.5" />
            </a>
          </div>
        </div>

        {/* Clientes Georreferenciados */}
        <div className="border border-slate-200 bg-white rounded p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-600">
              Puntos de Entrega
            </span>
            <div className="p-1 rounded bg-slate-100 text-slate-700">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
              {cargando ? "---" : `${clientesCount}`}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 mt-1">
              <span>{zonas.length} zonas</span>
              <span className="tabular-nums font-mono text-slate-800 font-medium">
                {rutas.length} rutas
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600">Directorio de tiendas</span>
            <a href="/supervisor/clientes" className="font-medium text-[#1C96C5] hover:underline flex items-center">
              Clientes <ChevronRight className="h-3 w-3 ml-0.5" />
            </a>
          </div>
        </div>

        {/* Recaudación en Ruta */}
        <div className="border border-slate-200 bg-white rounded p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-600">
              Cobranza en Tránsito
            </span>
            <div className="p-1 rounded bg-slate-100 text-slate-700">
              <CircleDollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
              {cargando ? "---" : `Bs. ${totalMontoRecaudadoRuta.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 mt-1">
              <span>Cobrado en campo hoy</span>
              <span className="text-amber-700 font-medium">
                Pendiente liquidación
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600">Rendición a caja</span>
            <a href="/contador/caja" className="font-medium text-[#1C96C5] hover:underline flex items-center">
              Caja <ChevronRight className="h-3 w-3 ml-0.5" />
            </a>
          </div>
        </div>
      </div>

      {/* 3. DOS COLUMNAS: DESPACHOS EN CURSO Y ZONAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* COLUMNA 1 & 2: TABLA DE ASIGNACIONES DEL DÍA (2 COLS) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="border border-slate-200 bg-white rounded overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-slate-600" />
                  Despachos y Cuadrillas en Ruta
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Seguimiento operativo de choferes y paradas de entrega
                </p>
              </div>
              <a href="/supervisor/asignaciones">
                <Button variant="outline" size="sm" className="h-8 text-xs border-slate-300 rounded font-medium">
                  Administrar
                </Button>
              </a>
            </div>
            <div>
              {asignaciones.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="p-2 rounded bg-slate-100 w-fit mx-auto text-slate-500">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="text-xs text-slate-600">No se registran despachos activos para el día de hoy.</div>
                  <a href="/supervisor/asignaciones">
                    <Button variant="link" size="sm" className="text-xs text-[#1C96C5]">
                      Crear nueva asignación de ruta
                    </Button>
                  </a>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 text-slate-700 text-xs uppercase font-medium border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Repartidor & Vehículo</th>
                        <th className="py-2.5 px-3 font-semibold">Ruta / Zona</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Paradas</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Cobrado</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {asignaciones.map((asig, idx) => (
                        <tr key={asig.IdAsignacionRuta || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-900">
                              {asig.Repartidor || asig.NombreRepartidor || "Repartidor"}
                            </div>
                            <div className="text-[11px] text-slate-600 font-mono">
                              Placa: {asig.Placa || asig.Vehiculo || "---"}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="text-slate-800">
                              {asig.NombreRuta || "Ruta de reparto"}
                            </div>
                            <div className="text-[11px] text-slate-600">
                              {asig.NombreZona || "Zona Sucre"}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                            {asig.TotalParadas ? `${asig.ParadasCompletadas || 0} / ${asig.TotalParadas}` : "En tránsito"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                            Bs. {parseFloat(asig.TotalCobrado || 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <StatusBadge
                              estado={asig.Estado || (asig.Completado ? "ENTREGADO" : "EN RUTA")}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMNA 3: DIRECTORIO DE ZONAS & ATRIBUTOS (1 COL) */}
        <div className="space-y-4 lg:col-span-1">
          <div className="border border-slate-200 bg-white rounded overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-600" />
                Zonas de Distribución
              </h3>
              <a href="/supervisor/rutas">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-600 rounded">
                  Configurar
                </Button>
              </a>
            </div>
            <div>
              {zonas.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  {cargando ? "Cargando sectores..." : "No hay zonas configuradas."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {zonas.slice(0, 5).map((z) => (
                    <div key={z.IdZona || z.NombreZona} className="p-3 px-4 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-medium text-slate-900">{z.NombreZona}</div>
                        <div className="text-[11px] text-slate-600">{z.Ciudad || "Sucre"} · {z.TotalRutas || 1} rutas</div>
                      </div>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                        Activa
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Accesos Rápidos del Supervisor */}
          <div className="space-y-2">
            <a
              href="/supervisor/clientes"
              className="p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-900">Directorio de Clientes</div>
                <div className="text-[11px] text-slate-600">Alta y georreferenciación GPS</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <a
              href="/supervisor/precios"
              className="p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-900">Lista de Precios</div>
                <div className="text-[11px] text-slate-600">Tarifas mayoristas y minoristas</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <a
              href="/supervisor/reportes"
              className="p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-900">Reportes de Entrega</div>
                <div className="text-[11px] text-slate-600">Cobertura y desempeño de rutas</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
