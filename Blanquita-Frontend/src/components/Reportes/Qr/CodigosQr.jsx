import { Icon, ShelvingUnit, SquareStack, Database, Container, Package } from "lucide-react";
import { toiletRoll } from "@lucide/lab";
import { PaginaReporte } from "@/components/Reportes/PaginaReporte";
import { TarjetaQr } from "./TarjetaQr";

const IconoBobinaPapel = (props) => <Icon iconNode={toiletRoll} {...props} />;

const SECCIONES = [
  {
    titulo: "Bobina Papel",
    Icono: IconoBobinaPapel,
    carteles: [
      {
        titulo: "Inventario",
        descripcion: "Abre el inventario de bobinas de papel",
        ruta: "bobina-papel/inventario",
      },
      {
        titulo: "Producción",
        descripcion: "Abre la producción de bobinas de papel",
        ruta: "bobina-papel/produccion",
      },
    ],
  },
  {
    titulo: "Bobina Servilleta",
    Icono: SquareStack,
    carteles: [
      {
        titulo: "Inventario",
        descripcion: "Abre el inventario de bobinas de servilleta",
        ruta: "bobina-servilleta/inventario",
      },
      {
        titulo: "Producción",
        descripcion: "Abre la producción de bobinas de servilleta",
        ruta: "bobina-servilleta/produccion",
      },
    ],
  },
  {
    titulo: "Producto Terminado",
    Icono: ShelvingUnit,
    carteles: [
      {
        titulo: "Inventario",
        descripcion: "Abre el inventario de producto terminado",
        ruta: "producto/inventario",
      },
      {
        titulo: "Movimientos",
        descripcion: "Abre los movimientos de producto terminado",
        ruta: "producto/movimientos",
      },
    ],
  },
  {
    titulo: "Rodela",
    Icono: Database,
    carteles: [
      {
        titulo: "Inventario",
        descripcion: "Abre el inventario de rodelas",
        ruta: "rodela/inventario",
      },
      {
        titulo: "Producción",
        descripcion: "Abre las rodelas en producción",
        ruta: "rodela/produccion",
      },
    ],
  },
  {
    titulo: "Empaque",
    Icono: Container,
    carteles: [
      {
        titulo: "Bobina",
        descripcion: "Abre el inventario de empaque en bobina",
        ruta: "empaque/bobina-inventario",
      },
      {
        titulo: "Bolsa",
        descripcion: "Abre el inventario de empaque en bolsa",
        ruta: "empaque/bolsa-inventario",
      },
      {
        titulo: "Bolsa de jaba",
        descripcion: "Abre el inventario de bolsas de jaba",
        ruta: "empaque/jaba-inventario",
      },
    ],
  },
  {
    titulo: "Insumos",
    Icono: Package,
    carteles: [
      {
        titulo: "Inventario",
        descripcion: "Abre el inventario de insumos",
        ruta: "insumos/inventario",
      },
    ],
  },
];

export default function CodigosQr({ usuario }) {
  return (
    <PaginaReporte usuario={usuario} titulo="Reportes" subtitulo="Códigos QR">
      <p className="mb-6 text-sm text-slate-500">
        Imprime cada cartel y colócalo en su área de la planta. Al escanearlo desde la
        aplicación se abre esa vista directamente.
      </p>

      {SECCIONES.map(({ titulo, Icono, carteles }) => (
        <section key={titulo} className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Icono size={18} className="text-c3" />
            <h2 className="text-base font-extrabold text-slate-900">{titulo}</h2>
          </div>

          <div className="flex flex-wrap gap-5">
            {carteles.map((cartel) => (
              <TarjetaQr key={cartel.ruta} {...cartel} />
            ))}
          </div>
        </section>
      ))}
    </PaginaReporte>
  );
}
