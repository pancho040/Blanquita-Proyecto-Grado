import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import InputForModal from "@/components/layout/InputForModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { BotonEnviar, ErrorDialogo, ETIQUETA } from "@/components/Admin/Usuarios/Dialogos";
import {
  MOTIVO_CANCELACION_MIN as MOTIVO_MIN,
  MOTIVO_CANCELACION_MAX as MOTIVO_MAX,
} from "@/constants/Values";
import { EstadosProveedor } from "@/constants/Estados";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { limpiarObservacion } from "@/utils/validators";
import { ProveedorDatos } from "@/models/Proveedor/Proveedor";
import {
  crearProveedor,
  editarProveedor,
  cambiarEstadoProveedor,
} from "@/services/Proveedor/Proveedor";

const NOMBRE_MIN = 3;
const NOMBRE_MAX = 60;
const CORREO_MAX = 100;
const PATRON_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,&-]+$/;
const PATRON_CELULAR = /^[67]\d{7}$/;
const PATRON_CORREO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const VALORES_POR_DEFECTO = {
  NombreProveedor: "",
  CelularProveedor: "",
  CorreoProveedor: "",
};

const aFormulario = (proveedor) => ({
  NombreProveedor: proveedor.NombreProveedor,
  CelularProveedor: proveedor.CelularProveedor ?? "",
  CorreoProveedor: proveedor.CorreoProveedor ?? "",
});

function erroresProveedor(datos) {
  const errores = {};
  const { NombreProveedor, CelularProveedor, CorreoProveedor } = ProveedorDatos(datos);
  if (NombreProveedor && (NombreProveedor.length < NOMBRE_MIN || !PATRON_NOMBRE.test(NombreProveedor)))
    errores.NombreProveedor = `Entre ${NOMBRE_MIN} y ${NOMBRE_MAX} caracteres: letras, números, espacios y . , & -`;
  if (CelularProveedor && !PATRON_CELULAR.test(CelularProveedor))
    errores.CelularProveedor = "8 dígitos, empieza con 6 o 7";
  if (CorreoProveedor && !PATRON_CORREO.test(CorreoProveedor))
    errores.CorreoProveedor = "Correo no válido";
  return errores;
}

function ResumenProveedor({ proveedor }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[15px] font-extrabold text-slate-900">{proveedor.NombreProveedor}</div>
      <div className="text-[12.5px] text-slate-500">
        {proveedor.CelularProveedor ?? "Sin celular"} · {proveedor.NombreEstadoProveedor}
      </div>
    </div>
  );
}

function NombreFijo({ nombre }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className={ETIQUETA}>Nombre</Label>
      <div className="flex h-11 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-bold text-slate-700">
        <Lock size={14} className="shrink-0 text-slate-400" />
        <span className="truncate">{nombre}</span>
      </div>
      <span className="text-xs text-slate-500">El nombre no se puede cambiar.</span>
    </div>
  );
}

