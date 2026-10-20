import InputForModal from "@/components/layout/InputForModal";
import { STOCK_UMBRAL_MAXIMO } from "@/constants/Values";
import { numeroONulo } from "@/utils/validators";

export const soloEntero = (texto) => String(texto ?? "").replace(/\D/g, "").slice(0, 5);

export function errorStock(stockMinimo, stockPreventivo) {
  const minimo = numeroONulo(stockMinimo);
  const preventivo = numeroONulo(stockPreventivo);
  if ((minimo === null) !== (preventivo === null)) return "Completa ambos valores o deja los dos vacíos";
  if (minimo !== null && preventivo <= minimo) return "El preventivo debe ser mayor al mínimo";
  if (preventivo !== null && preventivo > STOCK_UMBRAL_MAXIMO)
    return `El preventivo no puede superar ${STOCK_UMBRAL_MAXIMO}`;
  return null;
}

export function CamposStock({
  prefijoId,
  stockMinimo,
  stockPreventivo,
  onCambio,
  unidad,
  titulo = "Alerta de stock",
  ayuda,
}) {
  const error = errorStock(stockMinimo, stockPreventivo);

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-0.5">
        <div className="text-[14px] font-extrabold text-slate-900">{titulo}</div>
        <div className="text-[12.5px] text-slate-500">
          {ayuda ??
            `En ${unidad}. Rojo en el mínimo o menos, amarillo hasta el preventivo. Déjalos vacíos para no alertar.`}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <InputForModal
          id={`${prefijoId}-stock-minimo`}
          etiqueta="Stock mínimo"
          valor={stockMinimo}
          onCambio={(v) => onCambio("StockMinimo", soloEntero(v))}
          inputMode="numeric"
          placeholder="Ej. 2"
        />
        <InputForModal
          id={`${prefijoId}-stock-preventivo`}
          etiqueta="Stock preventivo"
          valor={stockPreventivo}
          onCambio={(v) => onCambio("StockPreventivo", soloEntero(v))}
          inputMode="numeric"
          placeholder="Ej. 5"
        />
      </div>
      {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
    </div>
  );
}
