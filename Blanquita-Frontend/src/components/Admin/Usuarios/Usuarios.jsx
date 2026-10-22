import { UserCog, UserPlus } from "lucide-react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import Header from "@/components/layout/Header";
import {
  TarjetaFiltros,
  BuscadorFiltro,
  SelectFiltro,
  ResultadosReporte,
  TarjetaReporte,
  PieTarjeta,
  Dato,
  BadgeEstado,
} from "@/components/Reportes/comunes";
import { useReporte } from "@/hooks/useReporte";
import { listarUsuarios } from "@/services/Usuario/Admin";
import { RolesUsuario } from "@/constants/Values";
import { EstadosUsuario } from "@/constants/Estados";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const ESTADOS_USUARIO = {
  Activo: "border-emerald-300 bg-emerald-50 text-emerald-700",
  Inactivo: "border-amber-300 bg-amber-50 text-amber-700",
  Suspendido: "border-red-300 bg-red-50 text-red-600",
};

const fechaRegistro = (fecha) => format(new Date(fecha), "d 'de' LLL, y", { locale: es });

const FILTROS_INICIALES = { Busqueda: "", IdEstadoUsuario: "", IdRol: "" };

const COLUMNAS = [
  {
    titulo: "CI",
    clase: "font-mono font-bold text-slate-900",
    valor: (u) => u.Ci,
  },
  {
    titulo: "Nombre",
    clase: "font-semibold text-slate-900",
    valor: (u) => u.NombreCompleto,
  },
  { titulo: "Rol", valor: (u) => u.NombreRol },
  { titulo: "Celular", clase: "tabular-nums", valor: (u) => u.Celular ?? "-" },
  { titulo: "Registro", clase: "tabular-nums", valor: (u) => fechaRegistro(u.FechaRegistro) },
  {
    titulo: "Estado",
    valor: (u) => <BadgeEstado estado={u.NombreEstadoUsuario} estilos={ESTADOS_USUARIO} />,
  },
];

function BotonGestionar({ usuario }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (window.location.href = `/admin/usuarios/${usuario.IdUsuario}`)}
            className="h-9 w-9 text-slate-400 hover:bg-c4/10 hover:text-c3"
          >
            <UserCog size={17} strokeWidth={2.25} />
          </Button>
        }
      />
      <TooltipContent>Gestionar usuario</TooltipContent>
    </Tooltip>
  );
}

export default function Usuarios() {
  const reporte = useReporte(listarUsuarios, FILTROS_INICIALES, ["Busqueda"]);

  return (
    <TooltipProvider>
      <Toaster richColors position="top-center" />
      <div className="contenido-con-sidebar flex min-h-screen flex-col bg-slate-50 pt-20 font-sans text-slate-900 md:pt-0">
        <Header
          volver="/admin/inicio"
          titulo="Administración"
          subtitulo="Usuarios"
          contador={
            reporte.catalogo
              ? { valor: reporte.catalogo.Total, singular: "usuario", plural: "usuarios" }
              : null
          }
          accion={{ texto: "Registrar usuario", icono: UserPlus, onClick: () => (window.location.href = "/admin/usuarios/registrar") }}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
          <TarjetaFiltros reporte={reporte}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <BuscadorFiltro
                reporte={reporte}
                campo="Busqueda"
                etiqueta="Buscar"
                placeholder="CI o nombre"
                mono={false}
              />
              <SelectFiltro
                reporte={reporte}
                campo="IdEstadoUsuario"
                etiqueta="Estado"
                opciones={EstadosUsuario}
                campoEtiqueta="NombreEstadoUsuario"
                placeholder="Todos los estados"
              />
              <SelectFiltro
                reporte={reporte}
                campo="IdRol"
                etiqueta="Rol"
                opciones={RolesUsuario}
                campoEtiqueta="NombreRol"
                placeholder="Todos los roles"
              />
            </div>
          </TarjetaFiltros>

          <ResultadosReporte
            reporte={reporte}
            elementos={reporte.catalogo?.Usuarios}
            clave={(u) => u.IdUsuario}
            nombres={["usuario", "usuarios"]}
            columnas={COLUMNAS}
            tituloAccion="Gestionar"
            anchoAccion="w-24"
            accion={(u) => (
              <div className="flex justify-center">
                <BotonGestionar usuario={u} />
              </div>
            )}
            tarjeta={(u) => (
              <TarjetaReporte
                titulo={u.NombreCompleto}
                tamanoTitulo="text-[14px] font-sans"
                subtitulo={`CI ${u.Ci} · ${u.NombreRol}`}
                estado={u.NombreEstadoUsuario}
                estilos={ESTADOS_USUARIO}
              >
                <PieTarjeta accion={<BotonGestionar usuario={u} />}>
                  <Dato etiqueta="Celular">{u.Celular ?? "-"}</Dato>
                  <Dato etiqueta="Registro">{fechaRegistro(u.FechaRegistro)}</Dato>
                </PieTarjeta>
              </TarjetaReporte>
            )}
          />
        </main>
      </div>
    </TooltipProvider>
  );
}
