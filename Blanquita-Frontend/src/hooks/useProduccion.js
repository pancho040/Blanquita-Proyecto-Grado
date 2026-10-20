import { useState, useEffect } from "react";
import { toast } from "sonner";
import { MOTIVO_CANCELACION_MIN, MOTIVO_CANCELACION_MAX } from "@/constants/Values";
import { extraerMensajeError } from "@/utils/validators";

const mensajeDe = (e) => extraerMensajeError(e, e.message);

export const motivoValido = (texto) => {
  const largo = texto.trim().length;
  return largo >= MOTIVO_CANCELACION_MIN && largo <= MOTIVO_CANCELACION_MAX;
};

function useListaProducciones(cargar) {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const recargar = async () => {
    setCargando(true);
    setError("");
    try {
      setDatos(await cargar());
    } catch (e) {
      setError(mensajeDe(e));
      setDatos([]);
    } finally {
      setCargando(false);
    }
  };

  return { datos, cargando, error, recargar };
}

function useDialogoMotivo({ enviar, exito, invalido, alTerminar }) {
  const [produccion, setProduccion] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const valido = motivoValido(motivo);

  const abrir = (p) => {
    setMotivo("");
    setError("");
    setProduccion(p);
  };

  const confirmar = async () => {
    if (!valido) {
      setError(invalido);
      return;
    }
    setEnviando(true);
    setError("");
    try {
      await enviar(produccion, motivo.trim());
      toast.success(exito);
      setProduccion(null);
      alTerminar();
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return {
    produccion,
    abierto: produccion !== null,
    motivo,
    setMotivo,
    error,
    enviando,
    valido,
    abrir,
    cerrar: () => setProduccion(null),
    confirmar,
  };
}

export function useProduccion({
  verActivas,
  verPausadas,
  idDe,
  pausar,
  cancelar,
  finalizar,
  reanudar,
  dependencias = [],
}) {
  const activas = useListaProducciones(verActivas);
  const pausadas = useListaProducciones(verPausadas);

  const recargarTodo = () => {
    activas.recargar();
    pausadas.recargar();
  };

  useEffect(() => {
    recargarTodo();
  }, dependencias);

  const pausa = useDialogoMotivo({
    enviar: (p, motivo) => pausar(idDe(p), motivo),
    exito: "Producción pausada",
    invalido: `El motivo de la pausa debe tener entre ${MOTIVO_CANCELACION_MIN} y ${MOTIVO_CANCELACION_MAX} caracteres`,
    alTerminar: recargarTodo,
  });

  const cancelacion = useDialogoMotivo({
    enviar: (p, motivo) => cancelar(idDe(p), motivo),
    exito: "Producción cancelada",
    invalido: `El motivo de cancelación debe tener entre ${MOTIVO_CANCELACION_MIN} y ${MOTIVO_CANCELACION_MAX} caracteres`,
    alTerminar: pausadas.recargar,
  });

  const [porFinalizar, setPorFinalizar] = useState(null);
  const [finalizando, setFinalizando] = useState(false);

  const confirmarFinalizar = async () => {
    setFinalizando(true);
    try {
      await finalizar(idDe(porFinalizar));
      toast.success("Producción finalizada");
      setPorFinalizar(null);
      activas.recargar();
    } catch (e) {
      toast.error(mensajeDe(e));
    } finally {
      setFinalizando(false);
    }
  };

  const reanudacion = useDialogoMotivo({
    enviar: (p, motivo) => reanudar(idDe(p), motivo),
    exito: "Producción reanudada",
    invalido: `El motivo de la reanudación debe tener entre ${MOTIVO_CANCELACION_MIN} y ${MOTIVO_CANCELACION_MAX} caracteres`,
    alTerminar: recargarTodo,
  });

  return {
    activas,
    pausadas,
    recargarTodo,
    pausa,
    cancelacion,
    finalizacion: {
      produccion: porFinalizar,
      abierto: porFinalizar !== null,
      enviando: finalizando,
      abrir: setPorFinalizar,
      cerrar: () => setPorFinalizar(null),
      confirmar: confirmarFinalizar,
    },
    reanudacion,
    procesandoId:
      reanudacion.enviando && reanudacion.produccion ? idDe(reanudacion.produccion) : null,
    reanudar: reanudacion.abrir,
  };
}
