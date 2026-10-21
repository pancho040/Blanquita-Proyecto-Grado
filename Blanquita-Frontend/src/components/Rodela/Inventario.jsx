import { useState } from "react";
import { Plus, Loader2, Disc, Pencil, SquarePen } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import InputForModal from "@/components/layout/InputForModal";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  verResumenInventarioRodela,
  verDetalleInventarioRodela,
  trasladarRodelaAProduccion,
  editarRodela,
} from "../../services/Rodela/Inventario";
import { descargarReporteInventarioRodela } from "@/services/Rodela/Reportes";
import { dateFormatter } from "@/utils/dates";
import { aCodigo } from "@/utils/handlers";
import { extraerMensajeError, limpiarObservacion } from "@/utils/validators";
import { useCatalogo } from "@/hooks/useCatalogo";
import { useDetalleInventario } from "@/hooks/useDetalleInventario";
import { useEjecutar } from "@/hooks/useEjecutar";
import { BotonDescarga } from "@/components/layout/BotonDescarga";
import {
  GRID_TARJETAS,
  conAcentos,
  coincide,
  TarjetaTipo,
  DatoTarjeta,
  EncabezadoCatalogo,
  EstadoCatalogo,
  PanelDetalle,
  BuscadorCodigo,
  ContenidoLista,
  CasillaSeleccion,
  BarraSeleccion,
} from "@/components/Inventario/comunes";
import Header from "@/components/layout/Header";
import {
  Roles,
  MOTIVO_CORRECCION_MIN,
  MOTIVO_CORRECCION_MAX,
} from "@/constants/Values";

const ESTADO_ALMACEN = "En almacén";
const REQUERIDAS = 1;

const etiquetaRodelas = (n) => {
  const cantidad = Number(n || 0);
  return `${cantidad} ${cantidad === 1 ? "rodela" : "rodelas"}`;
};

const cargarRodelasEnAlmacen = async (idTipoRodela) => {
  const data = await verDetalleInventarioRodela(idTipoRodela);
  return data.filter((r) => r.TipoEstado === ESTADO_ALMACEN);
};

function BotonEditar({ rodela, onEditar, className }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onEditar(rodela)}
      aria-label={`Editar ${rodela.CodigoRodela}`}
      className={cn("gap-1.5 font-bold text-c3", className)}
    >
      <SquarePen size={14} strokeWidth={2.5} />
      Editar
    </Button>
  );
}

