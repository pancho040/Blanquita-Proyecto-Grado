import { useState } from "react";
import { startOfMonth, startOfWeek, subMonths } from "date-fns";
import { FileText, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import DoubleDatePicker from "@/components/layout/dates/DoubleDatePicker";
import { BadgeInactivo } from "@/components/Inventario/comunes";
import { PaginaReporte } from "@/components/Reportes/PaginaReporte";
import { TarjetaFiltros, CampoFiltro, FiltroTipos, DERECHA, contar } from "@/components/Reportes/comunes";
import {
  TarjetaSeccion,
  EsqueletoCarga,
  ErrorCarga,
  TablaFilas,
  TarjetaFila,
} from "@/components/Reportes/Producto/comunes";
import {
  ESTADO_CONTEO,
  BadgeEstadoConteo,
  BotonActa,
  fechaHora,
  textoDiferencia,
  claseDiferencia,
} from "@/components/ConteoFisico/comunes";
import { useReporte } from "@/hooks/useReporte";
import { useDescarga } from "@/hooks/useDescarga";
import { useDiasDestacados } from "@/hooks/useDiasDestacados";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { aFechaISO } from "@/utils/dates";
import { listarConteos, verConteo, descargarReporteConteos } from "@/services/Inventario/Conteo";

const ATAJOS = [
  { valor: "hoy", texto: "Hoy", rango: (hoy) => ({ from: hoy, to: hoy }) },
  {
    valor: "semana",
    texto: "Esta semana",
    rango: (hoy) => ({ from: startOfWeek(hoy, { weekStartsOn: 1 }), to: hoy }),
  },
  { valor: "mes", texto: "Este mes", rango: (hoy) => ({ from: startOfMonth(hoy), to: hoy }) },
  {
    valor: "trimestre",
    texto: "Últimos 3 meses",
    rango: (hoy) => ({ from: startOfMonth(subMonths(hoy, 2)), to: hoy }),
  },
];

const ESTADO_FILTRO = {
  cargar: () =>
    Promise.resolve(Object.values(ESTADO_CONTEO).map((estado) => ({ Estado: estado }))),
  campo: "Estados",
  campoValor: "Estado",
  campoEtiqueta: "Estado",
  etiqueta: "Estado del conteo",
};

const mismoRango = (rango, otro) =>
  aFechaISO(rango?.from) === aFechaISO(otro.from) && aFechaISO(rango?.to) === aFechaISO(otro.to);

const consultarConteos = ({ FechaInicio, FechaFin, Estados }) =>
  FechaInicio && FechaFin ? listarConteos(FechaInicio, FechaFin, Estados) : Promise.resolve(null);

const COLUMNAS_DETALLE = [
  { titulo: "Código", clase: "font-mono font-bold text-c3", valor: (d) => d.CodigoPresentacion },
  {
    titulo: "Producto",
    clase: "font-bold text-slate-900",
    valor: (d) => (
      <span className="flex items-center gap-2">
        {d.NombrePresentacion}
        {!d.Activo && <BadgeInactivo />}
      </span>
    ),
  },
  { titulo: "Sistema", ...DERECHA, valor: (d) => d.CantidadSistema },
  { titulo: "Físico", ...DERECHA, valor: (d) => d.CantidadFisica ?? "-" },
  {
    titulo: "Diferencia",
    ...DERECHA,
    valor: (d) => (
      <span className={cn("rounded-full px-2 py-0.5 font-extrabold", claseDiferencia(d.Diferencia))}>
        {textoDiferencia(d.Diferencia)}
      </span>
    ),
  },
  { titulo: "Motivo", valor: (d) => d.MotivoDiferencia ?? "-" },
];

function tarjetaDetalle(d) {
  return (
    <TarjetaFila
      nombre={`${d.CodigoPresentacion} · ${d.NombrePresentacion}`}
      detalle={`Sistema ${d.CantidadSistema} · Físico ${d.CantidadFisica ?? "-"}${d.MotivoDiferencia ? ` · ${d.MotivoDiferencia}` : ""}`}
    >
      <span className={cn("rounded-full px-2 py-0.5 font-extrabold", claseDiferencia(d.Diferencia))}>
        {textoDiferencia(d.Diferencia)}
      </span>
    </TarjetaFila>
  );
}

function BotonReporte({ disponible, descargar }) {
  const { descargando, iniciar } = useDescarga(descargar, "Reporte de conteos descargado");

  return (
    <Button
      onClick={iniciar}
      disabled={!disponible || descargando}
      className="h-9 gap-1.5 bg-gradient-to-r from-c3 to-c4 font-bold text-white hover:opacity-90"
    >
      {descargando ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} strokeWidth={2.5} />}
      PDF
    </Button>
  );
}

