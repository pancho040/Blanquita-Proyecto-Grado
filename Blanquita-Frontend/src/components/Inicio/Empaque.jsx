import { ArrowRightLeft, Boxes, Container, Cuboid, FileChartColumn, Package, PackageCheck, PackagePlus, Send, Undo2, Warehouse } from "lucide-react";
import { verInicioEmpaque } from "@/services/Empaque/Inicio";
import {
  AccesosRapidos,
  Bloque,
  CargandoInicio,
  EncabezadoSemana,
  EnlaceBloque,
  ErrorInicio,
  GraficoSemana,
  GrillaStock,
  Reingresables,
  SelectorPestanas,
  TarjetaIndicador,
  UltimoLote,
  UltimosMovimientos,
  numero,
  useInicio,
  usePestanaGuardada,
} from "@/components/Inicio/comunes";

const RUTA = "/encargado/empaque";
const RUTA_REPORTES = "/encargado/reportes/empaque";
const CLAVE_CLASE = "encargado.inicio.empaque";

const CLASES = {
  bobina: {
    texto: "Empaque en bobina",
    corto: "Bobina",
    icono: Container,
    unidad: "bobinas",
    salida: "Enviadas a producción",
    accesos: [
      { texto: "Inventario y envío", href: `${RUTA}/bobina-inventario`, icono: Boxes },
      { texto: "Reingresar", href: `${RUTA}/bobina-reingreso`, icono: Undo2 },
      { texto: "Ingresar lote", href: `${RUTA}/bobina-ingreso`, icono: PackagePlus },
    ],
    inventario: `${RUTA}/bobina-inventario`,
    ingreso: `${RUTA}/bobina-ingreso`,
  },
  bolsa: {
    texto: "Empaque en bolsa",
    corto: "Bolsa",
    icono: Cuboid,
    unidad: "paquetes",
    salida: "Salidas",
    accesos: [
      { texto: "Inventario y salida", href: `${RUTA}/bolsa-inventario`, icono: Boxes },
      { texto: "Ingresar lote", href: `${RUTA}/bolsa-ingreso`, icono: PackagePlus },
    ],
    inventario: `${RUTA}/bolsa-inventario`,
    ingreso: `${RUTA}/bolsa-ingreso`,
  },
  jaba: {
    texto: "Bolsas de jaba",
    corto: "Jaba",
    icono: Package,
    unidad: "paquetes",
    salida: "Salidas",
    accesos: [
      { texto: "Inventario y salida", href: `${RUTA}/jaba-inventario`, icono: Boxes },
      { texto: "Ingresar lote", href: `${RUTA}/jaba-ingreso`, icono: PackagePlus },
    ],
    inventario: `${RUTA}/jaba-inventario`,
    ingreso: `${RUTA}/jaba-ingreso`,
  },
};

const ACCESOS_REPORTES = [
  { texto: "Reporte de movimientos", href: `${RUTA_REPORTES}/movimientos`, icono: FileChartColumn },
  { texto: "Reporte de lotes", href: `${RUTA_REPORTES}/lotes`, icono: FileChartColumn },
];

const serie = (tipo) => ({ ...tipo, Id: tipo.IdTipo, Nombre: tipo.NombreTipo });

function contenidoLote(lote, config) {
  const partes = [`${numero(lote.Cantidad)} ${config.unidad}`];
  if (lote.Tipos) partes.push(lote.Tipos);
  if (lote.PesoKg !== null) partes.push(`${numero(lote.PesoKg)} kg`);
  if (lote.CantidadToneladasPedida !== null) partes.push(`${numero(lote.CantidadToneladasPedida)} t pedidas`);
  return partes.join(" · ");
}

function Indicadores({ indicadores, config }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <TarjetaIndicador
        icono={Send}
        etiqueta={`${config.salida} (${config.unidad})`}
        valor={indicadores.Salidas}
        anterior={indicadores.SalidasSemanaAnterior}
      />
      <TarjetaIndicador
        icono={PackageCheck}
        etiqueta={`Ingresos por lote (${config.unidad})`}
        valor={indicadores.Ingresos}
        anterior={indicadores.IngresosSemanaAnterior}
        clase="bg-emerald-50 text-emerald-700"
      />
      <TarjetaIndicador
        icono={ArrowRightLeft}
        etiqueta="Reingresos al almacén"
        valor={indicadores.Reingresos}
        anterior={indicadores.ReingresosSemanaAnterior}
        menosEsMejor
        clase="bg-amber-50 text-amber-700"
      />
      <TarjetaIndicador
        icono={Warehouse}
        etiqueta={`Stock actual (${config.unidad})`}
        valor={indicadores.StockTotal}
        detalle={
          indicadores.TiposEnAlerta
            ? `${numero(indicadores.TiposEnAlerta)} ${indicadores.TiposEnAlerta === 1 ? "tipo" : "tipos"} con stock bajo o crítico`
            : "Ningún tipo en alerta"
        }
        clase={indicadores.TiposEnAlerta ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}
      />
    </div>
  );
}

