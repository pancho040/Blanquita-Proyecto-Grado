import { useState, useRef } from "react";
import { Plus, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectEntidad } from "@/components/layout/Selectentidad";
import Header from "@/components/layout/Header";
import {
  obtenerTiposEmpaque,
  cargarLoteEmpaque,
} from "../../services/Empaque/EmpaqueBobina";
import { ObtenerProveedoresForm } from "../../services/Proveedor/Proveedor";
import { dateFormatter } from "@/utils/dates";
import { aCodigo } from "@/utils/handlers";
import { ACENTOS } from "@/constants/Acentos";
import { useCatalogo } from "@/hooks/useCatalogo";
import { soloActivos } from "@/utils/catalogo";
import { useEnvioLote, codigosRepetidos, erroresPorFila } from "@/hooks/useIngresoLote";
import {
  PestanasIngreso,
  ResultadoLote,
  DatosLote,
  SelectorProveedor,
  BotonQuitarFila,
  CabeceraFila,
  ErrorFila,
  ErrorEnvio,
  BarraGuardarLote,
  DialogoConfirmarLote,
} from "@/components/IngresoLote/comunes";
import { LotesEmpaque } from "@/components/Reportes/Empaque/Lotes";

const ERROR_INPUT = "border-red-300 focus-visible:ring-red-300";

const totalEmpaques = (resultado) =>
  resultado.Resumen.reduce((s, r) => s + r.CantidadEmpaques, 0);

