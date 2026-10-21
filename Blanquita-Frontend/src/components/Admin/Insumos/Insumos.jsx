import { useEffect, useState } from "react";
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
} from "@/components/Reportes/comunes";
import {
  BadgeStock,
  columnaEstado,
  columnaStock,
  DialogoCambiarEstadoTipo,
  ESTILOS_ESTADO_TIPO,
} from "@/components/Admin/MateriaPrima/comunes";
import { useReporte } from "@/hooks/useReporte";
import { EstadosCatalogo } from "@/constants/Estados";
import { formatearNumero } from "@/utils/numeros";
import { listarInsumos, cambiarEstadoInsumo } from "@/services/Insumo/Insumo";
import { tomarMensaje } from "@/utils/mensajeFlash";

const FILTROS_INICIALES = { Busqueda: "", Activo: "" };

const stock = (i) => formatearNumero(i.CantidadActual, { decimales: 0 });

const CONFIG_ESTADO = {
  idDe: (i) => i.IdTipoInsumo,
  nombreDe: (i) => i.NombreInsumo,
  resumenEstado: (i) => `${stock(i)} en almacén`,
  descripcionEstado:
    "Un insumo inactivo no admite ingresos nuevos; el stock que queda se puede seguir sacando y aparece en inventarios y reportes.",
  cambiarEstado: cambiarEstadoInsumo,
};

const COLUMNAS = [
  {
    titulo: "Nombre",
    clase: "font-semibold text-slate-900",
    valor: (i) => i.NombreInsumo,
  },
  { titulo: "Descripción", clase: "text-slate-600", valor: (i) => i.DescripcionInsumo ?? "-" },
  columnaStock((i) => Number(i.CantidadActual || 0)),
  columnaEstado,
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

export default function Insumos() {
  const reporte = useReporte(listarInsumos, FILTROS_INICIALES, ["Busqueda"]);
  const [cambioEstado, setCambioEstado] = useState(null);

  useEffect(() => {
    const mensaje = tomarMensaje();
    if (mensaje) toast.success(mensaje);
  }, []);

  const alCambiarEstado = (resultado) => {
    setCambioEstado(null);
    toast.success(`${resultado.Nombre}: ${resultado.NombreEstadoAnterior} → ${resultado.NombreEstado}`);
    reporte.recargar();
  };

  const acciones = (i) => (
    <div className="flex justify-end gap-1">
      <BotonAccion
        ayuda="Editar insumo"
        icono={Pencil}
        onClick={() => (window.location.href = `/admin/insumos/editar/${i.IdTipoInsumo}`)}
      />
      <BotonAccion ayuda="Cambiar estado" icono={ToggleRight} onClick={() => setCambioEstado(i)} />
    </div>
  );

  return (
    <TooltipProvider>
      <Toaster richColors position="top-center" />
      <div className="contenido-con-sidebar flex min-h-screen flex-col bg-slate-50 pt-20 font-sans text-slate-900 md:pt-0">
        <Header
          volver="/admin/inicio"
          titulo="Administración"
          subtitulo="Insumos"
          contador={
            reporte.catalogo
              ? { valor: reporte.catalogo.Total, singular: "insumo", plural: "insumos" }
              : null
          }
          accion={{
            texto: "Registrar insumo",
            icono: Plus,
            onClick: () => (window.location.href = "/admin/insumos/registrar"),
          }}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
          <TarjetaFiltros reporte={reporte}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <BuscadorFiltro
                reporte={reporte}
                campo="Busqueda"
                etiqueta="Buscar"
                placeholder="Nombre o descripción"
                mono={false}
              />
              <SelectFiltro
                reporte={reporte}
                campo="Activo"
                etiqueta="Estado"
                opciones={EstadosCatalogo}
                campoEtiqueta="NombreEstado"
                placeholder="Todos los estados"
              />
            </div>
          </TarjetaFiltros>

          <ResultadosReporte
            reporte={reporte}
            elementos={reporte.catalogo?.Insumos}
            clave={(i) => i.IdTipoInsumo}
            nombres={["insumo", "insumos"]}
            columnas={COLUMNAS}
            anchoAccion="w-24"
            accion={acciones}
            tarjeta={(i) => (
              <TarjetaReporte
                titulo={i.NombreInsumo}
                tamanoTitulo="text-[14px] font-sans"
                subtitulo={i.DescripcionInsumo ?? "Sin descripción"}
                estado={i.NombreEstado}
                estilos={ESTILOS_ESTADO_TIPO}
              >
                <PieTarjeta accion={acciones(i)}>
                  <Dato etiqueta="Stock">{stock(i)}</Dato>
                  <BadgeStock cantidad={Number(i.CantidadActual || 0)} tipo={i} />
                </PieTarjeta>
              </TarjetaReporte>
            )}
          />
        </main>
      </div>

      <DialogoCambiarEstadoTipo
        tipo={cambioEstado}
        config={CONFIG_ESTADO}
        onCerrar={() => setCambioEstado(null)}
        onCambiado={alCambiarEstado}
      />
    </TooltipProvider>
  );
}
