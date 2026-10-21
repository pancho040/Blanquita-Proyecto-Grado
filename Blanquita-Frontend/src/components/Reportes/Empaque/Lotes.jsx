import { PaginaReporte, SinContenedor } from "@/components/Reportes/PaginaReporte";
import { TarjetaFiltros, BotonInforme, DERECHA, contar } from "@/components/Reportes/comunes";
import {
  TarjetaSeccion,
  EsqueletoCarga,
  ErrorCarga,
  TablaFilas,
  TarjetaFila,
} from "@/components/Reportes/Producto/comunes";
import { useReporte } from "@/hooks/useReporte";
import { useDiasDestacados } from "@/hooks/useDiasDestacados";
import { dateFormatter } from "@/utils/dates";
import { formatearNumero } from "@/utils/numeros";
import { verResumenLotesEmpaque, descargarReporteLotesEmpaque } from "@/services/Empaque/Reporte";
import { claseEmpaque } from "./filtros";
import {
  FiltrosEmpaque,
  filtrosIniciales,
  hayFiltrosEmpaque,
  parametrosDescarga,
  rangoCompleto,
} from "./comunes";

const consultarResumen = (parametros) =>
  parametros.FechaInicio && parametros.FechaFin
    ? verResumenLotesEmpaque(parametros.Clase, parametros)
    : Promise.resolve(null);

const entero = (valor) => formatearNumero(valor, { decimales: 0 });

const peso = (valor) => formatearNumero(valor, { vacio: "-" });

const toneladas = (valor) => (valor ? `${formatearNumero(valor)} t` : "Sin dato");

const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

const columnasResumen = (unidad, esBobina) => [
  { titulo: "Tipo", clase: "font-bold text-slate-900", valor: (r) => r.NombreTipo },
  { titulo: "Lotes", ...DERECHA, valor: (r) => r.NumeroLotes },
  { titulo: capitalizar(unidad), ...DERECHA, valor: (r) => entero(r.Cantidad) },
  ...(esBobina ? [{ titulo: "Peso (kg)", ...DERECHA, valor: (r) => peso(r.PesoKg) }] : []),
];

const columnasItems = (unidad, esBobina) => [
  { titulo: "Tipo", clase: "font-bold text-slate-900", valor: (i) => i.NombreTipo },
  { titulo: capitalizar(unidad), ...DERECHA, valor: (i) => entero(i.Cantidad) },
  ...(esBobina
    ? [
        { titulo: "Peso (kg)", ...DERECHA, valor: (i) => peso(i.PesoKg) },
        {
          titulo: "Códigos",
          clase: "font-mono text-[12px] text-slate-600",
          valor: (i) => i.Codigos.join(", "),
        },
      ]
    : []),
];

const tarjetaResumen = (unidad, esBobina) => (r) => (
  <TarjetaFila
    nombre={r.NombreTipo}
    detalle={`${contar(r.NumeroLotes, "lote", "lotes")}${esBobina ? ` · ${peso(r.PesoKg)} kg` : ""}`}
  >
    <strong className="text-slate-900">{entero(r.Cantidad)}</strong>{" "}
    <span className="text-slate-500">{unidad}</span>
  </TarjetaFila>
);

const tarjetaItem = (unidad, esBobina) => (i) => (
  <TarjetaFila
    nombre={i.NombreTipo}
    detalle={esBobina ? `${peso(i.PesoKg)} kg · ${i.Codigos.join(", ")}` : unidad}
  >
    <strong className="text-slate-900">{entero(i.Cantidad)}</strong>
  </TarjetaFila>
);

function DetalleLote({ lote, unidad, esBobina }) {
  return (
    <TarjetaSeccion
      titulo={`Lote #${lote.IdLoteEmpaque} · ${lote.NombreProveedor}`}
      extra={
        <span className="text-[12.5px] font-semibold text-slate-500">
          {entero(lote.CantidadTotal)} {unidad}
          {esBobina ? ` · ${peso(lote.PesoTotalKg)} kg` : ""}
        </span>
      }
    >
      <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-slate-100 px-5 py-3 text-[12.5px] text-slate-600">
        <span>
          <strong className="text-slate-500">Recepción:</strong> {dateFormatter(lote.FechaRecepcion)}
        </span>
        <span>
          <strong className="text-slate-500">Registrado:</strong> {dateFormatter(lote.FechaRegistro)}
        </span>
        <span>
          <strong className="text-slate-500">Toneladas pedidas:</strong>{" "}
          {toneladas(lote.CantidadToneladasPedida)}
        </span>
        <span>
          <strong className="text-slate-500">Por:</strong> {lote.PrimerNombre} {lote.ApellidoPaterno} · CI{" "}
          {lote.Ci} · {lote.NombreRol}
        </span>
      </div>
      <TablaFilas
        columnas={columnasItems(unidad, esBobina)}
        filas={lote.Items}
        clave={(i) => i.IdTipo}
        tarjeta={tarjetaItem(unidad, esBobina)}
      />
    </TarjetaSeccion>
  );
}

