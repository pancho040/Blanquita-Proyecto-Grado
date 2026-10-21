import { useState } from "react";
import { Plus, Package, Loader2, ArrowRight, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  BuscadorNombre,
  SinCoincidencias,
  ContenidoLista,
  CasillaSeleccion,
  BarraSeleccion,
} from "@/components/Inventario/comunes";
import Header from "@/components/layout/Header";
import { BotonDescarga } from "@/components/layout/BotonDescarga";
import { TooltipProvider } from "@/components/ui/tooltip";
import { descargarReporteInventarioEmpaque } from "@/services/Empaque/Reporte";
import { MINUTOS_REINGRESO_EMPAQUE_BOBINA } from "@/constants/Values";
import { VeComoLider, EsGerente, rutaDeRol } from "@/utils/validators";

function DialogoConfirmarTraslado({ abierto, codigos, enviando, onCancelar, onConfirmar }) {
  const varios = codigos.length > 1;
  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && !enviando && onCancelar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold">Confirmar envío a producción</DialogTitle>
          <DialogDescription>
            {varios
              ? `¿Estás seguro de enviar estas ${codigos.length} bobinas de empaque a producción?`
              : "¿Estás seguro de enviar esta bobina de empaque a producción?"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 rounded-xl bg-slate-50 px-3.5 py-3">
          {codigos.map((codigo) => (
            <span key={codigo} className="font-mono text-[15px] font-extrabold text-slate-900">
              {codigo}
            </span>
          ))}
        </div>

        <p className="text-[12.5px] text-slate-500">
          Saldrá del almacén. Si fue un error, podrás reingresarla en los próximos{" "}
          {MINUTOS_REINGRESO_EMPAQUE_BOBINA} minutos.
        </p>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={onCancelar}
            disabled={enviando}
            className="h-11 font-bold text-slate-500 hover:text-slate-900"
          >
            Volver
          </Button>
          <Button
            onClick={onConfirmar}
            disabled={enviando}
            className="h-11 gap-2 bg-gradient-to-r from-c3 to-c4 font-extrabold text-white hover:opacity-90"
          >
            {enviando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                Sí, enviar
                <ArrowRight size={16} strokeWidth={2.75} />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TablaEmpaques({ empaques, tipoSel, marcados, onToggle }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[620px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {onToggle && <TableHead className="w-11 pl-5" />}
            <TableHead className={cn(!onToggle && "pl-5")}>Código</TableHead>
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
                {onToggle && (
                  <TableCell className="pl-5">
                    <CasillaSeleccion
                      marcada={on}
                      acento={tipoSel}
                      onClick={() => onToggle(e.IdEmpaque)}
                    />
                  </TableCell>
                )}
                <TableCell className={cn("font-mono font-bold", tipoSel.text, !onToggle && "pl-5")}>
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
            disabled={!onToggle}
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
              {onToggle && <CasillaSeleccion marcada={on} acento={tipoSel} grande />}
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
  const [busquedaTipo, setBusquedaTipo] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  const tipos = conAcentos(resumen.datos, { cantidadDe: (t) => t.CantidadEmpaques });
  const tiposFiltrados = tipos.filter((t) => coincide(busquedaTipo, t.NombreTipoEmpaque));
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

  const codigosMarcados = marcados.map(
    (idEmpaque) =>
      detalle.datos.find((e) => e.IdEmpaque === idEmpaque)?.CodigoEmpaque ?? String(idEmpaque),
  );

  const enviarProduccion = () => {
    if (marcados.length === 0) return;

    envio.ejecutar(
      "envio",
      () => trasladarEmpaquesAProduccion(marcados),
      (resultado) =>
        `${resultado.map((r) => r.CodigoEmpaque).join(", ")} → Trasladado a producción`,
      () => {
        setConfirmando(false);
        setMarcados([]);
        refrescar();
      },
    );
  };

  const esEncargado = VeComoLider(usuario?.IdRol);
  const soloLectura = EsGerente(usuario?.IdRol);

  return (
    <TooltipProvider>
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header
        titulo="Almacén · Materia Prima"
        subtitulo="Inventario de Empaques"
        accion={
          esEncargado
            ? {
                texto: soloLectura ? "Ver ingresos" : "Registrar ingreso",
                icono: soloLectura ? History : Plus,
                href: rutaDeRol(usuario.IdRol, "empaque/bobina-ingreso"),
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
          <BuscadorNombre
            valor={busquedaTipo}
            onCambio={setBusquedaTipo}
            placeholder="Buscar tipo de empaque por nombre..."
          />
          {tiposFiltrados.length === 0 && <SinCoincidencias busqueda={busquedaTipo} />}
          <div className={GRID_TARJETAS}>
            {tiposFiltrados.map((t) => (
              <TarjetaTipo
                key={t.IdTipoEmpaque}
                acento={t}
                activo={detalle.sel === t.IdTipoEmpaque}
                inactivo={!t.Activo}
                onClick={() => detalle.seleccionar(t.IdTipoEmpaque)}
                icono={Package}
                claseIcono="h-7 w-7"
                grosorIcono={2.25}
                nombre={t.NombreTipoEmpaque}
                stock={t.stock}
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
                  onToggle={soloLectura ? undefined : toggleEmpaque}
                />
              </div>
              <div className="md:hidden">
                <ListaMovilEmpaques
                  empaques={empaquesFiltrados}
                  tipoSel={tipoSel}
                  marcados={marcados}
                  onToggle={soloLectura ? undefined : toggleEmpaque}
                />
              </div>
            </ContenidoLista>

            {marcados.length > 0 && (
              <BarraSeleccion
                chips={marcados.map((idEmpaque, i) => ({
                  clave: idEmpaque,
                  texto: codigosMarcados[i],
                  onQuitar: () => quitarChip(idEmpaque),
                }))}
                estado={`${marcados.length} ${marcados.length === 1 ? "empaque" : "empaques"} seleccionados`}
                enviando={envio.enProceso === "envio"}
                onEnviar={() => setConfirmando(true)}
                textoAccion="Trasladar a producción"
                textoEnviando="Trasladando..."
              />
            )}
          </PanelDetalle>
        )}
      </main>

      <DialogoConfirmarTraslado
        abierto={confirmando && marcados.length > 0}
        codigos={codigosMarcados}
        enviando={envio.enProceso === "envio"}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={enviarProduccion}
      />
    </div>
    </TooltipProvider>
  );
}
