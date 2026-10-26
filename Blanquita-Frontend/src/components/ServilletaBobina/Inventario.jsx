import { useState } from "react";
import { Plus, Loader2, Database, Disc, Check, SquarePen, History } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import InputForModal from "@/components/layout/InputForModal";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  verResumenInventarioBobinaServilleta,
  verDetalleInventarioBobinaServilleta,
  verResumenInventarioSubBobinaServilleta,
  verDetalleInventarioSubBobinaServilleta,
  verSubBobinasServilletaFueraInventario,
  reingresarSubBobinaInventario,
  editarBobinaServilleta,
} from "../../services/BobinaServilleta/Inventario";
import {
  abrirBobinaServilleta,
  iniciarProduccionServilleta,
} from "../../services/BobinaServilleta/Produccion";
import {
  descargarReporteInventarioCompletoServilleta,
  verBobinasServilletaReporte,
} from "../../services/BobinaServilleta/Reportes";
import { dateFormatter } from "@/utils/dates";
import { codigoFinal } from "@/utils/handlers";
import {
  errorCodigo,
  extraerMensajeError,
  numeroONulo,
  limpiarObservacion,
  VeComoLider,
  EsGerente,
  rutaDeRol,
} from "@/utils/validators";
import { useCatalogo } from "@/hooks/useCatalogo";
import { useDetalleInventario } from "@/hooks/useDetalleInventario";
import { useEjecutar } from "@/hooks/useEjecutar";
import { BotonDescarga } from "@/components/layout/BotonDescarga";
import {
  GRID_TARJETAS,
  conAcentos,
  coincide,
  TarjetaTipo,
  TarjetaFueraInventario,
  EncabezadoCatalogo,
  EstadoCatalogo,
  PanelDetalle,
  PanelFuera,
  BuscadorCodigo,
  ContenidoLista,
  CasillaSeleccion,
  BarraSeleccion,
  ItemFueraInventario,
  BadgeReingresada,
  DialogReingreso,
} from "@/components/Inventario/comunes";
import Header from "@/components/layout/Header";
import {
  DECIMALES_PESO,
  GRAMAJE_MAXIMO,
  MOTIVO_CORRECCION_MIN,
  MOTIVO_CORRECCION_MAX,
  PESO_MAXIMO_UNIDAD_SERVILLETA_KG,
  PESO_MINIMO_UNIDAD_SERVILLETA_KG,
} from "@/constants/Values";
import { errorMedida } from "@/utils/medidas";

const ESTADO_ALMACEN_ID = 1;

const sinDatos = async () => [];

const aTexto = (valor) => (valor === null || valor === undefined ? "" : String(valor));


const etiquetaCantidad = (n, singular, plural) => {
  const c = Number(n || 0);
  return `${c} ${c === 1 ? singular : plural}`;
};

const cargarDetalle = ({ clase, id }) =>
  clase === "bobina"
    ? verDetalleInventarioBobinaServilleta(id)
    : verDetalleInventarioSubBobinaServilleta(id);

const mismaSeleccion = (a, b) => a.clase === b.clase && a.id === b.id;

