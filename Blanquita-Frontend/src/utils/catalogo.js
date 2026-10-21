export const soloActivos = (cargar) => async () =>
  (await cargar()).filter((item) => item.Activo);

export const productosActivosDelTipo = (productos, idTipoBobina) =>
  productos.filter((p) => p.Activo && p.IdTipoBobina === idTipoBobina);

export const composicionFormato = (formato) =>
  (formato?.Detalle ?? []).map((d) => `${d.Cantidad} de ${d.MedidaMm}`).join(" · ");
