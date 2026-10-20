import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { MOTIVO_CANCELACION_MIN, MOTIVO_CANCELACION_MAX } from "@/constants/Values";
import { dateFormatter } from "@/utils/dates";
import { alternarMotivoEnTexto } from "@/utils/handlers";
import { limpiarObservacion } from "@/utils/validators";
import { ResumenProduccion } from "./comunes";

const ETIQUETA = "text-xs font-bold uppercase tracking-wide text-slate-600";

function ContadorMotivo({ motivo }) {
  return (
    <span className="text-xs text-slate-500">
      {motivo.trim().length}/{MOTIVO_CANCELACION_MAX} · mínimo {MOTIVO_CANCELACION_MIN}{" "}
      caracteres
    </span>
  );
}

function ErrorDialogo({ mensaje }) {
  return (
    <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600">
      {mensaje}
    </div>
  );
}

function useConfirmacion(abierto) {
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    if (abierto) setConfirmado(false);
  }, [abierto]);

  return [confirmado, setConfirmado];
}

function CasillaIrreversible({
  id,
  accion,
  confirmado,
  setConfirmado,
  deshabilitado,
  detalle = "Esta acción es irreversible y quedará registrada con su usuario.",
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left"
    >
      <input
        id={id}
        type="checkbox"
        checked={confirmado}
        disabled={deshabilitado}
        onChange={(e) => setConfirmado(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-slate-900"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-bold text-slate-900">
          Confirmo que voy a {accion} esta producción
        </span>
        <span className="text-[12.5px] text-slate-600">{detalle}</span>
      </span>
    </label>
  );
}

function DialogoMotivoProduccion({
  dialogo,
  tituloDe,
  opciones,
  id,
  titulo,
  etiqueta,
  placeholder,
  accion,
  detalle,
  textoBoton,
  claseBoton,
}) {
  const [confirmado, setConfirmado] = useConfirmacion(dialogo.abierto);
  const seleccionados = opciones.filter((m) => dialogo.motivo.includes(m));

  return (
    <Dialog open={dialogo.abierto} onOpenChange={(open) => !open && dialogo.cerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {dialogo.produccion && (
            <ResumenProduccion
              titulo={tituloDe(dialogo.produccion)}
              produccion={dialogo.produccion}
            />
          )}

          <div className="flex flex-col gap-1.5">
            <Label className={ETIQUETA}>Motivos frecuentes</Label>
            <ToggleGroup
              type="multiple"
              value={seleccionados}
              className="flex flex-wrap justify-start gap-2"
            >
              {opciones.map((motivo) => (
                <ToggleGroupItem
                  key={motivo}
                  value={motivo}
                  onClick={() =>
                    dialogo.setMotivo((actual) => alternarMotivoEnTexto(motivo, actual))
                  }
                  className="h-auto whitespace-normal rounded-full border-2 border-slate-200 px-3.5 py-2 text-left text-[12.5px] font-bold text-slate-600 bg-white hover:border-slate-300 hover:bg-white hover:text-slate-600 aria-pressed:border-slate-900 aria-pressed:bg-slate-900 aria-pressed:text-white aria-pressed:hover:border-slate-900 aria-pressed:hover:bg-slate-900 aria-pressed:hover:text-white"
                >
                  {motivo}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id} className={ETIQUETA}>
              {etiqueta}
            </Label>
            <Textarea
              id={id}
              value={dialogo.motivo}
              onChange={(e) => dialogo.setMotivo(limpiarObservacion(e.target.value))}
              placeholder={placeholder}
              className="min-h-20"
              maxLength={MOTIVO_CANCELACION_MAX}
            />
            <ContadorMotivo motivo={dialogo.motivo} />
          </div>

          <CasillaIrreversible
            id={`confirmar-${id}`}
            accion={accion}
            detalle={detalle}
            confirmado={confirmado}
            setConfirmado={setConfirmado}
            deshabilitado={dialogo.enviando}
          />

          {dialogo.error && <ErrorDialogo mensaje={dialogo.error} />}
        </div>

        <DialogFooter>
          <Button
            onClick={dialogo.confirmar}
            disabled={dialogo.enviando || !dialogo.valido || !confirmado}
            className={`h-11 w-full gap-2 font-extrabold text-white sm:w-auto ${claseBoton}`}
          >
            {dialogo.enviando ? <Loader2 size={16} className="animate-spin" /> : textoBoton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DialogoPausar({ dialogo, tituloDe, opciones }) {
  return (
    <DialogoMotivoProduccion
      dialogo={dialogo}
      tituloDe={tituloDe}
      opciones={opciones}
      id="motivo-pausa"
      titulo="Pausar producción"
      etiqueta="Detalle de la pausa"
      placeholder="Ej. Falla de máquina, cambio de turno..."
      accion="pausar"
      detalle="Quedará registrada con su usuario. Recuerde reanudarla para no inflar la duración de la pausa."
      textoBoton="Pausar producción"
      claseBoton="bg-amber-500 hover:bg-amber-600"
    />
  );
}

export function DialogoReanudar({ dialogo, tituloDe, opciones }) {
  return (
    <DialogoMotivoProduccion
      dialogo={dialogo}
      tituloDe={tituloDe}
      opciones={opciones}
      id="motivo-reanudacion"
      titulo="Reanudar producción"
      etiqueta="Detalle de la reanudación"
      placeholder="Ej. Se reparó la máquina, se terminó el empalme..."
      accion="reanudar"
      detalle="La pausa se cerrará con la hora actual y quedará registrada con su usuario."
      textoBoton="Reanudar producción"
      claseBoton="bg-emerald-600 hover:bg-emerald-700"
    />
  );
}

export function DialogoCancelar({ dialogo, tituloDe, placeholder }) {
  const [confirmado, setConfirmado] = useConfirmacion(dialogo.abierto);

  return (
    <Dialog open={dialogo.abierto} onOpenChange={(open) => !open && dialogo.cerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar producción</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {dialogo.produccion && (
            <ResumenProduccion
              titulo={tituloDe(dialogo.produccion)}
              produccion={dialogo.produccion}
            />
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motivo-cancelacion" className={ETIQUETA}>
              Motivo de cancelación
            </Label>
            <Textarea
              id="motivo-cancelacion"
              value={dialogo.motivo}
              onChange={(e) => dialogo.setMotivo(limpiarObservacion(e.target.value))}
              placeholder={placeholder}
              className="min-h-20"
              maxLength={MOTIVO_CANCELACION_MAX}
            />
            <ContadorMotivo motivo={dialogo.motivo} />
          </div>

          <CasillaIrreversible
            id="confirmar-cancelacion"
            accion="cancelar"
            confirmado={confirmado}
            setConfirmado={setConfirmado}
            deshabilitado={dialogo.enviando}
          />

          {dialogo.error && <ErrorDialogo mensaje={dialogo.error} />}
        </div>

        <DialogFooter>
          <Button
            onClick={dialogo.confirmar}
            disabled={dialogo.enviando || !dialogo.valido || !confirmado}
            className="h-11 w-full gap-2 bg-red-600 font-extrabold text-white hover:bg-red-700 sm:w-auto"
          >
            {dialogo.enviando ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "Cancelar producción"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AlertaFinalizar({ dialogo, prefijo, codigoDe }) {
  const p = dialogo.produccion;
  const [confirmado, setConfirmado] = useConfirmacion(dialogo.abierto);

  return (
    <AlertDialog open={dialogo.abierto} onOpenChange={(open) => !open && dialogo.cerrar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Finalizar esta producción?</AlertDialogTitle>
          <AlertDialogDescription>
            {p && (
              <>
                Se marcará como finalizada la producción {prefijo}{" "}
                <span className="font-mono font-bold text-slate-900">{codigoDe(p)}</span>
                {p.FechaInicioProduccion && (
                  <>, iniciada el {dateFormatter(p.FechaInicioProduccion)}</>
                )}
                . Esta acción no se puede deshacer.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <CasillaIrreversible
          id="confirmar-finalizacion"
          accion="finalizar"
          confirmado={confirmado}
          setConfirmado={setConfirmado}
          deshabilitado={dialogo.enviando}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={dialogo.enviando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={dialogo.confirmar}
            disabled={dialogo.enviando || !confirmado}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {dialogo.enviando ? <Loader2 size={16} className="animate-spin" /> : "Finalizar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
