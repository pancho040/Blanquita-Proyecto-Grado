import { useState, useMemo } from "react";
import {
  X,
  Loader2,
  PackageMinus,
  ClipboardMinus,
  ClipboardPlus,
  ListChecks,
} from "lucide-react";
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
import {
  corregirInventarioProductoTerminado,
  ajustePositivoInventarioProductoTerminado,
  ajusteNegativoInventarioProductoTerminado,
} from "../../services/Inventario/Inventario";
import {
  MotivosCorreccionProductoTerminado,
  MotivosAjustePositivoProductoTerminado,
  MotivosAjusteNegativoProductoTerminado,
} from "@/constants/OperadorConfig";
import { MOTIVO_CORRECCION_MIN, MOTIVO_CORRECCION_MAX, AjusteMax } from "@/constants/Values";
import { aEntero, limpiarObservacion } from "@/utils/validators";
import {
  descripcionContenido,
  BadgeEstado,
  ControlCantidad,
  PildorasLinea,
  SinLineaSeleccionada,
  OpcionPresentacion,
  ResumenStock,
} from "./comunes";

const CANTIDAD_MAXIMA_CORRECCION = 50;

const CLASES_RESTA = {
  borde: "border-red-300",
  motivo: "border-red-400 bg-red-50 text-red-700",
  boton: "bg-red-600 hover:bg-red-700",
  cantidad: "text-red-700",
};

const CLASES_SUMA = {
  borde: "border-emerald-300",
  motivo: "border-emerald-400 bg-emerald-50 text-emerald-700",
  boton: "bg-emerald-600 hover:bg-emerald-700",
  cantidad: "text-emerald-700",
};

const TIPOS = {
  descuento: {
    signo: -1,
    tono: "correccion",
    Icono: PackageMinus,
    motivos: MotivosCorreccionProductoTerminado,
    registrar: corregirInventarioProductoTerminado,
    titulo: "Corrección",
    nombre: "corrección",
    accion: "descontar",
    confirmacion: (cantidad) => `Se descontarán ${cantidad} unidades del inventario.`,
    exito: "Corrección registrada",
    cantidadMaxima: CANTIDAD_MAXIMA_CORRECCION,
    clases: CLASES_RESTA,
  },
  ajustePositivo: {
    signo: 1,
    tono: "ingreso",
    Icono: ClipboardPlus,
    motivos: MotivosAjustePositivoProductoTerminado,
    registrar: ajustePositivoInventarioProductoTerminado,
    titulo: "Ajuste positivo",
    nombre: "ajuste positivo",
    accion: "sumar",
    confirmacion: (cantidad) => `Se sumarán ${cantidad} unidades al inventario.`,
    exito: "Ajuste positivo registrado",
    cantidadMaxima: AjusteMax,
    clases: CLASES_SUMA,
  },
  ajusteNegativo: {
    signo: -1,
    tono: "correccion",
    Icono: ClipboardMinus,
    motivos: MotivosAjusteNegativoProductoTerminado,
    registrar: ajusteNegativoInventarioProductoTerminado,
    titulo: "Ajuste negativo",
    nombre: "ajuste negativo",
    accion: "restar",
    confirmacion: (cantidad) => `Se restarán ${cantidad} unidades del inventario.`,
    exito: "Ajuste negativo registrado",
    cantidadMaxima: AjusteMax,
    clases: CLASES_RESTA,
  },
};

const esObservacionValida = (texto) => {
  const largo = texto.trim().length;
  return largo >= MOTIVO_CORRECCION_MIN && largo <= MOTIVO_CORRECCION_MAX;
};

