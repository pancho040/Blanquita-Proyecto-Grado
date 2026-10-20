import { useEffect, useState } from "react";
import { BellRing, Factory, Lock, Plus, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BadgeEstado, Dato } from "@/components/Reportes/comunes";
import { BotonEnviar, ErrorDialogo, ETIQUETA } from "@/components/Admin/Usuarios/Dialogos";
import { CasillaConfirmacion } from "@/components/Admin/CasillaConfirmacion";
import { DialogoUmbralStock } from "@/components/Admin/DialogoUmbralStock";
import {
  BadgeStock,
  BotonAccion,
  DialogoCambiarEstadoTipo,
  ESTILOS_ESTADO_TIPO,
  Indicacion,
  NombreFijo,
  PaginaFormulario,
  PaginaTipos,
  Seccion,
  columnaEstado,
  textoUmbral,
} from "@/components/Admin/MateriaPrima/comunes";
import { origenDe, textoContenido, textoOrigen } from "@/models/Producto/LineaProducto";
import {
  cambiarEstadoLineaProducto,
  cambiarEstadoPresentacionProducto,
  editarLineaProducto,
  listarLineasProducto,
  obtenerLineaProducto,
  obtenerTiposOrigenLinea,
} from "@/services/Producto/LineaProducto";
import { tomarMensaje } from "@/utils/mensajeFlash";
import {
  FormularioLineaProducto,
  FormularioPresentacion,
  RUTA_PRODUCTOS,
  SelectorOrigen,
  unidadStock,
} from "./FormularioLineaProducto";

export { FormularioLineaProducto, FormularioPresentacion };

const DOMINIO_PRODUCTO = "producto";

const presentacionesActivas = (l) => l.Presentaciones.filter((p) => p.Activo).length;

const CONFIG = {
  subtitulo: "Líneas de producto",
  rutaBase: RUTA_PRODUCTOS,
  singular: "línea de producto",
  nombres: ["línea", "líneas"],
  textoRegistrar: "Registrar línea",
  placeholderBusqueda: "Nombre, siglas o código",
  ayuda: (
    <>
      <span className="font-bold text-slate-900">
        Cada línea agrupa sus presentaciones y se asocia a la materia prima con la que se produce.
      </span>
      <span>
        Una línea o presentación inactiva no se ofrece en producción ni en el ingreso de producto
        terminado; su stock se sigue mostrando y puede salir por despachos.
      </span>
    </>
  ),
  idDe: (l) => l.IdProducto,
  nombreDe: (l) => l.NombreProducto,
  subtituloDe: (l) => `${l.SiglasProducto} · ${textoOrigen(l)}`,
  resumenEstado: (l) =>
    `${presentacionesActivas(l)} de ${l.Presentaciones.length} presentaciones activas${
      l.EnProduccion ? " · en producción" : ""
    }`,
  descripcionEstado:
    "Una línea inactiva no se ofrece al iniciar producción ni en el ingreso de producto terminado. No se puede desactivar con una producción en curso o en pausa, ni si es el único producto activo de un tipo de bobina papel.",
  listar: listarLineasProducto,
  cambiarEstado: cambiarEstadoLineaProducto,
};

const CONFIG_ESTADO_PRESENTACION = {
  idDe: (p) => p.IdPresentacion,
  nombreDe: (p) => p.CodigoPresentacion,
  resumenEstado: (p) => `${textoContenido(p)} · ${p.CantidadActual} ${unidadStock(p.TipoContenedor)} en stock`,
  descripcionEstado:
    "Una presentación inactiva no se ofrece en el ingreso de producto terminado. El stock que queda sigue en el inventario y puede salir por despachos.",
  cambiarEstado: cambiarEstadoPresentacionProducto,
};

function CodigosPresentacion({ linea }) {
  if (!linea.Presentaciones.length)
    return <span className="text-[12.5px] text-slate-400">Sin presentaciones</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {linea.Presentaciones.map((p) => (
        <span
          key={p.IdPresentacion}
          className={cn(
            "rounded-md px-1.5 py-0.5 font-mono text-[11.5px] font-bold",
            p.Activo ? "bg-c4/10 text-c3" : "bg-slate-100 text-slate-400 line-through",
          )}
        >
          {p.CodigoPresentacion}
        </span>
      ))}
    </div>
  );
}

const COLUMNAS = [
  {
    titulo: "Línea",
    clase: "font-semibold text-slate-900",
    valor: (l) => (
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-slate-900 px-1.5 py-0.5 font-mono text-[11.5px] font-bold text-white">
          {l.SiglasProducto}
        </span>
        <span>{l.NombreProducto}</span>
      </div>
    ),
  },
  { titulo: "Materia prima", clase: "text-slate-600", valor: textoOrigen },
  { titulo: "Presentaciones", valor: (l) => <CodigosPresentacion linea={l} /> },
  columnaEstado,
];

