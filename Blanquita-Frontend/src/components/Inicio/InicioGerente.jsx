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
  Icon,
  LayoutGrid,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { AREAS_TRABAJO } from "@/constants/OperadorConfig";
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
const CLAVE_AREA = "gerente.inicio.area";
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

const DATOS_AREA = Object.fromEntries(
  AREAS_TRABAJO.map(({ id, titulo, descripcion, icono, esIconoLab }) => [
    id,
    { titulo, descripcion, icono, esIconoLab },
  ]),
);

const AREAS = {
  todas: {
    titulo: "Todas las áreas",
    descripcion: "Resumen general de la planta",
    icono: LayoutGrid,
    conPestanas: true,
    conPeriodo: true,
  },
  "bobina-papel": {
    ...DATOS_AREA["bobina-papel"],
    dominios: ["bobinapapel"],
    produccion: "BobinaPapel",
    conPeriodo: true,
    accesos: [
      { texto: "Inventario", href: `${RUTA}/bobina-papel/inventario`, icono: Boxes },
      { texto: "Producción", href: `${RUTA}/bobina-papel/produccion`, icono: Factory },
      { texto: "Reporte de producción", href: `${RUTA_REPORTES}/bobina-papel/produccion`, icono: FileChartColumn },
    ],
  },
  "bobina-servilleta": {
    ...DATOS_AREA["bobina-servilleta"],
    dominios: ["bobinaservilleta", "subbobina"],
    produccion: "BobinaServilleta",
    conPeriodo: true,
    accesos: [
      { texto: "Inventario", href: `${RUTA}/bobina-servilleta/inventario`, icono: Boxes },
      { texto: "Producción", href: `${RUTA}/bobina-servilleta/produccion`, icono: Factory },
      { texto: "Reporte de producción", href: `${RUTA_REPORTES}/bobina-servilleta/produccion`, icono: FileChartColumn },
    ],
  },
  rodela: {
    ...DATOS_AREA.rodela,
    dominios: ["rodela"],
    accesos: [
      { texto: "Inventario", href: `${RUTA}/rodela/inventario`, icono: Boxes },
      { texto: "Reporte de inventario", href: `${RUTA_REPORTES}/rodela/inventario`, icono: FileChartColumn },
    ],
  },
  empaque: {
    ...DATOS_AREA.empaque,
    dominios: ["empaquebobina", "empaquebolsa", "bolsajava"],
    accesos: [
      { texto: "Empaque en bobina", href: `${RUTA}/empaque/bobina-inventario`, icono: Boxes },
      { texto: "Empaque en bolsa", href: `${RUTA}/empaque/bolsa-inventario`, icono: Boxes },
      { texto: "Bolsas de jaba", href: `${RUTA}/empaque/jaba-inventario`, icono: Boxes },
      { texto: "Reporte de movimientos", href: `${RUTA_REPORTES}/empaque/movimientos`, icono: FileChartColumn },
    ],
  },
  producto: {
    ...DATOS_AREA.producto,
    conPestanas: true,
    conPeriodo: true,
  },
  insumos: {
    ...DATOS_AREA.insumos,
    dominios: ["insumo"],
    accesos: [
      { texto: "Inventario", href: `${RUTA}/insumos/inventario`, icono: Boxes },
      { texto: "Reporte de movimientos", href: `${RUTA_REPORTES}/insumos/movimientos`, icono: FileChartColumn },
    ],
  },
};

const PLANTA = [
  { clave: "BobinaPapel", ruta: "bobina-papel", texto: "Bobina papel", aItem: itemBobinaPapel },
  { clave: "BobinaServilleta", ruta: "bobina-servilleta", texto: "Bobina servilleta", aItem: itemBobinaServilleta },
];

const CLAVES_PLANTA = PLANTA.map((area) => area.clave);

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

