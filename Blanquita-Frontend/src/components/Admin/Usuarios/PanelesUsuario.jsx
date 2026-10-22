import { useEffect, useState } from "react";
import { Info, ShieldCheck, ShieldOff, TriangleAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import InputForModal from "@/components/layout/InputForModal";
import { CasillaConfirmacion } from "@/components/Admin/CasillaConfirmacion";
import {
  Roles,
  RolesUsuario,
  MOTIVO_CANCELACION_MIN as MOTIVO_MIN,
  MOTIVO_CANCELACION_MAX as MOTIVO_MAX,
} from "@/constants/Values";
import {
  EstadosUsuario,
  TransicionesEstadoUsuario,
  ID_ESTADO_USUARIO_SUSPENDIDO,
} from "@/constants/Estados";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { limpiarObservacion } from "@/utils/validators";
import {
  cambiarAdminUsuario,
  cambiarEstadoUsuario,
  cambiarRolUsuario,
  editarUsuario,
  restablecerClave,
} from "@/services/Usuario/Admin";
import {
  BotonEnviar,
  CamposClave,
  CAMPOS_NOMBRE,
  ErrorDialogo,
  ETIQUETA,
  PATRON_CELULAR,
  PATRON_NOMBRE,
  claveValida,
  soloDigitos,
  soloLetras,
} from "./Dialogos";

const ROLES_ADMINISTRADOR = [2, 3];

const motivoValido = (motivo) => {
  const largo = motivo.trim().length;
  return largo >= MOTIVO_MIN && largo <= MOTIVO_MAX;
};

function useEnvio(onActualizado) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const enviar = async (accion, mensaje) => {
    setEnviando(true);
    setError("");
    try {
      const resultado = await accion();
      onActualizado(mensaje(resultado));
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return { enviando, error, enviar };
}

export function TarjetaPanel({ titulo, descripcion, pie, children }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="text-base font-extrabold text-slate-900">{titulo}</div>
        {descripcion && <p className="mt-0.5 text-[13px] text-slate-500">{descripcion}</p>}
      </div>
      <div className="flex flex-col gap-4 p-5">{children}</div>
      {pie && (
        <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">{pie}</div>
      )}
    </section>
  );
}

export function AvisoPanel({ titulo, children, tono = "info" }) {
  const Icono = tono === "alerta" ? TriangleAlert : Info;
  const clases =
    tono === "alerta"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px] ${clases}`}>
      <Icono size={17} className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-0.5">
        {titulo && <span className="font-bold">{titulo}</span>}
        <span>{children}</span>
      </div>
    </div>
  );
}

function CampoMotivo({ id, motivo, setMotivo, placeholder }) {
  const largo = motivo.trim().length;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className={ETIQUETA}>
        Motivo
      </Label>
      <Textarea
        id={id}
        value={motivo}
        onChange={(e) => setMotivo(limpiarObservacion(e.target.value))}
        placeholder={placeholder}
        className="min-h-20"
        maxLength={MOTIVO_MAX}
      />
      <span className="text-xs text-slate-500">
        {largo}/{MOTIVO_MAX} · mínimo {MOTIVO_MIN} caracteres
      </span>
    </div>
  );
}

function Pildoras({ opciones, valor, onCambio }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((opcion) => (
        <button
          key={opcion.valor}
          type="button"
          aria-pressed={valor === opcion.valor}
          onClick={() => onCambio(opcion.valor)}
          className={PILDORA_FILTRO}
        >
          {opcion.texto}
        </button>
      ))}
    </div>
  );
}

const formularioEdicion = (usuario) => ({
  PrimerNombre: usuario?.PrimerNombre ?? "",
  SegundoNombre: usuario?.SegundoNombre ?? "",
  ApellidoPaterno: usuario?.ApellidoPaterno ?? "",
  ApellidoMaterno: usuario?.ApellidoMaterno ?? "",
  Celular: usuario?.Celular ?? "",
});

function erroresEdicion(datos) {
  const errores = {};
  for (const { campo, opcional } of CAMPOS_NOMBRE) {
    if (!datos[campo]) {
      if (!opcional) errores[campo] = "Requerido";
    } else if (!PATRON_NOMBRE.test(datos[campo])) {
      errores[campo] = "Entre 2 y 15 letras";
    }
  }
  if (datos.Celular && !PATRON_CELULAR.test(datos.Celular))
    errores.Celular = "8 dígitos, empieza con 6 o 7";
  return errores;
}

export function PanelDatos({ usuario, onActualizado }) {
  const [datos, setDatos] = useState(() => formularioEdicion(usuario));
  const { enviando, error, enviar } = useEnvio(onActualizado);

  useEffect(() => {
    setDatos(formularioEdicion(usuario));
  }, [usuario]);

  const cambiar = (campo, valor) => setDatos((previos) => ({ ...previos, [campo]: valor }));

  const original = formularioEdicion(usuario);
  const hayCambios = Object.keys(original).some((campo) => datos[campo] !== original[campo]);
  const errores = erroresEdicion(datos);
  const valido = hayCambios && Object.keys(errores).length === 0;

  return (
    <TarjetaPanel
      titulo="Datos personales"
      descripcion="Nombres y celular del usuario. El CI no se puede modificar."
      pie={
        <BotonEnviar
          onClick={() =>
            enviar(
              () => editarUsuario(usuario.IdUsuario, datos),
              (r) => `Datos de ${r.NombreCompleto} actualizados`,
            )
          }
          enviando={enviando}
          deshabilitado={!valido}
          className="bg-slate-900 hover:bg-slate-800"
        >
          Guardar cambios
        </BotonEnviar>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CAMPOS_NOMBRE.map(({ campo, etiqueta, opcional }) => (
          <InputForModal
            key={campo}
            id={`editar-${campo}`}
            etiqueta={etiqueta}
            opcional={opcional}
            valor={datos[campo]}
            onCambio={(v) => cambiar(campo, soloLetras(v))}
            error={errores[campo]}
          />
        ))}
        <InputForModal
          id="editar-Celular"
          etiqueta="Celular"
          opcional
          valor={datos.Celular}
          onCambio={(v) => cambiar("Celular", soloDigitos(v, 8))}
          inputMode="numeric"
          classNameInput="font-mono"
          error={errores.Celular}
        />
      </div>
      {error && <ErrorDialogo mensaje={error} />}
    </TarjetaPanel>
  );
}

export function PanelClave({ usuario, onActualizado }) {
  const [clave, setClave] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const { enviando, error, enviar } = useEnvio((mensaje) => {
    setClave("");
    setConfirmacion("");
    onActualizado(mensaje);
  });

  const valido = claveValida(clave) && clave === confirmacion;

  return (
    <TarjetaPanel
      titulo="Cambiar contraseña"
      descripcion="Comunica la nueva clave al usuario de forma personal."
      pie={
        <BotonEnviar
          onClick={() =>
            enviar(
              () => restablecerClave(usuario.IdUsuario, clave),
              (r) => `Clave de ${r.NombreCompleto} restablecida`,
            )
          }
          enviando={enviando}
          deshabilitado={!valido}
          className="bg-slate-900 hover:bg-slate-800"
        >
          Restablecer clave
        </BotonEnviar>
      }
    >
      <div className="max-w-md">
        <CamposClave
          prefijoId="restablecer"
          clave={clave}
          setClave={setClave}
          confirmacion={confirmacion}
          setConfirmacion={setConfirmacion}
        />
      </div>
      {error && <ErrorDialogo mensaje={error} />}
    </TarjetaPanel>
  );
}

export function PanelRol({ usuario, onActualizado }) {
  const [idRol, setIdRol] = useState(null);
  const [motivo, setMotivo] = useState("");
  const { enviando, error, enviar } = useEnvio(onActualizado);

  useEffect(() => {
    setIdRol(null);
    setMotivo("");
  }, [usuario]);

  const opciones = RolesUsuario.filter(
    (r) => r.IdRol !== usuario.IdRol && r.IdRol !== Roles.Gerente,
  ).map((r) => ({
    valor: r.IdRol,
    texto: r.NombreRol,
  }));
  const bloqueadoPorAdmin =
    idRol !== null && usuario.IsAdmin && !ROLES_ADMINISTRADOR.includes(idRol);
  const valido = idRol !== null && !bloqueadoPorAdmin && motivoValido(motivo);

  return (
    <TarjetaPanel
      titulo="Cambiar rol"
      descripcion={`Rol actual: ${usuario.NombreRol}. El cambio se aplica cuando el usuario renueva su sesión.`}
      pie={
        <BotonEnviar
          onClick={() =>
            enviar(
              () => cambiarRolUsuario(usuario.IdUsuario, idRol, motivo),
              (r) => `${r.NombreCompleto}: ${r.NombreRolAnterior} → ${r.NombreRol}`,
            )
          }
          enviando={enviando}
          deshabilitado={!valido}
          className="bg-slate-900 hover:bg-slate-800"
        >
          Cambiar rol
        </BotonEnviar>
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label className={ETIQUETA}>Nuevo rol</Label>
        <Pildoras opciones={opciones} valor={idRol} onCambio={setIdRol} />
      </div>

      {bloqueadoPorAdmin && (
        <AvisoPanel tono="alerta" titulo="El usuario es administrador">
          Solo un Líder de Inventario y Producción o Gerente General puede ser administrador. Retira
          primero el acceso de administrador.
        </AvisoPanel>
      )}

      <CampoMotivo
        id="motivo-rol"
        motivo={motivo}
        setMotivo={setMotivo}
        placeholder="Ej. Ascenso, reasignación de funciones..."
      />
      {error && <ErrorDialogo mensaje={error} />}
    </TarjetaPanel>
  );
}

export function PanelAdmin({ usuario, onActualizado }) {
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const { enviando, error, enviar } = useEnvio(onActualizado);

  useEffect(() => {
    setMotivo("");
    setConfirmado(false);
  }, [usuario]);

  const otorgar = !usuario.IsAdmin;
  const rolPermitido = ROLES_ADMINISTRADOR.includes(usuario.IdRol);
  const valido = motivoValido(motivo) && confirmado && (!otorgar || rolPermitido);
  const Icono = otorgar ? ShieldCheck : ShieldOff;

  return (
    <TarjetaPanel
      titulo="Acceso de administrador"
      descripcion={
        usuario.IsAdmin
          ? "El usuario tiene acceso al panel de administración."
          : "El usuario no tiene acceso al panel de administración."
      }
      pie={
        <BotonEnviar
          onClick={() =>
            enviar(
              () => cambiarAdminUsuario(usuario.IdUsuario, otorgar, motivo),
              (r) =>
                r.IsAdmin
                  ? `${r.NombreCompleto} ahora es administrador`
                  : `${r.NombreCompleto} ya no es administrador`,
            )
          }
          enviando={enviando}
          deshabilitado={!valido}
          className={otorgar ? "bg-slate-900 hover:bg-slate-800" : "bg-red-600 hover:bg-red-700"}
        >
          <Icono size={16} strokeWidth={2.5} />
          {otorgar ? "Otorgar acceso" : "Quitar acceso de administrador"}
        </BotonEnviar>
      }
    >
      {otorgar && !rolPermitido ? (
        <AvisoPanel tono="alerta" titulo="Rol no permitido">
          Solo un Líder de Inventario y Producción o Gerente General puede ser administrador. Cambia
          primero el rol del usuario.
        </AvisoPanel>
      ) : (
        <>
          <CampoMotivo
            id="motivo-admin"
            motivo={motivo}
            setMotivo={setMotivo}
            placeholder={otorgar ? "Ej. Encargado de catálogos..." : "Ej. Cambio de funciones..."}
          />
          <CasillaConfirmacion
            marcada={confirmado}
            onCambio={setConfirmado}
            titulo={otorgar ? "Otorgar acceso de administrador" : "Quitar acceso de administrador"}
          >
            {otorgar
              ? "Podrá gestionar usuarios, proveedores y catálogos desde el panel de administración."
              : "Dejará de ver el panel de administración de inmediato. Sus acciones registradas se conservan."}
          </CasillaConfirmacion>
        </>
      )}
      {error && <ErrorDialogo mensaje={error} />}
    </TarjetaPanel>
  );
}

export function PanelEstado({ usuario, onActualizado }) {
  const [idEstado, setIdEstado] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [confirmarSuspension, setConfirmarSuspension] = useState(false);
  const { enviando, error, enviar } = useEnvio(onActualizado);

  useEffect(() => {
    setIdEstado(null);
    setMotivo("");
    setConfirmarSuspension(false);
  }, [usuario]);

  const opciones = EstadosUsuario.filter((e) =>
    (TransicionesEstadoUsuario[usuario.IdEstadoUsuario] ?? []).includes(e.IdEstadoUsuario),
  ).map((e) => ({ valor: e.IdEstadoUsuario, texto: e.NombreEstadoUsuario }));
  const suspender = idEstado === ID_ESTADO_USUARIO_SUSPENDIDO;
  const valido =
    idEstado !== null && motivoValido(motivo) && (!suspender || confirmarSuspension);

  return (
    <TarjetaPanel
      titulo="Cambiar estado"
      descripcion={`Estado actual: ${usuario.NombreEstadoUsuario}. Un usuario Inactivo no puede ingresar; la suspensión es definitiva.`}
      pie={
        <BotonEnviar
          onClick={() =>
            enviar(
              () => cambiarEstadoUsuario(usuario.IdUsuario, idEstado, motivo),
              (r) => `${r.NombreCompleto}: ${r.NombreEstadoAnterior} → ${r.NombreEstadoUsuario}`,
            )
          }
          enviando={enviando}
          deshabilitado={!valido}
          className={suspender ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"}
        >
          {suspender ? "Suspender usuario" : "Cambiar estado"}
        </BotonEnviar>
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label className={ETIQUETA}>Nuevo estado</Label>
        <Pildoras
          opciones={opciones}
          valor={idEstado}
          onCambio={(valor) => {
            setIdEstado(valor);
            setConfirmarSuspension(false);
          }}
        />
      </div>

      <CampoMotivo
        id="motivo-estado"
        motivo={motivo}
        setMotivo={setMotivo}
        placeholder="Ej. Licencia, fin de contrato..."
      />

      {suspender && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-2 text-sm font-semibold text-red-700">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" />
            La suspensión es definitiva: el usuario no podrá volver a ingresar y su estado ya no podrá
            cambiarse.
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-red-700">
            <input
              type="checkbox"
              checked={confirmarSuspension}
              onChange={(e) => setConfirmarSuspension(e.target.checked)}
              className="h-4 w-4 accent-red-600"
            />
            Entiendo que no se puede deshacer
          </label>
        </div>
      )}
      {error && <ErrorDialogo mensaje={error} />}
    </TarjetaPanel>
  );
}
