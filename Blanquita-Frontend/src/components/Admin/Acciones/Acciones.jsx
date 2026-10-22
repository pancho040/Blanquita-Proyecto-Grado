import { useEffect, useState } from "react";
import {
  Boxes,
  FileText,
  Gauge,
  Package,
  PackageCheck,
  Search,
  Truck,
  UserShield,
  Users,
} from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/layout/Header";
import DoubleDatePicker from "@/components/layout/dates/DoubleDatePicker";
import {
  TarjetaFiltros,
  CampoFiltro,
  BuscadorFiltro,
  BotonInforme,
  ResultadosReporte,
  TarjetaReporte,
  PieTarjeta,
  Dato,
} from "@/components/Reportes/comunes";
import { ATAJOS, atajoActivo } from "@/components/Reportes/Empaque/filtros";
import { useReporte } from "@/hooks/useReporte";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { aFechaISO, dateFormatter } from "@/utils/dates";
import {
  listarHistorialAdmin,
  verResumenUsuarioHistorialAdmin,
  descargarReporteHistorialAdmin,
} from "@/services/Usuario/HistorialAdmin";

const LONGITUD_MINIMA_CI = 6;
const LONGITUD_MAXIMA_CI = 20;

export const MODULOS = [
  { valor: "", texto: "Todos" },
  { valor: "Usuarios", texto: "Usuarios" },
  { valor: "Proveedores", texto: "Proveedores" },
  { valor: "Insumos", texto: "Insumos" },
  { valor: "Materia prima", texto: "Materia prima" },
  { valor: "Productos", texto: "Productos" },
  { valor: "Stock", texto: "Stock" },
];

const ESTILOS_MODULO = {
  Usuarios: { badge: "bg-sky-50 text-sky-700 ring-sky-200", icono: Users, tarjeta: "bg-sky-50 text-sky-700" },
  Proveedores: {
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    icono: Truck,
    tarjeta: "bg-amber-50 text-amber-700",
  },
  Insumos: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icono: Package,
    tarjeta: "bg-emerald-50 text-emerald-700",
  },
  "Materia prima": {
    badge: "bg-violet-50 text-violet-700 ring-violet-200",
    icono: Boxes,
    tarjeta: "bg-violet-50 text-violet-700",
  },
  Productos: {
    badge: "bg-teal-50 text-teal-700 ring-teal-200",
    icono: PackageCheck,
    tarjeta: "bg-teal-50 text-teal-700",
  },
  Stock: {
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    icono: Gauge,
    tarjeta: "bg-rose-50 text-rose-700",
  },
  Otros: { badge: "bg-slate-100 text-slate-700 ring-slate-200", icono: FileText, tarjeta: "bg-slate-100 text-slate-700" },
};

const FILTROS_INICIALES = {
  Rango: ATAJOS[0].rango(new Date()),
  Modulo: "",
  Ci: "",
  Busqueda: "",
};

const consultarAcciones = (parametros) =>
  parametros.FechaInicio && parametros.FechaFin
    ? listarHistorialAdmin(parametros)
    : Promise.resolve(null);

const nombreAdministrador = (a) => `${a.PrimerNombre} ${a.ApellidoPaterno}`;

export const estiloModulo = (modulo) => ESTILOS_MODULO[modulo] ?? ESTILOS_MODULO.Otros;

export function BadgeModulo({ modulo }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-bold ring-1",
        estiloModulo(modulo).badge,
      )}
    >
      {modulo}
    </span>
  );
}

function CeldaAdministrador({ a }) {
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-slate-900">{nombreAdministrador(a)}</span>
      <span className="text-slate-500">
        CI {a.Ci} · {a.NombreRol}
      </span>
    </div>
  );
}