export default function EmpaqueBobinaIngreso({ usuario }) {
  const [idProveedor, setIdProveedor] = useState("");
  const [cantidadToneladasPedida, setCantidadToneladasPedida] = useState("");

  const bloqueSeq = useRef(1);
  const filaSeq = useRef(1);
  const refsCodigo = useRef({});

  const nuevaFila = () => ({ id: filaSeq.current++, CodigoEmpaque: "", PesoKg: "" });
  const nuevoBloque = (idTipoEmpaque = "") => ({
    id: bloqueSeq.current++,
    IdTipoEmpaque: idTipoEmpaque,
    filas: [nuevaFila()],
  });

  const [bloques, setBloques] = useState([
    { id: 0, IdTipoEmpaque: "", filas: [{ id: 0, CodigoEmpaque: "", PesoKg: "" }] },
  ]);

  const proveedores = useCatalogo(ObtenerProveedoresForm);
  const tipos = useCatalogo(soloActivos(obtenerTiposEmpaque), (data) => {
    if (data.length) {
      setBloques((prev) =>
        prev.map((b) =>
          b.IdTipoEmpaque === "" ? { ...b, IdTipoEmpaque: data[0].IdTipoEmpaque } : b,
        ),
      );
    }
  });

  const envio = useEnvioLote();
  const { tocado } = envio;
  const limpiarResultado = () => envio.setResultado(null);

  const actualizarTipoBloque = (bloqueId, idTipoEmpaque) => {
    setBloques((prev) =>
      prev.map((b) => (b.id === bloqueId ? { ...b, IdTipoEmpaque: idTipoEmpaque } : b)),
    );
    limpiarResultado();
  };

  const actualizarFila = (bloqueId, filaId, campo, valor) => {
    setBloques((prev) =>
      prev.map((b) =>
        b.id !== bloqueId
          ? b
          : {
              ...b,
              filas: b.filas.map((f) => (f.id === filaId ? { ...f, [campo]: valor } : f)),
            },
      ),
    );
    limpiarResultado();
  };

  const agregarBloque = () => {
    const usados = new Set(bloques.map((b) => b.IdTipoEmpaque));
    const tipoLibre = tipos.datos.find((t) => !usados.has(t.IdTipoEmpaque));
    const bloque = nuevoBloque(
      tipoLibre?.IdTipoEmpaque ?? tipos.datos[0]?.IdTipoEmpaque ?? "",
    );
    setBloques((prev) => [...prev, bloque]);
    limpiarResultado();
    requestAnimationFrame(() => refsCodigo.current[bloque.filas[0].id]?.focus());
  };

  const quitarBloque = (bloqueId) => {
    setBloques((prev) => (prev.length === 1 ? prev : prev.filter((b) => b.id !== bloqueId)));
  };

  const agregarFila = (bloqueId) => {
    const fila = nuevaFila();
    setBloques((prev) =>
      prev.map((b) => (b.id === bloqueId ? { ...b, filas: [...b.filas, fila] } : b)),
    );
    limpiarResultado();
    requestAnimationFrame(() => refsCodigo.current[fila.id]?.focus());
  };

  const quitarFila = (bloqueId, filaId) => {
    setBloques((prev) =>
      prev.map((b) =>
        b.id === bloqueId && b.filas.length > 1
          ? { ...b, filas: b.filas.filter((f) => f.id !== filaId) }
          : b,
      ),
    );
    delete refsCodigo.current[filaId];
  };

  const filasPlanas = bloques.flatMap((b) =>
    b.filas.map((f) => ({ ...f, bloqueId: b.id, IdTipoEmpaque: b.IdTipoEmpaque })),
  );

  const repetidos = codigosRepetidos(filasPlanas.map((f) => f.CodigoEmpaque));

  const erroresFilas = erroresPorFila(filasPlanas, (f) => {
    const codigo = f.CodigoEmpaque.trim();
    if (!codigo) return "Falta el código";
    if (repetidos.has(codigo.toLowerCase())) return "Código repetido";
    if (!f.PesoKg || Number(f.PesoKg) <= 0) return "Peso inválido";
    return null;
  });

  const erroresBloques = erroresPorFila(bloques, (b) =>
    b.IdTipoEmpaque ? null : "Selecciona el tipo de empaque",
  );

  const toneladasValidas =
    !!cantidadToneladasPedida && Number(cantidadToneladasPedida) > 0;
  const hayErroresFilas = Object.keys(erroresFilas).length > 0;
  const hayErroresBloques = Object.keys(erroresBloques).length > 0;

  const listo =
    !!idProveedor &&
    toneladasValidas &&
    filasPlanas.length > 0 &&
    !hayErroresFilas &&
    !hayErroresBloques;

  const validarLote = () => {
    if (!idProveedor) return "Selecciona el proveedor del lote.";
    if (!toneladasValidas) return "Indica la cantidad de toneladas pedidas.";
    if (hayErroresBloques) return "Selecciona el tipo de empaque en cada bloque.";
    if (hayErroresFilas) return "Revisa los empaques marcados en rojo antes de guardar.";
    return null;
  };

  const guardarLote = () =>
    envio.guardar({
      validar: validarLote,
      enviar: () =>
        cargarLoteEmpaque(
          Number(idProveedor),
          Number(cantidadToneladasPedida),
          filasPlanas.map((f) => ({
            CodigoEmpaque: f.CodigoEmpaque.trim(),
            IdTipoEmpaque: Number(f.IdTipoEmpaque),
            PesoKg: Number(f.PesoKg),
          })),
        ),
      alGuardar: (data) => {
        setBloques([nuevoBloque(tipos.datos[0]?.IdTipoEmpaque ?? "")]);
        setCantidadToneladasPedida("");
        toast.success(`${totalEmpaques(data)} empaques ingresados al almacén`);
      },
    });

  const totalPesoKg = filasPlanas.reduce(
    (s, f) => s + (Number(f.PesoKg) > 0 ? Number(f.PesoKg) : 0),
    0,
  );

  const nombreTipo = (idTipoEmpaque) =>
    tipos.datos.find((t) => t.IdTipoEmpaque === idTipoEmpaque)?.NombreTipoEmpaque ?? "";

  return (
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header
        volver
        titulo="Almacén · Materia Prima"
        subtitulo="Registrar ingreso de empaques"
        contador={{
          valor: filasPlanas.length,
          singular: "empaque en el lote",
          plural: "empaques en el lote",
        }}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        <PestanasIngreso lotes={<LotesEmpaque claseFija="bobina" />}>
          {envio.resultado && (
            <ResultadoLote
              descripcion={
                <>
                  {totalEmpaques(envio.resultado)} empaques · Recepción{" "}
                  {dateFormatter(envio.resultado.Resumen[0]?.FechaRecepcion)}
                </>
              }
              onCerrar={limpiarResultado}
            >
              <div className="flex flex-wrap gap-1.5">
                {envio.resultado.Resumen.map((r) => (
                  <Badge
                    key={r.IdTipoEmpaque}
                    variant="outline"
                    className="border-emerald-300 font-bold text-emerald-700"
                  >
                    {r.NombreTipoEmpaque}: {r.CantidadEmpaques}
                  </Badge>
                ))}
              </div>
            </ResultadoLote>
          )}

          <DatosLote
            descripcion="Se aplican al pedido completo, no a cada empaque"
            className="flex flex-col gap-5 p-5 sm:flex-row sm:gap-6"
          >
            <SelectorProveedor
              catalogo={proveedores}
              valor={idProveedor}
              onCambio={setIdProveedor}
              invalido={tocado && !idProveedor}
              className="flex flex-1 flex-col gap-1.5"
            />

            <div className="flex flex-1 flex-col gap-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Toneladas pedidas
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={cantidadToneladasPedida}
                onChange={(e) => setCantidadToneladasPedida(e.target.value)}
                placeholder="Ej. 12.5"
                className={cn("h-11", tocado && !toneladasValidas && ERROR_INPUT)}
              />
            </div>
          </DatosLote>

          <section className="mt-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-base font-extrabold text-slate-900">Empaques del lote</div>
                <div className="text-sm text-slate-500">Agrupados por tipo de empaque</div>
                {tipos.error && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600">
                    {tipos.error}
                    <Button
                      variant="outline"
                      onClick={tipos.recargar}
                      className="h-7 border-red-300 px-2 text-xs font-bold text-red-600 hover:bg-red-100"
                    >
                      Reintentar
                    </Button>
                  </div>
                )}
                {!tipos.cargando && !tipos.error && tipos.datos.length === 0 && (
                  <div className="rounded-xl bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
                    No hay tipos de empaque registrados.
                  </div>
                )}
              </div>
              <Button
                onClick={agregarBloque}
                disabled={tipos.cargando || tipos.datos.length === 0}
                className="h-11 gap-2 bg-gradient-to-r from-c3 to-c4 font-bold text-white hover:opacity-90"
              >
                <Layers size={16} strokeWidth={2.75} />
                Agregar tipo de empaque
              </Button>
            </div>

            {tipos.cargando && <Skeleton className="h-64 w-full rounded-2xl" />}

            {!tipos.cargando &&
              bloques.map((b, bi) => {
                const acento = ACENTOS[bi % ACENTOS.length];
                const errTipo = tocado ? erroresBloques[b.id] : null;
                return (
                  <div
                    key={b.id}
                    className={cn(
                      "overflow-hidden rounded-2xl border-2 bg-white shadow-sm",
                      errTipo ? "border-red-300" : acento.border,
                    )}
                  >
                    <div
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5",
                        acento.soft,
                      )}
                    >
                      <div className="flex flex-1 flex-wrap items-center gap-3">
                        <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-slate-500">
                          Tipo {bi + 1}
                        </span>
                        <div className="min-w-[220px] flex-1 sm:max-w-xs">
                          <SelectEntidad
                            opciones={tipos.datos}
                            valor={b.IdTipoEmpaque}
                            onCambio={(v) => actualizarTipoBloque(b.id, v)}
                            campoValor="IdTipoEmpaque"
                            campoEtiqueta="NombreTipoEmpaque"
                            placeholder="Selecciona el tipo"
                            invalido={!!errTipo}
                            className="h-10! bg-white"
                          />
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("border font-bold", acento.text, acento.border)}
                        >
                          {b.filas.length} {b.filas.length === 1 ? "bobina" : "bobinas"}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => quitarBloque(b.id)}
                        disabled={bloques.length === 1}
                        className="h-9 gap-1.5 font-bold text-slate-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} strokeWidth={2.5} />
                        Quitar tipo
                      </Button>
                    </div>

                    <div className="hidden md:block">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            <th className="w-12 px-5 py-2.5">#</th>
                            <th className="px-3 py-2.5">Código</th>
                            <th className="w-36 px-3 py-2.5">Peso (kg)</th>
                            <th className="w-14 px-3 py-2.5"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.filas.map((f, i) => {
                            const err = tocado ? erroresFilas[f.id] : null;
                            return (
                              <tr
                                key={f.id}
                                className={cn(
                                  "border-b border-slate-100 last:border-0",
                                  err && "bg-red-50/60",
                                )}
                              >
                                <td className="px-5 py-2 text-sm font-bold text-slate-400">
                                  {i + 1}
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    ref={(el) => {
                                      refsCodigo.current[f.id] = el;
                                    }}
                                    value={f.CodigoEmpaque}
                                    onChange={(e) =>
                                      actualizarFila(b.id, f.id, "CodigoEmpaque", aCodigo(e.target.value))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && i === b.filas.length - 1)
                                        agregarFila(b.id);
                                    }}
                                    placeholder="Ej. EMP-2026-0148"
                                    className={cn("h-10 font-mono", err && ERROR_INPUT)}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={f.PesoKg}
                                    onChange={(e) =>
                                      actualizarFila(b.id, f.id, "PesoKg", e.target.value)
                                    }
                                    placeholder="0.00"
                                    className={cn("h-10", err && ERROR_INPUT)}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <BotonQuitarFila
                                    onClick={() => quitarFila(b.id, f.id)}
                                    disabled={b.filas.length === 1}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col gap-3 p-4 md:hidden">
                      {b.filas.map((f, i) => {
                        const err = tocado ? erroresFilas[f.id] : null;
                        return (
                          <div
                            key={f.id}
                            className={cn(
                              "flex flex-col gap-3 rounded-xl border p-3.5",
                              err ? "border-red-300 bg-red-50/60" : "border-slate-200 bg-slate-50",
                            )}
                          >
                            <CabeceraFila
                              titulo={`Bobina ${i + 1}`}
                              onQuitar={() => quitarFila(b.id, f.id)}
                              deshabilitado={b.filas.length === 1}
                            />

                            <div className="flex flex-col gap-1.5">
                              <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                                Código
                              </Label>
                              <Input
                                value={f.CodigoEmpaque}
                                onChange={(e) =>
                                  actualizarFila(b.id, f.id, "CodigoEmpaque", aCodigo(e.target.value))
                                }
                                placeholder="Ej. EMP-2026-0148"
                                className="h-11 bg-white font-mono"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                                Peso (kg)
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={f.PesoKg}
                                onChange={(e) =>
                                  actualizarFila(b.id, f.id, "PesoKg", e.target.value)
                                }
                                placeholder="0.00"
                                className="h-11 bg-white"
                              />
                            </div>

                            {err && <ErrorFila mensaje={err} />}
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-slate-100 px-5 py-3">
                      <Button
                        variant="outline"
                        onClick={() => agregarFila(b.id)}
                        className={cn("h-10 gap-2 font-bold", acento.text, acento.border)}
                      >
                        <Plus size={15} strokeWidth={2.75} />
                        Agregar bobina {nombreTipo(b.IdTipoEmpaque) && `de ${nombreTipo(b.IdTipoEmpaque)}`}
                      </Button>
                    </div>
                  </div>
                );
              })}
          </section>

          {envio.errorEnvio && <ErrorEnvio mensaje={envio.errorEnvio} />}

          <BarraGuardarLote listo={listo} enviando={envio.enviando} onGuardar={() => envio.pedirConfirmacion(validarLote)}>
            <span className="font-extrabold text-white">
              {filasPlanas.length} {filasPlanas.length === 1 ? "empaque" : "empaques"}
            </span>
            <span className="text-slate-400">
              en {bloques.length} {bloques.length === 1 ? "tipo" : "tipos"}
            </span>
            <span className="text-slate-400">
              Peso total{" "}
              <strong className="text-slate-200">{totalPesoKg.toFixed(2)} kg</strong>
            </span>
          </BarraGuardarLote>
        </PestanasIngreso>
      </main>

      <DialogoConfirmarLote
        abierto={envio.confirmando}
        enviando={envio.enviando}
        cantidad={filasPlanas.length}
        unidad={filasPlanas.length === 1 ? "bobina de empaque" : "bobinas de empaque"}
        detalles={[
          {
            etiqueta: "Proveedor",
            valor:
              proveedores.datos.find((p) => String(p.IdProveedor) === String(idProveedor))
                ?.NombreProveedor ?? "-",
          },
          { etiqueta: "Toneladas pedidas", valor: cantidadToneladasPedida || "-" },
          { etiqueta: "Peso total", valor: `${totalPesoKg.toFixed(2)} kg` },
        ]}
        lineas={bloques.map((b) => ({
          etiqueta: nombreTipo(b.IdTipoEmpaque) || "Sin tipo",
          valor: `${b.filas.length} ${b.filas.length === 1 ? "bobina" : "bobinas"}`,
        }))}
        codigos={filasPlanas.map((f) => f.CodigoEmpaque.trim())}
        aviso="Una vez registrado el lote ya no se podrán editar los códigos, los pesos, la cantidad, el tipo ni el proveedor."
        onCancelar={envio.cancelarConfirmacion}
        onConfirmar={guardarLote}
      />
    </div>
  );
}
