import { useState, useEffect } from "react";
import { ObtenerClientes } from "@/services/Logistica/ClienteService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Search, Store, Edit2, Loader2, Users, AlertTriangle } from "lucide-react";
import ModalCliente from "./ModalCliente";
import DetalleClienteModal from "./DetalleClienteModal";

export default function TablaClientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  
  // Modales
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [clienteEditar, setClienteEditar] = useState(null);
  const [clienteDetalleId, setClienteDetalleId] = useState(null);

  const cargarClientes = async () => {
    try {
      setLoading(true);
      const data = await ObtenerClientes(busqueda);
      setClientes(data);
    } catch (err) {
      toast.error(err.message || "Error al cargar la lista de clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarClientes();
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Directorio de Clientes</h2>
          <p className="text-sm text-muted-foreground">
            Gestión comercial de puntos de venta y políticas de crédito en Sucre
          </p>
        </div>
        <Button
          onClick={handleCrearNuevo}
          className="bg-[#20A7DB] hover:bg-[#198cb9] text-white shadow-md gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>Nuevo Cliente</span>
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por Razón Social, NIT o Nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200"
            />
          </div>
          <div className="text-xs font-medium text-slate-500">
            Total: <span className="font-bold text-slate-800">{clientes.length}</span> clientes
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#20A7DB]" />
            </div>
          ) : clientes.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Users className="mx-auto h-12 w-12 text-slate-300 mb-2" />
              <p className="text-slate-600 font-medium">No se encontraron clientes</p>
              <p className="text-xs text-muted-foreground">Comienza agregando el primer cliente con el botón "Nuevo Cliente".</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 text-xs text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Razón Social / Nombre Comercial</th>
                    <th className="px-4 py-3">NIT / CI</th>
                    <th className="px-4 py-3">Teléfono</th>
                    <th className="px-4 py-3 text-center">Sucursales</th>
                    <th className="px-4 py-3 text-right">Límite Crédito</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientes.map((c) => (
                    <tr key={c.IdCliente} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{c.RazonSocial}</div>
                        {c.NombreComercial && (
                          <div className="text-xs text-muted-foreground">"{c.NombreComercial}"</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{c.NitCi}</td>
                      <td className="px-4 py-3 text-slate-600">{c.Telefono || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setClienteDetalleId(c.IdCliente)}
                          className="h-7 text-xs text-[#20A7DB] hover:bg-sky-50 gap-1"
                        >
                          <Store className="h-3.5 w-3.5" />
                          <span>{c.TotalPuntosVenta || 1} tiendas</span>
                        </Button>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">
                        Bs. {Number(c.LimiteCreditoBs).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.BloqueadoPorMora ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Mora</span>
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
                            {c.NombreEstado}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditar(c)}
                          className="h-8 w-8 p-0 text-slate-600 hover:text-[#20A7DB]"
                          title="Editar Cliente"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modales */}
      <ModalCliente
        abierto={modalNuevoAbierto}
        onCerrar={() => setModalNuevoAbierto(false)}
        clienteEditar={clienteEditar}
        onGuardado={cargarClientes}
      />

      <DetalleClienteModal
        idCliente={clienteDetalleId}
        abierto={clienteDetalleId !== null}
        onCerrar={() => setClienteDetalleId(null)}
      />
    </div>
  );
}
