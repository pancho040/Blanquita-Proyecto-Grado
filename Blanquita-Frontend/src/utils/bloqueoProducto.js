export const MOVIMIENTOS_BLOQUEO = [
  { campo: "BloqueaIngreso", vista: "ingreso", texto: "Ingreso", femenino: false },
  { campo: "BloqueaCorreccion", vista: "correccion", texto: "Corrección", femenino: true },
  { campo: "BloqueaSalida", vista: "salida", texto: "Salida", femenino: true },
];

export const vistaBloqueada = (bloqueo, vista) =>
  Boolean(
    bloqueo?.Bloqueado &&
      MOVIMIENTOS_BLOQUEO.some((m) => m.vista === vista && bloqueo[m.campo]),
  );

export const textoMovimientosBloqueados = (bloqueo) => {
  const marcados = MOVIMIENTOS_BLOQUEO.filter((m) => bloqueo?.[m.campo]);
  if (marcados.length === 0) return "";
  const nombres = marcados.map((m) => m.texto.toLowerCase());
  const lista =
    nombres.length === 1
      ? nombres[0]
      : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
  const femenino = marcados.every((m) => m.femenino);
  const plural = marcados.length > 1 ? "s" : "";
  return `${lista.charAt(0).toUpperCase()}${lista.slice(1)} bloquead${femenino ? "a" : "o"}${plural}`;
};
