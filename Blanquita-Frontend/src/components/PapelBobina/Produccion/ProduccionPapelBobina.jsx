import { useState, useEffect } from "react";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  verProduccionBobinaTubo,
  verPausasProduccionBobinaTuboActivas,
  pausarProduccion,
  reanudarProduccion,
  finalizarProduccion,
  cancelarProduccion,
  insertarMovimientoLog,
  cambiarLineaProduccion,
} from "../../../services/BobinaPapel/Produccion";
import { ObtenerTiposPapelBobina } from "../../../services/BobinaPapel/BobinaPapel";
import { obtenerProductos } from "../../../services/Inventario/Inventario";
import { productosActivosDelTipo } from "@/utils/catalogo";
import {
  movimientosOperador,
  ObservacionesInsertarLogs,
  MotivosReanudacionProduccion,
} from "../../../constants/OperadorConfig";
import {
  Roles,
  CANTIDAD_MAXIMA_LOGS,
} from "@/constants/Values";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { alternarMotivoEnTexto } from "@/utils/handlers";
import { extraerMensajeError, limpiarObservacion } from "@/utils/validators";
import { useProduccion } from "@/hooks/useProduccion";
import {
  ResumenProduccion,
  TabsProduccion,
  ListaProducciones,
} from "@/components/Produccion/comunes";
import {
  DialogoPausar,
  DialogoReanudar,
  DialogoCancelar,
  AlertaFinalizar,
} from "@/components/Produccion/Dialogos";
import Header from "../../layout/Header";
import { CardActiva, CardPausada } from "./Tarjetas";
import ProduccionesConcluidas from "./Concluidas";

const ID_TIPO_INGRESO = 1;
const ID_TIPO_DESCUENTO = 2;

const MOTIVOS_PAUSA = [
  "Falta de pegamento",
  "Falta de personal",
];

const codigosDe = (p) => `${p.CodigoBobina1} + ${p.CodigoBobina2}`;

