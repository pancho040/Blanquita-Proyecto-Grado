import { useState } from "react";
import { Container, Package, ShoppingBag } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dato } from "@/components/Reportes/comunes";
import {
  listarTiposEmpaque,
  obtenerTipoEmpaque,
  crearTipoEmpaque,
  editarTipoEmpaque,
  cambiarEstadoTipoEmpaque,
} from "@/services/Empaque/TipoEmpaque";
import {
  PaginaTipos,
  PaginaFormularioTipo,
  BadgeStock,
  columnaEstado,
  columnaStock,
} from "@/components/Admin/MateriaPrima/comunes";

const RUTA_LISTA = "/admin/empaques";

export const CLASES_EMPAQUE = ["bobina", "bolsa", "jaba"];

const DATOS_CLASE = {
  bobina: {
    texto: "Bobina",
    icono: Container,
    subtitulo: "Tipos de empaque en bobina",
    singular: "tipo de empaque en bobina",
    ejemploNombre: "Ej. Luxury 24",
    unidadStock: "bobinas de empaque en almacén",
    sinDescripcion: true,
    descripcionCrear:
      "El tipo queda disponible para registrar lotes de empaque en bobina (código y peso por bobina).",
    ayuda: (
      <>
        <span className="font-bold text-slate-900">Empaque que llega en bobinas con código y peso.</span>
        <span>
          Cada presentación tiene su propio empaque (Luxury 24, EcoPack 12…). El stock se cuenta por
          bobinas en almacén.
        </span>
      </>
    ),
  },
  bolsa: {
    texto: "Bolsa",
    icono: Package,
    subtitulo: "Tipos de empaque en bolsa",
    singular: "tipo de empaque en bolsa",
    ejemploNombre: "Ej. Servilleta 200",
    unidadStock: "paquetes en almacén",
    descripcionCrear:
      "El tipo se crea con stock 0 y queda disponible para registrar lotes y salidas de empaque en bolsa.",
    ayuda: (
      <>
        <span className="font-bold text-slate-900">Empaque que se cuenta por paquetes.</span>
        <span>
          Se usa para planchas (MegaRollo, Económico) y servilletas. El stock se lleva por conteo de
          paquetes.
        </span>
      </>
    ),
  },
  jaba: {
    texto: "Jaba",
    icono: ShoppingBag,
    subtitulo: "Tipos de bolsa de jaba",
    singular: "tipo de bolsa de jaba",
    ejemploNombre: "Ej. Luxury 12",
    unidadStock: "paquetes en almacén",
    descripcionCrear:
      "El tipo se crea con stock 0 y queda disponible para registrar lotes y salidas de bolsas de jaba.",
    ayuda: (
      <>
        <span className="font-bold text-slate-900">Bolsas para armar las jabas de producto terminado.</span>
        <span>
          Anota sus medidas en la descripción (ancho plegado, fuelle, largo, gramaje). El stock se
          lleva por conteo de paquetes.
        </span>
      </>
    ),
  },
};

const configDe = (clase) => ({
  ...DATOS_CLASE[clase],
  rutaBase: `${RUTA_LISTA}?clase=${clase}`,
  rutaRegistrar: `${RUTA_LISTA}/${clase}/registrar`,
  rutaEditar: (id) => `${RUTA_LISTA}/${clase}/editar/${id}`,
  idDe: (t) => t.Id,
  nombreDe: (t) => t.Nombre,
  resumenEstado: (t) => `${t.CantidadActual} en almacén`,
  campos: [],
  listar: (filtros) => listarTiposEmpaque(clase, filtros),
  obtener: (id) => obtenerTipoEmpaque(clase, id),
  crear: (datos) => crearTipoEmpaque(clase, datos),
  editar: (id, datos) => editarTipoEmpaque(clase, id, datos),
  cambiarEstado: (id, activo, motivo) => cambiarEstadoTipoEmpaque(clase, id, activo, motivo),
});

const columnasDe = (clase) => [
  {
    titulo: "Nombre",
    clase: "font-semibold text-slate-900",
    valor: (t) =>
      DATOS_CLASE[clase].sinDescripcion ? (
        t.Nombre
      ) : (
        <div className="flex flex-col">
          <span>{t.Nombre}</span>
          <span className="text-[12px] font-normal text-slate-500">{t.Descripcion ?? "Sin descripción"}</span>
        </div>
      ),
  },
  columnaStock((t) => t.CantidadActual),
  columnaEstado,
];

const claseValida = (clase) => (CLASES_EMPAQUE.includes(clase) ? clase : "bobina");

export function FormularioTipoEmpaque({ clase, id = null }) {
  return <PaginaFormularioTipo config={configDe(claseValida(clase))} id={id} />;
}

export default function TiposEmpaque({ claseInicial }) {
  const [clase, setClase] = useState(claseValida(claseInicial));

  const cambiarClase = (nueva) => {
    setClase(nueva);
    window.history.replaceState(null, "", `${RUTA_LISTA}?clase=${nueva}`);
  };

  return (
    <PaginaTipos
      key={clase}
      config={configDe(clase)}
      columnas={columnasDe(clase)}
      datosTarjeta={(t) => (
        <>
          <Dato etiqueta="Stock">{t.CantidadActual}</Dato>
          <BadgeStock cantidad={t.CantidadActual} tipo={t} />
        </>
      )}
      barra={
        <Tabs value={clase} onValueChange={cambiarClase}>
          <TabsList className="grid w-full grid-cols-3 sm:w-[600px]">
            {CLASES_EMPAQUE.map((c) => {
              const Icono = DATOS_CLASE[c].icono;
              return (
                <TabsTrigger key={c} value={c} className="gap-1.5 font-bold">
                  <Icono size={15} strokeWidth={2.75} />
                  {DATOS_CLASE[c].texto}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      }
    />
  );
}
