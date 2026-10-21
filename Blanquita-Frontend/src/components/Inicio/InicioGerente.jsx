import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Boxes,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  ClipboardList,
  Combine,
  Factory,
  FileChartColumn,
  Layers,
  PackageCheck,
  PackageX,
  Send,
  Timer,
  TriangleAlert,
  Truck,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AccesosRapidos,
  Bloque,
  CargandoInicio,
  EnlaceBloque,
  ErrorInicio,
  GraficoBarras,
  GrillaStock,
  PausasPorMotivo,
  ProduccionAhora,
  SelectorPestanas,
  SinDatos,
  TarjetaIndicador,
  colorSerie,
  numero,
  useInicio,
  usePestanaGuardada,
} from "@/components/Inicio/comunes";
import { itemProduccion as itemBobinaPapel } from "@/components/Inicio/BobinaPapel";
import { itemProduccion as itemBobinaServilleta } from "@/components/Inicio/BobinaServilleta";
import { FilaDespacho, LineaStock, prioridadLinea } from "@/components/Inicio/ProductoTerminado";
import { verInicioGerente } from "@/services/Inicio/Gerente";
import { useNombreUsuario } from "@/hooks/useNombreUsuario";
import { dateOnlyFormatter, diaSemanaCorto, formatearSegundos } from "@/utils/dates";

const RUTA = "/gerente";
const RUTA_REPORTES = `${RUTA}/reportes`;
const CLAVE_PERIODO = "gerente.inicio.periodo";
const CLAVE_PESTANA = "gerente.inicio.pestana";
const CONTENEDORES = "jab./pl.";

const PERIODOS = {
  semana: { texto: "Esta semana", corto: "Semana", icono: CalendarDays },
  mes: { texto: "Este mes", corto: "Mes", icono: CalendarRange },
};

const PESTANAS = {
  inventario: { texto: "Inventario", icono: Boxes },
  produccion: { texto: "Producción", icono: Factory },
  salidas: { texto: "Salidas", icono: Truck },
};

const TRAMO = {
  semana: {
    titulo: "por día",
    plural: "días",
    detalle: (tramo) => dateOnlyFormatter(tramo.FechaInicio),
  },
  mes: {
    titulo: "por semana",
    plural: "semanas",
    detalle: (tramo) => `Del ${dateOnlyFormatter(tramo.FechaInicio)} al ${dateOnlyFormatter(tramo.FechaFin)}`,
  },
};

const RUTA_INVENTARIO = {
  bobinapapel: "bobina-papel/inventario",
  bobinaservilleta: "bobina-servilleta/inventario",
  subbobina: "bobina-servilleta/inventario",
  rodela: "rodela/inventario",
  empaquebobina: "empaque/bobina-inventario",
  empaquebolsa: "empaque/bolsa-inventario",
  bolsajava: "empaque/jaba-inventario",
  insumo: "insumos/inventario",
};

const ORDEN_MATERIA_PRIMA = [
  "insumo",
  "empaquebobina",
  "empaquebolsa",
  "bolsajava",
  "bobinapapel",
  "bobinaservilleta",
  "subbobina",
  "rodela",
];

const UNIDAD_MATERIA_PRIMA = {
  bobinapapel: "bobinas",
  bobinaservilleta: "bobinas madre",
  subbobina: "sub-bobinas",
  rodela: "pallets",
  empaquebobina: "bobinas",
  empaquebolsa: "paquetes",
  bolsajava: "paquetes",
  insumo: "unidades",
};

const ACCESOS = {
  inventario: [
    { texto: "Inventario final", href: `${RUTA}/producto/inventario`, icono: Boxes },
    { texto: "Reporte de inventario", href: `${RUTA_REPORTES}/producto/inventario`, icono: FileChartColumn },
    { texto: "Reportes", href: `${RUTA_REPORTES}/inicio`, icono: ClipboardList },
  ],
  produccion: [
    { texto: "Producción bobina papel", href: `${RUTA}/bobina-papel/produccion`, icono: Factory },
    { texto: "Producción servilleta", href: `${RUTA}/bobina-servilleta/produccion`, icono: Factory },
    { texto: "Reporte de producción", href: `${RUTA_REPORTES}/producto/produccion`, icono: FileChartColumn },
  ],
  salidas: [
    { texto: "Movimientos", href: `${RUTA}/producto/movimientos`, icono: Combine },
    { texto: "Reporte de salidas", href: `${RUTA_REPORTES}/producto/salidas`, icono: FileChartColumn },
  ],
};

const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

