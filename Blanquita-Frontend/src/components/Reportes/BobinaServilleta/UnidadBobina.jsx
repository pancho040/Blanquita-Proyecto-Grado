import ReporteInventario from "@/components/Reportes/ReporteInventario";
import {
  BotonDescargaFila,
  TarjetaReporte,
  PieTarjeta,
  Dato,
  columnaCodigo,
  COLUMNA_ESTADO,
  COLUMNA_PROVEEDOR,
  DERECHA,
  contar,
} from "@/components/Reportes/comunes";
import {
  verBobinasServilletaReporte,
  descargarReporteMovimientosUnidadServilleta,
} from "@/services/BobinaServilleta/Reportes";
import { formatearNumero } from "@/utils/numeros";
import { TIPO_BOBINA_SERVILLETA, CODIGO_UNIDAD } from "./filtros";

function aplanarUnidades(bobinas) {
  return bobinas.flatMap((b) =>
    b.Unidades.map((u) => ({
      IdUnidad: u.IdUnidadBobinaServilleta,
      CodigoUnidad: u.CodigoBobina,
      DescripcionFormato: u.DescripcionFormato,
      PesoBrutoKg: u.PesoBrutoKg,
      GramajeGr: u.GramajeGr,
      IdBobinaServilleta: b.IdBobinaServilleta,
      CodigoLote: b.CodigoLote,
      FechaRecepcion: b.FechaRecepcion,
      NombreProveedor: b.NombreProveedor,
      NombreTipoBobinaServilleta: b.NombreTipoBobinaServilleta,
      TipoEstado: b.TipoEstado,
    })),
  );
}

const COLUMNAS = [
  columnaCodigo("CodigoUnidad"),
  { titulo: "Formato", valor: (u) => u.DescripcionFormato },
  { titulo: "Lote", clase: "font-mono text-slate-700", valor: (u) => u.CodigoLote },
  { titulo: "Tipo", valor: (u) => u.NombreTipoBobinaServilleta },
  COLUMNA_PROVEEDOR,
  COLUMNA_ESTADO,
  {
    titulo: "Bruto (kg)",
    ...DERECHA,
    valor: (u) => formatearNumero(u.PesoBrutoKg, { vacio: "-" }),
  },
  { titulo: "Gramaje", ...DERECHA, valor: (u) => formatearNumero(u.GramajeGr, { vacio: "-" }) },
];

function BotonMovimientos({ unidad, ayuda, className }) {
  return (
    <BotonDescargaFila
      className={className}
      ayuda={ayuda}
      descargar={() => descargarReporteMovimientosUnidadServilleta(unidad.IdUnidad)}
    />
  );
}

export default function UnidadBobinaReporteServilleta() {
  return (
    <ReporteInventario
      consultar={verBobinasServilletaReporte}
      elementos={(catalogo) => aplanarUnidades(catalogo.Bobinas)}
      clave={(u) => u.IdUnidad}
      nombres={["unidad", "unidades"]}
      resumen={(unidades) => `${contar(unidades.length, "unidad", "unidades")} en esta página`}
      codigo={CODIGO_UNIDAD}
      tipo={TIPO_BOBINA_SERVILLETA}
      columnas={COLUMNAS}
      accion={(u) => (
        <BotonMovimientos unidad={u} ayuda="Descargar historial de movimientos de esta unidad" />
      )}
      tarjeta={(u) => (
        <TarjetaReporte
          titulo={u.CodigoUnidad}
          subtitulo={
            <>
              {u.DescripcionFormato} · {u.NombreProveedor}
            </>
          }
          estado={u.TipoEstado}
        >
          <PieTarjeta
            accion={
              <BotonMovimientos
                unidad={u}
                ayuda="Descargar historial de movimientos"
                className="shrink-0"
              />
            }
          >
            <Dato etiqueta="Bruto">{formatearNumero(u.PesoBrutoKg, { vacio: "-" })} kg</Dato>
            <Dato etiqueta="Gramaje">{formatearNumero(u.GramajeGr, { vacio: "-" })}</Dato>
          </PieTarjeta>
        </TarjetaReporte>
      )}
    />
  );
}
