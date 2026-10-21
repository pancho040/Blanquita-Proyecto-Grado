import { useEffect, useState } from "react";
import { X, ArrowRight, Loader2, Search, Check, PackageX, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ACENTOS } from "@/constants/Acentos";
import { MOTIVO_CORRECCION_MIN, MOTIVO_CORRECCION_MAX } from "@/constants/Values";
import { dateFormatter } from "@/utils/dates";
import { limpiarObservacion } from "@/utils/validators";
import { estadoStock, ESTILO_STOCK } from "@/utils/stock";

export const GRID_TARJETAS = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

const TARJETA =
  "flex flex-col gap-3.5 rounded-2xl border-2 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md";

const MENSAJE = "p-8 text-center text-sm text-slate-400";

export const conAcentos = (lista, { cantidadDe, desplazamiento = 0 } = {}) =>
  lista.map((t, i) => ({
    ...t,
    ...ACENTOS[(i + desplazamiento) % ACENTOS.length],
    ...(cantidadDe ? { stock: estadoStock(cantidadDe(t), t) } : {}),
  }));

export const coincide = (busqueda, ...valores) => {
  const q = busqueda.trim().toLowerCase();
  return !q || valores.some((v) => String(v ?? "").toLowerCase().includes(q));
};

export function BadgeInactivo({ className }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-amber-300 bg-amber-50 font-bold text-amber-700", className)}
    >
      Inactivo
    </Badge>
  );
}

export function TarjetaTipo({
  acento,
  activo,
  inactivo = false,
  onClick,
  icono: Icono,
  claseIcono = "h-8 w-8",
  grosorIcono = 2,
  nombre,
  etiqueta,
  stock,
  cantidad,
  unidad,
  textoVer,
  children,
}) {
  const estilo = stock ? ESTILO_STOCK[stock] : null;
  return (
    <button onClick={onClick} className={cn(TARJETA, activo ? acento.border : "border-slate-200")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Icono className={cn(claseIcono, "shrink-0", acento.text)} strokeWidth={grosorIcono} />
          <div className="text-[17px] font-extrabold text-slate-900">{nombre}</div>
          {inactivo && <BadgeInactivo />}
        </div>
        <Badge
          variant="outline"
          className={cn("border-0 font-bold", estilo ? estilo.clase : cn(acento.soft, acento.text))}
        >
          {estilo ? estilo.texto : etiqueta}
        </Badge>
      </div>

      <div className="flex items-baseline gap-1.5">
        <div className={cn("text-4xl font-extrabold tabular-nums", acento.text)}>{cantidad}</div>
        <div className="text-sm font-semibold text-slate-500">{unidad}</div>
      </div>

      {children}

      <div className={cn("flex items-center justify-end gap-1.5 text-xs font-bold", acento.text)}>
        {textoVer}
        <ArrowRight size={14} strokeWidth={2.75} />
      </div>
    </button>
  );
}

export function DatoTarjeta({ etiqueta, tabular = false, children }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {etiqueta}
      </div>
      <div className={cn("text-sm font-bold text-slate-900", tabular && "tabular-nums")}>
        {children}
      </div>
    </div>
  );
}

export function TarjetaFueraInventario({ cantidad, activo, onClick, unidad, textoVer }) {
  return (
    <button onClick={onClick} className={cn(TARJETA, activo ? "border-amber-400" : "border-slate-200")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <PackageX className="h-8 w-8 shrink-0 text-amber-600" strokeWidth={2} />
          <div className="text-[17px] font-extrabold text-slate-900">Fuera de inventario</div>
        </div>
        <Badge variant="outline" className="border-0 bg-amber-100 font-bold text-amber-700">
          {cantidad === 0 ? "Vacío" : "Requiere acción"}
        </Badge>
      </div>

      <div className="flex items-baseline gap-1.5">
        <div className="text-4xl font-extrabold tabular-nums text-amber-600">{cantidad}</div>
        <div className="text-sm font-semibold text-slate-500">{unidad}</div>
      </div>

      <div className="rounded-lg bg-amber-50 px-3 py-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          Acciones disponibles
        </div>
        <div className="text-sm font-bold text-slate-900">Reingresar al almacén</div>
      </div>

      <div className="flex items-center justify-end gap-1.5 text-xs font-bold text-amber-600">
        {activo ? "Ocultar lista" : textoVer}
        <ArrowRight size={14} strokeWidth={2.75} />
      </div>
    </button>
  );
}

export function EncabezadoCatalogo({ titulo, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <div className="text-sm font-bold text-slate-700">{titulo}</div>
      <div className="text-sm text-slate-500">{children}</div>
    </div>
  );
}

export function EstadoCatalogo({ cargando, error, vacio = false, mensajeVacio, altoSkeleton, children }) {
  if (cargando) {
    return (
      <div className={GRID_TARJETAS}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className={cn(altoSkeleton, "rounded-2xl")} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 p-5 text-center text-sm font-semibold text-red-600">
        {error}
      </div>
    );
  }

  if (vacio) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 ring-1 ring-slate-200">
        {mensajeVacio}
      </div>
    );
  }

  return children;
}

