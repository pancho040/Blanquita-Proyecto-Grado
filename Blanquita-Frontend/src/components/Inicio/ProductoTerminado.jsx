import {
  Boxes,
  CircleMinus,
  CirclePlus,
  ClipboardList,
  Combine,
  FileChartColumn,
  FileDown,
  Layers,
  PackageCheck,
  PackageMinus,
  PackageX,
  PencilLine,
  Send,
  ShelvingUnit,
  Sun,
  Trophy,
  Truck,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useDescarga } from "@/hooks/useDescarga";
import { descargarReporteDespacho } from "@/services/Inventario/Reportes";
import {
  verInicioInventarioProducto,
  verInicioProduccionProducto,
  verInicioSalidasProducto,
} from "@/services/Inventario/Inicio";
import { ESTILO_STOCK, estadoStock } from "@/utils/stock";
import { dateFormatter } from "@/utils/dates";
import {
  AccesosRapidos,
  Bloque,
  CargandoInicio,
  EncabezadoSemana,
  EnlaceBloque,
  ErrorInicio,
  GraficoSemana,
  SelectorPestanas,
  SinDatos,
  TarjetaIndicador,
  UltimosMovimientos,
  numero,
  useInicio,
  usePestanaGuardada,
} from "@/components/Inicio/comunes";

const RUTA = "/encargado/producto";
const RUTA_REPORTES = "/encargado/reportes/producto";
const CLAVE_PESTANA = "encargado.inicio.producto";

const PESTANAS = {
  inventario: { texto: "Inventario", icono: ShelvingUnit },
  produccion: { texto: "Producción", icono: PackageCheck },
  salidas: { texto: "Salidas", icono: Truck },
};

const TONO_MOVIMIENTO = {
  1: "bg-emerald-50 text-emerald-700",
  2: "bg-c4/10 text-c3",
  3: "bg-red-50 text-red-700",
  4: "bg-emerald-50 text-emerald-700",
  5: "bg-amber-50 text-amber-700",
  6: "bg-amber-50 text-amber-700",
};

const ORDEN_STOCK = { critico: 0, agotado: 1, bajo: 2, disponible: 3 };

const MEDIDAS = (texto) => [
  { valor: "Unidades", texto: "Unidades", descripcion: `${texto} en unidades por día y línea` },
  { valor: "Contenedores", texto: "Jabas y planchas", descripcion: `${texto} en jabas y planchas por día y línea` },
];

const contenedor = (tipo, cantidad) => {
  const nombre = (tipo || "unidad").toLowerCase();
  return cantidad === 1 ? nombre : `${nombre}s`;
};

const serie = (linea) => ({ ...linea, Id: linea.IdProducto, Nombre: linea.NombreProducto });

const movimiento = (m) => ({
  id: m.IdMovimientoProductoTerminado,
  tono: TONO_MOVIMIENTO[m.IdTipoMovimientoInventario],
  movimiento: m.NombreTipoMovimientoInventario,
  titulo: `${numero(m.Cantidad)} ${contenedor(m.TipoContenedor, m.Cantidad)} · ${m.CodigoPresentacion}`,
  fecha: m.FechaMovimiento,
  usuario: m.Usuario,
  observacion: m.Observacion,
});

const resumenLinea = (linea) => (
  <>
    <span className="font-extrabold text-slate-900">{numero(linea.Unidades)}</span> u. ·{" "}
    <span className="font-extrabold text-slate-900">{numero(linea.Contenedores)}</span> jab./pl.
  </>
);

function Pestana({ cargar, children }) {
  const { datos, error, recargar } = useInicio(cargar);
  if (error && !datos) return <ErrorInicio mensaje={error} onReintentar={recargar} />;
  if (!datos) return <CargandoInicio />;
  return children(datos);
}

