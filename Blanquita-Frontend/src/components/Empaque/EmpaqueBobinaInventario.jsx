import { Plus, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  verResumenInventarioEmpaque,
  verDetalleInventarioEmpaque,
  trasladarEmpaquesAProduccion,
} from "../../services/Empaque/EmpaqueBobina";
import { dateFormatter } from "@/utils/dates";
import { useCatalogo } from "@/hooks/useCatalogo";
import { useDetalleInventario } from "@/hooks/useDetalleInventario";
import { useEjecutar } from "@/hooks/useEjecutar";
import {
  GRID_TARJETAS,
  conAcentos,
  coincide,
  TarjetaTipo,
  EncabezadoCatalogo,
  EstadoCatalogo,
  PanelDetalle,
  BuscadorCodigo,
  ContenidoLista,
  CasillaSeleccion,
  BarraSeleccion,
} from "@/components/Inventario/comunes";
import Header from "@/components/layout/Header";
import { BotonDescarga } from "@/components/layout/BotonDescarga";
import { TooltipProvider } from "@/components/ui/tooltip";
import { descargarReporteInventarioEmpaque } from "@/services/Empaque/Reporte";
import { Roles } from "@/constants/Values";

function TablaEmpaques({ empaques, tipoSel, marcados, onToggle }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[620px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-11 pl-5" />
            <TableHead>Código</TableHead>
            <TableHead>Peso (kg)</TableHead>
            <TableHead>Recepción</TableHead>
            <TableHead className="pr-5">Proveedor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {empaques.map((e) => {
            const on = marcados.includes(e.IdEmpaque);
            return (
              <TableRow key={e.IdEmpaque} className={cn(on && tipoSel.soft)}>
                <TableCell className="pl-5">
                  <CasillaSeleccion
                    marcada={on}
                    acento={tipoSel}
                    onClick={() => onToggle(e.IdEmpaque)}
                  />
                </TableCell>
                <TableCell className={cn("font-mono font-bold", tipoSel.text)}>
                  {e.CodigoEmpaque}
                </TableCell>
                <TableCell className="text-slate-600">{e.PesoKg}</TableCell>
                <TableCell className="text-slate-600">
                  {dateFormatter(e.FechaRecepcion)}
                </TableCell>
                <TableCell className="pr-5 text-slate-600">{e.NombreProveedor}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ListaMovilEmpaques({ empaques, tipoSel, marcados, onToggle }) {
  return (
    <div className="flex flex-col gap-2.5 p-3.5">
      {empaques.map((e) => {
        const on = marcados.includes(e.IdEmpaque);
        return (
          <button
            key={e.IdEmpaque}
            onClick={() => onToggle(e.IdEmpaque)}
            className={cn(
              "flex flex-col gap-2.5 rounded-2xl border-2 p-3.5 text-left",
              on ? cn(tipoSel.soft, tipoSel.border) : "border-slate-200 bg-white",
            )}
          >
            <div className="flex items-center justify-between gap-2.5">
              <div className={cn("font-mono text-[15px] font-extrabold", tipoSel.text)}>
                {e.CodigoEmpaque}
              </div>
              <CasillaSeleccion marcada={on} acento={tipoSel} grande />
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-slate-600">
              <span>
                <strong className="text-slate-900">{e.PesoKg} kg</strong> ·{" "}
                {dateFormatter(e.FechaRecepcion)}
              </span>
              <span>{e.NombreProveedor}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function EmpaqueBobinaInventario({ usuario }) {
  const resumen = useCatalogo(verResumenInventarioEmpaque);
  const detalle = useDetalleInventario(verDetalleInventarioEmpaque);
  const envio = useEjecutar();

  const tipos = conAcentos(resumen.datos, { cantidadDe: (t) => t.CantidadEmpaques });
  const tipoSel = detalle.sel ? tipos.find((t) => t.IdTipoEmpaque === detalle.sel) : null;
  const { marcadas: marcados, setMarcadas: setMarcados } = detalle;

  const totalEnAlmacen = tipos.reduce((s, t) => s + Number(t.CantidadEmpaques || 0), 0);

  const empaquesFiltrados = detalle.datos.filter((e) =>
    coincide(detalle.busqueda, e.CodigoEmpaque),
  );

  const toggleEmpaque = (idEmpaque) => {
    setMarcados((prev) =>
      prev.includes(idEmpaque) ? prev.filter((id) => id !== idEmpaque) : [...prev, idEmpaque],
    );
  };

  const quitarChip = (idEmpaque) => setMarcados((prev) => prev.filter((id) => id !== idEmpaque));

  const refrescar = () => {
    resumen.recargar();
    detalle.recargar();
  };

  const enviarProduccion = () => {
    if (marcados.length === 0) return;

    envio.ejecutar(
      "envio",
      () => trasladarEmpaquesAProduccion(marcados),
      (resultado) =>
        `${resultado.map((r) => r.CodigoEmpaque).join(", ")} → Trasladado a producción`,
      () => {
        setMarcados([]);
        refrescar();
      },
    );
  };

  const esEncargado = usuario?.IdRol === Roles.Encargado;

  return (
    <TooltipProvider>
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header
        titulo="Almacén · Materia Prima"
        subtitulo="Inventario de Empaques"
        accion={
          esEncargado
            ? {
                texto: "Registrar ingreso",
                icono: Plus,
                href: "/encargado/empaque/bobina-ingreso",
              }
            : null
        }
      >
        {esEncargado && (
          <BotonDescarga
            texto="Descargar inventario"
            ayuda="PDF con el stock actual por tipo y las bobinas de empaque en almacén"
            exito="Informe de inventario descargado"
            descargar={() => descargarReporteInventarioEmpaque("bobina")}
          />
        )}
      </Header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        <EncabezadoCatalogo titulo="Catálogo por tipo de empaque">
          {totalEnAlmacen} empaques <strong className="text-slate-700">en almacén</strong>
        </EncabezadoCatalogo>

        <EstadoCatalogo
          cargando={resumen.cargando}
          error={resumen.error}
          vacio={tipos.length === 0}
          mensajeVacio="No hay tipos de empaque registrados."
          altoSkeleton="h-44"
        >
          <div className={GRID_TARJETAS}>
            {tipos.map((t) => (
              <TarjetaTipo
                key={t.IdTipoEmpaque}
                acento={t}
                activo={detalle.sel === t.IdTipoEmpaque}
                onClick={() => detalle.seleccionar(t.IdTipoEmpaque)}
                icono={Package}
                claseIcono="h-7 w-7"
                grosorIcono={2.25}
                nombre={t.NombreTipoEmpaque}
                etiqueta={t.badge}
                cantidad={t.CantidadEmpaques}
                unidad="empaques en almacén"
                textoVer="Ver empaques"
              />
            ))}
          </div>
        </EstadoCatalogo>

        {tipoSel && (
          <PanelDetalle
            acento={tipoSel}
            icono={Package}
            claseIcono="h-6 w-6"
            grosorIcono={2.25}
            titulo={`Empaques · ${tipoSel.NombreTipoEmpaque}`}
            subtitulo={`${tipoSel.CantidadEmpaques} en almacén`}
            onCerrar={detalle.cerrar}
          >
            <ContenidoLista
              cargando={detalle.cargando}
              error={detalle.error}
              total={detalle.datos.length}
              cantidadFiltrada={empaquesFiltrados.length}
              buscador={<BuscadorCodigo valor={detalle.busqueda} onCambio={detalle.setBusqueda} />}
              mensajeVacio="No hay empaques en almacén para este tipo."
              mensajeSinCoincidencias={`Ningún empaque coincide con "${detalle.busqueda}".`}
            >
              <div className="hidden md:block">
                <TablaEmpaques
                  empaques={empaquesFiltrados}
                  tipoSel={tipoSel}
                  marcados={marcados}
                  onToggle={toggleEmpaque}
                />
              </div>
              <div className="md:hidden">
                <ListaMovilEmpaques
                  empaques={empaquesFiltrados}
                  tipoSel={tipoSel}
                  marcados={marcados}
                  onToggle={toggleEmpaque}
                />
              </div>
            </ContenidoLista>

            {marcados.length > 0 && (
              <BarraSeleccion
                chips={marcados.map((idEmpaque) => ({
                  clave: idEmpaque,
                  texto:
                    detalle.datos.find((e) => e.IdEmpaque === idEmpaque)?.CodigoEmpaque ??
                    idEmpaque,
                  onQuitar: () => quitarChip(idEmpaque),
                }))}
                estado={`${marcados.length} ${marcados.length === 1 ? "empaque" : "empaques"} seleccionados`}
                enviando={envio.enProceso === "envio"}
                onEnviar={enviarProduccion}
                textoAccion="Trasladar a producción"
                textoEnviando="Trasladando..."
              />
            )}
          </PanelDetalle>
        )}
      </main>
    </div>
    </TooltipProvider>
  );
}
