import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * FloatingDropdownPortal
 * Renderiza el contenido del dropdown directamente en document.body con position: fixed
 * calculando coordenadas para que NUNCA sea recortado por overflow de tablas ni tarjetas.
 */
export default function FloatingDropdownPortal({
  abierto,
  alCerrar,
  anchorRef,
  children,
  width = 220,
  align = "right"
}) {
  const [coords, setCoords] = useState({ top: 0, left: 0, posicionArriba: false });
  const menuRef = useRef(null);

  useEffect(() => {
    if (!abierto || !anchorRef?.current) return;

    const actualizarPosicion = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const espacioAbajo = window.innerHeight - rect.bottom;
      const espacioArriba = rect.top;
      const alturaEstimada = 320;

      const posicionArriba = espacioAbajo < alturaEstimada && espacioArriba > espacioAbajo;
      const top = posicionArriba ? rect.top - 6 : rect.bottom + 6;
      let left = align === "right" ? rect.right - width : rect.left;

      if (left + width > window.innerWidth - 8) {
        left = window.innerWidth - width - 8;
      }
      if (left < 8) {
        left = 8;
      }

      setCoords({ top, left, posicionArriba });
    };

    actualizarPosicion();

    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target)
      ) {
        alCerrar();
      }
    };

    const handleScrollOrResize = () => {
      actualizarPosicion();
    };

    document.addEventListener("mousedown", handleClickOutside, true);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [abierto, anchorRef, alCerrar, width, align]);

  if (!abierto) return null;

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: coords.posicionArriba ? undefined : `${coords.top}px`,
        bottom: coords.posicionArriba ? `${window.innerHeight - coords.top}px` : undefined,
        left: `${coords.left}px`,
        width: `${width}px`,
        zIndex: 99999
      }}
      className="rounded-xl bg-white border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
    >
      {children}
    </div>,
    document.body
  );
}
