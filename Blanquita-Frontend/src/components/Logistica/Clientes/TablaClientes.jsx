import { useState, useEffect, useMemo, useCallback } from "react";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
import { ObtenerClientes } from "@/services/Logistica/ClienteService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/common/StatusBadge";
import { toast } from "sonner";
import { 
  Plus, 
  Search, 
  Store, 
  Edit2, 
  Loader2, 
  Users, 
  RotateCcw,
  CheckCircle,
  CreditCard,
  Building2,
  Phone,
  AlertCircle
} from "lucide-react";
import ModalCliente from "./ModalCliente";
import DetalleClienteModal from "./DetalleClienteModal";
import KpiCard from "../Common/KpiCard";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { SkeletonTable } from "@/components/common/LoadingStates";
import { useDebounceSearch } from "@/hooks/useDebounceSearch";
import { cache } from "@/lib/cacheService";

export default function TablaClientes({ usuario = null }) {
  const {
    sucursal,
    setSucursal,
    sucursalesPermitidas,
    esMultisede,
    cargando: cargandoAlcance,
    listoParaConsultar,
    errorAlcance,
    reintentar
  } = usePaginaSucursal({
    usuario,
    permiteTodas: true,
  });

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Hook de búsqueda con debounce de 250 ms y AbortController
  const {
    termino: busqueda,
    setTermino: setBusqueda,
    debouncedTermino: debouncedBusqueda,
    limpiar: limpiarBusqueda,
  } = useDebounceSearch(null, 250);
  
  // Filtros avanzados
  const [filtroMora, setFiltroMora] = useState("TODOS");
  const [filtroTipoCredito, setFiltroTipoCredito] = useState("TODOS");
  const [orden, setOrden] = useState("NOMBRE_ASC");

  // Modales con renderizado bajo demanda (Lazy Rendering)
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [clienteEditar, setClienteEditar] = useState(null);
  const [clienteDetalleId, setClienteDetalleId] = useState(null);

  // Carga inicial y reactiva para no parpadear con soporte de caché
  const cargarClientes = useCallback(async (forzar = false) => {
    const sid = sucursal === "todas" ? null : sucursal;
    const cacheKey = `logistica:clientes:${sid || "todas"}`;
    try {
      if (!forzar) {
        const enCache = cache.get(cacheKey);
        if (enCache) {
          setClientes(enCache);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      const data = await ObtenerClientes("", null, sid);
      const lista = data || [];
      setClientes(lista);
      cache.set(cacheKey, lista, 300);
    } catch (err) {
      toast.error(err.message || "Error al cargar la lista de clientes");
    } finally {
      setLoading(false);
    }
  }, [sucursal]);

  useEffect(() => {
    if (listoParaConsultar) {
      cargarClientes();
    }
  }, [sucursal, listoParaConsultar, cargarClientes]);

  // Filtrado y ordenación instantáneos en memoria
  const clientesFiltrados = useMemo(() => {
    let result = [...clientes];

    // Búsqueda en texto con valor con debounce
    if (debouncedBusqueda.trim()) {
      const q = debouncedBusqueda.toLowerCase().trim();
      result = result.filter(c => 
        c.RazonSocial?.toLowerCase().includes(q) ||
        c.NombreComercial?.toLowerCase().includes(q) ||
        c.NitCi?.toLowerCase().includes(q) ||
        c.Telefono?.toLowerCase().includes(q)
      );
    }

    // Filtro Mora
    if (filtroMora === "AL_DIA") {
      result = result.filter(c => !c.BloqueadoPorMora);
    } else if (filtroMora === "CON_MORA") {
      result = result.filter(c => c.BloqueadoPorMora);
    }

    // Filtro Crédito
    if (filtroTipoCredito === "CONTADO") {
      result = result.filter(c => Number(c.LimiteCreditoBs) <= 0);
    } else if (filtroTipoCredito === "CON_CREDITO") {
      result = result.filter(c => Number(c.LimiteCreditoBs) > 0);
    }

    // Ordenación
    if (orden === "NOMBRE_ASC") {
      result.sort((a, b) => (a.RazonSocial || "").localeCompare(b.RazonSocial || ""));
    } else if (orden === "CREDITO_DESC") {
      result.sort((a, b) => Number(b.LimiteCreditoBs || 0) - Number(a.LimiteCreditoBs || 0));
    } else if (orden === "TIENDAS_DESC") {
      result.sort((a, b) => (b.TotalPuntosVenta || 1) - (a.TotalPuntosVenta || 1));
    }

    return result;
  }, [clientes, debouncedBusqueda, filtroMora, filtroTipoCredito, orden]);

  // Paginación optimizada
  const paginacion = usePaginacion(clientesFiltrados, 10);

  const handleEditar = (cliente) => {
    setClienteEditar(cliente);
    setModalNuevoAbierto(true);
  };

  const handleCrearNuevo = () => {
    setClienteEditar(null);
    setModalNuevoAbierto(true);
  };

  return (
    <div className="space-y-4">
      {/* 1. Header con métricas y botón crear */}
      <PageHeader
        title="Directorio de Clientes"
        subtitle="Cartera de clientes, sucursales georreferenciadas y políticas de crédito comercial."
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
          onClick={handleCrearNuevo}
          className="bg-[#1C96C5] hover:bg-[#157A9E] text-white gap-2 h-8 px-3 font-semibold rounded text-xs shadow-none"
        >
          <Plus className="h-4 w-4" />
          <span>Nuevo Cliente</span>
        </Button>
      </PageHeader>

      {/* 2. Tarjetas KPI Reutilizables de Clientes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          titulo="Total Clientes"
          valor={clientes.length}
          icon={<Users className="h-4 w-4" />}
          variant="default"
          subtexto="Cartera registrada"
        />
        <KpiCard
          titulo="Cartera al Día"
          valor={clientes.filter(c => !c.BloqueadoPorMora).length}
          icon={<CheckCircle className="h-4 w-4" />}
          variant="emerald"
          subtexto="Sin bloqueo de mora"
        />
        <KpiCard
          titulo="Bloqueados por Mora"
          valor={clientes.filter(c => c.BloqueadoPorMora).length}
          icon={<Building2 className="h-4 w-4" />}
          variant="red"
          subtexto="Crédito suspendido"
        />
        <KpiCard
          titulo="Con Línea de Crédito"
          valor={clientes.filter(c => Number(c.LimiteCreditoBs) > 0).length}
          icon={<CreditCard className="h-4 w-4" />}
          variant="sky"
          subtexto="Crédito habilitado"
        />
      </div>

      {/* 3. Panel con Filtros y Tabla */}
      <div className="border border-slate-200 bg-white rounded overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 w-full md:w-auto flex-1">
            {/* Buscador reactivo en memoria */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <Input
                placeholder="Buscar razón social, NIT..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8 h-8 text-xs bg-white border-slate-300 rounded"
              />
            </div>

            {/* Filtro Mora */}
            <div>
              <select
                value={filtroMora}
                onChange={(e) => setFiltroMora(e.target.value)}
                className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2.5 text-slate-800 font-medium"
              >
                <option value="TODOS">Todos los Estados</option>
                <option value="AL_DIA">Solo Cartera al Día</option>
                <option value="CON_MORA">Solo Bloqueados por Mora</option>
              </select>
            </div>

            {/* Filtro Crédito */}
            <div>
              <select
                value={filtroTipoCredito}
                onChange={(e) => setFiltroTipoCredito(e.target.value)}
                className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2.5 text-slate-800 font-medium"
              >
                <option value="TODOS">Todas las Políticas</option>
                <option value="CON_CREDITO">Con Línea de Crédito</option>
                <option value="CONTADO">Solo Pago al Contado</option>
              </select>
            </div>

            {/* Ordenar por */}
            <div className="flex items-center gap-1.5">
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
                className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2.5 text-slate-800 font-medium"
              >
                <option value="NOMBRE_ASC">Nombre (A - Z)</option>
                <option value="CREDITO_DESC">Mayor Límite Crédito</option>
                <option value="TIENDAS_DESC">Mayor N° Sucursales</option>
              </select>

              {(filtroMora !== "TODOS" || filtroTipoCredito !== "TODOS" || busqueda) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFiltroMora("TODOS");
                    setFiltroTipoCredito("TODOS");
                    limpiarBusqueda();
                    setOrden("NOMBRE_ASC");
                  }}
                  className="h-8 px-2 text-slate-600 hover:text-slate-900 rounded"
                  title="Restablecer filtros"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="text-xs font-medium text-slate-600 whitespace-nowrap">
            Mostrando <strong className="text-slate-900 font-mono">{clientesFiltrados.length}</strong> de {clientes.length} clientes
          </div>
        </div>

        <div>
          {errorAlcance ? (
            <div className="p-8 text-center bg-red-50/50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800 m-3">
              <AlertCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">No se pudo cargar tu sede</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 mb-3">Ocurrió un error al verificar tu alcance territorial de sucursales.</p>
              <Button onClick={reintentar} size="sm" variant="outline" className="gap-2">
                <RotateCcw className="h-3.5 w-3.5" />
                Reintentar
              </Button>
            </div>
          ) : loading ? (
            <div className="p-3">
              <SkeletonTable
                rows={6}
                cols={7}
                headers={[
                  "Razón Social & Letrero",
                  "NIT / CI",
                  "Teléfono / WhatsApp",
                  "Puntos Entrega",
                  "Límite Crédito",
                  "Estado Cartera",
                  "Acciones",
                ]}
              />
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Users className="mx-auto h-10 w-10 text-slate-400 mb-2" />
              <p className="text-slate-800 font-semibold text-sm">No se encontraron clientes</p>
              <p className="text-xs text-slate-600 max-w-sm mx-auto mt-1 mb-4">
                Puedes ajustar los criterios de búsqueda o registrar un nuevo cliente con el botón superior.
              </p>
              <Button onClick={handleCrearNuevo} size="sm" className="bg-[#1C96C5] hover:bg-[#157A9E] text-white gap-2 h-8 text-xs rounded">
                <Plus className="h-4 w-4" />
                <span>Registrar Cliente</span>
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 text-slate-700 text-xs uppercase font-medium border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Razón Social & Letrero</th>
                      <th className="px-3 py-2.5 font-semibold">NIT / CI</th>
                      <th className="px-3 py-2.5 font-semibold">Teléfono / WhatsApp</th>
                      <th className="px-3 py-2.5 font-semibold text-center">Puntos Entrega</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Límite Crédito</th>
                      <th className="px-3 py-2.5 font-semibold text-center">Estado Cartera</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginacion.itemsPaginados.map((c) => (
                      <tr key={c.IdCliente} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900">{c.RazonSocial}</div>
                          {c.NombreComercial && (
                            <div className="text-[11px] text-[#1C96C5] font-medium mt-0.5">"{c.NombreComercial}"</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono text-slate-700">{c.NitCi}</td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {c.Telefono ? (
                            <a
                              href={`https://wa.me/591${c.Telefono.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:underline font-medium"
                            >
                              <Phone className="h-3 w-3 text-emerald-600" />
                              <span>{c.Telefono}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500 italic">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setClienteDetalleId(c.IdCliente)}
                            className="h-7 text-xs text-[#1C96C5] border-sky-300 hover:bg-sky-50 gap-1.5 font-medium rounded"
                            title="Ver sucursales y ficha técnica"
                          >
                            <Store className="h-3.5 w-3.5" />
                            <span>{c.TotalPuntosVenta || 1} tiendas</span>
                          </Button>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                          Bs. {Number(c.LimiteCreditoBs).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <StatusBadge
                            estado={c.BloqueadoPorMora ? "MORA" : (c.NombreEstado || "ACTIVO")}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditar(c)}
                            className="h-7 px-2.5 text-xs text-slate-700 hover:text-[#1C96C5] hover:border-[#1C96C5] gap-1 font-medium rounded"
                            title="Editar Datos del Cliente"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            <span>Editar</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación de clientes */}
              <PaginacionTabla {...paginacion} />
            </>
          )}
        </div>
      </div>

      {/* Modales con Renderizado Condicional Bajo Demanda (Lazy DOM) */}
      {modalNuevoAbierto && (
        <ModalCliente
          abierto={modalNuevoAbierto}
          onCerrar={() => {
            setModalNuevoAbierto(false);
            setClienteEditar(null);
          }}
          clienteEditar={clienteEditar}
          sucursalActiva={sucursal}
          sucursalesPermitidas={sucursalesPermitidas}
          onGuardado={() => {
            cache.invalidateLogistica();
            cargarClientes(true);
            setClienteEditar(null);
          }}
        />
      )}

      {clienteDetalleId !== null && (
        <DetalleClienteModal
          idCliente={clienteDetalleId}
          abierto={clienteDetalleId !== null}
          onCerrar={() => setClienteDetalleId(null)}
        />
      )}
    </div>
  );
}
