import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/layout/Header";
import {
  cargarLoteBobinaServilleta,
  ObtenerTiposBobinaServilleta,
} from "../../services/BobinaServilleta/BobinaServilleta";
import { ObtenerProveedoresForm } from "../../services/Proveedor/Proveedor";
import { dateFormatter } from "@/utils/dates";
import { Formatos } from "@/constants/BobinaServilleta";
import { aCodigo } from "@/utils/handlers";
import { numeroONulo } from "@/utils/validators";
import { useCatalogo } from "@/hooks/useCatalogo";
import { soloActivos } from "@/utils/catalogo";
import {
  useFilasLote,
  useEnvioLote,
  codigosRepetidos,
  erroresPorFila,
} from "@/hooks/useIngresoLote";
import {
  ResultadoLote,
  DatosLote,
  SelectorProveedor,
  SelectorTipo,
  EncabezadoFilas,
  CabeceraFila,
  ErrorFila,
  ErrorEnvio,
  BarraGuardarLote,
} from "@/components/IngresoLote/comunes";

const FORMATO_UNIDAD_1 = Formatos[0];
const FORMATO_UNIDAD_2 = Formatos[1];

const filaVacia = () => ({
  Codigo1: "",
  PesoBruto1: "",
  Gramaje1: "",
  Codigo2: "",
  PesoBruto2: "",
  Gramaje2: "",
});

const pesoInvalido = (v) => v !== "" && Number(v) <= 0;

const unidadDe = (f, numero, formato) => ({
  CodigoBobina: f[`Codigo${numero}`].trim(),
  IdFormatoSubBobina: formato.IdFormatoSubBobina,
  PesoBrutoKg: numeroONulo(f[`PesoBruto${numero}`]),
  GramajeGr: numeroONulo(f[`Gramaje${numero}`]),
});

function BloqueUnidad({ numero, formato, claseBadge, fila, conError, onCampo, inputRef, onKeyDown }) {
  const codigo = fila[`Codigo${numero}`];

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-white p-3 ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={cn("font-bold", claseBadge)}>
          Unidad {numero}
        </Badge>
        <span className="text-[12px] font-semibold text-slate-500">
          Formato {formato.DescripcionFormato}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[2fr_1fr_1fr]">
        <Input
          ref={inputRef}
          value={codigo}
          onChange={(e) => onCampo(`Codigo${numero}`, aCodigo(e.target.value))}
          onKeyDown={onKeyDown}
          placeholder={`Código de la unidad ${numero}`}
          className={cn(
            "h-10 font-mono",
            conError && !codigo.trim() && "border-red-300 focus-visible:ring-red-300",
          )}
        />
        <Input
          value={fila[`PesoBruto${numero}`]}
          onChange={(e) => onCampo(`PesoBruto${numero}`, e.target.value)}
          placeholder="Bruto (kg)"
          type="number"
          step="0.01"
          className="h-10"
        />
        <Input
          value={fila[`Gramaje${numero}`]}
          onChange={(e) => onCampo(`Gramaje${numero}`, e.target.value)}
          placeholder="Gramaje (g)"
          type="number"
          step="0.01"
          className="h-10"
        />
      </div>
    </div>
  );
}

