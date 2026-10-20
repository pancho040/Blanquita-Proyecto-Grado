import { useEffect } from "react";
import { Pencil, Plus } from "lucide-react";
import { Toaster, toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import Header from "@/components/layout/Header";
import {
  TarjetaFiltros,
  BuscadorFiltro,
  ResultadosReporte,
  TarjetaReporte,
  PieTarjeta,
  Dato,
} from "@/components/Reportes/comunes";
import { BadgeStock, columnaStock } from "@/components/Admin/MateriaPrima/comunes";
import { useReporte } from "@/hooks/useReporte";
import { formatearNumero } from "@/utils/numeros";
import { listarInsumos } from "@/services/Insumo/Insumo";
import { tomarMensaje } from "@/utils/mensajeFlash";

const FILTROS_INICIALES = { Busqueda: "" };

const stock = (i) => formatearNumero(i.CantidadActual, { decimales: 0 });

const COLUMNAS = [
  {
    titulo: "Nombre",
    clase: "font-semibold text-slate-900",
    valor: (i) => i.NombreInsumo,
  },
  { titulo: "Descripción", clase: "text-slate-600", valor: (i) => i.DescripcionInsumo ?? "-" },
  columnaStock((i) => Number(i.CantidadActual || 0)),
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

  useEffect(() => {
    const mensaje = tomarMensaje();
    if (mensaje) toast.success(mensaje);
  }, []);

  const acciones = (i) => (
    <div className="flex justify-end gap-1">
      <BotonAccion
        ayuda="Editar insumo"
        icono={Pencil}
        onClick={() => (window.location.href = `/admin/insumos/editar/${i.IdTipoInsumo}`)}
      />
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
            <BuscadorFiltro
              reporte={reporte}
              campo="Busqueda"
              etiqueta="Buscar"
              placeholder="Nombre o descripción"
              mono={false}
            />
          </TarjetaFiltros>

          <ResultadosReporte
            reporte={reporte}
            elementos={reporte.catalogo?.Insumos}
            clave={(i) => i.IdTipoInsumo}
            nombres={["insumo", "insumos"]}
            columnas={COLUMNAS}
            anchoAccion="w-16"
            accion={acciones}
            tarjeta={(i) => (
              <TarjetaReporte
                titulo={i.NombreInsumo}
                tamanoTitulo="text-[14px] font-sans"
                subtitulo={i.DescripcionInsumo ?? "Sin descripción"}
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
    </TooltipProvider>
  );
}
