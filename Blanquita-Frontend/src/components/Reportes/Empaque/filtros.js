import { endOfMonth, startOfMonth, startOfWeek, subDays, subMonths } from "date-fns";
import { aFechaISO } from "@/utils/dates";
import { obtenerTiposEmpaque } from "@/services/Empaque/EmpaqueBobina";
import { verInventarioEmpaqueBolsa } from "@/services/Empaque/EmpaqueBolsa";
import { verInventarioBolsaJava } from "@/services/Empaque/BolsaJava";

const normalizar = (campoId, campoNombre) => (lista) =>
  lista.map((t) => ({ IdTipo: t[campoId], NombreTipo: t[campoNombre] }));

export const CLASES_EMPAQUE = [
  {
    valor: "bobina",
    texto: "Empaque en bobina",
    unidad: "bobinas",
    cargarTipos: () =>
      obtenerTiposEmpaque().then(normalizar("IdTipoEmpaque", "NombreTipoEmpaque")),
  },
  {
    valor: "bolsa",
    texto: "Empaque en bolsa",
    unidad: "paquetes",
    cargarTipos: () =>
      verInventarioEmpaqueBolsa(true).then(normalizar("IdTipoEmpaqueBolsa", "NombreEmpaqueBolsa")),
  },
  {
    valor: "jaba",
    texto: "Bolsas de jaba",
    unidad: "paquetes",
    cargarTipos: () =>
      verInventarioBolsaJava(true).then(normalizar("IdTipoBolsaJava", "NombreBolsaJava")),
  },
];

export const claseEmpaque = (valor) =>
  CLASES_EMPAQUE.find((c) => c.valor === valor) ?? CLASES_EMPAQUE[0];

export const tipoEmpaque = (clase) => ({
  cargar: clase.cargarTipos,
  campo: "IdsTipo",
  campoValor: "IdTipo",
  campoEtiqueta: "NombreTipo",
  etiqueta: "Tipos",
});

export const ID_TIPO_MOVIMIENTO_INGRESO = 1;
export const ID_TIPO_MOVIMIENTO_REINGRESO = 6;

export const ATAJOS = [
  { valor: "hoy", texto: "Hoy", rango: (hoy) => ({ from: hoy, to: hoy }) },
  {
    valor: "ayer",
    texto: "Ayer",
    rango: (hoy) => {
      const ayer = subDays(hoy, 1);
      return { from: ayer, to: ayer };
    },
  },
  {
    valor: "semana",
    texto: "Esta semana",
    rango: (hoy) => ({ from: startOfWeek(hoy, { weekStartsOn: 1 }), to: hoy }),
  },
  { valor: "mes", texto: "Este mes", rango: (hoy) => ({ from: startOfMonth(hoy), to: hoy }) },
  {
    valor: "mes-anterior",
    texto: "Mes anterior",
    rango: (hoy) => {
      const mes = subMonths(hoy, 1);
      return { from: startOfMonth(mes), to: endOfMonth(mes) };
    },
  },
];

const mismoRango = (rango, otro) =>
  aFechaISO(rango?.from) === aFechaISO(otro.from) && aFechaISO(rango?.to) === aFechaISO(otro.to);

export const atajoActivo = (rango) => {
  const hoy = new Date();
  return ATAJOS.find((atajo) => mismoRango(rango, atajo.rango(hoy)))?.valor;
};
