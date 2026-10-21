import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/layout/Header";
import IngresoReporteBobinaPapel from "@/components/Reportes/PapelBobina/Ingreso";
import LoteReporteServilleta from "@/components/Reportes/BobinaServilleta/Lote";
import IngresoReporteRodela from "@/components/Reportes/Rodela/Ingreso";
import { LotesEmpaque } from "@/components/Reportes/Empaque/Lotes";

const MATERIA_PRIMA = "Almacén · Materia Prima";
const EMPAQUE = "Almacén · Empaque";

const DOMINIOS = {
  "bobina-papel": {
    titulo: MATERIA_PRIMA,
    subtitulo: "Ingresos de bobinas de papel",
    componente: IngresoReporteBobinaPapel,
  },
  "bobina-servilleta": {
    titulo: MATERIA_PRIMA,
    subtitulo: "Ingresos de bobinas de servilleta",
    componente: LoteReporteServilleta,
  },
  rodela: {
    titulo: MATERIA_PRIMA,
    subtitulo: "Ingresos de rodelas",
    componente: IngresoReporteRodela,
  },
  "empaque-bobina": {
    titulo: MATERIA_PRIMA,
    subtitulo: "Ingresos de empaques en bobina",
    componente: LotesEmpaque,
    props: { claseFija: "bobina" },
  },
  "empaque-bolsa": {
    titulo: EMPAQUE,
    subtitulo: "Ingresos de empaques en bolsa",
    componente: LotesEmpaque,
    props: { claseFija: "bolsa" },
  },
  "empaque-jaba": {
    titulo: EMPAQUE,
    subtitulo: "Ingresos de bolsas de jaba",
    componente: LotesEmpaque,
    props: { claseFija: "jaba" },
  },
};

export default function LotesIngreso({ dominio }) {
  const { titulo, subtitulo, componente: Componente, props } = DOMINIOS[dominio];

  return (
    <TooltipProvider>
      <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
        <Header volver titulo={titulo} subtitulo={subtitulo} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
          <Componente {...props} />
        </main>
      </div>
    </TooltipProvider>
  );
}
