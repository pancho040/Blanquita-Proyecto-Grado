import { useState } from "react";
import { CircleCheck, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Header from "@/components/layout/Header";
import InputForModal from "@/components/layout/InputForModal";
import { SelectEntidad } from "@/components/layout/Selectentidad";
import { Roles, RolesUsuario } from "@/constants/Values";
import { crearUsuario } from "@/services/Usuario/Admin";
import {
  CamposClave,
  BotonEnviar,
  ErrorDialogo,
  ETIQUETA,
  claveValida,
  PATRON_NOMBRE,
  PATRON_CELULAR,
  CAMPOS_NOMBRE,
  soloLetras,
  soloDigitos,
} from "./Dialogos";

const PATRON_CI = /^\d{6,12}$/;

const FORMULARIO_VACIO = {
  Ci: "",
  PrimerNombre: "",
  SegundoNombre: "",
  ApellidoPaterno: "",
  ApellidoMaterno: "",
  Celular: "",
  IdRol: "",
  IsAdmin: false,
};

function erroresRegistro(datos) {
  const errores = {};
  if (datos.Ci && !PATRON_CI.test(datos.Ci)) errores.Ci = "Entre 6 y 12 dígitos";
  if (datos.Celular && !PATRON_CELULAR.test(datos.Celular))
    errores.Celular = "8 dígitos, empieza con 6 o 7";
  for (const { campo } of CAMPOS_NOMBRE) {
    if (datos[campo] && !PATRON_NOMBRE.test(datos[campo])) errores[campo] = "Entre 2 y 15 letras";
  }
  return errores;
}

function Seccion({ titulo, descripcion, children }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="text-base font-extrabold text-slate-900">{titulo}</div>
        {descripcion && <p className="mt-0.5 text-[13px] text-slate-500">{descripcion}</p>}
      </div>
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </section>
  );
}

function Registrado({ usuario, onOtro }) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-slate-200">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
        <CircleCheck size={30} className="text-emerald-600" />
      </div>
      <div>
        <div className="text-lg font-extrabold text-slate-900">Usuario registrado</div>
        <p className="mt-1 text-sm text-slate-500">
          <span className="font-bold text-slate-900">{usuario.NombreCompleto}</span> · CI{" "}
          <span className="font-mono font-bold text-slate-900">{usuario.Ci}</span> ·{" "}
          {usuario.NombreRol}
          {usuario.IsAdmin && " · Administrador"}
        </p>
        <p className="mt-2 text-[13px] text-slate-500">
          Ya puede ingresar con su CI y la clave que definiste.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={onOtro}
          className="h-11 gap-2 font-bold"
        >
          <UserPlus size={16} strokeWidth={2.5} />
          Registrar otro
        </Button>
        <Button
          onClick={() => (window.location.href = "/admin/usuarios")}
          className="h-11 gap-2 bg-slate-900 font-extrabold text-white hover:bg-slate-800"
        >
          <Users size={16} strokeWidth={2.5} />
          Ver usuarios
        </Button>
      </div>
    </section>
  );
}

export default function RegistrarUsuario() {
  const [datos, setDatos] = useState(FORMULARIO_VACIO);
  const [clave, setClave] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [creado, setCreado] = useState(null);

  const cambiar = (campo) => (valor) => setDatos((previos) => ({ ...previos, [campo]: valor }));

  const puedeSerAdmin = Number(datos.IdRol) === Roles.Encargado;

  const cambiarRol = (valor) =>
    setDatos((previos) => ({
      ...previos,
      IdRol: valor,
      IsAdmin: Number(valor) === Roles.Encargado ? previos.IsAdmin : false,
    }));

  const errores = erroresRegistro(datos);
  const completo =
    datos.Ci && datos.PrimerNombre && datos.ApellidoPaterno && datos.Celular && datos.IdRol;
  const valido =
    completo &&
    Object.keys(errores).length === 0 &&
    claveValida(clave) &&
    clave === confirmacion;

  const reiniciar = () => {
    setDatos(FORMULARIO_VACIO);
    setClave("");
    setConfirmacion("");
    setError("");
    setCreado(null);
  };

  const confirmar = async () => {
    setEnviando(true);
    setError("");
    try {
      setCreado(await crearUsuario({ ...datos, Clave: clave }));
      setClave("");
      setConfirmacion("");
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="contenido-con-sidebar flex min-h-screen flex-col bg-slate-50 pt-20 font-sans text-slate-900 md:pt-0">
      <Header volver="/admin/usuarios" titulo="Usuarios" subtitulo="Registrar usuario" />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6 sm:px-6">
        {creado ? (
          <Registrado usuario={creado} onOtro={reiniciar} />
        ) : (
          <>
            <Seccion titulo="Datos personales">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputForModal
                  id="registro-ci"
                  etiqueta="CI"
                  valor={datos.Ci}
                  onCambio={(v) => cambiar("Ci")(soloDigitos(v, 12))}
                  inputMode="numeric"
                  classNameInput="font-mono"
                  error={errores.Ci}
                />
                <InputForModal
                  id="registro-celular"
                  etiqueta="Celular"
                  valor={datos.Celular}
                  onCambio={(v) => cambiar("Celular")(soloDigitos(v, 8))}
                  inputMode="numeric"
                  classNameInput="font-mono"
                  error={errores.Celular}
                />
                {CAMPOS_NOMBRE.map(({ campo, etiqueta, opcional }) => (
                  <InputForModal
                    key={campo}
                    id={`registro-${campo}`}
                    etiqueta={etiqueta}
                    opcional={opcional}
                    valor={datos[campo]}
                    onCambio={(v) => cambiar(campo)(soloLetras(v))}
                    error={errores[campo]}
                  />
                ))}
              </div>
            </Seccion>

            <Seccion titulo="Acceso" descripcion="Define qué podrá hacer el usuario en el sistema.">
              <div className="flex flex-col gap-1.5">
                <Label className={ETIQUETA}>Rol</Label>
                <SelectEntidad
                  opciones={RolesUsuario}
                  valor={datos.IdRol}
                  onCambio={cambiarRol}
                  campoValor="IdRol"
                  campoEtiqueta="NombreRol"
                  placeholder="Selecciona un rol"
                />
              </div>

              {puedeSerAdmin && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={datos.IsAdmin}
                    onChange={(e) => cambiar("IsAdmin")(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-slate-900"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-slate-900">Acceso de administrador</span>
                    <span className="text-[12.5px] text-slate-500">
                      Podrá entrar al panel de administración y hacer gestión completa del sistema.
                    </span>
                  </span>
                </label>
              )}
            </Seccion>

            <Seccion
              titulo="Clave"
              descripcion="El usuario ingresará con su CI y esta clave. Comunícasela de forma personal."
            >
              <CamposClave
                prefijoId="registro"
                clave={clave}
                setClave={setClave}
                confirmacion={confirmacion}
                setConfirmacion={setConfirmacion}
              />
            </Seccion>

            {error && <ErrorDialogo mensaje={error} />}

            <div className="flex justify-end">
              <BotonEnviar
                onClick={confirmar}
                enviando={enviando}
                deshabilitado={!valido}
                className="bg-slate-900 hover:bg-slate-800"
              >
                <UserPlus size={16} strokeWidth={2.5} />
                Registrar usuario
              </BotonEnviar>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