function Dato({ etiqueta, children }) {
  return (
    <span>
      <strong className="text-slate-500">{etiqueta}:</strong> {children}
    </span>
  );
}

function TarjetaConteo({ conteo }) {
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [soloDiferencias, setSoloDiferencias] = useState(true);
  const anulado = conteo.Estado === ESTADO_CONTEO.Anulado;

  const cargarDetalle = async () => {
    setCargando(true);
    setError("");
    try {
      setDetalle(await verConteo(conteo.IdConteoProductoTerminado));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  const alternar = () => {
    if (!abierto && !detalle) cargarDetalle();
    setAbierto((valor) => !valor);
  };

  const filas = detalle
    ? soloDiferencias
      ? detalle.Detalle.filter((d) => d.Diferencia)
      : detalle.Detalle
    : [];

  return (
    <TarjetaSeccion
      titulo={
        <span className="flex items-center gap-2">
          Conteo N° {conteo.IdConteoProductoTerminado}
          <BadgeEstadoConteo estado={conteo.Estado} />
        </span>
      }
      extra={
        <div className="flex flex-wrap items-center gap-2">
          {conteo.Estado !== ESTADO_CONTEO.Abierto && (
            <BotonActa idConteo={conteo.IdConteoProductoTerminado} />
          )}
          <Button variant="outline" onClick={alternar} className="h-10 gap-1.5 font-bold text-slate-700">
            Detalle
            <ChevronDown size={15} className={cn("transition-transform", abierto && "rotate-180")} />
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-3 text-[12.5px] text-slate-600">
        <Dato etiqueta="Inicio">
          {fechaHora(conteo.FechaHoraInicio)} · {conteo.UsuarioInicio}
        </Dato>
        <Dato etiqueta={anulado ? "Anulado" : "Cierre"}>
          {conteo.FechaHoraCierre
            ? `${fechaHora(conteo.FechaHoraCierre)} · ${conteo.UsuarioCierre}`
            : "En curso"}
        </Dato>
        <Dato etiqueta="Motivo">{anulado ? conteo.MotivoAnulacion : conteo.MotivoInicio}</Dato>
        <Dato etiqueta="Contadas">
          {conteo.Contadas} de {conteo.TotalPresentaciones}
        </Dato>
        {!anulado && (
          <Dato etiqueta="Diferencias">
            {conteo.ConDiferencia} · <span className="font-bold text-red-600">−{conteo.Faltante}</span>{" "}
            <span className="font-bold text-sky-600">+{conteo.Sobrante}</span>
          </Dato>
        )}
      </div>

      {abierto && (
        <div className="border-t border-slate-100">
          {cargando && <EsqueletoCarga />}
          {error && <ErrorCarga error={error} recargar={cargarDetalle} />}
          {detalle && (
            <>
              <div className="flex justify-end px-5 pt-3">
                <ToggleGroup value={[soloDiferencias ? "diferencias" : "todas"]} className="flex gap-2">
                  <ToggleGroupItem
                    value="diferencias"
                    onClick={() => setSoloDiferencias(true)}
                    className={PILDORA_FILTRO}
                  >
                    Solo diferencias
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="todas"
                    onClick={() => setSoloDiferencias(false)}
                    className={PILDORA_FILTRO}
                  >
                    Todas
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              {filas.length ? (
                <TablaFilas
                  columnas={COLUMNAS_DETALLE}
                  filas={filas}
                  clave={(d) => d.IdPresentacion}
                  tarjeta={tarjetaDetalle}
                />
              ) : (
                <div className="p-8 text-center text-sm text-slate-400">
                  No hubo diferencias en este conteo.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </TarjetaSeccion>
  );
}

function ResultadosConteos({ reporte }) {
  const { catalogo: conteos, cargando, error, recargar } = reporte;

  if (cargando || error) {
    return (
      <TarjetaSeccion titulo="Conteos" className="mt-6">
        {cargando ? <EsqueletoCarga /> : <ErrorCarga error={error} recargar={recargar} />}
      </TarjetaSeccion>
    );
  }

  if (!conteos || conteos.length === 0) {
    return (
      <TarjetaSeccion titulo="Conteos" className="mt-6">
        <div className="p-10 text-center text-sm text-slate-400">
          {conteos
            ? "No hay conteos físicos en el período y los estados elegidos."
            : "Elegí una fecha de inicio y una de fin para ver los conteos."}
        </div>
      </TarjetaSeccion>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {conteos.map((conteo) => (
        <TarjetaConteo key={conteo.IdConteoProductoTerminado} conteo={conteo} />
      ))}
    </div>
  );
}

export default function ConteosReporteProducto({ usuario, contenedor }) {
  const reporte = useReporte(consultarConteos, {
    Rango: ATAJOS[2].rango(new Date()),
    Estados: [],
  });
  const { filtros, catalogo: conteos } = reporte;
  const { Rango, Estados } = filtros;
  const destacados = useDiasDestacados(
    (FechaInicio, FechaFin) => listarConteos(FechaInicio, FechaFin),
    (conteo) => ({
      fecha: conteo.FechaHoraInicio,
      texto: `Conteo N° ${conteo.IdConteoProductoTerminado} · ${conteo.Estado}`,
    }),
  );

  const hoy = new Date();
  const atajoActivo = ATAJOS.find((atajo) => mismoRango(Rango, atajo.rango(hoy)))?.valor;
  const hayConteos = Boolean(Rango?.from && Rango?.to && conteos?.length);

  const Contenedor = contenedor ?? PaginaReporte;

  return (
    <Contenedor
      usuario={usuario}
      titulo="Reportes · Productos"
      subtitulo="Conteos físicos"
      contador={conteos ? contar(conteos.length, "conteo", "conteos") : null}
    >
      <TarjetaFiltros
        reporte={{ ...reporte, hayFiltros: atajoActivo !== "mes" || Estados.length > 0 }}
        informe={
          <BotonReporte
            disponible={hayConteos}
            descargar={() =>
              descargarReporteConteos({
                FechaInicio: aFechaISO(Rango.from),
                FechaFin: aFechaISO(Rango.to),
                Estados: Estados.length ? Estados : null,
              })
            }
          />
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DoubleDatePicker
            id="rango-conteos-producto"
            label="Fecha de inicio del conteo"
            value={Rango}
            onChange={(valor) => reporte.cambiar("Rango", valor)}
            diasDestacados={destacados.dias}
            onRangoVisibleChange={destacados.cargar}
          />
          <CampoFiltro etiqueta="Atajos">
            <ToggleGroup
              value={atajoActivo ? [atajoActivo] : []}
              className="flex flex-wrap justify-start gap-2"
            >
              {ATAJOS.map((atajo) => (
                <ToggleGroupItem
                  key={atajo.valor}
                  value={atajo.valor}
                  onClick={() => reporte.cambiar("Rango", atajo.rango(new Date()))}
                  className={PILDORA_FILTRO}
                >
                  {atajo.texto}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CampoFiltro>
        </div>

        <FiltroTipos reporte={reporte} tipo={ESTADO_FILTRO} />
      </TarjetaFiltros>

      <ResultadosConteos reporte={reporte} />
    </Contenedor>
  );
}
