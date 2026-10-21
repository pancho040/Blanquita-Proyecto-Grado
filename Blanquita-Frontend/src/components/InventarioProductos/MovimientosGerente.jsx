import { useState } from "react";
import { PackageCheck, Truck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/layout/Header";
import { SinContenedor } from "@/components/Reportes/PaginaReporte";
import ProduccionReporteProducto from "@/components/Reportes/Producto/Produccion";
import SalidasReporteProducto from "@/components/Reportes/Producto/Salidas";
import { rutaDeRol } from "@/utils/validators";

const PESTANAS = [
  {
    valor: "produccion",
    texto: "Producción diaria",
    icono: PackageCheck,
    componente: ProduccionReporteProducto,
  },
  {
    valor: "salidas",
    texto: "Salidas",
    icono: Truck,
    componente: SalidasReporteProducto,
  },
];

export default function MovimientosGerente({ usuario }) {
  const [activa, setActiva] = useState(PESTANAS[0].valor);

  return (
    <TooltipProvider>
      <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
        <Header
          titulo="Movimientos producto terminado"
          subtitulo={PESTANAS.find((pestana) => pestana.valor === activa).texto}
          volver={rutaDeRol(usuario?.IdRol, "producto/inventario")}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
          <Tabs value={activa} onValueChange={setActiva}>
            <TabsList className="mb-5 h-11 w-full sm:w-auto">
              {PESTANAS.map(({ valor, texto, icono: Icono }) => (
                <TabsTrigger key={valor} value={valor} className="flex-1 gap-1.5 font-bold sm:flex-none sm:px-6">
                  <Icono size={15} strokeWidth={2.75} />
                  {texto}
                </TabsTrigger>
              ))}
            </TabsList>

            {PESTANAS.map(({ valor, componente: Componente }) => (
              <TabsContent key={valor} value={valor}>
                <Componente usuario={usuario} contenedor={SinContenedor} />
              </TabsContent>
            ))}
          </Tabs>
        </main>
      </div>
    </TooltipProvider>
  );
}
