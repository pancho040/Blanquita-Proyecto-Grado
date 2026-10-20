import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  PackageCheck,
  AlertCircle,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectEntidad } from "@/components/layout/Selectentidad";
import { CasillaConfirmacion } from "@/components/Admin/CasillaConfirmacion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const ETIQUETA = "text-xs font-bold uppercase tracking-wide text-slate-600";

export function ResultadoLote({ descripcion, children, onCerrar }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-emerald-200">
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 size={22} strokeWidth={2.5} className="text-emerald-600" />
        </div>
        <div className={cn("flex flex-col", children ? "gap-1" : "gap-0.5")}>
          <div className="text-base font-extrabold text-slate-900">Lote registrado</div>
          <div className="text-sm text-slate-600">{descripcion}</div>
          {children}
        </div>
      </div>
      <Button
        variant="ghost"
        onClick={onCerrar}
        className="h-10 font-bold text-slate-500 hover:text-slate-900"
      >
        Registrar otro lote
      </Button>
    </div>
  );
}

export function DatosLote({ descripcion, className = "flex flex-col gap-5 p-5", children }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="text-base font-extrabold text-slate-900">Datos del lote</div>
        <div className="text-sm text-slate-500">{descripcion}</div>
      </div>
      <div className={className}>{children}</div>
    </section>
  );
}

function ErrorReintentar({ mensaje, onReintentar, className }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 text-sm font-semibold text-red-600",
        className,
      )}
    >
      {mensaje}
      <Button
        variant="outline"
        onClick={onReintentar}
        className="h-9 border-red-300 font-bold text-red-600 hover:bg-red-100"
      >
        Reintentar
      </Button>
    </div>
  );
}

export function SelectorProveedor({
  catalogo,
  valor,
  onCambio,
  invalido,
  className = "flex flex-col gap-1.5",
}) {
  const { datos, cargando, error, recargar } = catalogo;

  return (
    <div className={className}>
      <Label className={ETIQUETA}>Proveedor</Label>

      {cargando && <Skeleton className="h-11 w-full rounded-lg" />}

      {!cargando && error && (
        <ErrorReintentar mensaje={error} onReintentar={recargar} className="py-2.5" />
      )}

      {!cargando && !error && datos.length === 0 && (
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-400">
          No hay proveedores registrados.
        </div>
      )}

      {!cargando && !error && datos.length > 0 && (
        <SelectEntidad
          opciones={datos}
          valor={valor}
          onCambio={onCambio}
          campoValor="IdProveedor"
          campoEtiqueta="NombreProveedor"
          placeholder="Selecciona el proveedor"
          invalido={invalido}
        />
      )}
    </div>
  );
}

