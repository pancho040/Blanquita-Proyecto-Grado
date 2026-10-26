import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InputCodigo from "@/components/layout/InputCodigo";
import { cn } from "@/lib/utils";
import { aMedida } from "@/utils/medidas";

export default function InputForModal({
  id,
  etiqueta = "",
  opcional = false,
  valor = "",
  onCambio,
  error = "",
  codigo = false,
  medida = null,
  className = "",
  classNameInput = "",
  ...props
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {etiqueta && (
        <Label
          htmlFor={id}
          className="flex items-center gap-1 whitespace-nowrap text-xs font-bold uppercase tracking-wide text-slate-600"
        >
          {etiqueta}
          {opcional && (
            <span className="font-semibold normal-case text-slate-400">
              (opcional)
            </span>
          )}
        </Label>
      )}

      {codigo ? (
        <InputCodigo
          id={id}
          valor={valor}
          onCambio={onCambio}
          aria-invalid={Boolean(error)}
          className={cn("h-11", classNameInput)}
          {...props}
        />
      ) : (
        <Input
          id={id}
          value={valor ?? ""}
          onChange={(e) =>
            onCambio(medida === null ? e.target.value : aMedida(e.target.value, medida))
          }
          inputMode={medida === null ? undefined : "decimal"}
          aria-invalid={Boolean(error)}
          className={cn("h-11", classNameInput)}
          {...props}
        />
      )}

      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
