import { useEffect, useState } from "react";
import {
  History,
  IdCard,
  KeyRound,
  RefreshCcw,
  ShieldCheck,
  ToggleRight,
  UserCog,
  UserPen,
  UserShield,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/layout/Header";
import { BadgeEstado, Dato } from "@/components/Reportes/comunes";
import { ID_ESTADO_USUARIO_SUSPENDIDO } from "@/constants/Estados";
import { Roles } from "@/constants/Values";
import { verDetalleUsuario } from "@/services/Usuario/Admin";
import {
  AvisoPanel,
  PanelAdmin,
  PanelClave,
  PanelDatos,
  PanelEstado,
  PanelRol,
  TarjetaPanel,
} from "./PanelesUsuario";
import { PanelAccesos, PanelAccionesAdmin } from "./HistorialUsuario";

const ESTADOS_USUARIO = {
  Activo: "border-emerald-300 bg-emerald-50 text-emerald-700",
  Inactivo: "border-amber-300 bg-amber-50 text-amber-700",
  Suspendido: "border-red-300 bg-red-50 text-red-600",
};

const fechaRegistro = (fecha) => format(new Date(fecha), "d 'de' LLL, y", { locale: es });

const AVISO_SUSPENDIDO =
  "El usuario está Suspendido de forma definitiva: sus datos, clave, rol y accesos ya no pueden modificarse.";

const PESTANAS = [
  { valor: "datos", texto: "Editar", icono: UserPen, componente: PanelDatos, modifica: true },
  { valor: "clave", texto: "Contraseña", icono: KeyRound, componente: PanelClave, modifica: true },
  {
    valor: "rol",
    texto: "Rol",
    icono: IdCard,
    componente: PanelRol,
    modifica: true,
    propio: "No puedes cambiar el rol de tu propio usuario.",
    bloqueo: (u) =>
      u.IdRol === Roles.Gerente ? "El rol de un Gerente General no se puede cambiar." : null,
  },
  { valor: "accesos", texto: "Accesos", icono: History, componente: PanelAccesos },
  {
    valor: "admin",
    texto: "Admin",
    icono: ShieldCheck,
    componente: PanelAdmin,
    modifica: true,
    propio: "No puedes cambiar tu propio acceso de administrador.",
  },
  {
    valor: "estado",
    texto: "Estado",
    icono: ToggleRight,
    componente: PanelEstado,
    modifica: true,
    propio: "No puedes cambiar el estado de tu propio usuario.",
  },
  {
    valor: "acciones",
    texto: "Acciones admin",
    icono: UserShield,
    componente: PanelAccionesAdmin,
    visible: (u) => u.IsAdmin || u.AccionesAdmin > 0,
  },
];

function ResumenUsuario({ usuario }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-c4/10 text-c3">
          <UserCog size={22} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-lg font-extrabold text-slate-900">{usuario.NombreCompleto}</span>
          <span className="text-[12.5px] text-slate-500">
            CI <span className="font-mono font-bold text-slate-700">{usuario.Ci}</span> ·{" "}
            {usuario.NombreRol}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <div className="flex flex-wrap gap-1.5">
          <BadgeEstado estado={usuario.NombreEstadoUsuario} estilos={ESTADOS_USUARIO} />
          {usuario.IsAdmin && (
            <BadgeEstado estado="Administrador" estilos={{ Administrador: "border-c4/40 bg-c4/10 text-c3" }} />
          )}
          {usuario.FueAdmin && <BadgeEstado estado="Fue administrador" />}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-slate-600">
          <Dato etiqueta="Celular">{usuario.Celular ?? "-"}</Dato>
          <Dato etiqueta="Registro">{fechaRegistro(usuario.FechaRegistro)}</Dato>
        </div>
      </div>
    </section>
  );
}

function ContenidoPestana({ pestana, usuario, sesion, onActualizado }) {
  const { componente: Componente, texto, modifica, propio, bloqueo } = pestana;
  const suspendido = usuario.IdEstadoUsuario === ID_ESTADO_USUARIO_SUSPENDIDO;
  const esPropio = propio && usuario.IdUsuario === sesion?.IdUsuario;
  const aviso = modifica
    ? (suspendido && AVISO_SUSPENDIDO) || (esPropio && propio) || bloqueo?.(usuario)
    : null;

  if (aviso) {
    return (
      <TarjetaPanel titulo={texto}>
        <AvisoPanel tono={suspendido ? "alerta" : "info"}>{aviso}</AvisoPanel>
      </TarjetaPanel>
    );
  }

  return <Componente usuario={usuario} onActualizado={onActualizado} />;
}

export default function DetalleUsuario({ id, usuario: sesion }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [activa, setActiva] = useState(PESTANAS[0].valor);

  const cargar = async () => {
    setCargando(true);
    setError("");
    try {
      setUsuario(await verDetalleUsuario(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [id]);

  const alActualizar = (mensaje) => {
    toast.success(mensaje);
    cargar();
  };

  const pestanas = usuario ? PESTANAS.filter((p) => !p.visible || p.visible(usuario)) : [];
  const pestanaActiva = pestanas.some((p) => p.valor === activa) ? activa : PESTANAS[0].valor;

  return (
    <TooltipProvider>
      <Toaster richColors position="top-center" />
      <div className="contenido-con-sidebar flex min-h-screen flex-col bg-slate-50 pt-20 font-sans text-slate-900 md:pt-0">
        <Header
          volver="/admin/usuarios"
          titulo="Administración"
          subtitulo={usuario ? usuario.NombreCompleto : "Gestionar usuario"}
        />

        <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-5 px-5 py-6 sm:px-6 lg:px-8">
          {cargando && !usuario && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          )}

          {error && !usuario && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-6 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-slate-200">
              {error}
              <Button
                variant="outline"
                onClick={cargar}
                className="h-9 gap-1.5 border-red-300 font-bold text-red-600 hover:bg-red-50"
              >
                <RefreshCcw size={14} strokeWidth={2.5} />
                Reintentar
              </Button>
            </section>
          )}

          {usuario && (
            <>
              <ResumenUsuario usuario={usuario} />

              <Tabs value={pestanaActiva} onValueChange={setActiva}>
                <TabsList className="mb-3 h-11 w-full flex-nowrap">
                  {pestanas.map(({ valor, texto, icono: Icono }) => (
                    <TabsTrigger
                      key={valor}
                      value={valor}
                      aria-label={texto}
                      title={texto}
                      className="min-w-0 flex-1 gap-1.5 px-1.5 font-bold"
                    >
                      <Icono size={15} strokeWidth={2.5} />
                      <span className="hidden truncate lg:inline">{texto}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {pestanas.map((pestana) => (
                  <TabsContent key={pestana.valor} value={pestana.valor}>
                    <ContenidoPestana
                      pestana={pestana}
                      usuario={usuario}
                      sesion={sesion}
                      onActualizado={alActualizar}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}
