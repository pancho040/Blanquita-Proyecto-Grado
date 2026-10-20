import { useEffect, useState } from "react";
import { Plus, Cylinder } from "lucide-react";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { obtenerProductos } from "../../../services/Inventario/Inventario";
import { useOpciones } from "@/hooks/useOpciones";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import {
  verResumenInventarioBobinaPapel,
  verDetalleInventarioBobinaPapel,
  verBobinasPapelFueraInventario,
  reingresarBobinaInventario,
} from "../../../services/BobinaPapel/Inventario";
import { iniciarProduccion } from "../../../services/BobinaPapel/Produccion";
import { descargarReporteInventarioBobinaPapel } from "../../../services/BobinaPapel/Reportes";
import { dateFormatter } from "@/utils/dates";
import { useCatalogo } from "@/hooks/useCatalogo";
import { useDetalleInventario } from "@/hooks/useDetalleInventario";
import { useEjecutar } from "@/hooks/useEjecutar";
import { BotonDescarga } from "@/components/layout/BotonDescarga";
import {
  GRID_TARJETAS,
  conAcentos,
  coincide,
  TarjetaTipo,
  DatoTarjeta,
  TarjetaFueraInventario,
  EncabezadoCatalogo,
  EstadoCatalogo,
  PanelDetalle,
  PanelFuera,
  BuscadorCodigo,
  ContenidoLista,
  BarraSeleccion,
  ItemFueraInventario,
  DialogReingreso,
} from "@/components/Inventario/comunes";
import { fmt } from "./constantes";
import { TablaBobinas } from "./TablaBobinas";
import { ListaMovilBobinas } from "./ListaMovilBobinas";
import ModalEditarBobina from "./ModalEditarBobina";
import DialogoIniciarProduccion from "./DialogoIniciarProduccion";
import Header from "@/components/layout/Header";
import { Roles } from "@/constants/Values";
import { productosActivosDelTipo } from "@/utils/catalogo";

const sinDatos = async () => [];

