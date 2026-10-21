import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCcw, Package, Clock, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listarEmpaquesReingresables,
  reingresarEmpaque,
} from "../../services/Empaque/EmpaqueBobina";
import { ObservacionReingresoEmpaque } from "@/constants/OperadorConfig";
import {
  MOTIVO_CORRECCION_MIN,
  MOTIVO_CORRECCION_MAX,
  MINUTOS_REINGRESO_EMPAQUE_BOBINA,
} from "@/constants/Values";
import { dateFormatter } from "@/utils/dates";
import { alternarMotivoEnTexto } from "@/utils/handlers";
import { extraerMensajeError, limpiarObservacion } from "@/utils/validators";
import Header from "@/components/layout/Header";

const INTERVALO_REFRESCO_MS = 30_000;
const INTERVALO_TICK_MS = 15_000;
const MOTIVOS = ObservacionReingresoEmpaque.bobina;

function colorRestante(min) {
  if (min <= 3) return { text: "text-red-600", bg: "bg-red-50" };
  if (min <= 10) return { text: "text-amber-600", bg: "bg-amber-50" };
  return { text: "text-emerald-600", bg: "bg-emerald-50" };
}

function TarjetaEmpaque({ e, restante, procesando, onReingresar }) {
  const c = colorRestante(restante);
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Package className="h-7 w-7 shrink-0 text-c3" strokeWidth={2} />
          <div className="flex flex-col">
            <div className="font-mono text-[15px] font-extrabold text-slate-900">
              {e.CodigoEmpaque}
            </div>
            <div className="text-[12.5px] font-semibold text-slate-500">
              {e.NombreTipoEmpaque} · {e.PesoKg} kg
            </div>
          </div>
        </div>
        <Badge className={cn("border-0 font-bold tabular-nums", c.bg, c.text)}>
          {restante <= 0 ? "Expirando…" : `${restante} min`}
        </Badge>
      </div>

      <div className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2.5 text-[12.5px] text-slate-600">
        <span className="flex items-center gap-1.5">
          <Clock size={13} strokeWidth={2.75} />
          Enviada a producción: {dateFormatter(e.FechaTraslado)}
        </span>
        <span>
          {e.NombreProveedor} · recibida {dateFormatter(e.FechaRecepcion)}
        </span>
      </div>

      <Button
        onClick={() => onReingresar(e)}
        disabled={procesando || restante <= 0}
        className="h-11 gap-2 bg-gradient-to-r from-c3 to-c4 font-extrabold text-white hover:opacity-90"
      >
        {procesando ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <>
            <Undo2 size={16} strokeWidth={2.75} />
            Reingresar al almacén
          </>
        )}
      </Button>
    </div>
  );
}