function TablaRodelas({ rodelas, tipoSel, marcadas, onToggle, onEditar }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[560px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-11 pl-5" />
            <TableHead>Código</TableHead>
            <TableHead>Lote</TableHead>
            <TableHead>Recepción</TableHead>
            <TableHead className={cn(!onEditar && "pr-5")}>Proveedor</TableHead>
            {onEditar && <TableHead className="pr-5 text-right">Acción</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rodelas.map((r) => {
            const on = marcadas.includes(r.CodigoRodela);
            return (
              <TableRow key={r.IdRodela} className={cn(on && tipoSel.soft)}>
                <TableCell className="pl-5">
                  <CasillaSeleccion
                    marcada={on}
                    acento={tipoSel}
                    onClick={() => onToggle(r.CodigoRodela)}
                  />
                </TableCell>
                <TableCell className={cn("font-mono font-bold", tipoSel.text)}>
                  {r.CodigoRodela}
                </TableCell>
                <TableCell className="text-slate-600">{r.CodigoLote}</TableCell>
                <TableCell className="text-slate-600">
                  {dateFormatter(r.FechaRecepcion)}
                </TableCell>
                <TableCell className={cn("text-slate-600", !onEditar && "pr-5")}>
                  {r.NombreProveedor}
                </TableCell>
                {onEditar && (
                  <TableCell className="pr-5 text-right">
                    <BotonEditar rodela={r} onEditar={onEditar} />
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ListaMovilRodelas({ rodelas, tipoSel, marcadas, onToggle, onEditar }) {
  return (
    <div className="flex flex-col gap-2.5 p-3.5">
      {rodelas.map((r) => {
        const on = marcadas.includes(r.CodigoRodela);
        return (
          <div
            key={r.IdRodela}
            className={cn(
              "flex flex-col gap-2.5 rounded-2xl border-2 p-3.5",
              on ? cn(tipoSel.soft, tipoSel.border) : "border-slate-200 bg-white",
            )}
          >
            <div className="flex items-center justify-between gap-2.5">
              <div className={cn("font-mono text-[15px] font-extrabold", tipoSel.text)}>
                {r.CodigoRodela}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {onEditar && <BotonEditar rodela={r} onEditar={onEditar} />}
                <CasillaSeleccion
                  marcada={on}
                  acento={tipoSel}
                  grande
                  onClick={() => onToggle(r.CodigoRodela)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-slate-600">
              <span>
                <strong className="text-slate-900">{r.CodigoLote}</strong> ·{" "}
                {dateFormatter(r.FechaRecepcion)}
              </span>
              <span>{r.NombreProveedor}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function InventarioRodelas({ usuario }) {
  const esEncargado = usuario?.IdRol === Roles.Encargado;

  const resumen = useCatalogo(verResumenInventarioRodela);
  const detalle = useDetalleInventario(cargarRodelasEnAlmacen);
  const envio = useEjecutar();

  const [dialogEditar, setDialogEditar] = useState({ open: false, rodela: null });
  const [formCodigo, setFormCodigo] = useState("");
  const [formMotivo, setFormMotivo] = useState("");
  const [errorEditar, setErrorEditar] = useState("");
  const [guardandoEditar, setGuardandoEditar] = useState(false);

  const tipos = conAcentos(resumen.datos, { cantidadDe: (t) => t.CantidadEnAlmacen });
  const tipoSel = detalle.sel ? tipos.find((t) => t.IdTipoRodela === detalle.sel) : null;
  const { marcadas, setMarcadas } = detalle;
  const listas = marcadas.length === REQUERIDAS;

  const totalEnAlmacen = tipos.reduce((s, t) => s + Number(t.CantidadEnAlmacen || 0), 0);

  const rodelasFiltradas = detalle.datos.filter((r) =>
    coincide(detalle.busqueda, r.CodigoRodela),
  );

  const toggleRodela = (codigo) => {
    setMarcadas((prev) => (prev.includes(codigo) ? [] : [codigo]));
  };

  const quitarChip = (codigo) => setMarcadas((prev) => prev.filter((c) => c !== codigo));

  const refrescar = () => {
    resumen.recargar();
    detalle.recargar();
  };

  const enviarProduccion = () => {
    if (!listas) return;

    const rodela = detalle.datos.find((r) => r.CodigoRodela === marcadas[0]);
    if (!rodela) return;

    envio.ejecutar(
      "envio",
      () => trasladarRodelaAProduccion(rodela.IdRodela),
      `${rodela.CodigoRodela} → Abierta en producción`,
      () => {
        setMarcadas([]);
        refrescar();
      },
    );
  };

  const codigoLimpio = formCodigo.trim();
  const motivoLimpio = formMotivo.trim();
  const codigoCambio =
    !!dialogEditar.rodela &&
    codigoLimpio !== "" &&
    codigoLimpio !== dialogEditar.rodela.CodigoRodela;
  const motivoValido =
    motivoLimpio.length >= MOTIVO_CORRECCION_MIN &&
    motivoLimpio.length <= MOTIVO_CORRECCION_MAX;

  const abrirEditar = (rodela) => {
    setFormCodigo(rodela.CodigoRodela);
    setFormMotivo("");
    setErrorEditar("");
    setDialogEditar({ open: true, rodela });
  };

  const confirmarEditar = async () => {
    const rodela = dialogEditar.rodela;
    if (!rodela || !codigoCambio || !motivoValido) return;

    setGuardandoEditar(true);
    setErrorEditar("");
    try {
      const res = await editarRodela(rodela.IdRodela, codigoLimpio, motivoLimpio);
      toast.success(`${res.CodigoAnterior} → ${res.CodigoRodela} actualizada`);
      setDialogEditar({ open: false, rodela: null });
      setMarcadas((prev) => prev.filter((c) => c !== res.CodigoAnterior));
      refrescar();
    } catch (e) {
      setErrorEditar(extraerMensajeError(e, e.message));
    } finally {
      setGuardandoEditar(false);
    }
  };

  return (
    <TooltipProvider>
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header
        titulo="Almacén · Materia Prima"
        subtitulo="Inventario de Rodelas"
        accion={
          esEncargado
            ? {
                texto: "Registrar ingreso",
                icono: Plus,
                href: "/encargado/rodela/ingreso",
              }
            : null
        }
      >
        {esEncargado && (
          <BotonDescarga
            texto="Descargar inventario"
            ayuda="PDF con el inventario completo de todos los tipos de rodela"
            exito="Informe de inventario descargado"
            descargar={() => descargarReporteInventarioRodela(null)}
          />
        )}
      </Header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        <EncabezadoCatalogo titulo="Catálogo por tipo de rodela">
          {totalEnAlmacen} rodelas <strong className="text-slate-700">en almacén</strong>
        </EncabezadoCatalogo>

        <EstadoCatalogo
          cargando={resumen.cargando}
          error={resumen.error}
          vacio={tipos.length === 0}
          mensajeVacio="No hay tipos de rodela registrados."
          altoSkeleton="h-52"
        >
          <div className={GRID_TARJETAS}>
            {tipos.map((t) => (
              <TarjetaTipo
                key={t.IdTipoRodela}
                acento={t}
                activo={detalle.sel === t.IdTipoRodela}
                inactivo={!t.Activo}
                onClick={() => detalle.seleccionar(t.IdTipoRodela)}
                icono={Disc}
                nombre={t.NombreTipoRodela}
                stock={t.stock}
                cantidad={t.CantidadEnAlmacen}
                unidad="rodelas en almacén"
                textoVer="Ver rodelas"
              >
                <DatoTarjeta etiqueta="Abiertas en producción">
                  {etiquetaRodelas(t.CantidadAbiertas)}
                </DatoTarjeta>
                {t.Descripcion && (
                  <div className="text-[12.5px] leading-snug text-slate-500">{t.Descripcion}</div>
                )}
              </TarjetaTipo>
            ))}
          </div>
        </EstadoCatalogo>

        {tipoSel && (
          <PanelDetalle
            acento={tipoSel}
            icono={Disc}
            titulo={`Rodelas · ${tipoSel.NombreTipoRodela}`}
            subtitulo={`${tipoSel.CantidadEnAlmacen} en almacén · ${tipoSel.CantidadAbiertas} abiertas`}
            etiqueta="Se traslada 1 rodela"
            onCerrar={detalle.cerrar}
          >
            <ContenidoLista
              cargando={detalle.cargando}
              error={detalle.error}
              total={detalle.datos.length}
              cantidadFiltrada={rodelasFiltradas.length}
              buscador={<BuscadorCodigo valor={detalle.busqueda} onCambio={detalle.setBusqueda} />}
              mensajeVacio="No hay rodelas en almacén para este tipo."
              mensajeSinCoincidencias={`Ninguna rodela coincide con "${detalle.busqueda}".`}
            >
              <div className="hidden md:block">
                <TablaRodelas
                  rodelas={rodelasFiltradas}
                  tipoSel={tipoSel}
                  marcadas={marcadas}
                  onToggle={toggleRodela}
                  onEditar={esEncargado ? abrirEditar : null}
                />
              </div>
              <div className="md:hidden">
                <ListaMovilRodelas
                  rodelas={rodelasFiltradas}
                  tipoSel={tipoSel}
                  marcadas={marcadas}
                  onToggle={toggleRodela}
                  onEditar={esEncargado ? abrirEditar : null}
                />
              </div>
            </ContenidoLista>

            {marcadas.length > 0 && (
              <BarraSeleccion
                chips={marcadas.map((codigo) => ({
                  clave: codigo,
                  texto: codigo,
                  onQuitar: () => quitarChip(codigo),
                }))}
                estado={
                  listas
                    ? "Listo para trasladar"
                    : `Selecciona ${REQUERIDAS - marcadas.length} más`
                }
                listo={listas}
                enviando={envio.enProceso === "envio"}
                onEnviar={enviarProduccion}
                textoAccion="Trasladar a producción"
                textoEnviando="Trasladando..."
              />
            )}
          </PanelDetalle>
        )}
      </main>

      <Dialog
        open={dialogEditar.open}
        onOpenChange={(open) =>
          setDialogEditar({ open, rodela: open ? dialogEditar.rodela : null })
        }
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar rodela</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {dialogEditar.rodela && (
              <div className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Código actual
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {dialogEditar.rodela.CodigoRodela}
                </span>
                <span className="text-[12px] text-slate-500">
                  {dialogEditar.rodela.CodigoLote} · {dialogEditar.rodela.NombreProveedor}
                </span>
              </div>
            )}

            <InputForModal
              id="codigo-rodela-editar"
              etiqueta="Nuevo código"
              valor={formCodigo}
              onCambio={(valor) => setFormCodigo(aCodigo(valor))}
              classNameInput="font-mono font-bold"
              autoComplete="off"
            />

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="motivo-editar-rodela"
                className="text-xs font-bold uppercase tracking-wide text-slate-600"
              >
                Motivo de la corrección
              </Label>
              <Textarea
                id="motivo-editar-rodela"
                value={formMotivo}
                onChange={(e) => setFormMotivo(limpiarObservacion(e.target.value))}
                placeholder="Ej. Error de digitación al registrar el ingreso..."
                className="min-h-20"
                maxLength={MOTIVO_CORRECCION_MAX}
              />
              <span className="text-xs text-slate-500">
                {motivoLimpio.length}/{MOTIVO_CORRECCION_MAX} · mínimo{" "}
                {MOTIVO_CORRECCION_MIN} caracteres
              </span>
            </div>

            {errorEditar && (
              <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600">
                {errorEditar}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={confirmarEditar}
              disabled={guardandoEditar || !codigoCambio || !motivoValido}
              className="h-11 w-full gap-2 bg-gradient-to-r from-c3 to-c4 font-extrabold text-white hover:opacity-90 sm:w-auto"
            >
              {guardandoEditar ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Pencil size={16} strokeWidth={2.75} />
                  Guardar cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