function CardCorreccion({
  config,
  presentacion,
  valor,
  maximo,
  observacion,
  invalido,
  onCantidad,
  onObservacion,
  onQuitar,
}) {
  const cantidad = aEntero(valor);
  const actual = Number(presentacion.CantidadActual || 0);

  return (
    <div
      className={cn(
        "flex flex-col gap-3.5 rounded-2xl border-2 bg-white p-4 shadow-sm",
        cantidad > 0 ? config.clases.borde : "border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[16px] font-extrabold text-c3">
              {presentacion.CodigoPresentacion}
            </span>
            <BadgeEstado cantidad={presentacion.CantidadActual} umbral={presentacion} />
          </div>
          <div className="text-[13px] font-semibold text-slate-900">
            {presentacion.NombreProducto}
          </div>
          <div className="text-[12.5px] text-slate-600">
            {presentacion.TipoContenedor} · {descripcionContenido(presentacion)}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={onQuitar}
          aria-label={`Quitar ${presentacion.CodigoPresentacion}`}
          className="h-9 w-9 shrink-0 p-0 text-slate-400 hover:text-red-600"
        >
          <X size={17} strokeWidth={2.75} />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
            Cantidad a {config.accion}
          </div>
          <div className="text-[12px] font-semibold text-slate-400">
            Máx. {maximo}
          </div>
        </div>
        <ControlCantidad
          valor={valor}
          onChange={onCantidad}
          maximo={maximo}
          tono={config.tono}
          autoFocus
          invalido={invalido}
          etiqueta={`Cantidad a ${config.accion}`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
          Observación
        </div>
        <div className="flex flex-wrap gap-2">
          {config.motivos.map((m) => {
            const activo = observacion.trim() === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onObservacion(m)}
                aria-pressed={activo}
                className={cn(
                  "min-h-10 rounded-xl border-2 px-3 py-1.5 text-left text-[13px] font-bold transition-colors",
                  activo
                    ? config.clases.motivo
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
          onChange={(e) => onObservacion(limpiarObservacion(e.target.value))}
          placeholder="Elige una opción o escribe la observación"
          maxLength={MOTIVO_CORRECCION_MAX}
          aria-label="Observación"
          className={cn(
            "min-h-20",
            invalido && !esObservacionValida(observacion) && "border-red-400 ring-1 ring-red-200",
          )}
        />
        <span className="text-xs text-slate-500">
          {observacion.trim().length}/{MOTIVO_CORRECCION_MAX} · mínimo{" "}
          {MOTIVO_CORRECCION_MIN} caracteres
        </span>
      </div>

      <ResumenStock
        actual={actual}
        nuevo={cantidad > 0 ? actual + config.signo * cantidad : null}
        tono={config.tono}
      />
    </div>
  );
}

export default function CorreccionProductoTerminado({
  inventario,
  onStockActualizado,
  tipo = "descuento",
}) {
  const config = TIPOS[tipo];
  const { Icono } = config;
  const signoTexto = config.signo > 0 ? "+" : "-";

  const [linea, setLinea] = useState("");
  const [idSeleccionada, setIdSeleccionada] = useState(null);
  const [cantidad, setCantidad] = useState("");
  const [observacion, setObservacion] = useState("");
  const [tocado, setTocado] = useState(false);

  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const lineas = useMemo(
    () => Array.from(new Set(inventario.map((p) => p.NombreProducto))),
    [inventario],
  );

  const presentacionesLinea = useMemo(
    () => inventario.filter((p) => p.NombreProducto === linea),
    [inventario, linea],
  );

  const seleccionada =
    idSeleccionada === null
      ? null
      : inventario.find((p) => p.IdPresentacion === idSeleccionada) ?? null;

  const actual = Number(seleccionada?.CantidadActual || 0);
  const maximo =
    config.signo < 0
      ? Math.min(actual, config.cantidadMaxima)
      : config.cantidadMaxima;
  const cantidadNum = aEntero(cantidad);
  const observacionLimpia = observacion.trim();

  const sinStockParaDescontar = (presentacion) =>
    config.signo < 0 && Number(presentacion.CantidadActual || 0) === 0;

  const seleccionar = (presentacion) => {
    if (sinStockParaDescontar(presentacion)) return;
    setIdSeleccionada(presentacion.IdPresentacion);
    setCantidad("");
    setObservacion("");
    setTocado(false);
  };

  const limpiar = () => {
    setIdSeleccionada(null);
    setCantidad("");
    setObservacion("");
    setTocado(false);
  };

  const solicitarConfirmacion = () => {
    setTocado(true);
    if (!seleccionada) return;
    if (cantidadNum === 0) {
      toast.error(`Ingresa la cantidad a ${config.accion}`);
      return;
    }
    if (cantidadNum > maximo) {
      toast.error(`La cantidad máxima a ${config.accion} es ${maximo}`);
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

  const confirmarCorreccion = async () => {
    setEnviando(true);
    try {
      const respuesta = await config.registrar(
        seleccionada.IdPresentacion,
        cantidadNum,
        observacionLimpia,
      );
      onStockActualizado([respuesta]);
      toast.success(
        `${config.exito}: ${signoTexto}${respuesta.CantidadAplicada} ${respuesta.CodigoPresentacion}`,
      );
      limpiar();
      setConfirmando(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <PildorasLinea lineas={lineas} linea={linea} onCambio={setLinea} />

        {linea ? (
          <div className="mt-5 flex flex-col gap-2.5">
            <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
              Presentaciones de {linea}
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {presentacionesLinea.map((p) => (
                <OpcionPresentacion
                  key={p.IdPresentacion}
                  presentacion={p}
                  tono={config.tono}
                  marcada={p.IdPresentacion === idSeleccionada}
                  textoMarcada="Seleccionada"
                  deshabilitada={sinStockParaDescontar(p)}
                  onSeleccionar={seleccionar}
                />
              ))}
            </div>
          </div>
        ) : (
          <SinLineaSeleccionada />
        )}
      </section>

      {seleccionada && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <ListChecks size={17} strokeWidth={2.5} className="text-c3" />
            <h2 className="text-[15px] font-extrabold text-slate-900">
              {config.titulo} a registrar
            </h2>
          </div>
          <CardCorreccion
            key={seleccionada.IdPresentacion}
            config={config}
            presentacion={seleccionada}
            valor={cantidad}
            maximo={maximo}
            observacion={observacion}
            invalido={tocado}
            onCantidad={setCantidad}
            onObservacion={setObservacion}
            onQuitar={limpiar}
          />

          <div className="mt-2 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[14px] font-extrabold text-slate-900">
                {cantidadNum > 0
                  ? `${signoTexto}${cantidadNum} u. de ${seleccionada.CodigoPresentacion}`
                  : seleccionada.CodigoPresentacion}
                <span className="ml-2 text-[12px] font-semibold text-slate-400">
                  Una presentación por {config.nombre}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={limpiar}
                  className="h-11 font-bold text-slate-500 hover:text-slate-900"
                >
                  Limpiar
                </Button>
                <Button
                  onClick={solicitarConfirmacion}
                  className={cn("h-11 gap-2 font-extrabold text-white", config.clases.boton)}
                >
                  <Icono size={16} strokeWidth={2.75} />
                  Registrar {config.nombre}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <Dialog
        open={confirmando}
        onOpenChange={(abierto) => !enviando && setConfirmando(abierto)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">
              Confirmar {config.nombre}
            </DialogTitle>
            <DialogDescription>
              {config.confirmacion(cantidadNum)} Esta acción no se puede deshacer
              desde aquí.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[12.5px] text-slate-600">
            <span className="font-bold text-slate-500">Observación: </span>
            {observacionLimpia}
          </div>

          {seleccionada && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5">
              <div className="flex flex-col">
                <span className="font-mono text-[13.5px] font-extrabold text-c3">
                  {seleccionada.CodigoPresentacion}
                </span>
                <span className="text-[12px] text-slate-500">
                  {seleccionada.NombreProducto}
                </span>
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    "text-[15px] font-extrabold tabular-nums",
                    config.clases.cantidad,
                  )}
                >
                  {signoTexto}
                  {cantidadNum}
                </div>
                <div className="text-[11.5px] tabular-nums text-slate-400">
                  {actual} → {actual + config.signo * cantidadNum}
                </div>
              </div>
            </div>
          )}

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
              onClick={confirmarCorreccion}
              disabled={enviando}
              className={cn("h-11 gap-2 font-extrabold text-white", config.clases.boton)}
            >
              {enviando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <Icono size={16} strokeWidth={2.75} />
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
