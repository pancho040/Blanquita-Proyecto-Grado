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
  1: "border-emerald-300 bg-emerald-50 text-emerald-700",
  2: "border-slate-300 bg-slate-100 text-slate-600",
  3: "border-red-300 bg-red-50 text-red-600",
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
    <div className="flex items-start gap-3 py-3">
      {Icono && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-c4/10 text-c3">
          <Icono size={17} strokeWidth={2.25} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {etiqueta}
        </div>
        <div className="flex items-center gap-2 break-words text-[15px] font-semibold text-slate-800">
          {valor}
          {copiable && valor && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copiar(valor, etiqueta)}
              className="h-6 w-6 shrink-0 text-slate-400 hover:text-c3"
            >
              <Copy size={13} strokeWidth={2.5} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TarjetaPerfil({ titulo, icono: Icono, children }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 text-sm font-extrabold text-slate-700">
        {Icono && (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-c4/10 text-c3">
            <Icono size={16} strokeWidth={2.25} />
          </div>
        )}
        {titulo}
      </div>
      <div className="px-5 py-1">{children}</div>
    </section>
  );
}

function PerfilSkeleton() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-center">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="w-full space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      </section>

      {[0, 1].map((i) => (
        <section
          key={i}
          className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
        >
          <div className="border-b border-slate-100 px-5 py-3.5">
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="space-y-4 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <InputForModal
              className="flex-1"
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

          <div className="flex flex-col gap-4 sm:flex-row">
            <InputForModal
              className="flex-1"
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

        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" disabled={guardando} />}
          >
            Cancelar
          </DialogClose>
          <Button
            onClick={guardar}
            disabled={guardando || !cambios}
            className="gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium"
          >
            {guardando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check size={16} strokeWidth={2.75} />
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
    <div className="contenido-con-sidebar mt-20 md:mt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6 pb-28 sm:px-6 lg:max-w-5xl">
        {cargando && <PerfilSkeleton />}

        {!cargando && error && (
          <div className="rounded-xl bg-red-50 p-5 text-center text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        {!cargando && !error && perfil && (
          <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-6 lg:space-y-0">
            <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="relative flex h-full flex-col items-center gap-4 bg-slate-900 p-6 text-white sm:flex-row sm:text-left">
                <Button
                  onClick={() => setEditando(true)}
                  className="absolute right-4 top-4 h-9 gap-1.5 bg-white/15 font-bold text-white hover:bg-white/25"
                >
                  <Pencil size={14} strokeWidth={2.5} />
                  Editar
                </Button>

                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/15 text-2xl font-extrabold">
                  {iniciales(perfil.PrimerNombre, perfil.ApellidoPaterno)}
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-extrabold leading-tight break-words">
                    {perfil.NombreCompleto}
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-2 text-sm text-white/85 sm:justify-start">
                    <IdCard size={15} strokeWidth={2.25} />
                    CI {perfil.Ci}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copiar(perfil.Ci, "CI")}
                      className="h-6 w-6 text-white/80 hover:bg-white/15 hover:text-white"
                    >
                      <Copy size={13} strokeWidth={2.5} />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                    <Badge
                      variant="outline"
                      className="border-white/40 bg-white/10 font-bold text-white"
                    >
                      {perfil.NombreRol}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-bold",
                        ESTADO_ESTILO[perfil.IdEstadoUsuario] ??
                          "border-white/40 bg-white/10 text-white",
                      )}
                    >
                      {perfil.NombreEstadoUsuario}
                    </Badge>
                  </div>
                </div>
              </div>
            </section>

            <TarjetaPerfil titulo="Datos personales" icono={UserRound}>
              <Campo etiqueta="Primer nombre" valor={perfil.PrimerNombre} />
              {perfil.SegundoNombre && (
                <>
                  <Separator />
                  <Campo
                    etiqueta="Segundo nombre"
                    valor={perfil.SegundoNombre}
                  />
                </>
              )}
              <Separator />
              <Campo
                etiqueta="Apellido paterno"
                valor={perfil.ApellidoPaterno}
              />
              {perfil.ApellidoMaterno && (
                <>
                  <Separator />
                  <Campo
                    etiqueta="Apellido materno"
                    valor={perfil.ApellidoMaterno}
                  />
                </>
              )}
            </TarjetaPerfil>

            <TarjetaPerfil titulo="Contacto">
              <Campo
                icono={Phone}
                etiqueta="Celular"
                valor={formatearCelular(perfil.Celular)}
                copiable={Boolean(perfil.Celular)}
              />
              <Separator />
              <Campo
                icono={Mail}
                etiqueta="Correo"
                valor={perfil.Correo ?? "Sin registrar"}
                copiable={Boolean(perfil.Correo)}
              />
            </TarjetaPerfil>

            <TarjetaPerfil titulo="Cuenta">
              <Campo icono={UserRoundKey} etiqueta="Rol" valor={perfil.NombreRol} />
              <Separator />
              <Campo
                icono={ShieldCheck}
                etiqueta="Estado"
                valor={perfil.NombreEstadoUsuario}
              />
              <Separator />
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
