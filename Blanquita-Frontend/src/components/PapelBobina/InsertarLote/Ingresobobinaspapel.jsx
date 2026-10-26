import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import Header from "@/components/layout/Header";
import {
  ObtenerTiposPapelBobina,
  cargarLoteBobinaPapel,
} from "../../../services/BobinaPapel/BobinaPapel";
import { ObtenerProveedoresForm } from "../../../services/Proveedor/Proveedor";
import { dateFormatter } from "@/utils/dates";
import InputCodigo from "@/components/layout/InputCodigo";
import InputMedida from "@/components/layout/InputMedida";
import { codigoFinal } from "@/utils/handlers";
import { errorCodigo } from "@/utils/validators";
import { formatearNumero } from "@/utils/numeros";
import { errorMedida, fueraDeRango, textoRango } from "@/utils/medidas";
import {
  GRAMAJE_MAXIMO,
  PESO_BRUTO_MAXIMO_BOBINA_PAPEL_KG,
  PESO_BRUTO_MINIMO_BOBINA_PAPEL_KG,
  PESO_BRUTO_NORMAL_BOBINA_PAPEL_KG,
  PESO_BRUTO_NORMAL_LOTE_BOBINA_PAPEL_KG,
  TARA_MAXIMA_BOBINA_KG,
  TARA_NORMAL_BOBINA_KG,
  TOLERANCIA_PESO_NETO_KG,
} from "@/constants/Values";
import { useCatalogo } from "@/hooks/useCatalogo";
import { soloActivos } from "@/utils/catalogo";
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
  BotonQuitarFila,
  CabeceraFila,
  ErroresFilas,
  AvisosLote,
  ErrorFila,
  ErrorEnvio,
  BarraGuardarLote,
  DialogoConfirmarLote,
} from "@/components/IngresoLote/comunes";
import IngresoReporteBobinaPapel from "@/components/Reportes/PapelBobina/Ingreso";

const ETIQUETA_MOVIL = "text-[11px] font-bold uppercase tracking-wide text-slate-600";

const filaVacia = () => ({
  CodigoBobina: "",
  PesoBrutoKg: "",
  PesoNetoKg: "",
  NetoManual: false,
  Gramaje: "",
});

const taraValida = (tara) =>
  tara !== "" && Number.isFinite(Number(tara)) && Number(tara) <= TARA_MAXIMA_BOBINA_KG;

const netoCalculado = (bruto, tara) => {
  if (bruto === "" || !taraValida(tara)) return "";
  const neto = Number(bruto) - Number(tara);
  return Number.isFinite(neto) && neto > 0 ? String(Math.round(neto * 100) / 100) : "";
};

