import { PaginaReporte } from "@/components/Reportes/PaginaReporte";
import { TarjetaFiltros, BotonInforme, DERECHA, contar } from "@/components/Reportes/comunes";
import {
  TarjetaSeccion,
  EsqueletoCarga,
  ErrorCarga,
  TablaFilas,
  TarjetaFila,
} from "@/components/Reportes/Producto/comunes";
import { useReporte } from "@/hooks/useReporte";
import { dateFormatter } from "@/utils/dates";
import { formatearNumero } from "@/utils/numeros";
import {
  verResumenMovimientosEmpaque,
  descargarReporteMovimientosEmpaque,
} from "@/services/Empaque/Reporte";
import { ID_TIPO_MOVIMIENTO_INGRESO, ID_TIPO_MOVIMIENTO_REINGRESO, claseEmpaque } from "./filtros";
import {
  FiltrosEmpaque,
  filtrosIniciales,
  hayFiltrosEmpaque,
  parametrosDescarga,
  rangoCompleto,
} from "./comunes";

const consultarResumen = (parametros) =>
  parametros.FechaInicio && parametros.FechaFin
    ? verResumenMovimientosEmpaque(parametros.Clase, parametros)
    : Promise.resolve(null);

const entero = (valor) => formatearNumero(valor, { decimales: 0 });

const esIngreso = (m) =>
  [ID_TIPO_MOVIMIENTO_INGRESO, ID_TIPO_MOVIMIENTO_REINGRESO].includes(m.IdTipoMovimiento);

const textoCantidad = (m) => `${esIngreso(m) ? "+" : "-"}${entero(m.Cantidad)}`;

const textoUsuario = (m) => `${m.PrimerNombre} ${m.ApellidoPaterno}`;

const textoLote = (m) => (m.IdLoteEmpaque ? `Lote #${m.IdLoteEmpaque} · ${m.NombreProveedor ?? "-"}` : "-");

const columnasResumen = (unidad) => [
  { titulo: "Tipo", clase: "font-bold text-slate-900", valor: (r) => r.NombreTipo },
  { titulo: "Ingresos", ...DERECHA, valor: (r) => entero(r.Ingresos) },
  { titulo: "Salidas", ...DERECHA, valor: (r) => entero(r.Salidas) },
  { titulo: "Neto", ...DERECHA, valor: (r) => entero(r.Neto) },
  { titulo: "Movimientos", ...DERECHA, valor: (r) => r.NumeroMovimientos },
  { titulo: `${unidad} en almacén`, ...DERECHA, valor: (r) => entero(r.CantidadActual) },
];

const columnasMovimientos = (esBobina) => [
  { titulo: "Fecha", clase: "text-[12.5px]", valor: (m) => dateFormatter(m.FechaMovimiento) },
  { titulo: "Tipo", clase: "font-bold text-slate-900", valor: (m) => m.NombreTipo },
  { titulo: "Movimiento", valor: (m) => m.NombreMovimiento },
  ...(esBobina
    ? [
        { titulo: "Código", clase: "font-mono text-[12.5px]", valor: (m) => m.CodigoEmpaque },
        {
          titulo: "Peso (kg)",
          ...DERECHA,
          valor: (m) => formatearNumero(m.PesoKg, { vacio: "-" }),
        },
      ]
    : [
        {
          titulo: "Cantidad",
          ...DERECHA,
          valor: (m) => (
            <span className={esIngreso(m) ? "font-bold text-emerald-700" : "font-bold text-red-700"}>
              {textoCantidad(m)}
            </span>
          ),
        },
      ]),
  { titulo: "Lote", clase: "text-[12.5px]", valor: textoLote },
  {
    titulo: "Usuario",
    clase: "text-[12.5px]",
    valor: (m) => (
      <div className="flex flex-col">
        <span className="font-semibold text-slate-900">{textoUsuario(m)}</span>
        <span className="text-slate-500">
          CI {m.Ci} · {m.NombreRol}
        </span>
      </div>
    ),
  },
  { titulo: "Observación", clase: "text-[12.5px] text-slate-600", valor: (m) => m.Observacion ?? "-" },
];

const tarjetaResumen = (unidad) => (r) => (
  <TarjetaFila
    nombre={r.NombreTipo}
    detalle={`+${entero(r.Ingresos)} ingresos · -${entero(r.Salidas)} salidas · ${contar(r.NumeroMovimientos, "movimiento", "movimientos")}`}
  >
    <strong className="text-slate-900">{entero(r.CantidadActual)}</strong>{" "}
    <span className="text-slate-500">{unidad}</span>
  </TarjetaFila>
);

