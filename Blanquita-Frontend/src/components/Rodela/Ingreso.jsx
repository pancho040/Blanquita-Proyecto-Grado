import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Header from "@/components/layout/Header";
import {
  ObtenerTiposRodela,
  cargarLoteRodela,
} from "../../services/Rodela/Rodela";
import { ObtenerProveedoresForm } from "../../services/Proveedor/Proveedor";
import { dateFormatter } from "@/utils/dates";
import { aCodigo } from "@/utils/handlers";
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
  ErrorFila,
  ErrorEnvio,
  BarraGuardarLote,
  DialogoConfirmarLote,
} from "@/components/IngresoLote/comunes";
import IngresoReporteRodela from "@/components/Reportes/Rodela/Ingreso";

const filaVacia = () => ({ CodigoRodela: "" });

export default function IngresoRodelas({ usuario }) {
  const [idProveedor, setIdProveedor] = useState("");
  const [idTipoRodela, setIdTipoRodela] = useState(null);

  const proveedores = useCatalogo(ObtenerProveedoresForm);
  const tipos = useCatalogo(soloActivos(ObtenerTiposRodela), (data) => {
    if (data.length) setIdTipoRodela(data[0].IdTipoRodela);
  });

  const envio = useEnvioLote();
  const { tocado } = envio;
  const { filas, actualizarFila, agregarFila, quitarFila, registrarRef, reiniciar } =
    useFilasLote(filaVacia, () => envio.setResultado(null));

  const repetidos = codigosRepetidos(filas.map((f) => f.CodigoRodela));

  const erroresFilas = erroresPorFila(filas, (f) => {
    const codigo = f.CodigoRodela.trim();
    if (!codigo) return "Falta el código";
    if (repetidos.has(codigo.toLowerCase())) return "Código repetido";
    return null;
  });
  const hayErrores = Object.keys(erroresFilas).length > 0;

  const listo = !!idProveedor && !!idTipoRodela && filas.length > 0 && !hayErrores;

  const validarLote = () => {
    if (!idProveedor) return "Selecciona el proveedor del lote.";
    if (!idTipoRodela) return "Selecciona el tipo de rodela del lote.";
    if (hayErrores) return "Revisa las rodelas marcadas en rojo antes de guardar.";
    return null;
  };

  const guardarLote = () =>
    envio.guardar({
      validar: validarLote,
      enviar: () =>
        cargarLoteRodela(
          Number(idProveedor),
          Number(idTipoRodela),
          filas.map((f) => f.CodigoRodela.trim()),
        ),
      alGuardar: (data) => {
        reiniciar();
        toast.success(`${data.CantidadRodelas} rodelas ingresadas al almacén`);
      },
    });

  const tipoActual = tipos.datos.find((t) => t.IdTipoRodela === idTipoRodela);

  return (
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header
        volver
        titulo="Almacén · Materia Prima"
        subtitulo="Registrar ingreso de rodelas"
        contador={{
          valor: filas.length,
          singular: "rodela en el lote",
          plural: "rodelas en el lote",
        }}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        <PestanasIngreso lotes={<IngresoReporteRodela />}>
          {envio.resultado && (
            <ResultadoLote
              descripcion={
                <>
                  {envio.resultado.CantidadRodelas} rodelas · Recepción{" "}
                  {dateFormatter(envio.resultado.FechaRecepcion)}
                </>
              }
              onCerrar={() => envio.setResultado(null)}
            />
          )}

          <DatosLote descripcion="Se aplican a todas las rodelas que registres abajo">
            <SelectorProveedor
              catalogo={proveedores}
              valor={idProveedor}
              onCambio={setIdProveedor}
              invalido={tocado && !idProveedor}
            />
            <SelectorTipo
              catalogo={tipos}
              valor={idTipoRodela}
              onCambio={setIdTipoRodela}
              campoValor="IdTipoRodela"
              campoEtiqueta="NombreTipoRodela"
              campoDescripcion="Descripcion"
              etiqueta="Tipo de rodela"
              mensajeVacio="No hay tipos de rodela registrados."
            />
          </DatosLote>

          <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <EncabezadoFilas
              titulo="Rodelas del lote"
              tipo={tipoActual?.NombreTipoRodela}
              textoAgregar="Agregar rodela"
              onAgregar={agregarFila}
            />

            <div className="hidden md:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="w-12 px-5 py-3">#</th>
                    <th className="px-3 py-3">Código de rodela</th>
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
                            value={f.CodigoRodela}
                            onChange={(e) =>
                              actualizarFila(f.id, "CodigoRodela", aCodigo(e.target.value))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && i === filas.length - 1) agregarFila();
                            }}
                            placeholder="Ej. RDL-2026-0148"
                            className={cn(
                              "h-10 font-mono",
                              err && "border-red-300 focus-visible:ring-red-300",
                            )}
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
                      titulo={`Rodela ${i + 1}`}
                      onQuitar={() => quitarFila(f.id)}
                      deshabilitado={filas.length === 1}
                    />

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                        Código
                      </Label>
                      <Input
                        value={f.CodigoRodela}
                        onChange={(e) =>
                          actualizarFila(f.id, "CodigoRodela", aCodigo(e.target.value))
                        }
                        placeholder="Ej. RDL-2026-0148"
                        className="h-11 bg-white font-mono"
                      />
                    </div>

                    {err && <ErrorFila mensaje={err} />}
                  </div>
                );
              })}
            </div>
          </section>

          {envio.errorEnvio && <ErrorEnvio mensaje={envio.errorEnvio} />}

          <BarraGuardarLote listo={listo} enviando={envio.enviando} onGuardar={() => envio.pedirConfirmacion(validarLote)}>
            <span className="font-extrabold text-white">
              {filas.length} {filas.length === 1 ? "rodela" : "rodelas"}
            </span>
            {tipoActual && (
              <span className="text-slate-400">
                Tipo{" "}
                <strong className="text-slate-200">{tipoActual.NombreTipoRodela}</strong>
              </span>
            )}
          </BarraGuardarLote>
        </PestanasIngreso>
      </main>

      <DialogoConfirmarLote
        abierto={envio.confirmando}
        enviando={envio.enviando}
        cantidad={filas.length}
        unidad={filas.length === 1 ? "rodela" : "rodelas"}
        detalles={[
          {
            etiqueta: "Proveedor",
            valor:
              proveedores.datos.find((p) => String(p.IdProveedor) === String(idProveedor))
                ?.NombreProveedor ?? "-",
          },
          { etiqueta: "Tipo", valor: tipoActual?.NombreTipoRodela ?? "-" },
        ]}
        codigos={filas.map((f) => f.CodigoRodela.trim())}
        editable="el código de cada rodela"
        onCancelar={envio.cancelarConfirmacion}
        onConfirmar={guardarLote}
      />
    </div>
  );
}
