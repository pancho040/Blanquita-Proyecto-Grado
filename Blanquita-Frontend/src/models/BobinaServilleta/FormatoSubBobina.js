import { nombreEstadoCatalogo } from "@/constants/Estados";
import { DetalleFormatoResponse } from "@/models/BobinaServilleta/TipoBobinaServilleta";
import { numeroONulo } from "@/utils/validators";

export const TipoAsignadoFormato = (data) => ({
  IdTipoBobinaServilleta: data.IdTipoBobinaServilleta,
  NombreTipoBobinaServilleta: data.NombreTipoBobinaServilleta,
  Activo: data.Activo
});

export const FormatoSubBobinaAdminItem = (data) => ({
  IdFormatoSubBobina: data.IdFormatoSubBobina,
  DescripcionFormato: data.DescripcionFormato,
  Activo: data.Activo,
  NombreEstado: nombreEstadoCatalogo(data.Activo),
  Detalle: (data.Detalle ?? []).map(DetalleFormatoResponse),
  Tipos: (data.Tipos ?? []).map(TipoAsignadoFormato),
  CantidadUnidades: data.CantidadUnidades
});

export const DetalleFormatoRequest = (fila) => ({
  MedidaMm: Number(fila.MedidaMm),
  Cantidad: Number(fila.Cantidad),
  StockMinimo: numeroONulo(fila.StockMinimo),
  StockPreventivo: numeroONulo(fila.StockPreventivo)
});

export const CrearFormatoSubBobinaRequest = (filas) => ({
  Detalle: filas.map(DetalleFormatoRequest)
});

export const descripcionFormato = (filas) =>
  filas
    .map(DetalleFormatoRequest)
    .filter((f) => f.MedidaMm > 0 && f.Cantidad > 0)
    .sort((a, b) => b.MedidaMm - a.MedidaMm)
    .map((f) => `${f.MedidaMm}x${f.Cantidad}`)
    .join("+");
