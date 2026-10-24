import { useState, useEffect } from "react";
import { Lock, LockOpen, Loader2, ShieldCheck, Combine } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import Header from "@/components/layout/Header";
import {
  verBloqueoProductoTerminado,
  bloquearMovimientosProductoTerminado,
  desbloquearMovimientosProductoTerminado,
} from "../../services/Inventario/Inventario";
import { limpiarObservacion } from "@/utils/validators";
import { MotivosBloqueoProductoTerminado } from "@/constants/OperadorConfig";
import { MOTIVO_CORRECCION_MIN, MOTIVO_CORRECCION_MAX } from "@/constants/Values";
import { MOVIMIENTOS_BLOQUEO, textoMovimientosBloqueados } from "@/utils/bloqueoProducto";
import { AvisoBloqueo } from "./comunes";

const SELECCION_INICIAL = Object.fromEntries(MOVIMIENTOS_BLOQUEO.map((m) => [m.campo, true]));

const esMotivoValido = (texto) => {
  const largo = texto.trim().length;
  return largo >= MOTIVO_CORRECCION_MIN && largo <= MOTIVO_CORRECCION_MAX;
};

function SeleccionMovimientos({ seleccion, bloqueo, onCambio, invalido, deshabilitado }) {
  const bloqueado = Boolean(bloqueo?.Bloqueado);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
        {bloqueado ? "Movimientos bloqueados" : "Movimientos a bloquear"}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MOVIMIENTOS_BLOQUEO.map(({ campo, texto }) => {
          const marcado = bloqueado ? bloqueo[campo] : seleccion[campo];
          return (
            <label
              key={campo}
              htmlFor={`bloqueo-${campo}`}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border-2 px-3.5 py-2.5 text-[13px] font-bold transition-colors",
                bloqueado ? "cursor-default" : "cursor-pointer",
                marcado
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-slate-200 bg-white text-slate-600",
                invalido && "border-red-300",
              )}
            >
              <span className="flex items-center gap-3">
                <input
                  id={`bloqueo-${campo}`}
                  type="checkbox"
                  checked={marcado}
                  disabled={bloqueado || deshabilitado}
                  onChange={(e) => onCambio(campo, e.target.checked)}
                  className="h-4 w-4 accent-amber-600"
                />
                {texto}
              </span>
              {marcado ? <Lock size={15} strokeWidth={2.5} /> : <LockOpen size={15} strokeWidth={2.5} />}
            </label>
          );
        })}
        <div className="flex items-center justify-between rounded-xl border-2 border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] font-bold text-emerald-800">
          Ajustes ± (siempre permitidos)
          <ShieldCheck size={15} strokeWidth={2.5} />
        </div>
      </div>
      {invalido && (
        <span className="text-xs font-semibold text-red-600">
          Selecciona al menos un movimiento
        </span>
      )}
    </div>
  );
}