const etiquetaTramo = (periodo, tramo) =>
  periodo === "semana"
    ? diaSemanaCorto(tramo.FechaInicio)
    : `${Number(tramo.FechaInicio.slice(8, 10))}–${Number(tramo.FechaFin.slice(8, 10))}`;

function seriesGrafico(lineas, colores) {
  return lineas.map((linea) => ({
    Id: linea.IdProducto,
    Nombre: linea.NombreProducto,
    Color: colores.get(linea.IdProducto),
    Contenedores: linea.Contenedores,
    Registros: linea.Registros,
  }));
}

function datosGrafico(periodo, tramos, series) {
  return tramos.map((tramo) => ({
    Etiqueta: etiquetaTramo(periodo, tramo),
    Detalle: TRAMO[periodo].detalle(tramo),
    ...Object.fromEntries(series.map((serie) => [`s${serie.Id}`, 0])),
    ...Object.fromEntries(tramo.Lineas.map((linea) => [`s${linea.IdProducto}`, linea.Contenedores])),
  }));
}

function EncabezadoPeriodo({ periodo, datos }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-base font-extrabold text-slate-900">{PERIODOS[periodo].texto}</h2>
      <span className="text-[12.5px] font-semibold text-slate-500">
        {dateOnlyFormatter(datos.FechaInicio)} – {dateOnlyFormatter(datos.FechaFin)}
      </span>
    </div>
  );
}

