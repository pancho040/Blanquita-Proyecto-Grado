import { useRef, useState } from "react";
import { toast } from "sonner";

export const codigosRepetidos = (codigos) => {
  const cuenta = {};
  codigos.forEach((c) => {
    const valor = c.trim().toLowerCase();
    if (valor) cuenta[valor] = (cuenta[valor] || 0) + 1;
  });
  return new Set(Object.keys(cuenta).filter((c) => cuenta[c] > 1));
};

export const erroresPorFila = (filas, validar) =>
  filas.reduce((acc, f) => {
    const error = validar(f);
    if (error) acc[f.id] = error;
    return acc;
  }, {});

export function useFilasLote(filaVacia, alCambiar) {
  const secuencia = useRef(1);
  const refs = useRef({});
  const [filas, setFilas] = useState(() => [{ id: 0, ...filaVacia() }]);

  const nuevaFila = () => ({ id: secuencia.current++, ...filaVacia() });

  const actualizarFila = (id, campo, valor) => {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
    alCambiar();
  };

  const agregarFila = () => {
    const fila = nuevaFila();
    setFilas((prev) => [...prev, fila]);
    alCambiar();
    requestAnimationFrame(() => refs.current[fila.id]?.focus());
  };

  const quitarFila = (id) => {
    setFilas((prev) => (prev.length === 1 ? prev : prev.filter((f) => f.id !== id)));
    delete refs.current[id];
  };

  const registrarRef = (id) => (el) => {
    refs.current[id] = el;
  };

  const reiniciar = () => setFilas([nuevaFila()]);

  return { filas, actualizarFila, agregarFila, quitarFila, registrarRef, reiniciar };
}

export function useEnvioLote() {
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [resultado, setResultado] = useState(null);
  const [confirmando, setConfirmando] = useState(false);

  const pedirConfirmacion = (validar) => {
    setTocado(true);
    setErrorEnvio("");

    const error = validar();
    if (error) {
      setErrorEnvio(error);
      return;
    }

    setConfirmando(true);
  };

  const cancelarConfirmacion = () => setConfirmando(false);

  const guardar = async ({ validar, enviar, alGuardar }) => {
    setTocado(true);
    setErrorEnvio("");

    const error = validar();
    if (error) {
      setErrorEnvio(error);
      setConfirmando(false);
      return;
    }

    setEnviando(true);
    try {
      const data = await enviar();
      setResultado(data);
      setTocado(false);
      alGuardar(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErrorEnvio(e.message);
      toast.error(e.message);
    } finally {
      setEnviando(false);
      setConfirmando(false);
    }
  };

  return {
    tocado,
    enviando,
    errorEnvio,
    resultado,
    setResultado,
    guardar,
    confirmando,
    pedirConfirmacion,
    cancelarConfirmacion,
  };
}
