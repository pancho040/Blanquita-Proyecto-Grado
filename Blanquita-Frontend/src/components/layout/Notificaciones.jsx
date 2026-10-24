import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Bell,
  CircleCheck,
  CirclePause,
  Eye,
  Factory,
  Lock,
  PackageX,
  Icon,
  RefreshCw,
  SquareStack,
  Timer,
  TriangleAlert,
  X,
} from "lucide-react";
import { toiletRoll } from "@lucide/lab";
import { cn } from "@/lib/utils";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { verNotificaciones } from "@/services/Notificacion/Notificacion";
import { PREFIJO_POR_ROL } from "@/constants/Values";
import { ESTILO_STOCK } from "@/utils/stock";
import { formatearSegundos, segundosDesde } from "@/utils/dates";
import { textoMovimientosBloqueados } from "@/utils/bloqueoProducto";

const INTERVALO_ACTUALIZACION_MS = 120000;

const RUTA_INVENTARIO_DOMINIO = {
  producto: "producto/inventario",
  bobinapapel: "bobina-papel/inventario",
  bobinaservilleta: "bobina-servilleta/inventario",
  subbobina: "bobina-servilleta/inventario",
  rodela: "rodela/inventario",
  empaquebobina: "empaque/bobina-inventario",
  empaquebolsa: "empaque/bolsa-inventario",
  bolsajava: "empaque/jaba-inventario",
  insumo: "insumos/inventario",
};

const IconoBobinaPapel = (props) => <Icon iconNode={toiletRoll} {...props} />;

const numero = (valor) => Number(valor ?? 0).toLocaleString("es-BO");

const itemBobinaPapel = (item) => ({
  id: item.IdPausaProduccionBobinaTubo ?? item.IdProduccionBobinaTubo,
  titulo: item.NombreProducto,
  subtitulo: item.NombreTipoBobina,
  codigos: `${item.CodigoBobina1} · ${item.CodigoBobina2}`,
  valor: `${numero(item.CantidadLogsActual)} logs`,
  motivo: item.MotivoPausaProduccion,
  desde: item.FechaHoraPausa ?? item.FechaInicioProduccion,
  atrasada: item.Atrasada,
  detalles: item.FechaHoraPausa ? [`Pausó ${item.Operador}`] : [`Turno ${item.NombreTurno}`, item.Operador],
});

const itemBobinaServilleta = (item) => ({
  id: item.IdPausaProduccionServilleta ?? item.IdProduccionServilleta,
  titulo: `Sub-bobina ${numero(item.MedidaMm)} mm`,
  subtitulo: item.NombreTipoBobinaServilleta,
  codigos: `Unidad ${item.CodigoUnidadOrigen}`,
  motivo: item.MotivoPausaProduccion,
  desde: item.FechaHoraPausa ?? item.FechaInicioProduccion,
  atrasada: item.Atrasada,
  detalles: item.FechaHoraPausa ? [`Pausó ${item.Operador}`] : [`Turno ${item.NombreTurno}`, item.Operador],
});

function useNotificaciones() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [actualizado, setActualizado] = useState(null);

  const recargar = async () => {
    setCargando(true);
    try {
      setDatos(await verNotificaciones());
      setActualizado(new Date());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    recargar();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") recargar();
    }, INTERVALO_ACTUALIZACION_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") recargar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  return { datos, error, cargando, actualizado, recargar };
}

function useReloj(abierto) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!abierto) return;
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(id);
  }, [abierto]);
  return ahora;
}

export const textoContador = (total) => (total > 99 ? "99+" : String(total));

function Contador({ cantidad, urgente }) {
  return (
    <span
      className={cn(
        "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold tabular-nums",
        urgente ? "bg-red-600 text-white" : "bg-c3/10 text-c3",
      )}
    >
      {textoContador(cantidad)}
    </span>
  );
}

function AvisoAtraso({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
      <TriangleAlert size={12} strokeWidth={2.5} />
      {children}
    </span>
  );
}

function Subgrupo({ titulo, icono: Icono, cantidad, vacio, children }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-slate-500">
        <Icono size={14} />
        {titulo} ({cantidad})
      </div>
      {cantidad ? <div className="flex flex-col gap-2">{children}</div> : <p className="text-[12.5px] text-slate-400">{vacio}</p>}
    </div>
  );
}

