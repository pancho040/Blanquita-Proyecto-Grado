import { useState, useEffect, useMemo, useCallback } from "react";
import { ObtenerClientes } from "@/services/Logistica/ClienteService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Plus, 
  Search, 
  Store, 
  Edit2, 
  Loader2, 
  Users, 
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  CreditCard,
  Building2,
  Phone
} from "lucide-react";
import ModalCliente from "./ModalCliente";
import DetalleClienteModal from "./DetalleClienteModal";
import KpiCard from "../Common/KpiCard";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { cache } from "@/lib/cacheService";

export default function TablaClientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  
  // Filtros avanzados
  const [filtroMora, setFiltroMora] = useState("TODOS");
  const [filtroTipoCredito, setFiltroTipoCredito] = useState("TODOS");
  const [orden, setOrden] = useState("NOMBRE_ASC");

  // Modales con renderizado bajo demanda (Lazy Rendering)
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [clienteEditar, setClienteEditar] = useState(null);
  const [clienteDetalleId, setClienteDetalleId] = useState(null);

  // Carga inicial y silenciosa para no parpadear con soporte de caché
  const cargarClientes = useCallback(async (forzar = false) => {
    const cacheKey = "logistica:clientes";
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
      const data = await ObtenerClientes();
      const lista = data || [];
      setClientes(lista);
      cache.set(cacheKey, lista, 300);
    } catch (err) {
      toast.error(err.message || "Error al cargar la lista de clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarClientes();
  }, [cargarClientes]);

  // Filtrado y ordenación instantáneos en memoria (0 ms de delay)
  const clientesFiltrados = useMemo(() => {
    let result = [...clientes];

    // Búsqueda en texto
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
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
      result.sort((a, b) => a.RazonSocial.localeCompare(b.RazonSocial));
    } else if (orden === "CREDITO_DESC") {
      result.sort((a, b) => Number(b.LimiteCreditoBs) - Number(a.LimiteCreditoBs));
    } else if (orden === "TIENDAS_DESC") {
      result.sort((a, b) => (b.TotalPuntosVenta || 1) - (a.TotalPuntosVenta || 1));
    }

    return result;
  }, [clientes, busqueda, filtroMora, filtroTipoCredito, orden]);

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
    <div className="space-y-6">
      {/* 1. Header con métricas y botón crear */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-[#20A7DB]" />
            <span>Clientes</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Cartera de clientes, líneas de crédito y sucursales.
          </p>
        </div>
        <Button
          onClick={handleCrearNuevo}
          className="bg-[#20A7DB] hover:bg-[#198cb9] text-white shadow-xs gap-2 h-10 px-5 font-semibold"
        >
          <Plus className="h-4 w-4" />
          <span>Nuevo Cliente</span>
        </Button>
      </div>

      {/* 2. Tarjetas KPI Reutilizables de Clientes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          titulo="Total Clientes"
          valor={clientes.length}
          icon={<Users />}
          variant="default"
          subtexto="Cartera registrada"
        />
        <KpiCard
          titulo="Cartera al Día"
          valor={clientes.filter(c => !c.BloqueadoPorMora).length}
          icon={<CheckCircle />}
          variant="emerald"
          subtexto="Sin bloqueo de mora"
        />
        <KpiCard
          titulo="Bloqueados por Mora"
          valor={clientes.filter(c => c.BloqueadoPorMora).length}
          icon={<AlertTriangle />}
          variant="red"
          subtexto="Crédito suspendido"
        />
        <KpiCard
          titulo="Con Línea de Crédito"
          valor={clientes.filter(c => Number(c.LimiteCreditoBs) > 0).length}
          icon={<CreditCard />}
          variant="sky"
          subtexto="Crédito habilitado"
        />
      </div>

      {/* 3. Card con Filtros y Tabla */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 w-full md:w-auto flex-1">
            {/* Buscador reactivo en memoria */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar Razón Social, NIT..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 h-9 text-xs bg-white border-slate-200"
              />
            </div>

            {/* Filtro Mora */}
            <div>
              <select
                value={filtroMora}
                onChange={(e) => setFiltroMora(e.target.value)}
                className="w-full h-9 text-xs rounded-lg border border-slate-200 bg-white px-2.5 text-slate-700 font-medium"
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
                className="w-full h-9 text-xs rounded-lg border border-slate-200 bg-white px-2.5 text-slate-700 font-medium"
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
                className="w-full h-9 text-xs rounded-lg border border-slate-200 bg-white px-2.5 text-slate-700 font-medium"
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
                    setBusqueda("");
                    setOrden("NOMBRE_ASC");
                  }}
                  className="h-9 px-2 text-slate-500 hover:text-slate-800"
                  title="Restablecer filtros"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="text-xs font-medium text-slate-500 whitespace-nowrap">
            Mostrando <strong className="text-slate-800">{clientesFiltrados.length}</strong> de {clientes.length} clientes
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col justify-center items-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#20A7DB]" />
              <p className="text-xs text-slate-500 font-medium">Cargando directorio de clientes...</p>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Users className="mx-auto h-12 w-12 text-slate-300 mb-2" />
              <p className="text-slate-700 font-semibold text-base">No se encontraron clientes</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Puedes ajustar los criterios de búsqueda o registrar un nuevo cliente con el botón superior.
              </p>
              <Button onClick={handleCrearNuevo} size="sm" className="bg-[#20A7DB] text-white gap-2">
                <Plus className="h-4 w-4" />
                <span>Registrar Cliente</span>
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-50/90 text-xs text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5">Razón Social & Letrero</th>
                      <th className="px-4 py-3.5">NIT / CI</th>
                      <th className="px-4 py-3.5">Teléfono / WhatsApp</th>
                      <th className="px-4 py-3.5 text-center">Puntos Entrega</th>
                      <th className="px-4 py-3.5 text-right">Límite de Crédito</th>
                      <th className="px-4 py-3.5 text-center">Estado Cartera</th>
                      <th className="px-4 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginacion.itemsPaginados.map((c) => (
                      <tr key={c.IdCliente} className="hover:bg-sky-50/40 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{c.RazonSocial}</div>
                          {c.NombreComercial && (
                            <div className="text-xs text-[#20A7DB] font-medium mt-0.5">"{c.NombreComercial}"</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-700">{c.NitCi}</td>
                        <td className="px-4 py-3.5 text-slate-600">
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
                            <span className="text-xs text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setClienteDetalleId(c.IdCliente)}
                            className="h-7 text-xs text-[#20A7DB] border-sky-200 hover:bg-sky-50 gap-1.5 font-medium shadow-2xs"
                            title="Ver sucursales y ficha técnica"
                          >
                            <Store className="h-3.5 w-3.5" />
                            <span>{c.TotalPuntosVenta || 1} tiendas</span>
                          </Button>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800">
                          Bs. {Number(c.LimiteCreditoBs).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {c.BloqueadoPorMora ? (
                            <Badge variant="destructive" className="gap-1 font-medium">
                              <AlertTriangle className="h-3 w-3" />
                              <span>Mora</span>
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium">
                              {c.NombreEstado || "Al Día"}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditar(c)}
                            className="h-8 px-2.5 text-xs text-slate-600 hover:text-[#20A7DB] hover:border-sky-300 gap-1 font-medium"
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
        </CardContent>
      </Card>

      {/* Modales con Renderizado Condicional Bajo Demanda (Lazy DOM) */}
      {modalNuevoAbierto && (
        <ModalCliente
          abierto={modalNuevoAbierto}
          onCerrar={() => {
            setModalNuevoAbierto(false);
            setClienteEditar(null);
          }}
          clienteEditar={clienteEditar}
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