function ResultadosLotes({ reporte }) {
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
          Elegí una fecha de inicio y una de fin para ver los lotes.
        </div>
      </TarjetaSeccion>
    );
  }

  const esBobina = resumen.Clase === "bobina";
  const unidad = resumen.Unidad;

  if (resumen.Lotes.length === 0) {
    return (
      <TarjetaSeccion titulo={`Resumen por tipo · ${resumen.NombreClase}`} className="mt-6">
        <div className="p-10 text-center text-sm text-slate-400">
          No se recibieron lotes en el período y los tipos elegidos.
        </div>
      </TarjetaSeccion>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <TarjetaSeccion
        titulo={`Resumen por tipo · ${resumen.NombreClase}`}
        extra={
          <span className="text-[12.5px] font-semibold text-slate-500">
            {contar(resumen.Lotes.length, "lote", "lotes")}
          </span>
        }
      >
        <TablaFilas
          columnas={columnasResumen(unidad, esBobina)}
          filas={resumen.Resumen}
          clave={(r) => r.IdTipo}
          tarjeta={tarjetaResumen(unidad, esBobina)}
        />
      </TarjetaSeccion>

      {resumen.Lotes.map((lote) => (
        <DetalleLote key={lote.IdLoteEmpaque} lote={lote} unidad={unidad} esBobina={esBobina} />
      ))}
    </div>
  );
}

export function LotesEmpaque({ usuario, claseFija, contenedor: Contenedor = SinContenedor }) {
  const reporte = useReporte(consultarResumen, filtrosIniciales(false, claseFija));
  const { filtros, catalogo: resumen } = reporte;
  const clase = claseEmpaque(filtros.Clase);
  const completo = rangoCompleto(filtros);
  const hayLotes = Boolean(resumen?.Lotes.length);
  const destacados = useDiasDestacados(
    (FechaInicio, FechaFin) =>
      verResumenLotesEmpaque(clase.valor, { FechaInicio, FechaFin }).then((r) => r.Lotes),
    (lote) => ({
      fecha: lote.FechaRecepcion,
      texto: `Lote #${lote.IdLoteEmpaque} · ${lote.NombreProveedor}`,
    }),
  );

  return (
    <Contenedor
      usuario={usuario}
      titulo="Reportes · Empaque"
      subtitulo="Lotes recibidos"
      contador={resumen ? { valor: resumen.Lotes.length, singular: "lote", plural: "lotes" } : null}
    >
      <TarjetaFiltros
        reporte={{ ...reporte, hayFiltros: hayFiltrosEmpaque(filtros, Boolean(claseFija)) }}
        informe={
          <BotonInforme
            disponible={completo && hayLotes}
            ayuda={`PDF con el resumen por tipo y el detalle de cada lote de ${clase.texto.toLowerCase()} recibido en el período`}
            ayudaNoDisponible={
              completo ? "No se recibieron lotes en el período y los tipos elegidos" : undefined
            }
            exito="Informe de lotes de empaque descargado"
            descargar={() => descargarReporteLotesEmpaque(clase.valor, parametrosDescarga(filtros))}
          />
        }
      >
        <FiltrosEmpaque
          reporte={reporte}
          idRango={`rango-lotes-empaque-${clase.valor}`}
          etiquetaRango="Fecha de recepción"
          claseFija={Boolean(claseFija)}
          diasDestacados={destacados.dias}
          onRangoVisibleChange={destacados.cargar}
        />
      </TarjetaFiltros>

      <ResultadosLotes reporte={reporte} />
    </Contenedor>
  );
}

export default function LotesReporteEmpaque({ usuario }) {
  return <LotesEmpaque usuario={usuario} contenedor={PaginaReporte} />;
}
