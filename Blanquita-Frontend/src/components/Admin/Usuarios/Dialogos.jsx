import { useState } from "react";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InputForModal from "@/components/layout/InputForModal";
import { CLAVE_MIN, CLAVE_MAX } from "@/constants/Values";

export const ETIQUETA = "text-xs font-bold uppercase tracking-wide text-slate-600";
const SIMBOLOS = "!@#$%^&*()-_=+[]{}|;:',.<>?/`~\"\\";

export const PATRON_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,15}$/;
export const PATRON_CELULAR = /^[67]\d{7}$/;

export const soloLetras = (texto) => texto.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "").slice(0, 15);
export const soloDigitos = (texto, max) => texto.replace(/\D/g, "").slice(0, max);

export const CAMPOS_NOMBRE = [
  { campo: "PrimerNombre", etiqueta: "Primer nombre" },
  { campo: "SegundoNombre", etiqueta: "Segundo nombre", opcional: true },
  { campo: "ApellidoPaterno", etiqueta: "Apellido paterno" },
  { campo: "ApellidoMaterno", etiqueta: "Apellido materno", opcional: true },
];

export const reglasClave = (clave) => [
  {
    texto: `Entre ${CLAVE_MIN} y ${CLAVE_MAX} caracteres`,
    ok: clave.length >= CLAVE_MIN && clave.length <= CLAVE_MAX,
  },
  { texto: "Una letra mayúscula", ok: /[A-ZÁÉÍÓÚÜÑ]/.test(clave) },
  { texto: "Un número", ok: /\d/.test(clave) },
  { texto: "Un símbolo", ok: [...clave].some((ch) => SIMBOLOS.includes(ch)) },
];

export const claveValida = (clave) => reglasClave(clave).every((regla) => regla.ok);

export function ErrorDialogo({ mensaje }) {
  return (
    <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600">
      {mensaje}
    </div>
  );
}

export function BotonEnviar({ enviando, deshabilitado, onClick, className, children }) {
  return (
    <Button
      onClick={onClick}
      disabled={enviando || deshabilitado}
      className={cn("h-11 w-full gap-2 font-extrabold text-white sm:w-auto", className)}
    >
      {enviando ? <Loader2 size={16} className="animate-spin" /> : children}
    </Button>
  );
}

export function CamposClave({ clave, setClave, confirmacion, setConfirmacion, prefijoId }) {
  const [visible, setVisible] = useState(false);
  const reglas = reglasClave(clave);
  const noCoincide = confirmacion !== "" && confirmacion !== clave;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefijoId}-clave`} className={ETIQUETA}>
          Clave
        </Label>
        <div className="relative">
          <Input
            id={`${prefijoId}-clave`}
            type={visible ? "text" : "password"}
            value={clave}
            onChange={(e) => setClave(e.target.value.replace(/\s/g, ""))}
            maxLength={CLAVE_MAX}
            autoComplete="new-password"
            className="h-11 pr-11 font-mono"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar clave" : "Mostrar clave"}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] font-semibold">
          {reglas.map((regla) => (
            <li
              key={regla.texto}
              className={cn(
                "flex items-center gap-1.5",
                regla.ok ? "text-emerald-600" : "text-slate-400",
              )}
            >
              {regla.ok ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
              {regla.texto}
            </li>
          ))}
        </ul>
      </div>

      <InputForModal
        id={`${prefijoId}-confirmacion`}
        etiqueta="Confirmar clave"
        type={visible ? "text" : "password"}
        valor={confirmacion}
        onCambio={(v) => setConfirmacion(v.replace(/\s/g, ""))}
        maxLength={CLAVE_MAX}
        autoComplete="new-password"
        classNameInput="font-mono"
        error={noCoincide ? "Las claves no coinciden" : ""}
      />
    </div>
  );
}
