import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/layout/Header";
import {
  cargarLoteBobinaServilleta,
  ObtenerTiposBobinaServilleta,
} from "../../services/BobinaServilleta/BobinaServilleta";
import { ObtenerProveedoresForm } from "../../services/Proveedor/Proveedor";
import { dateFormatter } from "@/utils/dates";
import InputCodigo from "@/components/layout/InputCodigo";
import { codigoFinal } from "@/utils/handlers";
import { errorCodigo, numeroONulo } from "@/utils/validators";
import { useCatalogo } from "@/hooks/useCatalogo";
import { composicionFormato, soloActivos } from "@/utils/catalogo";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import {
  useFilasLote,
  useEnvioLote,
  codigosRepetidos,
  erroresPorFila,
} from "@/hooks/useIngresoLote";
import {
  PestanasIngreso,
  ResultadoLote,
  DatosLote,
  SelectorProveedor,
  SelectorTipo,
  EncabezadoFilas,
  CabeceraFila,
  ErrorFila,
  ErrorEnvio,
  BarraGuardarLote,
  DialogoConfirmarLote,
} from "@/components/IngresoLote/comunes";
import LoteReporteServilleta from "@/components/Reportes/BobinaServilleta/Lote";

const COLORES_UNIDAD = ["border-c3 text-c3", "border-serv3 text-serv3"];

const pesoInvalido = (v) => v !== "" && Number(v) <= 0;

const formatosActivos = (tipo) => (tipo?.Formatos ?? []).filter((f) => f.Activo);

const unidadVacia = (formatos, posicion) => ({
  Codigo: "",
  PesoBruto: "",
  Gramaje: "",
  IdFormato: formatos.length ? formatos[posicion % formatos.length].IdFormatoSubBobina : null,
});

const filaVaciaDe = (tipo) => () => {
  const formatos = formatosActivos(tipo);
  return {
    Unidades: Array.from({ length: tipo?.CantidadUnidades ?? 1 }, (_, i) =>
      unidadVacia(formatos, i),
    ),
  };
};

const unidadDe = (unidad) => ({
  CodigoBobina: codigoFinal(unidad.Codigo),
  IdFormatoSubBobina: unidad.IdFormato,
  PesoBrutoKg: numeroONulo(unidad.PesoBruto),
  GramajeGr: numeroONulo(unidad.Gramaje),
});

function SelectorFormato({ formatos, valor, onCambio }) {
  const seleccionado = formatos.find((f) => f.IdFormatoSubBobina === valor);

  if (formatos.length <= 1) {
    return (
      <span className="text-[12px] font-semibold text-slate-500">
        Formato {seleccionado?.DescripcionFormato ?? "sin configurar"}
        {seleccionado && ` · ${composicionFormato(seleccionado)}`}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        {formatos.map((formato) => (
          <button
            key={formato.IdFormatoSubBobina}
            type="button"
            aria-pressed={valor === formato.IdFormatoSubBobina}
            onClick={() => onCambio(formato.IdFormatoSubBobina)}
            className={PILDORA_FILTRO}
          >
            {formato.DescripcionFormato}
          </button>
        ))}
      </div>
      {seleccionado && (
        <span className="text-[12px] font-semibold text-slate-500">
          Genera {composicionFormato(seleccionado)}
        </span>
      )}
    </div>
  );
}

function BloqueUnidad({ numero, unidad, formatos, conError, onCampo, inputRef, onKeyDown }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-white p-3 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn("font-bold", COLORES_UNIDAD[(numero - 1) % COLORES_UNIDAD.length])}
        >
          Unidad {numero}
        </Badge>
        <SelectorFormato
          formatos={formatos}
          valor={unidad.IdFormato}
          onCambio={(idFormato) => onCampo("IdFormato", idFormato)}
        />
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[2fr_1fr_1fr]">
        <InputCodigo
          ref={inputRef}
          valor={unidad.Codigo}
          onCambio={(valor) => onCampo("Codigo", valor)}
          onKeyDown={onKeyDown}
          placeholder={`Código de la unidad ${numero}`}
          className={cn(
            "h-10 font-mono",
            conError && errorCodigo(codigoFinal(unidad.Codigo)) && "border-red-300 focus-visible:ring-red-300",
          )}
        />
        <Input
          value={unidad.PesoBruto}
          onChange={(e) => onCampo("PesoBruto", e.target.value)}
          placeholder="Bruto (kg)"
          type="number"
          step="0.01"
          className="h-10"
        />
        <Input
          value={unidad.Gramaje}
          onChange={(e) => onCampo("Gramaje", e.target.value)}
          placeholder="Gramaje (g)"
          type="number"
          step="0.01"
          className="h-10"
        />
      </div>
    </div>
  );
}

