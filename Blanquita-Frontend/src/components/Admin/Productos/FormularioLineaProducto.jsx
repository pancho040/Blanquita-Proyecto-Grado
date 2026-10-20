import { useEffect, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import InputForModal from "@/components/layout/InputForModal";
import { ErrorDialogo, ETIQUETA } from "@/components/Admin/Usuarios/Dialogos";
import { CamposStock, errorStock } from "@/components/Admin/CamposStock";
import { CasillaConfirmacion } from "@/components/Admin/CasillaConfirmacion";
import {
  Indicacion,
  PaginaFormulario,
  PATRON_NOMBRE_TIPO,
  PieFormulario,
  Pildora,
  Seccion,
} from "@/components/Admin/MateriaPrima/comunes";
import {
  NOMBRE_LINEA_PRODUCTO_MIN as NOMBRE_MIN,
  NOMBRE_LINEA_PRODUCTO_MAX as NOMBRE_MAX,
  PRESENTACIONES_MAXIMAS_AL_CREAR_LINEA as PRESENTACIONES_MAX,
  UNIDADES_MAXIMAS_POR_PAQUETE as UNIDADES_MAX,
  PAQUETES_MAXIMOS_POR_JABA as PAQUETES_MAX,
  LONGITUD_MAXIMA_SUFIJO_CODIGO_PRESENTACION as SUFIJO_MAX,
} from "@/constants/Values";
import { limpiarTexto } from "@/models/MateriaPrima/TipoMateriaPrima";
import {
  CONTENEDORES_PRESENTACION,
  CONTENEDOR_PLANCHA,
  ORIGEN_NINGUNO,
  ORIGEN_PAPEL,
  ORIGEN_SERVILLETA,
  codigoSugerido,
  siglasSugeridas,
  textoContenido,
} from "@/models/Producto/LineaProducto";
import {
  crearLineaProducto,
  crearPresentacionProducto,
  listarLineasProducto,
  obtenerLineaProducto,
  obtenerTiposOrigenLinea,
} from "@/services/Producto/LineaProducto";
import { guardarMensaje } from "@/utils/mensajeFlash";

export const RUTA_PRODUCTOS = "/admin/productos";
export const rutaLinea = (id) => `${RUTA_PRODUCTOS}/editar/${id}`;

export const FILA_PRESENTACION = {
  TipoContenedor: "Jaba",
  CantidadRollosUnidades: "",
  CantidadPorUnidadTerminada: "",
  CodigoPresentacion: "",
  CodigoManual: false,
  StockMinimo: "",
  StockPreventivo: "",
};

const soloDigitos = (texto) => String(texto ?? "").replace(/\D/g, "").slice(0, 4);

export const unidadStock = (contenedor) => (contenedor === CONTENEDOR_PLANCHA ? "planchas" : "jabas");

export const codigoDe = (fila, siglas) =>
  fila.CodigoManual
    ? fila.CodigoPresentacion.replace(/\s/g, "").toUpperCase()
    : codigoSugerido(siglas, fila.TipoContenedor, fila.CantidadRollosUnidades);

const paquetesDe = (fila) =>
  fila.TipoContenedor === CONTENEDOR_PLANCHA ? 1 : Number(fila.CantidadPorUnidadTerminada);

const combinacionDe = (p) =>
  `${p.TipoContenedor}|${Number(p.CantidadRollosUnidades)}|${p.TipoContenedor === CONTENEDOR_PLANCHA ? 1 : Number(p.CantidadPorUnidadTerminada)}`;

export function erroresPresentaciones(filas, siglas, existentes = [], codigosUsados = []) {
  const usados = new Set(codigosUsados);
  const combinacionesExistentes = new Set(existentes.map(combinacionDe));

  return filas.map((fila, i) => {
    const errores = {};
    const unidades = Number(fila.CantidadRollosUnidades);
    if (fila.CantidadRollosUnidades === "") errores.Unidades = "Obligatorio";
    else if (unidades < 1 || unidades > UNIDADES_MAX) errores.Unidades = `Entre 1 y ${UNIDADES_MAX}`;

    if (fila.TipoContenedor !== CONTENEDOR_PLANCHA) {
      const paquetes = Number(fila.CantidadPorUnidadTerminada);
      if (fila.CantidadPorUnidadTerminada === "") errores.Paquetes = "Obligatorio";
      else if (paquetes < 1 || paquetes > PAQUETES_MAX) errores.Paquetes = `Entre 1 y ${PAQUETES_MAX}`;
    }

    const codigo = codigoDe(fila, siglas);
    const patron = new RegExp(`^${siglas}-[A-Z0-9]{1,${SUFIJO_MAX}}$`);
    if (fila.CodigoManual && siglas && !patron.test(codigo))
      errores.Codigo = `Debe empezar con ${siglas}- y seguir con 1 a ${SUFIJO_MAX} letras o números`;
    else if (codigo && usados.has(codigo)) errores.Codigo = "Este código ya está registrado";
    else if (codigo && filas.some((f, j) => j < i && codigoDe(f, siglas) === codigo))
      errores.Codigo = "Código repetido";

    if (!errores.Unidades && !errores.Paquetes) {
      const combinacion = combinacionDe(fila);
      if (combinacionesExistentes.has(combinacion))
        errores.Combinacion = "La línea ya tiene una presentación con este contenido";
      else if (filas.some((f, j) => j < i && combinacionDe(f) === combinacion))
        errores.Combinacion = "Repite el contenido de otra presentación";
    }

    const stock = errorStock(fila.StockMinimo, fila.StockPreventivo);
    if (stock) errores.Stock = stock;
    return errores;
  });
}

export function CamposPresentacion({ prefijoId, fila, siglas, errores, titulo, onCambio, onQuitar }) {
  const esPlancha = fila.TipoContenedor === CONTENEDOR_PLANCHA;
  const sugerido = codigoSugerido(siglas, fila.TipoContenedor, fila.CantidadRollosUnidades);
  const codigo = codigoDe(fila, siglas);

  const cambiar = (campo, valor) => onCambio({ ...fila, [campo]: valor });

  return (
    <div className="flex flex-col gap-3.5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[13px] font-extrabold text-slate-900">{titulo}</span>
          <span className="font-mono text-[12.5px] font-bold text-c3">
            {codigo || "Código pendiente"}
            {!errores.Unidades && !errores.Paquetes && fila.CantidadRollosUnidades !== "" && (
              <span className="ml-1.5 font-sans font-semibold text-slate-500">
                · {textoContenido({ ...fila, CantidadPorUnidadTerminada: paquetesDe(fila) })}
              </span>
            )}
          </span>
        </div>
        {onQuitar && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onQuitar}
            className="h-9 w-9 text-slate-400"
            aria-label="Quitar presentación"
          >
            <Trash2 size={16} />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className={ETIQUETA}>Contenedor</Label>
        <div className="flex flex-wrap gap-2">
          {CONTENEDORES_PRESENTACION.map((contenedor) => (
            <Pildora
              key={contenedor}
              marcada={fila.TipoContenedor === contenedor}
              onClick={() => cambiar("TipoContenedor", contenedor)}
            >
              {contenedor}
            </Pildora>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          {esPlancha
            ? "La plancha se cuenta por unidad: cada plancha es un paquete."
            : "La jaba se cuenta por jaba: indica cuántos paquetes lleva."}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <InputForModal
          id={`${prefijoId}-unidades`}
          etiqueta={esPlancha ? "Unidades por plancha" : "Unidades por paquete"}
          valor={fila.CantidadRollosUnidades}
          onCambio={(v) => cambiar("CantidadRollosUnidades", soloDigitos(v))}
          inputMode="numeric"
          placeholder="Ej. 12"
          error={errores.Unidades}
        />
        {!esPlancha && (
          <InputForModal
            id={`${prefijoId}-paquetes`}
            etiqueta="Paquetes por jaba"
            valor={fila.CantidadPorUnidadTerminada}
            onCambio={(v) => cambiar("CantidadPorUnidadTerminada", soloDigitos(v))}
            inputMode="numeric"
            placeholder="Ej. 6"
            error={errores.Paquetes}
          />
        )}
        <div className="flex flex-col gap-1.5">
          <InputForModal
            id={`${prefijoId}-codigo`}
            etiqueta="Código"
            valor={codigo}
            onCambio={(v) =>
              onCambio({
                ...fila,
                CodigoManual: true,
                CodigoPresentacion: v.replace(/\s/g, "").toUpperCase().slice(0, 4 + SUFIJO_MAX),
              })
            }
            placeholder={sugerido || "Se genera solo"}
            classNameInput="font-mono font-bold uppercase"
            error={errores.Codigo}
          />
          {fila.CodigoManual && sugerido && codigo !== sugerido && (
            <button
              type="button"
              onClick={() => onCambio({ ...fila, CodigoManual: false, CodigoPresentacion: "" })}
              className="flex items-center gap-1 self-start text-xs font-bold text-c3 hover:underline"
            >
              <RotateCcw size={12} strokeWidth={2.5} />
              Usar {sugerido}
            </button>
          )}
        </div>
      </div>

      {errores.Combinacion && (
        <span className="text-xs font-semibold text-red-600">{errores.Combinacion}</span>
      )}

      <CamposStock
        prefijoId={prefijoId}
        stockMinimo={fila.StockMinimo}
        stockPreventivo={fila.StockPreventivo}
        onCambio={(campo, valor) => cambiar(campo, valor)}
        unidad={`${unidadStock(fila.TipoContenedor)} en inventario`}
      />
    </div>
  );
}

export function SelectorOrigen({ tipos, origen, actual = null, deshabilitado = false, onCambio }) {
  const grupo = (tipo, titulo, lista) => {
    const opciones =
      actual && actual.tipo === tipo && !lista.some((t) => t.Id === actual.id)
        ? [...lista, { Id: actual.id, Nombre: `${actual.nombre} (inactivo)` }]
        : lista;
    return (
      <div className="flex flex-col gap-1.5">
        <Label className={ETIQUETA}>{titulo}</Label>
        {opciones.length ? (
          <div className="flex flex-wrap gap-2">
            {opciones.map((t) => (
              <Pildora
                key={t.Id}
                marcada={origen.tipo === tipo && origen.id === t.Id}
                deshabilitada={deshabilitado}
                onClick={() => onCambio({ tipo, id: t.Id })}
              >
                {t.Nombre}
              </Pildora>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400">No hay tipos activos.</span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3.5">
      {grupo(ORIGEN_PAPEL, "Bobina papel", tipos.BobinaPapel)}
      {grupo(ORIGEN_SERVILLETA, "Bobina servilleta", tipos.BobinaServilleta)}
      <div className="flex flex-col gap-1.5">
        <Label className={ETIQUETA}>Otro</Label>
        <div className="flex flex-wrap gap-2">
          <Pildora
            marcada={origen.tipo === ORIGEN_NINGUNO}
            deshabilitada={deshabilitado}
            onClick={() => onCambio({ tipo: ORIGEN_NINGUNO, id: null })}
          >
            Sin materia prima (merma o segunda)
          </Pildora>
        </div>
      </div>
    </div>
  );
}

const TIPOS_VACIOS = { BobinaPapel: [], BobinaServilleta: [] };

export function FormularioLineaProducto() {
  const [lineas, setLineas] = useState([]);
  const [tipos, setTipos] = useState(TIPOS_VACIOS);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [nombre, setNombre] = useState("");
  const [siglas, setSiglas] = useState("");
  const [siglasManual, setSiglasManual] = useState(false);
  const [origen, setOrigen] = useState(null);
  const [filas, setFilas] = useState([FILA_PRESENTACION]);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([listarLineasProducto({ TamanoPagina: 1000 }), obtenerTiposOrigenLinea()])
      .then(([listado, tiposOrigen]) => {
        setLineas(listado.Tipos);
        setTipos(tiposOrigen);
      })
      .catch((e) => setErrorCarga(e.message))
      .finally(() => setCargando(false));
  }, []);

  const conCambio = (accion) => (...args) => {
    accion(...args);
    setConfirmado(false);
  };

  const siglasFinales = siglasManual ? siglas : siglasSugeridas(nombre);
  const nombreLimpio = limpiarTexto(nombre);
  const codigosUsados = lineas.flatMap((l) => l.Presentaciones.map((p) => p.CodigoPresentacion));

  const errores = {};
  if (nombreLimpio && (nombreLimpio.length < NOMBRE_MIN || !PATRON_NOMBRE_TIPO.test(nombreLimpio)))
    errores.Nombre = `Entre ${NOMBRE_MIN} y ${NOMBRE_MAX} caracteres: letras, números, espacios y . , % ( ) / -`;
  else if (lineas.some((l) => l.NombreProducto.toLowerCase() === nombreLimpio.toLowerCase()))
    errores.Nombre = "Ya existe una línea con este nombre";
  if (siglasFinales && siglasFinales.length !== 3) errores.Siglas = "Deben ser exactamente 3 letras";
  else if (lineas.some((l) => l.SiglasProducto === siglasFinales))
    errores.Siglas = "Estas siglas ya pertenecen a otra línea";

  const erroresFilas = erroresPresentaciones(filas, siglasFinales, [], codigosUsados);
  const completo = nombreLimpio !== "" && siglasFinales.length === 3 && origen !== null;
  const valido =
    completo &&
    Object.keys(errores).length === 0 &&
    erroresFilas.every((e) => Object.keys(e).length === 0) &&
    confirmado;

  const confirmar = async () => {
    setEnviando(true);
    setError("");
    try {
      const creada = await crearLineaProducto({
        Nombre: nombre,
        Siglas: siglasFinales,
        Origen: origen,
        Presentaciones: filas.map((f) => ({ ...f, CodigoPresentacion: codigoDe(f, siglasFinales) })),
      });
      guardarMensaje(
        `Línea ${creada.NombreProducto} registrada con ${creada.Presentaciones.length} presentaciones`,
      );
      window.location.href = RUTA_PRODUCTOS;
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  return (
    <PaginaFormulario
      subtitulo="Registrar línea de producto"
      volver={RUTA_PRODUCTOS}
      cargando={cargando}
      error={errorCarga}
    >
      <Indicacion>
        <span className="font-bold text-slate-900">
          Una línea agrupa sus presentaciones (Luxury → LUX-J06, LUX-J12...).
        </span>
        <span>
          El nombre, las siglas y el contenido de cada presentación no se pueden cambiar después para
          conservar la trazabilidad; si cambian, registra una presentación nueva y desactiva la anterior.
        </span>
      </Indicacion>

      <Seccion titulo="Datos de la línea">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
          <InputForModal
            id="linea-nombre"
            etiqueta="Nombre"
            valor={nombre}
            onCambio={conCambio((v) => setNombre(v.slice(0, NOMBRE_MAX)))}
            placeholder="Ej. EcoPack Plus"
            error={errores.Nombre}
          />
          <InputForModal
            id="linea-siglas"
            etiqueta="Siglas"
            valor={siglasFinales}
            onCambio={conCambio((v) => {
              setSiglasManual(true);
              setSiglas(
                v
                  .normalize("NFD")
                  .replace(/[̀-ͯ]/g, "")
                  .toUpperCase()
                  .replace(/[^A-Z]/g, "")
                  .slice(0, 3),
              );
            })}
            placeholder="Ej. ECP"
            classNameInput="font-mono font-bold uppercase"
            error={errores.Siglas}
          />
        </div>
        <span className="text-xs text-slate-500">
          Las siglas se sugieren desde el nombre y forman el código de cada presentación.
        </span>
      </Seccion>

      <Seccion
        titulo="Materia prima de origen"
        ayuda="Tipo de bobina con el que se produce la línea. Las líneas de bobina papel se eligen al iniciar producción."
      >
        <SelectorOrigen tipos={tipos} origen={origen ?? { tipo: null, id: null }} onCambio={conCambio(setOrigen)} />
      </Seccion>

      <Seccion
        titulo="Presentaciones"
        ayuda={`De 1 a ${PRESENTACIONES_MAX}. El código se arma con las siglas, el contenedor y las unidades; puedes corregirlo.`}
      >
        <div className="flex flex-col gap-3">
          {filas.map((fila, i) => (
            <CamposPresentacion
              key={i}
              prefijoId={`presentacion-${i}`}
              fila={fila}
              siglas={siglasFinales}
              errores={erroresFilas[i]}
              titulo={`Presentación ${i + 1}`}
              onCambio={conCambio((nueva) => setFilas((previas) => previas.map((f, j) => (j === i ? nueva : f))))}
              onQuitar={
                filas.length > 1
                  ? conCambio(() => setFilas((previas) => previas.filter((_, j) => j !== i)))
                  : null
              }
            />
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={filas.length >= PRESENTACIONES_MAX}
            onClick={conCambio(() => setFilas((previas) => [...previas, FILA_PRESENTACION]))}
            className="h-10 self-start gap-1.5 font-bold"
          >
            <Plus size={15} strokeWidth={2.5} />
            Agregar presentación
          </Button>
        </div>
      </Seccion>

      <CasillaConfirmacion
        marcada={confirmado}
        onCambio={setConfirmado}
        titulo={`Confirmo el registro de la línea${nombreLimpio ? ` «${nombreLimpio}»` : ""}`}
      >
        El registro quedará en el historial de acciones del administrador. La línea no se puede eliminar
        y su nombre y siglas no podrán ser editados; se puede desactivar para que no aparezca en los
        registros nuevos.
      </CasillaConfirmacion>

      {error && <ErrorDialogo mensaje={error} />}

      <PieFormulario
        volver={RUTA_PRODUCTOS}
        onEnviar={confirmar}
        enviando={enviando}
        deshabilitado={!valido}
        texto="Registrar línea"
      />
    </PaginaFormulario>
  );
}

export function FormularioPresentacion({ id }) {
  const [linea, setLinea] = useState(null);
  const [codigosUsados, setCodigosUsados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [fila, setFila] = useState(FILA_PRESENTACION);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([obtenerLineaProducto(id), listarLineasProducto({ TamanoPagina: 1000 })])
      .then(([actual, listado]) => {
        setLinea(actual);
        setCodigosUsados(listado.Tipos.flatMap((l) => l.Presentaciones.map((p) => p.CodigoPresentacion)));
      })
      .catch((e) => setErrorCarga(e.message))
      .finally(() => setCargando(false));
  }, []);

  const volver = rutaLinea(id);
  const siglas = linea?.SiglasProducto ?? "";
  const errores = erroresPresentaciones([fila], siglas, linea?.Presentaciones ?? [], codigosUsados)[0];
  const valido = linea?.Activo && Object.keys(errores).length === 0 && confirmado;

  const confirmar = async () => {
    setEnviando(true);
    setError("");
    try {
      const codigo = codigoDe(fila, siglas);
      await crearPresentacionProducto(id, { ...fila, CodigoPresentacion: codigo });
      guardarMensaje(`Presentación ${codigo} registrada`);
      window.location.href = volver;
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  return (
    <PaginaFormulario
      subtitulo={`Agregar presentación${linea ? ` · ${linea.NombreProducto}` : ""}`}
      volver={volver}
      cargando={cargando}
      error={errorCarga}
    >
      {linea && (
        <>
          <Indicacion>
            <span className="font-bold text-slate-900">
              Nueva presentación de {linea.NombreProducto} ({linea.SiglasProducto}).
            </span>
            <span>
              Queda disponible para el ingreso de producto terminado. Su contenido no se puede cambiar
              después; si cambia, registra otra y desactiva esta.
            </span>
          </Indicacion>

          {!linea.Activo && (
            <ErrorDialogo mensaje="La línea está inactiva; actívala antes de agregar presentaciones." />
          )}

          <CamposPresentacion
            prefijoId="presentacion-nueva"
            fila={fila}
            siglas={siglas}
            errores={errores}
            titulo="Presentación nueva"
            onCambio={(nueva) => {
              setFila(nueva);
              setConfirmado(false);
            }}
          />

          <CasillaConfirmacion
            marcada={confirmado}
            onCambio={setConfirmado}
            titulo={`Confirmo el registro de la presentación ${codigoDe(fila, siglas) || ""}`}
          >
            El registro quedará en el historial de acciones del administrador. La presentación no se puede
            eliminar ni cambiar su contenido; se puede desactivar.
          </CasillaConfirmacion>

          {error && <ErrorDialogo mensaje={error} />}

          <PieFormulario
            volver={volver}
            onEnviar={confirmar}
            enviando={enviando}
            deshabilitado={!valido}
            texto="Registrar presentación"
          />
        </>
      )}
    </PaginaFormulario>
  );
}