const tarjetaMovimiento = (esBobina) => (m) => (
  <TarjetaFila
    nombre={`${m.NombreTipo} · ${m.NombreMovimiento}${esBobina ? ` · ${m.CodigoEmpaque}` : ""}`}
    detalle={`${dateFormatter(m.FechaMovimiento)} · ${textoUsuario(m)} · ${textoLote(m)} · ${m.Observacion ?? "-"}`}
  >
    <strong className={esIngreso(m) ? "text-emerald-700" : "text-red-700"}>
      {textoCantidad(m)}
    </strong>
  </TarjetaFila>
);

function ResultadosMovimientos({ reporte }) {
  const { catalogo: resumen, cargando, error, recargar } = reporte;

  if (cargando || error) {
    return (
      <TarjetaSeccion titulo="Resumen por tipo" className="mt-6">
        {cargando ? <EsqueletoCarga /> : <ErrorCarga error={error} recargar={recargar} />}
      </TarjetaSeccion>
    );
  }

  if (!resumen) {
    return (
      <TarjetaSeccion titulo="Resumen por tipo" className="mt-6">
        <div className="p-10 text-center text-sm text-slate-400">
          Elegí una fecha de inicio y una de fin para ver los movimientos.
        </div>
      </TarjetaSeccion>
    );
  }

  const esBobina = resumen.Clase === "bobina";
  const unidad = resumen.Unidad;

  return (
    <div className="mt-6 flex flex-col gap-4">
      <TarjetaSeccion titulo={`Resumen por tipo · ${resumen.NombreClase}`}>
        <TablaFilas
          columnas={columnasResumen(unidad.charAt(0).toUpperCase() + unidad.slice(1))}
          filas={resumen.Resumen}
          clave={(r) => r.IdTipo}
          tarjeta={tarjetaResumen(unidad)}
        />
      </TarjetaSeccion>

      <TarjetaSeccion
        titulo="Detalle de movimientos"
        extra={
          <span className="text-[12.5px] font-semibold text-slate-500">
            {contar(resumen.Movimientos.length, "movimiento", "movimientos")}
          </span>
        }
      >
        {resumen.Movimientos.length > 0 ? (
          <TablaFilas
            columnas={columnasMovimientos(esBobina)}
            filas={resumen.Movimientos}
            clave={(m) => m.IdMovimiento}
            tarjeta={tarjetaMovimiento(esBobina)}
          />
        ) : (
          <div className="p-10 text-center text-sm text-slate-400">
            No hay movimientos en el período y los filtros elegidos.
          </div>
        )}
      </TarjetaSeccion>
    </div>
  );
}

export default function MovimientosReporteEmpaque({ usuario }) {
  const reporte = useReporte(consultarResumen, filtrosIniciales(true));
  const { filtros, catalogo: resumen } = reporte;
  const clase = claseEmpaque(filtros.Clase);
  const completo = rangoCompleto(filtros);
  const hayMovimientos = Boolean(resumen?.Movimientos.length);

  return (
    <PaginaReporte
      usuario={usuario}
      titulo="Reportes · Empaque"
      subtitulo="Movimientos"
      contador={
        resumen
          ? { valor: resumen.Movimientos.length, singular: "movimiento", plural: "movimientos" }
          : null
      }
    >
      <TarjetaFiltros
        reporte={{ ...reporte, hayFiltros: hayFiltrosEmpaque(filtros) }}
        informe={
          <BotonInforme
            disponible={completo && hayMovimientos}
            ayuda={`PDF con el resumen por tipo y el detalle de movimientos de ${clase.texto.toLowerCase()} del período elegido`}
            ayudaNoDisponible={
              completo ? "No hay movimientos en el período y los filtros elegidos" : undefined
            }
            exito="Informe de movimientos de empaque descargado"
            descargar={() => descargarReporteMovimientosEmpaque(clase.valor, parametrosDescarga(filtros))}
          />
        }
      >
        <FiltrosEmpaque
          reporte={reporte}
          idRango="rango-movimientos-empaque"
          etiquetaRango="Fecha del movimiento"
          conMovimiento
        />
      </TarjetaFiltros>

      <ResultadosMovimientos reporte={reporte} />
    </PaginaReporte>
  );
}
