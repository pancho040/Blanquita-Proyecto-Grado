import { ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardList, FileChartColumn, Hourglass, Package, Warehouse } from "lucide-react";
import { verInicioInsumo } from "@/services/Insumo/Inicio";
import { dateFormatter } from "@/utils/dates";
import {
  AccesosRapidos,
  Bloque,
  CargandoInicio,
  EncabezadoSemana,
  EnlaceBloque,
  ErrorInicio,
  GraficoSemana,
  GrillaStock,
  SinDatos,
  TarjetaIndicador,
  UltimosMovimientos,
  numero,
  useInicio,
} from "@/components/Inicio/comunes";

const RUTA = "/encargado/insumos";
const RUTA_REPORTES = "/encargado/reportes/insumos";

const ACCESOS = [
  { texto: "Ingreso y salida", href: `${RUTA}/inventario`, icono: Boxes },
  { texto: "Reporte de inventario", href: `${RUTA_REPORTES}/inventario`, icono: FileChartColumn },
  { texto: "Reporte de movimientos", href: `${RUTA_REPORTES}/movimientos`, icono: FileChartColumn },
];

const MEDIDAS = [
  { valor: "Salidas", texto: "Salidas", descripcion: "Unidades que salieron a planta por día e insumo" },
  { valor: "Ingresos", texto: "Ingresos", descripcion: "Unidades ingresadas al almacén por día e insumo" },
];

const serie = (insumo) => ({ ...insumo, Id: insumo.IdTipoInsumo, Nombre: insumo.NombreInsumo });

function SinMovimiento({ insumos, dias }) {
  return (
    <Bloque
      titulo={`Sin movimiento en ${dias} días (${insumos.length})`}
      descripcion="Insumos con stock que nadie usó ni repuso"
      icono={Hourglass}
      accion={insumos.length > 0 && <EnlaceBloque href={`${RUTA}/inventario`}>Inventario</EnlaceBloque>}
    >
      {insumos.length ? (
        <div className="flex flex-col gap-1.5">
          {insumos.map((insumo) => (
            <div key={insumo.IdTipoInsumo} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-bold text-slate-800">{insumo.NombreInsumo}</span>
                <span className="text-[11.5px] text-slate-500">
                  {insumo.FechaUltimoMovimiento
                    ? `Último movimiento ${dateFormatter(insumo.FechaUltimoMovimiento).split(",")[0]}`
                    : "Sin movimientos registrados"}
                </span>
              </span>
              <span className="shrink-0 text-[12.5px] font-extrabold tabular-nums text-slate-700">
                {numero(insumo.CantidadActual)} u.
              </span>
            </div>
          ))}
        </div>
      ) : (
        <SinDatos icono={Hourglass} titulo="Nada estancado" descripcion="Todos los insumos con stock se movieron recientemente." />
      )}
    </Bloque>
  );
}

export default function InicioInsumo() {
  const { datos, error, recargar } = useInicio(verInicioInsumo);

  if (error && !datos) return <ErrorInicio mensaje={error} onReintentar={recargar} />;
  if (!datos) return <CargandoInicio />;

  const indicadores = datos.Indicadores;

  return (
    <div className="flex flex-col gap-4">
      <AccesosRapidos accesos={ACCESOS} />

      <Bloque
        titulo="Stock de insumos"
        descripcion="Unidades en almacén"
        icono={Package}
        accion={<EnlaceBloque href={`${RUTA}/inventario`}>Inventario</EnlaceBloque>}
      >
        <GrillaStock
          vacio="Sin insumos registrados"
          items={datos.Stock.map((insumo) => ({
            ...insumo,
            id: insumo.IdTipoInsumo,
            nombre: insumo.NombreInsumo,
            activo: insumo.Activo,
            cantidad: insumo.CantidadActual,
            unidad: "unidades",
          }))}
        />
      </Bloque>

      <EncabezadoSemana datos={datos} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          icono={ArrowUpFromLine}
          etiqueta="Salidas a planta (unidades)"
          valor={indicadores.Salidas}
          anterior={indicadores.SalidasSemanaAnterior}
        />
        <TarjetaIndicador
          icono={ArrowDownToLine}
          etiqueta="Ingresos al almacén (unidades)"
          valor={indicadores.Ingresos}
          anterior={indicadores.IngresosSemanaAnterior}
          clase="bg-emerald-50 text-emerald-700"
        />
        <TarjetaIndicador
          icono={ClipboardList}
          etiqueta="Movimientos registrados"
          valor={indicadores.Movimientos}
          anterior={indicadores.MovimientosSemanaAnterior}
          clase="bg-slate-100 text-slate-700"
        />
        <TarjetaIndicador
          icono={Warehouse}
          etiqueta="Stock actual (unidades)"
          valor={indicadores.StockTotal}
          detalle={
            indicadores.InsumosEnAlerta
              ? `${numero(indicadores.InsumosEnAlerta)} ${indicadores.InsumosEnAlerta === 1 ? "insumo" : "insumos"} con stock bajo o crítico`
              : "Ningún insumo en alerta"
          }
          clase={indicadores.InsumosEnAlerta ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}
        />
      </div>

      <GraficoSemana
        titulo="Movimientos de la semana"
        medidas={MEDIDAS}
        dias={datos.Dias.map((dia) => ({ ...dia, Series: dia.Insumos.map(serie) }))}
        series={datos.Insumos.map(serie)}
        resumenSerie={(insumo) => (
          <>
            <span className="font-extrabold text-slate-900">{numero(insumo.Salidas)}</span> sal. ·{" "}
            <span className="font-extrabold text-slate-900">{numero(insumo.Ingresos)}</span> ing.
          </>
        )}
        vacio={{
          titulo: "Sin movimientos esta semana",
          descripcion: "Cuando entren o salgan insumos aparecerán aquí por día.",
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SinMovimiento insumos={datos.SinMovimiento} dias={datos.DiasSinMovimiento} />
        <UltimosMovimientos
          descripcion="Lo más reciente de esta semana"
          movimientos={datos.UltimosMovimientos.map((m) => ({
            id: m.IdMovimientoInsumo,
            idTipoMovimiento: m.IdTipoMovimiento,
            movimiento: m.NombreMovimiento,
            titulo: `${numero(m.Cantidad)} u. · ${m.NombreInsumo}`,
            fecha: m.FechaMovimiento,
            usuario: m.Usuario,
            observacion: m.Observacion,
          }))}
        />
      </div>
    </div>
  );
}