export function DialogoProveedor({ abierto, proveedor, onCerrar, onGuardado }) {
  const [datos, setDatos] = useState(VALORES_POR_DEFECTO);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const editando = Boolean(proveedor);

  useEffect(() => {
    if (!abierto) return;
    setDatos(proveedor ? aFormulario(proveedor) : VALORES_POR_DEFECTO);
    setConfirmado(false);
    setError("");
  }, [abierto, proveedor]);

  const cambiar = (campo) => (valor) => setDatos((previos) => ({ ...previos, [campo]: valor }));

  const errores = erroresProveedor(datos);
  const completo = datos.NombreProveedor.trim() !== "";
  const sinCambios =
    editando &&
    JSON.stringify(ProveedorDatos(aFormulario(proveedor))) === JSON.stringify(ProveedorDatos(datos));
  const valido =
    completo && Object.keys(errores).length === 0 && !sinCambios && (editando || confirmado);
  const nombreLimpio = ProveedorDatos(datos).NombreProveedor;

  const confirmar = async () => {
    setEnviando(true);
    setError("");
    try {
      const guardado = editando
        ? await editarProveedor(proveedor.IdProveedor, datos)
        : await crearProveedor(datos);
      onGuardado(guardado, editando);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && !enviando && onCerrar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar proveedor" : "Registrar proveedor"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "Los cambios no modifican los lotes ya registrados."
              : "El proveedor se registra como Activo y aparece en los formularios de ingreso."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {editando ? (
            <NombreFijo nombre={proveedor.NombreProveedor} />
          ) : (
            <InputForModal
              id="proveedor-nombre"
              etiqueta="Nombre"
              valor={datos.NombreProveedor}
              onCambio={(v) => {
                cambiar("NombreProveedor")(v.slice(0, NOMBRE_MAX));
                setConfirmado(false);
              }}
              placeholder="Ej. Papelera del Sur S.R.L."
              error={errores.NombreProveedor}
            />
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InputForModal
              id="proveedor-celular"
              etiqueta="Celular"
              opcional
              valor={datos.CelularProveedor}
              onCambio={(v) => cambiar("CelularProveedor")(v.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              placeholder="70012345"
              classNameInput="tabular-nums"
              error={errores.CelularProveedor}
            />
            <InputForModal
              id="proveedor-correo"
              etiqueta="Correo"
              opcional
              type="email"
              valor={datos.CorreoProveedor}
              onCambio={(v) => cambiar("CorreoProveedor")(v.replace(/\s/g, "").slice(0, CORREO_MAX))}
              placeholder="ventas@empresa.com"
              error={errores.CorreoProveedor}
            />
          </div>

          {!editando && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <input
                type="checkbox"
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-slate-900"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-slate-900">
                  Confirmo el registro del proveedor
                  {nombreLimpio && ` «${nombreLimpio}»`}
                </span>
                <span className="text-[12.5px] text-slate-600">
                  Una vez registrado, el nombre no podrá ser editado. Solo se podrán cambiar el
                  celular y el correo.
                </span>
              </span>
            </label>
          )}

          {error && <ErrorDialogo mensaje={error} />}
        </div>

        <DialogFooter>
          <BotonEnviar
            onClick={confirmar}
            enviando={enviando}
            deshabilitado={!valido}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {editando ? "Guardar cambios" : "Registrar proveedor"}
          </BotonEnviar>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DialogoCambiarEstado({ proveedor, onCerrar, onCambiado }) {
  const [activo, setActivo] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!proveedor) return;
    setActivo(null);
    setMotivo("");
    setError("");
  }, [proveedor]);

  const destinos = proveedor
    ? EstadosProveedor.filter((e) => e.Activo !== proveedor.Activo)
    : [];
  const largo = motivo.trim().length;
  const valido = activo !== null && largo >= MOTIVO_MIN && largo <= MOTIVO_MAX;

  const confirmar = async () => {
    setEnviando(true);
    setError("");
    try {
      onCambiado(await cambiarEstadoProveedor(proveedor.IdProveedor, activo, motivo));
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={Boolean(proveedor)} onOpenChange={(open) => !open && !enviando && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar estado</DialogTitle>
          <DialogDescription>
            Un proveedor inactivo no aparece en los formularios de ingreso; sus lotes se conservan.
          </DialogDescription>
        </DialogHeader>

        {proveedor && (
          <div className="flex flex-col gap-4">
            <ResumenProveedor proveedor={proveedor} />

            <div className="flex flex-col gap-1.5">
              <Label className={ETIQUETA}>Nuevo estado</Label>
              <div className="flex flex-wrap gap-2">
                {destinos.map((estado) => (
                  <button
                    key={estado.NombreEstadoProveedor}
                    type="button"
                    aria-pressed={activo === estado.Activo}
                    onClick={() => setActivo(estado.Activo)}
                    className={PILDORA_FILTRO}
                  >
                    {estado.NombreEstadoProveedor}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motivo-estado-proveedor" className={ETIQUETA}>
                Motivo
              </Label>
              <Textarea
                id="motivo-estado-proveedor"
                value={motivo}
                onChange={(e) => setMotivo(limpiarObservacion(e.target.value))}
                placeholder="Ej. Dejó de distribuir, problemas de calidad..."
                className="min-h-20"
                maxLength={MOTIVO_MAX}
              />
              <span className="text-xs text-slate-500">
                {largo}/{MOTIVO_MAX} · mínimo {MOTIVO_MIN} caracteres
              </span>
            </div>

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
            Cambiar estado
          </BotonEnviar>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
