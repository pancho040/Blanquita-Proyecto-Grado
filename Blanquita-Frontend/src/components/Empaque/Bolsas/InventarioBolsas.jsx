import { useState } from "react";
import { PackageMinus, PackagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCatalogo } from "@/hooks/useCatalogo";
import {
  GRID_TARJETAS,
  conAcentos,
  TarjetaTipo,
  DatoTarjeta,
  EncabezadoCatalogo,
  EstadoCatalogo,
  PanelDetalle,
} from "@/components/Inventario/comunes";
import { ControlCantidad, ResumenStock } from "@/components/InventarioProductos/comunes";
import Header from "@/components/layout/Header";
import { BotonDescarga } from "@/components/layout/BotonDescarga";
import { TooltipProvider } from "@/components/ui/tooltip";
import { descargarReporteInventarioEmpaque } from "@/services/Empaque/Reporte";
import {
  CANTIDAD_MAXIMA_EMPAQUE_BOLSA,
  MOTIVO_CORRECCION_MIN,
  MOTIVO_CORRECCION_MAX,
  PREFIJO_POR_ROL,
} from "@/constants/Values";
import { EsEncargado, aEntero, limpiarObservacion } from "@/utils/validators";
import { CONFIG_BOLSAS } from "./config";

const esObservacionValida = (texto) => {
  const largo = texto.trim().length;
  return largo >= MOTIVO_CORRECCION_MIN && largo <= MOTIVO_CORRECCION_MAX;
};

