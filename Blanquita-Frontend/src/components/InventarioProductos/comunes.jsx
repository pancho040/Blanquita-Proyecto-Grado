import { Plus, Minus, Check, PackageOpen, Lock, NotebookPen } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { aEntero } from "@/utils/validators";
import { estadoStock, ESTILO_STOCK } from "@/utils/stock";
import {
  textoMovimientosBloqueados,
  esBloqueoPorConteo,
  RUTA_CONTEO_FISICO,
} from "@/utils/bloqueoProducto";

export const descripcionContenido = (p) => {
  const partes = [];
  if (p.CantidadRollosUnidades) partes.push(`${p.CantidadRollosUnidades} u/paq`);
  if (p.CantidadPorUnidadTerminada)
    partes.push(
      `${p.CantidadPorUnidadTerminada} por ${(p.TipoContenedor || "unidad").toLowerCase()}`,
    );
  return partes.length > 0 ? partes.join(" · ") : "-";
};

export const horaBloqueo = (bloqueo) =>
  bloqueo?.FechaHoraBloqueo ? format(new Date(bloqueo.FechaHoraBloqueo), "dd/MM/yyyy HH:mm") : "";

export function AvisoBloqueo({ bloqueo, texto, accion = null, className }) {
  if (!bloqueo?.Bloqueado) return null;
  const porConteo = esBloqueoPorConteo(bloqueo);
  const IconoAviso = porConteo ? NotebookPen : Lock;
  const textoAviso = porConteo
    ? "Se habilitan cuando el líder cierre o anule el conteo físico."
    : texto;
  const accionAviso =
    porConteo && accion ? { texto: "Ir al conteo", href: RUTA_CONTEO_FISICO } : accion;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <IconoAviso size={19} strokeWidth={2.5} />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[14px] font-extrabold text-amber-900">
            {textoMovimientosBloqueados(bloqueo)} en producto terminado
          </span>
          <span className="text-[12.5px] text-amber-800">
            {bloqueo.UsuarioBloqueo} · desde {horaBloqueo(bloqueo)}
          </span>
          <span className="break-words text-[12.5px] text-amber-800">
            <span className="font-bold">Motivo: </span>
            {bloqueo.MotivoBloqueo}
          </span>
          {textoAviso && (
            <span className="text-[12.5px] font-semibold text-amber-900">{textoAviso}</span>
          )}
        </div>
      </div>
      {accionAviso && (
        <Button
          nativeButton={false}
          render={<a href={accionAviso.href} />}
          className="h-11 shrink-0 gap-2 bg-amber-600 font-extrabold text-white hover:bg-amber-700"
        >
          {accionAviso.texto}
        </Button>
      )}
    </div>
  );
}

const TONOS = {
  ingreso: {
    lleno: "border-emerald-400 bg-emerald-50 text-emerald-800",
    marcada: "border-emerald-300 bg-emerald-50",
    textoMarcada: "text-emerald-700",
    nuevo: "text-emerald-700",
  },
  correccion: {
    lleno: "border-red-400 bg-red-50 text-red-800",
    marcada: "border-red-300 bg-red-50",
    textoMarcada: "text-red-700",
    nuevo: "text-red-700",
  },
};

export function BadgeEstado({ cantidad, umbral, className }) {
  const estado = estadoStock(cantidad, umbral);
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-0 text-[11px] font-bold",
        ESTILO_STOCK[estado].clase,
        className,
      )}
    >
      {ESTILO_STOCK[estado].texto}
    </Badge>
  );
}

