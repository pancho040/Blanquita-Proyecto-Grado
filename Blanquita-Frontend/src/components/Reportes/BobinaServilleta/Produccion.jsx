import ReporteProduccion from "@/components/Reportes/ReporteProduccion";
import {
  verProduccionesServilleta,
  descargarReporteDetalleProduccionServilleta,
  descargarReporteProduccionServilletaCancelada,
  descargarReporteProduccionServilletaPorPeriodo,
} from "@/services/BobinaServilleta/Reportes";
import { TIPOS_BOBINA_SERVILLETA, CODIGO_UNIDAD } from "./filtros";
import { EstadosProduccion } from "@/constants/Estados";
import { ArrayFilter } from "@/utils/handlers";

const ESTADOS_SERVILLETA = ArrayFilter([1, 2, 3, 4], EstadosProduccion);

const COLUMNAS = [
  { titulo: "Tipo", valor: (p) => p.NombreTipoBobinaServilleta },
  { titulo: "Código", clase: "font-mono text-[12.5px]", valor: (p) => p.CodigoBobina },
  { titulo: "Formato", valor: (p) => p.DescripcionFormato },
  { titulo: "Medida", valor: (p) => p.DescripcionMedida },
];

const TARJETA = {
  titulo: (p) => p.CodigoBobina,
  subtitulo: (p) => (
    <>
      {p.NombreTipoBobinaServilleta} · {p.DescripcionFormato} · {p.DescripcionMedida} ·{" "}
      {p.NombreTurno}
    </>
  ),
};

export default function ProduccionReporteServilleta({ usuario }) {
  return (
    <ReporteProduccion
      usuario={usuario}
      titulo="Reportes · Produccion Bobina Servilleta"
      idCalendario="rango-produccion-servilleta"
      consultar={verProduccionesServilleta}
      campoId="IdProduccionServilleta"
      tipo={TIPOS_BOBINA_SERVILLETA}
      codigo={CODIGO_UNIDAD}
      descargarPeriodo={descargarReporteProduccionServilletaPorPeriodo}
      descargarCancelada={descargarReporteProduccionServilletaCancelada}
      descargarDetalle={(id) => descargarReporteDetalleProduccionServilleta(id, true)}
      columnas={COLUMNAS}
      tarjeta={TARJETA}
      estados={ESTADOS_SERVILLETA}
    />
  );
}
