import { useState } from "react";
import { Pencil, Plus, ToggleRight } from "lucide-react";
import { Toaster, toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import Header from "@/components/layout/Header";
import {
  TarjetaFiltros,
  BuscadorFiltro,
  SelectFiltro,
  ResultadosReporte,
  TarjetaReporte,
  PieTarjeta,
  Dato,
  BadgeEstado,
} from "@/components/Reportes/comunes";
import { useReporte } from "@/hooks/useReporte";
import { listarProveedores } from "@/services/Proveedor/Proveedor";
import { EstadosProveedor } from "@/constants/Estados";
import { DialogoProveedor, DialogoCambiarEstado } from "./Dialogos";

const ESTADOS_PROVEEDOR = {
  Activo: "border-emerald-300 bg-emerald-50 text-emerald-700",
  Inactivo: "border-amber-300 bg-amber-50 text-amber-700",
};

const FILTROS_INICIALES = { Busqueda: "", Activo: "" };

const COLUMNAS = [
  {
    titulo: "Nombre",
    clase: "font-semibold text-slate-900",
    valor: (p) => p.NombreProveedor,
  },
  { titulo: "Celular", clase: "tabular-nums", valor: (p) => p.CelularProveedor ?? "-" },
  { titulo: "Correo", valor: (p) => p.CorreoProveedor ?? "-" },
  {
    titulo: "Estado",
    valor: (p) => <BadgeEstado estado={p.NombreEstadoProveedor} estilos={ESTADOS_PROVEEDOR} />,
  },
];

function BotonAccion({ ayuda, icono: Icono, onClick }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            className="h-9 w-9 text-slate-400 hover:bg-c4/10 hover:text-c3"
          >
            <Icono size={16} strokeWidth={2.25} />
          </Button>
        }
      />
      <TooltipContent>{ayuda}</TooltipContent>
    </Tooltip>
  );
}

export default function Proveedores() {
  const reporte = useReporte(listarProveedores, FILTROS_INICIALES, ["Busqueda"]);
  const [dialogo, setDialogo] = useState({ abierto: false, proveedor: null });
  const [cambioEstado, setCambioEstado] = useState(null);

  const acciones = (p) => (
    <div className="flex justify-end gap-1">
      <BotonAccion
        ayuda="Editar proveedor"
        icono={Pencil}
        onClick={() => setDialogo({ abierto: true, proveedor: p })}
      />
      <BotonAccion ayuda="Cambiar estado" icono={ToggleRight} onClick={() => setCambioEstado(p)} />
    </div>
  );

  const alGuardar = (guardado, editando) => {
    setDialogo({ abierto: false, proveedor: null });
    toast.success(
      editando
        ? `Proveedor ${guardado.NombreProveedor} actualizado`
        : `Proveedor ${guardado.NombreProveedor} registrado`,
    );
    reporte.recargar();
  };

  const alCambiarEstado = (resultado) => {
    setCambioEstado(null);
    toast.success(
      `${resultado.NombreProveedor}: ${resultado.NombreEstadoAnterior} → ${resultado.NombreEstadoProveedor}`,
    );
    reporte.recargar();
  };

  return (
    <TooltipProvider>
      <Toaster richColors position="top-center" />
      <div className="contenido-con-sidebar flex min-h-screen flex-col bg-slate-50 pt-20 font-sans text-slate-900 md:pt-0">
        <Header
          volver="/admin/inicio"
          titulo="Administración"
          subtitulo="Proveedores"
          contador={
            reporte.catalogo
              ? { valor: reporte.catalogo.Total, singular: "proveedor", plural: "proveedores" }
              : null
          }
          accion={{
            texto: "Registrar proveedor",
            icono: Plus,
            onClick: () => setDialogo({ abierto: true, proveedor: null }),
          }}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
          <TarjetaFiltros reporte={reporte}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <BuscadorFiltro
                reporte={reporte}
                campo="Busqueda"
                etiqueta="Buscar"
                placeholder="Nombre, celular o correo"
                mono={false}
              />
              <SelectFiltro
                reporte={reporte}
                campo="Activo"
                etiqueta="Estado"
                opciones={EstadosProveedor}
                campoEtiqueta="NombreEstadoProveedor"
                placeholder="Todos los estados"
              />
            </div>
          </TarjetaFiltros>

          <ResultadosReporte
            reporte={reporte}
            elementos={reporte.catalogo?.Proveedores}
            clave={(p) => p.IdProveedor}
            nombres={["proveedor", "proveedores"]}
            columnas={COLUMNAS}
            anchoAccion="w-24"
            accion={acciones}
            tarjeta={(p) => (
              <TarjetaReporte
                titulo={p.NombreProveedor}
                tamanoTitulo="text-[14px] font-sans"
                subtitulo={p.CorreoProveedor ?? "Sin correo"}
                estado={p.NombreEstadoProveedor}
                estilos={ESTADOS_PROVEEDOR}
              >
                <PieTarjeta accion={acciones(p)}>
                  <Dato etiqueta="Celular">{p.CelularProveedor ?? "-"}</Dato>
                </PieTarjeta>
              </TarjetaReporte>
            )}
          />
        </main>
      </div>

      <DialogoProveedor
        abierto={dialogo.abierto}
        proveedor={dialogo.proveedor}
        onCerrar={() => setDialogo({ abierto: false, proveedor: null })}
        onGuardado={alGuardar}
      />
      <DialogoCambiarEstado
        proveedor={cambioEstado}
        onCerrar={() => setCambioEstado(null)}
        onCambiado={alCambiarEstado}
      />
    </TooltipProvider>
  );
}
