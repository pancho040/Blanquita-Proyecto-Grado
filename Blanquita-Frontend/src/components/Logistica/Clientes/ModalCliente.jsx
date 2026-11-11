import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CrearCliente, ActualizarCliente } from "@/services/Logistica/ClienteService";
import { 
  Loader2, 
  Store, 
  CreditCard, 
  Building2, 
  MapPin
} from "lucide-react";
import MapaSelectorUbicacion from "../Common/MapaSelectorUbicacion";

const PRESETS_CREDITO_BS = [0, 1000, 2500, 5000, 10000];
const PRESETS_DIAS = [
  { dias: 0, label: "0 días (Contado)" },
  { dias: 7, label: "7 días (Semanal)" },
  { dias: 15, label: "15 días (Quincenal)" },
  { dias: 30, label: "30 días (Mensual)" }
];

const TIPOS_COMERCIO = [
  "Minimarket / Abarrotes",
  "Supermercado / Cadena",
  "Tienda de Barrio",
  "Restaurante / Sector Horeca",
  "Distribuidor Mayorista",
  "Puesto de Mercado"
];

export default function ModalCliente({ abierto, onCerrar, clienteEditar, onGuardado, sucursalActiva = null, sucursalesPermitidas = [] }) {
  if (!abierto) return null;
  const [loading, setLoading] = useState(false);
  const [tabActiva, setTabActiva] = useState("comercial"); // "comercial" | "ubicacion" | "credito"

  const sucursalInicial = clienteEditar?.IdSucursal
    ? clienteEditar.IdSucursal
    : (sucursalActiva && sucursalActiva !== "todas" ? Number(sucursalActiva) : "");

  const [formData, setFormData] = useState({
    RazonSocial: "",
    NombreComercial: "",
    NitCi: "",
    Telefono: "",
    CorreoElectronico: "",
    Direccion: "",
    Latitud: -19.0345,
    Longitud: -65.2530,
    LimiteCreditoBs: 0,
    DiasCredito: 0,
    Observacion: "",
    TipoNegocio: TIPOS_COMERCIO[0],
    NombrePuntoVentaPrincipal: "Tienda Principal",
    ReferenciaUbicacion: "Cerca al Mercado Campesino",
    IdSucursal: sucursalInicial,
  });

  // Apertura instantánea: sincronizar campos sin bloqueos
  useEffect(() => {
    if (abierto) {
      setTabActiva("comercial");
      const sid = clienteEditar?.IdSucursal
        ? clienteEditar.IdSucursal
        : (sucursalActiva && sucursalActiva !== "todas" ? Number(sucursalActiva) : "");

      if (clienteEditar) {
        setFormData({
          RazonSocial: clienteEditar.RazonSocial || "",
          NombreComercial: clienteEditar.NombreComercial || "",
          NitCi: clienteEditar.NitCi || "",
          Telefono: clienteEditar.Telefono || "",
          CorreoElectronico: clienteEditar.CorreoElectronico || "",
          Direccion: clienteEditar.Direccion || "",
          Latitud: Number(clienteEditar.Latitud) || -19.0429,
          Longitud: Number(clienteEditar.Longitud) || -65.2554,
          LimiteCreditoBs: clienteEditar.LimiteCreditoBs || 0,
          DiasCredito: clienteEditar.DiasCredito || 0,
          Observacion: clienteEditar.Observacion || "",
          TipoNegocio: TIPOS_COMERCIO[0],
          NombrePuntoVentaPrincipal: "Tienda Principal",
          ReferenciaUbicacion: "",
          IdSucursal: sid,
        });
      } else {
        setFormData({
          RazonSocial: "",
          NombreComercial: "",
          NitCi: "",
          Telefono: "",
          CorreoElectronico: "",
          Direccion: "",
          Latitud: -19.0345,
          Longitud: -65.2530,
          LimiteCreditoBs: 0,
          DiasCredito: 0,
          Observacion: "",
          TipoNegocio: TIPOS_COMERCIO[0],
          NombrePuntoVentaPrincipal: "Tienda Principal",
          ReferenciaUbicacion: "Cerca al Mercado Campesino",
          IdSucursal: sid,
        });
      }
    }
  }, [clienteEditar, abierto, sucursalActiva]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCoordsChange = ({ lat, lng, referencia }) => {
    setFormData((prev) => ({
      ...prev,
      Latitud: lat,
      Longitud: lng,
      ReferenciaUbicacion: referencia ? referencia : prev.ReferenciaUbicacion
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.RazonSocial.trim()) {
      toast.error("La razón social es obligatoria");
      setTabActiva("comercial");
      return;
    }
    if (!formData.NitCi.trim()) {
      toast.error("El NIT o CI es obligatorio");
      setTabActiva("comercial");
      return;
    }
    if (!formData.IdSucursal) {
      toast.error("Debe seleccionar la sucursal de operación del cliente");
      setTabActiva("comercial");
      return;
    }

    try {
      setLoading(true);
      if (clienteEditar) {
        await ActualizarCliente(clienteEditar.IdCliente, {
          RazonSocial: formData.RazonSocial,
          NombreComercial: formData.NombreComercial,
          NitCi: formData.NitCi,
          Telefono: formData.Telefono,
          CorreoElectronico: formData.CorreoElectronico,
          Direccion: formData.Direccion,
          Latitud: Number(formData.Latitud) || null,
          Longitud: Number(formData.Longitud) || null,
          LimiteCreditoBs: Number(formData.LimiteCreditoBs) || 0,
          DiasCredito: Number(formData.DiasCredito) || 0,
          Observacion: formData.Observacion,
          IdSucursal: Number(formData.IdSucursal),
        });
        toast.success("Cliente actualizado exitosamente");
      } else {
        await CrearCliente({
          ...formData,
          IdSucursal: Number(formData.IdSucursal),
          Latitud: Number(formData.Latitud) || null,
          Longitud: Number(formData.Longitud) || null,
          LimiteCreditoBs: Number(formData.LimiteCreditoBs) || 0,
          DiasCredito: Number(formData.DiasCredito) || 0,
        });
        toast.success("Cliente y punto de venta creados con éxito");
      }
      onGuardado();
      onCerrar();
    } catch (err) {
      toast.error(err.message || "Error al procesar cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded border border-slate-200">
        <DialogHeader className="border-b border-slate-200 pb-3">
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Store className="h-5 w-5 text-[#1C96C5]" />
            <span>{clienteEditar ? "Editar Datos del Cliente" : "Registro de Nuevo Cliente"}</span>
          </DialogTitle>

          {/* Selector de Pestañas (Tabs) */}
          <div className="flex border-b border-slate-200 gap-1 pt-3">
            <button
              type="button"
              onClick={() => setTabActiva("comercial")}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                tabActiva === "comercial"
                  ? "border-[#1C96C5] text-[#1C96C5]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>1. Datos Comerciales</span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva("ubicacion")}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                tabActiva === "ubicacion"
                  ? "border-[#1C96C5] text-[#1C96C5]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>2. Ubicación & Mapa Sucre</span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva("credito")}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                tabActiva === "credito"
                  ? "border-[#1C96C5] text-[#1C96C5]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>3. Condiciones de Crédito</span>
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="min-h-[380px]">
          {/* TAB 1: DATOS COMERCIALES */}
          {tabActiva === "comercial" && (
            <div className="space-y-3">
              <div className="p-4 rounded bg-slate-50 border border-slate-200 space-y-3">
                {/* Selector de Sucursal */}
                <div>
                  <Label htmlFor="IdSucursal" className="text-xs font-semibold text-slate-800">
                    Sucursal de Operación *
                  </Label>
                  <select
                    id="IdSucursal"
                    name="IdSucursal"
                    value={formData.IdSucursal || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, IdSucursal: e.target.value ? Number(e.target.value) : "" }))}
                    disabled={Boolean(clienteEditar) || (sucursalActiva && sucursalActiva !== "todas")}
                    className="mt-1 w-full h-8 text-xs rounded border border-slate-300 bg-white px-2.5 text-slate-800 font-medium"
                    required
                  >
                    <option value="">-- Seleccione Sucursal Obligatoria --</option>
                    {sucursalesPermitidas && sucursalesPermitidas.length > 0 ? (
                      sucursalesPermitidas.map((s) => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))
                    ) : (
                      <>
                        <option value="1">Sucursal Central Sucre</option>
                        <option value="2">Sucursal Potosí</option>
                      </>
                    )}
                  </select>
                  {!formData.IdSucursal && (!sucursalActiva || sucursalActiva === "todas") && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      Requerido: seleccione la sucursal a la que pertenece territorialmente este cliente.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="RazonSocial" className="text-xs font-semibold text-slate-800">
                      Razón Social (Facturación) *
                    </Label>
                    <Input
                      id="RazonSocial"
                      name="RazonSocial"
                      value={formData.RazonSocial}
                      onChange={handleChange}
                      placeholder="Ej. Distribuidora San Francisco S.R.L."
                      required
                      className="mt-1 bg-white border-slate-300 rounded text-xs h-8"
                    />
                  </div>

                  <div>
                    <Label htmlFor="NombreComercial" className="text-xs font-semibold text-slate-800">
                      Nombre Comercial / Rótulo de la Tienda
                    </Label>
                    <Input
                      id="NombreComercial"
                      name="NombreComercial"
                      value={formData.NombreComercial}
                      onChange={handleChange}
                      placeholder="Ej. Tienda Doña María o Minimarket Central"
                      className="mt-1 bg-white border-slate-300 rounded text-xs h-8"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="NitCi" className="text-xs font-semibold text-slate-800">
                      NIT o Carnet de Identidad (CI) *
                    </Label>
                    <Input
                      id="NitCi"
                      name="NitCi"
                      value={formData.NitCi}
                      onChange={handleChange}
                      placeholder="Ej. 10245678023"
                      required
                      className="mt-1 bg-white border-slate-300 rounded text-xs h-8 font-mono"
                    />
                  </div>

                  <div>
                    <Label htmlFor="Telefono" className="text-xs font-semibold text-slate-800">
                      Teléfono / Celular WhatsApp
                    </Label>
                    <Input
                      id="Telefono"
                      name="Telefono"
                      value={formData.Telefono}
                      onChange={handleChange}
                      placeholder="Ej. 71234567"
                      className="mt-1 bg-white border-slate-300 rounded text-xs h-8"
                    />
                  </div>

                  <div>
                    <Label htmlFor="CorreoElectronico" className="text-xs font-semibold text-slate-800">
                      Correo Electrónico
                    </Label>
                    <Input
                      id="CorreoElectronico"
                      name="CorreoElectronico"
                      type="email"
                      value={formData.CorreoElectronico}
                      onChange={handleChange}
                      placeholder="cliente@ejemplo.com"
                      className="mt-1 bg-white border-slate-300 rounded text-xs h-8"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-800">Tipo de Negocio / Canal Comercial</Label>
                  <select
                    name="TipoNegocio"
                    value={formData.TipoNegocio}
                    onChange={handleChange}
                    className="mt-1 w-full text-xs rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-800 h-8 font-medium"
                  >
                    {TIPOS_COMERCIO.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GEORREFERENCIACIÓN & MAPA */}
          {tabActiva === "ubicacion" && (
            <div className="space-y-3">
              <div className="p-4 rounded bg-slate-50 border border-slate-200 space-y-3">
                <MapaSelectorUbicacion
                  lat={formData.Latitud}
                  lng={formData.Longitud}
                  onChange={handleCoordsChange}
                  altura="h-64 sm:h-72"
                  label="Selecciona la ubicación exacta de la tienda en el mapa:"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <Label htmlFor="Direccion" className="text-xs font-semibold text-slate-800">
                      Dirección Física Completa en Sucre *
                    </Label>
                    <Input
                      id="Direccion"
                      name="Direccion"
                      value={formData.Direccion}
                      onChange={handleChange}
                      placeholder="Ej. Av. Ostria Gutiérrez #820"
                      required
                      className="mt-1 bg-white border-slate-300 rounded text-xs h-8"
                    />
                  </div>

                  <div>
                    <Label htmlFor="ReferenciaUbicacion" className="text-xs font-semibold text-slate-800">
                      Referencia de Llegada para el Repartidor
                    </Label>
                    <Input
                      id="ReferenciaUbicacion"
                      name="ReferenciaUbicacion"
                      value={formData.ReferenciaUbicacion}
                      onChange={handleChange}
                      placeholder="Ej. Portón azul al lado de la farmacia..."
                      className="mt-1 bg-white border-slate-300 rounded text-xs h-8"
                    />
                  </div>
                </div>

                {!clienteEditar && (
                  <div className="pt-1">
                    <Label htmlFor="NombrePuntoVentaPrincipal" className="text-xs font-semibold text-slate-800">
                      Nombre de la Tienda o Punto de Entrega Principal
                    </Label>
                    <Input
                      id="NombrePuntoVentaPrincipal"
                      name="NombrePuntoVentaPrincipal"
                      value={formData.NombrePuntoVentaPrincipal}
                      onChange={handleChange}
                      className="mt-1 bg-white border-slate-300 rounded text-xs h-8 max-w-md"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CONDICIONES DE CRÉDITO */}
          {tabActiva === "credito" && (
            <div className="space-y-3">
              <div className="p-4 rounded bg-slate-50 border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="LimiteCreditoBs" className="text-xs font-semibold text-slate-800">
                      Límite de Crédito Autorizado (Bs.)
                    </Label>
                    <Input
                      id="LimiteCreditoBs"
                      name="LimiteCreditoBs"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.LimiteCreditoBs}
                      onChange={handleChange}
                      className="mt-1 bg-white border-slate-300 rounded text-xs h-8 font-mono font-bold text-slate-900"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {PRESETS_CREDITO_BS.map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, LimiteCreditoBs: val }))}
                          className="text-[11px] px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium"
                        >
                          {val === 0 ? "Contado (0 Bs)" : `Bs. ${val.toLocaleString()}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="DiasCredito" className="text-xs font-semibold text-slate-800">
                      Días de Crédito Máximos Permitidos
                    </Label>
                    <Input
                      id="DiasCredito"
                      name="DiasCredito"
                      type="number"
                      min="0"
                      value={formData.DiasCredito}
                      onChange={handleChange}
                      className="mt-1 bg-white border-slate-300 rounded text-xs h-8 font-mono font-bold text-slate-900"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {PRESETS_DIAS.map((p) => (
                        <button
                          key={p.dias}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, DiasCredito: p.dias }))}
                          className="text-[11px] px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="Observacion" className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
                    Observaciones Comerciales y Horarios de Descarga
                  </Label>
                  <Textarea
                    id="Observacion"
                    name="Observacion"
                    value={formData.Observacion}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Ej. Recibe mercadería únicamente por las mañanas de 08:00 a 11:30..."
                    className="mt-1 bg-white border-slate-300 rounded text-xs"
                  />
                </div>
              </div>
            </div>
          )}
          </div>

          <DialogFooter className="gap-2 pt-3 border-t border-slate-200 flex items-center justify-between">
            <div className="flex gap-1.5">
              {tabActiva !== "comercial" && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setTabActiva(tabActiva === "credito" ? "ubicacion" : "comercial")}
                  className="rounded text-xs h-8"
                >
                  Anterior
                </Button>
              )}
              {tabActiva !== "credito" && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setTabActiva(tabActiva === "comercial" ? "ubicacion" : "credito")}
                  className="rounded text-xs h-8"
                >
                  Siguiente
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onCerrar} disabled={loading} className="rounded text-xs h-8">
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-[#1C96C5] hover:bg-[#157A9E] text-white px-5 font-semibold rounded text-xs h-8"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                {clienteEditar ? "Guardar Modificaciones" : "Registrar Cliente"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
