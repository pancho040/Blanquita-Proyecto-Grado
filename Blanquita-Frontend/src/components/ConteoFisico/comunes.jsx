import { Loader2, FileText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDescarga } from "@/hooks/useDescarga";
import { limpiarObservacion } from "@/utils/validators";
import { MOTIVO_CORRECCION_MIN, MOTIVO_CORRECCION_MAX } from "@/constants/Values";
import { descargarActaConteo } from "@/services/Inventario/Conteo";

export const ESTADO_CONTEO = {
  Abierto: "Abierto",
  Cerrado: "Cerrado",
  Anulado: "Anulado",
};

const ESTILO_ESTADO = {
  Abierto: "bg-amber-100 text-amber-800",
  Cerrado: "bg-emerald-100 text-emerald-800",
  Anulado: "bg-slate-200 text-slate-700",
};

export const esMotivoValido = (texto) => {
  const largo = (texto ?? "").trim().length;
  return largo >= MOTIVO_CORRECCION_MIN && largo <= MOTIVO_CORRECCION_MAX;
};

export const fechaHora = (valor) => (valor ? format(new Date(valor), "dd/MM/yyyy HH:mm") : "-");

export const textoDiferencia = (diferencia) =>
  diferencia === null ? "-" : diferencia > 0 ? `+${diferencia}` : String(diferencia);

export const claseDiferencia = (diferencia) =>
  diferencia === null
    ? "bg-slate-100 text-slate-400"
    : diferencia < 0
      ? "bg-red-100 text-red-700"
      : diferencia > 0
        ? "bg-sky-100 text-sky-700"
        : "bg-emerald-100 text-emerald-700";

export function BadgeEstadoConteo({ estado }) {
  return (
    <Badge variant="outline" className={cn("border-0 text-[11px] font-bold", ESTILO_ESTADO[estado])}>
      {estado}
    </Badge>
  );
}

export function CampoMotivo({ valor, onCambio, opciones = [], tocado, etiqueta, placeholder, id }) {
  const limpio = (valor ?? "").trim();
  return (
    <div className="flex flex-col gap-1.5">
      {etiqueta && (
        <label htmlFor={id} className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
          {etiqueta}
        </label>
      )}
      {opciones.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {opciones.map((opcion) => {
            const activa = limpio === opcion;
            return (
              <button
                key={opcion}
                type="button"
                onClick={() => onCambio(opcion)}
                aria-pressed={activa}
                className={cn(
                  "min-h-9 rounded-xl border-2 px-3 py-1 text-left text-[12.5px] font-bold transition-colors",
                  activa
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                )}
              >
                {opcion}
              </button>
            );
          })}
        </div>
      )}
      <Textarea
        id={id}
        value={valor}
        onChange={(e) => onCambio(limpiarObservacion(e.target.value))}
        placeholder={placeholder}
        maxLength={MOTIVO_CORRECCION_MAX}
        className={cn("min-h-16", tocado && !esMotivoValido(valor) && "border-red-400 ring-1 ring-red-200")}
      />
      <span className="text-xs text-slate-500">
        {limpio.length}/{MOTIVO_CORRECCION_MAX} · mínimo {MOTIVO_CORRECCION_MIN} caracteres
      </span>
    </div>
  );
}

export function DialogoConfirmacion({
  abierto,
  onCambio,
  titulo,
  descripcion,
  textoConfirmacion,
  confirmado,
  onConfirmado,
  enviando,
  onConfirmar,
  textoBoton,
  icono: Icono,
  claseBoton,
  deshabilitado = false,
  anchoGrande = false,
  children,
}) {
  return (
    <Dialog open={abierto} onOpenChange={(valor) => !enviando && onCambio(valor)}>
      <DialogContent className={cn("max-h-[90svh] overflow-y-auto", anchoGrande ? "sm:max-w-2xl" : "sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold">{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>

        {children}

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
          <input
            type="checkbox"
            checked={confirmado}
            disabled={enviando}
            onChange={(e) => onConfirmado(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-slate-900"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-slate-900">{textoConfirmacion}</span>
            <span className="text-[12.5px] text-slate-600">Esta acción quedará registrada con su usuario.</span>
          </span>
        </label>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onCambio(false)}
            disabled={enviando}
            className="h-11 font-bold text-slate-500 hover:text-slate-900"
          >
            Volver
          </Button>
          <Button
            onClick={onConfirmar}
            disabled={enviando || !confirmado || deshabilitado}
            className={cn("h-11 gap-2 font-extrabold text-white", claseBoton)}
          >
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <Icono size={16} strokeWidth={2.75} />}
            {enviando ? "Guardando..." : textoBoton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BotonActa({ idConteo, className }) {
  const { descargando, iniciar } = useDescarga(() => descargarActaConteo(idConteo), "Acta descargada");
  return (
    <Button
      variant="outline"
      onClick={iniciar}
      disabled={descargando}
      className={cn("h-10 gap-2 font-bold text-c3", className)}
    >
      {descargando ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} strokeWidth={2.5} />}
      Acta
    </Button>
  );
}

function Dato({ etiqueta, valor, clase }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{etiqueta}</span>
      <span className={cn("text-[15px] font-extrabold tabular-nums text-slate-800", clase)}>{valor}</span>
    </div>
  );
}

export function HistorialConteos({ conteos }) {
  if (conteos.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-8 text-center text-sm text-slate-400">
        Todavía no hay conteos cerrados ni anulados.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {conteos.map((conteo) => (
        <article
          key={conteo.IdConteoProductoTerminado}
          className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-extrabold text-slate-900">
                Conteo N° {conteo.IdConteoProductoTerminado}
              </span>
              <BadgeEstadoConteo estado={conteo.Estado} />
            </div>
            <span className="text-[12.5px] text-slate-600">
              {fechaHora(conteo.FechaHoraInicio)} → {fechaHora(conteo.FechaHoraCierre)} · {conteo.UsuarioInicio}
            </span>
            <span className="break-words text-[12.5px] text-slate-500">
              {conteo.Estado === ESTADO_CONTEO.Anulado
                ? `Anulado: ${conteo.MotivoAnulacion}`
                : conteo.MotivoInicio}
            </span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            {conteo.Estado === ESTADO_CONTEO.Cerrado && (
              <div className="flex flex-wrap gap-5">
                <Dato etiqueta="Diferencias" valor={conteo.ConDiferencia} />
                <Dato etiqueta="Faltante" valor={conteo.Faltante} clase={conteo.Faltante ? "text-red-600" : ""} />
                <Dato etiqueta="Sobrante" valor={conteo.Sobrante} clase={conteo.Sobrante ? "text-sky-600" : ""} />
              </div>
            )}
            <BotonActa idConteo={conteo.IdConteoProductoTerminado} className="w-full sm:w-auto" />
          </div>
        </article>
      ))}
    </div>
  );
}
