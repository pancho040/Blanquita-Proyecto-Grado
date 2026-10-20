import { useEffect, useState } from "react";
import { Info, Lock, Pencil, Plus, ToggleRight } from "lucide-react";
import { Toaster, toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import Header from "@/components/layout/Header";
import InputForModal from "@/components/layout/InputForModal";
import {
  TarjetaFiltros,
  BuscadorFiltro,
  SelectFiltro,
  ResultadosReporte,
  TarjetaReporte,
  PieTarjeta,
  BadgeEstado,
  DERECHA,
} from "@/components/Reportes/comunes";
import { BotonEnviar, ErrorDialogo, ETIQUETA } from "@/components/Admin/Usuarios/Dialogos";
import { CamposStock, errorStock } from "@/components/Admin/CamposStock";
import { CasillaConfirmacion } from "@/components/Admin/CasillaConfirmacion";
import { useReporte } from "@/hooks/useReporte";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { EstadosCatalogo } from "@/constants/Estados";
import {
  NOMBRE_TIPO_MATERIA_PRIMA_MIN as NOMBRE_MIN,
  NOMBRE_TIPO_MATERIA_PRIMA_MAX as NOMBRE_MAX,
  DESCRIPCION_TIPO_MATERIA_PRIMA_MIN as DESCRIPCION_MIN,
  DESCRIPCION_TIPO_MATERIA_PRIMA_MAX as DESCRIPCION_MAX,
  MOTIVO_CANCELACION_MIN as MOTIVO_MIN,
  MOTIVO_CANCELACION_MAX as MOTIVO_MAX,
} from "@/constants/Values";
import { limpiarObservacion, numeroONulo } from "@/utils/validators";
import { formatearNumero } from "@/utils/numeros";
import { estadoStock, ESTILO_STOCK } from "@/utils/stock";
import { limpiarTexto } from "@/models/MateriaPrima/TipoMateriaPrima";
import { guardarMensaje, tomarMensaje } from "@/utils/mensajeFlash";

export const PATRON_NOMBRE_TIPO = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,%()/-]+$/;

export const ESTILOS_ESTADO_TIPO = {
  Activo: "border-emerald-300 bg-emerald-50 text-emerald-700",
  Inactivo: "border-amber-300 bg-amber-50 text-amber-700",
};

const FILTROS_INICIALES = { Busqueda: "", Activo: "" };

export const numero = (valor) => formatearNumero(valor, { decimales: 2, decimalesMinimos: 0 });

export const textoUmbral = (t) =>
  t.StockMinimo === null ? "Sin umbral" : `Mín. ${t.StockMinimo} · Prev. ${t.StockPreventivo}`;

export const textoProductos = (t) =>
  t.Productos.length ? t.Productos.map((p) => p.NombreProducto).join(", ") : "Sin productos";

export function BadgeStock({ cantidad, tipo, className }) {
  const estilo = ESTILO_STOCK[estadoStock(cantidad, tipo)];
  return (
    <Badge variant="outline" className={cn("border-0 font-bold", estilo.clase, className)}>
      {estilo.texto}
    </Badge>
  );
}

export const columnaEstado = {
  titulo: "Estado",
  valor: (t) => <BadgeEstado estado={t.NombreEstado} estilos={ESTILOS_ESTADO_TIPO} />,
};

export const columnaStock = (cantidadDe) => ({
  titulo: "Stock",
  ...DERECHA,
  valor: (t) => (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-900">{cantidadDe(t)}</span>
        <BadgeStock cantidad={cantidadDe(t)} tipo={t} />
      </div>
      <span className="text-[11.5px] font-semibold text-slate-500">{textoUmbral(t)}</span>
    </div>
  ),
});

export function BotonAccion({ ayuda, icono: Icono, onClick }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            className="h-9 w-9 text-slate-400 hover:bg-c4/10 hover:text-c3"
          >
            <Icono size={16} strokeWidth={2.25} />
          </Button>
        }
      />
      <TooltipContent>{ayuda}</TooltipContent>
    </Tooltip>
  );
}

