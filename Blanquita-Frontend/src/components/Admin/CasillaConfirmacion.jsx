export const ANCHO_DIALOGO_ADMIN = "max-h-[92vh] overflow-y-auto sm:max-w-3xl";

export function CasillaConfirmacion({ marcada, onCambio, titulo, children }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <input
        type="checkbox"
        checked={marcada}
        onChange={(e) => onCambio(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-slate-900"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-bold text-slate-900">{titulo}</span>
        <span className="text-[12.5px] text-slate-600">{children}</span>
      </span>
    </label>
  );
}
