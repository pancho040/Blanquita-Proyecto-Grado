import { Boxes, Factory, 
          PackagePlus,Home,CircleUserRound ,Combine, Undo2} from "lucide-react";

export function unirRutas(...segmentos) {
  const limpios = segmentos
    .filter((s) => typeof s === "string" && s.trim() !== "")
    .map((s) => s.replace(/^\/+|\/+$/g, ""))
    .filter((s) => s !== "");
  return "/" + limpios.join("/");
}

export const BottomBarOpciones = [
  {
    id: 1,
    opciones: [
      {
        titulo: "Inventario",
        icono: Boxes,
        ruta: "inventario",
      },
      {
        titulo: "Produccion",
        icono: Factory,
        ruta: "produccion",
      },
    ],
  },
  {
    id: 2,
    opciones: [
      {
        titulo: "Inventario",
        icono: Boxes,
        ruta: "inventario",
      },
      {
        titulo: "Ingreso",
        icono: PackagePlus,
        ruta: "ingreso",
      },
    ],
  },
  {
    id: 3,
    opciones: [
      {
        titulo: "Inventario",
        icono: Boxes,
        ruta: "bobina-inventario",
      },
      {
        titulo: "Reingreso",
        icono: Undo2,
        ruta: "bobina-reingreso",
      },
    ],
  },
  {
    id:4,
    opciones: [
      {
        titulo: "Inicio",
        icono: Home,
        ruta: "inicio",
      },
      
      {
        titulo: "Perfil",
        icono: CircleUserRound,
        ruta: "perfil",
      },
    ],
  },
  {
    id:5,
    opciones: [
      {
        titulo: "Inventario",
        icono: Boxes,
        ruta: "inventario",
      },
      {
        titulo: "Movimientos",
        icono: Combine,
        ruta: "movimientos",
      },
    ],
  },
  {
    id: 6,
    opciones: [
      {
        titulo: "Inventario",
        icono: Boxes,
        ruta: "bolsa-inventario",
      },
      {
        titulo: "Ingreso",
        icono: PackagePlus,
        ruta: "bolsa-ingreso",
      }
    ],
  },
  {
    id: 7,
    opciones: [
      {
        titulo: "Inventario",
        icono: Boxes,
        ruta: "jaba-inventario",
      },
      {
        titulo: "Ingreso",
        icono: PackagePlus,
        ruta: "jaba-ingreso",
      }
    ],
  },
  {
    id: 8,
    opciones: [
      {
        titulo: "Inventario",
        icono: Boxes,
        ruta: "bobina-inventario",
      },
      {
        titulo: "Ingreso",
        icono: PackagePlus,
        ruta: "bobina-ingreso",
      },
    ],
  }
];

export function resolverOpcionesConjunto(idConjunto, rutaBase, subRuta) {
  const conjunto = BottomBarOpciones.find((c) => c.id === idConjunto);

  if (!conjunto) {
    console.error("resolverOpcionesConjunto: idConjunto no válido ->", idConjunto);
    return [];
  }

  return conjunto.opciones.map((opcion) => ({
    ...opcion,
    ruta: unirRutas(rutaBase, subRuta, opcion.ruta),
  }));
}