export default function IngresoBobinasPapel({ usuario }) {
  const [idProveedor, setIdProveedor] = useState("");
  const [idTipoBobina, setIdTipoBobina] = useState(null);
  const [tara, setTara] = useState("");

  const proveedores = useCatalogo(ObtenerProveedoresForm);
  const tipos = useCatalogo(soloActivos(ObtenerTiposPapelBobina), (data) => {
    if (data.length) setIdTipoBobina(data[0].IdTipoBobina);
  });

  const envio = useEnvioLote();
  const { tocado } = envio;
  const { filas, actualizarFila, agregarFila, quitarFila, registrarRef, reiniciar } =
    useFilasLote(filaVacia, () => envio.setResultado(null));

  const tipoActual = tipos.datos.find((t) => t.IdTipoBobina === idTipoBobina);

  useEffect(() => {
    if (tipoActual) setTara(String(tipoActual.TaraKg));
  }, [tipoActual?.IdTipoBobina]);

  const netoDe = (f) => (f.NetoManual ? f.PesoNetoKg : netoCalculado(f.PesoBrutoKg, tara));

  const cambiarNeto = (id, valor) => {
    actualizarFila(id, "NetoManual", valor !== "");
    actualizarFila(id, "PesoNetoKg", valor);
  };

  const errorTara =
    tara !== "" && !taraValida(tara) ? `La tara va de 0 a ${TARA_MAXIMA_BOBINA_KG} kg` : null;

  const repetidos = codigosRepetidos(filas.map((f) => f.CodigoBobina));

  const erroresFilas = erroresPorFila(filas, (f) => {
    const codigo = codigoFinal(f.CodigoBobina);
    const errorDeCodigo = errorCodigo(codigo);
    if (errorDeCodigo) return errorDeCodigo;
    if (repetidos.has(codigo)) return "Código repetido";
    const neto = netoDe(f);
    return (
      errorMedida(f.PesoBrutoKg, {
        etiqueta: "Peso bruto",
        unidad: "kg",
        minimo: PESO_BRUTO_MINIMO_BOBINA_PAPEL_KG,
        maximo: PESO_BRUTO_MAXIMO_BOBINA_PAPEL_KG,
      }) ??
      errorMedida(neto, {
        etiqueta: "Peso neto",
        unidad: "kg",
        maximo: PESO_BRUTO_MAXIMO_BOBINA_PAPEL_KG,
      }) ??
      (Number(neto) > Number(f.PesoBrutoKg) ? "El neto supera al bruto" : null) ??
      errorMedida(f.Gramaje, {
        etiqueta: "Gramaje",
        unidad: "g/m²",
        maximo: GRAMAJE_MAXIMO,
        obligatorio: false,
      })
    );
  });
  const hayErrores = Object.keys(erroresFilas).length > 0;

  const totalBruto = filas.reduce((s, f) => s + Number(f.PesoBrutoKg || 0), 0);
  const totalNeto = filas.reduce((s, f) => s + Number(netoDe(f) || 0), 0);
  const listo =
    !!idProveedor && !!idTipoBobina && filas.length > 0 && !hayErrores && !errorTara;

  const avisos = [
    ...(fueraDeRango(tara, TARA_NORMAL_BOBINA_KG)
      ? [`Tara de ${formatearNumero(tara)} kg; lo común es ${textoRango(TARA_NORMAL_BOBINA_KG, "kg")}`]
      : []),
    ...filas.flatMap((f, i) => {
      if (erroresFilas[f.id]) return [];
      const lista = [];
      if (fueraDeRango(f.PesoBrutoKg, PESO_BRUTO_NORMAL_BOBINA_PAPEL_KG)) {
        lista.push(
          `Bobina ${i + 1}: peso bruto de ${formatearNumero(f.PesoBrutoKg)} kg; lo común es ${textoRango(PESO_BRUTO_NORMAL_BOBINA_PAPEL_KG, "kg")}`,
        );
      }
      if (
        f.NetoManual &&
        taraValida(tara) &&
        Math.abs(Number(f.PesoBrutoKg) - Number(tara) - Number(f.PesoNetoKg)) >
          TOLERANCIA_PESO_NETO_KG
      ) {
        lista.push(
          `Bobina ${i + 1}: el neto (${formatearNumero(f.PesoNetoKg)} kg) no coincide con bruto menos tara (${formatearNumero(netoCalculado(f.PesoBrutoKg, tara))} kg)`,
        );
      }
      return lista;
    }),
    ...(totalBruto > PESO_BRUTO_NORMAL_LOTE_BOBINA_PAPEL_KG
      ? [
          `El lote suma ${formatearNumero(totalBruto)} kg de peso bruto; un camión trae como máximo unos ${formatearNumero(PESO_BRUTO_NORMAL_LOTE_BOBINA_PAPEL_KG, { decimales: 0 })} kg`,
        ]
      : []),
  ];

  const validarLote = () => {
    if (!idProveedor) return "Selecciona el proveedor del lote.";
    if (!idTipoBobina) return "Selecciona el tipo de bobina del lote.";
    if (errorTara) return errorTara;
    if (hayErrores) return "Revisa las bobinas marcadas en rojo antes de guardar.";
    return null;
  };

  const guardarLote = () =>
    envio.guardar({
      validar: validarLote,
      enviar: () =>
        cargarLoteBobinaPapel(
          Number(idProveedor),
          Number(idTipoBobina),
          filas.map((f) => ({
            CodigoBobina: codigoFinal(f.CodigoBobina),
            PesoBrutoKg: Number(f.PesoBrutoKg),
            Gramaje: f.Gramaje === "" ? null : Number(f.Gramaje),
            PesoNetoKg: Number(netoDe(f)),
          })),
        ),
      alGuardar: (data) => {
        reiniciar();
        toast.success(`${data.CantidadBobinas} bobinas ingresadas al almacén`);
      },
    });

  const claseError = (err) => err && "border-red-300 focus-visible:ring-red-300";

  return (
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header
        volver
        titulo="Almacén · Materia Prima"
        subtitulo="Registrar ingreso de bobinas"
        contador={{
          valor: filas.length,
          singular: "bobina en el lote",
          plural: "bobinas en el lote",
        }}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        <PestanasIngreso lotes={<IngresoReporteBobinaPapel />}>
          {envio.resultado && (
            <ResultadoLote
              descripcion={
                <>
                  {envio.resultado.CantidadBobinas} bobinas · Recepción{" "}
                  {dateFormatter(envio.resultado.FechaRecepcion)}
                </>
              }
              onCerrar={() => envio.setResultado(null)}
            />
          )}

          <DatosLote descripcion="Se aplican a todas las bobinas que registres abajo">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <SelectorProveedor
                catalogo={proveedores}
                valor={idProveedor}
                onCambio={setIdProveedor}
                invalido={tocado && !idProveedor}
              />

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  Tara por bobina (kg)
                </Label>
                <InputMedida
                  valor={tara}
                  onCambio={setTara}
                  enteros={3}
                  className={cn("h-11", claseError(errorTara))}
                />
                {errorTara ? (
                  <ErrorFila mensaje={errorTara} />
                ) : (
                  <span className="text-[12px] text-slate-500">
                    Se usa para calcular el peso neto de cada bobina
                  </span>
                )}
              </div>
            </div>

            <SelectorTipo
              catalogo={tipos}
              valor={idTipoBobina}
              onCambio={setIdTipoBobina}
              campoValor="IdTipoBobina"
              campoEtiqueta="NombreTipoBobina"
              etiqueta="Tipo de bobina"
              mensajeVacio="No hay tipos de bobina registrados."
            />
          </DatosLote>

          <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <EncabezadoFilas
              titulo="Bobinas del lote"
              tipo={tipoActual?.NombreTipoBobina}
              textoAgregar="Agregar bobina"
              onAgregar={agregarFila}
            />

            <div className="hidden md:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="w-12 px-5 py-3">#</th>
                    <th className="px-3 py-3">Código de bobina</th>
                    <th className="w-36 px-3 py-3">Peso bruto (kg)</th>
                    <th className="w-36 px-3 py-3">Peso neto (kg)</th>
                    <th className="w-36 px-3 py-3">Gramaje (g/m²)</th>
                    <th className="w-14 px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => {
                    const err = tocado ? erroresFilas[f.id] : null;
                    return (
                      <tr
                        key={f.id}
                        className={cn(
                          "border-b border-slate-100 last:border-0",
                          err && "bg-red-50/60",
                        )}
                      >
                        <td className="px-5 py-2.5 text-sm font-bold text-slate-400">
                          {i + 1}
                        </td>
                        <td className="px-3 py-2.5">
                          <InputCodigo
                            ref={registrarRef(f.id)}
                            valor={f.CodigoBobina}
                            onCambio={(valor) => actualizarFila(f.id, "CodigoBobina", valor)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && i === filas.length - 1) agregarFila();
                            }}
                            placeholder="Ej. 963-R20"
                            className={cn("h-10 font-mono", claseError(err))}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <InputMedida
                            valor={f.PesoBrutoKg}
                            onCambio={(valor) => actualizarFila(f.id, "PesoBrutoKg", valor)}
                            className={cn("h-10", claseError(err))}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <InputMedida
                            valor={netoDe(f)}
                            onCambio={(valor) => cambiarNeto(f.id, valor)}
                            className={cn("h-10", claseError(err))}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <InputMedida
                            valor={f.Gramaje}
                            onCambio={(valor) => actualizarFila(f.id, "Gramaje", valor)}
                            enteros={2}
                            className={cn("h-10", claseError(err))}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <BotonQuitarFila
                            onClick={() => quitarFila(f.id)}
                            disabled={filas.length === 1}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {tocado && hayErrores && <ErroresFilas filas={filas} errores={erroresFilas} />}
              <AvisosLote avisos={avisos} />
            </div>

            <div className="flex flex-col gap-3 p-5 md:hidden">
              {filas.map((f, i) => {
                const err = tocado ? erroresFilas[f.id] : null;
                return (
                  <div
                    key={f.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border p-4",
                      err ? "border-red-300 bg-red-50/60" : "border-slate-200 bg-slate-50",
                    )}
                  >
                    <CabeceraFila
                      titulo={`Bobina ${i + 1}`}
                      onQuitar={() => quitarFila(f.id)}
                      deshabilitado={filas.length === 1}
                    />

                    <div className="flex flex-col gap-1.5">
                      <Label className={ETIQUETA_MOVIL}>Código</Label>
                      <InputCodigo
                        valor={f.CodigoBobina}
                        onCambio={(valor) => actualizarFila(f.id, "CodigoBobina", valor)}
                        placeholder="Ej. HIG-2026-0148"
                        className="h-11 bg-white font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label className={ETIQUETA_MOVIL}>Bruto (kg)</Label>
                        <InputMedida
                          valor={f.PesoBrutoKg}
                          onCambio={(valor) => actualizarFila(f.id, "PesoBrutoKg", valor)}
                          className="h-11 bg-white"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className={ETIQUETA_MOVIL}>Neto (kg)</Label>
                        <InputMedida
                          valor={netoDe(f)}
                          onCambio={(valor) => cambiarNeto(f.id, valor)}
                          className="h-11 bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className={ETIQUETA_MOVIL}>Gramaje (g/m²)</Label>
                      <InputMedida
                        valor={f.Gramaje}
                        onCambio={(valor) => actualizarFila(f.id, "Gramaje", valor)}
                        enteros={2}
                        className="h-11 bg-white"
                      />
                    </div>

                    {err && <ErrorFila mensaje={err} />}
                  </div>
                );
              })}
            </div>

            <div className="md:hidden">
              <AvisosLote avisos={avisos} />
            </div>
          </section>

          {envio.errorEnvio && <ErrorEnvio mensaje={envio.errorEnvio} />}

          <BarraGuardarLote listo={listo} enviando={envio.enviando} onGuardar={() => envio.pedirConfirmacion(validarLote)}>
            <span className="font-extrabold text-white">
              {filas.length} {filas.length === 1 ? "bobina" : "bobinas"}
            </span>
            <span className="text-slate-400">
              Bruto{" "}
              <strong className="text-slate-200">{formatearNumero(totalBruto)} kg</strong>
            </span>
            <span className="text-slate-400">
              Neto{" "}
              <strong className="text-slate-200">{formatearNumero(totalNeto)} kg</strong>
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
          { etiqueta: "Tipo", valor: tipoActual?.NombreTipoBobina ?? "-" },
          { etiqueta: "Peso bruto", valor: `${formatearNumero(totalBruto)} kg` },
          { etiqueta: "Peso neto", valor: `${formatearNumero(totalNeto)} kg` },
        ]}
        codigos={filas.map((f) => codigoFinal(f.CodigoBobina))}
        editable="el código, los pesos y el gramaje de cada bobina"
        inusuales={avisos}
        onCancelar={envio.cancelarConfirmacion}
        onConfirmar={guardarLote}
      />
    </div>
  );
}
