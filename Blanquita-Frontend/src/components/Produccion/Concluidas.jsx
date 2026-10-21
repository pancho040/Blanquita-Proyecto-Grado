import { useEffect } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import DoubleDatePicker from "@/components/layout/dates/DoubleDatePicker";
import {
  TarjetaFiltros,
  BotonInforme,
  CampoFiltro,
  BuscadorFiltro,
  FiltroTipos,
  ResultadosReporte,
  BotonDescargaFila,
  TarjetaReporte,
  BadgeEstado,
  ESTADOS_PRODUCCION,
  DERECHA,
} from "@/components/Reportes/comunes";
import { ATAJOS, atajoActivo as buscarAtajo } from "@/components/Reportes/Empaque/filtros";
import { useReporte } from "@/hooks/useReporte";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { aFechaISO, dateFormatter, formatearDuracion } from "@/utils/dates";

const ID_FINALIZADO = 3;
const ID_CANCELADA = 4;
const ID_CAMBIO_LINEA = 5;

const mismosIds = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

const COLUMNA_ESTADO = {
  titulo: "Estado",
  valor: (p) => <BadgeEstado estado={p.NombreEstadoProduccion} estilos={ESTADOS_PRODUCCION} />,
};

const COLUMNAS_TIEMPO = [
  { titulo: "Inicio", clase: "text-[12.5px]", valor: (p) => dateFormatter(p.FechaInicioProduccion) },
  {
    titulo: "Fin",
    clase: "text-[12.5px]",
    valor: (p) => (p.FechaFinProduccion ? dateFormatter(p.FechaFinProduccion) : "-"),
  },
  { titulo: "Duración", ...DERECHA, valor: (p) => formatearDuracion(p.DuracionTotal) },
];

function filtrosEstado(conCambioLinea) {
  const todos = conCambioLinea
    ? [ID_FINALIZADO, ID_CAMBIO_LINEA, ID_CANCELADA]
    : [ID_FINALIZADO, ID_CANCELADA];
  return [
    { valor: "todas", texto: "Todas", ids: todos },
    { valor: "finalizadas", texto: "Finalizadas", ids: [ID_FINALIZADO] },
    ...(conCambioLinea
      ? [{ valor: "cambio", texto: "Cambio de línea", ids: [ID_CAMBIO_LINEA] }]
      : []),
    { valor: "canceladas", texto: "Canceladas", ids: [ID_CANCELADA] },
  ];
}

/**
 * Pestaña de producciones concluidas (finalizadas, cambio de línea y canceladas)
 * del encargado. Cada pantalla de producción pasa su catálogo, columnas y descargas.
 */
export default function ProduccionesConcluidas({
  onTotal,
  consultar,
  campoId,
  idCalendario,
  conCambioLinea = false,
  filtroTipo,
  codigo,
  columnas,
  columnasFinales = [],
  tarjeta,
  descargarDetalle,
  descargarCancelada,
  descargarPeriodo,
}) {
  const FILTROS_ESTADO = filtrosEstado(conCambioLinea);
  const estadosConcluidos = FILTROS_ESTADO[0].ids;

  const reporte = useReporte(
    consultar,
    {
      Rango: ATAJOS[0].rango(new Date()),
      IdsEstadoProduccion: estadosConcluidos,
      ...(filtroTipo && { [filtroTipo.campo]: [] }),
      CodigoBobina: "",
    },
    ["CodigoBobina"],
  );
  const { filtros, catalogo } = reporte;
  const { Rango } = filtros;

  useEffect(() => {
    if (catalogo) onTotal?.(catalogo.Total);
  }, [catalogo]);

  const atajoActivo = buscarAtajo(Rango);
  const estadoActivo = FILTROS_ESTADO.find((f) =>
    mismosIds(f.ids, filtros.IdsEstadoProduccion),
  )?.valor;
  const rangoCompleto = Boolean(Rango?.from && Rango?.to);

  const hayFiltros =
    atajoActivo !== "hoy" ||
    estadoActivo !== "todas" ||
    (filtroTipo && filtros[filtroTipo.campo].length > 0) ||
    reporte.textos.CodigoBobina.trim() !== "";

  const botonDetalle = (p) => {
    const cancelada = p.NombreEstadoProduccion === "Cancelada";
    return (
      <BotonDescargaFila
        ayuda={
          cancelada
            ? "Descargar el reporte de la cancelación"
            : "Descargar el detalle de la producción"
        }
        descargar={() => (cancelada ? descargarCancelada(p[campoId]) : descargarDetalle(p[campoId]))}
      />
    );
  };

  return (
    <>
      <TarjetaFiltros
        reporte={{ ...reporte, hayFiltros }}
        informe={
          <BotonInforme
            disponible={rangoCompleto}
            ayuda="PDF del período con las producciones, pausas y cancelaciones"
            exito="Reporte del período descargado"
            descargar={() => descargarPeriodo(aFechaISO(Rango.from), aFechaISO(Rango.to), true)}
          />
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DoubleDatePicker
            id={idCalendario}
            label="Fecha de conclusión"
            value={Rango}
            onChange={(valor) => reporte.cambiar("Rango", valor)}
          />
          <CampoFiltro etiqueta="Período">
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

        <CampoFiltro etiqueta="Estado">
          <ToggleGroup
            value={estadoActivo ? [estadoActivo] : []}
            className="flex flex-wrap justify-start gap-2"
          >
            {FILTROS_ESTADO.map((f) => (
              <ToggleGroupItem
                key={f.valor}
                value={f.valor}
                onClick={() => reporte.cambiar("IdsEstadoProduccion", f.ids)}
                className={PILDORA_FILTRO}
              >
                {f.texto}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CampoFiltro>

        {filtroTipo && <FiltroTipos reporte={reporte} tipo={filtroTipo} />}

        <BuscadorFiltro
          reporte={reporte}
          campo="CodigoBobina"
          etiqueta={codigo.etiqueta}
          placeholder={codigo.placeholder}
        />
      </TarjetaFiltros>

      <ResultadosReporte
        reporte={reporte}
        elementos={catalogo?.Producciones}
        clave={(p) => p[campoId]}
        nombres={["producción concluida", "producciones concluidas"]}
        columnas={[COLUMNA_ESTADO, ...columnas, ...COLUMNAS_TIEMPO, ...columnasFinales]}
        accion={botonDetalle}
        tarjeta={(p) => (
          <TarjetaReporte
            titulo={tarjeta.titulo(p)}
            tamanoTitulo="text-[13.5px]"
            subtitulo={tarjeta.subtitulo(p)}
            estado={p.NombreEstadoProduccion}
            estilos={ESTADOS_PRODUCCION}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-slate-600">
              <span>Inicio {dateFormatter(p.FechaInicioProduccion)}</span>
              {p.FechaFinProduccion && <span>Fin {dateFormatter(p.FechaFinProduccion)}</span>}
              <span>Duración {formatearDuracion(p.DuracionTotal)}</span>
              {tarjeta.extra?.(p)}
            </div>
            <div className="flex items-center justify-end border-t border-slate-200 pt-2.5">
              {botonDetalle(p)}
            </div>
          </TarjetaReporte>
        )}
      />
    </>
  );
}
