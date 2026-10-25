import { useEffect, useState } from "react";
import { TriangleAlert, CircleAlert, Undo2, Lock, NotebookPen, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { verResumenInventarioBobinaPapel } from "@/services/BobinaPapel/Inventario";
import {
  verProduccionBobinaTubo,
  verPausasProduccionBobinaTuboActivas,
} from "@/services/BobinaPapel/Produccion";
import {
  verResumenInventarioBobinaServilleta,
  verResumenInventarioSubBobinaServilleta,
} from "@/services/BobinaServilleta/Inventario";
import {
  verProduccionServilletaActivas,
  verPausasProduccionServilletaActivas,
} from "@/services/BobinaServilleta/Produccion";
import { verResumenInventarioRodela, listarRodelasReingresables } from "@/services/Rodela/Inventario";
import { verResumenInventarioEmpaque, listarEmpaquesReingresables } from "@/services/Empaque/EmpaqueBobina";
import { verInventarioEmpaqueBolsa } from "@/services/Empaque/EmpaqueBolsa";
import { verInventarioBolsaJava } from "@/services/Empaque/BolsaJava";
import { verInventarioProductoTerminado, verBloqueoProductoTerminado } from "@/services/Inventario/Inventario";
import { verCatalogoInsumo } from "@/services/Insumo/Insumo";
import { estadoStock } from "@/utils/stock";
import { esBloqueoPorConteo } from "@/utils/bloqueoProducto";
import { rutaAcceso } from "@/utils/areaTrabajo";
import { HORAS_ALERTA_PAUSA_ABIERTA } from "@/constants/Values";

const EN_PRODUCCION = "En Producción";
const MAXIMO_NOMBRES = 3;
const MILISEGUNDOS_HORA = 60 * 60 * 1000;

const sumar = (filas, campo) => filas.reduce((total, fila) => total + Number(fila[campo] || 0), 0);

const enAlerta = (filas, campo, niveles = ["critico", "agotado"]) =>
  filas.filter((fila) => niveles.includes(estadoStock(fila[campo], fila)));

const listaNombres = (filas, campo) => {
  const nombres = filas.map((fila) => fila[campo]);
  const extra = nombres.length - MAXIMO_NOMBRES;
  return `${nombres.slice(0, MAXIMO_NOMBRES).join(", ")}${extra > 0 ? ` y ${extra} más` : ""}`;
};

const desdeOtroDia = (fecha) => fecha && new Date(fecha).toDateString() !== new Date().toDateString();

const pausaLarga = (fecha) =>
  fecha && Date.now() - new Date(fecha).getTime() > HORAS_ALERTA_PAUSA_ABIERTA * MILISEGUNDOS_HORA;

const textoMinutos = (minutos) => `${Math.max(0, Math.floor(minutos))} min`;

function avisoStock(filas, campoCantidad, campoNombre, href) {
  const alerta = enAlerta(filas, campoCantidad);
  if (alerta.length === 0) return null;
  return {
    tono: "rojo",
    icono: TriangleAlert,
    texto: `Stock crítico o agotado: ${listaNombres(alerta, campoNombre)}`,
    href,
  };
}

function avisosProduccion(activas, pausas, href) {
  const atrasadas = activas.filter((p) => desdeOtroDia(p.FechaInicioProduccion));
  const largas = pausas.filter((p) => pausaLarga(p.FechaHoraPausa));
  return [
    atrasadas.length > 0 && {
      tono: "rojo",
      icono: CircleAlert,
      texto: `${atrasadas.length} ${atrasadas.length === 1 ? "producción abierta" : "producciones abiertas"} desde otro día`,
      href,
    },
    largas.length > 0 && {
      tono: "ambar",
      icono: Timer,
      texto: `${largas.length} ${largas.length === 1 ? "pausa" : "pausas"} de más de ${HORAS_ALERTA_PAUSA_ABIERTA} h`,
      href,
    },
  ];
}

function avisoReingreso(filas, singular, plural, href) {
  if (filas.length === 0) return null;
  const minimo = Math.min(...filas.map((f) => Number(f.MinutosRestantes ?? 0)));
  return {
    tono: "ambar",
    icono: Undo2,
    texto: `${filas.length} ${filas.length === 1 ? singular : plural} todavía se ${filas.length === 1 ? "puede" : "pueden"} revertir · el primero vence en ${textoMinutos(minimo)}`,
    href,
  };
}

const RESUMENES = {
  "bobina-papel": async (ruta) => {
    const [inventario, activas, pausas] = await Promise.all([
      verResumenInventarioBobinaPapel(),
      verProduccionBobinaTubo(),
      verPausasProduccionBobinaTuboActivas(),
    ]);
    const enProduccion = activas.filter((p) => p.NombreEstadoProduccion === EN_PRODUCCION);
    return {
      cifras: [
        { etiqueta: "Bobinas en almacén", valor: sumar(inventario, "CantidadBobinas"), href: ruta("inventario") },
        { etiqueta: "En producción", valor: enProduccion.length, href: ruta("produccion") },
        { etiqueta: "En pausa", valor: pausas.length, href: ruta("produccion"), tono: pausas.length ? "ambar" : null },
      ],
      avisos: [
        ...avisosProduccion(enProduccion, pausas, ruta("produccion")),
        avisoStock(inventario, "CantidadBobinas", "NombreTipoBobina", ruta("inventario")),
      ],
    };
  },
  "bobina-servilleta": async (ruta) => {
    const [madres, subBobinas, activas, pausas] = await Promise.all([
      verResumenInventarioBobinaServilleta(),
      verResumenInventarioSubBobinaServilleta(),
      verProduccionServilletaActivas(),
      verPausasProduccionServilletaActivas(),
    ]);
    const enProduccion = activas.filter((p) => p.NombreEstadoProduccion === EN_PRODUCCION);
    return {
      cifras: [
        { etiqueta: "Bobinas madre", valor: sumar(madres, "CantidadBobinaServilleta"), href: ruta("inventario") },
        { etiqueta: "Sub-bobinas", valor: sumar(subBobinas, "CantidadSubBobinas"), href: ruta("inventario") },
        { etiqueta: "En producción", valor: enProduccion.length, href: ruta("produccion") },
        { etiqueta: "En pausa", valor: pausas.length, href: ruta("produccion"), tono: pausas.length ? "ambar" : null },
      ],
      avisos: [
        ...avisosProduccion(enProduccion, pausas, ruta("produccion")),
        avisoStock(madres, "CantidadBobinaServilleta", "NombreTipoBobinaServilleta", ruta("inventario")),
      ],
    };
  },
  rodela: async (ruta) => {
    const [inventario, reingresables] = await Promise.all([
      verResumenInventarioRodela(),
      listarRodelasReingresables(),
    ]);
    return {
      cifras: [
        { etiqueta: "Pallets en almacén", valor: sumar(inventario, "CantidadEnAlmacen"), href: ruta("inventario") },
        { etiqueta: "En producción", valor: sumar(inventario, "CantidadAbiertas"), href: ruta("inventario") },
        {
          etiqueta: "Se pueden revertir",
          valor: reingresables.length,
          href: ruta("inventario"),
          tono: reingresables.length ? "ambar" : null,
        },
      ],
      avisos: [
        avisoReingreso(reingresables, "pallet trasladado", "pallets trasladados", ruta("inventario")),
        avisoStock(inventario, "CantidadEnAlmacen", "NombreTipoRodela", ruta("inventario")),
      ],
    };
  },
  empaque: async (ruta) => {
    const [bobinas, reingresables, bolsas, jabas] = await Promise.all([
      verResumenInventarioEmpaque(),
      listarEmpaquesReingresables(),
      verInventarioEmpaqueBolsa(),
      verInventarioBolsaJava(),
    ]);
    const bolsasBajas = enAlerta(bolsas, "CantidadActual", ["bajo", "critico", "agotado"]);
    const jabasBajas = enAlerta(jabas, "CantidadActual", ["bajo", "critico", "agotado"]);
    return {
      cifras: [
        { etiqueta: "Bobinas de empaque", valor: sumar(bobinas, "CantidadEmpaques"), href: ruta("bobina-inventario") },
        {
          etiqueta: "Se pueden reingresar",
          valor: reingresables.length,
          href: ruta("bobina-reingreso"),
          tono: reingresables.length ? "ambar" : null,
        },
        {
          etiqueta: "Bolsas con stock bajo",
          valor: bolsasBajas.length,
          href: ruta("bolsa-inventario"),
          tono: bolsasBajas.length ? "ambar" : null,
        },
        {
          etiqueta: "Jabas con stock bajo",
          valor: jabasBajas.length,
          href: ruta("jaba-inventario"),
          tono: jabasBajas.length ? "ambar" : null,
        },
      ],
      avisos: [
        avisoReingreso(reingresables, "bobina de empaque", "bobinas de empaque", ruta("bobina-reingreso")),
        avisoStock(bobinas, "CantidadEmpaques", "NombreTipoEmpaque", ruta("bobina-inventario")),
        avisoStock(bolsas, "CantidadActual", "NombreEmpaqueBolsa", ruta("bolsa-inventario")),
        avisoStock(jabas, "CantidadActual", "NombreBolsaJava", ruta("jaba-inventario")),
      ],
    };
  },
  producto: async (ruta) => {
    const [inventario, bloqueo] = await Promise.all([
      verInventarioProductoTerminado(),
      verBloqueoProductoTerminado(),
    ]);
    const conStock = inventario.filter((p) => Number(p.CantidadActual) > 0);
    const porConteo = esBloqueoPorConteo(bloqueo);
    return {
      cifras: [
        { etiqueta: "Presentaciones con stock", valor: conStock.length, href: ruta("inventario") },
        { etiqueta: "Total en almacén", valor: sumar(inventario, "CantidadActual"), href: ruta("inventario") },
      ],
      avisos: [
        bloqueo?.Bloqueado && {
          tono: "rojo",
          icono: porConteo ? NotebookPen : Lock,
          texto: porConteo
            ? `Conteo físico en curso: no se pueden registrar movimientos hasta que termine (${bloqueo.UsuarioBloqueo})`
            : `Movimientos bloqueados por ${bloqueo.UsuarioBloqueo}: ${bloqueo.MotivoBloqueo}`,
          href: ruta("movimientos"),
        },
        avisoStock(inventario, "CantidadActual", "CodigoPresentacion", ruta("inventario")),
      ],
    };
  },
  insumos: async (ruta) => {
    const insumos = await verCatalogoInsumo();
    const bajos = enAlerta(insumos, "CantidadActual", ["bajo", "critico", "agotado"]);
    return {
      cifras: [
        { etiqueta: "Tipos de insumo", valor: insumos.length, href: ruta("inventario") },
        {
          etiqueta: "Con stock bajo",
          valor: bajos.length,
          href: ruta("inventario"),
          tono: bajos.length ? "ambar" : null,
        },
      ],
      avisos: [avisoStock(insumos, "CantidadActual", "NombreInsumo", ruta("inventario"))],
    };
  },
};

const COLUMNAS_CIFRAS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

const TONO_CIFRA = {
  ambar: "text-amber-600",
};

const TONO_AVISO = {
  rojo: "bg-red-50 text-red-800 ring-red-200 hover:bg-red-100/70",
  ambar: "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100/70",
};

export function tieneResumen(idArea) {
  return Boolean(RESUMENES[idArea]);
}

export default function ResumenOperador({ area, idRol }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vigente = true;
    const subruta = (ruta) => area.subrutas.find((s) => s.ruta === ruta) ?? { ruta };
    const ruta = (rutaSub) => rutaAcceso(idRol, area, subruta(rutaSub));

    setCargando(true);
    setError(false);
    RESUMENES[area.id](ruta)
      .then((resultado) => vigente && setDatos(resultado))
      .catch(() => vigente && setError(true))
      .finally(() => vigente && setCargando(false));

    return () => {
      vigente = false;
    };
  }, [area.id, idRol]);

  if (cargando) {
    return (
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[74px] w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error || !datos) {
    return (
      <div className="mt-5 rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold text-slate-500 ring-1 ring-slate-200">
        No se pudieron cargar las cantidades de esta área.
      </div>
    );
  }

  const avisos = datos.avisos.filter(Boolean);

  return (
    <div className="mt-5 flex flex-col gap-3">
      <div className={cn("grid grid-cols-2 gap-3", COLUMNAS_CIFRAS[datos.cifras.length])}>
        {datos.cifras.map((cifra) => (
          <a
            key={cifra.etiqueta}
            href={cifra.href}
            className="flex flex-col gap-0.5 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 transition-colors hover:ring-c4"
          >
            <span
              className={cn(
                "text-2xl font-extrabold tabular-nums leading-tight text-slate-900",
                TONO_CIFRA[cifra.tono],
              )}
            >
              {cifra.valor.toLocaleString("es-BO")}
            </span>
            <span className="text-[12px] font-bold leading-tight text-slate-500">{cifra.etiqueta}</span>
          </a>
        ))}
      </div>

      {avisos.map((aviso) => {
        const Icono = aviso.icono;
        return (
          <a
            key={aviso.texto}
            href={aviso.href}
            className={cn(
              "flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold ring-1 transition-colors",
              TONO_AVISO[aviso.tono],
            )}
          >
            <Icono size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" />
            <span className="break-words">{aviso.texto}</span>
          </a>
        );
      })}
    </div>
  );
}