const COLUMNAS = [
  {
    titulo: "Fecha",
    clase: "text-[12.5px] whitespace-nowrap",
    valor: (a) => dateFormatter(a.FechaMovimiento),
  },
  { titulo: "Módulo", valor: (a) => <BadgeModulo modulo={a.Modulo} /> },
  {
    titulo: "Acción",
    clase: "whitespace-normal wrap-anywhere font-semibold text-slate-900",
    valor: (a) => a.Accion,
  },
  {
    titulo: "Detalle",
    clase: "w-2/5 whitespace-normal wrap-anywhere text-[12.5px] text-slate-600",
    valor: (a) => a.Detalle ?? "-",
  },
  {
    titulo: "Administrador",
    clase: "whitespace-normal wrap-anywhere text-[12.5px]",
    valor: (a) => <CeldaAdministrador a={a} />,
  },
];

function TarjetaResumen({ icono: Icono, etiqueta, valor, clase }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", clase)}>
        <Icono size={19} />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-extrabold tabular-nums text-slate-900">{valor}</div>
        <div className="text-[12.5px] font-semibold text-slate-500">{etiqueta}</div>
      </div>
    </div>
  );
}

function ResumenAcciones({ resumen }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {resumen.Modulos.map((m) => (
        <TarjetaResumen
          key={m.Modulo}
          icono={estiloModulo(m.Modulo).icono}
          etiqueta={m.Modulo}
          valor={m.Cantidad}
          clase={estiloModulo(m.Modulo).tarjeta}
        />
      ))}
      <TarjetaResumen
        icono={UserShield}
        etiqueta="Administradores"
        valor={resumen.AdministradoresDistintos}
        clase="bg-c4/10 text-c3"
      />
    </div>
  );
}