function FormularioSalida({ config, item, onRegistrado }) {
  const actual = Number(item.CantidadActual || 0);
  const nombre = item[config.campoNombre];
  const [cantidad, setCantidad] = useState("");
  const [observacion, setObservacion] = useState("");
  const [tocado, setTocado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const maximo = Math.min(actual, CANTIDAD_MAXIMA_EMPAQUE_BOLSA);
  const cantidadNum = aEntero(cantidad);
  const observacionLimpia = observacion.trim();
  const nuevo = cantidadNum > 0 ? actual - cantidadNum : null;

  const limpiar = () => {
    setCantidad("");
    setObservacion("");
    setTocado(false);
  };

  const solicitarConfirmacion = () => {
    setTocado(true);
    if (cantidadNum === 0) {
      toast.error("Ingresa la cantidad a descontar");
      return;
    }
    if (cantidadNum > maximo) {
      toast.error(`La cantidad máxima a descontar es ${maximo}`);
      return;
    }
    if (!esObservacionValida(observacion)) {
      toast.error(
        `La observación debe tener entre ${MOTIVO_CORRECCION_MIN} y ${MOTIVO_CORRECCION_MAX} caracteres`,
      );
      return;
    }
    setConfirmando(true);
  };

  const confirmar = async () => {
    setEnviando(true);
    try {
      const respuesta = await config.sacar(item[config.campoId], cantidadNum, observacionLimpia);
      onRegistrado(item[config.campoId], respuesta.CantidadActual);
      toast.success(
        `Salida registrada: -${respuesta.CantidadMovimiento} ${config.nombreSalida(respuesta)}`,
      );
      limpiar();
      setConfirmando(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (actual === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-400">
        No hay paquetes en almacén para descontar.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
            Paquetes a descontar
          </div>
          <div className="text-[12px] font-semibold text-slate-400">Máx. {maximo}</div>
        </div>
        <ControlCantidad
          valor={cantidad}
          onChange={setCantidad}
          maximo={maximo}
          tono="correccion"
          invalido={tocado}
          etiqueta="Paquetes a descontar"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
          Observación
        </div>
        <div className="flex flex-wrap gap-2">
          {config.observaciones.map((m) => {
            const activo = observacionLimpia === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setObservacion(m)}
                aria-pressed={activo}
                className={cn(
                  "min-h-10 rounded-xl border-2 px-3 py-1.5 text-left text-[13px] font-bold transition-colors",
                  activo
                    ? "border-red-400 bg-red-50 text-red-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
        <Textarea
          value={observacion}
          onChange={(e) => setObservacion(limpiarObservacion(e.target.value))}
          placeholder="Elige una opción o escribe la observación"
          maxLength={MOTIVO_CORRECCION_MAX}
          aria-label="Observación"
          className={cn(
            "min-h-20",
            tocado && !esObservacionValida(observacion) && "border-red-400 ring-1 ring-red-200",
          )}
        />
        <span className="text-xs text-slate-500">
          {observacionLimpia.length}/{MOTIVO_CORRECCION_MAX} · mínimo {MOTIVO_CORRECCION_MIN} caracteres
        </span>
      </div>

      <ResumenStock actual={actual} nuevo={nuevo} tono="correccion" />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="ghost"
          onClick={limpiar}
          className="h-11 font-bold text-slate-500 hover:text-slate-900"
        >
          Limpiar
        </Button>
        <Button
          onClick={solicitarConfirmacion}
          className="h-11 gap-2 bg-red-600 font-extrabold text-white hover:bg-red-700"
        >
          <PackageMinus size={16} strokeWidth={2.75} />
          Registrar salida
        </Button>
      </div>

      <Dialog open={confirmando} onOpenChange={(abierto) => !enviando && setConfirmando(abierto)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Confirmar salida</DialogTitle>
            <DialogDescription>
              Se descontarán {cantidadNum} paquetes de {nombre} del almacén.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[12.5px] text-slate-600">
            <span className="font-bold text-slate-500">Observación: </span>
            {observacionLimpia}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5">
            <span className="text-[13.5px] font-extrabold text-slate-900">{nombre}</span>
            <div className="text-right">
              <div className="text-[15px] font-extrabold tabular-nums text-red-700">
                -{cantidadNum}
              </div>
              <div className="text-[11.5px] tabular-nums text-slate-400">
                {actual} → {nuevo ?? actual}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmando(false)}
              disabled={enviando}
              className="h-11 font-bold text-slate-500 hover:text-slate-900"
            >
              Volver
            </Button>
            <Button
              onClick={confirmar}
              disabled={enviando}
              className="h-11 gap-2 bg-red-600 font-extrabold text-white hover:bg-red-700"
            >
              {enviando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <PackageMinus size={16} strokeWidth={2.75} />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InventarioBolsas({ tipo, usuario }) {
  const config = CONFIG_BOLSAS[tipo];
  const catalogo = useCatalogo(config.verInventario);
  const [sel, setSel] = useState(null);

  const items = conAcentos(catalogo.datos, { cantidadDe: (i) => Number(i.CantidadActual || 0) });
  const itemSel = sel === null ? null : items.find((i) => i[config.campoId] === sel) ?? null;

  const seleccionar = (id) => setSel((actual) => (actual === id ? null : id));

  const actualizarStock = (id, cantidadActual) => {
    catalogo.setDatos((prev) =>
      prev.map((i) => (i[config.campoId] === id ? { ...i, CantidadActual: cantidadActual } : i)),
    );
  };

  const esEncargado = EsEncargado(usuario.IdRol);

  const accion = esEncargado
    ? {
        texto: "Registrar ingreso",
        icono: PackagePlus,
        href: `/${PREFIJO_POR_ROL[usuario.IdRol]}/empaque/${config.rutaIngreso}`,
      }
    : null;

  return (
    <TooltipProvider>
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header titulo="Almacén · Empaque" subtitulo={config.subtitulo} accion={accion}>
        {esEncargado && (
          <BotonDescarga
            texto="Descargar inventario"
            ayuda={`PDF con el stock actual de todos los ${config.plural}`}
            exito="Informe de inventario descargado"
            descargar={() => descargarReporteInventarioEmpaque(tipo)}
          />
        )}
      </Header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        <EncabezadoCatalogo titulo={config.catalogo}>
          {items.length}{" "}
          <strong className="text-slate-700">{items.length === 1 ? config.singular : config.plural}</strong>
        </EncabezadoCatalogo>

        <EstadoCatalogo
          cargando={catalogo.cargando}
          error={catalogo.error}
          vacio={items.length === 0}
          mensajeVacio={config.vacio}
          altoSkeleton="h-44"
        >
          <div className={GRID_TARJETAS}>
            {items.map((i) => (
              <TarjetaTipo
                key={i[config.campoId]}
                acento={i}
                activo={sel === i[config.campoId]}
                onClick={() => seleccionar(i[config.campoId])}
                icono={config.icono}
                claseIcono="h-7 w-7"
                grosorIcono={2.25}
                nombre={i[config.campoNombre]}
                etiqueta={i.badge}
                cantidad={Number(i.CantidadActual || 0)}
                unidad="paquetes en almacén"
                textoVer="Registrar salida"
              >
                {i[config.campoDescripcion] && (
                  <DatoTarjeta etiqueta="Descripción">{i[config.campoDescripcion]}</DatoTarjeta>
                )}
              </TarjetaTipo>
            ))}
          </div>
        </EstadoCatalogo>

        {itemSel && (
          <PanelDetalle
            acento={itemSel}
            icono={config.icono}
            claseIcono="h-6 w-6"
            grosorIcono={2.25}
            titulo={itemSel[config.campoNombre]}
            subtitulo={`${Number(itemSel.CantidadActual || 0)} paquetes en almacén`}
            onCerrar={() => setSel(null)}
          >
            <FormularioSalida
              key={itemSel[config.campoId]}
              config={config}
              item={itemSel}
              onRegistrado={actualizarStock}
            />
          </PanelDetalle>
        )}
      </main>
    </div>
    </TooltipProvider>
  );
}
