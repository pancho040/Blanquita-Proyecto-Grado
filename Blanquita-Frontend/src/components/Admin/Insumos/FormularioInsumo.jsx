import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import InputForModal from "@/components/layout/InputForModal";
import { ErrorDialogo, ETIQUETA } from "@/components/Admin/Usuarios/Dialogos";
import { CamposStock, errorStock } from "@/components/Admin/CamposStock";
import { CasillaConfirmacion } from "@/components/Admin/CasillaConfirmacion";
import {
  Indicacion,
  NombreFijo,
  PaginaFormulario,
  PieFormulario,
  Seccion,
} from "@/components/Admin/MateriaPrima/comunes";
import { limpiarObservacion } from "@/utils/validators";
import { guardarMensaje } from "@/utils/mensajeFlash";
import { InsumoDatos } from "@/models/Insumo/Insumo";
import { crearInsumo, editarInsumo, obtenerInsumo } from "@/services/Insumo/Insumo";

const RUTA_LISTA = "/admin/insumos";
const NOMBRE_MIN = 3;
const NOMBRE_MAX = 60;
const DESCRIPCION_MIN = 10;
const DESCRIPCION_MAX = 50;
const PATRON_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,()/-]+$/;

const VALORES_POR_DEFECTO = {
  NombreInsumo: "",
  DescripcionInsumo: "",
  StockMinimo: "",
  StockPreventivo: "",
};

const aFormulario = (insumo) => ({
  NombreInsumo: insumo.NombreInsumo,
  DescripcionInsumo: insumo.DescripcionInsumo ?? "",
  StockMinimo: insumo.StockMinimo ?? "",
  StockPreventivo: insumo.StockPreventivo ?? "",
});

function erroresInsumo(datos, insumo) {
  const errores = {};
  const { NombreInsumo, DescripcionInsumo } = InsumoDatos(datos);
  const descripcionOriginal = insumo ? InsumoDatos(aFormulario(insumo)).DescripcionInsumo : null;
  if (!insumo && NombreInsumo && (NombreInsumo.length < NOMBRE_MIN || !PATRON_NOMBRE.test(NombreInsumo)))
    errores.NombreInsumo = `Entre ${NOMBRE_MIN} y ${NOMBRE_MAX} caracteres: letras, números, espacios y . , ( ) / -`;
  if (
    DescripcionInsumo &&
    DescripcionInsumo !== descripcionOriginal &&
    (DescripcionInsumo.length < DESCRIPCION_MIN || DescripcionInsumo.length > DESCRIPCION_MAX)
  )
    errores.DescripcionInsumo = `Entre ${DESCRIPCION_MIN} y ${DESCRIPCION_MAX} caracteres`;
  const stock = errorStock(datos.StockMinimo, datos.StockPreventivo);
  if (stock) errores.Stock = stock;
  return errores;
}

