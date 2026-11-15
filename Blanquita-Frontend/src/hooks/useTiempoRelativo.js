import { useState, useEffect } from "react";

/**
 * Hook para formatear y actualizar en tiempo real el tiempo transcurrido
 * desde la última actualización ("hace unos segundos", "hace 15 s", "hace 2 min").
 */
export function useTiempoRelativo(fecha) {
  const [texto, setTexto] = useState("hace unos segundos");

  useEffect(() => {
    if (!fecha) {
      setTexto("sin actualizar");
      return;
    }

    const actualizar = () => {
      const ahora = Date.now();
      const f = fecha instanceof Date ? fecha : new Date(fecha);
      const diffSeg = Math.max(0, Math.floor((ahora - f.getTime()) / 1000));

      if (diffSeg < 10) {
        setTexto("hace unos segundos");
      } else if (diffSeg < 60) {
        setTexto(`hace ${diffSeg} s`);
      } else {
        const diffMin = Math.floor(diffSeg / 60);
        setTexto(`hace ${diffMin} min`);
      }
    };

    actualizar();
    const interval = setInterval(actualizar, 2000);
    return () => clearInterval(interval);
  }, [fecha]);

  return texto;
}

export default useTiempoRelativo;