export default function LineasProducto() {
  return (
    <PaginaTipos
      config={CONFIG}
      columnas={COLUMNAS}
      datosTarjeta={(l) => (
        <>
          <Dato etiqueta="Activas">
            {presentacionesActivas(l)}/{l.Presentaciones.length}
          </Dato>
          <CodigosPresentacion linea={l} />
        </>
      )}
    />
  );
}

function TarjetaPresentacion({ presentacion, onUmbral, onEstado }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-2 bg-white p-4 shadow-sm",
        presentacion.Activo ? "border-slate-200" : "border-dashed border-slate-200 opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-mono text-[17px] font-extrabold text-slate-900">
            {presentacion.CodigoPresentacion}
          </span>
          <span className="text-[12.5px] text-slate-500">{textoContenido(presentacion)}</span>
        </div>
        <BadgeEstado estado={presentacion.NombreEstado} estilos={ESTILOS_ESTADO_TIPO} className="shrink-0" />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-slate-600">
            <strong className="text-slate-900">{presentacion.CantidadActual}</strong>{" "}
            {unidadStock(presentacion.TipoContenedor)} en stock
          </span>
          <BadgeStock cantidad={presentacion.CantidadActual} tipo={presentacion} />
        </div>
        <span className="text-[11.5px] font-semibold text-slate-500">{textoUmbral(presentacion)}</span>
      </div>

      <div className="flex justify-end gap-1 border-t border-slate-100 pt-2">
        <BotonAccion ayuda="Editar alerta de stock" icono={BellRing} onClick={() => onUmbral(presentacion)} />
        <BotonAccion ayuda="Cambiar estado" icono={ToggleRight} onClick={() => onEstado(presentacion)} />
      </div>
    </div>
  );
}

function DatoFijo({ etiqueta, valor, mono = false }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className={ETIQUETA}>{etiqueta}</Label>
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-bold text-slate-700",
          mono && "font-mono",
        )}
      >
        <Lock size={14} className="shrink-0 text-slate-400" />
        <span className="truncate">{valor}</span>
      </div>
    </div>
  );
}

