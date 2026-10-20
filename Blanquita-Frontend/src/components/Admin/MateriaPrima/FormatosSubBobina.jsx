import { useEffect, useState } from "react";
import { Disc, Pencil, Plus, Scissors, ToggleRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import InputForModal from "@/components/layout/InputForModal";
import { BadgeEstado } from "@/components/Reportes/comunes";
import { BotonEnviar, ErrorDialogo } from "@/components/Admin/Usuarios/Dialogos";
import { CamposStock, errorStock } from "@/components/Admin/CamposStock";
import { ANCHO_DIALOGO_ADMIN, CasillaConfirmacion } from "@/components/Admin/CasillaConfirmacion";
import { useCatalogo } from "@/hooks/useCatalogo";
import {
  MEDIDA_MINIMA_SUB_BOBINA_MM as MEDIDA_MIN,
  MEDIDA_MAXIMA_SUB_BOBINA_MM as MEDIDA_MAX,
  CANTIDAD_MAXIMA_SUB_BOBINAS_POR_MEDIDA as CANTIDAD_MAX,
  MEDIDAS_MAXIMAS_POR_FORMATO as FILAS_MAX,
} from "@/constants/Values";
import { descripcionFormato } from "@/models/BobinaServilleta/FormatoSubBobina";
import {
  listarFormatosSubBobina,
  crearFormatoSubBobina,
  cambiarEstadoFormatoSubBobina,
} from "@/services/BobinaServilleta/FormatoSubBobina";
import { listarUmbralesStock, editarUmbralStock } from "@/services/AlertaStock/AlertaStock";
import {
  BadgeStock,
  BotonAccion,
  DialogoCambiarEstadoTipo,
  ESTILOS_ESTADO_TIPO,
  textoUmbral,
} from "./comunes";

const DOMINIO_SUB_BOBINA = "subbobina";

const CONFIG_ESTADO = {
  idDe: (f) => f.IdFormatoSubBobina,
  nombreDe: (f) => `Formato ${f.DescripcionFormato}`,
  resumenEstado: (f) => `${f.CantidadUnidades} unidades registradas`,
  descripcionEstado:
    "Un formato inactivo no se ofrece al registrar bobinas nuevas ni se puede asignar a otros tipos. Las bobinas ya registradas con este formato se abren igual.",
  cambiarEstado: cambiarEstadoFormatoSubBobina,
};

const FILA_VACIA = { MedidaMm: "", Cantidad: "", StockMinimo: "", StockPreventivo: "" };

function erroresFila(fila, filas, esNueva) {
  const errores = {};
  const medida = Number(fila.MedidaMm);
  const cantidad = Number(fila.Cantidad);
  if (fila.MedidaMm === "") errores.MedidaMm = "Obligatorio";
  else if (medida < MEDIDA_MIN || medida > MEDIDA_MAX)
    errores.MedidaMm = `Entre ${MEDIDA_MIN} y ${MEDIDA_MAX} mm`;
  else if (filas.filter((f) => Number(f.MedidaMm) === medida).length > 1)
    errores.MedidaMm = "Medida repetida";
  if (fila.Cantidad === "") errores.Cantidad = "Obligatorio";
  else if (cantidad < 1 || cantidad > CANTIDAD_MAX) errores.Cantidad = `Entre 1 y ${CANTIDAD_MAX}`;
  if (esNueva) {
    const stock = errorStock(fila.StockMinimo, fila.StockPreventivo);
    if (stock) errores.Stock = stock;
  }
  return errores;
}

function DialogoFormato({ abierto, formatos, onCerrar, onGuardado }) {
  const [filas, setFilas] = useState([FILA_VACIA]);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierto) return;
    setFilas([FILA_VACIA]);
    setConfirmado(false);
    setError("");
  }, [abierto]);

  const cambiarFila = (indice, campo, valor) => {
    setFilas((previas) =>
      previas.map((f, i) => (i === indice ? { ...f, [campo]: String(valor).replace(/\D/g, "") } : f)),
    );
    setConfirmado(false);
  };

  const medidasConocidas = new Set(formatos.flatMap((f) => f.Detalle.map((d) => d.MedidaMm)));
  const esNueva = (fila) => {
    const medida = Number(fila.MedidaMm);
    return fila.MedidaMm !== "" && medida >= MEDIDA_MIN && medida <= MEDIDA_MAX && !medidasConocidas.has(medida);
  };
  const errores = filas.map((f) => erroresFila(f, filas, esNueva(f)));
  const descripcion = descripcionFormato(filas);
  const medidasNuevas = [...new Set(filas.filter(esNueva).map((f) => Number(f.MedidaMm)))];
  const repetido = formatos.find((f) => f.DescripcionFormato === descripcion);
  const valido =
    errores.every((e) => Object.keys(e).length === 0) && !repetido && confirmado && descripcion;

  const confirmar = async () => {
    setEnviando(true);
    setError("");
    try {
      onGuardado(
        await crearFormatoSubBobina(
          filas.map((f) => (esNueva(f) ? f : { ...f, StockMinimo: "", StockPreventivo: "" })),
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && !enviando && onCerrar()}>
      <DialogContent className={ANCHO_DIALOGO_ADMIN}>
        <DialogHeader>
          <DialogTitle>Registrar formato de corte</DialogTitle>
          <DialogDescription>
            Indica cuántas sub-bobinas de cada medida salen de una unidad al abrirla. El nombre se
            arma solo y el formato no se puede editar después.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {filas.map((fila, i) => (
              <div key={i} className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <InputForModal
                  id={`formato-medida-${i}`}
                  etiqueta={i === 0 ? "Medida (mm)" : ""}
                  valor={fila.MedidaMm}
                  onCambio={(v) => cambiarFila(i, "MedidaMm", v)}
                  inputMode="numeric"
                  placeholder="Ej. 435"
                  error={errores[i].MedidaMm}
                  className="flex-1"
                />
                <InputForModal
                  id={`formato-cantidad-${i}`}
                  etiqueta={i === 0 ? "Sub-bobinas" : ""}
                  valor={fila.Cantidad}
                  onCambio={(v) => cambiarFila(i, "Cantidad", v)}
                  inputMode="numeric"
                  placeholder="Ej. 2"
                  error={errores[i].Cantidad}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={filas.length === 1}
                  onClick={() => setFilas((previas) => previas.filter((_, j) => j !== i))}
                  className={i === 0 ? "mt-6 h-11 w-11 text-slate-400" : "h-11 w-11 text-slate-400"}
                  aria-label="Quitar medida"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              {esNueva(fila) && (
                <CamposStock
                  prefijoId={`formato-${i}`}
                  titulo={`Alerta de stock · medida nueva ${fila.MedidaMm} mm`}
                  ayuda="En sub-bobinas en almacén. Rojo en el mínimo o menos, amarillo hasta el preventivo. Déjalos vacíos para no alertar; luego se pueden cambiar en Medidas de sub-bobina."
                  stockMinimo={fila.StockMinimo}
                  stockPreventivo={fila.StockPreventivo}
                  onCambio={(campo, valor) => cambiarFila(i, campo, valor)}
                />
              )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={filas.length >= FILAS_MAX}
              onClick={() => setFilas((previas) => [...previas, FILA_VACIA])}
              className="h-10 self-start gap-1.5 font-bold"
            >
              <Plus size={15} strokeWidth={2.5} />
              Agregar medida
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Formato</div>
            <div className="font-mono text-lg font-extrabold text-slate-900">{descripcion || "—"}</div>
            {repetido && (
              <div className="text-xs font-semibold text-red-600">Este formato ya está registrado.</div>
            )}
            {medidasNuevas.length > 0 && (
              <div className="text-xs font-semibold text-amber-700">
                Se creará la medida {medidasNuevas.map((m) => `${m} mm`).join(", ")} con su propio
                inventario de sub-bobinas.
              </div>
            )}
          </div>

          <CasillaConfirmacion
            marcada={confirmado}
            onCambio={setConfirmado}
            titulo={`Confirmo el registro del formato${descripcion ? ` «${descripcion}»` : ""}`}
          >
            El registro quedará en el historial de acciones del administrador. El formato no se puede
            eliminar ni cambiar: si el corte cambia, registra uno nuevo y desactiva el anterior. Luego
            asígnalo a los tipos que lo usan.
          </CasillaConfirmacion>

          {error && <ErrorDialogo mensaje={error} />}
        </div>

        <DialogFooter>
          <BotonEnviar
            onClick={confirmar}
            enviando={enviando}
            deshabilitado={!valido}
            className="bg-slate-900 hover:bg-slate-800"
          >
            Registrar formato
          </BotonEnviar>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TarjetaFormato({ formato, onCambiarEstado }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-2 bg-white p-4 shadow-sm",
        formato.Activo ? "border-slate-200" : "border-dashed border-slate-200 opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Scissors className="h-6 w-6 shrink-0 text-c3" strokeWidth={2.25} />
          <span className="font-mono text-[17px] font-extrabold text-slate-900">
            {formato.DescripcionFormato}
          </span>
        </div>
        <BadgeEstado estado={formato.NombreEstado} estilos={ESTILOS_ESTADO_TIPO} className="shrink-0" />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Una unidad se corta en
        </span>
        <div className="flex flex-wrap gap-1.5">
          {formato.Detalle.map((d) => (
            <span
              key={d.IdTipoMedidaSubBobina}
              className="rounded-lg bg-c4/10 px-2.5 py-1 text-[12.5px] font-bold text-c3 tabular-nums"
            >
              {d.Cantidad} × {d.MedidaMm} mm
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Permitido en
        </span>
        {formato.Tipos.length ? (
          <div className="flex flex-wrap gap-1.5">
            {formato.Tipos.map((t) => (
              <span
                key={t.IdTipoBobinaServilleta}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-[12.5px] font-semibold text-slate-700"
              >
                {t.NombreTipoBobinaServilleta}
                {!t.Activo && " (inactivo)"}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[12.5px] font-semibold text-amber-700">
            Sin asignar: edita un tipo de servilleta para permitirlo
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5">
        <span className="text-[12.5px] text-slate-600">
          Unidades registradas: <strong className="text-slate-900">{formato.CantidadUnidades}</strong>
        </span>
        <BotonAccion ayuda="Cambiar estado" icono={ToggleRight} onClick={() => onCambiarEstado(formato)} />
      </div>
    </div>
  );
}

function DialogoUmbralMedida({ medida, onCerrar, onGuardado }) {
  const [datos, setDatos] = useState({ StockMinimo: "", StockPreventivo: "" });
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!medida) return;
    setDatos({
      StockMinimo: medida.StockMinimo ?? "",
      StockPreventivo: medida.StockPreventivo ?? "",
    });
    setConfirmado(false);
    setError("");
  }, [medida]);

  const sinCambios =
    medida &&
    String(medida.StockMinimo ?? "") === String(datos.StockMinimo) &&
    String(medida.StockPreventivo ?? "") === String(datos.StockPreventivo);
  const valido =
    medida && !errorStock(datos.StockMinimo, datos.StockPreventivo) && !sinCambios && confirmado;

  const confirmar = async () => {
    setEnviando(true);
    setError("");
    try {
      onGuardado(await editarUmbralStock(DOMINIO_SUB_BOBINA, medida.Id, datos));
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={Boolean(medida)} onOpenChange={(open) => !open && !enviando && onCerrar()}>
      <DialogContent className={ANCHO_DIALOGO_ADMIN}>
        <DialogHeader>
          <DialogTitle>Alerta de stock</DialogTitle>
          <DialogDescription>
            Define cuándo avisar que quedan pocas sub-bobinas de esta medida en almacén.
          </DialogDescription>
        </DialogHeader>

        {medida && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[15px] font-extrabold text-slate-900">{medida.Nombre}</div>
              <div className="text-[12.5px] text-slate-500">
                {medida.CantidadActual} sub-bobinas en almacén · {textoUmbral(medida)}
              </div>
            </div>

            <CamposStock
              prefijoId="medida"
              stockMinimo={datos.StockMinimo}
              stockPreventivo={datos.StockPreventivo}
              onCambio={(campo, valor) => {
                setDatos((previos) => ({ ...previos, [campo]: valor }));
                setConfirmado(false);
              }}
              unidad="sub-bobinas en almacén"
            />

            <CasillaConfirmacion
              marcada={confirmado}
              onCambio={setConfirmado}
              titulo={`Confirmo el cambio de alerta de ${medida.Nombre}`}
            >
              El cambio quedará registrado en el historial de acciones del administrador con el valor
              anterior y el nuevo.
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
            Guardar alerta
          </BotonEnviar>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TarjetaMedida({ medida, onEditar }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border-2 bg-white p-4 shadow-sm",
        medida.Activo ? "border-slate-200" : "border-dashed border-slate-200 opacity-75",
      )}
    >
      <div className="flex items-center gap-3">
        <Disc className="h-7 w-7 shrink-0 text-c3" strokeWidth={2} />
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-extrabold text-slate-900">{medida.Nombre}</span>
            <BadgeStock cantidad={medida.CantidadActual} tipo={medida} />
          </div>
          <span className="text-[12.5px] text-slate-600">
            <strong className="text-slate-900">{medida.CantidadActual}</strong> en almacén ·{" "}
            {textoUmbral(medida)}
          </span>
        </div>
      </div>
      <BotonAccion ayuda="Editar alerta de stock" icono={Pencil} onClick={() => onEditar(medida)} />
    </div>
  );
}

export default function FormatosSubBobina({ creando, onCerrarCreacion, onContador, irA }) {
  const formatos = useCatalogo(listarFormatosSubBobina);
  const medidas = useCatalogo(() => listarUmbralesStock(DOMINIO_SUB_BOBINA));
  const [cambioEstado, setCambioEstado] = useState(null);
  const [editandoMedida, setEditandoMedida] = useState(null);

  useEffect(() => {
    onContador(
      formatos.cargando ? null : { valor: formatos.datos.length, singular: "formato", plural: "formatos" },
    );
  }, [formatos.cargando, formatos.datos]);

  const alGuardar = (creado) => {
    onCerrarCreacion();
    toast.success(`Formato ${creado.DescripcionFormato} registrado`, {
      description: "Asígnalo a los tipos de servilleta que lo usan.",
      action: { label: "Ir a tipos", onClick: () => irA("tipos") },
    });
    formatos.recargar();
    medidas.recargar();
  };

  const alCambiarEstado = (resultado) => {
    setCambioEstado(null);
    toast.success(`${resultado.Nombre}: ${resultado.NombreEstadoAnterior} → ${resultado.NombreEstado}`);
    formatos.recargar();
  };

  const alGuardarMedida = (guardada) => {
    setEditandoMedida(null);
    toast.success(`Alerta de ${guardada.Nombre} actualizada`);
    medidas.recargar();
  };

  return (
    <div className="flex flex-col gap-8">
      <section>
        {formatos.cargando ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        ) : formatos.error ? (
          <div className="rounded-xl bg-red-50 p-5 text-center text-sm font-semibold text-red-600">
            {formatos.error}
          </div>
        ) : formatos.datos.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 ring-1 ring-slate-200">
            Todavía no hay formatos de corte registrados.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {formatos.datos.map((f) => (
              <TarjetaFormato key={f.IdFormatoSubBobina} formato={f} onCambiarEstado={setCambioEstado} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-extrabold text-slate-900">Medidas de sub-bobina</h2>
          <span className="text-[12.5px] text-slate-500">
            Cada medida tiene su propio inventario. Define aquí cuándo avisar que quedan pocas
            sub-bobinas; las medidas nuevas se crean al registrar un formato.
          </span>
        </div>

        {medidas.cargando ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : medidas.error ? (
          <div className="rounded-xl bg-red-50 p-5 text-center text-sm font-semibold text-red-600">
            {medidas.error}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {medidas.datos.map((m) => (
              <TarjetaMedida key={m.Id} medida={m} onEditar={setEditandoMedida} />
            ))}
          </div>
        )}
      </section>

      <DialogoFormato
        abierto={creando}
        formatos={formatos.datos}
        onCerrar={onCerrarCreacion}
        onGuardado={alGuardar}
      />
      <DialogoCambiarEstadoTipo
        tipo={cambioEstado}
        config={CONFIG_ESTADO}
        onCerrar={() => setCambioEstado(null)}
        onCambiado={alCambiarEstado}
      />
      <DialogoUmbralMedida
        medida={editandoMedida}
        onCerrar={() => setEditandoMedida(null)}
        onGuardado={alGuardarMedida}
      />
    </div>
  );
}
