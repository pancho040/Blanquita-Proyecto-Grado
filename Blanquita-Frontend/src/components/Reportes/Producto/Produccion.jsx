import { useState } from "react";
import { endOfMonth, startOfMonth, startOfWeek, subDays, subMonths } from "date-fns";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import DoubleDatePicker from "@/components/layout/dates/DoubleDatePicker";
import { PaginaReporte } from "@/components/Reportes/PaginaReporte";
import {
  TarjetaFiltros,
  BotonInforme,
  CampoFiltro,
  FiltroTipos,
  DERECHA,
  contar,
} from "@/components/Reportes/comunes";
import { useReporte } from "@/hooks/useReporte";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { aFechaISO } from "@/utils/dates";
import { formatearNumero } from "@/utils/numeros";
import {
  verResumenProduccionDiaria,
  descargarReporteProduccionDiaria,
} from "@/services/Inventario/Reportes";
import { LINEA_PRODUCTO } from "./filtros";
import { SeccionResumenLineas, TarjetaFila, CantidadUnidad } from "./comunes";

const ATAJOS = [
  { valor: "hoy", texto: "Hoy", rango: (hoy) => ({ from: hoy, to: hoy }) },
  {
    valor: "ayer",
    texto: "Ayer",
    rango: (hoy) => {
      const ayer = subDays(hoy, 1);
      return { from: ayer, to: ayer };
    },
  },
  {
    valor: "semana",
    texto: "Esta semana",
    rango: (hoy) => ({ from: startOfWeek(hoy, { weekStartsOn: 1 }), to: hoy }),
  },
  { valor: "mes", texto: "Este mes", rango: (hoy) => ({ from: startOfMonth(hoy), to: hoy }) },
  {
    valor: "mes-anterior",
    texto: "Mes anterior",
    rango: (hoy) => {
      const mes = subMonths(hoy, 1);
      return { from: startOfMonth(mes), to: endOfMonth(mes) };
    },
  },
];

const mismoRango = (rango, otro) =>
  aFechaISO(rango?.from) === aFechaISO(otro.from) && aFechaISO(rango?.to) === aFechaISO(otro.to);

const consultarResumen = (parametros) =>
  parametros.FechaInicio && parametros.FechaFin
    ? verResumenProduccionDiaria(parametros)
    : Promise.resolve(null);

function TotalLinea({ linea }) {
  if (!linea.NumeroRegistros) {
    return <span className="text-slate-400">Sin producción</span>;
  }

  return <CantidadUnidad valor={linea.Total} unidad={linea.Unidad} />;
}

const COLUMNAS = [
  { titulo: "Línea", clase: "font-bold text-slate-900", valor: (l) => l.NombreProducto },
  { titulo: "Total", ...DERECHA, valor: (l) => <TotalLinea linea={l} /> },
  { titulo: "Días con producción", ...DERECHA, valor: (l) => l.DiasConProduccion },
  {
    titulo: "Promedio por día",
    ...DERECHA,
    valor: (l) => formatearNumero(l.PromedioPorDia, { vacio: "-" }),
  },
  { titulo: "Registros", ...DERECHA, valor: (l) => l.NumeroRegistros },
];

function tarjetaProduccion(linea) {
  const conProduccion = linea.NumeroRegistros > 0;

  return (
    <TarjetaFila
      nombre={linea.NombreProducto}
      detalle={
        conProduccion
          ? `${contar(linea.DiasConProduccion, "día", "días")} · ${formatearNumero(linea.PromedioPorDia, { vacio: "-" })} por día · ${contar(linea.NumeroRegistros, "registro", "registros")}`
          : "Sin producción"
      }
    >
      {conProduccion && <CantidadUnidad valor={linea.Total} unidad={linea.Unidad} />}
    </TarjetaFila>
  );
}

export default function ProduccionReporteProducto({ usuario, contenedor: Contenedor = PaginaReporte }) {
  const reporte = useReporte(consultarResumen, {
    Rango: ATAJOS[0].rango(new Date()),
    [LINEA_PRODUCTO.campo]: [],
  });
  const { filtros, catalogo: resumen } = reporte;
  const { Rango } = filtros;
  const lineas = filtros[LINEA_PRODUCTO.campo];

  const [verMovimientos, setVerMovimientos] = useState(false);

  const rangoCompleto = Boolean(Rango?.from && Rango?.to);
  const hayProduccion = Boolean(resumen?.Lineas.some((linea) => linea.NumeroRegistros > 0));
  const hoy = new Date();
  const atajoActivo = ATAJOS.find((atajo) => mismoRango(Rango, atajo.rango(hoy)))?.valor;

  return (
    <Contenedor
      usuario={usuario}
      titulo="Reportes · Productos"
      subtitulo="Producción diaria"
      contador={
        resumen
          ? {
              valor: resumen.DiasConProduccion,
              singular: "día con producción",
              plural: "días con producción",
            }
          : null
      }
    >
      <TarjetaFiltros
        reporte={{ ...reporte, hayFiltros: atajoActivo !== "hoy" || lineas.length > 0 }}
        informe={
          <BotonInforme
            disponible={rangoCompleto && hayProduccion}
            ayuda="PDF con el resumen por línea, la producción por día y el detalle por presentación del período elegido"
            ayudaNoDisponible={
              rangoCompleto
                ? "No hay producción registrada en el período y las líneas elegidas"
                : undefined
            }
            exito="Informe de producción descargado"
            descargar={() =>
              descargarReporteProduccionDiaria(
                aFechaISO(Rango.from),
                aFechaISO(Rango.to),
                lineas,
                verMovimientos,
              )
            }
          />
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DoubleDatePicker
            id="rango-produccion-producto"
            label="Fecha de producción"
            value={Rango}
            onChange={(valor) => reporte.cambiar("Rango", valor)}
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

        <FiltroTipos reporte={reporte} tipo={LINEA_PRODUCTO} />

        <CampoFiltro etiqueta="Informe PDF">
          <label className="flex w-fit cursor-pointer items-center gap-2 text-[12.5px] font-bold text-slate-600">
            <input
              type="checkbox"
              checked={verMovimientos}
              onChange={(e) => setVerMovimientos(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-c3"
            />
            Incluir el detalle de movimientos
          </label>
        </CampoFiltro>
      </TarjetaFiltros>

      <SeccionResumenLineas
        reporte={reporte}
        titulo="Producción del período"
        columnas={COLUMNAS}
        tarjeta={tarjetaProduccion}
        pie={
          resumen &&
          `Días con producción: ${resumen.DiasConProduccion} de ${resumen.DiasPeriodo}`
        }
        mensajeVacio="Elegí una fecha de inicio y una de fin para ver la producción."
      />
    </Contenedor>
  );
}
