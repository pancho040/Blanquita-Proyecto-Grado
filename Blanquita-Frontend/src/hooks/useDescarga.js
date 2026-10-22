import { useState } from "react";
import { toast } from "sonner";
import { ABIERTO_EN_VISTA_PREVIA } from "@/utils/vistaPreviaPDF";

export function useDescarga(descargar, exito) {
  const [descargando, setDescargando] = useState(false);

  const iniciar = async () => {
    setDescargando(true);
    try {
      const resultado = await descargar();
      if (exito && resultado !== ABIERTO_EN_VISTA_PREVIA) toast.success(exito);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDescargando(false);
    }
  };

  return { descargando, iniciar };
}