function Seccion({ titulo, icono: Icono, children }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
        <Icono size={18} className="text-c3" />
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function StockProducto({ stock }) {
  const lineas = [...stock.Lineas]
    .filter((linea) => linea.Activo || linea.CantidadActual > 0)
    .sort((a, b) => prioridadLinea(a) - prioridadLinea(b));
  const contenedores = lineas.reduce((suma, linea) => suma + linea.CantidadActual, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          icono={Layers}
          etiqueta="Jabas y planchas en almacén"
          valor={contenedores}
          detalle={`En ${numero(lineas.length)} líneas`}
        />
        <TarjetaIndicador
          icono={PackageX}
          etiqueta="Presentaciones agotadas"
          valor={stock.Alertas.Agotadas}
          detalle="Activas sin stock"
          clase={stock.Alertas.Agotadas ? "bg-slate-200 text-slate-700" : "bg-slate-100 text-slate-500"}
        />
        <TarjetaIndicador
          icono={TriangleAlert}
          etiqueta="En stock crítico"
          valor={stock.Alertas.Criticas}
          detalle="En o bajo el mínimo"
          clase={stock.Alertas.Criticas ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"}
        />
        <TarjetaIndicador
          icono={TriangleAlert}
          etiqueta="En stock bajo"
          valor={stock.Alertas.Bajas}
          detalle="Bajo el preventivo"
          clase={stock.Alertas.Bajas ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}
        />
      </div>

      <Bloque
        titulo="Producto terminado en almacén"
        descripcion="Stock actual por línea y presentación"
        icono={Boxes}
        accion={<EnlaceBloque href={`${RUTA}/producto/inventario`} />}
      >
        {lineas.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {lineas.map((linea) => (
              <LineaStock key={linea.IdProducto} linea={linea} />
            ))}
          </div>
        ) : (
          <SinDatos icono={Boxes} titulo="Sin líneas registradas" />
        )}
      </Bloque>
    </div>
  );
}

function EstadoArea({ area }) {
  return (
    <span
      className={cn(
        "flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
        area.Criticas
          ? "bg-red-50 text-red-700"
          : area.Alertas
            ? "bg-amber-50 text-amber-700"
            : "bg-emerald-50 text-emerald-700",
      )}
    >
      {area.Alertas ? <TriangleAlert size={12} strokeWidth={2.5} /> : null}
      {area.Alertas
        ? `${numero(area.Alertas)} ${area.Alertas === 1 ? "alerta" : "alertas"}`
        : "Stock en orden"}
    </span>
  );
}

function MateriaPrima({ areas }) {
  const ordenadas = ORDEN_MATERIA_PRIMA.map((dominio) => areas.find((area) => area.Dominio === dominio)).filter(Boolean);
  return (
    <div className="flex flex-col gap-3">
      {ordenadas.map((area) => {
        const unidad = UNIDAD_MATERIA_PRIMA[area.Dominio];
        return (
          <Bloque
            key={area.Dominio}
            titulo={area.NombreDominio}
            descripcion={`${numero(area.Cantidad)} ${unidad} en almacén`}
            icono={Warehouse}
            accion={
              <div className="flex items-center gap-3">
                <EstadoArea area={area} />
                <EnlaceBloque href={`${RUTA}/${RUTA_INVENTARIO[area.Dominio]}`}>Inventario</EnlaceBloque>
              </div>
            }
          >
            <GrillaStock
              vacio="Sin tipos registrados"
              items={area.Items.map((item) => ({
                ...item,
                id: item.Id,
                nombre: item.Nombre,
                activo: item.Activo,
                cantidad: item.CantidadActual,
                unidad,
              }))}
            />
          </Bloque>
        );
      })}
    </div>
  );
}

function Inventario({ datos }) {
  return (
    <div className="flex flex-col gap-6">
      <Seccion titulo="Producto terminado" icono={Boxes}>
        <StockProducto stock={datos.Stock} />
      </Seccion>
      <Seccion titulo="Materia prima en almacén" icono={Warehouse}>
        <MateriaPrima areas={datos.MateriaPrima} />
      </Seccion>
    </div>
  );
}

function PlantaAhora({ planta }) {
  const conRuta = (area, aItem) => (item) => {
    const datos = aItem(item);
    return { ...datos, id: `${area}-${datos.id}`, href: `${RUTA}/${area}/produccion` };
  };
  const papel = conRuta("bobina-papel", itemBobinaPapel);
  const servilleta = conRuta("bobina-servilleta", itemBobinaServilleta);

  return (
    <ProduccionAhora
      href={`${RUTA}/bobina-papel/produccion`}
      activas={[...planta.BobinaPapel.Activas.map(papel), ...planta.BobinaServilleta.Activas.map(servilleta)]}
      pausadas={[...planta.BobinaPapel.Pausadas.map(papel), ...planta.BobinaServilleta.Pausadas.map(servilleta)]}
      horasAlerta={planta.HorasAlertaPausa}
      descripcionActivas="Bobina papel y servilleta corriendo ahora"
      descripcionPausas="Máquinas detenidas en este momento y su motivo"
      aItem={(item) => item}
    />
  );
}

function PausasPeriodo({ periodo, pausas }) {
  const texto = periodo === "semana" ? "esta semana" : "este mes";
  const areas = [
    { titulo: "Pausas · Bobina papel", datos: pausas.BobinaPapel },
    { titulo: "Pausas · Bobina servilleta", datos: pausas.BobinaServilleta },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {areas.map(({ titulo, datos }) => (
        <PausasPorMotivo
          key={titulo}
          titulo={titulo}
          descripcion={`${numero(datos.Pausas)} ${datos.Pausas === 1 ? "pausa iniciada" : "pausas iniciadas"} ${texto} · ${formatearSegundos(datos.Segundos)} detenidas`}
          vacio={`Sin pausas ${texto}`}
          motivos={datos.Motivos}
          total={datos.Segundos}
        />
      ))}
    </div>
  );
}

function Produccion({ periodo, datos, colores }) {
  const { Produccion: produccion } = datos;
  const series = seriesGrafico(produccion.Lineas, colores);

  return (
    <div className="flex flex-col gap-6">
      <Seccion titulo="Ahora en planta" icono={Factory}>
        <PlantaAhora planta={datos.Planta} />
      </Seccion>

      <EncabezadoPeriodo periodo={periodo} datos={datos} />

      <Seccion titulo="Producto terminado producido" icono={PackageCheck}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TarjetaIndicador
            icono={Layers}
            etiqueta="Jabas y planchas producidas"
            valor={produccion.Contenedores}
            detalle="Ingresos menos correcciones"
          />
          <TarjetaIndicador
            icono={PackageCheck}
            etiqueta="Registros de ingreso"
            valor={produccion.Ingresos}
            detalle="Ingresos a producto terminado"
          />
          <TarjetaIndicador
            icono={CalendarDays}
            etiqueta="Días con producción"
            valor={produccion.DiasConProduccion}
            detalle={`En ${numero(produccion.Tramos.length)} ${TRAMO[periodo].plural} del período`}
          />
        </div>
        <GraficoBarras
          titulo={`Producción ${TRAMO[periodo].titulo}`}
          descripcion="Jabas y planchas ingresadas a producto terminado por línea (ingresos menos correcciones)"
          icono={ChartColumn}
          accion={<EnlaceBloque href={`${RUTA_REPORTES}/producto/produccion`}>Reporte</EnlaceBloque>}
          series={series}
          datos={datosGrafico(periodo, produccion.Tramos, series)}
          unidad={CONTENEDORES}
          resumenSerie={(serie) => (
            <>
              <span className="font-extrabold text-slate-900">{numero(serie.Contenedores)}</span> {CONTENEDORES}
            </>
          )}
          vacio={{
            titulo: "Sin producción en el período",
            descripcion: "Cuando se registre producto terminado aparecerá aquí.",
          }}
        />
      </Seccion>

      <Seccion titulo="Pausas de producción" icono={Timer}>
        <PausasPeriodo periodo={periodo} pausas={datos.Pausas} />
      </Seccion>
    </div>
  );
}

function Salidas({ periodo, datos, colores }) {
  const { Salidas: salidas } = datos;
  const series = seriesGrafico(salidas.Lineas, colores);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPeriodo periodo={periodo} datos={datos} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TarjetaIndicador icono={Truck} etiqueta="Despachos" valor={salidas.Despachos} detalle="Salidas registradas" />
        <TarjetaIndicador
          icono={Send}
          etiqueta="Jabas y planchas despachadas"
          valor={salidas.Contenedores}
          detalle="Producto terminado que salió"
        />
      </div>

      <GraficoBarras
        titulo={`Salidas ${TRAMO[periodo].titulo}`}
        descripcion="Jabas y planchas despachadas por línea"
        icono={ChartColumn}
        accion={<EnlaceBloque href={`${RUTA_REPORTES}/producto/salidas`}>Reporte</EnlaceBloque>}
        series={series}
        datos={datosGrafico(periodo, salidas.Tramos, series)}
        unidad={CONTENEDORES}
        resumenSerie={(serie) => (
          <>
            <span className="font-extrabold text-slate-900">{numero(serie.Contenedores)}</span> {CONTENEDORES} ·{" "}
            {numero(serie.Registros)} {serie.Registros === 1 ? "despacho" : "despachos"}
          </>
        )}
        vacio={{ titulo: "Sin salidas en el período", descripcion: "Cuando se despache producto aparecerá aquí." }}
      />

      <Bloque
        titulo="Últimos despachos"
        descripcion="Del período elegido"
        icono={Truck}
        accion={<EnlaceBloque href={`${RUTA}/producto/movimientos`} />}
      >
        {salidas.UltimosDespachos.length ? (
          <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
            {salidas.UltimosDespachos.map((despacho) => (
              <FilaDespacho key={despacho.IdDespacho} despacho={despacho} />
            ))}
          </div>
        ) : (
          <SinDatos icono={Truck} titulo="Sin despachos en el período" />
        )}
      </Bloque>
    </div>
  );
}

