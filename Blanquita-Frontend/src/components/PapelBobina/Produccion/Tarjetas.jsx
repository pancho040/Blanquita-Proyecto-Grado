import { TarjetaProduccion } from "@/components/Produccion/comunes";
import { CANTIDAD_MINIMA_LOGS_CIERRE } from "@/constants/Values";

function EtiquetaProducto({ nombre }) {
  return (
    <span className="w-fit rounded-full bg-c4/10 px-2.5 py-0.5 text-xs font-bold text-c3">
      {nombre}
    </span>
  );
}

function LogsRegistrados({ cantidad }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Logs registrados
      </div>
      <div className="text-2xl font-extrabold tabular-nums text-slate-900">{cantidad}</div>
    </div>
  );
}

export function CardActiva({ p, onInsertar, onPausar, onFinalizar, onCambiarLinea }) {
  const faltantes = CANTIDAD_MINIMA_LOGS_CIERRE - p.CantidadLogsActual;

  return (
    <TarjetaProduccion
      produccion={p}
      encabezado={
        <>
          <div className="text-[17px] font-extrabold text-slate-900">
            {p.NombreTipoBobina}
          </div>
          <EtiquetaProducto nombre={p.NombreProducto} />
          <div className="font-mono text-sm font-bold text-c3">
            {p.CodigoBobina1} + {p.CodigoBobina2}
          </div>
        </>
      }
      acciones={[
        { tipo: "insertar", onClick: onInsertar },
        { tipo: "pausar", onClick: onPausar },
        ...(onFinalizar
          ? [{ tipo: "finalizar", onClick: onFinalizar, disabled: faltantes > 0 }]
          : []),
        ...(onCambiarLinea
          ? [{ tipo: "cambiarLinea", onClick: onCambiarLinea, disabled: faltantes > 0 }]
          : []),
      ]}
    >
      <LogsRegistrados cantidad={p.CantidadLogsActual} />
      {(onFinalizar || onCambiarLinea) && faltantes > 0 && (
        <p className="text-[12.5px] font-semibold text-slate-500">
          Faltan {faltantes} {faltantes === 1 ? "log" : "logs"} para poder{" "}
          {[onFinalizar && "finalizar", onCambiarLinea && "cambiar de línea"]
            .filter(Boolean)
            .join(" o ")}{" "}
          (mínimo {CANTIDAD_MINIMA_LOGS_CIERRE}).
        </p>
      )}
    </TarjetaProduccion>
  );
}

export function CardPausada({ p, procesando, onInsertar, onReanudar, onCancelar }) {
  return (
    <TarjetaProduccion
      produccion={p}
      pausada
      encabezado={
        <>
          <div className="font-mono text-[15px] font-extrabold text-slate-900">
            {p.CodigoBobina1} + {p.CodigoBobina2}
          </div>
          <EtiquetaProducto nombre={p.NombreProducto} />
        </>
      }
      acciones={[
        { tipo: "insertar", onClick: onInsertar },
        { tipo: "reanudar", onClick: onReanudar, disabled: procesando, procesando },
        ...(onCancelar ? [{ tipo: "cancelar", onClick: onCancelar }] : []),
      ]}
    >
      <LogsRegistrados cantidad={p.CantidadLogsActual} />
    </TarjetaProduccion>
  );
}