function AdministradorConsultado({ consulta }) {
  if (!consulta) return null;

  const datos = consulta.Usuario;

  return (
    <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">CI {consulta.Ci}</span>
        <span className={cn("text-base font-extrabold", datos ? "text-slate-900" : "text-red-700")}>
          {datos ? datos.NombreCompleto : "CI no registrado en el sistema"}
        </span>
        {datos && (
          <span className="text-[12.5px] text-slate-500">
            {datos.NombreRol} · {datos.NombreEstadoUsuario}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-slate-600">
        <Dato etiqueta="Acciones">{consulta.Resumen.Total}</Dato>
        <Dato etiqueta="Última acción">
          {consulta.UltimaAccion ? dateFormatter(consulta.UltimaAccion) : "-"}
        </Dato>
      </div>
    </section>
  );
}

function BuscadorCi({ reporte }) {
  return (
    <CampoFiltro etiqueta="CI del administrador">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
        />
        <Input
          value={reporte.textos.Ci}
          inputMode="numeric"
          maxLength={LONGITUD_MAXIMA_CI}
          onChange={(e) => reporte.escribir("Ci", e.target.value.replace(/\D/g, ""))}
          placeholder="Número de CI"
          className="h-11 pl-9 font-mono"
        />
      </div>
    </CampoFiltro>
  );
}

function FiltroModulo({ reporte }) {
  return (
    <CampoFiltro etiqueta="Módulo">
      <ToggleGroup value={[reporte.filtros.Modulo]} className="flex flex-wrap justify-start gap-2">
        {MODULOS.map((opcion) => (
          <ToggleGroupItem
            key={opcion.valor || "todos"}
            value={opcion.valor}
            onClick={() => reporte.cambiar("Modulo", opcion.valor)}
            className={PILDORA_FILTRO}
          >
            {opcion.texto}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </CampoFiltro>
  );
}

function useAdministradorConsultado(parametros) {
  const [consulta, setConsulta] = useState(null);
  const { Ci, FechaInicio, FechaFin, Modulo, Busqueda } = parametros;

  useEffect(() => {
    if (!Ci || Ci.length < LONGITUD_MINIMA_CI || !FechaInicio || !FechaFin) {
      setConsulta(null);
      return;
    }

    let vigente = true;
    verResumenUsuarioHistorialAdmin(parametros)
      .then((data) => vigente && setConsulta(data))
      .catch(() => vigente && setConsulta(null));

    return () => {
      vigente = false;
    };
  }, [Ci, FechaInicio, FechaFin, Modulo, Busqueda]);

  return consulta;
}

export default function Acciones() {
  const reporte = useReporte(consultarAcciones, FILTROS_INICIALES, ["Ci", "Busqueda"]);
  const { filtros, catalogo, cargando, error } = reporte;
  const { Rango } = filtros;

  const rangoCompleto = Boolean(Rango?.from && Rango?.to);
  const atajo = atajoActivo(Rango);
  const parametros = {
    FechaInicio: aFechaISO(Rango?.from),
    FechaFin: aFechaISO(Rango?.to),
    Modulo: filtros.Modulo,
    Ci: filtros.Ci,
    Busqueda: filtros.Busqueda,
  };
  const hayAcciones = Boolean(catalogo?.Total);
  const consulta = useAdministradorConsultado(parametros);

  return (
    <TooltipProvider>
      <Toaster richColors position="top-center" />
      <div className="contenido-con-sidebar flex min-h-screen flex-col bg-slate-50 pt-20 font-sans text-slate-900 md:pt-0">
        <Header
          volver="/admin/inicio"
          titulo="Administración"
          subtitulo="Acciones de administrador"
          contador={catalogo ? { valor: catalogo.Total, singular: "acción", plural: "acciones" } : null}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
          <TarjetaFiltros
            reporte={{
              ...reporte,
              hayFiltros:
                atajo !== "hoy" ||
                Boolean(filtros.Modulo) ||
                Boolean(reporte.textos.Ci) ||
                Boolean(reporte.textos.Busqueda),
            }}
            informe={
              <BotonInforme
                disponible={rangoCompleto && hayAcciones}
                ayuda="PDF con el resumen por módulo y el detalle de acciones del período y los filtros elegidos"
                ayudaNoDisponible={
                  rangoCompleto ? "No hay acciones en el período y los filtros elegidos" : undefined
                }
                exito="Reporte de acciones de administrador descargado"
                descargar={() => descargarReporteHistorialAdmin(parametros)}
              />
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DoubleDatePicker
                id="rango-acciones"
                label="Fecha de la acción"
                value={Rango}
                onChange={(valor) => reporte.cambiar("Rango", valor)}
              />
              <CampoFiltro etiqueta="Atajos">
                <ToggleGroup value={atajo ? [atajo] : []} className="flex flex-wrap justify-start gap-2">
                  {ATAJOS.map((a) => (
                    <ToggleGroupItem
                      key={a.valor}
                      value={a.valor}
                      onClick={() => reporte.cambiar("Rango", a.rango(new Date()))}
                      className={PILDORA_FILTRO}
                    >
                      {a.texto}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </CampoFiltro>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <BuscadorCi reporte={reporte} />
              <BuscadorFiltro
                reporte={reporte}
                campo="Busqueda"
                etiqueta="Buscar en la acción"
                placeholder="Nombre, CI afectado, motivo…"
                mono={false}
              />
            </div>

            <FiltroModulo reporte={reporte} />
          </TarjetaFiltros>

          {catalogo && <ResumenAcciones resumen={catalogo.Resumen} />}

          <AdministradorConsultado consulta={consulta} />

          {!cargando && !error && !catalogo ? (
            <section className="mt-6 rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-200">
              Elegí una fecha de inicio y una de fin para ver las acciones.
            </section>
          ) : (
            <ResultadosReporte
              reporte={reporte}
              elementos={catalogo?.Acciones}
              clave={(a) => a.IdHistorialAdmin}
              nombres={["acción", "acciones"]}
              columnas={COLUMNAS}
              tarjeta={(a) => (
                <TarjetaReporte
                  titulo={a.Accion}
                  tamanoTitulo="text-[14px] font-sans"
                  subtitulo={dateFormatter(a.FechaMovimiento)}
                >
                  <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-slate-600">
                    <BadgeModulo modulo={a.Modulo} />
                    {a.Detalle && <span>{a.Detalle}</span>}
                  </div>
                  <PieTarjeta>
                    <Dato etiqueta="Por">{nombreAdministrador(a)}</Dato>
                    <Dato etiqueta="CI">{a.Ci}</Dato>
                  </PieTarjeta>
                </TarjetaReporte>
              )}
            />
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}
