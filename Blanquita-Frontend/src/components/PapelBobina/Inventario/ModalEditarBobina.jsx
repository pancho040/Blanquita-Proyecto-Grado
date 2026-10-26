import { useEffect, useState } from "react";
import { Check, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import InputForModal from "@/components/layout/InputForModal";
import { CasillaConfirmacion } from "@/components/Admin/CasillaConfirmacion";
import { editarBobinaPapel } from "../../../services/BobinaPapel/BobinaPapel";
import {
  DECIMALES_PESO,
  GRAMAJE_MAXIMO,
  MOTIVO_CORRECCION_MAX,
  MOTIVO_CORRECCION_MIN,
  PESO_BRUTO_MAXIMO_BOBINA_PAPEL_KG,
  PESO_BRUTO_MINIMO_BOBINA_PAPEL_KG,
  PESO_BRUTO_NORMAL_BOBINA_PAPEL_KG,
} from "@/constants/Values";
import { errorMedida, fueraDeRango, textoRango } from "@/utils/medidas";
import { codigoFinal } from "@/utils/handlers";
import { errorCodigo, limpiarObservacion } from "@/utils/validators";
import { dateFormatter } from "@/utils/dates";
import { fmt } from "./constantes";

const aTexto = (valor) =>
  valor === null || valor === undefined || valor === "" ? "" : String(Number(valor));

const aNumero = (valor) => (valor === "" ? null : Number(valor));

const formularioDesde = (bobina) => ({
  CodigoBobina: bobina?.CodigoBobina ?? "",
  PesoBrutoKg: aTexto(bobina?.PesoBrutoKg),
  PesoNetoKg: aTexto(bobina?.PesoNetoKg),
  Gramaje: aTexto(bobina?.Gramaje),
  Observacion: "",
});

function validar(form) {
  const errores = {};
  const motivo = form.Observacion.trim();

  const errorDeCodigo = errorCodigo(codigoFinal(form.CodigoBobina));
  if (errorDeCodigo) errores.CodigoBobina = errorDeCodigo;
  const errorBruto = errorMedida(form.PesoBrutoKg, {
    etiqueta: "Peso bruto",
    unidad: "kg",
    minimo: PESO_BRUTO_MINIMO_BOBINA_PAPEL_KG,
    maximo: PESO_BRUTO_MAXIMO_BOBINA_PAPEL_KG,
  });
  if (errorBruto) errores.PesoBrutoKg = errorBruto;
  const errorNeto = errorMedida(form.PesoNetoKg, {
    etiqueta: "Peso neto",
    unidad: "kg",
    maximo: PESO_BRUTO_MAXIMO_BOBINA_PAPEL_KG,
  });
  if (errorNeto) errores.PesoNetoKg = errorNeto;
  else if (!errorBruto && Number(form.PesoNetoKg) > Number(form.PesoBrutoKg)) {
    errores.PesoNetoKg = "El neto supera al bruto";
  }
  const errorGramaje = errorMedida(form.Gramaje, {
    etiqueta: "Gramaje",
    unidad: "g/m²",
    maximo: GRAMAJE_MAXIMO,
    obligatorio: false,
  });
  if (errorGramaje) errores.Gramaje = errorGramaje;
  if (motivo.length < MOTIVO_CORRECCION_MIN || motivo.length > MOTIVO_CORRECCION_MAX) {
    errores.Observacion = `El motivo debe tener entre ${MOTIVO_CORRECCION_MIN} y ${MOTIVO_CORRECCION_MAX} caracteres`;
  }
  return errores;
}

function calcularCambios(form, bobina) {
  if (!bobina) return [];
  const cambios = [];
  const codigo = codigoFinal(form.CodigoBobina);

  if (codigo !== bobina.CodigoBobina) {
    cambios.push({ campo: "Código", antes: bobina.CodigoBobina, despues: codigo });
  }

  const numericos = [
    ["PesoBrutoKg", "Peso bruto", " kg"],
    ["PesoNetoKg", "Peso neto", " kg"],
    ["Gramaje", "Gramaje", " g/m²"],
  ];
  numericos.forEach(([clave, campo, unidad]) => {
    const antes = aNumero(aTexto(bobina[clave]));
    const despues = aNumero(form[clave]);
    if (antes !== despues) {
      cambios.push({
        campo,
        antes: antes === null ? "-" : `${fmt(antes)}${unidad}`,
        despues: despues === null ? "-" : `${fmt(despues)}${unidad}`,
      });
    }
  });

  return cambios;
}

export default function ModalEditarBobina({
  abierto,
  onOpenChange,
  bobina,
  nombreTipo,
  onGuardado,
}) {
  const [form, setForm] = useState(() => formularioDesde(bobina));
  const [errores, setErrores] = useState({});
  const [errorEnvio, setErrorEnvio] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [inusualRevisado, setInusualRevisado] = useState(false);

  useEffect(() => {
    if (abierto) {
      setForm(formularioDesde(bobina));
      setInusualRevisado(false);
      setErrores({});
      setErrorEnvio("");
      setGuardando(false);
    }
  }, [abierto, bobina]);

  const actualizar = (campo) => (valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setErrorEnvio("");
    setErrores((prev) => {
      if (!prev[campo]) return prev;
      const { [campo]: _omitido, ...resto } = prev;
      return resto;
    });
  };

  const cambios = calcularCambios(form, bobina);
  const largoMotivo = form.Observacion.trim().length;
  const inusual =
    !errorMedida(form.PesoBrutoKg, {
      etiqueta: "Peso bruto",
      unidad: "kg",
      minimo: PESO_BRUTO_MINIMO_BOBINA_PAPEL_KG,
      maximo: PESO_BRUTO_MAXIMO_BOBINA_PAPEL_KG,
    }) && fueraDeRango(form.PesoBrutoKg, PESO_BRUTO_NORMAL_BOBINA_PAPEL_KG);

  const guardar = async () => {
    const nuevosErrores = validar(form);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0 || cambios.length === 0) return;
    if (inusual && !inusualRevisado) return;

    setGuardando(true);
    setErrorEnvio("");
    try {
      const actualizada = await editarBobinaPapel({
        IdBobinaPapel: bobina.IdBobinaPapel,
        ...form,
      });
      onGuardado(actualizada);
      onOpenChange(false);
    } catch (e) {
      setErrorEnvio(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarAbierto = (valor) => {
    if (guardando) return;
    onOpenChange(valor);
  };

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogContent className="sm:max-w-xl md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar bobina</DialogTitle>
          <DialogDescription>
            Corrige los datos registrados por error. El cambio queda en el
            historial de movimientos de la bobina.
          </DialogDescription>
        </DialogHeader>

        {bobina && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3.5 text-[13px] ring-1 ring-slate-200 sm:grid-cols-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Tipo</div>
              <div className="font-semibold text-slate-800">{nombreTipo ?? "-"}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Lote</div>
              <div className="font-semibold text-slate-800">{bobina.CodigoLote}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Recepción</div>
              <div className="font-semibold text-slate-800">{dateFormatter(bobina.FechaRecepcion)}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Proveedor</div>
              <div className="font-semibold text-slate-800">{bobina.NombreProveedor}</div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <InputForModal
            id="CodigoBobina"
            etiqueta="Código de bobina"
            valor={form.CodigoBobina}
            codigo
            onCambio={actualizar("CodigoBobina")}
            error={errores.CodigoBobina}
            disabled={guardando}
            classNameInput="font-mono font-bold"
            autoComplete="off"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <InputForModal
              id="PesoBrutoKg"
              etiqueta="Peso bruto (kg)"
              medida={DECIMALES_PESO}
              valor={form.PesoBrutoKg}
              onCambio={actualizar("PesoBrutoKg")}
              error={errores.PesoBrutoKg}
              disabled={guardando}
            />
            <InputForModal
              id="PesoNetoKg"
              etiqueta="Peso neto (kg)"
              medida={DECIMALES_PESO}
              valor={form.PesoNetoKg}
              onCambio={actualizar("PesoNetoKg")}
              error={errores.PesoNetoKg}
              disabled={guardando}
            />
            <InputForModal
              id="Gramaje"
              etiqueta="Gramaje (g/m²)"
              opcional
              medida={DECIMALES_PESO}
              valor={form.Gramaje}
              onCambio={actualizar("Gramaje")}
              error={errores.Gramaje}
              disabled={guardando}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="MotivoCorreccion"
              className="text-xs font-bold uppercase tracking-wide text-slate-600"
            >
              Motivo de la corrección
            </Label>
            <Textarea
              id="MotivoCorreccion"
              value={form.Observacion}
              onChange={(e) => actualizar("Observacion")(limpiarObservacion(e.target.value))}
              maxLength={MOTIVO_CORRECCION_MAX}
              placeholder="Ej. Error de digitación en el peso neto"
              aria-invalid={Boolean(errores.Observacion)}
              disabled={guardando}
              className="min-h-20"
            />
            <div className="flex justify-between gap-2 text-xs">
              <span className="font-semibold text-red-600">{errores.Observacion}</span>
              <span className="shrink-0 tabular-nums text-slate-400">
                {largoMotivo}/{MOTIVO_CORRECCION_MAX}
              </span>
            </div>
          </div>

          {cambios.length > 0 ? (
            <div className="rounded-xl border border-c4/30 bg-c4/5 p-3.5">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-c3">
                Cambios a registrar
              </div>
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {cambios.map((c) => (
                  <li key={c.campo} className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-slate-700">{c.campo}:</span>
                    <span className="text-slate-500 line-through">{c.antes}</span>
                    <ArrowRight size={13} strokeWidth={2.75} className="text-slate-400" />
                    <span className="font-bold text-slate-900">{c.despues}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-400">
              Modifica al menos un dato para poder guardar.
            </div>
          )}

          {inusual && (
            <CasillaConfirmacion
              marcada={inusualRevisado}
              onCambio={setInusualRevisado}
              titulo="El peso bruto es correcto"
            >
              {`El peso bruto está fuera de lo común (${textoRango(PESO_BRUTO_NORMAL_BOBINA_PAPEL_KG, "kg")}). Confirmo que lo revisé contra la ficha del proveedor.`}
            </CasillaConfirmacion>
          )}

          {errorEnvio && (
            <div className="rounded-lg bg-red-50 px-3 py-2.5 text-center text-[13px] font-semibold text-red-600">
              {errorEnvio}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={guardando} />}>
            Cancelar
          </DialogClose>
          <Button
            onClick={guardar}
            disabled={guardando || cambios.length === 0 || (inusual && !inusualRevisado)}
            className="gap-2 bg-gradient-to-r from-c3 to-c4 font-extrabold text-white hover:opacity-90"
          >
            {guardando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check size={16} strokeWidth={2.75} />
                Guardar cambios
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
