import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChartColumn,
  CirclePause,
  Factory,
  Minus,
  PackageOpen,
  RotateCcwClock,
  RotateCw,
  Timer,
  TriangleAlert,
  Truck,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { ESTILO_STOCK, estadoStock } from "@/utils/stock";
import { dateFormatter, dateOnlyFormatter, diaSemanaCorto, formatearSegundos, segundosDesde } from "@/utils/dates";

export const COLORES_SERIES = ["#1C96C5", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#64748b"];

export const colorSerie = (indice) => COLORES_SERIES[indice % COLORES_SERIES.length];

export const numero = (valor) => Number(valor || 0).toLocaleString("es-BO");

const ORDEN_STOCK = { critico: 0, agotado: 1, bajo: 2, disponible: 3 };

const RELLENO_STOCK = {
  disponible: "bg-emerald-500",
  bajo: "bg-amber-500",
  critico: "bg-red-500",
  agotado: "bg-slate-300",
};

export function useAhora(intervaloMs = 60000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return ahora;
}

export function usePestanaGuardada(clave, opciones, inicial) {
  const [pestana, setPestana] = useState(inicial);

  useEffect(() => {
    try {
      const guardada = localStorage.getItem(clave);
      if (opciones.includes(guardada)) setPestana(guardada);
    } catch {
    }
  }, []);

  const cambiar = (nueva) => {
    if (!opciones.includes(nueva)) return;
    setPestana(nueva);
    try {
      localStorage.setItem(clave, nueva);
    } catch {
    }
  };

  return [pestana, cambiar];
}

export function SelectorPestanas({ pestanas, valor, onCambiar, className = "sm:w-[480px]" }) {
  const entradas = Object.entries(pestanas);
  return (
    <Tabs value={valor} onValueChange={onCambiar}>
      <TabsList className={cn("grid h-auto w-full", className)} style={{ gridTemplateColumns: `repeat(${entradas.length}, minmax(0, 1fr))` }}>
        {entradas.map(([id, pestana]) => {
          const Icono = pestana.icono;
          return (
            <TabsTrigger key={id} value={id} className="gap-1.5 py-1.5 font-bold">
              <Icono size={15} strokeWidth={2.75} />
              {pestana.corto ? (
                <>
                  <span className="sm:hidden">{pestana.corto}</span>
                  <span className="hidden sm:inline">{pestana.texto}</span>
                </>
              ) : (
                pestana.texto
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

export function useInicio(cargar) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");

  const recargar = async () => {
    setError("");
    try {
      setDatos(await cargar());
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    recargar();
  }, []);

  return { datos, error, recargar };
}

export function Bloque({ titulo, descripcion, icono: Icono, accion, className, children }) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icono && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-c4/10 text-c3">
              <Icono size={17} />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold leading-tight text-slate-900">{titulo}</h2>
            {descripcion && <p className="mt-0.5 text-[12.5px] text-slate-500">{descripcion}</p>}
          </div>
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

export function EnlaceBloque({ href, children = "Ver todo" }) {
  return (
    <a href={href} className="group flex shrink-0 items-center gap-1 text-xs font-bold text-c3 hover:text-c4">
      {children}
      <ArrowRight size={13} strokeWidth={2.75} className="transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

function Variacion({ valor, anterior, menosEsMejor, formato }) {
  const diferencia = valor - anterior;
  if (diferencia === 0) {
    return (
      <span className="flex items-center gap-1 text-slate-500">
        <Minus size={13} />
        Igual que la semana pasada
      </span>
    );
  }
  const sube = diferencia > 0;
  const mejora = menosEsMejor ? !sube : sube;
  const Icono = sube ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("flex items-center gap-1", mejora ? "text-emerald-600" : "text-red-600")}>
      <Icono size={14} strokeWidth={2.5} />
      {sube ? "+" : "−"}
      {formato(Math.abs(diferencia))} vs. semana pasada
    </span>
  );
}

export function TarjetaIndicador({
  icono: Icono,
  etiqueta,
  valor,
  anterior,
  formato = numero,
  menosEsMejor = false,
  clase = "bg-c4/10 text-c3",
  detalle,
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2.5">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", clase)}>
          <Icono size={18} />
        </div>
        <div className="text-[12.5px] font-semibold leading-tight text-slate-500">{etiqueta}</div>
      </div>
      <div className="text-2xl font-extrabold tabular-nums text-slate-900">{formato(valor)}</div>
      <div className="text-[11.5px] font-semibold leading-snug">
        {anterior !== undefined ? (
          <Variacion valor={valor} anterior={anterior} menosEsMejor={menosEsMejor} formato={formato} />
        ) : (
          <span className="text-slate-500">{detalle}</span>
        )}
      </div>
    </div>
  );
}

export function TarjetaPausas({ indicadores }) {
  return (
    <TarjetaIndicador
      icono={CirclePause}
      etiqueta={`Tiempo en pausa (${numero(indicadores.Pausas)} pausas)`}
      valor={indicadores.SegundosPausa}
      anterior={indicadores.SegundosPausaSemanaAnterior}
      formato={formatearSegundos}
      menosEsMejor
      clase="bg-amber-50 text-amber-700"
    />
  );
}

export function SinDatos({ icono: Icono, titulo, descripcion }) {
  return (
    <Empty className="border border-slate-200 bg-slate-50/60 p-5">
      <EmptyHeader>
        {Icono && (
          <EmptyMedia variant="icon" className="bg-white text-slate-500 ring-1 ring-slate-200">
            <Icono />
          </EmptyMedia>
        )}
        <EmptyTitle className="text-[13.5px] font-bold text-slate-700">{titulo}</EmptyTitle>
        {descripcion && <EmptyDescription className="text-[12.5px]">{descripcion}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  );
}

export function AvisoAtraso({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
      <TriangleAlert size={12} strokeWidth={2.5} />
      {children}
    </span>
  );
}

export function AccesosRapidos({ accesos }) {
  return (
    <div className="flex flex-wrap gap-2">
      {accesos.map(({ texto, href, icono: Icono }) => (
        <a
          key={href}
          href={href}
          className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition-colors hover:text-c3 hover:ring-c4/40"
        >
          <Icono size={15} className="text-c3" />
          {texto}
        </a>
      ))}
    </div>
  );
}

function ItemProduccion({ href, titulo, subtitulo, codigos, valor, motivo, detalles, pausa, atrasada, aviso, ahora, desde }) {
  const tiempo = formatearSegundos(segundosDesde(desde, ahora));
  return (
    <a
      href={href}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl p-3 ring-1 transition-colors hover:bg-slate-50",
        atrasada ? "bg-red-50/40 ring-red-200" : pausa ? "ring-amber-200" : "ring-slate-200",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13.5px] font-extrabold text-slate-900">
          {titulo}
          {subtitulo && <span className="font-semibold text-slate-500"> · {subtitulo}</span>}
        </div>
        {pausa ? (
          <div
            className={cn(
              "flex items-center gap-1 text-[13px] font-extrabold tabular-nums",
              atrasada ? "text-red-600" : "text-amber-600",
            )}
          >
            <CirclePause size={14} />
            {tiempo}
          </div>
        ) : (
          valor && <div className="text-[13px] font-extrabold tabular-nums text-c3">{valor}</div>
        )}
      </div>
      <div className="font-mono text-[12px] text-slate-600">{codigos}</div>
      {pausa && <div className="text-[12.5px] text-slate-700">{motivo || "Sin motivo registrado"}</div>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
        {!pausa && (
          <span className="flex items-center gap-1">
            <Timer size={13} />
            {tiempo} en producción
          </span>
        )}
        {detalles.filter(Boolean).map((detalle) => (
          <span key={detalle}>{detalle}</span>
        ))}
        {atrasada && <AvisoAtraso>{aviso}</AvisoAtraso>}
      </div>
    </a>
  );
}

export function ProduccionAhora({ href, activas, pausadas, horasAlerta, descripcionActivas, aItem }) {
  const ahora = useAhora();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Bloque
        titulo={`Producciones activas (${activas.length})`}
        descripcion={descripcionActivas}
        icono={Factory}
        accion={<EnlaceBloque href={href} />}
      >
        {activas.length ? (
          <div className="flex flex-col gap-2">
            {activas.map((item) => {
              const datos = aItem(item);
              return (
                <ItemProduccion
                  key={datos.id}
                  {...datos}
                  href={href}
                  ahora={ahora}
                  aviso="Abierta desde otro día"
                />
              );
            })}
          </div>
        ) : (
          <SinDatos icono={Factory} titulo="Sin producciones activas" descripcion="No hay máquinas corriendo en este momento." />
        )}
      </Bloque>

      <Bloque
        titulo={`Pausas abiertas (${pausadas.length})`}
        descripcion="Recuerda reanudarlas para no inflar las duraciones"
        icono={CirclePause}
        accion={<EnlaceBloque href={href} />}
      >
        {pausadas.length ? (
          <div className="flex flex-col gap-2">
            {pausadas.map((item) => {
              const datos = aItem(item);
              return (
                <ItemProduccion
                  key={datos.id}
                  {...datos}
                  href={href}
                  ahora={ahora}
                  pausa
                  aviso={`Pausa de más de ${horasAlerta} h`}
                />
              );
            })}
          </div>
        ) : (
          <SinDatos icono={CirclePause} titulo="Sin pausas abiertas" descripcion="Todas las producciones están corriendo o cerradas." />
        )}
      </Bloque>
    </div>
  );
}

function BarraStock({ item }) {
  const estado = estadoStock(item.cantidad, item);
  const estilo = ESTILO_STOCK[estado];
  const conUmbral = item.StockMinimo !== null && item.StockPreventivo !== null;
  const tope = Math.max(item.cantidad, conUmbral ? item.StockPreventivo * 2 : item.cantidad, 1);
  const porcentaje = (valor) => `${Math.min((valor / tope) * 100, 100)}%`;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl p-3 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13.5px] font-extrabold text-slate-900">
          {item.nombre}
          {!item.activo && <span className="ml-1.5 text-[11px] font-bold text-slate-400">Inactivo</span>}
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", estilo.clase)}>{estilo.texto}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-xl font-extrabold tabular-nums", estilo.numero)}>{numero(item.cantidad)}</span>
        <span className="text-[12px] font-semibold text-slate-500">{item.unidad}</span>
      </div>
      {conUmbral ? (
        <>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={cn("h-full rounded-full transition-all", RELLENO_STOCK[estado])} style={{ width: porcentaje(item.cantidad) }} />
            <div className="absolute inset-y-0 w-0.5 bg-red-400" style={{ left: porcentaje(item.StockMinimo) }} />
            <div className="absolute inset-y-0 w-0.5 bg-amber-400" style={{ left: porcentaje(item.StockPreventivo) }} />
          </div>
          <div className="text-[11.5px] text-slate-500">
            Mínimo {numero(item.StockMinimo)} · Preventivo {numero(item.StockPreventivo)}
          </div>
        </>
      ) : (
        <div className="text-[11.5px] text-slate-400">Sin alerta de stock configurada</div>
      )}
    </div>
  );
}

export function GrillaStock({ items, vacio = "Sin tipos registrados" }) {
  const visibles = items
    .filter((item) => item.activo || item.cantidad > 0)
    .sort((a, b) => ORDEN_STOCK[estadoStock(a.cantidad, a)] - ORDEN_STOCK[estadoStock(b.cantidad, b)]);

  if (!visibles.length) return <SinDatos icono={PackageOpen} titulo={vacio} />;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {visibles.map((item) => (
        <BarraStock key={item.id} item={item} />
      ))}
    </div>
  );
}

export function EncabezadoSemana({ datos }) {
  return (
    <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-base font-extrabold text-slate-900">Esta semana</h2>
      <span className="text-[12.5px] font-semibold text-slate-500">
        {dateOnlyFormatter(datos.FechaInicio)} – {dateOnlyFormatter(datos.FechaFin)} · comparado con el mismo período de la semana pasada
      </span>
    </div>
  );
}

export function GraficoSemana({ titulo, medidas, dias, series, resumenSerie, vacio }) {
  const [medida, setMedida] = useState(medidas[0].valor);
  const actual = medidas.find((m) => m.valor === medida) ?? medidas[0];

  const config = useMemo(
    () => Object.fromEntries(series.map((serie, indice) => [`s${serie.Id}`, { label: serie.Nombre, color: colorSerie(indice) }])),
    [series],
  );

  const datos = useMemo(
    () =>
      dias.map((dia) => ({
        Dia: diaSemanaCorto(dia.Fecha),
        ...Object.fromEntries(series.map((serie) => [`s${serie.Id}`, 0])),
        ...Object.fromEntries(dia.Series.map((serie) => [`s${serie.Id}`, serie[medida]])),
      })),
    [dias, series, medida],
  );

  const total = series.reduce((suma, serie) => suma + serie[medida], 0);

  return (
    <Bloque
      titulo={titulo}
      descripcion={actual.descripcion}
      icono={CalendarDays}
      accion={
        <ToggleGroup value={[medida]} className="flex gap-1.5">
          {medidas.map((m) => (
            <ToggleGroupItem key={m.valor} value={m.valor} onClick={() => setMedida(m.valor)} className={cn(PILDORA_FILTRO, "px-3 py-1.5")}>
              {m.texto}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      {total > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <BarChart data={datos} margin={{ left: -16, right: 4, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="Dia" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
              {series.map((serie, indice) => (
                <Bar
                  key={serie.Id}
                  dataKey={`s${serie.Id}`}
                  stackId="semana"
                  fill={`var(--color-s${serie.Id})`}
                  radius={indice === series.length - 1 ? [4, 4, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ChartContainer>

          <div className="flex flex-col gap-2">
            <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Resumen</div>
            {series.map((serie, indice) => (
              <div key={serie.Id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-[13px] font-bold text-slate-700">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: colorSerie(indice) }} />
                  <span className="truncate">{serie.Nombre}</span>
                </span>
                <span className="text-right text-[12px] tabular-nums text-slate-500">{resumenSerie(serie)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <SinDatos icono={ChartColumn} titulo={vacio.titulo} descripcion={vacio.descripcion} />
      )}
    </Bloque>
  );
}

export function PausasPorMotivo({ motivos, total }) {
  const maximo = Math.max(...motivos.map((m) => m.Segundos), 1);
  return (
    <Bloque titulo="Tiempo en pausa por motivo" descripcion="Pausas iniciadas esta semana" icono={Timer}>
      {motivos.length ? (
        <div className="flex flex-col gap-3">
          {motivos.map((motivo) => (
            <div key={motivo.Motivo} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <span className="min-w-0 font-bold text-slate-700">{motivo.Motivo}</span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  <span className="font-extrabold text-slate-900">{formatearSegundos(motivo.Segundos)}</span> ·{" "}
                  {motivo.Pausas} {motivo.Pausas === 1 ? "pausa" : "pausas"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${(motivo.Segundos / maximo) * 100}%` }} />
              </div>
            </div>
          ))}
          <div className="border-t border-slate-100 pt-2 text-right text-[12px] text-slate-500">
            Total <span className="font-extrabold text-slate-900">{formatearSegundos(total)}</span>
          </div>
        </div>
      ) : (
        <SinDatos icono={Timer} titulo="Sin pausas esta semana" />
      )}
    </Bloque>
  );
}

export function FueraInventario({ titulo, descripcion, icono, href, cantidad, items, vacio }) {
  return (
    <Bloque
      titulo={`${titulo} (${cantidad})`}
      descripcion={descripcion}
      icono={icono}
      accion={cantidad > 0 && <EnlaceBloque href={href}>Reingresar</EnlaceBloque>}
    >
      {cantidad ? (
        <div className="flex flex-col gap-1.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-mono text-[12.5px] font-bold text-slate-800">{item.codigo}</span>
                <span className="text-[11.5px] text-slate-500">{item.detalle}</span>
              </span>
              {item.fecha && (
                <span className="shrink-0 text-[11.5px] text-slate-500">{dateFormatter(item.fecha).split(",")[0]}</span>
              )}
            </div>
          ))}
          {cantidad > items.length && <div className="text-[12px] text-slate-500">y {cantidad - items.length} más</div>}
        </div>
      ) : (
        <SinDatos icono={PackageOpen} titulo="Nada pendiente" descripcion={vacio} />
      )}
    </Bloque>
  );
}

function Dato({ etiqueta, valor, ancho }) {
  return (
    <div className={cn("rounded-lg bg-slate-50 px-3 py-2", ancho && "col-span-2")}>
      <div className="text-slate-500">{etiqueta}</div>
      <div className="font-extrabold text-slate-900">{valor}</div>
    </div>
  );
}

export function UltimoLote({ href, lote }) {
  return (
    <Bloque titulo="Último lote recibido" icono={Truck} accion={<EnlaceBloque href={href}>Ingresar lote</EnlaceBloque>}>
      {lote ? (
        <div className="grid grid-cols-2 gap-2 text-[12.5px]">
          <Dato etiqueta="Lote" valor={lote.codigo} />
          <Dato etiqueta="Recepción" valor={dateOnlyFormatter(lote.fecha)} />
          <Dato etiqueta="Proveedor" valor={lote.proveedor} ancho />
          <Dato etiqueta="Contenido" valor={lote.contenido} ancho />
        </div>
      ) : (
        <SinDatos icono={Truck} titulo="Aún no hay lotes registrados" />
      )}
    </Bloque>
  );
}

const TONO_MOVIMIENTO = {
  1: "bg-emerald-50 text-emerald-700",
  2: "bg-c4/10 text-c3",
  3: "bg-amber-50 text-amber-700",
  6: "bg-amber-50 text-amber-700",
  8: "bg-slate-100 text-slate-600",
};

export function Reingresables({ items, minutos, href, unidad }) {
  const ahora = useAhora(30000);
  const vigentes = items
    .map((item) => ({ ...item, restantes: minutos * 60 - segundosDesde(item.fecha, ahora) }))
    .filter((item) => item.restantes > 0);

  return (
    <Bloque
      titulo={`Se pueden reingresar (${vigentes.length})`}
      descripcion={`${unidad} enviadas en los últimos ${minutos} min que aún pueden volver al almacén`}
      icono={Undo2}
      accion={<EnlaceBloque href={href}>Reingresar</EnlaceBloque>}
    >
      {vigentes.length ? (
        <div className="flex flex-col gap-2">
          {vigentes.map((item) => (
            <a
              key={item.id}
              href={href}
              className="flex items-center justify-between gap-3 rounded-xl p-3 ring-1 ring-amber-200 transition-colors hover:bg-slate-50"
            >
              <span className="min-w-0">
                <span className="block truncate font-mono text-[13px] font-extrabold text-slate-900">{item.codigo}</span>
                <span className="text-[12px] text-slate-500">{item.detalle}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[13px] font-extrabold tabular-nums text-amber-600">
                <Timer size={14} />
                quedan {formatearSegundos(item.restantes)}
              </span>
            </a>
          ))}
        </div>
      ) : (
        <SinDatos icono={Undo2} titulo="Nada por reingresar" descripcion="No hay envíos recientes que puedan deshacerse." />
      )}
    </Bloque>
  );
}

export function UltimosMovimientos({ movimientos, descripcion = "Lo más reciente registrado" }) {
  return (
    <Bloque titulo="Últimos movimientos" descripcion={descripcion} icono={RotateCcwClock}>
      {movimientos.length ? (
        <div className="flex flex-col gap-1.5">
          {movimientos.map((m) => (
            <div key={m.id} className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                      m.tono ?? TONO_MOVIMIENTO[m.idTipoMovimiento] ?? "bg-slate-100 text-slate-600",
                    )}
                  >
                    {m.movimiento}
                  </span>
                  <span className="truncate text-[12.5px] font-bold text-slate-800">{m.titulo}</span>
                </span>
                <span className="text-[11.5px] text-slate-500">{dateFormatter(m.fecha)}</span>
              </div>
              <div className="text-[11.5px] text-slate-500">
                {m.usuario}
                {m.observacion && <> · {m.observacion}</>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <SinDatos icono={RotateCcwClock} titulo="Sin movimientos registrados" />
      )}
    </Bloque>
  );
}

export function CargandoInicio() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-full max-w-md rounded-full" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

export function ErrorInicio({ mensaje, onReintentar }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-red-200">
      <TriangleAlert className="text-red-500" />
      <p className="text-sm font-semibold text-slate-700">{mensaje || "No se pudo cargar el resumen"}</p>
      <Button variant="outline" size="sm" onClick={onReintentar}>
        <RotateCw size={14} />
        Reintentar
      </Button>
    </div>
  );
}