export default function IngresoBobinasServilleta({ usuario }) {
  const [idProveedor, setIdProveedor] = useState("");
  const [idTipoBobinaServilleta, setIdTipoBobinaServilleta] = useState(null);

  const proveedores = useCatalogo(ObtenerProveedoresForm);
  const tipos = useCatalogo(soloActivos(ObtenerTiposBobinaServilleta), (data) => {
    if (data.length) setIdTipoBobinaServilleta(data[0].IdTipoBobinaServilleta);
  });

  const envio = useEnvioLote();
  const { tocado } = envio;
  const { filas, actualizarFila, agregarFila, quitarFila, registrarRef, reiniciar } =
    useFilasLote(filaVacia, () => envio.setResultado(null));

  const repetidos = codigosRepetidos(filas.flatMap((f) => [f.Codigo1, f.Codigo2]));

  const erroresFilas = erroresPorFila(filas, (f) => {
    const c1 = f.Codigo1.trim();
    const c2 = f.Codigo2.trim();
    if (!c1) return "Falta el código de la unidad 1";
    if (!c2) return "Falta el código de la unidad 2";
    if (repetidos.has(c1.toLowerCase())) return "Código de unidad 1 repetido";
    if (repetidos.has(c2.toLowerCase())) return "Código de unidad 2 repetido";
    if (pesoInvalido(f.PesoBruto1)) return "Peso bruto de unidad 1 inválido";
    if (pesoInvalido(f.PesoBruto2)) return "Peso bruto de unidad 2 inválido";
    if (pesoInvalido(f.Gramaje1)) return "Gramaje de unidad 1 inválido";
    if (pesoInvalido(f.Gramaje2)) return "Gramaje de unidad 2 inválido";
    return null;
  });
  const hayErrores = Object.keys(erroresFilas).length > 0;

  const listo =
    !!idProveedor && !!idTipoBobinaServilleta && filas.length > 0 && !hayErrores;

  const guardarLote = () =>
    envio.guardar({
      validar: () => {
        if (!idProveedor) return "Selecciona el proveedor del lote.";
        if (!idTipoBobinaServilleta) return "Selecciona el tipo de bobina del lote.";
        if (hayErrores) return "Revisa las bobinas marcadas en rojo antes de guardar.";
        return null;
      },
      enviar: () =>
        cargarLoteBobinaServilleta(
          Number(idProveedor),
          Number(idTipoBobinaServilleta),
          filas.map((f) => ({
            Unidades: [unidadDe(f, 1, FORMATO_UNIDAD_1), unidadDe(f, 2, FORMATO_UNIDAD_2)],
          })),
        ),
      alGuardar: (data) => {
        reiniciar();
        toast.success(
          `${data.CantidadBobinasServilleta} bobinas (${data.CantidadUnidades} unidades) ingresadas al almacén`,
        );
      },
    });

  const tipoActual = tipos.datos.find(
    (t) => t.IdTipoBobinaServilleta === idTipoBobinaServilleta,
  );

  return (
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header
        volver
        titulo="Almacén · Materia Prima"
        subtitulo="Registrar ingreso de bobinas de servilleta"
        contador={{
          valor: filas.length,
          singular: "bobina en el lote",
          plural: "bobinas en el lote",
        }}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        {envio.resultado && (
          <ResultadoLote
            descripcion={
              <>
                {envio.resultado.CantidadBobinasServilleta} bobinas ·{" "}
                {envio.resultado.CantidadUnidades} unidades · Recepción{" "}
                {dateFormatter(envio.resultado.FechaRecepcion)}
              </>
            }
            onCerrar={() => envio.setResultado(null)}
          />
        )}

        <DatosLote descripcion="Se aplican a todas las bobinas que registres abajo">
          <SelectorProveedor
            catalogo={proveedores}
            valor={idProveedor}
            onCambio={setIdProveedor}
            invalido={tocado && !idProveedor}
          />
          <SelectorTipo
            catalogo={tipos}
            valor={idTipoBobinaServilleta}
            onCambio={setIdTipoBobinaServilleta}
            campoValor="IdTipoBobinaServilleta"
            campoEtiqueta="NombreTipoBobinaServilleta"
            etiqueta="Tipo de bobina"
            mensajeVacio="No hay tipos de bobina servilleta registrados."
            cantidadSkeleton={2}
          />
        </DatosLote>

        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <EncabezadoFilas
            titulo="Bobinas del lote"
            tipo={tipoActual?.NombreTipoBobinaServilleta}
            nota="Cada bobina lleva 2 unidades: unidad 1 arriba, unidad 2 abajo"
            textoAgregar="Agregar bobina"
            onAgregar={agregarFila}
          />

          <div className="flex flex-col gap-4 p-5">
            {filas.map((f, i) => {
              const err = tocado ? erroresFilas[f.id] : null;
              const cambiarCampo = (campo, valor) => actualizarFila(f.id, campo, valor);
              return (
                <div
                  key={f.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border-2 p-4",
                    err ? "border-red-300 bg-red-50/50" : "border-slate-200 bg-slate-50",
                  )}
                >
                  <CabeceraFila
                    titulo={`Bobina ${i + 1}`}
                    onQuitar={() => quitarFila(f.id)}
                    deshabilitado={filas.length === 1}
                  />

                  <BloqueUnidad
                    numero={1}
                    formato={FORMATO_UNIDAD_1}
                    claseBadge="border-c3 text-c3"
                    fila={f}
                    conError={!!err}
                    onCampo={cambiarCampo}
                    inputRef={registrarRef(f.id)}
                  />

                  <BloqueUnidad
                    numero={2}
                    formato={FORMATO_UNIDAD_2}
                    claseBadge="border-serv3 text-serv3"
                    fila={f}
                    conError={!!err}
                    onCampo={cambiarCampo}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && i === filas.length - 1) agregarFila();
                    }}
                  />

                  {err && <ErrorFila mensaje={err} />}
                </div>
              );
            })}
          </div>
        </section>

        {envio.errorEnvio && <ErrorEnvio mensaje={envio.errorEnvio} />}

        <BarraGuardarLote listo={listo} enviando={envio.enviando} onGuardar={guardarLote}>
          <span className="font-extrabold text-white">
            {filas.length} {filas.length === 1 ? "bobina" : "bobinas"}
          </span>
          <span className="text-slate-400">
            <strong className="text-slate-200">{filas.length * 2}</strong> unidades
          </span>
        </BarraGuardarLote>
      </main>
    </div>
  );
}
