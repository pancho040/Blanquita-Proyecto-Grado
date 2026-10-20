import { Boxes, ChartColumn, Factory, FileChartColumn, Layers, PackagePlus, PackageX } from "lucide-react";
import { verInicioBobinaPapel } from "@/services/BobinaPapel/Inicio";
import {
  AccesosRapidos,
  Bloque,
  CargandoInicio,
  EncabezadoSemana,
  EnlaceBloque,
  ErrorInicio,
  FueraInventario,
  GraficoSemana,
  GrillaStock,
  PausasPorMotivo,
  ProduccionAhora,
  SelectorPestanas,
  TarjetaIndicador,
  TarjetaPausas,
  UltimoLote,
  numero,
  useInicio,
  usePestanaGuardada,
} from "@/components/Inicio/comunes";

const RUTA = "/encargado/bobina-papel";
const RUTA_REPORTES = "/encargado/reportes/bobina-papel";
const CLAVE_PESTANA = "encargado.inicio.bobina-papel";

const PESTANAS = {
  inventario: { texto: "Inventario", icono: Boxes },
  produccion: { texto: "Producción", icono: Factory },
};

const MEDIDAS = [
  { valor: "Logs", texto: "Logs", descripcion: "Por día y producto · logs netos (ingresos − descuentos)" },
  { valor: "Cargadas", texto: "Cargadas", descripcion: "Por día y producto · cargadas iniciadas, sin contar cambios de línea" },
];

const itemProduccion = (item) => ({
  id: item.IdPausaProduccionBobinaTubo ?? item.IdProduccionBobinaTubo,
  titulo: item.NombreProducto,
  subtitulo: item.NombreTipoBobina,
  codigos: `${item.CodigoBobina1} · ${item.CodigoBobina2}`,
  valor: `${numero(item.CantidadLogsActual)} logs`,
  motivo: item.MotivoPausaProduccion,
  desde: item.FechaHoraPausa ?? item.FechaInicioProduccion,
  atrasada: item.Atrasada,
  detalles: item.FechaHoraPausa
    ? [`Pausó ${item.Operador}`, `${numero(item.CantidadLogsActual)} logs`]
    : [`Turno ${item.NombreTurno}`, item.Operador],
});

const serie = (producto) => ({ ...producto, Id: producto.IdProducto, Nombre: producto.NombreProducto });

function Inventario({ datos }) {
  const lote = datos.UltimoLote;
  return (
    <div className="flex flex-col gap-4">
      <AccesosRapidos
        accesos={[
          { texto: "Inventario", href: `${RUTA}/inventario`, icono: Boxes },
          { texto: "Ingresar lote", href: `${RUTA}/ingreso`, icono: PackagePlus },
          { texto: "Reporte de inventario", href: `${RUTA_REPORTES}/inventario`, icono: FileChartColumn },
        ]}
      />

      <Bloque
        titulo="Stock por tipo de bobina"
        descripcion="Bobinas en almacén"
        icono={Boxes}
        accion={<EnlaceBloque href={`${RUTA}/inventario`}>Inventario</EnlaceBloque>}
      >
        <GrillaStock
          vacio="Sin tipos de bobina"
          items={datos.Stock.map((tipo) => ({
            ...tipo,
            id: tipo.IdTipoBobina,
            nombre: tipo.NombreTipoBobina,
            activo: tipo.Activo,
            cantidad: tipo.CantidadBobinas,
            unidad: `bobinas · ${numero(tipo.PesoNetoTotalKg)} kg`,
          }))}
        />
      </Bloque>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FueraInventario
          titulo="Fuera de inventario"
          descripcion="Bobinas de producciones canceladas que esperan reingreso"
          icono={PackageX}
          href={`${RUTA}/inventario`}
          cantidad={datos.FueraInventario.Cantidad}
          vacio="No hay bobinas fuera de inventario."
          items={datos.FueraInventario.Bobinas.map((bobina) => ({
            id: bobina.IdBobinaPapel,
            codigo: bobina.CodigoBobina,
            detalle: bobina.NombreTipoBobina,
            fecha: bobina.FechaUltimoMovimiento,
          }))}
        />
        <UltimoLote
          href={`${RUTA}/ingreso`}
          lote={
            lote && {
              codigo: lote.CodigoLote,
              fecha: lote.FechaRecepcion,
              proveedor: lote.NombreProveedor,
              contenido: `${numero(lote.CantidadBobinas)} bobinas ${lote.NombreTipoBobina ?? ""} · ${numero(lote.PesoNetoTotalKg)} kg`,
            }
          }
        />
      </div>
    </div>
  );
}

