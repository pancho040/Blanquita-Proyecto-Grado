import { Boxes, CircleCheck, Factory, FileChartColumn, PackageOpen, PackagePlus, PackageX, Play, SquareStack } from "lucide-react";
import { verInicioBobinaServilleta } from "@/services/BobinaServilleta/Inicio";
import {
  AccesosRapidos,
  Bloque,
  CargandoInicio,
  EncabezadoSemana,
  EnlaceBloque,
  ErrorInicio,
  FueraInventario,
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

const RUTA = "/encargado/bobina-servilleta";
const RUTA_REPORTES = "/encargado/reportes/bobina-servilleta";
const CLAVE_PESTANA = "encargado.inicio.bobina-servilleta";

const PESTANAS = {
  inventario: { texto: "Inventario", icono: Boxes },
  produccion: { texto: "Producción", icono: Factory },
};

const medidaMm = (mm) => `${numero(mm)} mm`;

export const itemProduccion = (item) => ({
  id: item.IdPausaProduccionServilleta ?? item.IdProduccionServilleta,
  titulo: `Sub-bobina ${medidaMm(item.MedidaMm)}`,
  subtitulo: item.NombreTipoBobinaServilleta,
  codigos: `Unidad ${item.CodigoUnidadOrigen}`,
  motivo: item.MotivoPausaProduccion,
  desde: item.FechaHoraPausa ?? item.FechaInicioProduccion,
  atrasada: item.Atrasada,
  detalles: item.FechaHoraPausa ? [`Pausó ${item.Operador}`] : [`Turno ${item.NombreTurno}`, item.Operador],
});

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bloque
          titulo="Bobinas madre"
          descripcion="En almacén, sin abrir"
          icono={SquareStack}
          accion={<EnlaceBloque href={`${RUTA}/inventario`}>Inventario</EnlaceBloque>}
        >
          <GrillaStock
            vacio="Sin tipos de bobina servilleta"
            items={datos.StockBobinas.map((tipo) => ({
              ...tipo,
              id: tipo.IdTipoBobinaServilleta,
              nombre: tipo.NombreTipoBobinaServilleta,
              activo: tipo.Activo,
              cantidad: tipo.CantidadBobinaServilleta,
              unidad: "bobinas madre",
            }))}
          />
        </Bloque>

        <Bloque
          titulo="Sub-bobinas por medida"
          descripcion="Liberadas al abrir y listas para producción"
          icono={Boxes}
          accion={<EnlaceBloque href={`${RUTA}/inventario`}>Inventario</EnlaceBloque>}
        >
          <GrillaStock
            vacio="Sin medidas de sub-bobina"
            items={datos.StockSubBobinas.map((medida) => ({
              ...medida,
              id: medida.IdTipoMedidaSubBobina,
              nombre: medida.NombreTipoMedida || medidaMm(medida.MedidaMm),
              activo: medida.Activo,
              cantidad: medida.CantidadSubBobinas,
              unidad: "sub-bobinas",
            }))}
          />
        </Bloque>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FueraInventario
          titulo="Sub-bobinas fuera de inventario"
          descripcion="De producciones canceladas, esperan reingreso"
          icono={PackageX}
          href={`${RUTA}/inventario`}
          cantidad={datos.FueraInventario.Cantidad}
          vacio="No hay sub-bobinas fuera de inventario."
          items={datos.FueraInventario.SubBobinas.map((sub) => ({
            id: sub.IdSubBobinaServilleta,
            codigo: sub.CodigoUnidadOrigen,
            detalle: sub.NombreTipoMedida,
            fecha: sub.FechaUltimoMovimiento,
          }))}
        />
        <UltimoLote
          href={`${RUTA}/ingreso`}
          lote={
            lote && {
              codigo: `#${lote.IdLoteBobinaServilleta}`,
              fecha: lote.FechaRecepcion,
              proveedor: lote.NombreProveedor,
              contenido: `${numero(lote.CantidadBobinas)} bobinas madre ${lote.NombreTipoBobinaServilleta ?? ""} · ${numero(lote.PesoBrutoTotalKg)} kg brutos`,
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
          { texto: "Abrir bobina madre", href: `${RUTA}/inventario`, icono: PackageOpen },
          { texto: "Reporte de producción", href: `${RUTA_REPORTES}/produccion`, icono: FileChartColumn },
        ]}
      />

      <ProduccionAhora
        href={`${RUTA}/produccion`}
        activas={datos.Activas}
        pausadas={datos.Pausadas}
        horasAlerta={datos.HorasAlertaPausa}
        descripcionActivas="Sub-bobinas que están en máquina ahora"
        aItem={itemProduccion}
      />

      <EncabezadoSemana datos={datos} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          icono={Play}
          etiqueta="Sub-bobinas iniciadas"
          valor={indicadores.Iniciadas}
          anterior={indicadores.IniciadasSemanaAnterior}
        />
        <TarjetaIndicador
          icono={CircleCheck}
          etiqueta={`Sub-bobinas finalizadas (${numero(indicadores.Canceladas)} canceladas)`}
          valor={indicadores.Finalizadas}
          anterior={indicadores.FinalizadasSemanaAnterior}
          clase="bg-emerald-50 text-emerald-700"
        />
        <TarjetaIndicador
          icono={PackageOpen}
          etiqueta="Bobinas madre abiertas"
          valor={indicadores.BobinasAbiertas}
          anterior={indicadores.BobinasAbiertasSemanaAnterior}
          clase="bg-slate-100 text-slate-700"
        />
        <TarjetaPausas indicadores={indicadores} />
      </div>

      <PausasPorMotivo motivos={datos.MotivosPausa} total={indicadores.SegundosPausa} />
    </div>
  );
}

const CONTENIDO = { inventario: Inventario, produccion: Produccion };

export default function InicioBobinaServilleta() {
  const [pestana, cambiar] = usePestanaGuardada(CLAVE_PESTANA, Object.keys(PESTANAS), "produccion");
  const { datos, error, recargar } = useInicio(verInicioBobinaServilleta);
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
