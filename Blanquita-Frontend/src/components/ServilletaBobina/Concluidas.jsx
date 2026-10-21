import ProduccionesConcluidas from "@/components/Produccion/Concluidas";
import { CODIGO_UNIDAD } from "@/components/Reportes/BobinaServilleta/filtros";
import {
  verProduccionesServilleta,
  descargarReporteDetalleProduccionServilleta,
  descargarReporteProduccionServilletaCancelada,
  descargarReporteProduccionServilletaPorPeriodo,
} from "@/services/BobinaServilleta/Reportes";

const COLUMNAS = [
  {
    titulo: "Sub-bobina",
    valor: (p) => (
      <div className="flex flex-col">
        <span className="font-semibold text-slate-900">#{p.IdSubBobinaServilleta}</span>
        <span className="text-[12px] text-slate-500">{p.DescripcionMedida}</span>
      </div>
    ),
  },
  {
    titulo: "Unidad origen",
    valor: (p) => (
      <div className="flex flex-col">
        <span className="font-mono text-[12.5px] text-slate-900">{p.CodigoBobina}</span>
        <span className="text-[12px] text-slate-500">Formato {p.DescripcionFormato}</span>
      </div>
    ),
  },
  { titulo: "Turno", valor: (p) => p.NombreTurno },
  { titulo: "Operador", valor: (p) => p.Operador },
];

const TARJETA = {
  titulo: (p) => `Sub-bobina #${p.IdSubBobinaServilleta} · ${p.CodigoBobina}`,
  subtitulo: (p) =>
    `${p.DescripcionFormato} · ${p.DescripcionMedida} · ${p.NombreTurno} · ${p.Operador}`,
};

export default function ConcluidasServilleta({ onTotal }) {
  return (
    <ProduccionesConcluidas
      onTotal={onTotal}
      consultar={verProduccionesServilleta}
      campoId="IdProduccionServilleta"
      idCalendario="rango-concluidas-servilleta"
      codigo={CODIGO_UNIDAD}
      columnas={COLUMNAS}
      tarjeta={TARJETA}
      descargarDetalle={(id) => descargarReporteDetalleProduccionServilleta(id, true)}
      descargarCancelada={descargarReporteProduccionServilletaCancelada}
      descargarPeriodo={descargarReporteProduccionServilletaPorPeriodo}
    />
  );
}