export default function InventarioBobinasPapel({ usuario }) {
  const esLider = usuario?.IdRol === Roles.Encargado;

  const resumen = useCatalogo(verResumenInventarioBobinaPapel);
  const fuera = useCatalogo(esLider ? verBobinasPapelFueraInventario : sinDatos);
  const detalle = useDetalleInventario(verDetalleInventarioBobinaPapel);
  const envio = useEjecutar();
  const accionesFuera = useEjecutar();

  const [mostrarFuera, setMostrarFuera] = useState(false);
  const [busquedaFuera, setBusquedaFuera] = useState("");
  const [porReingresar, setPorReingresar] = useState(null);

  const [bobinaEditar, setBobinaEditar] = useState(null);
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);

  const tipos = conAcentos(resumen.datos, { cantidadDe: (t) => t.CantidadBobinas });
  const tipoSel = detalle.sel ? tipos.find((t) => t.IdTipoBobina === detalle.sel) : null;
  const esServilleta = tipoSel
    ? tipoSel.NombreTipoBobina.toLowerCase().includes("servilleta")
    : false;
  const requeridas = esServilleta ? 1 : 2;
  const { marcadas, setMarcadas } = detalle;
  const listas = marcadas.length === requeridas;

  const productos = useOpciones(obtenerProductos);
  const [idProducto, setIdProducto] = useState(null);
  const productosTipo = tipoSel ? productosActivosDelTipo(productos, tipoSel.IdTipoBobina) : [];
  const eligeProducto = productosTipo.length > 1;
  const productoAsignado = eligeProducto
    ? productosTipo.find((p) => p.IdProducto === idProducto)
    : productosTipo[0];
  const faltaProducto = !productoAsignado;
  const [confirmarInicio, setConfirmarInicio] = useState(false);
  const nombreProductoSel = productoAsignado?.NombreProducto;

  useEffect(() => {
    setIdProducto(null);
  }, [detalle.sel]);

  const totalBobinas = tipos.reduce((s, t) => s + t.CantidadBobinas, 0);
  const totalPesoFmt = fmt(tipos.reduce((s, t) => s + Number(t.PesoNetoTotalKg || 0), 0));

  const bobinasFiltradas = detalle.datos.filter((b) =>
    coincide(detalle.busqueda, b.CodigoBobina),
  );
  const fueraFiltradas = fuera.datos.filter((b) => coincide(busquedaFuera, b.CodigoBobina));

  const abrirEditar = (bobina) => {
    setBobinaEditar(bobina);
    setModalEditarAbierto(true);
  };

  const alGuardarEdicion = (actualizada) => {
    toast.success(`Bobina ${actualizada.CodigoBobina} corregida`);
    setMarcadas([]);
    detalle.recargar();
    resumen.recargar();
  };

  const toggleBobina = (codigo) => {
    setMarcadas((prev) => {
      if (prev.includes(codigo)) return prev.filter((c) => c !== codigo);
      if (prev.length < requeridas) return [...prev, codigo];
      if (requeridas === 1) return [codigo];
      return prev;
    });
  };

  const quitarChip = (codigo) => setMarcadas((prev) => prev.filter((c) => c !== codigo));

  const abrirConfirmarInicio = () => {
    if (!listas || esServilleta || faltaProducto) return;
    setConfirmarInicio(true);
  };

  const enviarProduccion = () => {
    if (!listas || esServilleta || faltaProducto) return;

    const bobina1 = detalle.datos.find((b) => b.CodigoBobina === marcadas[0]);
    const bobina2 = detalle.datos.find((b) => b.CodigoBobina === marcadas[1]);
    if (!bobina1 || !bobina2) return;

    envio.ejecutar(
      "envio",
      () =>
        iniciarProduccion(
          bobina1.IdBobinaPapel,
          bobina2.IdBobinaPapel,
          productoAsignado.IdProducto,
        ),
      (res) => `${marcadas.join(" + ")} → En producción · ${res.NombreProducto}`,
      () => {
        setConfirmarInicio(false);
        detalle.setDatos((prev) => prev.filter((b) => !marcadas.includes(b.CodigoBobina)));
        setMarcadas([]);
        setIdProducto(null);
        resumen.recargar();
      },
    );
  };

  const alternarFuera = () => {
    const mostrar = !mostrarFuera;
    setMostrarFuera(mostrar);
    setBusquedaFuera("");
    if (mostrar) fuera.recargar();
  };

  const quitarDeFuera = (idBobinaPapel) =>
    fuera.setDatos((prev) => prev.filter((b) => b.IdBobinaPapel !== idBobinaPapel));

  const reingresar = (observacion) => {
    const b = porReingresar;
    accionesFuera.ejecutar(
      b.IdBobinaPapel,
      () => reingresarBobinaInventario(b.IdBobinaPapel, observacion),
      `Bobina ${b.CodigoBobina} reingresada al inventario`,
      () => {
        setPorReingresar(null);
        quitarDeFuera(b.IdBobinaPapel);
        resumen.recargar();
      },
    );
  };

  return (
    <TooltipProvider>
    <div className="contenido-con-sidebar mt-20 md:mt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header
        titulo="Almacén · Materia Prima"
        subtitulo="Inventario de Bobinas de Papel"
        accion={
          esLider
            ? {
                texto: "Registrar ingreso",
                icono: Plus,
                href: "/encargado/bobina-papel/ingreso",
              }
            : null
        }
      >
        {esLider && (
          <BotonDescarga
            texto="Descargar inventario"
            ayuda="PDF con el inventario completo de todos los tipos de bobina"
            exito="Informe de inventario descargado"
            descargar={() => descargarReporteInventarioBobinaPapel(null)}
          />
        )}
      </Header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        <EncabezadoCatalogo titulo="Catálogo por tipo de bobina">
          Solo bobinas <strong className="text-slate-700">en almacén</strong>{" "}
          · {totalBobinas} bobinas · {totalPesoFmt} kg netos
        </EncabezadoCatalogo>

        <EstadoCatalogo cargando={resumen.cargando} error={resumen.error} altoSkeleton="h-52">
          <div className={GRID_TARJETAS}>
            {tipos.map((t) => (
              <TarjetaTipo
                key={t.IdTipoBobina}
                acento={t}
                activo={detalle.sel === t.IdTipoBobina}
                onClick={() => detalle.seleccionar(t.IdTipoBobina)}
                icono={Cylinder}
                nombre={t.NombreTipoBobina}
                stock={t.stock}
                cantidad={t.CantidadBobinas}
                unidad="bobinas en almacén"
                textoVer="Ver bobinas"
              >
                <div className="grid grid-cols-2 gap-2">
                  <DatoTarjeta etiqueta="Peso neto" tabular>
                    {fmt(t.PesoNetoTotalKg)} kg
                  </DatoTarjeta>
                  <DatoTarjeta etiqueta="Gramaje prom." tabular>
                    {fmt(t.GramajePromedio)} g/m²
                  </DatoTarjeta>
                </div>
              </TarjetaTipo>
            ))}
            {esLider && (
              <TarjetaFueraInventario
                cantidad={fuera.datos.length}
                activo={mostrarFuera}
                onClick={alternarFuera}
                unidad="bobinas retiradas de producción"
                textoVer="Ver bobinas"
              />
            )}
          </div>
        </EstadoCatalogo>

        {tipoSel && (
          <PanelDetalle
            acento={tipoSel}
            icono={Cylinder}
            titulo={`Bobinas · ${tipoSel.NombreTipoBobina}`}
            subtitulo={`${tipoSel.CantidadBobinas} en almacén`}
            etiqueta={esServilleta ? "Se envía 1 bobina" : "Se envían de a 2 bobinas"}
            onCerrar={detalle.cerrar}
          >
            <ContenidoLista
              cargando={detalle.cargando}
              error={detalle.error}
              total={detalle.datos.length}
              cantidadFiltrada={bobinasFiltradas.length}
              buscador={<BuscadorCodigo valor={detalle.busqueda} onCambio={detalle.setBusqueda} />}
              mensajeVacio="No hay bobinas en almacén para este tipo."
              mensajeSinCoincidencias={`Ninguna bobina coincide con "${detalle.busqueda}".`}
            >
              <div className="hidden md:block">
                <TablaBobinas
                  bobinas={bobinasFiltradas}
                  tipoSel={tipoSel}
                  marcadas={marcadas}
                  onToggle={toggleBobina}
                  onEditar={esLider ? abrirEditar : undefined}
                />
              </div>
              <div className="md:hidden">
                <ListaMovilBobinas
                  bobinas={bobinasFiltradas}
                  tipoSel={tipoSel}
                  marcadas={marcadas}
                  onToggle={toggleBobina}
                  onEditar={esLider ? abrirEditar : undefined}
                />
              </div>
            </ContenidoLista>

            {marcadas.length > 0 && eligeProducto && (
              <div className="flex flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  Producto a elaborar
                </span>
                <ToggleGroup
                  value={idProducto === null ? [] : [String(idProducto)]}
                  className="flex flex-wrap justify-start gap-2"
                >
                  {productosTipo.map((p) => (
                    <ToggleGroupItem
                      key={p.IdProducto}
                      value={String(p.IdProducto)}
                      onClick={() => setIdProducto(p.IdProducto)}
                      className={PILDORA_FILTRO}
                    >
                      {p.NombreProducto}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            )}

            {marcadas.length > 0 && (
              <BarraSeleccion
                chips={marcadas.map((codigo) => ({
                  clave: codigo,
                  texto: codigo,
                  onQuitar: () => quitarChip(codigo),
                }))}
                estado={
                  !listas
                    ? `Selecciona ${requeridas - marcadas.length} más`
                    : faltaProducto
                      ? eligeProducto
                        ? "Selecciona el producto"
                        : "Este tipo no tiene productos activos"
                      : "Listo para enviar"
                }
                listo={listas && !faltaProducto}
                enviando={envio.enProceso === "envio"}
                onEnviar={abrirConfirmarInicio}
                textoAccion="Enviar a producción"
                textoEnviando="Enviando..."
              />
            )}
          </PanelDetalle>
        )}

        {esLider && mostrarFuera && (
          <PanelFuera titulo="Bobinas fuera de inventario" onCerrar={() => setMostrarFuera(false)}>
            <ContenidoLista
              cargando={fuera.cargando}
              error={fuera.error}
              total={fuera.datos.length}
              cantidadFiltrada={fueraFiltradas.length}
              buscador={<BuscadorCodigo valor={busquedaFuera} onCambio={setBusquedaFuera} />}
              mensajeVacio="No hay bobinas fuera de inventario."
              mensajeSinCoincidencias={`Ninguna bobina coincide con "${busquedaFuera}".`}
              filasSkeleton={2}
              altoSkeleton="h-16"
            >
              <div className="flex flex-col gap-3 p-5">
                {fueraFiltradas.map((b) => (
                  <ItemFueraInventario
                    key={b.IdBobinaPapel}
                    codigo={b.CodigoBobina}
                    etiqueta={b.NombreTipoBobina}
                    detalle={
                      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-slate-600">
                        <span>{b.NombreProveedor}</span>
                        <span>Recepción: {dateFormatter(b.FechaRecepcion)}</span>
                        <span>Bruto: {fmt(b.PesoBrutoKg)} kg</span>
                        <span>Gramaje: {fmt(b.Gramaje)} g/m²</span>
                      </div>
                    }
                    observacion={b.UltimaObservacion}
                    fechaMovimiento={b.FechaUltimoMovimiento}
                    procesando={accionesFuera.enProceso === b.IdBobinaPapel}
                    onReingresar={() => setPorReingresar(b)}
                  />
                ))}
              </div>
            </ContenidoLista>
          </PanelFuera>
        )}
      </main>

      <DialogoIniciarProduccion
        abierto={confirmarInicio}
        codigos={marcadas}
        nombreTipo={tipoSel?.NombreTipoBobina}
        nombreProducto={nombreProductoSel}
        enviando={envio.enProceso === "envio"}
        onCerrar={() => setConfirmarInicio(false)}
        onConfirmar={enviarProduccion}
      />

      {esLider && (
        <DialogReingreso
          abierto={porReingresar !== null}
          titulo={porReingresar ? `bobina ${porReingresar.CodigoBobina}` : ""}
          procesando={
            porReingresar !== null && accionesFuera.enProceso === porReingresar.IdBobinaPapel
          }
          onCancelar={() => setPorReingresar(null)}
          onConfirmar={reingresar}
        />
      )}

      {esLider && (
        <ModalEditarBobina
          abierto={modalEditarAbierto}
          onOpenChange={setModalEditarAbierto}
          bobina={bobinaEditar}
          nombreTipo={tipoSel?.NombreTipoBobina}
          onGuardado={alGuardarEdicion}
        />
      )}
    </div>
    </TooltipProvider>
  );
}
