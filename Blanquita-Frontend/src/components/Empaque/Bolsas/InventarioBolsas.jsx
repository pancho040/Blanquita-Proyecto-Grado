import { useState } from "react";
import { PackageMinus, PackagePlus, Undo2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCatalogo } from "@/hooks/useCatalogo";
import {
  GRID_TARJETAS,
  conAcentos,
  coincide,
  TarjetaTipo,
  DatoTarjeta,
  EncabezadoCatalogo,
  EstadoCatalogo,
  PanelDetalle,
  BuscadorNombre,
  SinCoincidencias,
} from "@/components/Inventario/comunes";
import { ControlCantidad, ResumenStock } from "@/components/InventarioProductos/comunes";
import Header from "@/components/layout/Header";
import { BotonDescarga } from "@/components/layout/BotonDescarga";
import { TooltipProvider } from "@/components/ui/tooltip";
import { descargarReporteInventarioEmpaque } from "@/services/Empaque/Reporte";
import {
  CANTIDAD_MAXIMA_EMPAQUE_BOLSA,
  CANTIDAD_MAXIMA_REINGRESO_EMPAQUE,
  MOTIVO_CORRECCION_MIN,
  MOTIVO_CORRECCION_MAX,
  PREFIJO_POR_ROL,
} from "@/constants/Values";
import { EsEncargado, aEntero, limpiarObservacion } from "@/utils/validators";
import { CONFIG_BOLSAS } from "./config";

const MODOS = {
  salida: {
    etiqueta: "Paquetes a descontar",
    maximo: (actual) => Math.min(actual, CANTIDAD_MAXIMA_EMPAQUE_BOLSA),
    signo: -1,
    tono: "correccion",
    icono: PackageMinus,
    textoBoton: "Registrar salida",
    claseBoton: "bg-red-600 hover:bg-red-700",
    claseMotivo: "border-red-400 bg-red-50 text-red-700",
    claseNumero: "text-red-700",
    titulo: "Salida",
    pestana: "border-red-500 bg-red-50 text-red-700",
    tituloConfirmar: "Confirmar salida",
    descripcion: (cantidad, nombre) =>
      `Se descontarán ${cantidad} paquetes de ${nombre} del almacén.`,
    exito: "Salida registrada",
    vacio: "Ingresa la cantidad a descontar",
    requiereStock: true,
  },
  reingreso: {
    etiqueta: "Paquetes a reingresar",
    maximo: () => CANTIDAD_MAXIMA_REINGRESO_EMPAQUE,
    signo: 1,
    tono: "ingreso",
    icono: Undo2,
    textoBoton: "Registrar reingreso",
    claseBoton: "bg-emerald-600 hover:bg-emerald-700",
    claseMotivo: "border-emerald-400 bg-emerald-50 text-emerald-700",
    claseNumero: "text-emerald-700",
    titulo: "Reingreso",
    pestana: "border-emerald-500 bg-emerald-50 text-emerald-700",
    tituloConfirmar: "Confirmar reingreso",
    descripcion: (cantidad, nombre) =>
      `Se reingresarán ${cantidad} paquetes de ${nombre} al almacén.`,
    exito: "Reingreso registrado",
    vacio: "Ingresa la cantidad a reingresar",
    requiereStock: false,
  },
};

const esObservacionValida = (texto) => {
  const largo = texto.trim().length;
  return largo >= MOTIVO_CORRECCION_MIN && largo <= MOTIVO_CORRECCION_MAX;
};

function SelectorMovimiento({ modo, sinStock, onCambio }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {Object.entries(MODOS).map(([clave, ajustes]) => {
        const Icono = ajustes.icono;
        const activo = modo === clave;
        return (
          <button
            key={clave}
            type="button"
            onClick={() => onCambio(clave)}
            disabled={ajustes.requiereStock && sinStock}
            aria-pressed={activo}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-3 text-[14px] font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              activo ? ajustes.pestana : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            <Icono size={17} strokeWidth={2.5} />
            {ajustes.titulo}
          </button>
        );
      })}
    </div>
  );
}

