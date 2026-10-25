import { useState, useEffect, useMemo } from "react";
import {
  NotebookPen,
  Save,
  CircleCheck,
  Ban,
  Loader2,
  Lock,
  TriangleAlert,
  ClipboardCheck,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/layout/Header";
import { BotonDescarga } from "@/components/layout/BotonDescarga";
import { BadgeInactivo } from "@/components/Inventario/comunes";
import {
  verConteoActivo,
  listarConteos,
  iniciarConteo,
  registrarCantidadesConteo,
  cerrarConteo,
  anularConteo,
  descargarHojaConteo,
} from "@/services/Inventario/Conteo";
import { EsGerente } from "@/utils/validators";
import {
  CANTIDAD_MAXIMA_CONTEO_PRODUCTO_TERMINADO,
  HORA_LIMITE_INICIO_CONTEO,
  MOTIVO_CORRECCION_MIN,
  MOTIVO_CORRECCION_MAX,
} from "@/constants/Values";
import {
  MotivosInicioConteoProductoTerminado,
  MotivosDiferenciaConteoProductoTerminado,
} from "@/constants/OperadorConfig";
import {
  ESTADO_CONTEO,
  esMotivoValido,
  fechaHora,
  textoDiferencia,
  claseDiferencia,
  BadgeEstadoConteo,
  CampoMotivo,
  DialogoConfirmacion,
  HistorialConteos,
} from "./comunes";

const MENSAJE_MOTIVO = `El motivo debe tener entre ${MOTIVO_CORRECCION_MIN} y ${MOTIVO_CORRECCION_MAX} caracteres`;

const REGLAS_CONTEO = [
  "Se cuentan todas las presentaciones activas y las inactivas que todavía tienen stock.",
  "Mientras el conteo esté abierto se bloquean ingresos, correcciones, ajustes y salidas de producto terminado.",
  "Al cerrar, cada diferencia genera su ajuste con el motivo que indiques.",
  `Solo se puede iniciar antes de las ${HORA_LIMITE_INICIO_CONTEO}:00.`,
];

const textoCantidad = (valor) => (valor === null || valor === undefined ? "" : String(valor));

function agruparPorLinea(detalle) {
  const lineas = new Map();
  for (const item of detalle) {
    if (!lineas.has(item.IdProducto)) {
      lineas.set(item.IdProducto, { nombre: item.NombreProducto, unidad: item.Unidad, items: [] });
    }
    lineas.get(item.IdProducto).items.push(item);
  }
  return [...lineas.values()];
}

function PanelIniciar({ onIniciar }) {
  const [motivo, setMotivo] = useState("");
  const [tocado, setTocado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const fueraDeHora = new Date().getHours() >= HORA_LIMITE_INICIO_CONTEO;

  const solicitar = () => {
    setTocado(true);
    if (!esMotivoValido(motivo)) {
      toast.error(MENSAJE_MOTIVO);
      return;
    }
    setConfirmado(false);
    setConfirmando(true);
  };

  const confirmar = async () => {
    setEnviando(true);
    try {
      await onIniciar(motivo.trim());
      setConfirmando(false);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-c4/10 text-c3">
          <NotebookPen size={22} strokeWidth={2.25} />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-[16px] font-extrabold text-slate-900">Iniciar conteo físico</h2>
          <p className="text-[13px] text-slate-600">
            Revisión exhaustiva de todo el producto terminado. Descarga la hoja de conteo para anotar
            en planta y luego carga las cantidades aquí.
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5 rounded-xl bg-slate-50 p-3.5 text-[12.5px] text-slate-700">
        {REGLAS_CONTEO.map((regla) => (
          <li key={regla} className="flex items-start gap-2">
            <Lock size={13} strokeWidth={2.5} className="mt-0.5 shrink-0 text-slate-400" />
            {regla}
          </li>
        ))}
      </ul>

      <CampoMotivo
        id="motivo-inicio-conteo"
        etiqueta="Motivo del conteo"
        valor={motivo}
        onCambio={setMotivo}
        opciones={MotivosInicioConteoProductoTerminado}
        tocado={tocado}
        placeholder="Elige una opción o escribe por qué haces el conteo"
      />

      {fueraDeHora && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-amber-800 ring-1 ring-amber-200">
          <TriangleAlert size={15} strokeWidth={2.5} />
          Después de las {HORA_LIMITE_INICIO_CONTEO}:00 no se puede iniciar un conteo.
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={solicitar}
          disabled={fueraDeHora}
          className="h-11 gap-2 bg-c3 font-extrabold text-white hover:bg-c3/90"
        >
          <NotebookPen size={16} strokeWidth={2.75} />
          Iniciar conteo
        </Button>
      </div>

      <DialogoConfirmacion
        abierto={confirmando}
        onCambio={setConfirmando}
        titulo="Confirmar inicio del conteo"
        descripcion="Nadie podrá registrar ingresos, correcciones, ajustes ni salidas de producto terminado hasta que cierres o anules el conteo."
        textoConfirmacion="Estoy seguro de iniciar el conteo físico"
        confirmado={confirmado}
        onConfirmado={setConfirmado}
        enviando={enviando}
        onConfirmar={confirmar}
        textoBoton="Iniciar"
        icono={NotebookPen}
        claseBoton="bg-c3 hover:bg-c3/90"
      >
        <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[12.5px] text-slate-600">
          <span className="font-bold text-slate-500">Motivo: </span>
          {motivo.trim()}
        </div>
      </DialogoConfirmacion>
    </section>
  );
}

function FilaConteo({ item, valor, soloLectura, onCambio }) {
  const fisico = valor === "" ? null : Number(valor);
  const diferencia = fisico === null ? null : fisico - item.CantidadSistema;

  const manejarCambio = (e) => {
    const limpio = e.target.value.replace(/\D/g, "");
    if (limpio === "") return onCambio("");
    onCambio(String(Math.min(CANTIDAD_MAXIMA_CONTEO_PRODUCTO_TERMINADO, Number(limpio))));
  };

  return (
    <div className="grid grid-cols-3 items-center gap-x-3 gap-y-2 border-t border-slate-100 px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_5.5rem_7.5rem_5.5rem]">
      <div className="col-span-3 flex min-w-0 flex-col sm:col-span-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[14px] font-extrabold text-c3">{item.CodigoPresentacion}</span>
          {!item.Activo && <BadgeInactivo />}
        </div>
        <span className="text-[12.5px] text-slate-500">
          {item.NombrePresentacion} · {item.TipoContenedor}
        </span>
      </div>
      <div className="flex flex-col sm:items-end">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400 sm:hidden">Sistema</span>
        <span className="text-[15px] font-extrabold tabular-nums text-slate-700">{item.CantidadSistema}</span>
      </div>
      {soloLectura ? (
        <div className="flex flex-col sm:items-end">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400 sm:hidden">Físico</span>
          <span className="text-[15px] font-extrabold tabular-nums text-slate-900">{valor === "" ? "-" : valor}</span>
        </div>
      ) : (
        <Input
          inputMode="numeric"
          value={valor}
          onChange={manejarCambio}
          placeholder="Físico"
          aria-label={`Cantidad física de ${item.CodigoPresentacion}`}
          className={cn(
            "h-11 text-center text-lg font-extrabold tabular-nums",
            valor !== "" && "border-c4 bg-c4/5",
          )}
        />
      )}
      <span
        className={cn(
          "justify-self-end rounded-full px-2.5 py-1 text-center text-[13px] font-extrabold tabular-nums sm:justify-self-center",
          claseDiferencia(diferencia),
        )}
      >
        {textoDiferencia(diferencia)}
      </span>
    </div>
  );
}

function PanelConteo({ conteo, horasAlerta, soloLectura, onActualizado, onFinalizado }) {
  const [cambios, setCambios] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [dialogo, setDialogo] = useState(null);
  const [motivos, setMotivos] = useState({});
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [tocado, setTocado] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const valorDe = (item) =>
    cambios[item.IdPresentacion] !== undefined
      ? cambios[item.IdPresentacion]
      : textoCantidad(item.CantidadFisica);

  const pendientes = conteo.Detalle.filter(
    (item) =>
      cambios[item.IdPresentacion] !== undefined &&
      cambios[item.IdPresentacion] !== "" &&
      cambios[item.IdPresentacion] !== textoCantidad(item.CantidadFisica),
  );
  const contadas = conteo.Detalle.filter((item) => valorDe(item) !== "").length;
  const lineas = useMemo(() => agruparPorLinea(conteo.Detalle), [conteo.Detalle]);
  const diferencias = conteo.Detalle.filter((item) => item.Diferencia);
  const porcentaje = conteo.TotalPresentaciones
    ? Math.round((contadas / conteo.TotalPresentaciones) * 100)
    : 0;

  useEffect(() => {
    if (pendientes.length === 0) return;
    const avisar = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [pendientes.length]);

  const guardar = async () => {
    if (pendientes.length === 0) return conteo;
    setGuardando(true);
    try {
      const actualizado = await registrarCantidadesConteo(
        conteo.IdConteoProductoTerminado,
        pendientes.map((item) => ({
          IdPresentacion: item.IdPresentacion,
          CantidadFisica: cambios[item.IdPresentacion],
        })),
      );
      setCambios({});
      onActualizado(actualizado);
      toast.success(`${pendientes.length} cantidades guardadas`);
      return actualizado;
    } catch (e) {
      toast.error(e.message);
      return null;
    } finally {
      setGuardando(false);
    }
  };

  const abrirDialogo = (tipo) => {
    setTocado(false);
    setConfirmado(false);
    setDialogo(tipo);
  };

  const solicitarCierre = async () => {
    const actualizado = await guardar();
    if (!actualizado) return;
    const faltan = actualizado.Detalle.filter((item) => item.CantidadFisica === null).length;
    if (faltan > 0) {
      toast.error(`Faltan ${faltan} presentaciones por contar antes de cerrar`);
      return;
    }
    abrirDialogo("cerrar");
  };

  const confirmarCierre = async () => {
    setTocado(true);
    if (diferencias.some((item) => !esMotivoValido(motivos[item.IdPresentacion]))) {
      toast.error(`Indica el motivo de cada diferencia. ${MENSAJE_MOTIVO}`);
      return;
    }
    setEnviando(true);
    try {
      const motivosLimpios = Object.fromEntries(
        diferencias.map((item) => [item.IdPresentacion, motivos[item.IdPresentacion].trim()]),
      );
      await cerrarConteo(conteo.IdConteoProductoTerminado, motivosLimpios, confirmado);
      toast.success(
        diferencias.length
          ? `Conteo cerrado con ${diferencias.length} ajustes`
          : "Conteo cerrado sin diferencias",
      );
      setDialogo(null);
      onFinalizado();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const confirmarAnulacion = async () => {
    setTocado(true);
    if (!esMotivoValido(motivoAnulacion)) {
      toast.error(MENSAJE_MOTIVO);
      return;
    }
    setEnviando(true);
    try {
      await anularConteo(conteo.IdConteoProductoTerminado, motivoAnulacion.trim(), confirmado);
      toast.success("Conteo anulado");
      setDialogo(null);
      onFinalizado();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <NotebookPen size={22} strokeWidth={2.25} />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-extrabold text-amber-900">
                  Conteo N° {conteo.IdConteoProductoTerminado}
                </span>
                <BadgeEstadoConteo estado={ESTADO_CONTEO.Abierto} />
              </div>
              <span className="text-[12.5px] text-amber-800">
                {conteo.UsuarioInicio} · desde {fechaHora(conteo.FechaHoraInicio)}
              </span>
              <span className="break-words text-[12.5px] text-amber-800">
                <span className="font-bold">Motivo: </span>
                {conteo.MotivoInicio}
              </span>
              {conteo.Atrasado && (
                <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11.5px] font-bold text-red-700">
                  <TriangleAlert size={12} strokeWidth={2.5} />
                  Abierto hace más de {horasAlerta} h
                </span>
              )}
            </div>
          </div>
          {!soloLectura && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => abrirDialogo("anular")}
                className="h-11 gap-2 border-2 border-slate-300 font-bold text-slate-700"
              >
                <Ban size={16} strokeWidth={2.5} />
                Anular
              </Button>
              <Button
                onClick={solicitarCierre}
                disabled={guardando}
                className="h-11 gap-2 bg-emerald-600 font-extrabold text-white hover:bg-emerald-700"
              >
                <CircleCheck size={16} strokeWidth={2.75} />
                Revisar y cerrar
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[12.5px] font-bold text-amber-900">
            <span>
              {contadas} de {conteo.TotalPresentaciones} presentaciones contadas
            </span>
            <span className="tabular-nums">{porcentaje}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-amber-100">
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${porcentaje}%` }} />
          </div>
        </div>
      </section>

      {lineas.map((linea) => (
        <section key={linea.nombre} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
            <span className="text-[14px] font-extrabold text-slate-800">{linea.nombre}</span>
            <span className="text-[12px] font-bold uppercase tracking-wide text-slate-400">en {linea.unidad}</span>
          </div>
          <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_7.5rem_5.5rem] gap-3 px-4 pt-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 sm:grid">
            <span>Presentación</span>
            <span className="text-right">Sistema</span>
            <span className="text-center">Físico</span>
            <span className="text-center">Diferencia</span>
          </div>
          {linea.items.map((item) => (
            <FilaConteo
              key={item.IdPresentacion}
              item={item}
              valor={valorDe(item)}
              soloLectura={soloLectura}
              onCambio={(valor) => setCambios((prev) => ({ ...prev, [item.IdPresentacion]: valor }))}
            />
          ))}
        </section>
      ))}

      {!soloLectura && (
        <div className="flex justify-end">
          <Button
            onClick={guardar}
            disabled={guardando || pendientes.length === 0}
            className="h-12 gap-2 bg-c3 px-5 font-extrabold text-white hover:bg-c3/90"
          >
            {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={2.75} />}
            {pendientes.length ? `Guardar cantidades (${pendientes.length})` : "Cantidades guardadas"}
          </Button>
        </div>
      )}

      <DialogoConfirmacion
        abierto={dialogo === "cerrar"}
        onCambio={(abierto) => !abierto && setDialogo(null)}
        titulo="Cerrar conteo físico"
        descripcion={
          diferencias.length
            ? `Hay ${diferencias.length} presentaciones con diferencia. Al cerrar se generará un ajuste por cada una y el stock quedará igual a lo contado.`
            : "Todas las presentaciones coinciden con el sistema. El conteo se cerrará sin ajustes."
        }
        textoConfirmacion="Estoy seguro de cerrar el conteo y aplicar los ajustes"
        confirmado={confirmado}
        onConfirmado={setConfirmado}
        enviando={enviando}
        onConfirmar={confirmarCierre}
        textoBoton="Cerrar conteo"
        icono={ClipboardCheck}
        claseBoton="bg-emerald-600 hover:bg-emerald-700"
        anchoGrande={diferencias.length > 0}
      >
        {diferencias.length > 0 && (
          <div className="flex flex-col gap-3">
            {diferencias.map((item) => (
              <div key={item.IdPresentacion} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[14px] font-extrabold text-c3">{item.CodigoPresentacion}</span>
                  <span className="text-[12.5px] font-semibold text-slate-600">
                    Sistema {item.CantidadSistema} · Físico {item.CantidadFisica}{" "}
                    <span className={cn("ml-1 rounded-full px-2 py-0.5 font-extrabold", claseDiferencia(item.Diferencia))}>
                      {textoDiferencia(item.Diferencia)}
                    </span>
                  </span>
                </div>
                <CampoMotivo
                  id={`motivo-diferencia-${item.IdPresentacion}`}
                  valor={motivos[item.IdPresentacion] ?? ""}
                  onCambio={(valor) => setMotivos((prev) => ({ ...prev, [item.IdPresentacion]: valor }))}
                  opciones={MotivosDiferenciaConteoProductoTerminado}
                  tocado={tocado}
                  placeholder="Motivo de la diferencia"
                />
              </div>
            ))}
          </div>
        )}
      </DialogoConfirmacion>

      <DialogoConfirmacion
        abierto={dialogo === "anular"}
        onCambio={(abierto) => !abierto && setDialogo(null)}
        titulo="Anular conteo físico"
        descripcion="No se generará ningún ajuste y los movimientos de producto terminado se habilitarán de nuevo."
        textoConfirmacion="Estoy seguro de anular el conteo"
        confirmado={confirmado}
        onConfirmado={setConfirmado}
        enviando={enviando}
        onConfirmar={confirmarAnulacion}
        textoBoton="Anular conteo"
        icono={Ban}
        claseBoton="bg-red-600 hover:bg-red-700"
      >
        <CampoMotivo
          id="motivo-anulacion-conteo"
          etiqueta="Motivo de la anulación"
          valor={motivoAnulacion}
          onCambio={setMotivoAnulacion}
          tocado={tocado}
          placeholder="Por qué se anula el conteo"
        />
      </DialogoConfirmacion>
    </div>
  );
}

export default function ConteoFisico({ usuario }) {
  const soloLectura = EsGerente(usuario?.IdRol);
  const [estado, setEstado] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vista, setVista] = useState("conteo");

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setLoading(true);
    setError("");
    try {
      const [activo, conteos] = await Promise.all([verConteoActivo(), listarConteos()]);
      setEstado(activo);
      setHistorial(conteos.filter((c) => c.Estado !== ESTADO_CONTEO.Abierto));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const iniciar = async (motivo) => {
    try {
      const conteo = await iniciarConteo(motivo);
      setEstado((prev) => ({ ...prev, Abierto: true, Conteo: conteo }));
      toast.success(`Conteo N° ${conteo.IdConteoProductoTerminado} iniciado`);
    } catch (e) {
      toast.error(e.message);
      throw e;
    }
  };

  const conteo = estado?.Conteo;

  return (
    <div className="contenido-con-sidebar flex min-h-screen flex-col bg-slate-50 pt-20 font-sans text-slate-900 md:pt-0">
      <TooltipProvider>
        <Header
          titulo="Producto terminado"
          subtitulo={vista === "conteo" ? "Conteo físico" : "Conteos anteriores"}
        >
          <BotonDescarga
            texto="Hoja de conteo"
            ayuda="PDF para anotar el conteo en planta, sin el stock del sistema"
            exito="Hoja de conteo descargada"
            descargar={descargarHojaConteo}
          />
        </Header>
      </TooltipProvider>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 sm:px-6">
        <Tabs value={vista} onValueChange={setVista} className="mb-5">
          <TabsList className="grid w-full grid-cols-2 sm:w-96">
            <TabsTrigger value="conteo" className="gap-1.5 font-bold">
              <NotebookPen size={15} strokeWidth={2.75} />
              Conteo
            </TabsTrigger>
            <TabsTrigger value="anteriores" className="gap-1.5 font-bold">
              <History size={15} strokeWidth={2.75} />
              Historial
              {!loading && historial.length > 0 && (
                <span className="min-w-5 rounded-full bg-slate-200 px-1.5 text-center text-[11.5px] font-extrabold tabular-nums text-slate-700">
                  {historial.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-white p-6 text-center text-sm font-semibold text-red-600 ring-1 ring-slate-200">
            {error}
            <div className="mt-3">
              <Button variant="outline" onClick={cargar}>
                Reintentar
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            <div hidden={vista !== "conteo"}>
              {conteo ? (
                <PanelConteo
                  key={conteo.IdConteoProductoTerminado}
                  conteo={conteo}
                  horasAlerta={estado.HorasAlerta}
                  soloLectura={soloLectura}
                  onActualizado={(actualizado) => setEstado((prev) => ({ ...prev, Conteo: actualizado }))}
                  onFinalizado={cargar}
                />
              ) : soloLectura ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
                  <NotebookPen size={26} strokeWidth={2} className="text-slate-400" />
                  No hay un conteo físico en curso.
                </div>
              ) : (
                <PanelIniciar onIniciar={iniciar} />
              )}
            </div>
            <div hidden={vista !== "anteriores"}>
              <HistorialConteos conteos={historial} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
