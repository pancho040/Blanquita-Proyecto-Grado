import { Fragment, useEffect, useState } from "react";
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
import { EsEncargado } from "@/utils/validators";
import { useNombreUsuario } from "@/hooks/useNombreUsuario";
import ResumenOperador, { tieneResumen } from "./ResumenOperador";

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
      className={cn(
        "group flex flex-col gap-3 rounded-2xl p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        destacado
          ? "bg-gradient-to-br from-c3 to-c4 text-white"
          : "bg-white text-slate-900 ring-1 ring-slate-200",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          destacado ? "bg-white/15" : "bg-c4/10",
        )}
      >
        <Icono
          size={20}
          strokeWidth={2}
          className={destacado ? "text-white" : "text-c3"}
        />
      </div>

      <div className="min-w-0">
        <div className="text-[15px] font-extrabold leading-tight break-words">
          {subruta.titulo}
        </div>
        {subruta.descripcion && (
          <p
            className={cn(
              "mt-1 text-[13px] leading-snug break-words",
              destacado ? "text-white/85" : "text-slate-500",
            )}
          >
            {subruta.descripcion}
          </p>
        )}
      </div>

      <div
        className={cn(
          "mt-auto flex items-center gap-1 text-xs font-bold",
          destacado ? "text-white/90" : "text-c3",
        )}
      >
        Abrir
        <ArrowRight
          size={14}
          strokeWidth={2.75}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </div>
    </a>
  );
}

export default function InicioOperador({ usuario, paneles = {} }) {
  const [areaId, setAreaId] = useState(idAreaPorDefecto);
  const [ahora, setAhora] = useState(null);
  const nombre = useNombreUsuario();

  useEffect(() => {
    setAreaId(areaInicial().id);
    setAhora(new Date());
  }, []);

  const area = getArea(areaId) ?? AREAS_TRABAJO[0];
  const idRol = usuario?.IdRol ?? 1;
  const Panel = paneles[area.id];
  const ancho = Object.keys(paneles).length ? "max-w-6xl" : "max-w-5xl";

  const seleccionar = (id) => {
    if (!id || id === areaId) return;
    setAreaId(id);
    guardarArea(id);
  };

  return (
    <div className="contenido-con-sidebar flex min-h-screen flex-col bg-slate-50 pt-20 font-sans text-slate-900 md:pt-0">
      <header className="bg-gradient-to-r from-c3 to-c4 px-5 py-5 text-white sm:px-7">
        <div className={cn("mx-auto w-full", ancho)}>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
            {ahora
              ? `Turno ${turnoActual(ahora)} · ${capitalizar(fechaLarga(ahora))}`
              : " "}
          </div>
          <div className="mt-0.5 text-xl font-extrabold">
            {nombre ? `Hola, ${nombre}` : "Hola"}
          </div>
        </div>
      </header>

      <main className={cn("mx-auto w-full flex-1 px-5 py-6 sm:px-6", ancho)}>
        <div className="mb-2 text-sm font-bold text-slate-700">
          {EsEncargado(idRol) ? "¿Qué área quieres revisar?" : "¿En qué vas a trabajar?"}
        </div>

        <ToggleGroup
          value={[areaId]}
          className="mb-6 flex w-full flex-wrap justify-start gap-2"
        >
          {AREAS_TRABAJO.map((a) => (
            <ToggleGroupItem
              key={a.id}
              value={a.id}
              onClick={() => seleccionar(a.id)}
              className="h-auto gap-1.5 rounded-full border-2 border-slate-200 px-3.5 py-2 text-[12.5px] font-bold text-slate-600 bg-white hover:border-slate-300 hover:bg-white hover:text-slate-600 aria-pressed:border-slate-900 aria-pressed:bg-slate-900 aria-pressed:text-white aria-pressed:hover:border-slate-900 aria-pressed:hover:bg-slate-900 aria-pressed:hover:text-white"
            >
              <IconoArea area={a} />
              {a.titulo}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <IconoArea area={area} size={18} className="text-c3" />
          <span className="text-base font-extrabold text-slate-900">
            {area.titulo}
          </span>
          {area.descripcion && (
            <span className="text-sm text-slate-500">· {area.descripcion}</span>
          )}
        </div>

        {Panel ? (
          <Panel key={area.id} />
        ) : (
          <Fragment key={area.id}>
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {area.subrutas
                .filter((s) => !s.soloLider || EsEncargado(idRol))
                .map((s, i) => (
                  <TileAcceso
                    key={s.ruta}
                    subruta={s}
                    href={rutaAcceso(idRol, area, s)}
                    destacado={i === 0}
                  />
                ))}
            </div>
            {tieneResumen(area.id) && <ResumenOperador area={area} idRol={idRol} />}
          </Fragment>
        )}
      </main>
    </div>
  );
}
