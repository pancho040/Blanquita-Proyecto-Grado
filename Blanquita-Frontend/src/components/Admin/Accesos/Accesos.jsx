import { useEffect, useState } from "react";
import { FileUser, LogIn, LogOut, Search, ShieldAlert, Users } from "lucide-react";
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
  BotonInforme,
  BotonDescargaFila,
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
  listarRegistroIngreso,
  verResumenUsuarioRegistroIngreso,
  descargarReporteRegistroIngreso,
  descargarReporteUsuarioRegistroIngreso,
} from "@/services/Usuario/RegistroIngreso";

const LONGITUD_MINIMA_CI = 6;
const LONGITUD_MAXIMA_CI = 20;

const REGISTROS = [
  { valor: "", texto: "Todos" },
  { valor: "Ingreso", texto: "Ingresos" },
  { valor: "Salida", texto: "Salidas" },
  { valor: "Intento fallido", texto: "Intentos fallidos" },
];

const ESTILOS_REGISTRO = {
  Ingreso: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Salida: "bg-slate-100 text-slate-700 ring-slate-200",
  "Intento fallido": "bg-red-50 text-red-700 ring-red-200",
};

const FILTROS_INICIALES = {
  Rango: ATAJOS[0].rango(new Date()),
  Registro: "",
  Ci: "",
};

const consultarRegistros = (parametros) =>
  parametros.FechaInicio && parametros.FechaFin
    ? listarRegistroIngreso(parametros)
    : Promise.resolve(null);

const nombreUsuario = (r) =>
  r.IdUsuario ? [r.PrimerNombre, r.ApellidoPaterno].filter(Boolean).join(" ") : "CI no registrado";

const textoFecha = (fecha) => (fecha ? dateFormatter(fecha) : "-");

function BadgeRegistro({ registro }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-bold ring-1",
        ESTILOS_REGISTRO[registro],
      )}
    >
      {registro}
    </span>
  );
}

function CeldaUsuario({ r }) {
  return (
    <div className="flex flex-col">
      <span className={cn("font-semibold", r.IdUsuario ? "text-slate-900" : "text-red-700")}>
        {nombreUsuario(r)}
      </span>
      <span className="text-slate-500">
        CI {r.Ci ?? "-"}
        {r.NombreRol ? ` · ${r.NombreRol}` : ""}
      </span>
    </div>
  );
}

function CeldaEquipo({ r }) {
  return (
    <div className="flex flex-col" title={r.UserAgent ?? undefined}>
      <span className="font-mono text-slate-700">{r.DireccionIp ?? "-"}</span>
      <span className="text-slate-500">{r.Dispositivo}</span>
    </div>
  );
}

const COLUMNAS = [
  { titulo: "Fecha", clase: "text-[12.5px] whitespace-nowrap", valor: (r) => dateFormatter(r.FechaRegistro) },
  { titulo: "Registro", valor: (r) => <BadgeRegistro registro={r.Registro} /> },
  { titulo: "Usuario", clase: "text-[12.5px]", valor: (r) => <CeldaUsuario r={r} /> },
  { titulo: "Detalle", clase: "text-[12.5px] text-slate-600", valor: (r) => r.Detalle ?? "-" },
  { titulo: "IP / Dispositivo", clase: "text-[12.5px]", valor: (r) => <CeldaEquipo r={r} /> },
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

function ResumenAccesos({ resumen }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <TarjetaResumen icono={LogIn} etiqueta="Ingresos" valor={resumen.Ingresos} clase="bg-emerald-50 text-emerald-700" />
      <TarjetaResumen icono={LogOut} etiqueta="Salidas" valor={resumen.Salidas} clase="bg-slate-100 text-slate-700" />
      <TarjetaResumen
        icono={ShieldAlert}
        etiqueta="Intentos fallidos"
        valor={resumen.IntentosFallidos}
        clase="bg-red-50 text-red-700"
      />
      <TarjetaResumen icono={Users} etiqueta="CI distintos" valor={resumen.CisDistintos} clase="bg-c4/10 text-c3" />
    </div>
  );
}

function UsuarioConsultado({ usuario }) {
  if (!usuario) return null;

  const datos = usuario.Usuario;

  return (
    <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">CI {usuario.Ci}</span>
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
        <Dato etiqueta="Último ingreso">{textoFecha(usuario.UltimoIngreso)}</Dato>
        <Dato etiqueta="Último intento fallido">{textoFecha(usuario.UltimoIntentoFallido)}</Dato>
      </div>
    </section>
  );
}

