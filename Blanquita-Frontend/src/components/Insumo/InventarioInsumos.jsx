import { useState } from "react";
import { Package, PackagePlus, PackageMinus, Loader2 } from "lucide-react";
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
import { verCatalogoInsumo, ingresarInsumo, sacarInsumo } from "../../services/Insumo/Insumo";
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
import { descargarReporteInventarioInsumo } from "@/services/Insumo/Reporte";
import { ObservacionMovimientosInsumo } from "@/constants/OperadorConfig";
import {
  CANTIDAD_MAXIMA_INSUMO,
  MOTIVO_CORRECCION_MIN,
  MOTIVO_CORRECCION_MAX,
} from "@/constants/Values";
import { VeComoLider, EsGerente, aEntero, limpiarObservacion } from "@/utils/validators";

const MOVIMIENTOS = {
  ingreso: {
    signo: 1,
    tono: "ingreso",
    Icono: PackagePlus,
    registrar: ingresarInsumo,
    titulo: "Ingreso",
    accion: "ingresar",
    confirmacion: (cantidad, nombre) => `Se sumarán ${cantidad} de ${nombre} al almacén.`,
    exito: "Ingreso registrado",
    clases: {
      pestana: "border-emerald-500 bg-emerald-50 text-emerald-700",
      motivo: "border-emerald-400 bg-emerald-50 text-emerald-700",
      boton: "bg-emerald-600 hover:bg-emerald-700",
      cantidad: "text-emerald-700",
    },
  },
  salida: {
    signo: -1,
    tono: "correccion",
    Icono: PackageMinus,
    registrar: sacarInsumo,
    titulo: "Salida",
    accion: "sacar",
    confirmacion: (cantidad, nombre) => `Se descontarán ${cantidad} de ${nombre} del almacén.`,
    exito: "Salida registrada",
    clases: {
      pestana: "border-red-500 bg-red-50 text-red-700",
      motivo: "border-red-400 bg-red-50 text-red-700",
      boton: "bg-red-600 hover:bg-red-700",
      cantidad: "text-red-700",
    },
  },
};

const esObservacionValida = (texto) => {
  const largo = texto.trim().length;
  return largo >= MOTIVO_CORRECCION_MIN && largo <= MOTIVO_CORRECCION_MAX;
};

function SelectorMovimiento({ tipo, sinStock, inactivo, onCambio }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {Object.entries(MOVIMIENTOS).map(([clave, config]) => {
        const { Icono } = config;
        const activo = tipo === clave;
        const deshabilitado = (clave === "salida" && sinStock) || (clave === "ingreso" && inactivo);
        return (
          <button
            key={clave}
            type="button"
            onClick={() => onCambio(clave)}
            disabled={deshabilitado}
            aria-pressed={activo}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-3 text-[14px] font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              activo
                ? config.clases.pestana
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            <Icono size={17} strokeWidth={2.5} />
            {config.titulo}
          </button>
        );
      })}
    </div>
  );
}

