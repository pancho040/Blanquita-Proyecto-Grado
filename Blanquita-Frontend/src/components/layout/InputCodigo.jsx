import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CODIGO_MAX } from "@/constants/Values";
import { codigoChange, codigoKeyDown } from "@/utils/handlers";

export default function InputCodigo({ valor = "", onCambio, onKeyDown, className = "", ...props }) {
  return (
    <Input
      value={valor ?? ""}
      onChange={(e) => codigoChange(e, onCambio)}
      onKeyDown={(e) => {
        codigoKeyDown(e, onCambio);
        onKeyDown?.(e);
      }}
      maxLength={CODIGO_MAX}
      autoCapitalize="characters"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      className={cn("font-mono", className)}
      {...props}
    />
  );
}
