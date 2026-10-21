import {
  Plus,
  Pause,
  Play,
  Ban,
  CheckCircle2,
  Clock,
  Layers,
  Loader2,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dateFormatter } from "@/utils/dates";

const GRID = "grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3";
const VACIO = "rounded-2xl bg-white p-10 text-center text-sm text-slate-400 ring-1 ring-slate-200";

export function ResumenProduccion({ titulo, produccion }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
      <span className="font-mono font-bold text-slate-900">{titulo}</span>
      {(produccion.FechaHoraPausa || produccion.FechaInicioProduccion) && (
        <span className="flex items-center gap-1 text-[12px] text-slate-500">
          <Clock size={12} strokeWidth={2.75} />
          {produccion.FechaHoraPausa
            ? `Pausada: ${dateFormatter(produccion.FechaHoraPausa)}`
            : `Inicio: ${dateFormatter(produccion.FechaInicioProduccion)}`}
        </span>
      )}
    </div>
  );
}

const ACCIONES = {
  insertar: {
    texto: "Insertar",
    icono: Plus,
    variant: "default",
    clase: "bg-gradient-to-r from-c3 to-c4 font-bold hover:opacity-90",
  },
  pausar: {
    texto: "Pausar",
    icono: Pause,
    variant: "outline",
    clase: "border-amber-300 font-bold text-amber-600 hover:bg-amber-50",
  },
  finalizar: {
    texto: "Finalizar",
    icono: CheckCircle2,
    variant: "outline",
    clase: "border-emerald-300 font-bold text-emerald-600 hover:bg-emerald-50",
  },
  reanudar: {
    texto: "Reanudar",
    icono: Play,
    variant: "outline",
    clase: "border-c3/30 font-bold text-c3 hover:bg-c4/8",
  },
  cancelar: {
    texto: "Cancelar",
    icono: Ban,
    variant: "outline",
    clase: "border-red-300 font-bold text-red-600 hover:bg-red-50",
  },
  cambiarLinea: {
    texto: "Cambiar línea",
    icono: ArrowLeftRight,
    variant: "outline",
    clase: "border-c3/30 font-bold text-c3 hover:bg-c4/8",
  },
};

export function TarjetaProduccion({
  produccion,
  pausada = false,
  encabezado,
  children,
  acciones,
}) {
  const disponibles = acciones.filter((accion) => accion.onClick);
  const ancho = disponibles.length >= 3 ? "basis-[30%]" : "basis-[45%]";

  return (
    <div
      className={cn(
        "flex flex-col gap-3.5 rounded-2xl border-2 bg-white p-5 shadow-sm",
        pausada ? "border-amber-200" : "border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">{encabezado}</div>
        <Badge
          className={cn(
            "border-0 font-bold",
            pausada ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700",
          )}
        >
          {produccion.NombreEstadoProduccion}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] text-slate-600">
        {pausada ? (
          <span className="flex items-center gap-1">
            <Pause size={13} strokeWidth={2.75} />
            Pausada: {dateFormatter(produccion.FechaHoraPausa)}
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1">
              <Clock size={13} strokeWidth={2.75} />
              {dateFormatter(produccion.FechaInicioProduccion)}
            </span>
            <span>Turno: {produccion.NombreTurno}</span>
          </>
        )}
      </div>

      {children}

      {disponibles.length > 0 && (
        <div className="flex flex-wrap items-center justify-around gap-2">
          {disponibles.map(({ tipo, onClick, disabled = false, procesando = false }) => {
            const { texto, icono: Icono, variant, clase } = ACCIONES[tipo];
            return (
              <Button
                key={tipo}
                onClick={onClick}
                disabled={disabled}
                variant={variant}
                className={cn("h-11 min-w-[100px] flex-1 justify-center gap-1.5", ancho, clase)}
              >
                {procesando ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <>
                    <Icono size={15} strokeWidth={2.75} />
                    {texto}
                  </>
                )}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TabsProduccion({
  vista,
  onCambio,
  totalActivas,
  totalPausadas,
  mostrarConcluidas = false,
  totalConcluidas = 0,
}) {
  return (
    <Tabs value={vista} onValueChange={onCambio} className="mb-5">
      <TabsList
        className={cn(
          "grid w-full",
          mostrarConcluidas ? "grid-cols-3 sm:w-[30rem]" : "grid-cols-2 sm:w-80",
        )}
      >
        <TabsTrigger value="activas" className="gap-1.5 font-bold">
          <Layers size={15} strokeWidth={2.75} />
          Activas
          {totalActivas > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 justify-center px-1.5">
              {totalActivas}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="pausadas" className="gap-1.5 font-bold">
          <Pause size={15} strokeWidth={2.75} />
          Pausadas
          {totalPausadas > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 justify-center px-1.5">
              {totalPausadas}
            </Badge>
          )}
        </TabsTrigger>
        {mostrarConcluidas && (
          <TabsTrigger value="concluidas" className="gap-1.5 font-bold">
            <CheckCircle2 size={15} strokeWidth={2.75} />
            Concluidas
            {totalConcluidas > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 justify-center px-1.5">
                {totalConcluidas}
              </Badge>
            )}
          </TabsTrigger>
        )}
      </TabsList>
    </Tabs>
  );
}

export function ListaProducciones({
  lista,
  elementos = lista.datos,
  altoSkeleton,
  mensajeVacio,
  mensajeSinCoincidencias,
  renderizar,
}) {
  if (lista.cargando) {
    return (
      <div className={GRID}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className={cn(altoSkeleton, "rounded-2xl")} />
        ))}
      </div>
    );
  }

  if (lista.error) {
    return (
      <div className="rounded-xl bg-red-50 p-5 text-center text-sm font-semibold text-red-600">
        {lista.error}
      </div>
    );
  }

  if (lista.datos.length === 0) {
    return <div className={VACIO}>{mensajeVacio}</div>;
  }

  if (elementos.length === 0) {
    return <div className={VACIO}>{mensajeSinCoincidencias}</div>;
  }

  return <div className={GRID}>{elementos.map(renderizar)}</div>;
}
