import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import DoubleDatePicker from "@/components/layout/dates/DoubleDatePicker";
import { PaginaReporte } from "@/components/Reportes/PaginaReporte";
import {
  TarjetaFiltros,
  BotonInforme,
  CampoFiltro,
  BuscadorFiltro,
  SelectFiltro,
  FiltroTipos,
  ResultadosReporte,
  BotonDescargaFila,
  TarjetaReporte,
  BadgeEstado,
  ESTADOS_PRODUCCION,
  DERECHA,
} from "@/components/Reportes/comunes";
import { ATAJOS, atajoActivo } from "@/components/Reportes/Empaque/filtros";
import { useReporte } from "@/hooks/useReporte";
import { EstadosProduccion } from "@/constants/Estados";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { turnos } from "@/constants/Values";
import { dateFormatter, aFechaISO, formatearDuracion } from "@/utils/dates";

const COLUMNAS_INICIALES = [
  {
    titulo: "Estado",
    valor: (p) => (
      <BadgeEstado estado={p.NombreEstadoProduccion} estilos={ESTADOS_PRODUCCION} />
    ),
  },
  { titulo: "Turno", valor: (p) => p.NombreTurno },
];

const COLUMNAS_TIEMPO = [
  {
    titulo: "Inicio",
    clase: "text-[12.5px]",
    valor: (p) => dateFormatter(p.FechaInicioProduccion),
  },
  {
    titulo: "Fin",
    clase: "text-[12.5px]",
    valor: (p) => (p.FechaFinProduccion ? dateFormatter(p.FechaFinProduccion) : "-"),
  },
  { titulo: "Duración", ...DERECHA, valor: (p) => formatearDuracion(p.DuracionTotal) },
];

export default function ReporteProduccion({
  usuario,
  titulo,
  idCalendario,
  consultar,
  campoId,
  tipo,
  codigo,
  descargarPeriodo,
  descargarDetalle,
  descargarCancelada,
  opcionMovimientos = false,
  columnas,
  columnasFinales = [],
  anchoAccion,
  tarjeta,
  estados = EstadosProduccion,
}) {
  const reporte = useReporte(
    consultar,
    {
      Rango: undefined,
      IdTurno: "",
      [tipo.campo]: [],
      CodigoBobina: "",
      Operador: "",
      IdEstadoProduccion: "",
    },
    ["CodigoBobina", "Operador"],
  );
  const { filtros, catalogo } = reporte;
  const { Rango } = filtros;
  const atajo = atajoActivo(Rango);

  const [verCancelaciones, setVerCancelaciones] = useState(false);
  const [verMovimientos, setVerMovimientos] = useState(false);

  const botonDetalle = (p) => {
    const cancelada = p.NombreEstadoProduccion === "Cancelada";
    return (
      <BotonDescargaFila
        ayuda={
          cancelada
            ? `Descargar detalle de la cancelación (incluye pausas${opcionMovimientos ? " y movimientos" : ""})`
            : `Descargar detalle de esta producción (con pausas${verMovimientos ? " y movimientos" : ""})`
        }
        descargar={() =>
          cancelada
            ? descargarCancelada(p[campoId])
            : descargarDetalle(p[campoId], verMovimientos)
        }
      />
    );
  };

  return (
    <PaginaReporte
      usuario={usuario}
      titulo={titulo}
      subtitulo="Producción"
      contador={
        catalogo
          ? { valor: catalogo.Total, singular: "producción", plural: "producciones" }
          : null
      }
    >
      <TarjetaFiltros
        reporte={reporte}
        informe={
          <BotonInforme
            disponible={Boolean(Rango?.from && Rango?.to)}
            ayuda="PDF con las producciones, pausas por motivo y tiempos del rango elegido"
            exito="Informe de producción descargado"
            descargar={() =>
              descargarPeriodo(aFechaISO(Rango.from), aFechaISO(Rango.to), verCancelaciones)
            }
          />
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <DoubleDatePicker
            id={idCalendario}
            label="Fecha de producción"
            value={Rango}
            onChange={(valor) => reporte.cambiar("Rango", valor)}
          />
          <SelectFiltro
            reporte={reporte}
            campo="IdTurno"
            etiqueta="Turno"
            opciones={turnos}
            campoEtiqueta="NombreTurno"
            placeholder="Todos los turnos"
          />
          <SelectFiltro
            reporte={reporte}
            campo="IdEstadoProduccion"
            etiqueta="Estado"
            opciones={estados}
            campoEtiqueta="NombreEstadoProduccion"
            placeholder="Todos los estados"
          />
        </div>

        <CampoFiltro etiqueta="Período">
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <BuscadorFiltro
            reporte={reporte}
            campo="CodigoBobina"
            etiqueta={codigo.etiqueta}
            placeholder={codigo.placeholder}
          />
          <BuscadorFiltro
            reporte={reporte}
            campo="Operador"
            etiqueta="Operador"
            placeholder="Nombre del operador"
            mono={false}
          />
        </div>

        <FiltroTipos reporte={reporte} tipo={tipo} />

        <CampoFiltro etiqueta="Informe por período">
          <ToggleGroup
            value={verCancelaciones ? ["on"] : []}
            className="flex flex-wrap justify-start gap-2"
          >
            <ToggleGroupItem
              value="on"
              onClick={() => setVerCancelaciones((v) => !v)}
              className={PILDORA_FILTRO}
            >
              Incluir cancelaciones en el informe
            </ToggleGroupItem>
          </ToggleGroup>
        </CampoFiltro>

        {opcionMovimientos && (
          <CampoFiltro etiqueta="Detalle por producción">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-[12.5px] font-bold text-slate-600">
              <input
                type="checkbox"
                checked={verMovimientos}
                onChange={(e) => setVerMovimientos(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-c3"
              />
              Incluir movimientos de logs al descargar el detalle
            </label>
          </CampoFiltro>
        )}
      </TarjetaFiltros>

      <ResultadosReporte
        reporte={reporte}
        elementos={catalogo?.Producciones}
        clave={(p) => p[campoId]}
        nombres={["producción", "producciones"]}
        columnas={[...COLUMNAS_INICIALES, ...columnas, ...COLUMNAS_TIEMPO, ...columnasFinales]}
        anchoAccion={anchoAccion}
        accion={botonDetalle}
        tarjeta={(p) => (
          <TarjetaReporte
            titulo={tarjeta.titulo(p)}
            tamanoTitulo="text-[13.5px]"
            subtitulo={tarjeta.subtitulo(p)}
            estado={p.NombreEstadoProduccion}
            estilos={ESTADOS_PRODUCCION}
          >
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-slate-600">
              <span>Inicio {dateFormatter(p.FechaInicioProduccion)}</span>
              {p.FechaFinProduccion && (
                <span>Fin {dateFormatter(p.FechaFinProduccion)}</span>
              )}
              <span>Duración {formatearDuracion(p.DuracionTotal)}</span>
              {tarjeta.extra?.(p)}
            </div>

            <div className="flex items-center justify-end gap-1 border-t border-slate-200 pt-2.5">
              {botonDetalle(p)}
            </div>
          </TarjetaReporte>
        )}
      />
    </PaginaReporte>
  );
}