export function SelectorTipo({
  catalogo,
  valor,
  onCambio,
  campoValor,
  campoEtiqueta,
  campoDescripcion,
  etiqueta,
  mensajeVacio,
  cantidadSkeleton = 4,
}) {
  const { datos, cargando, error, recargar } = catalogo;

  return (
    <div className="flex flex-col gap-2">
      <Label className={ETIQUETA}>{etiqueta}</Label>

      {cargando && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: cantidadSkeleton }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      )}

      {!cargando && error && (
        <ErrorReintentar mensaje={error} onReintentar={recargar} className="py-3" />
      )}

      {!cargando && !error && datos.length === 0 && (
        <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
          {mensajeVacio}
        </div>
      )}

      {!cargando && !error && datos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {datos.map((t) => (
            <button
              key={t[campoValor]}
              type="button"
              onClick={() => onCambio(t[campoValor])}
              className={cn(
                "rounded-lg border-2 px-3 text-sm font-bold transition-colors",
                campoDescripcion ? "flex h-14 flex-col items-center justify-center" : "h-12",
                valor === t[campoValor]
                  ? "border-c3 bg-c1/15 text-c3"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              {campoDescripcion ? (
                <>
                  <span>{t[campoEtiqueta]}</span>
                  {t[campoDescripcion] && (
                    <span className="text-[11px] font-semibold text-slate-500">
                      {t[campoDescripcion]}
                    </span>
                  )}
                </>
              ) : (
                t[campoEtiqueta]
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EncabezadoFilas({ titulo, tipo, nota, textoAgregar, onAgregar }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-base font-extrabold text-slate-900">{titulo}</div>
        {tipo && (
          <Badge variant="outline" className="border-c3 font-bold text-c3">
            {tipo}
          </Badge>
        )}
        {nota && <div className="text-sm text-slate-500">{nota}</div>}
      </div>
      <Button
        onClick={onAgregar}
        className="h-11 gap-2 bg-gradient-to-r from-c3 to-c4 font-bold text-white hover:opacity-90"
      >
        <Plus size={16} strokeWidth={2.75} />
        {textoAgregar}
      </Button>
    </div>
  );
}

export function BotonQuitarFila({ onClick, disabled, className = "h-10 w-10" }) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className={cn("p-0 text-slate-400 hover:bg-red-50 hover:text-red-600", className)}
    >
      <Trash2 size={16} strokeWidth={2.5} />
    </Button>
  );
}

export function CabeceraFila({ titulo, onQuitar, deshabilitado }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</span>
      <BotonQuitarFila onClick={onQuitar} disabled={deshabilitado} className="h-9 w-9" />
    </div>
  );
}

export function ErroresFilas({ filas, errores }) {
  return (
    <div className="flex flex-col gap-1 border-t border-slate-100 bg-red-50 px-5 py-3">
      {filas.map((f, i) =>
        errores[f.id] ? (
          <div key={f.id} className="text-[12.5px] font-semibold text-red-600">
            Fila {i + 1}: {errores[f.id]}
          </div>
        ) : null,
      )}
    </div>
  );
}

export function ErrorFila({ mensaje }) {
  return (
    <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-red-600">
      <AlertCircle size={14} strokeWidth={2.5} />
      {mensaje}
    </div>
  );
}

export function ErrorEnvio({ mensaje }) {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
      <AlertCircle size={16} strokeWidth={2.5} />
      {mensaje}
    </div>
  );
}

export function BarraGuardarLote({ listo, enviando, onGuardar, children }) {
  return (
    <div className="mt-6 rounded-2xl bg-slate-900 px-5 py-4 shadow-sm sm:px-7">
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">{children}</div>
        <Button
          onClick={onGuardar}
          disabled={enviando}
          className={cn(
            "h-11 gap-2 bg-white/15 font-extrabold text-white hover:bg-white/15",
            listo && "bg-gradient-to-r from-c3 to-c4 hover:opacity-90",
          )}
        >
          {enviando ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <PackageCheck size={16} strokeWidth={2.75} />
              Guardar lote
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function DialogoConfirmarLote({
  abierto,
  enviando,
  cantidad,
  unidad,
  detalles,
  lineas = [],
  codigos = [],
  editable,
  aviso = "Una vez registrado el lote ya no se podrá editar.",
  onCancelar,
  onConfirmar,
}) {
  const [revisado, setRevisado] = useState(false);

  useEffect(() => {
    if (abierto) setRevisado(false);
  }, [abierto]);

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && !enviando && onCancelar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold">Confirmar ingreso del lote</DialogTitle>
          <DialogDescription>
            Estás por ingresar{" "}
            <strong className="text-slate-900">
              {cantidad} {unidad}
            </strong>{" "}
            al almacén.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {detalles.map(({ etiqueta, valor }) => (
            <div key={etiqueta} className="rounded-lg bg-slate-50 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {etiqueta}
              </div>
              <div className="text-sm font-bold text-slate-900">{valor}</div>
            </div>
          ))}
        </div>

        {lineas.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className={ETIQUETA}>Detalle por tipo</div>
            <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200">
              {lineas.map(({ etiqueta, valor }) => (
                <div key={etiqueta} className="flex items-center justify-between gap-3 px-3.5 py-2">
                  <span className="text-[13px] font-semibold text-slate-700">{etiqueta}</span>
                  <span className="text-[13px] font-extrabold tabular-nums text-slate-900">
                    {valor}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {codigos.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className={ETIQUETA}>Códigos ({codigos.length})</div>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2.5">
              {codigos.map((codigo) => (
                <span
                  key={codigo}
                  className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[13px] font-bold text-slate-900"
                >
                  {codigo}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-xl bg-red-50 px-3.5 py-3 text-[13px] text-red-700">
          <TriangleAlert size={17} strokeWidth={2.5} className="mt-0.5 shrink-0" />
          <span>
            ¿Revisaste bien {codigos.length > 0 ? "los códigos y " : ""}la cantidad de materia
            prima que vas a ingresar?{" "}
            {editable
              ? `Una vez registrado el lote solo se podrá editar ${editable}; la cantidad, el tipo y el proveedor ya no se pueden cambiar.`
              : aviso}
          </span>
        </div>

        <CasillaConfirmacion
          marcada={revisado}
          onCambio={setRevisado}
          titulo={codigos.length > 0 ? "Revisé los códigos y la cantidad" : "Revisé la cantidad"}
        >
          Confirmo que los datos coinciden con la materia prima recibida.
        </CasillaConfirmacion>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={onCancelar}
            disabled={enviando}
            className="h-11 font-bold text-slate-500 hover:text-slate-900"
          >
            Volver a revisar
          </Button>
          <Button
            onClick={onConfirmar}
            disabled={!revisado || enviando}
            className="h-11 gap-2 bg-gradient-to-r from-c3 to-c4 font-extrabold text-white hover:opacity-90"
          >
            {enviando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <PackageCheck size={16} strokeWidth={2.75} />
                Confirmar ingreso
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
