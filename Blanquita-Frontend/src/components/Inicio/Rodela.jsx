import { ArrowRightLeft, Boxes, FileChartColumn, PackageCheck, PackagePlus, PencilLine, Send, Undo2 } from "lucide-react";
import { verInicioRodela } from "@/services/Rodela/Inicio";
import { dateFormatter } from "@/utils/dates";
import {
  AccesosRapidos,
  Bloque,
  CargandoInicio,
  EncabezadoSemana,
  EnlaceBloque,
  ErrorInicio,
  GrillaStock,
  Reingresables,
  SinDatos,
  TarjetaIndicador,
  UltimoLote,
  UltimosMovimientos,
  numero,
  useInicio,
} from "@/components/Inicio/comunes";

const RUTA = "/encargado/rodela";

const ACCESOS = [
  { texto: "Inventario y envío", href: `${RUTA}/inventario`, icono: Boxes },
  { texto: "Reingresar", href: `${RUTA}/produccion`, icono: Undo2 },
  { texto: "Ingresar lote", href: `${RUTA}/ingreso`, icono: PackagePlus },
  { texto: "Reportes", href: "/encargado/reportes/rodela/inventario", icono: FileChartColumn },
];

function EnProduccion({ enProduccion }) {
  return (
    <Bloque
      titulo="Últimas enviadas a producción"
      descripcion={`${numero(enProduccion.Cantidad)} pallets abiertos en total`}
      icono={Send}
      accion={<EnlaceBloque href={`${RUTA}/inventario`}>Inventario</EnlaceBloque>}
    >
      {enProduccion.Rodelas.length ? (
        <div className="flex flex-col gap-1.5">
          {enProduccion.Rodelas.map((rodela) => (
            <div key={rodela.IdRodela} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-mono text-[12.5px] font-bold text-slate-800">{rodela.CodigoRodela}</span>
                <span className="text-[11.5px] text-slate-500">{rodela.NombreTipoRodela}</span>
              </span>
              {rodela.FechaTraslado && (
                <span className="shrink-0 text-[11.5px] text-slate-500">{dateFormatter(rodela.FechaTraslado)}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <SinDatos icono={Send} titulo="Sin rodelas en producción" />
      )}
    </Bloque>
  );
}

function Indicadores({ indicadores }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <TarjetaIndicador
        icono={Send}
        etiqueta="Enviadas a producción"
        valor={indicadores.Enviadas}
        anterior={indicadores.EnviadasSemanaAnterior}
      />
      <TarjetaIndicador
        icono={PackageCheck}
        etiqueta="Recibidas por lote"
        valor={indicadores.Recibidas}
        anterior={indicadores.RecibidasSemanaAnterior}
        clase="bg-emerald-50 text-emerald-700"
      />
      <TarjetaIndicador
        icono={ArrowRightLeft}
        etiqueta="Devueltas al almacén"
        valor={indicadores.Devueltas}
        anterior={indicadores.DevueltasSemanaAnterior}
        menosEsMejor
        clase="bg-amber-50 text-amber-700"
      />
      <TarjetaIndicador
        icono={PencilLine}
        etiqueta="Correcciones de registro"
        valor={indicadores.Correcciones}
        anterior={indicadores.CorreccionesSemanaAnterior}
        menosEsMejor
        clase="bg-slate-100 text-slate-700"
      />
    </div>
  );
}

export default function InicioRodela() {
  const { datos, error, recargar } = useInicio(verInicioRodela);

  if (error && !datos) return <ErrorInicio mensaje={error} onReintentar={recargar} />;
  if (!datos) return <CargandoInicio />;

  const lote = datos.UltimoLote;

  return (
    <div className="flex flex-col gap-4">
      <AccesosRapidos accesos={ACCESOS} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reingresables
          href={`${RUTA}/produccion`}
          unidad="Rodelas"
          minutos={datos.MinutosDeshacerTraslado}
          items={datos.Reingresables.map((rodela) => ({
            id: rodela.IdRodela,
            codigo: rodela.CodigoRodela,
            detalle: rodela.NombreTipoRodela,
            fecha: rodela.FechaTraslado,
          }))}
        />
        <EnProduccion enProduccion={datos.EnProduccion} />
      </div>

      <Bloque
        titulo="Stock por tipo de rodela"
        descripcion="Pallets en almacén"
        icono={Boxes}
        accion={<EnlaceBloque href={`${RUTA}/inventario`}>Inventario</EnlaceBloque>}
      >
        <GrillaStock
          vacio="Sin tipos de rodela"
          items={datos.Stock.map((tipo) => ({
            ...tipo,
            id: tipo.IdTipoRodela,
            nombre: tipo.NombreTipoRodela,
            activo: tipo.Activo,
            cantidad: tipo.CantidadEnAlmacen,
            unidad: `pallets · ${numero(tipo.CantidadAbiertas)} abiertos`,
          }))}
        />
      </Bloque>

      <EncabezadoSemana datos={datos} />

      <Indicadores indicadores={datos.Indicadores} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UltimosMovimientos
          movimientos={datos.UltimosMovimientos.map((m) => ({
            id: m.IdMovimientoRodela,
            idTipoMovimiento: m.IdTipoMovimiento,
            movimiento: m.NombreMovimiento,
            titulo: m.CodigoRodela,
            fecha: m.FechaMovimiento,
            usuario: m.Usuario,
            observacion: m.Observacion,
          }))}
        />
        <UltimoLote
          href={`${RUTA}/ingreso`}
          lote={
            lote && {
              codigo: lote.CodigoLote,
              fecha: lote.FechaRecepcion,
              proveedor: lote.NombreProveedor,
              contenido: `${numero(lote.CantidadRodelas)} pallets ${lote.NombreTipoRodela ?? ""}`,
            }
          }
        />
      </div>
    </div>
  );
}
