import { useState, useMemo, useEffect, useCallback } from "react";

/**
 * Hook de paginación para datos en memoria
 * Inspirado en usePaginatedQuery de front-focus.
 *
 * @param {Array} items - Colección de elementos a paginar
 * @param {number} pageSizeInicial - Cantidad de registros por página (default: 10)
 */
export function usePaginacion(items = [], pageSizeInicial = 10) {
  const [paginaActual, setPaginaActual] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeInicial);

  const totalItems = items?.length || 0;
  const totalPaginas = Math.max(1, Math.ceil(totalItems / pageSize));

  // Reset a página 1 si la lista de items cambia drásticamente o se filtran
  useEffect(() => {
    setPaginaActual(1);
  }, [totalItems, pageSize]);

  // Si la página actual excede el nuevo total de páginas, ajustar
  useEffect(() => {
    if (paginaActual > totalPaginas) {
      setPaginaActual(totalPaginas);
    }
  }, [paginaActual, totalPaginas]);

  // Elementos recortados para la página actual
  const itemsPaginados = useMemo(() => {
    if (!items || items.length === 0) return [];
    const inicio = (paginaActual - 1) * pageSize;
    const fin = inicio + pageSize;
    return items.slice(inicio, fin);
  }, [items, paginaActual, pageSize]);

  const cambiarPagina = useCallback((nuevaPagina) => {
    setPaginaActual((prev) => {
      if (nuevaPagina < 1) return 1;
      if (nuevaPagina > totalPaginas) return totalPaginas;
      return nuevaPagina;
    });
  }, [totalPaginas]);

  const siguientePagina = useCallback(() => {
    cambiarPagina(paginaActual + 1);
  }, [cambiarPagina, paginaActual]);

  const anteriorPagina = useCallback(() => {
    cambiarPagina(paginaActual - 1);
  }, [cambiarPagina, paginaActual]);

  const cambiarPageSize = useCallback((nuevoSize) => {
    const num = Number(nuevoSize);
    if (!isNaN(num) && num > 0) {
      setPageSize(num);
      setPaginaActual(1);
    }
  }, []);

  const indiceInicio = totalItems === 0 ? 0 : (paginaActual - 1) * pageSize + 1;
  const indiceFin = Math.min(paginaActual * pageSize, totalItems);

  return {
    paginaActual,
    totalPaginas,
    pageSize,
    totalItems,
    itemsPaginados,
    indiceInicio,
    indiceFin,
    puedeRetroceder: paginaActual > 1,
    puedeAvanzar: paginaActual < totalPaginas,
    cambiarPagina,
    siguientePagina,
    anteriorPagina,
    cambiarPageSize,
  };
}