const errorDeUnidad = (unidad, numero, repetidos) => {
  const codigo = codigoFinal(unidad.Codigo);
  const errorDeCodigo = errorCodigo(codigo);
  if (errorDeCodigo) return `Unidad ${numero}: ${errorDeCodigo}`;
  if (repetidos.has(codigo)) return `Código de unidad ${numero} repetido`;
  if (!unidad.IdFormato) return `Selecciona el formato de la unidad ${numero}`;
  if (pesoInvalido(unidad.PesoBruto)) return `Peso bruto de unidad ${numero} inválido`;
  if (pesoInvalido(unidad.Gramaje)) return `Gramaje de unidad ${numero} inválido`;
  return null;
};

export default function IngresoBobinasServilleta({ usuario }) {
  const [idProveedor, setIdProveedor] = useState("");
  const [idTipoBobinaServilleta, setIdTipoBobinaServilleta] = useState(null);

  const proveedores = useCatalogo(ObtenerProveedoresForm);
  const tipos = useCatalogo(soloActivos(ObtenerTiposBobinaServilleta), (data) => {
    if (data.length) setIdTipoBobinaServilleta(data[0].IdTipoBobinaServilleta);
  });

  const tipoActual = tipos.datos.find(
    (t) => t.IdTipoBobinaServilleta === idTipoBobinaServilleta,
  );
  const formatos = formatosActivos(tipoActual);
  const cantidadUnidades = tipoActual?.CantidadUnidades ?? 1;

  const envio = useEnvioLote();
  const { tocado } = envio;
  const { filas, actualizarFila, agregarFila, quitarFila, registrarRef, reiniciar } =
    useFilasLote(filaVaciaDe(tipoActual), () => envio.setResultado(null));

  useEffect(() => {
    if (tipoActual) reiniciar();
  }, [idTipoBobinaServilleta, tipos.datos]);

  const repetidos = codigosRepetidos(filas.flatMap((f) => f.Unidades.map((u) => u.Codigo)));

  const erroresFilas = erroresPorFila(filas, (f) => {
    for (const [i, unidad] of f.Unidades.entries()) {
      const error = errorDeUnidad(unidad, i + 1, repetidos);
      if (error) return error;
    }
    return null;
  });
  const hayErrores = Object.keys(erroresFilas).length > 0;
  const sinFormatos = !!tipoActual && formatos.length === 0;

  const listo =
    !!idProveedor &&
    !!idTipoBobinaServilleta &&
    !sinFormatos &&
    filas.length > 0 &&
    !hayErrores;

  const cambiarUnidad = (fila, posicion, campo, valor) =>
    actualizarFila(
      fila.id,
      "Unidades",
      fila.Unidades.map((u, i) => (i === posicion ? { ...u, [campo]: valor } : u)),
    );

  const validarLote = () => {
    if (!idProveedor) return "Selecciona el proveedor del lote.";
    if (!idTipoBobinaServilleta) return "Selecciona el tipo de bobina del lote.";
    if (sinFormatos) return "El tipo de bobina no tiene formatos activos configurados.";
    if (hayErrores) return "Revisa las bobinas marcadas en rojo antes de guardar.";
    return null;
  };

  const guardarLote = () =>
    envio.guardar({
      validar: validarLote,
      enviar: () =>
        cargarLoteBobinaServilleta(
          Number(idProveedor),
          Number(idTipoBobinaServilleta),
          filas.map((f) => ({ Unidades: f.Unidades.map(unidadDe) })),
        ),
      alGuardar: (data) => {
        reiniciar();
        toast.success(
          `${data.CantidadBobinasServilleta} bobinas (${data.CantidadUnidades} unidades) ingresadas al almacén`,
        );
      },
    });

  return (
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header
        volver
        titulo="Almacén · Materia Prima"
        subtitulo="Registrar ingreso de bobinas de servilleta"
        contador={{
          valor: filas.length,
          singular: "bobina en el lote",
          plural: "bobinas en el lote",
        }}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        <PestanasIngreso lotes={<LoteReporteServilleta />}>
          {envio.resultado && (
            <ResultadoLote
              descripcion={
                <>
                  {envio.resultado.CantidadBobinasServilleta} bobinas ·{" "}
                  {envio.resultado.CantidadUnidades} unidades · Recepción{" "}
                  {dateFormatter(envio.resultado.FechaRecepcion)}
                </>
              }
              onCerrar={() => envio.setResultado(null)}
            />
          )}

          <DatosLote descripcion="Se aplican a todas las bobinas que registres abajo">
            <SelectorProveedor
              catalogo={proveedores}
              valor={idProveedor}
              onCambio={setIdProveedor}
              invalido={tocado && !idProveedor}
            />
            <SelectorTipo
              catalogo={tipos}
              valor={idTipoBobinaServilleta}
              onCambio={setIdTipoBobinaServilleta}
              campoValor="IdTipoBobinaServilleta"
              campoEtiqueta="NombreTipoBobinaServilleta"
              etiqueta="Tipo de bobina"
              mensajeVacio="No hay tipos de bobina servilleta registrados."
              cantidadSkeleton={2}
            />
          </DatosLote>

          {sinFormatos && (
            <ErrorEnvio mensaje="Este tipo de bobina no tiene formatos activos. Pide al administrador que los configure." />
          )}

          <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <EncabezadoFilas
              titulo="Bobinas del lote"
              tipo={tipoActual?.NombreTipoBobinaServilleta}
              nota={
                cantidadUnidades === 1
                  ? "Cada bobina lleva 1 unidad"
                  : `Cada bobina lleva ${cantidadUnidades} unidades, en orden de arriba hacia abajo`
              }
              textoAgregar="Agregar bobina"
              onAgregar={agregarFila}
            />

            <div className="flex flex-col gap-4 p-5">
              {filas.map((f, i) => {
                const err = tocado ? erroresFilas[f.id] : null;
                const ultimaUnidad = f.Unidades.length - 1;
                return (
                  <div
                    key={f.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border-2 p-4",
                      err ? "border-red-300 bg-red-50/50" : "border-slate-200 bg-slate-50",
                    )}
                  >
                    <CabeceraFila
                      titulo={`Bobina ${i + 1}`}
                      onQuitar={() => quitarFila(f.id)}
                      deshabilitado={filas.length === 1}
                    />

                    {f.Unidades.map((unidad, posicion) => (
                      <BloqueUnidad
                        key={posicion}
                        numero={posicion + 1}
                        unidad={unidad}
                        formatos={formatos}
                        conError={!!err}
                        onCampo={(campo, valor) => cambiarUnidad(f, posicion, campo, valor)}
                        inputRef={posicion === 0 ? registrarRef(f.id) : undefined}
                        onKeyDown={
                          posicion === ultimaUnidad
                            ? (e) => {
                                if (e.key === "Enter" && i === filas.length - 1) agregarFila();
                              }
                            : undefined
                        }
                      />
                    ))}

                    {err && <ErrorFila mensaje={err} />}
                  </div>
                );
              })}
            </div>
          </section>

          {envio.errorEnvio && <ErrorEnvio mensaje={envio.errorEnvio} />}

          <BarraGuardarLote listo={listo} enviando={envio.enviando} onGuardar={() => envio.pedirConfirmacion(validarLote)}>
            <span className="font-extrabold text-white">
              {filas.length} {filas.length === 1 ? "bobina" : "bobinas"}
            </span>
            <span className="text-slate-400">
              <strong className="text-slate-200">
                {filas.reduce((total, f) => total + f.Unidades.length, 0)}
              </strong>{" "}
              unidades
            </span>
          </BarraGuardarLote>
        </PestanasIngreso>
      </main>

      <DialogoConfirmarLote
        abierto={envio.confirmando}
        enviando={envio.enviando}
        cantidad={filas.length}
        unidad={filas.length === 1 ? "bobina" : "bobinas"}
        detalles={[
          {
            etiqueta: "Proveedor",
            valor:
              proveedores.datos.find((p) => String(p.IdProveedor) === String(idProveedor))
                ?.NombreProveedor ?? "-",
          },
          { etiqueta: "Tipo", valor: tipoActual?.NombreTipoBobinaServilleta ?? "-" },
          {
            etiqueta: "Unidades",
            valor: filas.reduce((total, f) => total + f.Unidades.length, 0),
          },
        ]}
        codigos={filas.flatMap((f) => f.Unidades.map((u) => codigoFinal(u.Codigo)))}
        editable="el código, el peso y el gramaje de cada unidad"
        onCancelar={envio.cancelarConfirmacion}
        onConfirmar={guardarLote}
      />
    </div>
  );
}
