import { ShoppingBag, Package } from "lucide-react";
import {
  verInventarioEmpaqueBolsa,
  cargarLoteEmpaqueBolsa,
  sacarEmpaqueBolsa,
  reingresarEmpaqueBolsa,
} from "../../../services/Empaque/EmpaqueBolsa";
import {
  verInventarioBolsaJava,
  cargarLoteBolsaJava,
  sacarBolsaJava,
  reingresarBolsaJava,
} from "../../../services/Empaque/BolsaJava";
import {
  ObservacionSalidaEmpaqueBolsa,
  ObservacionReingresoEmpaque,
} from "@/constants/OperadorConfig";

export const CONFIG_BOLSAS = {
  bolsa: {
    icono: ShoppingBag,
    subtitulo: "Inventario de empaques en bolsa",
    subtituloIngreso: "Registrar ingreso de empaques en bolsa",
    catalogo: "Catálogo de empaques en bolsa",
    singular: "tipo de empaque",
    plural: "tipos de empaque",
    vacio: "No hay tipos de empaque en bolsa registrados.",
    rutaInventario: "bolsa-inventario",
    rutaIngreso: "bolsa-ingreso",
    campoId: "IdTipoEmpaqueBolsa",
    campoNombre: "NombreEmpaqueBolsa",
    campoDescripcion: "DescripcionEmpaqueBolsa",
    verInventario: verInventarioEmpaqueBolsa,
    cargarLote: (idProveedor, toneladas, items) =>
      cargarLoteEmpaqueBolsa(
        idProveedor,
        toneladas,
        items.map((i) => ({ IdTipoEmpaqueBolsa: i.IdTipo, Cantidad: i.Cantidad })),
      ),
    nombreMovimiento: (r) => r.NombreEmpaqueBolsa,
    salida: {
      observaciones: ObservacionSalidaEmpaqueBolsa.bolsa,
      enviar: sacarEmpaqueBolsa,
    },
    reingreso: {
      observaciones: ObservacionReingresoEmpaque.bolsa,
      enviar: reingresarEmpaqueBolsa,
    },
  },
  jaba: {
    icono: Package,
    subtitulo: "Inventario de bolsas de jaba",
    subtituloIngreso: "Registrar ingreso de bolsas de jaba",
    catalogo: "Catálogo de bolsas de jaba",
    singular: "tipo de bolsa de jaba",
    plural: "tipos de bolsa de jaba",
    vacio: "No hay tipos de bolsa de jaba registrados.",
    rutaInventario: "jaba-inventario",
    rutaIngreso: "jaba-ingreso",
    campoId: "IdTipoBolsaJava",
    campoNombre: "NombreBolsaJava",
    campoDescripcion: "DescripcionBolsaJava",
    verInventario: verInventarioBolsaJava,
    cargarLote: (idProveedor, toneladas, items) =>
      cargarLoteBolsaJava(
        idProveedor,
        toneladas,
        items.map((i) => ({ IdTipoBolsaJava: i.IdTipo, Cantidad: i.Cantidad })),
      ),
    nombreMovimiento: (r) => r.NombreBolsaJava,
    salida: {
      observaciones: ObservacionSalidaEmpaqueBolsa.jaba,
      enviar: sacarBolsaJava,
    },
    reingreso: {
      observaciones: ObservacionReingresoEmpaque.jaba,
      enviar: reingresarBolsaJava,
    },
  },
};
