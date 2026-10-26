import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

/**
 * Componente de barra de paginación para tablas
 * Estándar visual y funcional idéntico a front-focus DataTable pagination.
 */
export default function PaginacionTabla({
  paginaActual,
  totalPaginas,
  totalItems,
  pageSize,
  indiceInicio,
  indiceFin,
  puedeRetroceder,
  puedeAvanzar,
  cambiarPagina,
  cambiarPageSize,
  opcionesPageSize = [10, 20, 50, 100],
}) {
  if (totalItems === 0) return null;

  // Generar páginas a mostrar con elipsis si son muchas
  const generarPaginas = () => {
    const paginas = [];
    const delta = 1; // páginas alrededor de la actual

    const rangoIzq = Math.max(2, paginaActual - delta);
    const rangoDer = Math.min(totalPaginas - 1, paginaActual + delta);

    paginas.push(1);

    if (rangoIzq > 2) {
      paginas.push("...");
    }

    for (let i = rangoIzq; i <= rangoDer; i++) {
      paginas.push(i);
    }

    if (rangoDer < totalPaginas - 1) {
      paginas.push("...");
    }

    if (totalPaginas > 1) {
      paginas.push(totalPaginas);
    }

    return paginas;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200 text-xs text-slate-600 select-none">
      {/* Información de rango y selector de tamaño */}
      <div className="flex items-center gap-3">
        <span>
          Mostrando <strong className="text-slate-800">{indiceInicio}</strong> a{" "}
          <strong className="text-slate-800">{indiceFin}</strong> de{" "}
          <strong className="text-slate-800">{totalItems}</strong> registros
        </span>

        {cambiarPageSize && (
          <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
            <span className="text-slate-500">Filas:</span>
            <select
              value={pageSize}
              onChange={(e) => cambiarPageSize(e.target.value)}
              className="h-7 px-2 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-[#20A7DB]"
            >
              {opcionesPageSize.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Controles de navegación */}
      <div className="flex items-center gap-1">
        {/* Ir a la primera página */}
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          disabled={!puedeRetroceder}
          onClick={() => cambiarPagina(1)}
          title="Primera página"
          className="h-7 w-7 rounded-md cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronsLeft size={14} />
        </Button>

        {/* Anterior */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!puedeRetroceder}
          onClick={() => cambiarPagina(paginaActual - 1)}
          className="h-7 px-2.5 rounded-md text-xs font-medium cursor-pointer disabled:cursor-not-allowed gap-1"
        >
          <ChevronLeft size={14} />
          <span className="hidden sm:inline">Anterior</span>
        </Button>

        {/* Números de página */}
        <div className="flex items-center gap-1 px-1">
          {generarPaginas().map((p, idx) => {
            if (p === "...") {
              return (
                <span key={`dots-${idx}`} className="px-1.5 text-slate-400">
                  ...
                </span>
              );
            }
            const esActiva = p === paginaActual;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => cambiarPagina(p)}
                className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  esActiva
                    ? "bg-[#20A7DB] text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Siguiente */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!puedeAvanzar}
          onClick={() => cambiarPagina(paginaActual + 1)}
          className="h-7 px-2.5 rounded-md text-xs font-medium cursor-pointer disabled:cursor-not-allowed gap-1"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight size={14} />
        </Button>

        {/* Ir a la última página */}
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          disabled={!puedeAvanzar}
          onClick={() => cambiarPagina(totalPaginas)}
          title="Última página"
          className="h-7 w-7 rounded-md cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronsRight size={14} />
        </Button>
      </div>
    </div>
  );
}
