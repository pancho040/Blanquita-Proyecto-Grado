import { useState, useMemo } from "react";
import { X, Loader2, Truck, ListChecks } from "lucide-react";
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
import { insertarSalidaProductoTerminado } from "../../services/Inventario/Inventario";
import { aEntero, limpiarObservacion } from "@/utils/validators";
import { MotivosSalidaProductoTerminado } from "@/constants/OperadorConfig";
import {
  CANTIDAD_MAXIMA_SALIDA_PRODUCTO_TERMINADO,
  MOTIVO_CORRECCION_MIN,
  MOTIVO_CORRECCION_MAX,
} from "@/constants/Values";
import {
  descripcionContenido,
  BadgeEstado,
  ControlCantidad,
  PildorasLinea,
  SinLineaSeleccionada,
  OpcionPresentacion,
  ResumenStock,
} from "./comunes";

const esObservacionValida = (texto) => {
  const largo = texto.trim().length;
  return largo >= MOTIVO_CORRECCION_MIN && largo <= MOTIVO_CORRECCION_MAX;
};

const maximoSalida = (presentacion) =>
  Math.min(Number(presentacion.CantidadActual || 0), CANTIDAD_MAXIMA_SALIDA_PRODUCTO_TERMINADO);

function CardSalida({ presentacion, valor, autoFocus, invalido, onChange, onQuitar }) {
  const cantidad = aEntero(valor);
  const actual = Number(presentacion.CantidadActual || 0);
  const maximo = maximoSalida(presentacion);

  return (
    <div
      className={cn(
        "flex flex-col gap-3.5 rounded-2xl border-2 bg-white p-4 shadow-sm",
        cantidad > 0 ? "border-emerald-300" : "border-slate-200",
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
          onClick={() => onQuitar(presentacion.IdPresentacion)}
          aria-label={`Quitar ${presentacion.CodigoPresentacion}`}
          className="h-9 w-9 shrink-0 p-0 text-slate-400 hover:text-red-600"
        >
          <X size={17} strokeWidth={2.75} />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
            Cantidad de salida
          </div>
          <div className="text-[12px] font-semibold text-slate-400">Máx. {maximo}</div>
        </div>
        <ControlCantidad
          valor={valor}
          onChange={onChange}
          maximo={maximo}
          tono="ingreso"
          autoFocus={autoFocus}
          invalido={invalido}
          etiqueta="Cantidad de salida"
        />
      </div>

      <ResumenStock
        actual={actual}
        nuevo={cantidad > 0 ? actual - cantidad : null}
        tono="ingreso"
      />
    </div>
  );
}

export default function SalidaProductoTerminado({ inventario, onStockActualizado }) {
  const [linea, setLinea] = useState("");
  const [items, setItems] = useState([]);
  const [observacion, setObservacion] = useState("");
  const [ultimoAgregado, setUltimoAgregado] = useState(null);
  const [tocado, setTocado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const lineas = useMemo(
    () => Array.from(new Set(inventario.map((p) => p.NombreProducto))),
    [inventario],
  );

  const presentacionesLinea = useMemo(
    () => inventario.filter((p) => p.NombreProducto === linea),
    [inventario, linea],
  );

  const presentacionDe = (idPresentacion) =>
    inventario.find((p) => p.IdPresentacion === idPresentacion);

  const idsAgregados = useMemo(() => new Set(items.map((i) => i.IdPresentacion)), [items]);

  const agregadasPorLinea = useMemo(() => {
    const conteo = new Map();
    items.forEach((i) => {
      const nombre = presentacionDe(i.IdPresentacion)?.NombreProducto;
      if (nombre) conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1);
    });
    return conteo;
  }, [items, inventario]);

  const lineasValidas = items
    .map((i) => ({ ...i, cantidadNum: aEntero(i.cantidad) }))
    .filter((i) => i.cantidadNum > 0);
  const totalUnidades = lineasValidas.reduce((s, i) => s + i.cantidadNum, 0);
  const hayIncompletas = items.length > lineasValidas.length;
  const observacionLimpia = observacion.trim();

  const agregarPresentacion = (presentacion) => {
    if (idsAgregados.has(presentacion.IdPresentacion)) return;
    setItems((prev) => [...prev, { IdPresentacion: presentacion.IdPresentacion, cantidad: "" }]);
    setUltimoAgregado(presentacion.IdPresentacion);
  };

  const cambiarCantidad = (idPresentacion, valor) =>
    setItems((prev) =>
      prev.map((i) => (i.IdPresentacion === idPresentacion ? { ...i, cantidad: valor } : i)),
    );

  const quitarPresentacion = (idPresentacion) =>
    setItems((prev) => prev.filter((i) => i.IdPresentacion !== idPresentacion));

  const limpiar = () => {
    setItems([]);
    setObservacion("");
    setTocado(false);
    setUltimoAgregado(null);
  };

  const solicitarConfirmacion = () => {
    setTocado(true);
    if (items.length === 0) return;
    if (hayIncompletas) {
      toast.error("Ingresa una cantidad en todas las tarjetas o quita las que no uses");
      return;
    }
    const excedida = lineasValidas.find(
      (l) => l.cantidadNum > maximoSalida(presentacionDe(l.IdPresentacion) ?? {}),
    );
    if (excedida) {
      toast.error(
        `La salida de ${presentacionDe(excedida.IdPresentacion)?.CodigoPresentacion} supera el stock disponible`,
      );
      return;
    }
    if (!esObservacionValida(observacion)) {
      toast.error(
        `La observación debe tener entre ${MOTIVO_CORRECCION_MIN} y ${MOTIVO_CORRECCION_MAX} caracteres`,
      );
      return;
    }
    setConfirmado(false);
    setConfirmando(true);
  };

  const confirmarSalida = async () => {
    setEnviando(true);
    try {
      const respuesta = await insertarSalidaProductoTerminado(
        lineasValidas.map((l) => ({ IdPresentacion: l.IdPresentacion, Cantidad: l.cantidadNum })),
        observacionLimpia,
      );
      onStockActualizado(respuesta.Presentaciones);
      toast.success(
        `Salida registrada: ${respuesta.Presentaciones.length} presentación(es), ${respuesta.CantidadTotal} unidades`,
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
        <PildorasLinea
          lineas={lineas}
          linea={linea}
          onCambio={setLinea}
          contadores={agregadasPorLinea}
        />

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
                  marcada={idsAgregados.has(p.IdPresentacion)}
                  deshabilitada={Number(p.CantidadActual || 0) === 0}
                  tono="ingreso"
                  onSeleccionar={agregarPresentacion}
                />
              ))}
            </div>
          </div>
        ) : (
          <SinLineaSeleccionada />
        )}
      </section>

      {items.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <ListChecks size={17} strokeWidth={2.5} className="text-c3" />
            <h2 className="text-[15px] font-extrabold text-slate-900">Salida a registrar</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((i) => {
              const p = presentacionDe(i.IdPresentacion);
              if (!p) return null;
              return (
                <CardSalida
                  key={i.IdPresentacion}
                  presentacion={p}
                  valor={i.cantidad}
                  autoFocus={ultimoAgregado === i.IdPresentacion}
                  invalido={tocado}
                  onChange={(v) => cambiarCantidad(i.IdPresentacion, v)}
                  onQuitar={quitarPresentacion}
                />
              );
            })}
          </div>

          <div className="mt-2 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-1.5">
              <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
                Observación del despacho
              </div>
              <div className="flex flex-wrap gap-2">
                {MotivosSalidaProductoTerminado.map((m) => {
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
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700"
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
                placeholder="Elige una opción o escribe a quién o por qué sale el producto"
                maxLength={MOTIVO_CORRECCION_MAX}
                aria-label="Observación del despacho"
                className={cn(
                  "min-h-20",
                  tocado && !esObservacionValida(observacion) && "border-red-400 ring-1 ring-red-200",
                )}
              />
              <span className="text-xs text-slate-500">
                {observacionLimpia.length}/{MOTIVO_CORRECCION_MAX} · mínimo {MOTIVO_CORRECCION_MIN}{" "}
                caracteres
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[14px] font-extrabold text-slate-900">
                {lineasValidas.length}{" "}
                {lineasValidas.length === 1 ? "presentación" : "presentaciones"} · {totalUnidades} u.
                <span className="ml-2 text-[12px] font-semibold text-slate-400">
                  Máx. {CANTIDAD_MAXIMA_SALIDA_PRODUCTO_TERMINADO} por presentación
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
                  className="h-11 gap-2 bg-emerald-600 font-extrabold text-white hover:bg-emerald-700"
                >
                  <Truck size={16} strokeWidth={2.75} />
                  Registrar salida
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <Dialog open={confirmando} onOpenChange={(abierto) => !enviando && setConfirmando(abierto)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Confirmar salida</DialogTitle>
            <DialogDescription>
              {lineasValidas.length}{" "}
              {lineasValidas.length === 1 ? "presentación" : "presentaciones"} · {totalUnidades}{" "}
              unidades saldrán del inventario. Esta acción no se puede deshacer desde aquí.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[12.5px] text-slate-600">
            <span className="font-bold text-slate-500">Observación: </span>
            {observacionLimpia}
          </div>

          <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {lineasValidas.map((l) => {
              const p = presentacionDe(l.IdPresentacion);
              if (!p) return null;
              const actual = Number(p.CantidadActual || 0);
              return (
                <div
                  key={l.IdPresentacion}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                >
                  <div className="flex flex-col">
                    <span className="font-mono text-[13.5px] font-extrabold text-c3">
                      {p.CodigoPresentacion}
                    </span>
                    <span className="text-[12px] text-slate-500">{p.NombreProducto}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-extrabold tabular-nums text-emerald-700">
                      -{l.cantidadNum}
                    </div>
                    <div className="text-[11.5px] tabular-nums text-slate-400">
                      {actual} → {actual - l.cantidadNum}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <label
            htmlFor="confirmar-salida-producto"
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left"
          >
            <input
              id="confirmar-salida-producto"
              type="checkbox"
              checked={confirmado}
              disabled={enviando}
              onChange={(e) => setConfirmado(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-slate-900"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-slate-900">
                Estoy seguro de sacar estos productos del inventario
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
              onClick={confirmarSalida}
              disabled={enviando || !confirmado}
              className="h-11 gap-2 bg-emerald-600 font-extrabold text-white hover:bg-emerald-700"
            >
              {enviando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <Truck size={16} strokeWidth={2.75} />
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
