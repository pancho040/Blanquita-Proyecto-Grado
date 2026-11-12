import React, { useState, useEffect } from "react";
import { Building2 } from "lucide-react";
import { useBranch } from "@/stores/branchStore";

/**
 * Componente común de Selección y Filtrado de Sucursal para pantallas Multi-sucursal.
 *
 * Propiedades:
 * - permiteTodas: bool (default: true) -> Si la pantalla admite consolidado ("Todas")
 * - sucursalControlada: string opcional ("todas" | "1" | "2")
 * - setSucursalControlada: callback opcional para actualizar
 * - etiqueta: string (default: "Sucursal:")
 * - tamaño: "sm" | "md" (default: "sm")
 * - onCambio: callback opcional al cambiar de sucursal
 * - className: clases adicionales
 */
export default function BranchFilter({
  permiteTodas = true,
  sucursalControlada = null,
  setSucursalControlada = null,
  etiqueta = "Sucursal:",
  tamaño = "sm",
  onCambio = null,
  className = ""
}) {
  const [mounted, setMounted] = useState(false);
  const store = useBranch();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevenir discrepancia de hidratación SSR vs Cliente (React 19 / Astro):
  // Durante SSR y el primer frame de hidratación en cliente devuelve null,
  // garantizando exactamente el mismo árbol HTML (0 hydration mismatch).
  if (!mounted || !store.esMultisede) {
    return null;
  }

  const sucursalActual = sucursalControlada !== null ? sucursalControlada : store.sucursalActiva;

  const handleChange = (e) => {
    const val = e.target.value;
    if (setSucursalControlada) {
      setSucursalControlada(val);
    } else {
      store.cambiarSucursal(val);
    }
    if (onCambio) onCambio(val);
  };

  const alturaClase = tamaño === "sm" ? "h-8 text-xs" : "h-9 text-xs";

  return (
    <div
      className={`inline-flex items-center gap-1.5 p-0.5 bg-white border border-slate-300 rounded text-slate-700 shadow-2xs ${className}`}
      role="group"
      aria-label="Filtro de sucursal de operación"
    >
      <div className="flex items-center gap-1 pl-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider select-none">
        <Building2 size={13} className="text-[#1C96C5]" aria-hidden="true" />
        <span>{etiqueta}</span>
      </div>

      <select
        value={sucursalActual}
        onChange={handleChange}
        aria-label="Seleccionar sucursal"
        className={`${alturaClase} px-2.5 bg-slate-50 border border-slate-200 rounded font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1C96C5] focus:bg-white cursor-pointer transition-colors`}
      >
        {store.puedeVerTodas && permiteTodas && (
          <option value="todas">Todas las Sedes (Consolidado)</option>
        )}
        {(store.sucursalesPermitidas || []).map((s) => (
          <option key={`branch-opt-${s.id}`} value={String(s.id)}>
            {s.nombre || `Sucursal ${s.id}`}
          </option>
        ))}
      </select>
    </div>
  );
}
