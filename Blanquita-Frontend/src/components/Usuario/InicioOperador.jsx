import { useEffect, useState } from "react";
import { Icon, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AREAS_TRABAJO } from "@/constants/OperadorConfig";
import {
  areaInicial,
  getArea,
  guardarArea,
  idAreaPorDefecto,
  rutaAcceso,
} from "@/utils/areaTrabajo";

const DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function turnoActual(fecha) {
  return fecha.getHours() < 15 ? "Mañana" : "Tarde";
}

function fechaLarga(fecha) {
  return `${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

/** Icono del área: soporta los iconos de @lucide/lab (esIconoLab). */
function IconoArea({ area, size = 15, className }) {
  if (area.esIconoLab) {
    return <Icon iconNode={area.icono} size={size} className={className} />;
  }
  const Comp = area.icono;
  return <Comp size={size} className={className} />;
}

function TileAcceso({ subruta, href, destacado }) {
  const Icono = subruta.icono;
  return (
    <a
      href={href}
      className="group flex flex-col gap-3 rounded p-4 transition-colors border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-700">
          <Icono
            size={16}
            strokeWidth={2}
          />
        </div>
        {destacado && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1C96C5] bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
            Frecuente
          </span>
        )}
      </div>

      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-900 leading-snug break-words">
          {subruta.titulo}
        </div>
        {subruta.descripcion && (
          <p className="mt-1 text-xs text-slate-600 leading-relaxed break-words">
            {subruta.descripcion}
          </p>
        )}
      </div>

      <div className="mt-auto pt-2 flex items-center gap-1 text-xs font-semibold text-[#1C96C5]">
        <span>Acceder</span>
        <ArrowRight
          size={13}
          strokeWidth={2}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </div>
    </a>
  );
}

export default function InicioOperador({ usuario }) {
  // Arranque SSR-safe: mismo valor en servidor y en la primera hidratación.
  const [areaId, setAreaId] = useState(idAreaPorDefecto);
  const [ahora, setAhora] = useState(null);

  // Ya en el cliente: leemos la preferencia guardada y la fecha real.
  useEffect(() => {
    setAreaId(areaInicial().id);
    setAhora(new Date());
  }, []);

  const area = getArea(areaId) ?? AREAS_TRABAJO[0];
  const idRol = usuario?.IdRol ?? 1;

  const seleccionar = (id) => {
    if (!id || id === areaId) return;
    setAreaId(id);
    guardarArea(id);
  };

  return (
    <div className="contenido-con-sidebar flex min-h-screen flex-col bg-[#F8FAFC] pt-20 font-sans text-slate-900 md:pt-0">
      <header className="bg-slate-900 px-5 py-4 text-white sm:px-7 border-b border-slate-800">
        <div className="mx-auto w-full max-w-5xl">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
            {ahora
              ? `Turno ${turnoActual(ahora)} · ${capitalizar(fechaLarga(ahora))}`
              : " "}
          </div>
          <div className="mt-0.5 text-lg font-bold tracking-tight text-white">
            {/* TODO: nombre real cuando exista el GET del perfil de usuario */}
            Panel Operativo de Planta
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">
          ¿En qué área vas a trabajar?
        </div>

        <ToggleGroup
          value={[areaId]}
          className="mb-5 flex w-full flex-wrap justify-start gap-2"
        >
          {AREAS_TRABAJO.map((a) => (
            <ToggleGroupItem
              key={a.id}
              value={a.id}
              onClick={() => seleccionar(a.id)}
              className="h-8 gap-1.5 rounded border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 data-[state=on]:border-[#1C96C5] data-[state=on]:bg-sky-50 data-[state=on]:text-[#1C96C5] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <IconoArea area={a} />
              <span>{a.titulo}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="mb-3.5 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2.5">
          <IconoArea area={area} size={16} className="text-[#1C96C5]" />
          <span className="text-sm font-bold text-slate-900">
            {area.titulo}
          </span>
          {area.descripcion && (
            <span className="text-xs text-slate-500">· {area.descripcion}</span>
          )}
        </div>

        <div
          key={area.id}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {area.subrutas.map((s, i) => (
            <TileAcceso
              key={s.ruta}
              subruta={s}
              href={rutaAcceso(idRol, area, s)}
              destacado={i === 0}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