function BuscadorCi({ reporte }) {
  return (
    <CampoFiltro etiqueta="CI">
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

function FiltroRegistro({ reporte }) {
  return (
    <CampoFiltro etiqueta="Registro">
      <ToggleGroup value={[reporte.filtros.Registro]} className="flex flex-wrap justify-start gap-2">
        {REGISTROS.map((opcion) => (
          <ToggleGroupItem
            key={opcion.valor || "todos"}
            value={opcion.valor}
            onClick={() => reporte.cambiar("Registro", opcion.valor)}
            className={PILDORA_FILTRO}
          >
            {opcion.texto}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </CampoFiltro>
  );
}

function useUsuarioConsultado(parametros) {
  const [usuario, setUsuario] = useState(null);
  const { Ci, FechaInicio, FechaFin, Registro } = parametros;

  useEffect(() => {
    if (!Ci || Ci.length < LONGITUD_MINIMA_CI || !FechaInicio || !FechaFin) {
      setUsuario(null);
      return;
    }

    let vigente = true;
    verResumenUsuarioRegistroIngreso(parametros)
      .then((data) => vigente && setUsuario(data))
      .catch(() => vigente && setUsuario(null));

    return () => {
      vigente = false;
    };
  }, [Ci, FechaInicio, FechaFin, Registro]);

  return usuario;
}

export default function Accesos() {
  const reporte = useReporte(consultarRegistros, FILTROS_INICIALES, ["Ci"]);
  const { filtros, catalogo, cargando, error } = reporte;
  const { Rango } = filtros;

  const rangoCompleto = Boolean(Rango?.from && Rango?.to);
  const atajo = atajoActivo(Rango);
  const parametros = {
    FechaInicio: aFechaISO(Rango?.from),
    FechaFin: aFechaISO(Rango?.to),
    Registro: filtros.Registro,
    Ci: filtros.Ci,
  };
  const hayRegistros = Boolean(catalogo?.Total);
  const usuario = useUsuarioConsultado(parametros);
  const ciCompleto = (filtros.Ci ?? "").length >= LONGITUD_MINIMA_CI;

  const reporteUsuario = (r) => (
    <div className="flex justify-end">
      {r.Ci && (
        <BotonDescargaFila
          icono={FileUser}
          ayuda={`Reporte de accesos del CI ${r.Ci} en el período`}
          descargar={() => descargarReporteUsuarioRegistroIngreso({ ...parametros, Ci: r.Ci })}
        />
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Toaster richColors position="top-center" />
      <div className="contenido-con-sidebar flex min-h-screen flex-col bg-slate-50 pt-20 font-sans text-slate-900 md:pt-0">
        <Header
          volver="/admin/inicio"
          titulo="Administración"
          subtitulo="Accesos al sistema"
          contador={catalogo ? { valor: catalogo.Total, singular: "registro", plural: "registros" } : null}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
          <TarjetaFiltros
            reporte={{
              ...reporte,
              hayFiltros: atajo !== "hoy" || Boolean(filtros.Registro) || Boolean(reporte.textos.Ci),
            }}
            informe={
              <>
                <BotonInforme
                  texto="Reporte del usuario"
                  disponible={rangoCompleto && ciCompleto && Boolean(usuario?.Registros.length)}
                  ayuda={`PDF con el historial de accesos del CI ${filtros.Ci} en el período`}
                  ayudaNoDisponible={
                    !rangoCompleto
                      ? undefined
                      : ciCompleto
                        ? "Ese CI no tiene accesos en el período y el registro elegidos"
                        : `Escribe un CI de al menos ${LONGITUD_MINIMA_CI} dígitos`
                  }
                  exito="Reporte de accesos del usuario descargado"
                  descargar={() => descargarReporteUsuarioRegistroIngreso(parametros)}
                />
                <BotonInforme
                  disponible={rangoCompleto && hayRegistros}
                  ayuda="PDF con el resumen y el detalle de accesos del período y los filtros elegidos"
                  ayudaNoDisponible={
                    rangoCompleto ? "No hay accesos en el período y los filtros elegidos" : undefined
                  }
                  exito="Reporte de accesos descargado"
                  descargar={() => descargarReporteRegistroIngreso(parametros)}
                />
              </>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DoubleDatePicker
                id="rango-accesos"
                label="Fecha del registro"
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
              <FiltroRegistro reporte={reporte} />
            </div>
          </TarjetaFiltros>

          {catalogo && <ResumenAccesos resumen={catalogo.Resumen} />}

          <UsuarioConsultado usuario={usuario} />

          {!cargando && !error && !catalogo ? (
            <section className="mt-6 rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-200">
              Elegí una fecha de inicio y una de fin para ver los accesos.
            </section>
          ) : (
            <ResultadosReporte
              reporte={reporte}
              elementos={catalogo?.Registros}
              clave={(r) => r.IdRegistroIngreso}
              nombres={["registro", "registros"]}
              columnas={COLUMNAS}
              accion={reporteUsuario}
              tarjeta={(r) => (
                <TarjetaReporte
                  titulo={nombreUsuario(r)}
                  tamanoTitulo="text-[14px] font-sans"
                  subtitulo={`CI ${r.Ci ?? "-"} · ${dateFormatter(r.FechaRegistro)}`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-slate-600">
                    <BadgeRegistro registro={r.Registro} />
                    {r.Detalle && <span>{r.Detalle}</span>}
                  </div>
                  <PieTarjeta accion={reporteUsuario(r)}>
                    <Dato etiqueta="IP">{r.DireccionIp ?? "-"}</Dato>
                    <Dato etiqueta="Equipo">{r.Dispositivo}</Dato>
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