export default function EmpaqueBobinaReingreso() {
  const [empaques, setEmpaques] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [ahora, setAhora] = useState(() => Date.now());

  const [dialog, setDialog] = useState({ open: false, empaque: null });
  const [formMotivo, setFormMotivo] = useState("");
  const [errorReingreso, setErrorReingreso] = useState("");
  const [procesandoId, setProcesandoId] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCargando(true);
    setError("");
    try {
      const data = await listarEmpaquesReingresables();
      setEmpaques(data);
      setFetchedAt(Date.now());
    } catch (e) {
      if (!silencioso) setError(extraerMensajeError(e, e.message));
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    const tick = setInterval(() => setAhora(Date.now()), INTERVALO_TICK_MS);
    const refetch = setInterval(() => cargar({ silencioso: true }), INTERVALO_REFRESCO_MS);
    return () => {
      clearInterval(tick);
      clearInterval(refetch);
    };
  }, [cargar]);

  const restanteDe = (e) => {
    const transcurrido = (ahora - fetchedAt) / 60000;
    return Math.max(0, Math.round(e.MinutosRestantes - transcurrido));
  };

  const visibles = empaques.filter((e) => restanteDe(e) > 0);

  const motivosSeleccionados = MOTIVOS.filter((m) => formMotivo.includes(m));

  const motivoLimpio = formMotivo.trim();
  const motivoValido =
    motivoLimpio.length >= MOTIVO_CORRECCION_MIN && motivoLimpio.length <= MOTIVO_CORRECCION_MAX;

  const abrirDialog = (empaque) => {
    setFormMotivo("");
    setErrorReingreso("");
    setDialog({ open: true, empaque });
  };

  const alternarMotivo = (motivo) => {
    setFormMotivo((actual) => alternarMotivoEnTexto(motivo, actual));
  };

  const confirmarReingreso = async () => {
    const empaque = dialog.empaque;
    if (!empaque) return;

    if (!motivoValido) {
      setErrorReingreso(
        `El motivo debe tener entre ${MOTIVO_CORRECCION_MIN} y ${MOTIVO_CORRECCION_MAX} caracteres`,
      );
      return;
    }

    setEnviando(true);
    setErrorReingreso("");
    setProcesandoId(empaque.IdEmpaque);
    try {
      await reingresarEmpaque(empaque.IdEmpaque, motivoLimpio);
      toast.success(`${empaque.CodigoEmpaque} reingresada al almacén`);
      setDialog({ open: false, empaque: null });
    } catch (e) {
      setErrorReingreso(extraerMensajeError(e, e.message));
    } finally {
      setEnviando(false);
      setProcesandoId(null);
      cargar({ silencioso: true });
    }
  };

  return (
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header titulo="Almacén · Empaque" subtitulo="Bobinas de empaque enviadas a producción">
        <Button
          variant="ghost"
          onClick={() => cargar()}
          className="h-11 gap-2 font-bold text-white hover:bg-white/15 hover:text-white"
        >
          <RefreshCcw size={16} strokeWidth={2.75} />
          Actualizar
        </Button>
      </Header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 sm:px-6">
        <div className="mb-4 rounded-xl bg-c1/10 px-4 py-3 text-[13px] font-medium text-c3">
          Solo aparecen las bobinas de empaque enviadas en los últimos{" "}
          {MINUTOS_REINGRESO_EMPAQUE_BOBINA} minutos. Pasado ese tiempo el envío queda firme y
          ya no puede deshacerse.
        </div>

        {cargando && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        )}

        {!cargando && error && (
          <div className="rounded-xl bg-red-50 p-5 text-center text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        {!cargando && !error && visibles.length === 0 && (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 ring-1 ring-slate-200">
            No hay bobinas de empaque que se puedan reingresar en este momento.
          </div>
        )}

        {!cargando && !error && visibles.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibles.map((e) => (
              <TarjetaEmpaque
                key={e.IdEmpaque}
                e={e}
                restante={restanteDe(e)}
                procesando={procesandoId === e.IdEmpaque}
                onReingresar={abrirDialog}
              />
            ))}
          </div>
        )}
      </main>

      <Dialog
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, empaque: open ? dialog.empaque : null })}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reingresar bobina de empaque al almacén</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {dialog.empaque && (
              <div className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                <span className="font-mono font-bold text-slate-900">
                  {dialog.empaque.CodigoEmpaque}
                </span>
                <span className="flex items-center gap-1 text-[12px] text-slate-500">
                  <Clock size={12} strokeWidth={2.75} />
                  Enviada: {dateFormatter(dialog.empaque.FechaTraslado)}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Motivos frecuentes
              </Label>
              <ToggleGroup
                type="multiple"
                value={motivosSeleccionados}
                className="flex flex-wrap justify-start gap-2"
              >
                {MOTIVOS.map((motivo) => (
                  <ToggleGroupItem
                    key={motivo}
                    value={motivo}
                    onClick={() => alternarMotivo(motivo)}
                    className="h-auto whitespace-normal rounded-full border-2 border-slate-200 px-3.5 py-2 text-left text-[12.5px] font-bold text-slate-600 bg-white hover:border-slate-300 hover:bg-white hover:text-slate-600 aria-pressed:border-slate-900 aria-pressed:bg-slate-900 aria-pressed:text-white aria-pressed:hover:border-slate-900 aria-pressed:hover:bg-slate-900 aria-pressed:hover:text-white"
                  >
                    {motivo}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="motivo-reingreso-empaque"
                className="text-xs font-bold uppercase tracking-wide text-slate-600"
              >
                Detalle del reingreso
              </Label>
              <Textarea
                id="motivo-reingreso-empaque"
                value={formMotivo}
                onChange={(e) => setFormMotivo(limpiarObservacion(e.target.value))}
                placeholder="Ej. Se escaneó la bobina de empaque equivocada al enviar a producción..."
                className="min-h-20"
                maxLength={MOTIVO_CORRECCION_MAX}
              />
              <span className="text-xs text-slate-500">
                {motivoLimpio.length}/{MOTIVO_CORRECCION_MAX} · mínimo {MOTIVO_CORRECCION_MIN}{" "}
                caracteres
              </span>
            </div>

            {errorReingreso && (
              <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600">
                {errorReingreso}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={confirmarReingreso}
              disabled={enviando || !motivoValido}
              className="h-11 w-full gap-2 bg-gradient-to-r from-c3 to-c4 font-extrabold text-white hover:opacity-90 sm:w-auto"
            >
              {enviando ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Undo2 size={16} strokeWidth={2.75} />
                  Reingresar al almacén
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