export function ControlCantidad({
  valor,
  onChange,
  maximo,
  tono = "ingreso",
  autoFocus = false,
  invalido = false,
  etiqueta = "Cantidad",
}) {
  const numero = aEntero(valor);

  const ajustar = (delta) => {
    const siguiente = Math.min(maximo, Math.max(0, numero + delta));
    onChange(siguiente === 0 ? "" : String(siguiente));
  };

  const manejarCambio = (e) => {
    const limpio = e.target.value.replace(/\D/g, "");
    if (limpio === "") return onChange("");
    const acotado = Math.min(maximo, Number(limpio));
    onChange(acotado === 0 ? "" : String(acotado));
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        onClick={() => ajustar(-1)}
        disabled={numero === 0}
        aria-label="Restar una unidad"
        className="h-11 w-11 shrink-0 border-2 border-slate-200 p-0 text-slate-600"
      >
        <Minus size={16} strokeWidth={3} />
      </Button>
      <Input
        inputMode="numeric"
        value={valor}
        onChange={manejarCambio}
        placeholder="0"
        autoFocus={autoFocus}
        aria-label={etiqueta}
        className={cn(
          "h-11 w-full min-w-0 text-center text-lg font-extrabold tabular-nums",
          numero > 0 && TONOS[tono].lleno,
          invalido && numero === 0 && "border-red-400 ring-1 ring-red-200",
        )}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => ajustar(1)}
        disabled={numero >= maximo}
        aria-label="Sumar una unidad"
        className="h-11 w-11 shrink-0 border-2 border-slate-200 p-0 text-slate-600"
      >
        <Plus size={16} strokeWidth={3} />
      </Button>
    </div>
  );
}

export function PildorasLinea({ lineas, linea, onCambio, contadores }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
        Línea de producto
      </div>
      <div className="flex flex-wrap gap-2">
        {lineas.map((nombre) => {
          const activa = linea === nombre;
          const contador = contadores?.get(nombre) ?? 0;
          return (
            <button
              key={nombre}
              type="button"
              onClick={() => onCambio(nombre)}
              aria-pressed={activa}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors",
                activa
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {nombre}
              {contador > 0 && (
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center text-[11.5px] font-extrabold tabular-nums",
                    activa
                      ? "bg-white/20 text-white"
                      : "bg-emerald-100 text-emerald-700",
                  )}
                >
                  {contador}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SinLineaSeleccionada() {
  return (
    <div className="mt-5 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
      <PackageOpen size={26} strokeWidth={2} />
      Selecciona una línea para ver sus presentaciones
    </div>
  );
}

export function OpcionPresentacion({
  presentacion,
  marcada = false,
  textoMarcada = "Agregada",
  deshabilitada = false,
  tono = "ingreso",
  onSeleccionar,
}) {
  const IconoAccion = tono === "correccion" ? Minus : Plus;

  return (
    <button
      type="button"
      onClick={() => onSeleccionar(presentacion)}
      disabled={marcada || deshabilitada}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border-2 px-3.5 py-3 text-left transition-colors",
        marcada && cn("cursor-default", TONOS[tono].marcada),
        deshabilitada && "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60",
        !marcada &&
          !deshabilitada &&
          "border-slate-200 bg-white hover:border-c4 hover:bg-c4/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[15px] font-extrabold text-c3">
          {presentacion.CodigoPresentacion}
        </span>
        {marcada && (
          <span
            className={cn(
              "flex items-center gap-1 text-[11.5px] font-extrabold uppercase",
              TONOS[tono].textoMarcada,
            )}
          >
            <Check size={13} strokeWidth={3} />
            {textoMarcada}
          </span>
        )}
        {deshabilitada && !marcada && (
          <span className="text-[11.5px] font-extrabold uppercase text-slate-400">
            Sin stock
          </span>
        )}
        {!marcada && !deshabilitada && (
          <IconoAccion size={16} strokeWidth={3} className="text-slate-400" />
        )}
      </div>
      <div className="text-[12.5px] text-slate-600">
        {presentacion.TipoContenedor} · {descripcionContenido(presentacion)}
      </div>
      <div className="text-[12px] font-semibold text-slate-400">
        Stock actual:{" "}
        <span className="font-extrabold tabular-nums text-slate-700">
          {presentacion.CantidadActual}
        </span>
      </div>
    </button>
  );
}

export function ResumenStock({ actual, nuevo, tono = "ingreso" }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-100 px-4 py-3">
      <div className="flex flex-col gap-1">
        <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
          Stock actual
        </span>
        <span className="text-2xl font-extrabold tabular-nums leading-none text-slate-900">
          {actual}
        </span>
      </div>
      {nuevo !== null && (
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              "text-[12px] font-bold uppercase tracking-wide",
              TONOS[tono].nuevo,
            )}
          >
            Quedará en
          </span>
          <span
            className={cn(
              "text-2xl font-extrabold tabular-nums leading-none",
              TONOS[tono].nuevo,
            )}
          >
            {nuevo}
          </span>
        </div>
      )}
    </div>
  );
}