function ItemStock({ item, href, estado }) {
  const estilo = ESTILO_STOCK[estado];
  return (
    <a
      href={href}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl p-3 ring-1 transition-colors hover:bg-slate-50",
        estado === "agotado" ? "ring-slate-300" : "ring-red-200",
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-extrabold text-slate-900">{item.Nombre}</div>
        <div className="text-[12px] text-slate-500">
          {item.NombreDominio} · mínimo {numero(item.StockMinimo)}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={cn("text-[15px] font-extrabold tabular-nums", estilo.numero)}>{numero(item.CantidadActual)}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", estilo.clase)}>{estilo.texto}</span>
      </div>
    </a>
  );
}

function ItemProduccion({ href, titulo, subtitulo, codigos, valor, motivo, detalles, pausa, atrasada, aviso, ahora, desde }) {
  const tiempo = formatearSegundos(segundosDesde(desde, ahora));
  return (
    <a
      href={href}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl p-3 ring-1 transition-colors hover:bg-slate-50",
        atrasada ? "bg-red-50/40 ring-red-200" : pausa ? "ring-amber-200" : "ring-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-[13.5px] font-extrabold text-slate-900">
          {titulo}
          {subtitulo && <span className="font-semibold text-slate-500"> · {subtitulo}</span>}
        </div>
        {pausa ? (
          <div
            className={cn(
              "flex shrink-0 items-center gap-1 text-[13px] font-extrabold tabular-nums",
              atrasada ? "text-red-600" : "text-amber-600",
            )}
          >
            <CirclePause size={14} />
            {tiempo}
          </div>
        ) : (
          valor && <div className="shrink-0 text-[13px] font-extrabold tabular-nums text-c3">{valor}</div>
        )}
      </div>
      <div className="break-all font-mono text-[12px] text-slate-600">{codigos}</div>
      {pausa && <div className="text-[12.5px] text-slate-700">{motivo || "Sin motivo registrado"}</div>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
        {!pausa && (
          <span className="flex items-center gap-1">
            <Timer size={13} />
            {tiempo} en producción
          </span>
        )}
        {detalles.filter(Boolean).map((detalle) => (
          <span key={detalle}>{detalle}</span>
        ))}
        {atrasada && <AvisoAtraso>{aviso}</AvisoAtraso>}
      </div>
    </a>
  );
}

function Seccion({ valor, titulo, icono: Icono, cantidad, urgente, children }) {
  return (
    <AccordionItem value={valor} className="border-none">
      <AccordionTrigger className="items-center px-4 py-3 hover:no-underline">
        <span className="flex flex-1 items-center gap-2.5 text-[14px] font-extrabold text-slate-800">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-c4/10 text-c3">
            <Icono size={17} />
          </span>
          {titulo}
        </span>
        <span className="mr-2">
          <Contador cantidad={cantidad} urgente={urgente} />
        </span>
      </AccordionTrigger>
      <AccordionContent className="flex flex-col gap-3 px-4 pb-4">{children}</AccordionContent>
    </AccordionItem>
  );
}

function SeccionProduccion({ valor, titulo, icono, produccion, aItem, href, horasAlerta, ahora }) {
  const { Activas, Pausadas } = produccion;
  const urgente = [...Activas, ...Pausadas].some((item) => item.Atrasada);
  return (
    <Seccion valor={valor} titulo={titulo} icono={icono} cantidad={Activas.length + Pausadas.length} urgente={urgente}>
      <Subgrupo titulo="En producción" icono={Factory} cantidad={Activas.length} vacio="No hay máquinas corriendo en este momento.">
        {Activas.map((item) => {
          const datos = aItem(item);
          return <ItemProduccion key={datos.id} {...datos} href={href} ahora={ahora} aviso="Abierta desde otro día" />;
        })}
      </Subgrupo>
      <Separator />
      <Subgrupo titulo="Pausadas" icono={CirclePause} cantidad={Pausadas.length} vacio="No hay pausas abiertas.">
        {Pausadas.map((item) => {
          const datos = aItem(item);
          return (
            <ItemProduccion
              key={datos.id}
              {...datos}
              href={href}
              ahora={ahora}
              pausa
              aviso={`Pausa de más de ${horasAlerta} h`}
            />
          );
        })}
      </Subgrupo>
    </Seccion>
  );
}

function SeccionStock({ stock, prefijo }) {
  const { SinStock, Criticos } = stock;
  const cantidad = SinStock.length + Criticos.length;
  const href = (item) => `/${prefijo}/${RUTA_INVENTARIO_DOMINIO[item.Dominio]}`;
  return (
    <Seccion valor="stock" titulo="Alertas de stock" icono={PackageX} cantidad={cantidad} urgente={cantidad > 0}>
      <Subgrupo titulo="Sin stock" icono={PackageX} cantidad={SinStock.length} vacio="Nada agotado.">
        {SinStock.map((item) => (
          <ItemStock key={`${item.Dominio}-${item.Id}`} item={item} href={href(item)} estado="agotado" />
        ))}
      </Subgrupo>
      <Separator />
      <Subgrupo titulo="Stock crítico" icono={TriangleAlert} cantidad={Criticos.length} vacio="Nada en nivel crítico.">
        {Criticos.map((item) => (
          <ItemStock key={`${item.Dominio}-${item.Id}`} item={item} href={href(item)} estado="critico" />
        ))}
      </Subgrupo>
    </Seccion>
  );
}

const horaCorta = (hora) => (hora ?? "").slice(0, 5);

function SeccionModoConsulta({ modo }) {
  return (
    <Seccion valor="modo-consulta" titulo="Modo consulta" icono={Eye} cantidad={1} urgente>
      <div className="flex flex-col gap-1.5 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <div className="text-[13.5px] font-extrabold text-slate-900">
          Sistema en modo consulta de {horaCorta(modo.HoraInicio)} a {horaCorta(modo.HoraFin)}
        </div>
        <div className="text-[12.5px] text-slate-700">
          Solo se puede ver stock, catálogos y descargar reportes. Los ingresos, salidas,
          traslados, producción y acciones de administrador quedan bloqueados hasta las{" "}
          {horaCorta(modo.HoraFin)}.
        </div>
      </div>
    </Seccion>
  );
}

function SeccionBloqueo({ bloqueo, prefijo, ahora }) {
  const href = `/${prefijo}/producto/${prefijo === "encargado" ? "ajustes" : "inventario"}`;
  return (
    <Seccion valor="bloqueo" titulo="Bloqueo producto terminado" icono={Lock} cantidad={1} urgente>
      <a
        href={href}
        className="flex flex-col gap-1.5 rounded-xl bg-amber-50/60 p-3 ring-1 ring-amber-200 transition-colors hover:bg-amber-50"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-[13.5px] font-extrabold text-slate-900">
            {textoMovimientosBloqueados(bloqueo)}
          </div>
          <div className="flex shrink-0 items-center gap-1 text-[13px] font-extrabold tabular-nums text-amber-600">
            <Lock size={14} />
            {formatearSegundos(segundosDesde(bloqueo.FechaHoraBloqueo, ahora))}
          </div>
        </div>
        <div className="text-[12.5px] text-slate-700">{bloqueo.MotivoBloqueo}</div>
        <div className="text-[12px] text-slate-500">Bloqueó {bloqueo.UsuarioBloqueo}</div>
      </a>
    </Seccion>
  );
}

function Contenido({ datos, prefijo, ahora }) {
  if (datos.Total === 0) {
    return (
      <Empty className="m-4 border border-slate-200 bg-slate-50/60 p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-white text-emerald-600 ring-1 ring-slate-200">
            <CircleCheck />
          </EmptyMedia>
          <EmptyTitle className="text-[14px] font-bold text-slate-700">Todo en orden</EmptyTitle>
          <EmptyDescription className="text-[12.5px]">No hay alertas ni producciones abiertas.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const secciones = [
    datos.ModoConsulta && {
      valor: "modo-consulta",
      nodo: <SeccionModoConsulta modo={datos.ModoConsulta} />,
    },
    datos.BloqueoProductoTerminado?.Bloqueado && {
      valor: "bloqueo",
      nodo: <SeccionBloqueo bloqueo={datos.BloqueoProductoTerminado} prefijo={prefijo} ahora={ahora} />,
    },
    datos.Stock && {
      valor: "stock",
      nodo: <SeccionStock stock={datos.Stock} prefijo={prefijo} />,
    },
    {
      valor: "bobina-papel",
      nodo: (
        <SeccionProduccion
          valor="bobina-papel"
          titulo="Producción bobina papel"
          icono={IconoBobinaPapel}
          produccion={datos.BobinaPapel}
          aItem={itemBobinaPapel}
          href={`/${prefijo}/bobina-papel/produccion`}
          horasAlerta={datos.HorasAlertaPausa}
          ahora={ahora}
        />
      ),
    },
    {
      valor: "bobina-servilleta",
      nodo: (
        <SeccionProduccion
          valor="bobina-servilleta"
          titulo="Producción servilleta"
          icono={SquareStack}
          produccion={datos.BobinaServilleta}
          aItem={itemBobinaServilleta}
          href={`/${prefijo}/bobina-servilleta/produccion`}
          horasAlerta={datos.HorasAlertaPausa}
          ahora={ahora}
        />
      ),
    },
  ].filter(Boolean);

  return (
    <Accordion multiple className="py-1">
      {secciones.map((seccion, indice) => (
        <div key={seccion.valor}>
          {indice > 0 && <Separator />}
          {seccion.nodo}
        </div>
      ))}
    </Accordion>
  );
}

function useBloqueoScroll(activo) {
  useEffect(() => {
    if (!activo) return;
    const raiz = document.documentElement;
    const anterior = raiz.style.overflow;
    raiz.style.overflow = "hidden";
    return () => {
      raiz.style.overflow = anterior;
    };
  }, [activo]);
}

export default function Notificaciones({ idRol, renderBoton }) {
  const prefijo = PREFIJO_POR_ROL[idRol];
  const [abierto, setAbierto] = useState(false);
  const { datos, error, cargando, actualizado, recargar } = useNotificaciones();
  const ahora = useReloj(abierto);
  useBloqueoScroll(abierto);

  const alertasStock = datos?.Stock ? datos.Stock.SinStock.length + datos.Stock.Criticos.length : 0;
  const urgente = Boolean(
    datos &&
      (alertasStock > 0 ||
        datos.Atrasadas > 0 ||
        datos.BloqueoProductoTerminado?.Bloqueado ||
        datos.ModoConsulta),
  );

  const abrir = () => {
    setAbierto(true);
    recargar();
  };

  return (
    <>
      {renderBoton({ abrir, total: datos?.Total ?? 0, urgente })}
      <Sheet open={abierto} onOpenChange={setAbierto} modal="trap-focus">
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-[24rem] max-w-[92%] gap-0 border-l-2 border-[#A0D9EF] p-0 sm:max-w-md"
        >
          <SheetHeader className="flex-row items-center gap-3 space-y-0 border-b-2 border-[#A0D9EF] bg-[#62C1E5] px-4 py-4 text-white">
            <Bell size={22} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg font-extrabold text-white">Notificaciones</SheetTitle>
              <SheetDescription className="text-[12px] text-white/85">
                {actualizado ? `Actualizado a las ${format(actualizado, "HH:mm")}` : "Cargando…"}
              </SheetDescription>
            </div>
            <button
              type="button"
              onClick={recargar}
              disabled={cargando}
              aria-label="Actualizar notificaciones"
              className="flex items-center justify-center rounded-lg p-2 text-white hover:bg-[#20A7DB] focus-visible:bg-[#20A7DB] focus-visible:outline-none disabled:opacity-60"
            >
              <RefreshCw size={18} className={cn(cargando && "animate-spin")} />
            </button>
            <SheetClose
              aria-label="Cerrar notificaciones"
              className="flex items-center justify-center rounded-lg p-2 text-white hover:bg-[#20A7DB] focus-visible:bg-[#20A7DB] focus-visible:outline-none"
            >
              <X size={18} />
            </SheetClose>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1">
            {error && (
              <div className="m-4 rounded-xl bg-red-50 p-3 text-[12.5px] font-semibold text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            )}
            {datos ? (
              <Contenido datos={datos} prefijo={prefijo} ahora={ahora} />
            ) : (
              !error && <p className="p-4 text-[13px] text-slate-500">Cargando notificaciones…</p>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