function ResumenClase({ clase }) {
  const config = CLASES[clase];
  const { datos, error, recargar } = useInicio(() => verInicioEmpaque(clase));

  if (error && !datos) return <ErrorInicio mensaje={error} onReintentar={recargar} />;
  if (!datos) return <CargandoInicio />;

  const lote = datos.UltimoLote;
  const medidas = [
    { valor: "Salidas", texto: config.salida, descripcion: `${config.unidad} que salieron del almacén por día y tipo` },
    { valor: "Ingresos", texto: "Ingresos", descripcion: `${config.unidad} ingresados por lote por día y tipo` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <AccesosRapidos accesos={[...config.accesos, ...ACCESOS_REPORTES]} />

      <div className={clase === "bobina" ? "grid grid-cols-1 gap-4 lg:grid-cols-2" : "flex flex-col gap-4"}>
        {clase === "bobina" && (
          <Reingresables
            href={`${RUTA}/bobina-reingreso`}
            unidad="Bobinas de empaque"
            minutos={datos.MinutosReingreso ?? 0}
            items={datos.Reingresables.map((bobina) => ({
              id: bobina.IdEmpaque,
              codigo: bobina.CodigoEmpaque,
              detalle: `${bobina.NombreTipoEmpaque} · ${numero(bobina.PesoKg)} kg`,
              fecha: bobina.FechaTraslado,
            }))}
          />
        )}

        <Bloque
          titulo={`Stock de ${config.texto.toLowerCase()}`}
          descripcion={`${config.unidad} en almacén por tipo`}
          icono={Boxes}
          accion={<EnlaceBloque href={config.inventario}>Inventario</EnlaceBloque>}
        >
          <GrillaStock
            vacio="Sin tipos registrados"
            items={datos.Stock.map((tipo) => ({
              ...tipo,
              id: tipo.IdTipo,
              nombre: tipo.NombreTipo,
              activo: tipo.Activo,
              cantidad: tipo.CantidadActual,
              unidad: config.unidad,
            }))}
          />
        </Bloque>
      </div>

      <EncabezadoSemana datos={datos} />

      <Indicadores indicadores={datos.Indicadores} config={config} />

      <GraficoSemana
        titulo="Movimientos de la semana"
        medidas={medidas}
        dias={datos.Dias.map((dia) => ({ ...dia, Series: dia.Tipos.map(serie) }))}
        series={datos.Tipos.map(serie)}
        resumenSerie={(tipo) => (
          <>
            <span className="font-extrabold text-slate-900">{numero(tipo.Salidas)}</span> sal. ·{" "}
            <span className="font-extrabold text-slate-900">{numero(tipo.Ingresos)}</span> ing.
          </>
        )}
        vacio={{
          titulo: "Sin movimientos esta semana",
          descripcion: `Cuando entren o salgan ${config.unidad} aparecerán aquí por día.`,
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UltimosMovimientos
          descripcion="Lo más reciente de esta semana"
          movimientos={datos.UltimosMovimientos.map((m) => ({
            id: m.IdMovimiento,
            idTipoMovimiento: m.IdTipoMovimiento,
            movimiento: m.NombreMovimiento,
            titulo: m.CodigoEmpaque ? `${m.CodigoEmpaque} · ${m.NombreTipo}` : `${numero(m.Cantidad)} ${config.unidad} · ${m.NombreTipo}`,
            fecha: m.FechaMovimiento,
            usuario: m.Usuario,
            observacion: m.Observacion,
          }))}
        />
        <UltimoLote
          href={config.ingreso}
          lote={
            lote && {
              codigo: `#${lote.IdLoteEmpaque}`,
              fecha: lote.FechaRecepcion,
              proveedor: lote.NombreProveedor,
              contenido: contenidoLote(lote, config),
            }
          }
        />
      </div>
    </div>
  );
}

export default function InicioEmpaque() {
  const [clase, cambiar] = usePestanaGuardada(CLAVE_CLASE, Object.keys(CLASES), "bobina");

  return (
    <div className="flex flex-col gap-4">
      <SelectorPestanas pestanas={CLASES} valor={clase} onCambiar={cambiar} className="sm:w-[560px]" />

      <ResumenClase key={clase} clase={clase} />
    </div>
  );
}