function BotonCerrar({ onClick }) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="h-11 gap-1.5 font-bold text-slate-500 hover:text-slate-900"
    >
      <X size={15} strokeWidth={2.75} />
      Cerrar
    </Button>
  );
}

export function PanelDetalle({
  acento,
  icono: Icono,
  claseIcono = "h-7 w-7",
  grosorIcono = 2,
  titulo,
  subtitulo,
  etiqueta,
  onCerrar,
  children,
}) {
  return (
    <div className="mt-7 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4",
          acento.soft,
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Icono className={cn(claseIcono, "shrink-0", acento.text)} strokeWidth={grosorIcono} />
          <div className={cn("text-base font-extrabold", acento.text)}>{titulo}</div>
          <div className="text-sm font-semibold text-slate-500">{subtitulo}</div>
          {etiqueta && (
            <Badge variant="outline" className={cn("border font-bold", acento.text, acento.border)}>
              {etiqueta}
            </Badge>
          )}
        </div>
        <BotonCerrar onClick={onCerrar} />
      </div>
      {children}
    </div>
  );
}

export function PanelFuera({ titulo, onCerrar, children }) {
  return (
    <div className="mt-7 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-amber-50 px-5 py-4">
        <div className="text-base font-extrabold text-amber-700">{titulo}</div>
        <BotonCerrar onClick={onCerrar} />
      </div>
      {children}
    </div>
  );
}

