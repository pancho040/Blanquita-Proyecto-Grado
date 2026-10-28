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
  MapPin, 
  Calendar,
  Layers,
  CheckCircle2
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

export default function ModalCliente({ abierto, onCerrar, clienteEditar, onGuardado }) {
  if (!abierto) return null;
  const [loading, setLoading] = useState(false);
  const [tabActiva, setTabActiva] = useState("comercial"); // "comercial" | "ubicacion" | "credito"

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
  });

  // Apertura instantánea: sincronizar campos sin bloqueos
  useEffect(() => {
    if (abierto) {
      setTabActiva("comercial");
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
        });
      }
    }
  }, [clienteEditar, abierto]);

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
        });
        toast.success("Cliente actualizado exitosamente");
      } else {
        await CrearCliente({
          ...formData,
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
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-xl font-bold text-[#20A7DB] flex items-center gap-2">
            <Store className="h-6 w-6 text-[#20A7DB]" />
            <span>{clienteEditar ? "Editar Datos del Cliente" : "Registro de Nuevo Cliente"}</span>
          </DialogTitle>

          {/* Selector de Pestañas (Tabs) para máxima fluidez y velocidad */}
          <div className="flex border-b border-slate-200 gap-1 pt-3">
            <button
              type="button"
              onClick={() => setTabActiva("comercial")}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                tabActiva === "comercial"
                  ? "border-[#20A7DB] text-[#20A7DB]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>1. Datos Comerciales</span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva("ubicacion")}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                tabActiva === "ubicacion"
                  ? "border-[#20A7DB] text-[#20A7DB]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>2. Ubicación & Mapa Sucre</span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva("credito")}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                tabActiva === "credito"
                  ? "border-[#20A7DB] text-[#20A7DB]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>3. Condiciones de Crédito</span>
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-3">
          <div className="min-h-[420px]">
          {/* TAB 1: DATOS COMERCIALES */}
          {tabActiva === "comercial" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="RazonSocial" className="text-xs font-semibold text-slate-700">
                      Razón Social (Facturación) *
                    </Label>
                    <Input
                      id="RazonSocial"
                      name="RazonSocial"
                      value={formData.RazonSocial}
                      onChange={handleChange}
                      placeholder="Ej. Distribuidora San Francisco S.R.L."
                      required
                      className="mt-1 bg-white border-slate-300"
                    />
                  </div>

                  <div>
                    <Label htmlFor="NombreComercial" className="text-xs font-semibold text-slate-700">
                      Nombre Comercial / Rótulo de la Tienda
                    </Label>
                    <Input
                      id="NombreComercial"
                      name="NombreComercial"
                      value={formData.NombreComercial}
                      onChange={handleChange}
                      placeholder="Ej. Tienda Doña María o Minimarket Central"
                      className="mt-1 bg-white border-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="NitCi" className="text-xs font-semibold text-slate-700">
                      NIT o Carnet de Identidad (CI) *
                    </Label>
                    <Input
                      id="NitCi"
                      name="NitCi"
                      value={formData.NitCi}
                      onChange={handleChange}
                      placeholder="Ej. 10245678023"
                      required
                      className="mt-1 bg-white border-slate-300 text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="Telefono" className="text-xs font-semibold text-slate-700">
                      Teléfono / Celular WhatsApp
                    </Label>
                    <Input
                      id="Telefono"
                      name="Telefono"
                      value={formData.Telefono}
                      onChange={handleChange}
                      placeholder="Ej. 71234567"
                      className="mt-1 bg-white border-slate-300"
                    />
                  </div>

                  <div>
                    <Label htmlFor="CorreoElectronico" className="text-xs font-semibold text-slate-700">
                      Correo Electrónico
                    </Label>
                    <Input
                      id="CorreoElectronico"
                      name="CorreoElectronico"
                      type="email"
                      value={formData.CorreoElectronico}
                      onChange={handleChange}
                      placeholder="cliente@ejemplo.com"
                      className="mt-1 bg-white border-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Tipo de Negocio / Canal Comercial</Label>
                  <select
                    name="TipoNegocio"
                    value={formData.TipoNegocio}
                    onChange={handleChange}
                    className="mt-1 w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                  >
                    {TIPOS_COMERCIO.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GEORREFERENCIACIÓN & MAPA (Solo monta Leaflet al abrir la pestaña) */}
          {tabActiva === "ubicacion" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div className="p-4 sm:p-5 rounded-xl bg-sky-50/50 border border-sky-200/90 space-y-4">
                <MapaSelectorUbicacion
                  lat={formData.Latitud}
                  lng={formData.Longitud}
                  onChange={handleCoordsChange}
                  altura="h-64 sm:h-72"
                  label="Selecciona la ubicación exacta de la tienda en el mapa:"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <Label htmlFor="Direccion" className="text-xs font-semibold text-slate-700">
                      Dirección Física Completa en Sucre *
                    </Label>
                    <Input
                      id="Direccion"
                      name="Direccion"
                      value={formData.Direccion}
                      onChange={handleChange}
                      placeholder="Ej. Av. Ostria Gutiérrez #820, frente a parada de micros"
                      required
                      className="mt-1 bg-white border-slate-300"
                    />
                  </div>

                  <div>
                    <Label htmlFor="ReferenciaUbicacion" className="text-xs font-semibold text-slate-700">
                      Referencia de Llegada para el Repartidor
                    </Label>
                    <Input
                      id="ReferenciaUbicacion"
                      name="ReferenciaUbicacion"
                      value={formData.ReferenciaUbicacion}
                      onChange={handleChange}
                      placeholder="Ej. Portón azul al lado de la farmacia..."
                      className="mt-1 bg-white border-slate-300"
                    />
                  </div>
                </div>

                {!clienteEditar && (
                  <div className="pt-1">
                    <Label htmlFor="NombrePuntoVentaPrincipal" className="text-xs font-semibold text-slate-700">
                      Nombre de la Tienda o Punto de Entrega Principal
                    </Label>
                    <Input
                      id="NombrePuntoVentaPrincipal"
                      name="NombrePuntoVentaPrincipal"
                      value={formData.NombrePuntoVentaPrincipal}
                      onChange={handleChange}
                      className="mt-1 bg-white border-slate-300 max-w-md"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CONDICIONES DE CRÉDITO */}
          {tabActiva === "credito" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="LimiteCreditoBs" className="text-xs font-semibold text-slate-700">
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
                      className="mt-1 bg-white border-slate-300 font-bold text-slate-800"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {PRESETS_CREDITO_BS.map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, LimiteCreditoBs: val }))}
                          className="text-xs px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium"
                        >
                          {val === 0 ? "Contado (0 Bs)" : `Bs. ${val.toLocaleString()}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="DiasCredito" className="text-xs font-semibold text-slate-700">
                      Días de Crédito Máximos Permitidos
                    </Label>
                    <Input
                      id="DiasCredito"
                      name="DiasCredito"
                      type="number"
                      min="0"
                      value={formData.DiasCredito}
                      onChange={handleChange}
                      className="mt-1 bg-white border-slate-300 font-bold text-slate-800"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {PRESETS_DIAS.map((p) => (
                        <button
                          key={p.dias}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, DiasCredito: p.dias }))}
                          className="text-xs px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="Observacion" className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Observaciones Comerciales y Horarios de Descarga
                  </Label>
                  <Textarea
                    id="Observacion"
                    name="Observacion"
                    value={formData.Observacion}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Ej. Recibe mercadería únicamente por las mañanas de 08:00 a 11:30..."
                    className="mt-1 bg-white border-slate-300 text-sm"
                  />
                </div>
              </div>
            </div>
          )}
          </div>

          <DialogFooter className="gap-2 pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex gap-1.5">
              {tabActiva !== "comercial" && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setTabActiva(tabActiva === "credito" ? "ubicacion" : "comercial")}
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
                >
                  Siguiente
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onCerrar} disabled={loading}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-[#20A7DB] hover:bg-[#188ebc] text-white px-7 font-semibold"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {clienteEditar ? "Guardar Modificaciones" : "Registrar Cliente"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}