function FormularioMovimiento({ insumo, onRegistrado }) {
  const actual = Number(insumo.CantidadActual || 0);
  const tipoInicial = insumo.Activo ? "ingreso" : "salida";
  const [tipo, setTipo] = useState(tipoInicial);
  const [cantidad, setCantidad] = useState("");
  const [observacion, setObservacion] = useState("");
  const [tocado, setTocado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const config = MOVIMIENTOS[tipo];
  const { Icono } = config;
  const maximo = config.signo < 0 ? Math.min(actual, CANTIDAD_MAXIMA_INSUMO) : CANTIDAD_MAXIMA_INSUMO;
  const cantidadNum = aEntero(cantidad);
  const observacionLimpia = observacion.trim();
  const nuevo = cantidadNum > 0 ? actual + config.signo * cantidadNum : null;

  const cambiarTipo = (clave) => {
    setTipo(clave);
    setCantidad("");
    setObservacion("");
    setTocado(false);
  };

  const limpiar = () => {
    setCantidad("");
    setObservacion("");
    setTocado(false);
  };

  const solicitarConfirmacion = () => {
    setTocado(true);
    if (cantidadNum === 0) {
      toast.error(`Ingresa la cantidad a ${config.accion}`);
      return;
    }
    if (cantidadNum > maximo) {
      toast.error(`La cantidad máxima a ${config.accion} es ${maximo}`);
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
      const respuesta = await config.registrar(insumo.IdTipoInsumo, cantidadNum, observacionLimpia);
      onRegistrado(respuesta);
      toast.success(
        `${config.exito}: ${config.signo > 0 ? "+" : "-"}${respuesta.CantidadMovimiento} ${respuesta.NombreInsumo}`,
      );
      limpiar();
      setTipo(tipoInicial);
      setConfirmando(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <SelectorMovimiento
        tipo={tipo}
        sinStock={actual === 0}
        inactivo={!insumo.Activo}
        onCambio={cambiarTipo}
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
            Cantidad a {config.accion}
          </div>
          <div className="text-[12px] font-semibold text-slate-400">Máx. {maximo}</div>
        </div>
        <ControlCantidad
          key={tipo}
          valor={cantidad}
          onChange={setCantidad}
          maximo={maximo}
          tono={config.tono}
          invalido={tocado}
          etiqueta={`Cantidad a ${config.accion}`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
          Observación
        </div>
        <div className="flex flex-wrap gap-2">
          {ObservacionMovimientosInsumo[tipo].map((m) => {
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
                    ? config.clases.motivo
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

      <ResumenStock actual={actual} nuevo={nuevo} tono={config.tono} />

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
          className={cn("h-11 gap-2 font-extrabold text-white", config.clases.boton)}
        >
          <Icono size={16} strokeWidth={2.75} />
          Registrar {config.titulo.toLowerCase()}
        </Button>
      </div>

      <Dialog open={confirmando} onOpenChange={(abierto) => !enviando && setConfirmando(abierto)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">
              Confirmar {config.titulo.toLowerCase()}
            </DialogTitle>
            <DialogDescription>
              {config.confirmacion(cantidadNum, insumo.NombreInsumo)}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[12.5px] text-slate-600">
            <span className="font-bold text-slate-500">Observación: </span>
            {observacionLimpia}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5">
            <span className="text-[13.5px] font-extrabold text-slate-900">{insumo.NombreInsumo}</span>
            <div className="text-right">
              <div className={cn("text-[15px] font-extrabold tabular-nums", config.clases.cantidad)}>
                {config.signo > 0 ? "+" : "-"}
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
              className={cn("h-11 gap-2 font-extrabold text-white", config.clases.boton)}
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

export default function InventarioInsumos({ usuario }) {
  const esEncargado = VeComoLider(usuario?.IdRol);
  const soloLectura = EsGerente(usuario?.IdRol);
  const catalogo = useCatalogo(verCatalogoInsumo);
  const [sel, setSel] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  const insumos = conAcentos(catalogo.datos, { cantidadDe: (i) => Number(i.CantidadActual || 0) });
  const filtrados = insumos.filter((i) => coincide(busqueda, i.NombreInsumo, i.DescripcionInsumo));
  const insumoSel = sel === null ? null : insumos.find((i) => i.IdTipoInsumo === sel) ?? null;

  const seleccionar = (id) => setSel((actual) => (actual === id ? null : id));

  const actualizarStock = (respuesta) => {
    catalogo.setDatos((prev) =>
      prev.map((i) =>
        i.IdTipoInsumo === respuesta.IdTipoInsumo
          ? { ...i, CantidadActual: respuesta.CantidadActual }
          : i,
      ),
    );
  };

  return (
    <TooltipProvider>
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header titulo="Almacén · Insumos" subtitulo="Inventario de Insumos">
        {esEncargado && (
          <BotonDescarga
            texto="Descargar inventario"
            ayuda="PDF con el stock actual de todos los insumos"
            exito="Informe de inventario descargado"
            descargar={() => descargarReporteInventarioInsumo(null)}
          />
        )}
      </Header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        <EncabezadoCatalogo titulo="Catálogo de insumos">
          {insumos.length} <strong className="text-slate-700">insumos registrados</strong>
        </EncabezadoCatalogo>

        <EstadoCatalogo
          cargando={catalogo.cargando}
          error={catalogo.error}
          vacio={insumos.length === 0}
          mensajeVacio="No hay insumos registrados."
          altoSkeleton="h-44"
        >
          <BuscadorNombre
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Buscar insumo por nombre..."
          />
          {filtrados.length === 0 && <SinCoincidencias busqueda={busqueda} />}
          <div className={GRID_TARJETAS}>
            {filtrados.map((i) => (
              <TarjetaTipo
                key={i.IdTipoInsumo}
                acento={i}
                activo={sel === i.IdTipoInsumo}
                inactivo={!i.Activo}
                onClick={soloLectura ? undefined : () => seleccionar(i.IdTipoInsumo)}
                icono={Package}
                claseIcono="h-7 w-7"
                grosorIcono={2.25}
                nombre={i.NombreInsumo}
                stock={i.stock}
                cantidad={Number(i.CantidadActual || 0)}
                unidad="en almacén"
                textoVer={soloLectura ? null : "Registrar movimiento"}
              >
                {i.DescripcionInsumo && (
                  <DatoTarjeta etiqueta="Descripción">{i.DescripcionInsumo}</DatoTarjeta>
                )}
              </TarjetaTipo>
            ))}
          </div>
        </EstadoCatalogo>

        {insumoSel && (
          <PanelDetalle
            acento={insumoSel}
            icono={Package}
            claseIcono="h-6 w-6"
            grosorIcono={2.25}
            titulo={insumoSel.NombreInsumo}
            subtitulo={`${Number(insumoSel.CantidadActual || 0)} en almacén`}
            onCerrar={() => setSel(null)}
          >
            <FormularioMovimiento
              key={insumoSel.IdTipoInsumo}
              insumo={insumoSel}
              onRegistrado={actualizarStock}
            />
          </PanelDetalle>
        )}
      </main>
    </div>
    </TooltipProvider>
  );
}
