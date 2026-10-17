import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Header from "@/components/layout/Header";
import {
  ObtenerTiposPapelBobina,
  cargarLoteBobinaPapel,
} from "../../../services/BobinaPapel/BobinaPapel";
import { ObtenerProveedoresForm } from "../../../services/Proveedor/Proveedor";
import { dateFormatter } from "@/utils/dates";
import { aCodigo } from "@/utils/handlers";
import { formatearNumero } from "@/utils/numeros";
import { useCatalogo } from "@/hooks/useCatalogo";
import { soloActivos } from "@/utils/catalogo";
import {
  useFilasLote,
  useEnvioLote,
  codigosRepetidos,
  erroresPorFila,
} from "@/hooks/useIngresoLote";
import {
  ResultadoLote,
  DatosLote,
  SelectorProveedor,
  SelectorTipo,
  EncabezadoFilas,
  BotonQuitarFila,
  CabeceraFila,
  ErroresFilas,
  ErrorFila,
  ErrorEnvio,
  BarraGuardarLote,
} from "@/components/IngresoLote/comunes";

const ETIQUETA_MOVIL = "text-[11px] font-bold uppercase tracking-wide text-slate-600";

const filaVacia = () => ({
  CodigoBobina: "",
  PesoBrutoKg: "",
  PesoNetoKg: "",
  Gramaje: "",
});

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

  const repetidos = codigosRepetidos(filas.map((f) => f.CodigoBobina));

  const erroresFilas = erroresPorFila(filas, (f) => {
    const codigo = f.CodigoBobina.trim();
    if (!codigo) return "Falta el código";
    if (repetidos.has(codigo.toLowerCase())) return "Código repetido";
    const bruto = Number(f.PesoBrutoKg);
    if (!f.PesoBrutoKg || bruto <= 0) return "Peso bruto inválido";
    const neto = Number(f.PesoNetoKg);
    if (!f.PesoNetoKg || neto <= 0) return "Peso neto inválido";
    if (neto > bruto) return "El neto supera al bruto";
    if (f.Gramaje !== "" && Number(f.Gramaje) <= 0) return "Gramaje inválido";
    return null;
  });
  const hayErrores = Object.keys(erroresFilas).length > 0;

  const totalBruto = filas.reduce((s, f) => s + Number(f.PesoBrutoKg || 0), 0);
  const totalNeto = filas.reduce((s, f) => s + Number(f.PesoNetoKg || 0), 0);
  const listo = !!idProveedor && !!idTipoBobina && filas.length > 0 && !hayErrores;

  const guardarLote = () =>
    envio.guardar({
      validar: () => {
        if (!idProveedor) return "Selecciona el proveedor del lote.";
        if (!idTipoBobina) return "Selecciona el tipo de bobina del lote.";
        if (hayErrores) return "Revisa las bobinas marcadas en rojo antes de guardar.";
        return null;
      },
      enviar: () =>
        cargarLoteBobinaPapel(
          Number(idProveedor),
          Number(idTipoBobina),
          filas.map((f) => ({
            CodigoBobina: f.CodigoBobina.trim(),
            PesoBrutoKg: Number(f.PesoBrutoKg),
            Gramaje: f.Gramaje === "" ? null : Number(f.Gramaje),
            PesoNetoKg: Number(f.PesoNetoKg),
          })),
        ),
      alGuardar: (data) => {
        reiniciar();
        setTara("");
        toast.success(`${data.CantidadBobinas} bobinas ingresadas al almacén`);
      },
    });

  const tipoActual = tipos.datos.find((t) => t.IdTipoBobina === idTipoBobina);

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
              <div className="flex gap-2">
                <Input
                  value={tara}
                  onChange={(e) => setTara(e.target.value)}
                  placeholder="0.0"
                  type="number"
                  step="0.01"
                  className="h-11"
                />
              </div>
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
                        <Input
                          ref={registrarRef(f.id)}
                          value={f.CodigoBobina}
                          onChange={(e) =>
                            actualizarFila(f.id, "CodigoBobina", aCodigo(e.target.value))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && i === filas.length - 1) agregarFila();
                          }}
                          placeholder="Ej. 963-R20"
                          className={cn("h-10 font-mono", claseError(err))}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          value={f.PesoBrutoKg}
                          onChange={(e) => actualizarFila(f.id, "PesoBrutoKg", e.target.value)}
                          placeholder="0.0"
                          type="number"
                          step="0.01"
                          className={cn("h-10", claseError(err))}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          value={f.PesoNetoKg}
                          onChange={(e) => actualizarFila(f.id, "PesoNetoKg", e.target.value)}
                          placeholder="0.0"
                          type="number"
                          step="0.01"
                          className={cn("h-10", claseError(err))}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          value={f.Gramaje}
                          onChange={(e) => actualizarFila(f.id, "Gramaje", e.target.value)}
                          placeholder="0.0"
                          type="number"
                          step="0.01"
                          className="h-10"
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
                    <Input
                      value={f.CodigoBobina}
                      onChange={(e) =>
                        actualizarFila(f.id, "CodigoBobina", aCodigo(e.target.value))
                      }
                      placeholder="Ej. HIG-2026-0148"
                      className="h-11 bg-white font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label className={ETIQUETA_MOVIL}>Bruto (kg)</Label>
                      <Input
                        value={f.PesoBrutoKg}
                        onChange={(e) => actualizarFila(f.id, "PesoBrutoKg", e.target.value)}
                        placeholder="0.0"
                        type="number"
                        step="0.01"
                        className="h-11 bg-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className={ETIQUETA_MOVIL}>Neto (kg)</Label>
                      <Input
                        value={f.PesoNetoKg}
                        onChange={(e) => actualizarFila(f.id, "PesoNetoKg", e.target.value)}
                        placeholder="0.0"
                        type="number"
                        step="0.01"
                        className="h-11 bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className={ETIQUETA_MOVIL}>Gramaje (g/m²)</Label>
                    <Input
                      value={f.Gramaje}
                      onChange={(e) => actualizarFila(f.id, "Gramaje", e.target.value)}
                      placeholder="0.0"
                      type="number"
                      step="0.01"
                      className="h-11 bg-white"
                    />
                  </div>

                  {err && <ErrorFila mensaje={err} />}
                </div>
              );
            })}
          </div>
        </section>

        {envio.errorEnvio && <ErrorEnvio mensaje={envio.errorEnvio} />}

        <BarraGuardarLote listo={listo} enviando={envio.enviando} onGuardar={guardarLote}>
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
      </main>
    </div>
  );
}