const CONTENIDO = { inventario: Inventario, produccion: Produccion, salidas: Salidas };

function Resumen({ periodo, pestana }) {
  const { datos, error, recargar } = useInicio(() => verInicioGerente(periodo));
  if (error && !datos) return <ErrorInicio mensaje={error} onReintentar={recargar} />;
  if (!datos) return <CargandoInicio />;

  const colores = new Map(datos.Stock.Lineas.map((linea, indice) => [linea.IdProducto, colorSerie(indice)]));
  const Contenido = CONTENIDO[pestana];

  return <Contenido periodo={periodo} datos={datos} colores={colores} />;
}

export default function InicioGerente() {
  const [periodo, cambiarPeriodo] = usePestanaGuardada(CLAVE_PERIODO, Object.keys(PERIODOS), "mes");
  const [pestana, cambiarPestana] = usePestanaGuardada(CLAVE_PESTANA, Object.keys(PESTANAS), "inventario");
  const [hoy, setHoy] = useState(null);
  const nombre = useNombreUsuario();

  useEffect(() => {
    setHoy(new Date());
  }, []);

  return (
    <div className="contenido-con-sidebar flex min-h-screen flex-col bg-slate-50 pt-20 font-sans text-slate-900 md:pt-0">
      <header className="bg-gradient-to-r from-c3 to-c4 px-5 py-5 text-white sm:px-7">
        <div className="mx-auto w-full max-w-6xl">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
            {hoy ? capitalizar(format(hoy, "EEEE d 'de' MMMM 'de' y", { locale: es })) : " "}
          </div>
          <div className="mt-0.5 text-xl font-extrabold">{nombre ? `Hola, ${nombre}` : "Hola"}</div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-5 py-6 sm:px-6">
        <SelectorPestanas pestanas={PERIODOS} valor={periodo} onCambiar={cambiarPeriodo} className="sm:w-[300px]" />
        <SelectorPestanas pestanas={PESTANAS} valor={pestana} onCambiar={cambiarPestana} />
        <AccesosRapidos accesos={ACCESOS[pestana]} />
        <Resumen key={periodo} periodo={periodo} pestana={pestana} />
      </main>
    </div>
  );
}