export default function ProduccionBobinaTubo({ usuario }) {
  const [vista, setVista] = useState("activas");

  const [tiposBobina, setTiposBobina] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [productos, setProductos] = useState([]);
  const [filtroProducto, setFiltroProducto] = useState("");
  const [buscarCodigoBobina, setBuscarCodigoBobina] = useState("");

  const idTipoFiltro = filtroTipo === "" ? undefined : Number(filtroTipo);
  const idProductoFiltro = filtroProducto === "" ? undefined : Number(filtroProducto);
  const productosDelFiltro = productos.filter((p) =>
    filtroTipo === "" ? p.IdTipoBobina !== null : p.IdTipoBobina === Number(filtroTipo),
  );
  const permiteFiltroProducto = productosDelFiltro.length > 1;

  const cambiarFiltroTipo = (valor) => {
    setFiltroTipo(valor);
    const sigueEnTipo = productos.some(
      (p) =>
        String(p.IdProducto) === filtroProducto &&
        (valor === "" || p.IdTipoBobina === Number(valor)),
    );
    if (!sigueEnTipo) setFiltroProducto("");
  };

  const permiteCambioLinea = (produccion) =>
    productosActivosDelTipo(productos, produccion.IdTipoBobina).length > 1;

  const {
    activas,
    pausadas,
    recargarTodo,
    pausa,
    cancelacion,
    finalizacion,
    reanudacion,
    procesandoId,
    reanudar,
  } = useProduccion({
    verActivas: () => verProduccionBobinaTubo(idTipoFiltro, idProductoFiltro),
    verPausadas: () => verPausasProduccionBobinaTuboActivas(idTipoFiltro, idProductoFiltro),
    idDe: (p) => p.IdProduccionBobinaTubo,
    pausar: pausarProduccion,
    cancelar: cancelarProduccion,
    finalizar: finalizarProduccion,
    reanudar: reanudarProduccion,
    dependencias: [filtroTipo, filtroProducto],
  });

  const esEncargado = usuario?.IdRol === Roles.Encargado;
  const [totalConcluidas, setTotalConcluidas] = useState(0);

  const [cambioLinea, setCambioLinea] = useState(null);
  const [nuevoProducto, setNuevoProducto] = useState(null);
  const [errorCambioLinea, setErrorCambioLinea] = useState("");
  const [enviandoCambioLinea, setEnviandoCambioLinea] = useState(false);

  const productosDisponibles = cambioLinea
    ? productosActivosDelTipo(productos, cambioLinea.IdTipoBobina).filter(
        (p) => p.IdProducto !== cambioLinea.IdProducto,
      )
    : [];

  const abrirCambioLinea = (produccion) => {
    setNuevoProducto(null);
    setErrorCambioLinea("");
    setCambioLinea(produccion);
  };

  const confirmarCambioLinea = async () => {
    if (nuevoProducto === null) {
      setErrorCambioLinea("Selecciona el nuevo producto.");
      return;
    }
    setEnviandoCambioLinea(true);
    setErrorCambioLinea("");
    try {
      const res = await cambiarLineaProduccion(cambioLinea.IdProduccionBobinaTubo, nuevoProducto);
      toast.success(
        `${codigosDe(cambioLinea)} · ${cambioLinea.NombreProducto} → ${res.NombreProducto}`,
      );
      setCambioLinea(null);
      activas.recargar();
    } catch (e) {
      setErrorCambioLinea(extraerMensajeError(e, e.message));
    } finally {
      setEnviandoCambioLinea(false);
    }
  };

  const [modalInsertar, setModalInsertar] = useState({ open: false, produccion: null });
  const [formTipoMovimiento, setFormTipoMovimiento] = useState("");
  const [formCantidadLogs, setFormCantidadLogs] = useState("");
  const [formObservacionLog, setFormObservacionLog] = useState("");
  const [errorInsertar, setErrorInsertar] = useState("");
  const [enviandoInsertar, setEnviandoInsertar] = useState(false);

  useEffect(() => {
    ObtenerTiposPapelBobina()
      .then(setTiposBobina)
      .catch(() => setTiposBobina([]));
    obtenerProductos()
      .then(setProductos)
      .catch(() => setProductos([]));
  }, []);

  const requiereObservacion =
    formTipoMovimiento !== "" && Number(formTipoMovimiento) !== ID_TIPO_INGRESO;

  const movimientoSeleccionado = movimientosOperador.find(
    (m) => String(m.IdTipoMovimientoOperadorLogs) === String(formTipoMovimiento),
  );

  const motivosObservacion =
    ObservacionesInsertarLogs.find((o) => o.id === Number(formTipoMovimiento))
      ?.motivos.filter(Boolean) ?? [];

  const logsActuales = Number(modalInsertar.produccion?.CantidadLogsActual ?? 0);
  const esDescuento = Number(formTipoMovimiento) === ID_TIPO_DESCUENTO;
  const descuentoExcedeTotal =
    esDescuento && Number(formCantidadLogs) > logsActuales;

  const seleccionarTipoMovimiento = (idMovimiento) => {
    const yaSeleccionado = Number(formTipoMovimiento) === idMovimiento;
    setFormTipoMovimiento(yaSeleccionado ? "" : String(idMovimiento));
    setFormObservacionLog("");
  };

  const abrirInsertar = (produccion) => {
    setFormTipoMovimiento("");
    setFormCantidadLogs("");
    setFormObservacionLog("");
    setErrorInsertar("");
    setModalInsertar({ open: true, produccion });
  };

  const confirmarInsertar = async () => {
    if (!formTipoMovimiento) {
      setErrorInsertar("Selecciona el tipo de movimiento.");
      return;
    }
    const cantidad = Number(formCantidadLogs);
    if (!formCantidadLogs || cantidad <= 0) {
      setErrorInsertar("Ingresa una cantidad de logs válida.");
      return;
    }
    if (cantidad > CANTIDAD_MAXIMA_LOGS) {
      setErrorInsertar(`La cantidad máxima por registro es de ${CANTIDAD_MAXIMA_LOGS} logs.`);
      return;
    }
    if (esDescuento && cantidad > logsActuales) {
      setErrorInsertar(
        `No se puede descontar ${cantidad} logs, el total actual es ${logsActuales}.`,
      );
      return;
    }

    setEnviandoInsertar(true);
    try {
      await insertarMovimientoLog(
        modalInsertar.produccion.IdProduccionBobinaTubo,
        Number(formTipoMovimiento),
        cantidad,
        requiereObservacion ? formObservacionLog.trim() || null : null,
      );
      toast.success("Movimiento de logs registrado");
      setModalInsertar({ open: false, produccion: null });
      recargarTodo();
    } catch (e) {
      setErrorInsertar(extraerMensajeError(e, e.message));
    } finally {
      setEnviandoInsertar(false);
    }
  };

  const motivoObservacionEnTexto = (motivo) => formObservacionLog.includes(motivo);

  const alternarMotivoObservacion = (motivo) => {
    setFormObservacionLog((actual) => alternarMotivoEnTexto(motivo, actual));
  };

  const opcionesPausa = pausa.produccion
    ? [
        ...MOTIVOS_PAUSA,
        ...(pausa.produccion.CodigoBobina1
          ? [`Empalme en la Bobina: ${pausa.produccion.CodigoBobina1}`]
          : []),
        ...(pausa.produccion.CodigoBobina2
          ? [`Empalme en la Bobina: ${pausa.produccion.CodigoBobina2}`]
          : []),
      ]
    : MOTIVOS_PAUSA;

  const coincideCodigoBobina = (p) => {
    const q = buscarCodigoBobina.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.CodigoBobina1 ?? "").toLowerCase().includes(q) ||
      (p.CodigoBobina2 ?? "").toLowerCase().includes(q)
    );
  };

  const activasFiltradas = activas.datos.filter(coincideCodigoBobina);
  const pausadasFiltradas = pausadas.datos.filter(coincideCodigoBobina);

  const sinCoincidencias = (estado) =>
    `Ninguna producción ${estado} con el código «${buscarCodigoBobina.trim()}».`;

  return (
    <TooltipProvider>
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header titulo={"Producción"} subtitulo={"Producción de Bobina Tubo"} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        <TabsProduccion
          vista={vista}
          onCambio={setVista}
          totalActivas={activasFiltradas.length}
          totalPausadas={pausadasFiltradas.length}
          mostrarConcluidas={esEncargado}
          totalConcluidas={totalConcluidas}
        />

        {vista === "concluidas" && esEncargado && (
          <ProduccionesConcluidas onTotal={setTotalConcluidas} />
        )}

        {vista !== "concluidas" && (
        <>
        {tiposBobina.length > 0 && (
          <div className="mb-5 flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Filtrar por tipo
            </span>
            <ToggleGroup
              type="single"
              value={filtroTipo ? [filtroTipo] : ["todos"]}
              className="flex w-full flex-wrap justify-start gap-2"
            >
              <ToggleGroupItem
                value="todos"
                onClick={() => cambiarFiltroTipo("")}
                className={PILDORA_FILTRO}
              >
                Todos
              </ToggleGroupItem>
              {tiposBobina.map((t) => (
                <ToggleGroupItem
                  key={t.IdTipoBobina}
                  value={String(t.IdTipoBobina)}
                  onClick={() => cambiarFiltroTipo(String(t.IdTipoBobina))}
                  className={PILDORA_FILTRO}
                >
                  {t.NombreTipoBobina}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}

        {permiteFiltroProducto && (
          <div className="mb-5 flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Filtrar por producto
            </span>
            <ToggleGroup
              value={filtroProducto ? [filtroProducto] : ["todos"]}
              className="flex w-full flex-wrap justify-start gap-2"
            >
              <ToggleGroupItem
                value="todos"
                onClick={() => setFiltroProducto("")}
                className={PILDORA_FILTRO}
              >
                Todos
              </ToggleGroupItem>
              {productosDelFiltro.map((p) => (
                <ToggleGroupItem
                  key={p.IdProducto}
                  value={String(p.IdProducto)}
                  onClick={() => setFiltroProducto(String(p.IdProducto))}
                  className={PILDORA_FILTRO}
                >
                  {p.NombreProducto}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}

        <div className="mb-5 flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
            Buscar por código de bobina
          </span>
          <div className="relative">
            <Search
              size={16}
              strokeWidth={2.5}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              value={buscarCodigoBobina}
              onChange={(e) => setBuscarCodigoBobina(e.target.value)}
              placeholder="Ej. 967 R20"
              maxLength={15}
              className="pl-9 pr-9"
            />
            {buscarCodigoBobina && (
              <button
                type="button"
                onClick={() => setBuscarCodigoBobina("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Limpiar búsqueda"
              >
                <X size={15} strokeWidth={2.75} />
              </button>
            )}
          </div>
        </div>
        </>
        )}

        {vista === "activas" && (
          <ListaProducciones
            lista={activas}
            elementos={activasFiltradas}
            altoSkeleton="h-64"
            mensajeVacio="No hay producciones activas."
            mensajeSinCoincidencias={sinCoincidencias("activa")}
            renderizar={(p) => (
              <CardActiva
                key={p.IdProduccionBobinaTubo}
                p={p}
                onInsertar={() => abrirInsertar(p)}
                onPausar={() => pausa.abrir(p)}
                onFinalizar={esEncargado ? () => finalizacion.abrir(p) : undefined}
                onCambiarLinea={
                  esEncargado && permiteCambioLinea(p)
                    ? () => abrirCambioLinea(p)
                    : undefined
                }
              />
            )}
          />
        )}

        {vista === "pausadas" && (
          <ListaProducciones
            lista={pausadas}
            elementos={pausadasFiltradas}
            altoSkeleton="h-64"
            mensajeVacio="No hay producciones pausadas."
            mensajeSinCoincidencias={sinCoincidencias("pausada")}
            renderizar={(p) => (
              <CardPausada
                key={p.IdPausaProduccionBobinaTubo}
                p={p}
                procesando={procesandoId === p.IdProduccionBobinaTubo}
                onInsertar={() => abrirInsertar(p)}
                onReanudar={() => reanudar(p)}
                onCancelar={esEncargado ? () => cancelacion.abrir(p) : undefined}
              />
            )}
          />
        )}
      </main>

      <Dialog
        open={modalInsertar.open}
        onOpenChange={(open) => setModalInsertar({ open, produccion: open ? modalInsertar.produccion : null })}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Insertar movimiento de logs</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {modalInsertar.produccion && (
              <ResumenProduccion
                titulo={codigosDe(modalInsertar.produccion)}
                produccion={modalInsertar.produccion}
              />
            )}

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Tipo de movimiento
              </Label>
              <ToggleGroup
                type="single"
                value={movimientoSeleccionado ? [movimientoSeleccionado.NombreMovimiento] : []}
                className="flex w-full flex-wrap justify-start gap-2"
              >
                {movimientosOperador.map((m) => (
                  <ToggleGroupItem
                    key={m.IdTipoMovimientoOperadorLogs}
                    value={m.NombreMovimiento}
                    onClick={() => seleccionarTipoMovimiento(m.IdTipoMovimientoOperadorLogs)}
                    className="h-auto rounded-full border-2 border-slate-200 px-3.5 py-2 text-[12.5px] font-bold text-slate-600 bg-white hover:border-slate-300 hover:bg-white hover:text-slate-600 aria-pressed:border-slate-900 aria-pressed:bg-slate-900 aria-pressed:text-white aria-pressed:hover:border-slate-900 aria-pressed:hover:bg-slate-900 aria-pressed:hover:text-white"
                  >
                    {m.NombreMovimiento}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cantidad-logs" className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Cantidad de logs
              </Label>
              <Input
                id="cantidad-logs"
                value={formCantidadLogs}
                onChange={(e) => setFormCantidadLogs(e.target.value)}
                placeholder="0"
                type="number"
                min={1}
                max={esDescuento ? Math.min(logsActuales, CANTIDAD_MAXIMA_LOGS) : CANTIDAD_MAXIMA_LOGS}
                className="h-11"
              />
              <span className="text-xs text-slate-500">
                Máximo {CANTIDAD_MAXIMA_LOGS} logs por registro
              </span>
              {esDescuento && (
                <span
                  className={`text-xs font-semibold ${
                    descuentoExcedeTotal ? "text-red-600" : "text-slate-500"
                  }`}
                >
                  Disponible para descontar: {logsActuales} logs
                </span>
              )}
            </div>

            {requiereObservacion && (
              <div className="flex flex-col gap-3">
                {motivosObservacion.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                      Motivos frecuentes
                    </Label>
                    <ToggleGroup
                      type="multiple"
                      value={motivosObservacion.filter(motivoObservacionEnTexto)}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                    >
                      {motivosObservacion.map((motivo) => (
                        <ToggleGroupItem
                          key={motivo}
                          value={motivo}
                          onClick={() => alternarMotivoObservacion(motivo)}
                          className="h-full w-full whitespace-normal rounded-xl border-2 border-slate-200 px-3 py-2 text-left text-[12.5px] font-bold leading-snug text-slate-600 bg-white hover:border-slate-300 hover:bg-white hover:text-slate-600 aria-pressed:border-slate-900 aria-pressed:bg-slate-900 aria-pressed:text-white aria-pressed:hover:border-slate-900 aria-pressed:hover:bg-slate-900 aria-pressed:hover:text-white"
                        >
                          {motivo}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="observacion-log" className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    Observación
                  </Label>
                  <Textarea
                    id="observacion-log"
                    value={formObservacionLog}
                    onChange={(e) => setFormObservacionLog(limpiarObservacion(e.target.value))}
                    placeholder="Motivo de la corrección..."
                    className="min-h-20"
                  />
                </div>
              </div>
            )}

            {errorInsertar && (
              <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600">
                {errorInsertar}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={confirmarInsertar}
              disabled={enviandoInsertar || descuentoExcedeTotal}
              className="h-11 w-full gap-2 bg-gradient-to-r from-c3 to-c4 font-extrabold hover:opacity-90 sm:w-auto"
            >
              {enviandoInsertar ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Registrar movimiento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cambioLinea !== null}
        onOpenChange={(open) => {
          if (!open && !enviandoCambioLinea) setCambioLinea(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Cambiar línea de producción</DialogTitle>
          </DialogHeader>
          {cambioLinea && (
            <div className="flex flex-col gap-4">
              <ResumenProduccion titulo={codigosDe(cambioLinea)} produccion={cambioLinea} />
              <p className="text-sm text-slate-600">
                La producción actual de{" "}
                <strong className="text-slate-900">{cambioLinea.NombreProducto}</strong> se cerrará
                con {cambioLinea.CantidadLogsActual} logs y se iniciará una nueva con las mismas
                bobinas. El contador de logs empieza en 0.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  Nuevo producto
                </Label>
                <ToggleGroup
                  value={nuevoProducto === null ? [] : [String(nuevoProducto)]}
                  className="flex w-full flex-wrap justify-start gap-2"
                >
                  {productosDisponibles.map((p) => (
                    <ToggleGroupItem
                      key={p.IdProducto}
                      value={String(p.IdProducto)}
                      onClick={() => setNuevoProducto(p.IdProducto)}
                      className={PILDORA_FILTRO}
                    >
                      {p.NombreProducto}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              {errorCambioLinea && (
                <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600">
                  {errorCambioLinea}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={confirmarCambioLinea}
              disabled={enviandoCambioLinea || nuevoProducto === null}
              className="h-11 bg-gradient-to-r from-c3 to-c4 font-bold hover:opacity-90"
            >
              {enviandoCambioLinea ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Cambiar línea"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogoPausar dialogo={pausa} tituloDe={codigosDe} opciones={opcionesPausa} />

      <DialogoReanudar
        dialogo={reanudacion}
        tituloDe={codigosDe}
        opciones={MotivosReanudacionProduccion}
      />

      <DialogoCancelar
        dialogo={cancelacion}
        tituloDe={codigosDe}
        placeholder="Ej. Bobina dañada, error de registro..."
      />

      <AlertaFinalizar dialogo={finalizacion} prefijo="de" codigoDe={codigosDe} />
    </div>
    </TooltipProvider>
  );
}