function TablaBobinas({ bobinas, tipoSel, procesandoId, onAbrir, onEditar }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">Bobina</TableHead>
            <TableHead>Recepción</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead className={cn(!onAbrir && !onEditar && "pr-5")}>Unidades</TableHead>
            {(onAbrir || onEditar) && <TableHead className="pr-5 text-center">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {bobinas.map((b) => (
            <TableRow key={b.IdBobinaServilleta}>
              <TableCell className={cn("pl-5 font-mono font-bold", tipoSel.text)}>
                #{b.IdBobinaServilleta}
              </TableCell>
              <TableCell className="text-slate-600">
                {dateFormatter(b.FechaRecepcion)}
              </TableCell>
              <TableCell className="text-slate-600">{b.NombreProveedor}</TableCell>
              <TableCell className={cn("text-slate-600", !onAbrir && !onEditar && "pr-5")}>
                <div className="flex flex-col gap-1">
                  {b.Unidades.map((u) => (
                    <span key={u.IdUnidadBobinaServilleta}>
                      <span className="font-mono font-semibold text-slate-900">
                        {u.CodigoBobina}
                      </span>
                      <span className="text-[11px] text-slate-400"> · {u.DescripcionFormato}</span>
                    </span>
                  ))}
                </div>
              </TableCell>
              {(onAbrir || onEditar) && (
              <TableCell className="pr-5">
                <div className="flex items-center justify-center gap-2">
                  {onEditar && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditar(b)}
                      className="gap-1.5 font-bold text-c3"
                    >
                      <SquarePen size={14} strokeWidth={2.5} />
                      Editar
                    </Button>
                  )}
                  {onAbrir && (
                    <Button
                      size="sm"
                      disabled={procesandoId === b.IdBobinaServilleta}
                      onClick={() => onAbrir(b)}
                      className="gap-1.5 bg-gradient-to-r from-c3 to-c4 font-bold text-white hover:opacity-90"
                    >
                      {procesandoId === b.IdBobinaServilleta ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        "Abrir"
                      )}
                    </Button>
                  )}
                </div>
              </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ListaMovilBobinas({ bobinas, tipoSel, procesandoId, onAbrir, onEditar }) {
  return (
    <div className="flex flex-col gap-2.5 p-3.5">
      {bobinas.map((b) => (
        <div
          key={b.IdBobinaServilleta}
          className="flex flex-col gap-2.5 rounded-2xl border-2 border-slate-200 bg-white p-3.5"
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className={cn("font-mono text-[15px] font-extrabold", tipoSel.text)}>
              #{b.IdBobinaServilleta}
            </div>
            <span className="text-[12px] text-slate-500">
              {dateFormatter(b.FechaRecepcion)}
            </span>
          </div>
          <div className="text-[12.5px] text-slate-600">{b.NombreProveedor}</div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-slate-600">
            {b.Unidades.map((u) => (
              <span key={u.IdUnidadBobinaServilleta}>
                <strong className="font-mono text-slate-900">{u.CodigoBobina}</strong> ·{" "}
                {u.DescripcionFormato}
              </span>
            ))}
          </div>
          {(onAbrir || onEditar) && (
          <div className="flex gap-2">
            {onEditar && (
              <Button
                variant="outline"
                onClick={() => onEditar(b)}
                className="h-10 flex-1 gap-1.5 font-bold text-c3"
              >
                <SquarePen size={15} strokeWidth={2.5} />
                Editar
              </Button>
            )}
            {onAbrir && (
              <Button
                disabled={procesandoId === b.IdBobinaServilleta}
                onClick={() => onAbrir(b)}
                className="h-10 flex-1 gap-1.5 bg-gradient-to-r from-c3 to-c4 font-bold text-white hover:opacity-90"
              >
                {procesandoId === b.IdBobinaServilleta ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  "Abrir bobina"
                )}
              </Button>
            )}
          </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TablaSubBobinas({ subBobinas, tipoSel, marcada, onToggle }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[460px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {onToggle && <TableHead className="w-11 pl-5" />}
            <TableHead className={cn(!onToggle && "pl-5")}>Sub-bobina</TableHead>
            <TableHead className="pr-5">Unidad de origen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subBobinas.map((s) => {
            const on = marcada === s.IdSubBobinaServilleta;
            return (
              <TableRow key={s.IdSubBobinaServilleta} className={cn(on && tipoSel.soft)}>
                {onToggle && (
                  <TableCell className="pl-5">
                    <CasillaSeleccion
                      marcada={on}
                      acento={tipoSel}
                      onClick={() => onToggle(s.IdSubBobinaServilleta)}
                    />
                  </TableCell>
                )}
                <TableCell className={cn("font-mono font-bold", tipoSel.text, !onToggle && "pl-5")}>
                  <div className="flex items-center gap-2">
                    #{s.IdSubBobinaServilleta}
                    {s.Reingresada && <BadgeReingresada fecha={s.FechaUltimoReingreso} />}
                  </div>
                </TableCell>
                <TableCell className="pr-5 font-mono text-slate-700">
                  {s.CodigoUnidadOrigen}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ListaMovilSubBobinas({ subBobinas, tipoSel, marcada, onToggle }) {
  return (
    <div className="flex flex-col gap-2.5 p-3.5">
      {subBobinas.map((s) => {
        const on = marcada === s.IdSubBobinaServilleta;
        return (
          <button
            key={s.IdSubBobinaServilleta}
            disabled={!onToggle}
            onClick={() => onToggle(s.IdSubBobinaServilleta)}
            className={cn(
              "flex items-center justify-between gap-2.5 rounded-2xl border-2 p-3.5 text-left",
              on ? cn(tipoSel.soft, tipoSel.border) : "border-slate-200 bg-white",
            )}
          >
            <div>
              <div className="flex items-center gap-2">
                <div className={cn("font-mono text-[15px] font-extrabold", tipoSel.text)}>
                  #{s.IdSubBobinaServilleta}
                </div>
                {s.Reingresada && <BadgeReingresada fecha={s.FechaUltimoReingreso} />}
              </div>
              <div className="font-mono text-[12.5px] text-slate-600">
                {s.CodigoUnidadOrigen}
              </div>
              {s.Reingresada && s.FechaUltimoReingreso && (
                <div className="text-[12.5px] font-semibold text-amber-700">
                  Reingreso: {dateFormatter(s.FechaUltimoReingreso)}
                </div>
              )}
            </div>
            {onToggle && <CasillaSeleccion marcada={on} acento={tipoSel} grande />}
          </button>
        );
      })}
    </div>
  );
}

export default function InventarioBobinaServilleta({ usuario }) {
  const esEncargado = VeComoLider(usuario?.IdRol);
  const soloLectura = EsGerente(usuario?.IdRol);

  const resumenBobinas = useCatalogo(verResumenInventarioBobinaServilleta);
  const resumenSubs = useCatalogo(verResumenInventarioSubBobinaServilleta);
  const fuera = useCatalogo(esEncargado ? verSubBobinasServilletaFueraInventario : sinDatos);
  const detalle = useDetalleInventario(cargarDetalle, mismaSeleccion);
  const traslado = useEjecutar();
  const apertura = useEjecutar();
  const accionesFuera = useEjecutar();

  const [mostrarFuera, setMostrarFuera] = useState(false);
  const [porReingresar, setPorReingresar] = useState(null);

  const [dialogEditar, setDialogEditar] = useState({ open: false, bobina: null });
  const [unidadesOriginales, setUnidadesOriginales] = useState([]);
  const [formUnidades, setFormUnidades] = useState([]);
  const [formMotivo, setFormMotivo] = useState("");
  const [cargandoEditar, setCargandoEditar] = useState(false);
  const [errorEditar, setErrorEditar] = useState("");
  const [guardandoEditar, setGuardandoEditar] = useState(false);

  const tiposBobina = conAcentos(resumenBobinas.datos, {
    cantidadDe: (t) => t.CantidadBobinaServilleta,
  });
  const tiposSub = conAcentos(resumenSubs.datos, {
    cantidadDe: (t) => t.CantidadSubBobinas,
    desplazamiento: 2,
  });

  const { sel } = detalle;
  const tipoSel =
    sel?.clase === "bobina"
      ? tiposBobina.find((t) => t.IdTipoBobinaServilleta === sel.id)
      : sel?.clase === "sub"
        ? tiposSub.find((t) => t.IdTipoMedidaSubBobina === sel.id)
        : null;

  const marcadaSub = detalle.marcadas[0] ?? null;

  const totalBobinas = tiposBobina.reduce(
    (s, t) => s + Number(t.CantidadBobinaServilleta || 0),
    0,
  );
  const totalSub = tiposSub.reduce((s, t) => s + Number(t.CantidadSubBobinas || 0), 0);

  const detalleFiltrado = detalle.datos.filter((d) =>
    sel?.clase === "bobina"
      ? coincide(
          detalle.busqueda,
          d.IdBobinaServilleta,
          ...d.Unidades.map((u) => u.CodigoBobina),
          d.NombreProveedor,
        )
      : coincide(detalle.busqueda, d.IdSubBobinaServilleta, d.CodigoUnidadOrigen),
  );

  const recargarResumen = () => {
    resumenBobinas.recargar();
    resumenSubs.recargar();
  };

  const refrescar = () => {
    recargarResumen();
    fuera.recargar();
    detalle.recargar();
  };

  const toggleSub = (id) => detalle.setMarcadas((prev) => (prev[0] === id ? [] : [id]));

  const enviarTraslado = () => {
    if (marcadaSub == null) return;
    const sub = detalle.datos.find((s) => s.IdSubBobinaServilleta === marcadaSub);
    if (!sub) return;

    traslado.ejecutar(
      "envio",
      () => iniciarProduccionServilleta(sub.IdSubBobinaServilleta),
      `Sub-bobina #${sub.IdSubBobinaServilleta} → En producción`,
      () => {
        detalle.setMarcadas([]);
        refrescar();
      },
    );
  };

  const abrirBobina = (bobina) =>
    apertura.ejecutar(
      bobina.IdBobinaServilleta,
      () => abrirBobinaServilleta(bobina.IdBobinaServilleta),
      (res) =>
        `Bobina #${bobina.IdBobinaServilleta} abierta · ${res.CantidadSubBobinasTotal} sub-bobinas ` +
        `(${res.SubBobinas.map((s) => `${s.Cantidad} de ${s.MedidaMm}`).join(" · ")})`,
      refrescar,
    );

  const quitarDeFuera = (id) =>
    fuera.setDatos((prev) => prev.filter((s) => s.IdSubBobinaServilleta !== id));

  const reingresar = (observacion) => {
    const sub = porReingresar;
    accionesFuera.ejecutar(
      sub.IdSubBobinaServilleta,
      () => reingresarSubBobinaInventario(sub.IdSubBobinaServilleta, observacion),
      `Sub-bobina #${sub.IdSubBobinaServilleta} reingresada al inventario`,
      () => {
        setPorReingresar(null);
        quitarDeFuera(sub.IdSubBobinaServilleta);
        recargarResumen();
      },
    );
  };

  const abrirEditar = async (bobina) => {
    setDialogEditar({ open: true, bobina });
    setUnidadesOriginales([]);
    setFormUnidades([]);
    setFormMotivo("");
    setErrorEditar("");
    setCargandoEditar(true);
    try {
      const { Bobinas } = await verBobinasServilletaReporte({
        CodigoBobina: bobina.Unidades[0]?.CodigoBobina,
        IdEstadoMateriaPrima: ESTADO_ALMACEN_ID,
      });
      const fila = Bobinas.find((b) => b.IdBobinaServilleta === bobina.IdBobinaServilleta);
      if (!fila) throw new Error("No se encontraron los datos de la bobina. Actualiza el inventario.");

      const unidades = fila.Unidades.map((u) => ({
        IdUnidadBobinaServilleta: u.IdUnidadBobinaServilleta,
        CodigoBobina: aTexto(u.CodigoBobina),
        DescripcionFormato: u.DescripcionFormato,
        PesoBrutoKg: aTexto(u.PesoBrutoKg),
        GramajeGr: aTexto(u.GramajeGr),
      }));
      setUnidadesOriginales(unidades);
      setFormUnidades(unidades);
    } catch (e) {
      setErrorEditar(extraerMensajeError(e, e.message));
    } finally {
      setCargandoEditar(false);
    }
  };

  const actualizarUnidad = (indice, campo, valor) => {
    setFormUnidades((prev) =>
      prev.map((u, i) => (i === indice ? { ...u, [campo]: valor } : u)),
    );
  };

  const codigosEditados = formUnidades.map((u) => codigoFinal(u.CodigoBobina));

  const errorUnidad = (u) => {
    const codigo = codigoFinal(u.CodigoBobina);
    const errorDeCodigo = errorCodigo(codigo);
    if (errorDeCodigo) return errorDeCodigo;
    if (codigosEditados.filter((c) => c === codigo).length > 1)
      return "Código repetido";
    return (
      errorMedida(u.PesoBrutoKg, {
        etiqueta: "Peso bruto",
        unidad: "kg",
        minimo: PESO_MINIMO_UNIDAD_SERVILLETA_KG,
        maximo: PESO_MAXIMO_UNIDAD_SERVILLETA_KG,
        obligatorio: false,
      }) ??
      errorMedida(u.GramajeGr, {
        etiqueta: "Gramaje",
        unidad: "g/m²",
        maximo: GRAMAJE_MAXIMO,
        obligatorio: false,
      })
    );
  };

  const erroresUnidades = formUnidades.map(errorUnidad);

  const huboCambios = formUnidades.some((u, i) => {
    const o = unidadesOriginales[i];
    if (!o) return false;
    return (
      codigoFinal(u.CodigoBobina) !== o.CodigoBobina ||
      numeroONulo(u.PesoBrutoKg) !== numeroONulo(o.PesoBrutoKg) ||
      numeroONulo(u.GramajeGr) !== numeroONulo(o.GramajeGr)
    );
  });

  const motivoLimpio = formMotivo.trim();
  const motivoValido =
    motivoLimpio.length >= MOTIVO_CORRECCION_MIN &&
    motivoLimpio.length <= MOTIVO_CORRECCION_MAX;

  const puedeGuardar =
    formUnidades.length > 0 &&
    erroresUnidades.every((e) => !e) &&
    huboCambios &&
    motivoValido;

  const confirmarEditar = async () => {
    const bobina = dialogEditar.bobina;
    if (!bobina || !puedeGuardar) return;

    setGuardandoEditar(true);
    setErrorEditar("");
    try {
      await editarBobinaServilleta(bobina.IdBobinaServilleta, formUnidades, motivoLimpio);
      toast.success(`Bobina #${bobina.IdBobinaServilleta} actualizada`);
      setDialogEditar({ open: false, bobina: null });
      refrescar();
    } catch (e) {
      setErrorEditar(extraerMensajeError(e, e.message));
    } finally {
      setGuardandoEditar(false);
    }
  };

  const esBobina = sel?.clase === "bobina";

  return (
    <TooltipProvider>
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header
        titulo="Almacén · Materia Prima"
        subtitulo="Inventario de Bobinas de Servilleta"
        accion={
          esEncargado
            ? {
                texto: soloLectura ? "Ver ingresos" : "Registrar ingreso",
                icono: soloLectura ? History : Plus,
                href: rutaDeRol(usuario.IdRol, "bobina-servilleta/ingreso"),
              }
            : null
        }
      >
        {esEncargado && (
          <BotonDescarga
            texto="Descargar inventario"
            ayuda="PDF con la cantidad de bobinas de servilleta en almacén (y sus unidades) más todas las sub-bobinas en inventario"
            exito="Informe de inventario descargado"
            descargar={descargarReporteInventarioCompletoServilleta}
          />
        )}
      </Header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        <EncabezadoCatalogo titulo="Catálogo de almacén">
          {etiquetaCantidad(totalBobinas, "bobina", "bobinas")} ·{" "}
          {etiquetaCantidad(totalSub, "sub-bobina", "sub-bobinas")}
        </EncabezadoCatalogo>

        <EstadoCatalogo
          cargando={resumenBobinas.cargando || resumenSubs.cargando}
          error={resumenBobinas.error || resumenSubs.error}
          altoSkeleton="h-44"
        >
          <div className="flex flex-col gap-6">
            <section>
              <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                Bobinas sin abrir
              </div>
              {tiposBobina.length === 0 ? (
                <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-400 ring-1 ring-slate-200">
                  No hay bobinas de servilleta en almacén.
                </div>
              ) : (
                <div className={GRID_TARJETAS}>
                  {tiposBobina.map((t) => (
                    <TarjetaTipo
                      key={t.IdTipoBobinaServilleta}
                      acento={t}
                      activo={sel?.clase === "bobina" && sel.id === t.IdTipoBobinaServilleta}
                      inactivo={!t.Activo}
                      onClick={() =>
                        detalle.seleccionar({ clase: "bobina", id: t.IdTipoBobinaServilleta })
                      }
                      icono={Database}
                      nombre={t.NombreTipoBobinaServilleta}
                      stock={t.stock}
                      cantidad={t.CantidadBobinaServilleta}
                      unidad="bobinas en almacén"
                      textoVer="Ver bobinas"
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                Sub-bobinas por medida
              </div>
              <div className={GRID_TARJETAS}>
                {tiposSub.map((t) => (
                  <TarjetaTipo
                    key={t.IdTipoMedidaSubBobina}
                    acento={t}
                    activo={sel?.clase === "sub" && sel.id === t.IdTipoMedidaSubBobina}
                    inactivo={!t.Activo}
                    onClick={() =>
                      detalle.seleccionar({ clase: "sub", id: t.IdTipoMedidaSubBobina })
                    }
                    icono={Disc}
                    claseIcono="h-7 w-7"
                    nombre={t.NombreTipoMedida}
                    stock={t.stock}
                    cantidad={t.CantidadSubBobinas}
                    unidad="sub-bobinas en almacén"
                    textoVer="Ver sub-bobinas"
                  />
                ))}
                {esEncargado && (
                  <TarjetaFueraInventario
                    cantidad={fuera.datos.length}
                    activo={mostrarFuera}
                    onClick={() => setMostrarFuera((v) => !v)}
                    unidad="sub-bobinas retiradas de producción"
                    textoVer="Ver sub-bobinas"
                  />
                )}
              </div>
            </section>
          </div>
        </EstadoCatalogo>

        {tipoSel && (
          <PanelDetalle
            acento={tipoSel}
            icono={esBobina ? Database : Disc}
            claseIcono={esBobina ? "h-7 w-7" : "h-6 w-6"}
            titulo={
              esBobina
                ? `Bobinas · ${tipoSel.NombreTipoBobinaServilleta}`
                : `Sub-bobinas · ${tipoSel.NombreTipoMedida}`
            }
            subtitulo={
              esBobina
                ? `${tipoSel.CantidadBobinaServilleta} en almacén`
                : `${tipoSel.CantidadSubBobinas} en almacén`
            }
            etiqueta={esBobina || soloLectura ? null : "Se traslada 1 sub-bobina"}
            onCerrar={detalle.cerrar}
          >
            <ContenidoLista
              cargando={detalle.cargando}
              error={detalle.error}
              total={detalle.datos.length}
              cantidadFiltrada={detalleFiltrado.length}
              buscador={
                <BuscadorCodigo
                  valor={detalle.busqueda}
                  onCambio={detalle.setBusqueda}
                  placeholder="Buscar..."
                />
              }
              mensajeVacio={
                esBobina
                  ? "No hay bobinas en almacén para este tipo."
                  : "No hay sub-bobinas en almacén para esta medida."
              }
              mensajeSinCoincidencias={`Nada coincide con "${detalle.busqueda}".`}
            >
              {esBobina ? (
                <>
                  <div className="hidden md:block">
                    <TablaBobinas
                      bobinas={detalleFiltrado}
                      tipoSel={tipoSel}
                      procesandoId={apertura.enProceso}
                      onAbrir={soloLectura ? null : abrirBobina}
                      onEditar={esEncargado && !soloLectura ? abrirEditar : null}
                    />
                  </div>
                  <div className="md:hidden">
                    <ListaMovilBobinas
                      bobinas={detalleFiltrado}
                      tipoSel={tipoSel}
                      procesandoId={apertura.enProceso}
                      onAbrir={soloLectura ? null : abrirBobina}
                      onEditar={esEncargado && !soloLectura ? abrirEditar : null}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="hidden md:block">
                    <TablaSubBobinas
                      subBobinas={detalleFiltrado}
                      tipoSel={tipoSel}
                      marcada={marcadaSub}
                      onToggle={soloLectura ? undefined : toggleSub}
                    />
                  </div>
                  <div className="md:hidden">
                    <ListaMovilSubBobinas
                      subBobinas={detalleFiltrado}
                      tipoSel={tipoSel}
                      marcada={marcadaSub}
                      onToggle={soloLectura ? undefined : toggleSub}
                    />
                  </div>
                </>
              )}
            </ContenidoLista>

            {!esBobina && marcadaSub != null && (
              <BarraSeleccion
                chips={[
                  {
                    clave: marcadaSub,
                    texto: `#${marcadaSub}`,
                    onQuitar: () => detalle.setMarcadas([]),
                  },
                ]}
                estado="Se traslada 1 sub-bobina"
                enviando={traslado.enProceso === "envio"}
                onEnviar={enviarTraslado}
                textoAccion="Trasladar a producción"
                textoEnviando="Trasladando..."
              />
            )}
          </PanelDetalle>
        )}

        {esEncargado && mostrarFuera && (
          <PanelFuera
            titulo="Sub-bobinas fuera de inventario"
            onCerrar={() => setMostrarFuera(false)}
          >
            <ContenidoLista
              cargando={fuera.cargando}
              error={fuera.error}
              total={fuera.datos.length}
              mensajeVacio="No hay sub-bobinas fuera de inventario."
              filasSkeleton={2}
              altoSkeleton="h-16"
            >
              <div className="flex flex-col gap-3 p-5">
                {fuera.datos.map((s) => (
                  <ItemFueraInventario
                    key={s.IdSubBobinaServilleta}
                    codigo={`#${s.IdSubBobinaServilleta}`}
                    etiqueta={s.NombreTipoMedida}
                    extra={
                      <span className="font-mono text-[12.5px] text-slate-500">
                        {s.CodigoUnidadOrigen}
                      </span>
                    }
                    observacion={s.UltimaObservacion}
                    fechaMovimiento={s.FechaUltimoMovimiento}
                    procesando={accionesFuera.enProceso === s.IdSubBobinaServilleta}
                    onReingresar={soloLectura ? undefined : () => setPorReingresar(s)}
                  />
                ))}
              </div>
            </ContenidoLista>
          </PanelFuera>
        )}
      </main>

      {esEncargado && (
        <DialogReingreso
          abierto={porReingresar !== null}
          titulo={porReingresar ? `sub-bobina #${porReingresar.IdSubBobinaServilleta}` : ""}
          procesando={
            porReingresar !== null &&
            accionesFuera.enProceso === porReingresar.IdSubBobinaServilleta
          }
          onCancelar={() => setPorReingresar(null)}
          onConfirmar={reingresar}
        />
      )}

      <Dialog
        open={dialogEditar.open}
        onOpenChange={(open) =>
          setDialogEditar({ open, bobina: open ? dialogEditar.bobina : null })
        }
      >
        <DialogContent className="sm:max-w-xl md:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Editar bobina servilleta
              {dialogEditar.bobina && ` #${dialogEditar.bobina.IdBobinaServilleta}`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {dialogEditar.bobina && (
              <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12.5px] text-slate-500">
                {dialogEditar.bobina.NombreProveedor} · recibida{" "}
                {dateFormatter(dialogEditar.bobina.FechaRecepcion)}
              </div>
            )}

            {cargandoEditar && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Skeleton className="h-56 rounded-xl" />
                <Skeleton className="h-56 rounded-xl" />
              </div>
            )}

            {!cargandoEditar && formUnidades.length > 0 && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {formUnidades.map((u, i) => (
                    <div
                      key={u.IdUnidadBobinaServilleta}
                      className={cn(
                        "flex flex-col gap-3 rounded-xl border-2 p-3.5",
                        erroresUnidades[i] ? "border-red-200" : "border-slate-200",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-extrabold text-slate-900">
                          Unidad {i + 1}
                        </div>
                        <Badge
                          variant="outline"
                          className="border-slate-300 font-bold text-slate-500"
                        >
                          {u.DescripcionFormato}
                        </Badge>
                      </div>

                      <InputForModal
                        id={`codigo-unidad-${i}`}
                        etiqueta="Código"
                        valor={u.CodigoBobina}
                        codigo
                        onCambio={(valor) => actualizarUnidad(i, "CodigoBobina", valor)}
                        classNameInput="font-mono font-bold"
                        autoComplete="off"
                      />
                      <InputForModal
                        id={`peso-unidad-${i}`}
                        etiqueta="Peso bruto (kg)"
                        opcional
                        medida={DECIMALES_PESO}
                        valor={u.PesoBrutoKg}
                        onCambio={(valor) => actualizarUnidad(i, "PesoBrutoKg", valor)}
                      />
                      <InputForModal
                        id={`gramaje-unidad-${i}`}
                        etiqueta="Gramaje (g/m²)"
                        opcional
                        medida={DECIMALES_PESO}
                        valor={u.GramajeGr}
                        onCambio={(valor) => actualizarUnidad(i, "GramajeGr", valor)}
                      />

                      {erroresUnidades[i] && (
                        <p className="text-xs font-semibold text-red-600">{erroresUnidades[i]}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="motivo-editar-bobina-servilleta"
                    className="text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    Motivo de la corrección
                  </Label>
                  <Textarea
                    id="motivo-editar-bobina-servilleta"
                    value={formMotivo}
                    onChange={(e) => setFormMotivo(limpiarObservacion(e.target.value))}
                    placeholder="Ej. Error de digitación al registrar el ingreso..."
                    className="min-h-20"
                    maxLength={MOTIVO_CORRECCION_MAX}
                  />
                  <span className="text-xs text-slate-500">
                    {motivoLimpio.length}/{MOTIVO_CORRECCION_MAX} · mínimo{" "}
                    {MOTIVO_CORRECCION_MIN} caracteres
                    {!huboCambios && " · aún no hay cambios"}
                  </span>
                </div>
              </>
            )}

            {errorEditar && (
              <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600">
                {errorEditar}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={confirmarEditar}
              disabled={guardandoEditar || cargandoEditar || !puedeGuardar}
              className="h-11 w-full gap-2 bg-gradient-to-r from-c3 to-c4 font-extrabold text-white hover:opacity-90 sm:w-auto"
            >
              {guardandoEditar ? (
                <Loader2 size={16} className="animate-spin" />
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
    </div>
    </TooltipProvider>
  );
}