function FormularioMovimiento({ config, item, onRegistrado }) {
  const actual = Number(item.CantidadActual || 0);
  const modoInicial = actual > 0 ? "salida" : "reingreso";
  const [modo, setModo] = useState(modoInicial);
  const ajustes = MODOS[modo];
  const Icono = ajustes.icono;
  const nombre = item[config.campoNombre];
  const observaciones = config[modo].observaciones;
  const [cantidad, setCantidad] = useState("");
  const [observacion, setObservacion] = useState("");
  const [tocado, setTocado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const maximo = ajustes.maximo(actual);
  const cantidadNum = aEntero(cantidad);
  const observacionLimpia = observacion.trim();
  const nuevo = cantidadNum > 0 ? actual + ajustes.signo * cantidadNum : null;
  const signo = ajustes.signo < 0 ? "-" : "+";

  const limpiar = () => {
    setCantidad("");
    setObservacion("");
    setTocado(false);
  };

  const cambiarModo = (clave) => {
    setModo(clave);
    limpiar();
  };

  const solicitarConfirmacion = () => {
    setTocado(true);
    if (cantidadNum === 0) {
      toast.error(ajustes.vacio);
      return;
    }
    if (cantidadNum > maximo) {
      toast.error(`La cantidad máxima es ${maximo}`);
      return;
    }
    if (!esObservacionValida(observacion)) {
      toast.error(
        `La observación debe tener entre ${MOTIVO_CORRECCION_MIN} y ${MOTIVO_CORRECCION_MAX} caracteres`,
      );
      return;
    }
    setConfirmando(true);
  };

  const confirmar = async () => {
    setEnviando(true);
    try {
      const respuesta = await config[modo].enviar(
        item[config.campoId],
        cantidadNum,
        observacionLimpia,
      );
      onRegistrado(item[config.campoId], respuesta.CantidadActual);
      toast.success(
        `${ajustes.exito}: ${signo}${respuesta.CantidadMovimiento} ${config.nombreMovimiento(respuesta)}`,
      );
      limpiar();
      setModo(respuesta.CantidadActual > 0 ? "salida" : "reingreso");
      setConfirmando(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <SelectorMovimiento modo={modo} sinStock={actual === 0} onCambio={cambiarModo} />

      {modo === "reingreso" && (
        <div className="rounded-xl bg-c1/10 px-4 py-3 text-[13px] font-medium text-c3">
          Devuelve al almacén paquetes que salieron y no se usaron, sin registrar un lote. Máximo{" "}
          {CANTIDAD_MAXIMA_REINGRESO_EMPAQUE} paquetes por movimiento.
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
            {ajustes.etiqueta}
          </div>
          <div className="text-[12px] font-semibold text-slate-400">Máx. {maximo}</div>
        </div>
        <ControlCantidad
          valor={cantidad}
          onChange={setCantidad}
          maximo={maximo}
          tono={ajustes.tono}
          invalido={tocado}
          etiqueta={ajustes.etiqueta}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
          Observación
        </div>
        <div className="flex flex-wrap gap-2">
          {observaciones.map((m) => {
            const activo = observacionLimpia === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setObservacion(m)}
                aria-pressed={activo}
                className={cn(
                  "min-h-10 rounded-xl border-2 px-3 py-1.5 text-left text-[13px] font-bold transition-colors",
                  activo
                    ? ajustes.claseMotivo
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
        <Textarea
          value={observacion}
          onChange={(e) => setObservacion(limpiarObservacion(e.target.value))}
          placeholder="Elige una opción o escribe la observación"
          maxLength={MOTIVO_CORRECCION_MAX}
          aria-label="Observación"
          className={cn(
            "min-h-20",
            tocado && !esObservacionValida(observacion) && "border-red-400 ring-1 ring-red-200",
          )}
        />
        <span className="text-xs text-slate-500">
          {observacionLimpia.length}/{MOTIVO_CORRECCION_MAX} · mínimo {MOTIVO_CORRECCION_MIN} caracteres
        </span>
      </div>

      <ResumenStock actual={actual} nuevo={nuevo} tono={ajustes.tono} />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="ghost"
          onClick={limpiar}
          className="h-11 font-bold text-slate-500 hover:text-slate-900"
        >
          Limpiar
        </Button>
        <Button
          onClick={solicitarConfirmacion}
          className={cn("h-11 gap-2 font-extrabold text-white", ajustes.claseBoton)}
        >
          <Icono size={16} strokeWidth={2.75} />
          {ajustes.textoBoton}
        </Button>
      </div>

      <Dialog open={confirmando} onOpenChange={(abierto) => !enviando && setConfirmando(abierto)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">{ajustes.tituloConfirmar}</DialogTitle>
            <DialogDescription>{ajustes.descripcion(cantidadNum, nombre)}</DialogDescription>
          </DialogHeader>

          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[12.5px] text-slate-600">
            <span className="font-bold text-slate-500">Observación: </span>
            {observacionLimpia}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5">
            <span className="text-[13.5px] font-extrabold text-slate-900">{nombre}</span>
            <div className="text-right">
              <div className={cn("text-[15px] font-extrabold tabular-nums", ajustes.claseNumero)}>
                {signo}
                {cantidadNum}
              </div>
              <div className="text-[11.5px] tabular-nums text-slate-400">
                {actual} → {nuevo ?? actual}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmando(false)}
              disabled={enviando}
              className="h-11 font-bold text-slate-500 hover:text-slate-900"
            >
              Volver
            </Button>
            <Button
              onClick={confirmar}
              disabled={enviando}
              className={cn("h-11 gap-2 font-extrabold text-white", ajustes.claseBoton)}
            >
              {enviando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <Icono size={16} strokeWidth={2.75} />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InventarioBolsas({ tipo, usuario }) {
  const config = CONFIG_BOLSAS[tipo];
  const catalogo = useCatalogo(config.verInventario);
  const [sel, setSel] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  const items = conAcentos(catalogo.datos, { cantidadDe: (i) => Number(i.CantidadActual || 0) });
  const filtrados = items.filter((i) =>
    coincide(busqueda, i[config.campoNombre], i[config.campoDescripcion]),
  );
  const itemSel = sel === null ? null : items.find((i) => i[config.campoId] === sel) ?? null;

  const seleccionar = (id) => setSel((actual) => (actual === id ? null : id));

  const actualizarStock = (id, cantidadActual) => {
    catalogo.setDatos((prev) =>
      prev.map((i) => (i[config.campoId] === id ? { ...i, CantidadActual: cantidadActual } : i)),
    );
  };

  const esEncargado = EsEncargado(usuario.IdRol);

  const accion = esEncargado
    ? {
        texto: "Registrar ingreso",
        icono: PackagePlus,
        href: `/${PREFIJO_POR_ROL[usuario.IdRol]}/empaque/${config.rutaIngreso}`,
      }
    : null;

  return (
    <TooltipProvider>
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header titulo="Almacén · Empaque" subtitulo={config.subtitulo} accion={accion}>
        {esEncargado && (
          <BotonDescarga
            texto="Descargar inventario"
            ayuda={`PDF con el stock actual de todos los ${config.plural}`}
            exito="Informe de inventario descargado"
            descargar={() => descargarReporteInventarioEmpaque(tipo)}
          />
        )}
      </Header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        <EncabezadoCatalogo titulo={config.catalogo}>
          {items.length}{" "}
          <strong className="text-slate-700">{items.length === 1 ? config.singular : config.plural}</strong>
        </EncabezadoCatalogo>

        <EstadoCatalogo
          cargando={catalogo.cargando}
          error={catalogo.error}
          vacio={items.length === 0}
          mensajeVacio={config.vacio}
          altoSkeleton="h-44"
        >
          <BuscadorNombre
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder={`Buscar ${config.singular} por nombre...`}
          />
          {filtrados.length === 0 && <SinCoincidencias busqueda={busqueda} />}
          <div className={GRID_TARJETAS}>
            {filtrados.map((i) => (
              <TarjetaTipo
                key={i[config.campoId]}
                acento={i}
                activo={sel === i[config.campoId]}
                inactivo={!i.Activo}
                onClick={() => seleccionar(i[config.campoId])}
                icono={config.icono}
                claseIcono="h-7 w-7"
                grosorIcono={2.25}
                nombre={i[config.campoNombre]}
                stock={i.stock}
                cantidad={Number(i.CantidadActual || 0)}
                unidad="paquetes en almacén"
                textoVer="Registrar movimiento"
              >
                {i[config.campoDescripcion] && (
                  <DatoTarjeta etiqueta="Descripción">{i[config.campoDescripcion]}</DatoTarjeta>
                )}
              </TarjetaTipo>
            ))}
          </div>
        </EstadoCatalogo>

        {itemSel && (
          <PanelDetalle
            acento={itemSel}
            icono={config.icono}
            claseIcono="h-6 w-6"
            grosorIcono={2.25}
            titulo={itemSel[config.campoNombre]}
            subtitulo={`${Number(itemSel.CantidadActual || 0)} paquetes en almacén`}
            onCerrar={() => setSel(null)}
          >
            <FormularioMovimiento
              key={itemSel[config.campoId]}
              config={config}
              item={itemSel}
              onRegistrado={actualizarStock}
            />
          </PanelDetalle>
        )}
      </main>
    </div>
    </TooltipProvider>
  );
}