export function FormularioInsumo({ id = null }) {
  const editando = id !== null;
  const [insumo, setInsumo] = useState(null);
  const [datos, setDatos] = useState(VALORES_POR_DEFECTO);
  const [cargando, setCargando] = useState(editando);
  const [errorCarga, setErrorCarga] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editando) return;
    obtenerInsumo(id)
      .then((actual) => {
        setInsumo(actual);
        setDatos(aFormulario(actual));
      })
      .catch((e) => setErrorCarga(e.message))
      .finally(() => setCargando(false));
  }, []);

  const cambiar = (campo) => (valor) => {
    setDatos((previos) => ({ ...previos, [campo]: valor }));
    setConfirmado(false);
  };

  const limpios = InsumoDatos(datos);
  const errores = erroresInsumo(datos, insumo);
  const completo = limpios.DescripcionInsumo !== "" && (editando || limpios.NombreInsumo !== "");
  const sinCambios =
    editando && insumo && JSON.stringify(InsumoDatos(aFormulario(insumo))) === JSON.stringify(limpios);
  const valido = completo && Object.keys(errores).length === 0 && !sinCambios && confirmado;
  const largoDescripcion = limpios.DescripcionInsumo.length;

  const confirmar = async () => {
    setEnviando(true);
    setError("");
    try {
      const guardado = editando ? await editarInsumo(id, datos) : await crearInsumo(datos);
      guardarMensaje(
        `Insumo ${guardado.NombreInsumo} ${editando ? "actualizado" : "registrado"} correctamente`,
      );
      window.location.href = RUTA_LISTA;
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  return (
    <PaginaFormulario
      subtitulo={editando ? `Editar insumo${insumo ? ` · ${insumo.NombreInsumo}` : ""}` : "Registrar insumo"}
      volver={RUTA_LISTA}
      cargando={cargando}
      error={errorCarga}
    >
      {(!editando || insumo) && (
        <>
          <Indicacion>
            <span className="font-bold text-slate-900">
              {editando ? "Puedes cambiar la descripción y la alerta de stock." : "Nuevo insumo."}
            </span>
            <span>
              {editando
                ? "Los movimientos registrados no se modifican."
                : "El insumo se crea con stock 0 y aparece en el inventario de insumos de la planta."}
            </span>
          </Indicacion>

          <Seccion titulo="Datos generales">
            {editando ? (
              <NombreFijo nombre={insumo?.NombreInsumo ?? ""} />
            ) : (
              <InputForModal
                id="insumo-nombre"
                etiqueta="Nombre"
                valor={datos.NombreInsumo}
                onCambio={(v) => cambiar("NombreInsumo")(v.slice(0, NOMBRE_MAX))}
                placeholder="Ej. Pegamento de laminado"
                error={errores.NombreInsumo}
              />
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="insumo-descripcion" className={ETIQUETA}>
                Descripción
              </Label>
              <Textarea
                id="insumo-descripcion"
                value={datos.DescripcionInsumo}
                onChange={(e) => cambiar("DescripcionInsumo")(limpiarObservacion(e.target.value))}
                placeholder="Ej. Llega en turriles; uso en rebobinadora"
                className="min-h-20"
                maxLength={Math.max(DESCRIPCION_MAX, largoDescripcion)}
                aria-invalid={Boolean(errores.DescripcionInsumo)}
              />
              <span
                className={
                  errores.DescripcionInsumo ? "text-xs font-semibold text-red-600" : "text-xs text-slate-500"
                }
              >
                {errores.DescripcionInsumo ??
                  `${largoDescripcion}/${DESCRIPCION_MAX} · mínimo ${DESCRIPCION_MIN} caracteres`}
              </span>
            </div>
          </Seccion>

          <CamposStock
            prefijoId="insumo"
            stockMinimo={datos.StockMinimo}
            stockPreventivo={datos.StockPreventivo}
            onCambio={(campo, valor) => cambiar(campo)(valor)}
            unidad="la unidad en que se cuenta el insumo (turriles, bidones, bolsas…)"
          />

          {editando ? (
            <CasillaConfirmacion
              marcada={confirmado}
              onCambio={setConfirmado}
              titulo={`Confirmo los cambios en ${insumo?.NombreInsumo ?? "el insumo"}`}
            >
              El cambio quedará registrado en el historial de acciones del administrador con el valor
              anterior y el nuevo.
            </CasillaConfirmacion>
          ) : (
            <CasillaConfirmacion
              marcada={confirmado}
              onCambio={setConfirmado}
              titulo={`Confirmo el registro del insumo${
                limpios.NombreInsumo ? ` «${limpios.NombreInsumo}»` : ""
              }`}
            >
              El registro quedará en el historial de acciones del administrador. El insumo no se puede
              eliminar y su nombre no podrá ser editado; solo se podrán cambiar la descripción y la alerta
              de stock.
            </CasillaConfirmacion>
          )}

          {error && <ErrorDialogo mensaje={error} />}
          {sinCambios && (
            <span className="text-right text-xs font-semibold text-slate-500">No hay cambios para guardar.</span>
          )}

          <PieFormulario
            volver={RUTA_LISTA}
            onEnviar={confirmar}
            enviando={enviando}
            deshabilitado={!valido}
            texto={editando ? "Guardar cambios" : "Registrar insumo"}
          />
        </>
      )}
    </PaginaFormulario>
  );
}
