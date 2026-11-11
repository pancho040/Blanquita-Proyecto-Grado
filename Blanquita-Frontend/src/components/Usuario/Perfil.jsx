import { useState, useEffect } from "react";
import {
  UserRound,
  UserRoundKey,
  IdCard,
  Phone,
  Mail,
  ShieldCheck,
  CalendarClock,
  Copy,
  Pencil,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import InputForModal from "@/components/layout/InputForModal";
import { obtenerPerfil, editarPerfil } from "../../services/Usuario/Perfil";
import { dateFormatter } from "@/utils/dates";

const ESTADO_ESTILO = {
  1: "border-emerald-300 bg-emerald-50 text-emerald-800",
  2: "border-slate-300 bg-slate-100 text-slate-700",
  3: "border-red-300 bg-red-50 text-red-800",
};

const MAX_NOMBRE = 15;
const CELULAR_REGEX = /^[67]\d{7}$/;

function iniciales(primerNombre, apellidoPaterno) {
  const a = primerNombre?.trim()?.[0] ?? "";
  const b = apellidoPaterno?.trim()?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

function formatearCelular(valor) {
  if (!valor) return "Sin registrar";
  const limpio = String(valor).replace(/\D/g, "");
  return limpio.length === 8
    ? limpio.replace(/(\d{4})(\d{4})/, "$1 $2")
    : String(valor);
}

const norm = (valor) => (valor ?? "").trim();

function formularioDesde(perfil) {
  return {
    PrimerNombre: perfil.PrimerNombre ?? "",
    SegundoNombre: perfil.SegundoNombre ?? "",
    ApellidoPaterno: perfil.ApellidoPaterno ?? "",
    ApellidoMaterno: perfil.ApellidoMaterno ?? "",
    Celular: perfil.Celular ?? "",
  };
}

function validar(form) {
  const errores = {};

  if (!norm(form.PrimerNombre)) errores.PrimerNombre = "Requerido";
  else if (norm(form.PrimerNombre).length > MAX_NOMBRE)
    errores.PrimerNombre = `Máximo ${MAX_NOMBRE} caracteres`;

  if (norm(form.SegundoNombre).length > MAX_NOMBRE)
    errores.SegundoNombre = `Máximo ${MAX_NOMBRE} caracteres`;

  if (!norm(form.ApellidoPaterno)) errores.ApellidoPaterno = "Requerido";
  else if (norm(form.ApellidoPaterno).length > MAX_NOMBRE)
    errores.ApellidoPaterno = `Máximo ${MAX_NOMBRE} caracteres`;

  if (norm(form.ApellidoMaterno).length > MAX_NOMBRE)
    errores.ApellidoMaterno = `Máximo ${MAX_NOMBRE} caracteres`;

  const celular = norm(form.Celular);
  if (celular && !CELULAR_REGEX.test(celular))
    errores.Celular = "8 dígitos, empezando con 6 o 7";

  return errores;
}

function hayCambios(form, perfil) {
  return (
    norm(form.PrimerNombre) !== norm(perfil.PrimerNombre) ||
    norm(form.SegundoNombre) !== norm(perfil.SegundoNombre) ||
    norm(form.ApellidoPaterno) !== norm(perfil.ApellidoPaterno) ||
    norm(form.ApellidoMaterno) !== norm(perfil.ApellidoMaterno) ||
    norm(form.Celular) !== norm(perfil.Celular)
  );
}

async function copiar(texto, etiqueta) {
  if (!texto) return;
  try {
    await navigator.clipboard?.writeText(String(texto));
    toast.success(`${etiqueta} copiado`);
  } catch {
    toast.error("No se pudo copiar");
  }
}

function Campo({ icono: Icono, etiqueta, valor, copiable = false }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      {Icono && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-700">
          <Icono size={15} strokeWidth={2} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {etiqueta}
        </div>
        <div className="flex items-center gap-2 break-words text-xs font-medium text-slate-900 mt-0.5">
          <span>{valor || "—"}</span>
          {copiable && valor && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => copiar(valor, etiqueta)}
              className="h-5 w-5 shrink-0 text-slate-400 hover:text-slate-900 cursor-pointer rounded"
            >
              <Copy size={12} strokeWidth={2} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TarjetaPerfil({ titulo, icono: Icono, children }) {
  return (
    <section className="overflow-hidden rounded border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700">
        {Icono && (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-700">
            <Icono size={14} strokeWidth={2} />
          </div>
        )}
        <span>{titulo}</span>
      </div>
      <div className="px-4 py-1 divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function PerfilSkeleton() {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded border border-slate-200 bg-white">
        <div className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-center">
          <Skeleton className="h-16 w-16 rounded" />
          <div className="w-full space-y-2">
            <Skeleton className="h-5 w-48 rounded" />
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
        </div>
      </section>

      {[0, 1].map((i) => (
        <section
          key={i}
          className="overflow-hidden rounded border border-slate-200 bg-white"
        >
          <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
            <Skeleton className="h-4 w-28 rounded" />
          </div>
          <div className="space-y-3 p-4">
            <Skeleton className="h-8 w-full rounded" />
            <Skeleton className="h-8 w-full rounded" />
          </div>
        </section>
      ))}
    </div>
  );
}

function DialogEditarPerfil({ abierto, onOpenChange, perfil, onGuardado }) {
  const [form, setForm] = useState(() => formularioDesde(perfil));
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setForm(formularioDesde(perfil));
      setErrores({});
      setGuardando(false);
    }
  }, [abierto, perfil]);

  const actualizar = (campo) => (valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => {
      if (!prev[campo]) return prev;
      const { [campo]: _omitido, ...resto } = prev;
      return resto;
    });
  };

  const actualizarCelular = (valor) =>
    actualizar("Celular")(valor.replace(/\D/g, "").slice(0, 8));

  const cambios = hayCambios(form, perfil);

  const guardar = async () => {
    const nuevosErrores = validar(form);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) return;

    setGuardando(true);
    try {
      const actualizado = await editarPerfil(form);
      onGuardado(actualizado);
      onOpenChange(false);
      toast.success("Perfil actualizado");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl rounded border border-slate-200 p-5">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-base font-bold text-slate-900">Editar Perfil de Colaborador</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-3 sm:flex-row">
            <InputForModal
              className="flex-1"
              classNameInput="h-9 text-xs rounded"
              id="PrimerNombre"
              etiqueta="Primer nombre"
              valor={form.PrimerNombre}
              onCambio={actualizar("PrimerNombre")}
              error={errores.PrimerNombre}
              maxLength={MAX_NOMBRE}
              autoComplete="given-name"
            />
            <InputForModal
              className="flex-1"
              classNameInput="h-9 text-xs rounded"
              id="SegundoNombre"
              etiqueta="Segundo nombre"
              opcional
              valor={form.SegundoNombre}
              onCambio={actualizar("SegundoNombre")}
              error={errores.SegundoNombre}
              maxLength={MAX_NOMBRE}
              autoComplete="additional-name"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <InputForModal
              className="flex-1"
              classNameInput="h-9 text-xs rounded"
              id="ApellidoPaterno"
              etiqueta="Apellido paterno"
              valor={form.ApellidoPaterno}
              onCambio={actualizar("ApellidoPaterno")}
              error={errores.ApellidoPaterno}
              maxLength={MAX_NOMBRE}
              autoComplete="family-name"
            />
            <InputForModal
              className="flex-1"
              classNameInput="h-9 text-xs rounded"
              id="ApellidoMaterno"
              etiqueta="Apellido materno"
              opcional
              valor={form.ApellidoMaterno}
              onCambio={actualizar("ApellidoMaterno")}
              error={errores.ApellidoMaterno}
              maxLength={MAX_NOMBRE}
            />
          </div>

          <InputForModal
            id="Celular"
            classNameInput="h-9 text-xs rounded font-mono"
            etiqueta="Celular"
            opcional
            valor={form.Celular}
            onCambio={actualizarCelular}
            error={errores.Celular}
            inputMode="numeric"
            placeholder="Ej. 71234567"
            autoComplete="tel-national"
          />
        </div>

        <DialogFooter className="border-t border-slate-100 pt-3 gap-2">
          <DialogClose
            render={<Button variant="outline" size="sm" disabled={guardando} className="h-8 text-xs rounded" />}
          >
            Cancelar
          </DialogClose>
          <Button
            onClick={guardar}
            size="sm"
            disabled={guardando || !cambios}
            className="h-8 gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded cursor-pointer"
          >
            {guardando ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check size={14} strokeWidth={2.5} />
                Guardar cambios
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Perfil() {
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    let activo = true;
    (async () => {
      setCargando(true);
      setError("");
      try {
        const data = await obtenerPerfil();
        if (activo) setPerfil(data);
      } catch (e) {
        if (activo) setError(e.message);
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  return (
    <div className="contenido-con-sidebar mt-20 md:mt-0 flex min-h-screen flex-col bg-[#F8FAFC] font-sans text-slate-900">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-28 sm:px-6 lg:max-w-5xl">
        {cargando && <PerfilSkeleton />}

        {!cargando && error && (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-center text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        {!cargando && !error && perfil && (
          <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-5 lg:space-y-0">
            <section className="overflow-hidden rounded border border-slate-200 bg-white">
              <div className="relative flex h-full flex-col items-center gap-4 bg-slate-900 p-5 text-white sm:flex-row sm:text-left">
                <Button
                  onClick={() => setEditando(true)}
                  variant="outline"
                  size="sm"
                  className="absolute right-3.5 top-3.5 h-8 gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs font-semibold rounded cursor-pointer"
                >
                  <Pencil size={13} strokeWidth={2} />
                  Editar
                </Button>

                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-white/20 bg-white/10 text-xl font-bold font-mono tracking-wider">
                  {iniciales(perfil.PrimerNombre, perfil.ApellidoPaterno)}
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-bold leading-tight break-words tracking-tight">
                    {perfil.NombreCompleto}
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-slate-300 font-mono tabular-nums sm:justify-start">
                    <IdCard size={14} strokeWidth={2} className="text-slate-400" />
                    <span>CI {perfil.Ci}</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => copiar(perfil.Ci, "CI")}
                      className="h-5 w-5 text-white/70 hover:bg-white/10 hover:text-white rounded cursor-pointer"
                    >
                      <Copy size={11} strokeWidth={2} />
                    </Button>
                  </div>
                  <div className="mt-2.5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border border-white/20 bg-white/10 text-white">
                      {perfil.NombreRol}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border",
                        ESTADO_ESTILO[perfil.IdEstadoUsuario] ??
                          "border-white/20 bg-white/10 text-white",
                      )}
                    >
                      {perfil.NombreEstadoUsuario}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <TarjetaPerfil titulo="Datos personales" icono={UserRound}>
              <Campo etiqueta="Primer nombre" valor={perfil.PrimerNombre} />
              {perfil.SegundoNombre && (
                <Campo
                  etiqueta="Segundo nombre"
                  valor={perfil.SegundoNombre}
                />
              )}
              <Campo
                etiqueta="Apellido paterno"
                valor={perfil.ApellidoPaterno}
              />
              {perfil.ApellidoMaterno && (
                <Campo
                  etiqueta="Apellido materno"
                  valor={perfil.ApellidoMaterno}
                />
              )}
            </TarjetaPerfil>

            <TarjetaPerfil titulo="Contacto" icono={Phone}>
              <Campo
                icono={Phone}
                etiqueta="Celular"
                valor={formatearCelular(perfil.Celular)}
                copiable={Boolean(perfil.Celular)}
              />
              <Campo
                icono={Mail}
                etiqueta="Correo"
                valor={perfil.Correo ?? "Sin registrar"}
                copiable={Boolean(perfil.Correo)}
              />
            </TarjetaPerfil>

            <TarjetaPerfil titulo="Cuenta" icono={UserRoundKey}>
              <Campo icono={UserRoundKey} etiqueta="Rol" valor={perfil.NombreRol} />
              <Campo
                icono={ShieldCheck}
                etiqueta="Estado"
                valor={perfil.NombreEstadoUsuario}
              />
              <Campo
                icono={CalendarClock}
                etiqueta="Registrado el"
                valor={dateFormatter(perfil.FechaRegistro)}
              />
            </TarjetaPerfil>
          </div>
        )}
      </main>

      {perfil && (
        <DialogEditarPerfil
          abierto={editando}
          onOpenChange={setEditando}
          perfil={perfil}
          onGuardado={setPerfil}
        />
      )}
    </div>
  );
}
