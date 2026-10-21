import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectEntidad } from "@/components/layout/Selectentidad";
import Header from "@/components/layout/Header";
import { ControlCantidad } from "@/components/InventarioProductos/comunes";
import { ObtenerProveedoresForm } from "../../../services/Proveedor/Proveedor";
import { useCatalogo } from "@/hooks/useCatalogo";
import { soloActivos } from "@/utils/catalogo";
import { useEnvioLote, erroresPorFila } from "@/hooks/useIngresoLote";
import {
  PestanasIngreso,
  ResultadoLote,
  DatosLote,
  SelectorProveedor,
  EncabezadoFilas,
  BotonQuitarFila,
  CabeceraFila,
  ErrorFila,
  ErrorEnvio,
  BarraGuardarLote,
  DialogoConfirmarLote,
} from "@/components/IngresoLote/comunes";
import { LotesEmpaque } from "@/components/Reportes/Empaque/Lotes";
import { CANTIDAD_MAXIMA_EMPAQUE_BOLSA } from "@/constants/Values";
import { aEntero } from "@/utils/validators";
import { dateFormatter } from "@/utils/dates";
import { CONFIG_BOLSAS } from "./config";

const ERROR_INPUT = "border-red-300 focus-visible:ring-red-300";

export default function IngresoBolsas({ tipo }) {
  const config = CONFIG_BOLSAS[tipo];
  const [idProveedor, setIdProveedor] = useState("");
  const [toneladas, setToneladas] = useState("");
  const secuencia = useRef(1);
  const [filas, setFilas] = useState([{ id: 0, IdTipo: "", Cantidad: "" }]);

  const proveedores = useCatalogo(ObtenerProveedoresForm);
  const tipos = useCatalogo(soloActivos(config.verInventario));

  const envio = useEnvioLote();
  const { tocado } = envio;
  const limpiarResultado = () => envio.setResultado(null);

  const actualizarFila = (id, campo, valor) => {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
    limpiarResultado();
  };

  const agregarFila = () => {
    const usados = new Set(filas.map((f) => f.IdTipo));
    const libre = tipos.datos.find((t) => !usados.has(String(t[config.campoId])));
    setFilas((prev) => [
      ...prev,
      { id: secuencia.current++, IdTipo: libre ? String(libre[config.campoId]) : "", Cantidad: "" },
    ]);
    limpiarResultado();
  };

  const quitarFila = (id) => {
    setFilas((prev) => (prev.length === 1 ? prev : prev.filter((f) => f.id !== id)));
  };

  const cuentaTipos = filas.reduce((acc, f) => {
    if (f.IdTipo !== "") acc[f.IdTipo] = (acc[f.IdTipo] || 0) + 1;
    return acc;
  }, {});

  const errores = erroresPorFila(filas, (f) => {
    if (f.IdTipo === "") return "Selecciona el tipo";
    if (cuentaTipos[f.IdTipo] > 1) return "Tipo repetido en el lote";
    const cantidad = aEntero(f.Cantidad);
    if (cantidad === 0) return "Indica la cantidad de paquetes";
    if (cantidad > CANTIDAD_MAXIMA_EMPAQUE_BOLSA)
      return `Máximo ${CANTIDAD_MAXIMA_EMPAQUE_BOLSA} paquetes por tipo`;
    return null;
  });

  const toneladasValidas = toneladas === "" || Number(toneladas) > 0;
  const hayErrores = Object.keys(errores).length > 0;
  const listo = !!idProveedor && toneladasValidas && !hayErrores;
  const totalPaquetes = filas.reduce((s, f) => s + aEntero(f.Cantidad), 0);

  const nombreTipo = (id) =>
    tipos.datos.find((t) => String(t[config.campoId]) === id)?.[config.campoNombre] ?? "";

  const stockTipo = (id) =>
    Number(tipos.datos.find((t) => String(t[config.campoId]) === id)?.CantidadActual ?? 0);

  const validarLote = () => {
    if (!idProveedor) return "Selecciona el proveedor del lote.";
    if (!toneladasValidas) return "Las toneladas pedidas deben ser mayores a 0.";
    if (hayErrores) return "Revisa las filas marcadas en rojo antes de guardar.";
    return null;
  };

  const guardarLote = () =>
    envio.guardar({
      validar: validarLote,
      enviar: () =>
        config.cargarLote(
          Number(idProveedor),
          toneladas === "" ? null : Number(toneladas),
          filas.map((f) => ({ IdTipo: Number(f.IdTipo), Cantidad: aEntero(f.Cantidad) })),
        ),
      alGuardar: (data) => {
        setFilas([{ id: secuencia.current++, IdTipo: "", Cantidad: "" }]);
        setToneladas("");
        tipos.recargar();
        toast.success(`${data.CantidadTotalIngresada} paquetes ingresados al almacén`);
      },
    });

  return (
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header
        volver
        titulo="Almacén · Empaque"
        subtitulo={config.subtituloIngreso}
        contador={{ valor: totalPaquetes, singular: "paquete en el lote", plural: "paquetes en el lote" }}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        <PestanasIngreso lotes={<LotesEmpaque claseFija={tipo} />}>
          {envio.resultado && (
            <ResultadoLote
              descripcion={
                <>
                  Lote #{envio.resultado.IdLoteEmpaque} · {envio.resultado.CantidadTotalIngresada} paquetes ·
                  Recepción {dateFormatter(envio.resultado.FechaRecepcion)}
                </>
              }
              onCerrar={limpiarResultado}
            >
              <div className="flex flex-wrap gap-1.5">
                {envio.resultado.Items.map((r) => (
                  <Badge
                    key={r.IdTipo}
                    variant="outline"
                    className="border-emerald-300 font-bold text-emerald-700"
                  >
                    {r.Nombre}: +{r.CantidadIngresada} (stock {r.CantidadActual})
                  </Badge>
                ))}
              </div>
            </ResultadoLote>
          )}

          <DatosLote
            descripcion="Se aplican al pedido completo, no a cada tipo"
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
                Toneladas pedidas (opcional)
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={toneladas}
                onChange={(e) => setToneladas(e.target.value)}
                placeholder="Ej. 2.5"
                className={cn("h-11", tocado && !toneladasValidas && ERROR_INPUT)}
              />
            </div>
          </DatosLote>

          <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <EncabezadoFilas
              titulo="Paquetes del lote"
              nota={`Un tipo por fila, de 1 a ${CANTIDAD_MAXIMA_EMPAQUE_BOLSA} paquetes`}
              textoAgregar="Agregar tipo"
              onAgregar={agregarFila}
            />

            {tipos.cargando && <Skeleton className="m-5 h-40 rounded-2xl" />}

            {!tipos.cargando && tipos.error && (
              <div className="p-5 text-sm font-semibold text-red-600">{tipos.error}</div>
            )}

            {!tipos.cargando && !tipos.error && tipos.datos.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">{config.vacio}</div>
            )}

            {!tipos.cargando && !tipos.error && tipos.datos.length > 0 && (
              <div className="flex flex-col gap-3 p-4 sm:p-5">
                {filas.map((f, i) => {
                  const err = tocado ? errores[f.id] : null;
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        "flex flex-col gap-3 rounded-xl border p-3.5",
                        err ? "border-red-300 bg-red-50/60" : "border-slate-200 bg-slate-50",
                      )}
                    >
                      <div className="md:hidden">
                        <CabeceraFila
                          titulo={`Tipo ${i + 1}`}
                          onQuitar={() => quitarFila(f.id)}
                          deshabilitado={filas.length === 1}
                        />
                      </div>

                      <div className="flex flex-col gap-3 md:flex-row md:items-end">
                        <div className="flex flex-1 flex-col gap-1.5">
                          <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                            Tipo
                          </Label>
                          <SelectEntidad
                            opciones={tipos.datos}
                            valor={f.IdTipo}
                            onCambio={(v) => actualizarFila(f.id, "IdTipo", v)}
                            campoValor={config.campoId}
                            campoEtiqueta={config.campoNombre}
                            placeholder="Selecciona el tipo"
                            invalido={!!err && (f.IdTipo === "" || cuentaTipos[f.IdTipo] > 1)}
                            className="bg-white"
                          />
                          {f.IdTipo !== "" && (
                            <span className="text-xs text-slate-500">
                              Stock actual: {stockTipo(f.IdTipo)} paquetes
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5 md:w-56">
                          <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                            Paquetes
                          </Label>
                          <ControlCantidad
                            valor={f.Cantidad}
                            onChange={(v) => actualizarFila(f.id, "Cantidad", v)}
                            maximo={CANTIDAD_MAXIMA_EMPAQUE_BOLSA}
                            invalido={tocado}
                            etiqueta={`Paquetes de ${nombreTipo(f.IdTipo) || "este tipo"}`}
                          />
                        </div>

                        <BotonQuitarFila
                          onClick={() => quitarFila(f.id)}
                          disabled={filas.length === 1}
                          className="hidden h-11 w-11 md:inline-flex"
                        />
                      </div>

                      {err && <ErrorFila mensaje={err} />}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {envio.errorEnvio && <ErrorEnvio mensaje={envio.errorEnvio} />}

          <BarraGuardarLote listo={listo} enviando={envio.enviando} onGuardar={() => envio.pedirConfirmacion(validarLote)}>
            <span className="font-extrabold text-white">
              {totalPaquetes} {totalPaquetes === 1 ? "paquete" : "paquetes"}
            </span>
            <span className="text-slate-400">
              en {filas.length} {filas.length === 1 ? "tipo" : "tipos"}
            </span>
          </BarraGuardarLote>
        </PestanasIngreso>
      </main>

      <DialogoConfirmarLote
        abierto={envio.confirmando}
        enviando={envio.enviando}
        cantidad={totalPaquetes}
        unidad={totalPaquetes === 1 ? "paquete" : "paquetes"}
        detalles={[
          {
            etiqueta: "Proveedor",
            valor:
              proveedores.datos.find((p) => String(p.IdProveedor) === String(idProveedor))
                ?.NombreProveedor ?? "-",
          },
          { etiqueta: "Toneladas pedidas", valor: toneladas || "-" },
        ]}
        lineas={filas.map((f) => ({
          etiqueta: nombreTipo(f.IdTipo),
          valor: `${aEntero(f.Cantidad)} ${aEntero(f.Cantidad) === 1 ? "paquete" : "paquetes"}`,
        }))}
        aviso="Una vez registrado el lote ya no se podrá editar; las diferencias solo se corrigen con salidas o reingresos de máximo 5 paquetes."
        onCancelar={envio.cancelarConfirmacion}
        onConfirmar={guardarLote}
      />
    </div>
  );
}