function LineaStock({ linea }) {
  const visibles = linea.Presentaciones.filter((p) => p.Activo || p.CantidadActual > 0);
  return (
    <div className="flex flex-col gap-2 rounded-xl p-3 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[14px] font-extrabold text-slate-900">
          {linea.NombreProducto}
          {!linea.Activo && <span className="ml-1.5 text-[11px] font-bold text-slate-400">Inactiva</span>}
        </div>
        <div className="text-[12px] text-slate-500">
          <span className="font-extrabold tabular-nums text-slate-900">{numero(linea.Unidades)}</span> unidades
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {visibles.map((p) => {
          const estado = estadoStock(p.CantidadActual, p);
          const estilo = ESTILO_STOCK[estado];
          return (
            <div key={p.IdPresentacion} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-mono text-[12.5px] font-bold text-slate-800">
                  {p.CodigoPresentacion}
                  {!p.Activo && <span className="ml-1.5 font-sans text-[10.5px] font-bold text-slate-400">Inactiva</span>}
                </span>
                <span className="text-[11.5px] text-slate-500">{numero(p.Unidades)} unidades</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={cn("text-[15px] font-extrabold tabular-nums", estilo.numero)}>
                  {numero(p.CantidadActual)}
                  <span className="ml-1 text-[11px] font-semibold text-slate-500">
                    {contenedor(p.TipoContenedor, p.CantidadActual)}
                  </span>
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", estilo.clase)}>{estilo.texto}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function prioridadLinea(linea) {
  return Math.min(
    ...linea.Presentaciones.filter((p) => p.Activo).map((p) => ORDEN_STOCK[estadoStock(p.CantidadActual, p)]),
    ORDEN_STOCK.disponible,
  );
}

function ListaPendientes({ titulo, items, vacio, detalle }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">{titulo}</div>
      {items.length ? (
        items.map((p) => (
          <div key={p.IdPresentacion} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <span className="min-w-0">
              <span className="block truncate font-mono text-[12.5px] font-bold text-slate-800">{p.CodigoPresentacion}</span>
              <span className="text-[11.5px] text-slate-500">{detalle(p)}</span>
            </span>
            <span className="shrink-0 text-[12.5px] font-extrabold tabular-nums text-slate-700">
              {numero(p.CantidadActual)} {contenedor(p.TipoContenedor, p.CantidadActual)}
            </span>
          </div>
        ))
      ) : (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-500">{vacio}</div>
      )}
    </div>
  );
}

function InventarioPT() {
  return (
    <Pestana cargar={verInicioInventarioProducto}>
      {(datos) => {
        const lineas = [...datos.Lineas]
          .filter((l) => l.Activo || l.CantidadActual > 0)
          .sort((a, b) => prioridadLinea(a) - prioridadLinea(b));
        return (
          <div className="flex flex-col gap-4">
            <AccesosRapidos
              accesos={[
                { texto: "Inventario final", href: `${RUTA}/inventario`, icono: Boxes },
                { texto: "Movimientos", href: `${RUTA}/movimientos`, icono: Combine },
                { texto: "Reporte de inventario", href: `${RUTA_REPORTES}/inventario`, icono: FileChartColumn },
              ]}
            />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <TarjetaIndicador
                icono={Layers}
                etiqueta="Unidades en almacén"
                valor={datos.UnidadesTotales}
                detalle={`En ${numero(lineas.length)} líneas`}
              />
              <TarjetaIndicador
                icono={PackageX}
                etiqueta="Presentaciones agotadas"
                valor={datos.Alertas.Agotadas}
                detalle="Activas sin stock"
                clase={datos.Alertas.Agotadas ? "bg-slate-200 text-slate-700" : "bg-slate-100 text-slate-500"}
              />
              <TarjetaIndicador
                icono={TriangleAlert}
                etiqueta="En stock crítico"
                valor={datos.Alertas.Criticas}
                detalle="En o bajo el mínimo"
                clase={datos.Alertas.Criticas ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"}
              />
              <TarjetaIndicador
                icono={PackageMinus}
                etiqueta="En stock bajo"
                valor={datos.Alertas.Bajas}
                detalle="En o bajo el preventivo"
                clase={datos.Alertas.Bajas ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}
              />
            </div>

            <Bloque
              titulo="Stock por línea"
              descripcion="Jabas y planchas por presentación, con su equivalente en unidades"
              icono={ShelvingUnit}
              accion={<EnlaceBloque href={`${RUTA}/inventario`}>Inventario</EnlaceBloque>}
            >
              {lineas.length ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {lineas.map((linea) => (
                    <LineaStock key={linea.IdProducto} linea={linea} />
                  ))}
                </div>
              ) : (
                <SinDatos icono={ShelvingUnit} titulo="Sin líneas de producto" />
              )}
            </Bloque>

            <EncabezadoSemana datos={datos} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TarjetaIndicador
                icono={CirclePlus}
                etiqueta={`Ajustes positivos (${numero(datos.AjustesPositivos.Contenedores)} jab./pl.)`}
                valor={datos.AjustesPositivos.Registros}
                anterior={datos.AjustesPositivos.RegistrosSemanaAnterior}
                menosEsMejor
                clase="bg-amber-50 text-amber-700"
              />
              <TarjetaIndicador
                icono={CircleMinus}
                etiqueta={`Ajustes negativos (${numero(datos.AjustesNegativos.Contenedores)} jab./pl.)`}
                valor={datos.AjustesNegativos.Registros}
                anterior={datos.AjustesNegativos.RegistrosSemanaAnterior}
                menosEsMejor
                clase="bg-amber-50 text-amber-700"
              />
              <TarjetaIndicador
                icono={PencilLine}
                etiqueta={`Correcciones (${numero(datos.Correcciones.Contenedores)} jab./pl.)`}
                valor={datos.Correcciones.Registros}
                anterior={datos.Correcciones.RegistrosSemanaAnterior}
                menosEsMejor
                clase="bg-red-50 text-red-700"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Bloque titulo="Pendientes de revisar" descripcion="Stock que podría quedar olvidado" icono={ClipboardList}>
                <div className="flex flex-col gap-4">
                  <ListaPendientes
                    titulo={`Sin movimiento en ${datos.DiasSinMovimiento} días`}
                    items={datos.SinMovimiento}
                    vacio="Todas las presentaciones con stock se movieron recientemente."
                    detalle={(p) =>
                      `${p.NombreProducto} · ${p.FechaUltimoMovimiento ? `último ${dateFormatter(p.FechaUltimoMovimiento).split(",")[0]}` : "sin movimientos"}`
                    }
                  />
                  {datos.InactivasConStock.length > 0 && (
                    <ListaPendientes
                      titulo="Inactivas con stock por consumir"
                      items={datos.InactivasConStock}
                      vacio=""
                      detalle={(p) => p.NombreProducto}
                    />
                  )}
                </div>
              </Bloque>
              <UltimosMovimientos movimientos={datos.UltimosMovimientos.map(movimiento)} />
            </div>
          </div>
        );
      }}
    </Pestana>
  );
}

function PorTurno({ turnos }) {
  const maximo = Math.max(...turnos.map((t) => Math.abs(t.Unidades)), 1);
  return (
    <Bloque titulo="Ingresos por turno" descripcion="Según la hora del registro" icono={Sun}>
      <div className="flex flex-col gap-3">
        {turnos.map((turno) => (
          <div key={turno.NombreTurno} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="font-bold text-slate-700">{turno.NombreTurno}</span>
              <span className="tabular-nums text-slate-500">
                <span className="font-extrabold text-slate-900">{numero(turno.Unidades)}</span> unidades ·{" "}
                {turno.Registros} {turno.Registros === 1 ? "registro" : "registros"}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(Math.max(turno.Unidades, 0) / maximo) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Bloque>
  );
}

function ProduccionPT() {
  return (
    <Pestana cargar={verInicioProduccionProducto}>
      {(datos) => (
        <div className="flex flex-col gap-4">
          <AccesosRapidos
            accesos={[
              { texto: "Registrar ingreso", href: `${RUTA}/movimientos`, icono: PackageCheck },
              { texto: "Inventario final", href: `${RUTA}/inventario`, icono: Boxes },
              { texto: "Reporte de producción", href: `${RUTA_REPORTES}/produccion`, icono: FileChartColumn },
            ]}
          />

          <EncabezadoSemana datos={datos} />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TarjetaIndicador
              icono={Layers}
              etiqueta="Unidades ingresadas (netas)"
              valor={datos.Indicadores.Unidades}
              anterior={datos.Indicadores.UnidadesSemanaAnterior}
            />
            <TarjetaIndicador
              icono={PackageCheck}
              etiqueta="Jabas y planchas (netas)"
              valor={datos.Indicadores.Contenedores}
              anterior={datos.Indicadores.ContenedoresSemanaAnterior}
              clase="bg-emerald-50 text-emerald-700"
            />
            <TarjetaIndicador
              icono={ClipboardList}
              etiqueta="Registros de ingreso"
              valor={datos.Indicadores.Ingresos}
              anterior={datos.Indicadores.IngresosSemanaAnterior}
              clase="bg-slate-100 text-slate-700"
            />
            <TarjetaIndicador
              icono={PencilLine}
              etiqueta="Correcciones (descuentos)"
              valor={datos.Indicadores.Descuentos}
              anterior={datos.Indicadores.DescuentosSemanaAnterior}
              menosEsMejor
              clase="bg-red-50 text-red-700"
            />
          </div>

          <GraficoSemana
            titulo="Ingresos de la semana"
            medidas={MEDIDAS("Entradas menos correcciones")}
            dias={datos.Dias.map((dia) => ({ ...dia, Series: dia.Lineas.map(serie) }))}
            series={datos.Lineas.map(serie)}
            resumenSerie={resumenLinea}
            vacio={{
              titulo: "Sin ingresos esta semana",
              descripcion: "Cuando se registre producto terminado aparecerá aquí por día.",
            }}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PorTurno turnos={datos.Turnos} />
            <UltimosMovimientos
              descripcion="Ingresos y correcciones más recientes"
              movimientos={datos.UltimosIngresos.map(movimiento)}
            />
          </div>
        </div>
      )}
    </Pestana>
  );
}

function BotonComprobante({ idDespacho }) {
  const { descargando, iniciar } = useDescarga(() => descargarReporteDespacho(idDespacho), "Comprobante descargado");
  return (
    <Button variant="outline" size="sm" onClick={iniciar} disabled={descargando} className="shrink-0">
      <FileDown size={14} />
      {descargando ? "Descargando…" : "PDF"}
    </Button>
  );
}

function FilaDespacho({ despacho }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span className="min-w-0">
        <span className="block text-[13px] font-extrabold text-slate-900">
          Salida N° {despacho.IdDespacho}
          <span className="ml-2 text-[11.5px] font-semibold text-slate-500">{dateFormatter(despacho.FechaMovimiento)}</span>
        </span>
        <span className="block text-[11.5px] text-slate-500">
          {numero(despacho.CantidadTotal)} jab./pl. en {despacho.NumeroPresentaciones}{" "}
          {despacho.NumeroPresentaciones === 1 ? "presentación" : "presentaciones"} · {despacho.Usuario}
        </span>
        {despacho.Observacion && <span className="block truncate text-[11.5px] text-slate-500">{despacho.Observacion}</span>}
      </span>
      <BotonComprobante idDespacho={despacho.IdDespacho} />
    </div>
  );
}

function SalidasPT() {
  return (
    <Pestana cargar={verInicioSalidasProducto}>
      {(datos) => (
        <div className="flex flex-col gap-4">
          <AccesosRapidos
            accesos={[
              { texto: "Registrar salida", href: `${RUTA}/movimientos`, icono: Send },
              { texto: "Ver salidas", href: `${RUTA}/salidas`, icono: Truck },
              { texto: "Reporte de salidas", href: `${RUTA_REPORTES}/salidas`, icono: FileChartColumn },
            ]}
          />

          <Bloque
            titulo="Último despacho"
            icono={Truck}
            accion={<EnlaceBloque href={`${RUTA}/salidas`}>Ver salidas</EnlaceBloque>}
          >
            {datos.UltimoDespacho ? (
              <FilaDespacho despacho={datos.UltimoDespacho} />
            ) : (
              <SinDatos icono={Truck} titulo="Aún no hay salidas registradas" />
            )}
          </Bloque>

          <EncabezadoSemana datos={datos} />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TarjetaIndicador
              icono={Truck}
              etiqueta="Despachos"
              valor={datos.Indicadores.Despachos}
              anterior={datos.Indicadores.DespachosSemanaAnterior}
            />
            <TarjetaIndicador
              icono={Layers}
              etiqueta="Unidades despachadas"
              valor={datos.Indicadores.Unidades}
              anterior={datos.Indicadores.UnidadesSemanaAnterior}
              clase="bg-emerald-50 text-emerald-700"
            />
            <TarjetaIndicador
              icono={Send}
              etiqueta="Jabas y planchas"
              valor={datos.Indicadores.Contenedores}
              anterior={datos.Indicadores.ContenedoresSemanaAnterior}
              clase="bg-slate-100 text-slate-700"
            />
            <TarjetaIndicador
              icono={Boxes}
              etiqueta="Presentaciones despachadas"
              valor={datos.Indicadores.Presentaciones}
              detalle="Distintas en la semana"
              clase="bg-slate-100 text-slate-700"
            />
          </div>

          <GraficoSemana
            titulo="Salidas de la semana"
            medidas={MEDIDAS("Despachado")}
            dias={datos.Dias.map((dia) => ({ ...dia, Series: dia.Lineas.map(serie) }))}
            series={datos.Lineas.map(serie)}
            resumenSerie={(linea) => (
              <>
                {resumenLinea(linea)} · {linea.Registros} desp.
              </>
            )}
            vacio={{
              titulo: "Sin salidas esta semana",
              descripcion: "Cuando se registren despachos aparecerán aquí por día.",
            }}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Bloque titulo="Más despachadas" descripcion="Presentaciones con más unidades en la semana" icono={Trophy}>
              {datos.PresentacionesDestacadas.length ? (
                <div className="flex flex-col gap-1.5">
                  {datos.PresentacionesDestacadas.map((p, indice) => (
                    <div key={p.IdPresentacion} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-c4/10 text-[11px] font-extrabold text-c3">
                          {indice + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-[12.5px] font-bold text-slate-800">{p.CodigoPresentacion}</span>
                          <span className="text-[11.5px] text-slate-500">
                            {p.NombreProducto} · quedan {numero(p.CantidadActual)} {contenedor(p.TipoContenedor, p.CantidadActual)}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-[12px] tabular-nums text-slate-500">
                        <span className="block font-extrabold text-slate-900">{numero(p.Unidades)} u.</span>
                        {numero(p.Contenedores)} {contenedor(p.TipoContenedor, p.Contenedores)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <SinDatos icono={Trophy} titulo="Sin despachos esta semana" />
              )}
            </Bloque>

            <Bloque titulo="Despachos de la semana" descripcion="Con su comprobante" icono={ClipboardList}>
              {datos.Despachos.length ? (
                <div className="flex flex-col gap-1.5">
                  {datos.Despachos.map((despacho) => (
                    <FilaDespacho key={despacho.IdDespacho} despacho={despacho} />
                  ))}
                </div>
              ) : (
                <SinDatos icono={ClipboardList} titulo="Sin despachos esta semana" />
              )}
            </Bloque>
          </div>
        </div>
      )}
    </Pestana>
  );
}

const CONTENIDO = {
  inventario: InventarioPT,
  produccion: ProduccionPT,
  salidas: SalidasPT,
};

export default function InicioProductoTerminado() {
  const [pestana, cambiar] = usePestanaGuardada(CLAVE_PESTANA, Object.keys(PESTANAS), "inventario");
  const Contenido = CONTENIDO[pestana];

  return (
    <div className="flex flex-col gap-4">
      <SelectorPestanas pestanas={PESTANAS} valor={pestana} onCambiar={cambiar} />

      <Contenido key={pestana} />
    </div>
  );
}
