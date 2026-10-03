import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CrearCliente, ActualizarCliente } from "@/services/Logistica/ClienteService";
import { Loader2, MapPin } from "lucide-react";

// Coordenadas por defecto centro de Sucre
const SUCRE_LAT = -19.0429;
const SUCRE_LNG = -65.2554;

export default function ModalCliente({ abierto, onCerrar, clienteEditar, onGuardado }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    RazonSocial: "",
    NombreComercial: "",
    NitCi: "",
    Telefono: "",
    CorreoElectronico: "",
    Direccion: "",
    Latitud: SUCRE_LAT,
    Longitud: SUCRE_LNG,
    LimiteCreditoBs: 0,
    DiasCredito: 0,
    Observacion: "",
    NombrePuntoVentaPrincipal: "Tienda Principal",
    ReferenciaUbicacion: "",
  });

  useEffect(() => {
    if (clienteEditar) {
      setFormData({
        RazonSocial: clienteEditar.RazonSocial || "",
        NombreComercial: clienteEditar.NombreComercial || "",
        NitCi: clienteEditar.NitCi || "",
        Telefono: clienteEditar.Telefono || "",
        CorreoElectronico: clienteEditar.CorreoElectronico || "",
        Direccion: clienteEditar.Direccion || "",
        Latitud: clienteEditar.Latitud || SUCRE_LAT,
        Longitud: clienteEditar.Longitud || SUCRE_LNG,
        LimiteCreditoBs: clienteEditar.LimiteCreditoBs || 0,
        DiasCredito: clienteEditar.DiasCredito || 0,
        Observacion: clienteEditar.Observacion || "",
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
        Latitud: SUCRE_LAT,
        Longitud: SUCRE_LNG,
        LimiteCreditoBs: 0,
        DiasCredito: 0,
        Observacion: "",
        NombrePuntoVentaPrincipal: "Tienda Principal",
        ReferenciaUbicacion: "",
      });
    }
  }, [clienteEditar, abierto]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.RazonSocial.trim()) {
      toast.error("La razón social es obligatoria");
      return;
    }
    if (!formData.NitCi.trim()) {
      toast.error("El NIT o CI es obligatorio");
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#20A7DB]">
            {clienteEditar ? "Editar Cliente" : "Registrar Nuevo Cliente"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="RazonSocial">Razón Social *</Label>
              <Input
                id="RazonSocial"
                name="RazonSocial"
                value={formData.RazonSocial}
                onChange={handleChange}
                placeholder="Ej. Distribuidora San Francisco"
                required
              />
            </div>
            <div>
              <Label htmlFor="NombreComercial">Nombre Comercial / Letrero</Label>
              <Input
                id="NombreComercial"
                name="NombreComercial"
                value={formData.NombreComercial}
                onChange={handleChange}
                placeholder="Ej. Tienda Doña María"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="NitCi">NIT / CI *</Label>
              <Input
                id="NitCi"
                name="NitCi"
                value={formData.NitCi}
                onChange={handleChange}
                placeholder="Ej. 10245678023"
                required
              />
            </div>
            <div>
              <Label htmlFor="Telefono">Teléfono / Celular</Label>
              <Input
                id="Telefono"
                name="Telefono"
                value={formData.Telefono}
                onChange={handleChange}
                placeholder="Ej. 71234567"
              />
            </div>
            <div>
              <Label htmlFor="CorreoElectronico">Correo Electrónico</Label>
              <Input
                id="CorreoElectronico"
                name="CorreoElectronico"
                type="email"
                value={formData.CorreoElectronico}
                onChange={handleChange}
                placeholder="cliente@ejemplo.com"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="Direccion">Dirección Completa</Label>
            <Input
              id="Direccion"
              name="Direccion"
              value={formData.Direccion}
              onChange={handleChange}
              placeholder="Ej. Av. Hernando Siles #450, casi esq. Junín"
            />
          </div>

          <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#20A7DB]">
              <MapPin size={16} />
              <span>Georreferenciación GPS (Sucre)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="Latitud" className="text-xs">Latitud</Label>
                <Input
                  id="Latitud"
                  name="Latitud"
                  type="number"
                  step="any"
                  value={formData.Latitud}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label htmlFor="Longitud" className="text-xs">Longitud</Label>
                <Input
                  id="Longitud"
                  name="Longitud"
                  type="number"
                  step="any"
                  value={formData.Longitud}
                  onChange={handleChange}
                />
              </div>
            </div>
            {!clienteEditar && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <Label htmlFor="NombrePuntoVentaPrincipal" className="text-xs">Nombre Punto Entrega Inicial</Label>
                  <Input
                    id="NombrePuntoVentaPrincipal"
                    name="NombrePuntoVentaPrincipal"
                    value={formData.NombrePuntoVentaPrincipal}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <Label htmlFor="ReferenciaUbicacion" className="text-xs">Referencia de llegada</Label>
                  <Input
                    id="ReferenciaUbicacion"
                    name="ReferenciaUbicacion"
                    value={formData.ReferenciaUbicacion}
                    onChange={handleChange}
                    placeholder="Ej. Portón azul frente a la plaza"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="LimiteCreditoBs">Límite de Crédito (Bs)</Label>
              <Input
                id="LimiteCreditoBs"
                name="LimiteCreditoBs"
                type="number"
                step="0.01"
                min="0"
                value={formData.LimiteCreditoBs}
                onChange={handleChange}
              />
            </div>
            <div>
              <Label htmlFor="DiasCredito">Días de Crédito Máximos</Label>
              <Input
                id="DiasCredito"
                name="DiasCredito"
                type="number"
                min="0"
                value={formData.DiasCredito}
                onChange={handleChange}
                placeholder="Ej. 15 días"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="Observacion">Observaciones</Label>
            <Textarea
              id="Observacion"
              name="Observacion"
              value={formData.Observacion}
              onChange={handleChange}
              rows={2}
              placeholder="Detalles sobre horarios de atención o acuerdos comerciales"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCerrar} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-[#20A7DB] hover:bg-[#188ebc] text-white" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {clienteEditar ? "Guardar Cambios" : "Crear Cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
