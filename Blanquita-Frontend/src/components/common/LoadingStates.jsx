import React from "react";
import { cn } from "@/lib/utils";

/**
 * LoadingStates - Skeletons industriales estandarizados para el ERP Blanquita.
 * Cumple estrictamente con DESIGN.md y .impecablerc:
 * - Radio máximo de 4px (rounded).
 * - Bordes de 1px en border-slate-200.
 * - Fondos sólidos en slate-100 y slate-200.
 * - Cero degradados ni animaciones pulsantes estridentes.
 */

/**
 * Bloque base de skeleton.
 */
export function SkeletonBlock({ className = "", width, height, style = {} }) {
  return (
    <div
      className={cn(
        "bg-slate-200/80 rounded animate-pulse",
        className
      )}
      style={{
        width: width,
        height: height,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton para filas individuales dentro de un <tbody> ya existente.
 */
export function SkeletonRow({ cols = 6, rowIdx = 0 }) {
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: cols }).map((_, cIdx) => (
        <td key={cIdx} className="px-3 py-2.5">
          <SkeletonBlock
            className={cn(
              "h-3.5",
              cIdx === 0
                ? "w-3/4"
                : cIdx === cols - 1
                ? "w-16 ml-auto"
                : (cIdx + rowIdx) % 2 === 0
                ? "w-24"
                : "w-20"
            )}
          />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton para tablas completas con cabecera y filas.
 */
export function SkeletonTable({
  rows = 5,
  cols = 6,
  headers = null,
  className = "",
}) {
  return (
    <div
      className={cn(
        "w-full border border-slate-200 rounded overflow-hidden bg-white",
        className
      )}
      aria-busy="true"
      aria-label="Cargando tabla de datos..."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {headers && headers.length === cols
                ? headers.map((h, idx) => (
                    <th
                      key={idx}
                      className={cn(
                        "px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider",
                        idx === cols - 1 ? "text-right" : "text-left"
                      )}
                    >
                      {h}
                    </th>
                  ))
                : Array.from({ length: cols }).map((_, idx) => (
                    <th key={idx} className="px-3 py-2.5">
                      <SkeletonBlock
                        className={cn(
                          "h-3",
                          idx === cols - 1 ? "w-14 ml-auto" : "w-20"
                        )}
                      />
                    </th>
                  ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, rIdx) => (
              <SkeletonRow key={rIdx} cols={cols} rowIdx={rIdx} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Skeleton para cuadrículas de métricas y KPIs ejecutivos.
 */
export function SkeletonMetrics({
  count = 4,
  columnsClass = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  className = "",
}) {
  return (
    <div
      className={cn("grid gap-3", columnsClass, className)}
      aria-busy="true"
      aria-label="Cargando métricas ejecutivas..."
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white p-4 rounded border border-slate-200 space-y-2.5 animate-pulse"
        >
          <div className="flex justify-between items-center">
            <SkeletonBlock className="h-3 w-28 bg-slate-200" />
            <SkeletonBlock className="h-6 w-6 rounded bg-slate-100 border border-slate-200" />
          </div>
          <div className="pt-1">
            <SkeletonBlock className="h-7 w-36 bg-slate-200" />
          </div>
          <SkeletonBlock className="h-3 w-24 bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton para vistas basadas en tarjetas (cards).
 */
export function SkeletonCards({
  count = 3,
  columnsClass = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  className = "",
}) {
  return (
    <div
      className={cn("grid gap-3", columnsClass, className)}
      aria-busy="true"
      aria-label="Cargando tarjetas..."
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white p-4 rounded border border-slate-200 space-y-3 animate-pulse"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-5 w-5 rounded bg-slate-200" />
              <SkeletonBlock className="h-4 w-32 bg-slate-200" />
            </div>
            <SkeletonBlock className="h-4 w-16 rounded bg-slate-100" />
          </div>
          <div className="space-y-2">
            <SkeletonBlock className="h-3 w-full bg-slate-100" />
            <SkeletonBlock className="h-3 w-4/5 bg-slate-100" />
            <SkeletonBlock className="h-3 w-2/3 bg-slate-100" />
          </div>
          <div className="pt-2 flex justify-between items-center border-t border-slate-100">
            <SkeletonBlock className="h-3.5 w-20 bg-slate-200" />
            <SkeletonBlock className="h-6 w-20 rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default {
  SkeletonBlock,
  SkeletonRow,
  SkeletonTable,
  SkeletonMetrics,
  SkeletonCards,
};