export function Indicacion({ icono: Icono = Info, children }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-c4/20 bg-c4/5 px-4 py-3 text-[13px] text-slate-700">
      <Icono size={17} strokeWidth={2.25} className="mt-0.5 shrink-0 text-c3" />
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

const rutaRegistrar = (config) => config.rutaRegistrar ?? `${config.rutaBase}/registrar`;
const rutaEditar = (config, id) => config.rutaEditar?.(id) ?? `${config.rutaBase}/editar/${id}`;

export function PaginaTipos({
  config,
  columnas,
  datosTarjeta,
  pestanas = [],
  barra = null,
  pestanaInicial = "tipos",
}) {
  const reporte = useReporte(config.listar, FILTROS_INICIALES, ["Busqueda"]);
  const [cambioEstado, setCambioEstado] = useState(null);
  const [pestana, setPestana] = useState(
    pestanas.some((p) => p.id === pestanaInicial) ? pestanaInicial : "tipos",
  );
  const [creandoExtra, setCreandoExtra] = useState(false);
  const [contadorExtra, setContadorExtra] = useState(null);

  const extra = pestanas.find((p) => p.id === pestana) ?? null;

  useEffect(() => {
    const mensaje = tomarMensaje();
    if (mensaje) toast.success(mensaje);
  }, []);

  const irA = (id) => {
    setPestana(id);
    setCreandoExtra(false);
    setContadorExtra(null);
    window.history.replaceState(
      null,
      "",
      id === "tipos" ? config.rutaBase : `${config.rutaBase}?pestana=${id}`,
    );
    if (id === "tipos") reporte.recargar();
  };

  const acciones = (t) => (
    <div className="flex justify-end gap-1">
      <BotonAccion
        ayuda={`Editar ${config.singular}`}
        icono={Pencil}
        onClick={() => (window.location.href = rutaEditar(config, config.idDe(t)))}
      />
      <BotonAccion ayuda="Cambiar estado" icono={ToggleRight} onClick={() => setCambioEstado(t)} />
    </div>
  );

  const alCambiarEstado = (resultado) => {
    setCambioEstado(null);
    toast.success(`${resultado.Nombre}: ${resultado.NombreEstadoAnterior} → ${resultado.NombreEstado}`);
    reporte.recargar();
  };

  const [singularLista, pluralLista] = config.nombres ?? ["tipo", "tipos"];
  const contadorTipos = reporte.catalogo
    ? { valor: reporte.catalogo.Total, singular: singularLista, plural: pluralLista }
    : null;

  return (
    <TooltipProvider>
      <Toaster richColors position="top-center" />
      <div className="contenido-con-sidebar flex min-h-screen flex-col bg-slate-50 pt-20 font-sans text-slate-900 md:pt-0">
        <Header
          volver="/admin/inicio"
          titulo="Administración"
          subtitulo={extra ? extra.subtitulo : config.subtitulo}
          contador={extra ? contadorExtra : contadorTipos}
          accion={
            extra
              ? {
                  texto: extra.textoRegistrar,
                  icono: Plus,
                  onClick: () =>
                    extra.rutaRegistrar
                      ? (window.location.href = extra.rutaRegistrar)
                      : setCreandoExtra(true),
                }
              : {
                  texto: config.textoRegistrar ?? "Registrar tipo",
                  icono: Plus,
                  onClick: () => (window.location.href = rutaRegistrar(config)),
                }
          }
        />

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 py-6 sm:px-6">
          {barra}

          {pestanas.length > 0 && (
            <Tabs value={pestana} onValueChange={irA}>
              <TabsList className="grid w-full grid-cols-2 sm:w-[440px]">
                <TabsTrigger value="tipos" className="gap-1.5 font-bold">
                  {config.iconoPestana && <config.iconoPestana size={15} strokeWidth={2.75} />}
                  {config.textoPestana}
                </TabsTrigger>
                {pestanas.map((p) => (
                  <TabsTrigger key={p.id} value={p.id} className="gap-1.5 font-bold">
                    <p.icono size={15} strokeWidth={2.75} />
                    {p.texto}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {extra ? (
            <>
              {extra.ayuda && <Indicacion>{extra.ayuda}</Indicacion>}
              {extra.render({
                creando: creandoExtra,
                onCerrarCreacion: () => setCreandoExtra(false),
                onContador: setContadorExtra,
                irA,
              })}
            </>
          ) : (
            <>
              {config.ayuda && <Indicacion>{config.ayuda}</Indicacion>}

              <TarjetaFiltros reporte={reporte}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <BuscadorFiltro
                    reporte={reporte}
                    campo="Busqueda"
                    etiqueta="Buscar"
                    placeholder={config.placeholderBusqueda ?? "Nombre o descripción"}
                    mono={false}
                  />
                  <SelectFiltro
                    reporte={reporte}
                    campo="Activo"
                    etiqueta="Estado"
                    opciones={EstadosCatalogo}
                    campoEtiqueta="NombreEstado"
                    placeholder="Todos los estados"
                  />
                </div>
              </TarjetaFiltros>

              <ResultadosReporte
                reporte={reporte}
                elementos={reporte.catalogo?.Tipos}
                clave={config.idDe}
                nombres={[singularLista, pluralLista]}
                columnas={columnas}
                anchoAccion="w-24"
                accion={acciones}
                tarjeta={(t) => (
                  <TarjetaReporte
                    titulo={config.nombreDe(t)}
                    tamanoTitulo="text-[14px] font-sans"
                    subtitulo={config.subtituloDe?.(t) ?? t.Descripcion ?? "Sin descripción"}
                    estado={t.NombreEstado}
                    estilos={ESTILOS_ESTADO_TIPO}
                  >
                    <PieTarjeta accion={acciones(t)}>{datosTarjeta(t)}</PieTarjeta>
                  </TarjetaReporte>
                )}
              />
            </>
          )}
        </main>
      </div>

      <DialogoCambiarEstadoTipo
        tipo={cambioEstado}
        config={config}
        onCerrar={() => setCambioEstado(null)}
        onCambiado={alCambiarEstado}
      />
    </TooltipProvider>
  );
}

export function NombreFijo({ nombre }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className={ETIQUETA}>Nombre</Label>
      <div className="flex h-11 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-bold text-slate-700">
        <Lock size={14} className="shrink-0 text-slate-400" />
        <span className="truncate">{nombre}</span>
      </div>
      <span className="text-xs text-slate-500">
        El nombre no se puede cambiar para conservar la trazabilidad de los registros.
      </span>
    </div>
  );
}

export function Seccion({ titulo, ayuda, children }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-0.5">
        <div className="text-[14px] font-extrabold text-slate-900">{titulo}</div>
        {ayuda && <div className="text-[12.5px] text-slate-500">{ayuda}</div>}
      </div>
      {children}
    </div>
  );
}

export function Pildora({ marcada, deshabilitada = false, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={marcada}
      disabled={deshabilitada}
      onClick={onClick}
      className={cn(PILDORA_FILTRO, "disabled:cursor-not-allowed disabled:opacity-50")}
    >
      {children}
    </button>
  );
}

const alternar = (lista, id) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

const soloNumero = (texto, entero) =>
  entero ? texto.replace(/\D/g, "") : texto.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

const formularioDe = (config, tipo) => ({
  Nombre: tipo ? config.nombreDe(tipo) : "",
  Descripcion: tipo?.Descripcion ?? "",
  StockMinimo: tipo?.StockMinimo ?? "",
  StockPreventivo: tipo?.StockPreventivo ?? "",
  IdsProducto: tipo?.Productos?.map((p) => p.IdProducto) ?? [],
  IdsFormato: tipo?.Formatos?.map((f) => f.IdFormatoSubBobina) ?? [],
  ...Object.fromEntries(
    (config.campos ?? []).map((c) => [c.campo, String(tipo ? tipo[c.campo] : c.defecto)]),
  ),
});

const firma = (config, datos) =>
  JSON.stringify({
    Descripcion: limpiarTexto(datos.Descripcion),
    StockMinimo: numeroONulo(datos.StockMinimo),
    StockPreventivo: numeroONulo(datos.StockPreventivo),
    IdsProducto: [...datos.IdsProducto].sort((a, b) => a - b),
    IdsFormato: [...datos.IdsFormato].sort((a, b) => a - b),
    ...Object.fromEntries((config.campos ?? []).map((c) => [c.campo, Number(datos[c.campo])])),
  });

function erroresTipo(config, datos, editando) {
  const errores = {};
  const nombre = limpiarTexto(datos.Nombre);
  if (!editando && nombre && (nombre.length < NOMBRE_MIN || !PATRON_NOMBRE_TIPO.test(nombre)))
    errores.Nombre = `Entre ${NOMBRE_MIN} y ${NOMBRE_MAX} caracteres: letras, números, espacios y . , % ( ) / -`;

  const descripcion = limpiarTexto(datos.Descripcion);
  if (descripcion && descripcion.length < DESCRIPCION_MIN)
    errores.Descripcion = `Mínimo ${DESCRIPCION_MIN} caracteres o déjala vacía`;

  for (const c of config.campos ?? []) {
    const texto = String(datos[c.campo] ?? "");
    const valor = Number(texto);
    if (texto === "" || Number.isNaN(valor)) errores[c.campo] = "Obligatorio";
    else if (c.minimo === 0 ? valor < 0 : valor <= 0)
      errores[c.campo] = c.minimo === 0 ? "No puede ser negativo" : "Debe ser mayor a 0";
    else if (valor > c.maximo) errores[c.campo] = `Máximo ${c.maximo}`;
    else if (c.entero && !Number.isInteger(valor)) errores[c.campo] = "Debe ser un número entero";
  }

  const stock = errorStock(datos.StockMinimo, datos.StockPreventivo);
  if (stock) errores.Stock = stock;

  if (config.cargarFormatos && datos.IdsFormato.length === 0)
    errores.IdsFormato = "Elige al menos un formato";

  return errores;
}

function SelectorProductos({ productos, cargando, seleccion, idActual, etiquetaOtro, onCambio }) {
  const movidos = productos.filter(
    (p) => seleccion.includes(p.IdProducto) && p.IdTipoActual !== null && p.IdTipoActual !== idActual,
  );

  return (
    <Seccion
      titulo="Productos asociados"
      ayuda={`Productos que se elaboran con este tipo. Los productos de ${etiquetaOtro} no aparecen.`}
    >
      {cargando ? (
        <span className="text-xs text-slate-400">Cargando productos...</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {productos.map((p) => (
            <Pildora
              key={p.IdProducto}
              marcada={seleccion.includes(p.IdProducto)}
              onClick={() => onCambio(alternar(seleccion, p.IdProducto))}
            >
              {p.NombreProducto}
              {!p.Activo && " (inactivo)"}
              {p.IdTipoActual !== null && p.IdTipoActual !== idActual && (
                <span className="ml-1 font-semibold opacity-70">· {p.NombreTipoActual}</span>
              )}
            </Pildora>
          ))}
        </div>
      )}
      {movidos.length > 0 && (
        <span className="text-xs font-semibold text-amber-700">
          Se moverán desde su tipo actual: {movidos.map((p) => `${p.NombreProducto} (${p.NombreTipoActual})`).join(", ")}
        </span>
      )}
    </Seccion>
  );
}

function SelectorFormatos({ formatos, cargando, seleccion, asignados, error, onCambio }) {
  return (
    <Seccion
      titulo="Formatos permitidos"
      ayuda="Cómo se corta cada unidad al abrir la bobina. Las bobinas ya registradas conservan su formato."
    >
      {cargando ? (
        <span className="text-xs text-slate-400">Cargando formatos...</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {formatos.map((f) => (
            <Pildora
              key={f.IdFormatoSubBobina}
              marcada={seleccion.includes(f.IdFormatoSubBobina)}
              deshabilitada={!f.Activo && !asignados.includes(f.IdFormatoSubBobina)}
              onClick={() => onCambio(alternar(seleccion, f.IdFormatoSubBobina))}
            >
              {f.DescripcionFormato}
              <span className="ml-1 font-semibold opacity-70">
                · {f.Detalle.map((d) => `${d.MedidaMm} mm × ${d.Cantidad}`).join(" + ")}
              </span>
              {!f.Activo && " (inactivo)"}
            </Pildora>
          ))}
        </div>
      )}
      {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
    </Seccion>
  );
}

export function PaginaFormulario({ subtitulo, volver, cargando, error, children }) {
  return (
    <TooltipProvider>
      <Toaster richColors position="top-center" />
      <div className="contenido-con-sidebar flex min-h-screen flex-col bg-slate-50 pt-20 font-sans text-slate-900 md:pt-0">
        <Header volver={volver} titulo="Administración" subtitulo={subtitulo} />
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-5 py-6 sm:px-6">
          {cargando ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-56 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-10 text-center ring-1 ring-slate-200">
              <span className="text-sm font-semibold text-red-600">{error}</span>
              <Button variant="outline" onClick={() => (window.location.href = volver)}>
                Volver a la lista
              </Button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}

export function PieFormulario({ volver, onEnviar, enviando, deshabilitado, texto }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
      <Button
        variant="outline"
        disabled={enviando}
        onClick={() => (window.location.href = volver)}
        className="h-11 font-bold"
      >
        Cancelar
      </Button>
      <BotonEnviar
        onClick={onEnviar}
        enviando={enviando}
        deshabilitado={deshabilitado}
        className="h-11 bg-slate-900 hover:bg-slate-800"
      >
        {texto}
      </BotonEnviar>
    </div>
  );
}

export function PaginaFormularioTipo({ config, id = null }) {
  const editando = id !== null;
  const [tipo, setTipo] = useState(null);
  const [datos, setDatos] = useState(() => formularioDe(config, null));
  const [productos, setProductos] = useState([]);
  const [formatos, setFormatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      editando ? config.obtener(id) : Promise.resolve(null),
      config.cargarProductos ? config.cargarProductos() : Promise.resolve([]),
      config.cargarFormatos ? config.cargarFormatos() : Promise.resolve([]),
    ])
      .then(([actual, listaProductos, listaFormatos]) => {
        setTipo(actual);
        setDatos(formularioDe(config, actual));
        setProductos(listaProductos);
        setFormatos(listaFormatos);
      })
      .catch((e) => setErrorCarga(e.message))
      .finally(() => setCargando(false));
  }, []);

  const cambiar = (campo) => (valor) => {
    setDatos((previos) => ({ ...previos, [campo]: valor }));
    setConfirmado(false);
  };

  const errores = erroresTipo(config, datos, editando);
  const completo = editando || limpiarTexto(datos.Nombre) !== "";
  const sinCambios = editando && tipo && firma(config, formularioDe(config, tipo)) === firma(config, datos);
  const valido = completo && Object.keys(errores).length === 0 && !sinCambios && confirmado;

  const confirmar = async () => {
    setEnviando(true);
    setError("");
    try {
      const guardado = editando ? await config.editar(id, datos) : await config.crear(datos);
      guardarMensaje(
        `${config.nombreDe(guardado)} ${editando ? "actualizado" : "registrado"} correctamente`,
      );
      window.location.href = config.rutaBase;
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  const largoDescripcion = limpiarTexto(datos.Descripcion).length;

  return (
    <PaginaFormulario
      subtitulo={
        editando
          ? `Editar ${config.singular}${tipo ? ` · ${config.nombreDe(tipo)}` : ""}`
          : `Registrar ${config.singular}`
      }
      volver={config.rutaBase}
      cargando={cargando}
      error={errorCarga}
    >
      {(!editando || tipo) && (
        <>
          <Indicacion>
            <span className="font-bold text-slate-900">
              {editando
                ? "Puedes cambiar todo menos el nombre."
                : `Nuevo ${config.singular}.`}
            </span>
            <span>
              {editando
                ? "Los cambios solo aplican a los registros nuevos; lo ya registrado conserva sus datos."
                : config.descripcionCrear}
            </span>
          </Indicacion>

          <Seccion titulo="Datos generales">
            {editando ? (
              <NombreFijo nombre={config.nombreDe(tipo)} />
            ) : (
              <InputForModal
                id="tipo-nombre"
                etiqueta="Nombre"
                valor={datos.Nombre}
                onCambio={(v) => cambiar("Nombre")(v.slice(0, NOMBRE_MAX))}
                placeholder={config.ejemploNombre}
                error={errores.Nombre}
              />
            )}

            {config.campos?.length > 0 && (
              <div
                className={cn(
                  "grid grid-cols-1 gap-3 sm:grid-cols-2",
                  config.campos.length > 3 ? "md:grid-cols-4" : "md:grid-cols-3",
                )}
              >
                {config.campos.map((c) => (
                  <InputForModal
                    key={c.campo}
                    id={`tipo-${c.campo}`}
                    etiqueta={c.etiqueta}
                    valor={datos[c.campo]}
                    onCambio={(v) => cambiar(c.campo)(soloNumero(v, c.entero))}
                    inputMode={c.entero ? "numeric" : "decimal"}
                    error={errores[c.campo]}
                  />
                ))}
              </div>
            )}

            {!config.sinDescripcion && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tipo-descripcion" className={ETIQUETA}>
                  Descripción <span className="font-semibold normal-case text-slate-400">(opcional)</span>
                </Label>
                <Textarea
                  id="tipo-descripcion"
                  value={datos.Descripcion}
                  onChange={(e) => cambiar("Descripcion")(limpiarObservacion(e.target.value))}
                  placeholder="Ej. Papel de mezcla para Luxury y EcoPack"
                  className="min-h-20"
                  maxLength={DESCRIPCION_MAX}
                  aria-invalid={Boolean(errores.Descripcion)}
                />
                <span
                  className={
                    errores.Descripcion ? "text-xs font-semibold text-red-600" : "text-xs text-slate-500"
                  }
                >
                  {errores.Descripcion ?? `${largoDescripcion}/${DESCRIPCION_MAX}`}
                </span>
              </div>
            )}
          </Seccion>

          <CamposStock
            prefijoId="tipo"
            stockMinimo={datos.StockMinimo}
            stockPreventivo={datos.StockPreventivo}
            onCambio={(campo, valor) => cambiar(campo)(valor)}
            unidad={config.unidadStock}
          />

          {config.cargarFormatos && (
            <SelectorFormatos
              formatos={formatos}
              cargando={false}
              seleccion={datos.IdsFormato}
              asignados={formularioDe(config, tipo).IdsFormato}
              error={errores.IdsFormato}
              onCambio={cambiar("IdsFormato")}
            />
          )}

          {config.cargarProductos && (
            <SelectorProductos
              productos={productos}
              cargando={false}
              seleccion={datos.IdsProducto}
              idActual={editando ? id : null}
              etiquetaOtro={config.etiquetaOtro}
              onCambio={cambiar("IdsProducto")}
            />
          )}

          {editando ? (
            <CasillaConfirmacion
              marcada={confirmado}
              onCambio={setConfirmado}
              titulo={`Confirmo los cambios en ${tipo ? config.nombreDe(tipo) : config.singular}`}
            >
              El cambio quedará registrado en el historial de acciones del administrador con el valor
              anterior y el nuevo. Solo afecta a los registros nuevos.
            </CasillaConfirmacion>
          ) : (
            <CasillaConfirmacion
              marcada={confirmado}
              onCambio={setConfirmado}
              titulo={`Confirmo el registro del ${config.singular}${
                limpiarTexto(datos.Nombre) ? ` «${limpiarTexto(datos.Nombre)}»` : ""
              }`}
            >
              El registro quedará en el historial de acciones del administrador. El tipo no se puede
              eliminar y su nombre no podrá ser editado; se puede desactivar para que no aparezca en los
              ingresos nuevos.
            </CasillaConfirmacion>
          )}

          {error && <ErrorDialogo mensaje={error} />}
          {sinCambios && (
            <span className="text-right text-xs font-semibold text-slate-500">No hay cambios para guardar.</span>
          )}

          <PieFormulario
            volver={config.rutaBase}
            onEnviar={confirmar}
            enviando={enviando}
            deshabilitado={!valido}
            texto={editando ? "Guardar cambios" : "Registrar tipo"}
          />
        </>
      )}
    </PaginaFormulario>
  );
}

export function DialogoCambiarEstadoTipo({ tipo, config, onCerrar, onCambiado }) {
  const [activo, setActivo] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tipo) return;
    setActivo(null);
    setMotivo("");
    setConfirmado(false);
    setError("");
  }, [tipo]);

  const destinos = tipo ? EstadosCatalogo.filter((e) => e.Activo !== tipo.Activo) : [];
  const largo = motivo.trim().length;
  const valido = activo !== null && largo >= MOTIVO_MIN && largo <= MOTIVO_MAX && confirmado;

  const confirmar = async () => {
    setEnviando(true);
    setError("");
    try {
      onCambiado(await config.cambiarEstado(config.idDe(tipo), activo, motivo));
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={Boolean(tipo)} onOpenChange={(open) => !open && !enviando && onCerrar()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cambiar estado</DialogTitle>
          <DialogDescription>
            {config.descripcionEstado ??
              "Un tipo inactivo no aparece en los ingresos nuevos; el stock que queda se sigue usando y aparece en inventarios y reportes."}
          </DialogDescription>
        </DialogHeader>

        {tipo && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[15px] font-extrabold text-slate-900">{config.nombreDe(tipo)}</div>
              <div className="text-[12.5px] text-slate-500">
                {config.resumenEstado(tipo)} · {tipo.NombreEstado}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className={ETIQUETA}>Nuevo estado</Label>
              <div className="flex flex-wrap gap-2">
                {destinos.map((estado) => (
                  <button
                    key={estado.NombreEstado}
                    type="button"
                    aria-pressed={activo === estado.Activo}
                    onClick={() => {
                      setActivo(estado.Activo);
                      setConfirmado(false);
                    }}
                    className={PILDORA_FILTRO}
                  >
                    {estado.NombreEstado}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motivo-estado-tipo" className={ETIQUETA}>
                Motivo
              </Label>
              <Textarea
                id="motivo-estado-tipo"
                value={motivo}
                onChange={(e) => {
                  setMotivo(limpiarObservacion(e.target.value));
                  setConfirmado(false);
                }}
                placeholder="Ej. El proveedor dejó de fabricarlo, se reemplaza por otro tipo..."
                className="min-h-20"
                maxLength={MOTIVO_MAX}
              />
              <span className="text-xs text-slate-500">
                {largo}/{MOTIVO_MAX} · mínimo {MOTIVO_MIN} caracteres
              </span>
            </div>

            <CasillaConfirmacion
              marcada={confirmado}
              onCambio={setConfirmado}
              titulo={`Confirmo el cambio de estado de ${config.nombreDe(tipo)}${
                activo === null ? "" : ` a ${activo ? "Activo" : "Inactivo"}`
              }`}
            >
              El cambio quedará registrado en el historial de acciones del administrador junto con el
              motivo.
            </CasillaConfirmacion>

            {error && <ErrorDialogo mensaje={error} />}
          </div>
        )}

        <DialogFooter>
          <BotonEnviar
            onClick={confirmar}
            enviando={enviando}
            deshabilitado={!valido}
            className="bg-slate-900 hover:bg-slate-800"
          >
            Cambiar estado
          </BotonEnviar>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
