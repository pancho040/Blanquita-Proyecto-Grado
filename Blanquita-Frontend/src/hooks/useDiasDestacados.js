import { useState } from "react";
import { aFechaISO } from "@/utils/dates";

const claveDia = (fecha) => String(fecha).slice(0, 10);

export function useDiasDestacados(consultar, etiquetar) {
  const [dias, setDias] = useState(new Map());

  const cargar = async ({ inicio, fin }) => {
    try {
      const elementos = await consultar(aFechaISO(inicio), aFechaISO(fin));
      const mapa = new Map();
      for (const elemento of elementos) {
        const { fecha, texto } = etiquetar(elemento);
        const clave = claveDia(fecha);
        mapa.set(clave, [...(mapa.get(clave) ?? []), texto]);
      }
      setDias(mapa);
    } catch {
      setDias(new Map());
    }
  };

  return { dias, cargar };
}
