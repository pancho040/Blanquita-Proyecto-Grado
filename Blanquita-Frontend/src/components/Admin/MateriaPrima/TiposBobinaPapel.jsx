import { Dato } from "@/components/Reportes/comunes";
import {
  DIAMETRO_MAXIMO_BOBINA_MM,
  FORMATO_MAXIMO_BOBINA_MM,
  TARA_MAXIMA_BOBINA_KG,
} from "@/constants/Values";
import {
  listarTiposBobina,
  obtenerTipoBobina,
  obtenerProductosTipoBobina,
  crearTipoBobina,
  editarTipoBobina,
  cambiarEstadoTipoBobina,
} from "@/services/BobinaPapel/TipoBobina";
import {
  PaginaTipos,
  PaginaFormularioTipo,
  BadgeStock,
  columnaEstado,
  columnaStock,
  numero,
  textoProductos,
} from "./comunes";

const CONFIG = {
  subtitulo: "Tipos de bobina papel",
  rutaBase: "/admin/bobina-papel",
  singular: "tipo de bobina papel",
  ejemploNombre: "Ej. Mezcla",
  descripcionCrear:
    "El tipo queda disponible para registrar lotes de bobina papel y producir los productos asociados.",
  unidadStock: "bobinas en almacén",
  etiquetaOtro: "bobina servilleta",
  idDe: (t) => t.IdTipoBobina,
  nombreDe: (t) => t.NombreTipoBobina,
  resumenEstado: (t) => `${t.CantidadBobinas} bobinas en almacén`,
  campos: [
    { campo: "DiametroMm", etiqueta: "Diámetro (mm)", maximo: DIAMETRO_MAXIMO_BOBINA_MM, defecto: 1210 },
    { campo: "Formato", etiqueta: "Formato (mm)", maximo: FORMATO_MAXIMO_BOBINA_MM, defecto: 2760 },
    { campo: "TaraKg", etiqueta: "Tara (kg)", maximo: TARA_MAXIMA_BOBINA_KG, defecto: 38 },
  ],
  listar: listarTiposBobina,
  obtener: obtenerTipoBobina,
  cargarProductos: obtenerProductosTipoBobina,
  crear: crearTipoBobina,
  editar: editarTipoBobina,
  cambiarEstado: cambiarEstadoTipoBobina,
};

const COLUMNAS = [
  {
    titulo: "Nombre",
    clase: "font-semibold text-slate-900",
    valor: (t) => (
      <div className="flex flex-col">
        <span>{t.NombreTipoBobina}</span>
        <span className="text-[12px] font-normal text-slate-500">{t.Descripcion ?? "Sin descripción"}</span>
      </div>
    ),
  },
  {
    titulo: "Medidas",
    clase: "text-slate-600 tabular-nums",
    valor: (t) => ` ${numero(t.DiametroMm)} · ${numero(t.Formato)} mm · tara ${numero(t.TaraKg)} kg`,
  },
  { titulo: "Productos", clase: "text-slate-600", valor: textoProductos },
  columnaStock((t) => t.CantidadBobinas),
  columnaEstado,
];

export function FormularioTipoBobinaPapel({ id = null }) {
  return <PaginaFormularioTipo config={CONFIG} id={id} />;
}

export default function TiposBobinaPapel() {
  return (
    <PaginaTipos
      config={CONFIG}
      columnas={COLUMNAS}
      datosTarjeta={(t) => (
        <>
          <Dato etiqueta="Stock">{t.CantidadBobinas}</Dato>
          <BadgeStock cantidad={t.CantidadBobinas} tipo={t} />
          <Dato etiqueta="Productos">{textoProductos(t)}</Dato>
        </>
      )}
    />
  );
}
