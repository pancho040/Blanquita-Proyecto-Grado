import InicioOperador from "@/components/Usuario/InicioOperador";
import InicioBobinaPapel from "@/components/Inicio/BobinaPapel";
import InicioBobinaServilleta from "@/components/Inicio/BobinaServilleta";
import InicioRodela from "@/components/Inicio/Rodela";
import InicioEmpaque from "@/components/Inicio/Empaque";
import InicioProductoTerminado from "@/components/Inicio/ProductoTerminado";
import InicioInsumo from "@/components/Inicio/Insumo";

const PANELES = {
  "bobina-papel": InicioBobinaPapel,
  "bobina-servilleta": InicioBobinaServilleta,
  rodela: InicioRodela,
  empaque: InicioEmpaque,
  producto: InicioProductoTerminado,
  insumos: InicioInsumo,
};

export default function InicioEncargado({ usuario }) {
  return <InicioOperador usuario={usuario} paneles={PANELES} />;
}
