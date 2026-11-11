import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * VirtualTableBody - Renderizador virtualizado liviano para tablas con más de 100 filas.
 *
 * Mantiene la semántica <table> y <tbody> estándar de HTML sin dependencias externas pesadas.
 * Solo monta en el DOM los elementos visibles en el viewport de scroll más un margen de sobreescaneo (overscan).
 *
 * @param {Array} items - Lista completa de elementos a renderizar.
 * @param {Function} renderRow - Función de renderizado: `(item, index) => <tr key={...}>...</tr>`.
 * @param {number} [estimateRowHeight=40] - Altura estimada de cada fila en píxeles.
 * @param {number} [overscan=6] - Número de filas adicionales antes y después de la ventana visible.
 * @param {React.RefObject} [scrollContainerRef] - Referencia al elemento contenedor con overflow-y-auto.
 * @param {number} [cols=7] - Número de columnas para los espaciadores <td>.
 */
export function VirtualTableBody({
  items = [],
  renderRow,
  estimateRowHeight = 40,
  overscan = 6,
  scrollContainerRef = null,
  cols = 7,
}) {
  const localContainerRef = useRef(null);
  const containerRef = scrollContainerRef || localContainerRef;

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  // Umbral: si hay 50 o menos filas, omitir virtualización para máxima simplicidad
  const totalItems = items.length;
  const requiereVirtualizacion = totalItems > 50;

  useEffect(() => {
    if (!requiereVirtualizacion) return;

    const el = containerRef.current;
    if (!el) return;

    const actualizarDimensiones = () => {
      setViewportHeight(el.clientHeight || 600);
      setScrollTop(el.scrollTop || 0);
    };

    actualizarDimensiones();

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (containerRef.current) {
            setScrollTop(containerRef.current.scrollTop);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", actualizarDimensiones, { passive: true });

    return () => {
      el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", actualizarDimensiones);
    };
  }, [containerRef, requiereVirtualizacion, totalItems]);

  const { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight, visibleItems } = useMemo(() => {
    if (!requiereVirtualizacion) {
      return {
        startIndex: 0,
        endIndex: totalItems,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
        visibleItems: items,
      };
    }

    const start = Math.max(0, Math.floor(scrollTop / estimateRowHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / estimateRowHeight) + overscan * 2;
    const end = Math.min(totalItems, start + visibleCount);

    const topSpacer = start * estimateRowHeight;
    const bottomSpacer = Math.max(0, (totalItems - end) * estimateRowHeight);

    return {
      startIndex: start,
      endIndex: end,
      topSpacerHeight: topSpacer,
      bottomSpacerHeight: bottomSpacer,
      visibleItems: items.slice(start, end),
    };
  }, [items, totalItems, scrollTop, viewportHeight, estimateRowHeight, overscan, requiereVirtualizacion]);

  if (!requiereVirtualizacion) {
    return (
      <tbody className="divide-y divide-slate-100">
        {items.map((item, index) => renderRow(item, index))}
      </tbody>
    );
  }

  return (
    <tbody className="divide-y divide-slate-100">
      {topSpacerHeight > 0 && (
        <tr
          style={{ height: `${topSpacerHeight}px` }}
          aria-hidden="true"
          className="border-none pointer-events-none"
        >
          <td colSpan={cols} className="p-0 border-none" />
        </tr>
      )}

      {visibleItems.map((item, localIdx) => renderRow(item, startIndex + localIdx))}

      {bottomSpacerHeight > 0 && (
        <tr
          style={{ height: `${bottomSpacerHeight}px` }}
          aria-hidden="true"
          className="border-none pointer-events-none"
        >
          <td colSpan={cols} className="p-0 border-none" />
        </tr>
      )}
    </tbody>
  );
}

export default VirtualTableBody;
