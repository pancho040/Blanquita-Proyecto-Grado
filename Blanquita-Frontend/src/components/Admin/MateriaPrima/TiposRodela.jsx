import { Dato } from "@/components/Reportes/comunes";
import {
  listarTiposRodela,
  obtenerTipoRodela,
  crearTipoRodela,
  editarTipoRodela,
  cambiarEstadoTipoRodela,
} from "@/services/Rodela/TipoRodela";
import {
  PaginaTipos,
  PaginaFormularioTipo,
  BadgeStock,
  columnaEstado,
  columnaStock,
} from "./comunes";

const CONFIG = {
  subtitulo: "Tipos de rodela",
  rutaBase: "/admin/rodela",
  singular: "tipo de rodela",
  ejemploNombre: "Ej. Pallet doble rodela",
  descripcionCrear: "El tipo queda disponible para registrar lotes de rodela (pallets).",
  unidadStock: "pallets en almacén",
  idDe: (t) => t.IdTipoRodela,
  nombreDe: (t) => t.NombreTipoRodela,
  resumenEstado: (t) => `${t.CantidadEnAlmacen} pallets en almacén`,
  campos: [],
  listar: listarTiposRodela,
  obtener: obtenerTipoRodela,
  crear: crearTipoRodela,
  editar: editarTipoRodela,
  cambiarEstado: cambiarEstadoTipoRodela,
};

const COLUMNAS = [
  {
    titulo: "Nombre",
    clase: "font-semibold text-slate-900",
    valor: (t) => t.NombreTipoRodela,
  },
  { titulo: "Descripción", clase: "text-slate-600", valor: (t) => t.Descripcion ?? "-" },
  columnaStock((t) => t.CantidadEnAlmacen),
  columnaEstado,
];

export function FormularioTipoRodela({ id = null }) {
  return <PaginaFormularioTipo config={CONFIG} id={id} />;
}

export default function TiposRodela() {
  return (
    <PaginaTipos
      config={CONFIG}
      columnas={COLUMNAS}
      datosTarjeta={(t) => (
        <>
          <Dato etiqueta="Stock">{t.CantidadEnAlmacen}</Dato>
          <BadgeStock cantidad={t.CantidadEnAlmacen} tipo={t} />
        </>
      )}
    />
  );
}
