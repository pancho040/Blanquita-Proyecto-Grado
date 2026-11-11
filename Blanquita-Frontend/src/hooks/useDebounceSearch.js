import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useDebounceSearch - Hook reutilizable de alto rendimiento para búsquedas.
 *
 * Características:
 * - Debounce por defecto de 250 ms.
 * - Gestión automática de AbortController para cancelar peticiones anteriores en vuelo (cero race conditions).
 * - Soporte para búsquedas asíncronas con señal de cancelación (`signal`).
 * - Soporte para filtrado síncrono en cliente (vía `debouncedTermino`).
 * - Limpieza garantizada al desmontar componentes.
 *
 * @param {Function} [onSearch] - Callback async opcional: `(termino, { signal }) => Promise<any>`
 * @param {number} [delay=250] - Retardo de debounce en ms (default 250ms).
 * @param {string} [valorInicial=""] - Valor inicial.
 */
export function useDebounceSearch(onSearch = null, delay = 250, valorInicial = "") {
  const [termino, setTermino] = useState(valorInicial);
  const [debouncedTermino, setDebouncedTermino] = useState(valorInicial);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);
  const onSearchRef = useRef(onSearch);

  // Mantener actualizado el ref del callback para evitar re-suscripciones por funciones recreadas
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // Manejador del debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      setDebouncedTermino(termino);

      if (typeof onSearchRef.current === "function") {
        // Cancelar la petición anterior en vuelo si existe
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          setCargando(true);
          setError(null);
          await onSearchRef.current(termino, { signal: controller.signal });
        } catch (err) {
          // Ignorar errores provocados por la cancelación voluntaria
          if (err?.name !== "AbortError" && !controller.signal.aborted) {
            setError(err);
          }
        } finally {
          if (!controller.signal.aborted) {
            setCargando(false);
          }
        }
      }
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [termino, delay]);

  // Abortar cualquier petición pendiente al desmontar el componente
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Ejecuta inmediatamente la búsqueda ignorando el debounce restante,
   * cancelando cualquier petición previa.
   */
  const ejecutarInmediato = useCallback(
    async (valorForzado = null) => {
      const valor = valorForzado !== null ? valorForzado : termino;
      setDebouncedTermino(valor);

      if (typeof onSearchRef.current === "function") {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          setCargando(true);
          setError(null);
          await onSearchRef.current(valor, { signal: controller.signal });
        } catch (err) {
          if (err?.name !== "AbortError" && !controller.signal.aborted) {
            setError(err);
          }
        } finally {
          if (!controller.signal.aborted) {
            setCargando(false);
          }
        }
      }
    },
    [termino]
  );

  /**
   * Limpia el término de búsqueda y cancela peticiones en curso.
   */
  const limpiar = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setTermino("");
    setDebouncedTermino("");
    setCargando(false);
    setError(null);
  }, []);

  /**
   * Cancela la petición en curso sin limpiar el texto ingresado.
   */
  const cancelar = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setCargando(false);
  }, []);

  return {
    termino,
    setTermino,
    debouncedTermino,
    cargando,
    error,
    limpiar,
    cancelar,
    ejecutarInmediato,
    abortControllerRef,
  };
}

export default useDebounceSearch;