export function DetalleLineaProducto({ id }) {
  const [linea, setLinea] = useState(null);
  const [tipos, setTipos] = useState({ BobinaPapel: [], BobinaServilleta: [] });
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [origen, setOrigen] = useState(null);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [umbral, setUmbral] = useState(null);
  const [cambioEstado, setCambioEstado] = useState(null);

  const cargar = async () => {
    const actual = await obtenerLineaProducto(id);
    setLinea(actual);
    setOrigen(origenDe(actual));
    setConfirmado(false);
    return actual;
  };

  useEffect(() => {
    const mensaje = tomarMensaje();
    if (mensaje) toast.success(mensaje);
    Promise.all([cargar(), obtenerTiposOrigenLinea()])
      .then(([, tiposOrigen]) => setTipos(tiposOrigen))
      .catch((e) => setErrorCarga(e.message))
      .finally(() => setCargando(false));
  }, []);

  const recargar = () => cargar().catch((e) => toast.error(e.message));

  const actual = linea ? origenDe(linea) : null;
  const cambioOrigen = linea && origen && (origen.tipo !== actual.tipo || origen.id !== actual.id);

  const guardarOrigen = async () => {
    setEnviando(true);
    setError("");
    try {
      const guardada = await editarLineaProducto(id, origen);
      setLinea(guardada);
      setOrigen(origenDe(guardada));
      setConfirmado(false);
      toast.success(`Materia prima de ${guardada.NombreProducto}: ${textoOrigen(guardada)}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const alCambiarEstado = (resultado) => {
    setCambioEstado(null);
    toast.success(`${resultado.Nombre}: ${resultado.NombreEstadoAnterior} → ${resultado.NombreEstado}`);
    recargar();
  };

  const alGuardarUmbral = (guardado) => {
    setUmbral(null);
    toast.success(`Alerta de ${guardado.Nombre} actualizada`);
    recargar();
  };

  return (
    <PaginaFormulario
      subtitulo={`Línea de producto${linea ? ` · ${linea.NombreProducto}` : ""}`}
      volver={RUTA_PRODUCTOS}
      cargando={cargando}
      error={errorCarga}
    >
      {linea && (
        <>
          <Indicacion>
            <span className="font-bold text-slate-900">
              El nombre, las siglas y el contenido de las presentaciones no se pueden cambiar.
            </span>
            <span>
              Puedes cambiar la materia prima de origen, agregar presentaciones, ajustar sus alertas de
              stock y activarlas o desactivarlas.
            </span>
          </Indicacion>

          <Seccion titulo="Datos de la línea">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px_160px]">
              <NombreFijo nombre={linea.NombreProducto} />
              <DatoFijo etiqueta="Siglas" valor={linea.SiglasProducto} mono />
              <div className="flex flex-col gap-1.5">
                <Label className={ETIQUETA}>Estado</Label>
                <div className="flex h-11 items-center">
                  <BadgeEstado estado={linea.NombreEstado} estilos={ESTILOS_ESTADO_TIPO} />
                </div>
              </div>
            </div>
            {linea.EnProduccion && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <Factory size={14} strokeWidth={2.5} />
                Tiene una producción en curso o en pausa.
              </span>
            )}
          </Seccion>

          <Seccion
            titulo="Materia prima de origen"
            ayuda={
              linea.EnProduccion
                ? "No se puede cambiar mientras tenga una producción en curso o en pausa."
                : "Solo afecta a las producciones nuevas."
            }
          >
            <SelectorOrigen
              tipos={tipos}
              origen={origen}
              actual={{
                ...actual,
                nombre: linea.NombreTipoBobina ?? linea.NombreTipoBobinaServilleta,
              }}
              deshabilitado={linea.EnProduccion || enviando}
              onCambio={(nuevo) => {
                setOrigen(nuevo);
                setConfirmado(false);
                setError("");
              }}
            />

            {cambioOrigen && (
              <>
                <CasillaConfirmacion
                  marcada={confirmado}
                  onCambio={setConfirmado}
                  titulo={`Confirmo el cambio de materia prima de ${linea.NombreProducto}`}
                >
                  El cambio quedará registrado en el historial de acciones del administrador con el
                  valor anterior y el nuevo.
                </CasillaConfirmacion>
                {error && <ErrorDialogo mensaje={error} />}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    disabled={enviando}
                    onClick={() => {
                      setOrigen(actual);
                      setConfirmado(false);
                      setError("");
                    }}
                    className="h-11 font-bold"
                  >
                    Descartar
                  </Button>
                  <BotonEnviar
                    onClick={guardarOrigen}
                    enviando={enviando}
                    deshabilitado={!confirmado}
                    className="h-11 bg-slate-900 hover:bg-slate-800"
                  >
                    Guardar materia prima
                  </BotonEnviar>
                </div>
              </>
            )}
          </Seccion>

          <Seccion
            titulo={`Presentaciones (${presentacionesActivas(linea)} de ${linea.Presentaciones.length} activas)`}
            ayuda="El stock se cuenta en jabas o planchas. La alerta avisa cuando quedan pocas."
          >
            <Button
              type="button"
              variant="outline"
              disabled={!linea.Activo}
              onClick={() => (window.location.href = `${RUTA_PRODUCTOS}/presentacion/${id}`)}
              className="h-10 self-start gap-1.5 font-bold"
            >
              <Plus size={15} strokeWidth={2.5} />
              Agregar presentación
            </Button>
            {!linea.Activo && (
              <span className="text-xs font-semibold text-amber-700">
                Activa la línea para agregar presentaciones.
              </span>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {linea.Presentaciones.map((p) => (
                <TarjetaPresentacion
                  key={p.IdPresentacion}
                  presentacion={p}
                  onUmbral={(presentacion) =>
                    setUmbral({
                      Id: presentacion.IdPresentacion,
                      Nombre: presentacion.CodigoPresentacion,
                      CantidadActual: presentacion.CantidadActual,
                      StockMinimo: presentacion.StockMinimo,
                      StockPreventivo: presentacion.StockPreventivo,
                      TipoContenedor: presentacion.TipoContenedor,
                    })
                  }
                  onEstado={setCambioEstado}
                />
              ))}
            </div>
          </Seccion>
        </>
      )}

      <DialogoUmbralStock
        item={umbral}
        dominio={DOMINIO_PRODUCTO}
        unidad={umbral ? `${unidadStock(umbral.TipoContenedor)} en stock` : ""}
        descripcion="Define cuándo avisar que quedan pocas unidades de esta presentación en el inventario de producto terminado."
        onCerrar={() => setUmbral(null)}
        onGuardado={alGuardarUmbral}
      />
      <DialogoCambiarEstadoTipo
        tipo={cambioEstado}
        config={CONFIG_ESTADO_PRESENTACION}
        onCerrar={() => setCambioEstado(null)}
        onCambiado={alCambiarEstado}
      />
    </PaginaFormulario>
  );
}
