import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import DoubleDatePicker from "@/components/layout/dates/DoubleDatePicker";
import { CampoFiltro, FiltroTipos } from "@/components/Reportes/comunes";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { aFechaISO } from "@/utils/dates";
import { ATAJOS, CLASES_EMPAQUE, atajoActivo, claseEmpaque, tipoEmpaque } from "./filtros";

export const filtrosIniciales = (conMovimiento = false) => ({
  Clase: CLASES_EMPAQUE[0].valor,
  Rango: ATAJOS[0].rango(new Date()),
  IdsTipo: [],
  ...(conMovimiento ? { IdTipoMovimiento: "" } : {}),
});

export const hayFiltrosEmpaque = (filtros) =>
  filtros.Clase !== CLASES_EMPAQUE[0].valor ||
  atajoActivo(filtros.Rango) !== "hoy" ||
  filtros.IdsTipo.length > 0 ||
  Boolean(filtros.IdTipoMovimiento);

export const rangoCompleto = (filtros) => Boolean(filtros.Rango?.from && filtros.Rango?.to);

export const parametrosDescarga = (filtros) => ({
  FechaInicio: aFechaISO(filtros.Rango.from),
  FechaFin: aFechaISO(filtros.Rango.to),
  IdsTipo: filtros.IdsTipo.length ? filtros.IdsTipo : null,
  IdTipoMovimiento: filtros.IdTipoMovimiento || null,
});

function Pildoras({ etiqueta, opciones, valor, onCambio }) {
  return (
    <CampoFiltro etiqueta={etiqueta}>
      <ToggleGroup value={[String(valor)]} className="flex flex-wrap justify-start gap-2">
        {opciones.map((opcion) => (
          <ToggleGroupItem
            key={opcion.valor}
            value={String(opcion.valor)}
            onClick={() => onCambio(opcion.valor)}
            className={PILDORA_FILTRO}
          >
            {opcion.texto}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </CampoFiltro>
  );
}

const MOVIMIENTOS = [
  { valor: "", texto: "Todos" },
  { valor: 1, texto: "Ingresos" },
  { valor: 2, texto: "Salidas" },
  { valor: 6, texto: "Reingresos" },
];

export function FiltrosEmpaque({ reporte, idRango, etiquetaRango, conMovimiento = false }) {
  const { filtros } = reporte;
  const clase = claseEmpaque(filtros.Clase);
  const atajo = atajoActivo(filtros.Rango);

  const cambiarClase = (valor) => {
    if (valor === filtros.Clase) return;
    reporte.cambiar("Clase", valor);
    reporte.cambiar("IdsTipo", []);
  };

  return (
    <>
      <Pildoras
        etiqueta="Empaque"
        opciones={CLASES_EMPAQUE}
        valor={filtros.Clase}
        onCambio={cambiarClase}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DoubleDatePicker
          id={idRango}
          label={etiquetaRango}
          value={filtros.Rango}
          onChange={(valor) => reporte.cambiar("Rango", valor)}
        />
        <CampoFiltro etiqueta="Atajos">
          <ToggleGroup
            value={atajo ? [atajo] : []}
            className="flex flex-wrap justify-start gap-2"
          >
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

      {conMovimiento && (
        <Pildoras
          etiqueta="Movimiento"
          opciones={
            clase.valor === "bobina"
              ? MOVIMIENTOS.map((m) => (m.valor === 2 ? { ...m, texto: "Traslados" } : m))
              : MOVIMIENTOS
          }
          valor={filtros.IdTipoMovimiento}
          onCambio={(valor) => reporte.cambiar("IdTipoMovimiento", valor)}
        />
      )}

      <FiltroTipos key={clase.valor} reporte={reporte} tipo={tipoEmpaque(clase)} />
    </>
  );
}