export function BuscadorCodigo({ valor, onCambio, placeholder = "Buscar por código..." }) {
  return (
    <div className="border-b border-slate-100 px-5 py-3.5">
      <div className="relative max-w-xs">
        <Search
          size={16}
          strokeWidth={2.5}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <Input
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          placeholder={placeholder}
          className="h-10 pl-9"
        />
        {valor && (
          <button
            onClick={() => onCambio("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          >
            <X size={15} strokeWidth={2.75} />
          </button>
        )}
      </div>
    </div>
  );
}

export function BuscadorNombre({ valor, onCambio, placeholder = "Buscar por nombre..." }) {
  return (
    <div className="relative mb-4 max-w-sm">
      <Search
        size={16}
        strokeWidth={2.5}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <Input
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        className="h-11 bg-white pl-9"
      />
      {valor && (
        <button
          onClick={() => onCambio("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
        >
          <X size={15} strokeWidth={2.75} />
        </button>
      )}
    </div>
  );
}

export function SinCoincidencias({ busqueda }) {
  return (
    <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 ring-1 ring-slate-200">
      Ningún tipo coincide con "{busqueda}".
    </div>
  );
}

export function ContenidoLista({
  cargando,
  error,
  total,
  cantidadFiltrada = total,
  buscador = null,
  mensajeVacio,
  mensajeSinCoincidencias,
  filasSkeleton = 3,
  altoSkeleton = "h-10",
  children,
}) {
  const listo = !cargando && !error;

  return (
    <>
      {listo && total > 0 && buscador}

      {cargando && (
        <div className="space-y-2 p-5">
          {Array.from({ length: filasSkeleton }, (_, i) => (
            <Skeleton key={i} className={cn(altoSkeleton, "w-full")} />
          ))}
        </div>
      )}

      {error && <div className="p-5 text-center text-sm font-semibold text-red-600">{error}</div>}

      {listo && total === 0 && <div className={MENSAJE}>{mensajeVacio}</div>}

      {listo && total > 0 && cantidadFiltrada === 0 && (
        <div className={MENSAJE}>{mensajeSinCoincidencias}</div>
      )}

      {listo && cantidadFiltrada > 0 && children}
    </>
  );
}

export function CasillaSeleccion({ marcada, acento, grande = false, onClick }) {
  const clase = cn(
    "flex items-center justify-center border-2",
    grande ? "h-6 w-6 shrink-0 rounded-lg" : "h-5 w-5 rounded-md",
    marcada ? cn(acento.bg, "border-transparent text-white") : "border-slate-300",
  );
  const marca = marcada && <Check size={grande ? 14 : 13} strokeWidth={3.5} />;

  if (onClick) {
    return (
      <button onClick={onClick} className={clase}>
        {marca}
      </button>
    );
  }
  return <span className={clase}>{marca}</span>;
}

export function BadgeReingresada({ fecha }) {
  return (
    <Badge
      variant="outline"
      title={fecha ? `Reingresada el ${dateFormatter(fecha)}` : undefined}
      className="border-amber-300 bg-amber-50 font-sans font-bold text-amber-700"
    >
      Reingresada
    </Badge>
  );
}

export function BarraSeleccion({
  chips,
  estado,
  listo = true,
  enviando,
  onEnviar,
  textoAccion,
  textoEnviando,
}) {
  return (
    <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        {chips.map((chip) => (
          <div
            key={chip.clave}
            className="flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 font-mono text-sm font-bold text-white"
          >
            {chip.texto}
            <button onClick={chip.onQuitar} className="opacity-70 hover:opacity-100">
              <X size={13} strokeWidth={3} />
            </button>
          </div>
        ))}
        <div className="text-sm font-semibold text-slate-400">{estado}</div>
      </div>
      <Button
        onClick={onEnviar}
        disabled={!listo || enviando}
        className={cn(
          "h-11 gap-2 bg-white/15 font-extrabold text-white hover:bg-white/15",
          listo && "bg-gradient-to-r from-c3 to-c4 hover:opacity-90",
        )}
      >
        {enviando ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {textoEnviando}
          </>
        ) : (
          <>
            {textoAccion}
            <ArrowRight size={16} strokeWidth={2.75} />
          </>
        )}
      </Button>
    </div>
  );
}

export function ItemFueraInventario({
  codigo,
  etiqueta,
  extra,
  detalle,
  observacion,
  fechaMovimiento,
  procesando,
  onReingresar,
  contenidoReingresar = (
    <>
      <RotateCcw size={14} strokeWidth={2.75} />
      Reingresar
    </>
  ),
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[15px] font-extrabold text-slate-900">{codigo}</span>
          <Badge variant="outline" className="border-slate-300 font-bold text-slate-600">
            {etiqueta}
          </Badge>
          {extra}
        </div>
        {detalle}
        {observacion && (
          <div className="text-[12.5px] italic text-slate-500">"{observacion}"</div>
        )}
        {fechaMovimiento && (
          <div className="text-[11px] text-slate-400">
            Último movimiento: {dateFormatter(fechaMovimiento)}
          </div>
        )}
      </div>
      <Button
        onClick={onReingresar}
        disabled={procesando}
        className="h-10 gap-2 self-start bg-emerald-600 font-bold text-white hover:bg-emerald-700 sm:self-auto"
      >
        {procesando ? <Loader2 size={15} className="animate-spin" /> : contenidoReingresar}
      </Button>
    </div>
  );
}

export function DialogReingreso({ abierto, titulo, procesando, onCancelar, onConfirmar }) {
  const [observacion, setObservacion] = useState("");
  const observacionLimpia = observacion.trim();
  const valida =
    observacionLimpia.length >= MOTIVO_CORRECCION_MIN &&
    observacionLimpia.length <= MOTIVO_CORRECCION_MAX;

  useEffect(() => {
    if (abierto) setObservacion("");
  }, [abierto]);

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && !procesando && onCancelar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reingresar {titulo}</DialogTitle>
          <DialogDescription>
            Vuelve al almacén y queda disponible para producción. Indica cómo llega, por
            ejemplo si conserva su ficha.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="observacion-reingreso"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Observación
          </Label>
          <Textarea
            id="observacion-reingreso"
            value={observacion}
            onChange={(e) => setObservacion(limpiarObservacion(e.target.value))}
            placeholder="Ej. Llega sin ficha, se identificó por el peso y el tipo..."
            className="min-h-20"
            maxLength={MOTIVO_CORRECCION_MAX}
          />
          <span className="text-xs text-slate-500">
            {observacionLimpia.length}/{MOTIVO_CORRECCION_MAX} · mínimo{" "}
            {MOTIVO_CORRECCION_MIN} caracteres
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancelar} disabled={procesando}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirmar(observacionLimpia)}
            disabled={!valida || procesando}
            className="gap-2 bg-emerald-600 font-bold text-white hover:bg-emerald-700"
          >
            {procesando ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RotateCcw size={14} strokeWidth={2.75} />
            )}
            Reingresar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