function MateriaPrima({ areas, dominios = ORDEN_MATERIA_PRIMA }) {
  const ordenadas = dominios.map((dominio) => areas.find((area) => area.Dominio === dominio)).filter(Boolean);
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

function PlantaAhora({ planta, claves = CLAVES_PLANTA }) {
  const areas = PLANTA.filter((area) => claves.includes(area.clave));
  const conRuta = (area) => (item) => {
    const datos = area.aItem(item);
    return { ...datos, id: `${area.ruta}-${datos.id}`, href: `${RUTA}/${area.ruta}/produccion` };
  };

  return (
    <ProduccionAhora
      href={`${RUTA}/${areas[0].ruta}/produccion`}
      activas={areas.flatMap((area) => planta[area.clave].Activas.map(conRuta(area)))}
      pausadas={areas.flatMap((area) => planta[area.clave].Pausadas.map(conRuta(area)))}
      horasAlerta={planta.HorasAlertaPausa}
      descripcionActivas={
        areas.length > 1 ? "Bobina papel y servilleta corriendo ahora" : `${areas[0].texto} corriendo ahora`
      }
      descripcionPausas="Máquinas detenidas en este momento y su motivo"
      aItem={(item) => item}
    />
  );
}

function PausasPeriodo({ periodo, pausas, claves = CLAVES_PLANTA }) {
  const texto = periodo === "semana" ? "esta semana" : "este mes";
  const areas = PLANTA.filter((area) => claves.includes(area.clave)).map((area) => ({
    titulo: `Pausas · ${area.texto}`,
    datos: pausas[area.clave],
  }));
  return (
    <div className={cn("grid grid-cols-1 gap-3", areas.length > 1 && "lg:grid-cols-2")}>
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

function ProductoProducido({ periodo, datos, colores }) {
  const { Produccion: produccion } = datos;
  const series = seriesGrafico(produccion.Lineas, colores);

  return (
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
  );
}

function Produccion({ periodo, datos, colores }) {
  return (
    <div className="flex flex-col gap-6">
      <Seccion titulo="Ahora en planta" icono={Factory}>
        <PlantaAhora planta={datos.Planta} />
      </Seccion>

      <EncabezadoPeriodo periodo={periodo} datos={datos} />

      <ProductoProducido periodo={periodo} datos={datos} colores={colores} />

      <Seccion titulo="Pausas de producción" icono={Timer}>
        <PausasPeriodo periodo={periodo} pausas={datos.Pausas} />
      </Seccion>
    </div>
  );
}

function InventarioProducto({ datos }) {
  return (
    <Seccion titulo="Producto terminado" icono={Boxes}>
      <StockProducto stock={datos.Stock} />
    </Seccion>
  );
}

function ProduccionProducto({ periodo, datos, colores }) {
  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPeriodo periodo={periodo} datos={datos} />
      <ProductoProducido periodo={periodo} datos={datos} colores={colores} />
    </div>
  );
}

function DetalleArea({ periodo, datos, area }) {
  return (
    <div className="flex flex-col gap-6">
      {area.produccion && (
        <>
          <Seccion titulo="Ahora en planta" icono={Factory}>
            <PlantaAhora planta={datos.Planta} claves={[area.produccion]} />
          </Seccion>
          <EncabezadoPeriodo periodo={periodo} datos={datos} />
          <Seccion titulo="Pausas de producción" icono={Timer}>
            <PausasPeriodo periodo={periodo} pausas={datos.Pausas} claves={[area.produccion]} />
          </Seccion>
        </>
      )}
      <Seccion titulo="Materia prima en almacén" icono={Warehouse}>
        <MateriaPrima areas={datos.MateriaPrima} dominios={area.dominios} />
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
const CONTENIDO_PRODUCTO = { inventario: InventarioProducto, produccion: ProduccionProducto, salidas: Salidas };

function Resumen({ periodo, area, pestana }) {
  const { datos, error, recargar } = useInicio(() => verInicioGerente(periodo));
  if (error && !datos) return <ErrorInicio mensaje={error} onReintentar={recargar} />;
  if (!datos) return <CargandoInicio />;

  const colores = new Map(datos.Stock.Lineas.map((linea, indice) => [linea.IdProducto, colorSerie(indice)]));

  if (area === "todas" || area === "producto") {
    const Contenido = (area === "todas" ? CONTENIDO : CONTENIDO_PRODUCTO)[pestana];
    return <Contenido periodo={periodo} datos={datos} colores={colores} />;
  }

  return <DetalleArea periodo={periodo} datos={datos} area={AREAS[area]} />;
}

function IconoArea({ area, size = 15, className }) {
  if (area.esIconoLab) return <Icon iconNode={area.icono} size={size} className={className} />;
  const Icono = area.icono;
  return <Icono size={size} className={className} />;
}

function SelectorAreas({ valor, onCambiar }) {
  const area = AREAS[valor];
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-2 text-sm font-bold text-slate-700">¿Qué área quieres revisar?</div>
        <ToggleGroup value={[valor]} className="flex w-full flex-wrap justify-start gap-2">
          {Object.entries(AREAS).map(([id, opcion]) => (
            <ToggleGroupItem
              key={id}
              value={id}
              onClick={() => id !== valor && onCambiar(id)}
              className={cn(PILDORA_FILTRO, "gap-1.5")}
            >
              <IconoArea area={opcion} />
              {opcion.titulo}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <IconoArea area={area} size={18} className="text-c3" />
        <span className="text-base font-extrabold text-slate-900">{area.titulo}</span>
        {area.descripcion && <span className="text-sm text-slate-500">· {area.descripcion}</span>}
      </div>
    </div>
  );
}

export default function InicioGerente() {
  const [periodo, cambiarPeriodo] = usePestanaGuardada(CLAVE_PERIODO, Object.keys(PERIODOS), "mes");
  const [pestana, cambiarPestana] = usePestanaGuardada(CLAVE_PESTANA, Object.keys(PESTANAS), "inventario");
  const [area, cambiarArea] = usePestanaGuardada(CLAVE_AREA, Object.keys(AREAS), "todas");
  const [hoy, setHoy] = useState(null);
  const nombre = useNombreUsuario();
  const configuracion = AREAS[area];

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
        <SelectorAreas valor={area} onCambiar={cambiarArea} />
        {configuracion.conPestanas && (
          <SelectorPestanas pestanas={PESTANAS} valor={pestana} onCambiar={cambiarPestana} />
        )}
        {configuracion.conPeriodo && (
          <SelectorPestanas pestanas={PERIODOS} valor={periodo} onCambiar={cambiarPeriodo} className="sm:w-[300px]" />
        )}
        <AccesosRapidos accesos={configuracion.conPestanas ? ACCESOS[pestana] : configuracion.accesos} />
        <Resumen key={periodo} periodo={periodo} area={area} pestana={pestana} />
      </main>
    </div>
  );
}
