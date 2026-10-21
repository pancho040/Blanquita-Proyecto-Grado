import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/layout/Header";
import { PREFIJO_POR_ROL } from "@/constants/Values";

export function SinContenedor({ children }) {
  return children;
}

export function PaginaReporte({ usuario, titulo, subtitulo, contador, children }) {
  const prefijo = PREFIJO_POR_ROL[usuario?.IdRol] ?? "encargado";

  return (
    <TooltipProvider>
      <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
        <Header
          volver={`/${prefijo}/reportes/inicio`}
          titulo={titulo}
          subtitulo={subtitulo}
          contador={contador}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}

export function PaginaReportesPestanas({ usuario, titulo, pestanas }) {
  const [activa, setActiva] = useState(pestanas[0].valor);

  return (
    <PaginaReporte
      usuario={usuario}
      titulo={titulo}
      subtitulo={pestanas.find((pestana) => pestana.valor === activa).subtitulo}
    >
      <Tabs value={activa} onValueChange={setActiva}>
        <TabsList className="mb-5 h-11 w-full sm:w-auto">
          {pestanas.map((pestana) => (
            <TabsTrigger
              key={pestana.valor}
              value={pestana.valor}
              className="flex-1 font-bold sm:flex-none sm:px-6"
            >
              {pestana.texto}
            </TabsTrigger>
          ))}
        </TabsList>

        {pestanas.map(({ valor, componente: Componente }) => (
          <TabsContent key={valor} value={valor}>
            <Componente />
          </TabsContent>
        ))}
      </Tabs>
    </PaginaReporte>
  );
}
