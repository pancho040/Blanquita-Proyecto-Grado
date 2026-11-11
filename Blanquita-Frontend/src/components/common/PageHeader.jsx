import React from "react";
import BranchFilter from "@/components/common/BranchFilter";

/**
 * Encabezado Estándar de Página (PageHeader) con Espacio Fijo para BranchFilter
 * Cumple con el sistema de diseño (DESIGN.md / impeccable.json):
 * - Altura consistente h-8 / h-9
 * - Bordes de 1px, radio de 4px (rounded)
 * - Posición fija superior derecha para el filtro territorial
 * - Responsive: en móvil pasa a su propia fila horizontal sin romper el layout
 */
export default function PageHeader({
  titulo = null,
  title = null,
  subtitulo = null,
  subtitle = null,
  icono: Icono = null,
  badge = null,
  mostrarFiltro = true,
  permiteTodas = true,
  sucursal = null,
  setSucursal = null,
  onCambioSucursal = null,
  branchFilter = null,
  acciones = null,
  className = ""
}) {
  const tituloFinal = titulo || title;
  const subtituloFinal = subtitulo || subtitle;

  return (
    <header
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 mb-4 border-b border-slate-200 bg-white/50 backdrop-blur-xs ${className}`}
    >
      {/* Lado Izquierdo: Icono + Título + Subtítulo */}
      <div className="flex items-center gap-3 min-w-0">
        {Icono && (
          <div className="flex items-center justify-center h-9 w-9 rounded bg-[#1C96C5]/10 border border-[#1C96C5]/20 text-[#1C96C5] shrink-0">
            <Icono size={18} aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
              {tituloFinal}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {subtituloFinal && (
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {subtituloFinal}
            </p>
          )}
        </div>
      </div>

      {/* Lado Derecho: BranchFilter en Posición Fija + Acciones */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end shrink-0 w-full sm:w-auto">
        {branchFilter ? (
          branchFilter
        ) : (
          mostrarFiltro && (
            <BranchFilter
              permiteTodas={permiteTodas}
              sucursalControlada={sucursal}
              setSucursalControlada={setSucursal}
              onCambio={onCambioSucursal}
            />
          )
        )}
        {acciones && <div className="flex items-center gap-2 shrink-0">{acciones}</div>}
      </div>
    </header>
  );
}