function Produccion({ datos }) {
  const indicadores = datos.Indicadores;
  return (
    <div className="flex flex-col gap-4">
      <AccesosRapidos
        accesos={[
          { texto: "Producción", href: `${RUTA}/produccion`, icono: Factory },
          { texto: "Iniciar desde inventario", href: `${RUTA}/inventario`, icono: Boxes },
          { texto: "Reporte de producción", href: `${RUTA_REPORTES}/produccion`, icono: FileChartColumn },
        ]}
      />

      <ProduccionAhora
        href={`${RUTA}/produccion`}
        activas={datos.Activas}
        pausadas={datos.Pausadas}
        horasAlerta={datos.HorasAlertaPausa}
        descripcionActivas="Cargadas que están corriendo ahora"
        aItem={itemProduccion}
      />

      <EncabezadoSemana datos={datos} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          icono={ChartColumn}
          etiqueta="Logs producidos"
          valor={indicadores.Logs}
          anterior={indicadores.LogsSemanaAnterior}
        />
        <TarjetaIndicador
          icono={Layers}
          etiqueta="Cargadas iniciadas"
          valor={indicadores.Cargadas}
          anterior={indicadores.CargadasSemanaAnterior}
          clase="bg-emerald-50 text-emerald-700"
        />
        <TarjetaPausas indicadores={indicadores} />
        <TarjetaIndicador
          icono={Factory}
          etiqueta="Producciones cerradas"
          valor={indicadores.Finalizadas + indicadores.Canceladas + indicadores.CambiosLinea}
          detalle={`${numero(indicadores.Finalizadas)} finalizadas · ${numero(indicadores.Canceladas)} canceladas · ${numero(indicadores.CambiosLinea)} cambios de línea`}
          clase="bg-slate-100 text-slate-700"
        />
      </div>

      <GraficoSemana
        titulo="Producción de la semana"
        medidas={MEDIDAS}
        dias={datos.Dias.map((dia) => ({ ...dia, Series: dia.Productos.map(serie) }))}
        series={datos.Productos.map(serie)}
        resumenSerie={(producto) => (
          <>
            <span className="font-extrabold text-slate-900">{numero(producto.Logs)}</span> logs ·{" "}
            <span className="font-extrabold text-slate-900">{numero(producto.Cargadas)}</span> carg.
          </>
        )}
        vacio={{
          titulo: "Sin producción esta semana",
          descripcion: "Cuando se registren cargadas y logs aparecerán aquí por día.",
        }}
      />

      <PausasPorMotivo motivos={datos.MotivosPausa} total={indicadores.SegundosPausa} />
    </div>
  );
}

const CONTENIDO = { inventario: Inventario, produccion: Produccion };

export default function InicioBobinaPapel() {
  const [pestana, cambiar] = usePestanaGuardada(CLAVE_PESTANA, Object.keys(PESTANAS), "produccion");
  const { datos, error, recargar } = useInicio(verInicioBobinaPapel);
  const Contenido = CONTENIDO[pestana];

  return (
    <div className="flex flex-col gap-4">
      <SelectorPestanas pestanas={PESTANAS} valor={pestana} onCambiar={cambiar} className="sm:w-[360px]" />
      {error && !datos ? (
        <ErrorInicio mensaje={error} onReintentar={recargar} />
      ) : datos ? (
        <Contenido datos={datos} />
      ) : (
        <CargandoInicio />
      )}
    </div>
  );
}
