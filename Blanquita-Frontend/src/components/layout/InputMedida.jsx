import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DECIMALES_PESO, ENTEROS_MEDIDA } from "@/constants/Values";
import { aMedida } from "@/utils/medidas";

export default function InputMedida({
  valor = "",
  onCambio,
  decimales = DECIMALES_PESO,
  enteros = ENTEROS_MEDIDA,
  className = "",
  ...props
}) {
  return (
    <Input
      value={valor ?? ""}
      onChange={(e) => onCambio(aMedida(e.target.value, decimales, enteros))}
      inputMode="decimal"
      autoComplete="off"
      placeholder="0.0"
      className={cn("tabular-nums", className)}
      {...props}
    />
  );
}
