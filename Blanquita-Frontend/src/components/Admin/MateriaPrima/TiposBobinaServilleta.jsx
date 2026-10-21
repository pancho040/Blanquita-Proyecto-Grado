import { Scissors, SquareStack } from "lucide-react";
import { Dato } from "@/components/Reportes/comunes";
import {
  DIAMETRO_MAXIMO_BOBINA_MM,
  RESISTENCIA_MAXIMA_BOBINA_KGF,
  CANTIDAD_MAXIMA_UNIDADES_BOBINA_SERVILLETA,
} from "@/constants/Values";
import {
  listarTiposBobinaServilleta,
  obtenerTipoBobinaServilleta,
  obtenerFormatosTipoBobinaServilleta,
  obtenerProductosTipoBobinaServilleta,
  crearTipoBobinaServilleta,
  editarTipoBobinaServilleta,
  cambiarEstadoTipoBobinaServilleta,
} from "@/services/BobinaServilleta/TipoBobinaServilleta";
import {
  PaginaTipos,
  PaginaFormularioTipo,
  BadgeStock,
  columnaEstado,
  columnaStock,
  numero,
  textoProductos,
} from "./comunes";
import FormatosSubBobina from "./FormatosSubBobina";

export { FormularioFormatoSubBobina } from "./FormatosSubBobina";

const textoFormatos = (t) =>
  t.Formatos.length ? t.Formatos.map((f) => f.DescripcionFormato).join(", ") : "Sin formatos";

const CONFIG = {
  subtitulo: "Tipos de bobina servilleta",
  rutaBase: "/admin/bobina-servilleta",
  textoPestana: "Tipos de servilleta",
  iconoPestana: SquareStack,
  ayuda: (
    <>
      <span className="font-bold text-slate-900">Cada tipo es una bobina madre que llega del proveedor.</span>
      <span>
        Define sus características, cuántas unidades trae y qué formatos de corte se pueden elegir al
        registrar un lote. Si necesitas un corte nuevo, créalo primero en la pestaña Formatos de corte.
      </span>
    </>
  ),
  singular: "tipo de bobina servilleta",
  ejemploNombre: "Ej. G-18 CR-14%",
  descripcionCrear:
    "El tipo queda disponible para registrar lotes de bobina servilleta con los formatos elegidos.",
  unidadStock: "bobinas madre en almacén",
  etiquetaOtro: "bobina papel",
  idDe: (t) => t.IdTipoBobinaServilleta,
  nombreDe: (t) => t.NombreTipoBobinaServilleta,
  resumenEstado: (t) => `${t.CantidadBobinas} bobinas en almacén`,
  campos: [
    { campo: "DiametroMm", etiqueta: "Diámetro (mm)", maximo: DIAMETRO_MAXIMO_BOBINA_MM, defecto: 1210 },
    { campo: "CrepadoPorcentaje", etiqueta: "Crepado (%)", maximo: 100, minimo: 0, defecto: 14 },
    {
      campo: "ResistenciaKgf",
      etiqueta: "Resistencia (kgf)",
      maximo: RESISTENCIA_MAXIMA_BOBINA_KGF,
      defecto: 1.35,
    },
    {
      campo: "CantidadUnidades",
      etiqueta: "Unidades por bobina",
      maximo: CANTIDAD_MAXIMA_UNIDADES_BOBINA_SERVILLETA,
      entero: true,
      defecto: 2,
    },
  ],
  listar: listarTiposBobinaServilleta,
  obtener: obtenerTipoBobinaServilleta,
  cargarProductos: obtenerProductosTipoBobinaServilleta,
  cargarFormatos: obtenerFormatosTipoBobinaServilleta,
  crear: crearTipoBobinaServilleta,
  editar: editarTipoBobinaServilleta,
  cambiarEstado: cambiarEstadoTipoBobinaServilleta,
};

const COLUMNAS = [
  {
    titulo: "Nombre",
    clase: "font-semibold text-slate-900",
    valor: (t) => (
      <div className="flex flex-col">
        <span>{t.NombreTipoBobinaServilleta}</span>
        <span className="text-[12px] font-normal text-slate-500">{t.Descripcion ?? "Sin descripción"}</span>
      </div>
    ),
  },
  {
    titulo: "Características",
    clase: "text-slate-600 tabular-nums",
    valor: (t) =>
      ` ${numero(t.DiametroMm)} mm · crepado ${numero(t.CrepadoPorcentaje)}% · ${numero(t.ResistenciaKgf)} kgf · ${t.CantidadUnidades} unidades`,
  },
  { titulo: "Formatos", clase: "text-slate-600", valor: textoFormatos },
  { titulo: "Productos", clase: "text-slate-600", valor: textoProductos },
  columnaStock((t) => t.CantidadBobinas),
  columnaEstado,
];

const PESTANAS = [
  {
    id: "formatos",
    texto: "Formatos de corte",
    icono: Scissors,
    subtitulo: "Formatos de corte de servilleta",
    textoRegistrar: "Registrar formato",
    rutaRegistrar: "/admin/bobina-servilleta/formatos/registrar",
    ayuda: (
      <>
        <span className="font-bold text-slate-900">
          Un formato indica cuántas sub-bobinas de cada medida salen de una unidad al abrirla.
        </span>
        <span>
          1. Registra el formato con sus medidas. 2. En la pestaña Tipos de servilleta, edita el tipo y
          márcalo en Formatos permitidos. Los formatos no se editan: si el corte cambia, crea uno nuevo
          y desactiva el anterior.
        </span>
      </>
    ),
    render: (props) => <FormatosSubBobina {...props} />,
  },
];

export function FormularioTipoBobinaServilleta({ id = null }) {
  return <PaginaFormularioTipo config={CONFIG} id={id} />;
}

export default function TiposBobinaServilleta({ pestanaInicial }) {
  return (
    <PaginaTipos
      config={CONFIG}
      columnas={COLUMNAS}
      datosTarjeta={(t) => (
        <>
          <Dato etiqueta="Stock">{t.CantidadBobinas}</Dato>
          <BadgeStock cantidad={t.CantidadBobinas} tipo={t} />
          <Dato etiqueta="Formatos">{textoFormatos(t)}</Dato>
          <Dato etiqueta="Productos">{textoProductos(t)}</Dato>
        </>
      )}
      pestanas={PESTANAS}
      pestanaInicial={pestanaInicial}
    />
  );
}