export default function AjustesProductoTerminado() {
  const [bloqueo, setBloqueo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [motivo, setMotivo] = useState("");
  const [seleccion, setSeleccion] = useState(SELECCION_INICIAL);
  const [tocado, setTocado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const motivoLimpio = motivo.trim();
  const bloqueado = Boolean(bloqueo?.Bloqueado);
  const haySeleccion = Object.values(seleccion).some(Boolean);
  const cambiarSeleccion = (campo, valor) => setSeleccion((prev) => ({ ...prev, [campo]: valor }));

  useEffect(() => {
    cargarBloqueo();
  }, []);

  const cargarBloqueo = async () => {
    setLoading(true);
    setError("");
    try {
      setBloqueo(await verBloqueoProductoTerminado());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const solicitarConfirmacion = () => {
    if (!bloqueado) {
      setTocado(true);
      if (!haySeleccion) {
        toast.error("Selecciona al menos un movimiento para bloquear");
        return;
      }
      if (!esMotivoValido(motivo)) {
        toast.error(
          `El motivo debe tener entre ${MOTIVO_CORRECCION_MIN} y ${MOTIVO_CORRECCION_MAX} caracteres`,
        );
        return;
      }
    }
    setConfirmado(false);
    setConfirmando(true);
  };

  const confirmar = async () => {
    setEnviando(true);
    try {
      if (bloqueado) {
        setBloqueo(await desbloquearMovimientosProductoTerminado());
        toast.success("Movimientos de producto terminado desbloqueados");
      } else {
        const estado = await bloquearMovimientosProductoTerminado(motivoLimpio, seleccion);
        setBloqueo(estado);
        toast.success(textoMovimientosBloqueados(estado));
        setMotivo("");
        setSeleccion(SELECCION_INICIAL);
        setTocado(false);
      }
      setConfirmando(false);
    } catch (e) {
      toast.error(e.message);
      cargarBloqueo();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="contenido-con-sidebar flex min-h-screen flex-col bg-slate-50 pt-20 font-sans text-slate-900 md:pt-0">
      <Header
        titulo="Producto terminado"
        subtitulo="Ajustes de movimientos"
        volver="/encargado/producto/movimientos"
        accion={{ texto: "Ir a movimientos", icono: Combine, href: "/encargado/producto/movimientos" }}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 sm:px-6">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-52 w-full" />
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-white p-6 text-center text-sm font-semibold text-red-600 ring-1 ring-slate-200">
            {error}
            <div className="mt-3">
              <Button variant="outline" onClick={cargarBloqueo}>
                Reintentar
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-col gap-5">
            <AvisoBloqueo bloqueo={bloqueo} />

            <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-1">
                <h2 className="text-[16px] font-extrabold text-slate-900">
                  {bloqueado ? "Desbloquear movimientos" : "Bloquear movimientos"}
                </h2>
                <p className="text-[13px] text-slate-600">
                  {bloqueado
                    ? "Al terminar el conteo, desbloquea para que la planta vuelva a registrar los movimientos bloqueados. Para cambiar la selección, desbloquea y vuelve a bloquear."
                    : "Marca los movimientos de producto terminado que quieres detener mientras haces el conteo físico. Para un conteo confiable conviene bloquear todos."}
                </p>
              </div>

              <SeleccionMovimientos
                seleccion={seleccion}
                bloqueo={bloqueo}
                onCambio={cambiarSeleccion}
                invalido={tocado && !bloqueado && !haySeleccion}
                deshabilitado={enviando}
              />

              {!bloqueado && (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
                    Motivo del bloqueo
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {MotivosBloqueoProductoTerminado.map((m) => {
                      const activo = motivoLimpio === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMotivo(m)}
                          aria-pressed={activo}
                          className={cn(
                            "min-h-10 rounded-xl border-2 px-3 py-1.5 text-left text-[13px] font-bold transition-colors",
                            activo
                              ? "border-amber-400 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                          )}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                  <Textarea
                    value={motivo}
                    onChange={(e) => setMotivo(limpiarObservacion(e.target.value))}
                    placeholder="Elige una opción o escribe por qué bloqueas los movimientos"
                    maxLength={MOTIVO_CORRECCION_MAX}
                    aria-label="Motivo del bloqueo"
                    className={cn(
                      "min-h-20",
                      tocado && !esMotivoValido(motivo) && "border-red-400 ring-1 ring-red-200",
                    )}
                  />
                  <span className="text-xs text-slate-500">
                    {motivoLimpio.length}/{MOTIVO_CORRECCION_MAX} · mínimo {MOTIVO_CORRECCION_MIN}{" "}
                    caracteres
                  </span>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={solicitarConfirmacion}
                  className={cn(
                    "h-11 gap-2 font-extrabold text-white",
                    bloqueado ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700",
                  )}
                >
                  {bloqueado ? <LockOpen size={16} strokeWidth={2.75} /> : <Lock size={16} strokeWidth={2.75} />}
                  {bloqueado ? "Desbloquear movimientos" : "Bloquear movimientos"}
                </Button>
              </div>
            </section>
          </div>
        )}
      </main>

      <Dialog open={confirmando} onOpenChange={(abierto) => !enviando && setConfirmando(abierto)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">
              {bloqueado ? "Confirmar desbloqueo" : "Confirmar bloqueo"}
            </DialogTitle>
            <DialogDescription>
              {bloqueado
                ? "Se habilitarán de nuevo los movimientos bloqueados de producto terminado."
                : "Nadie podrá registrar los movimientos seleccionados de producto terminado hasta que se desbloquee."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[12.5px] text-slate-600">
            <span>
              <span className="font-bold text-slate-500">Movimientos: </span>
              {textoMovimientosBloqueados(bloqueado ? bloqueo : seleccion)}
            </span>
            {!bloqueado && (
              <span>
                <span className="font-bold text-slate-500">Motivo: </span>
                {motivoLimpio}
              </span>
            )}
          </div>

          <label
            htmlFor="confirmar-bloqueo-producto"
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left"
          >
            <input
              id="confirmar-bloqueo-producto"
              type="checkbox"
              checked={confirmado}
              disabled={enviando}
              onChange={(e) => setConfirmado(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-slate-900"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-slate-900">
                {bloqueado
                  ? "Estoy seguro de desbloquear los movimientos"
                  : "Estoy seguro de bloquear los movimientos"}
              </span>
              <span className="text-[12.5px] text-slate-600">
                Esta acción quedará registrada con su usuario.
              </span>
            </span>
          </label>

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
              disabled={enviando || !confirmado}
              className={cn(
                "h-11 gap-2 font-extrabold text-white",
                bloqueado ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700",
              )}
            >
              {enviando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  {bloqueado ? <LockOpen size={16} strokeWidth={2.75} /> : <Lock size={16} strokeWidth={2.75} />}
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
