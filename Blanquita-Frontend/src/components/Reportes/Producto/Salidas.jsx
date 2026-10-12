import { startOfMonth, startOfWeek } from "date-fns";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TooltipProvider } from "@/components/ui/tooltip";
import DoubleDatePicker from "@/components/layout/dates/DoubleDatePicker";
import Header from "@/components/layout/Header";
import { PaginaReporte } from "@/components/Reportes/PaginaReporte";
import {
  TarjetaFiltros,
  CampoFiltro,
  FiltroTipos,
  DERECHA,
  contar,
} from "@/components/Reportes/comunes";
import {
  TarjetaSeccion,
  EsqueletoCarga,
  ErrorCarga,
  TablaFilas,
  TarjetaFila,
} from "@/components/Reportes/Producto/comunes";
import { LINEA_PRODUCTO } from "@/components/Reportes/Producto/filtros";
import { useReporte } from "@/hooks/useReporte";
import { useDescarga } from "@/hooks/useDescarga";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { aFechaISO, dateFormatter } from "@/utils/dates";
import { formatearNumero } from "@/utils/numeros";
import {
  verResumenSalidas,
  descargarReporteSalidas,
  descargarExcelSalidas,
  descargarReporteDespacho,
  descargarExcelDespacho,
} from "@/services/Inventario/Reportes";

const ATAJOS = [
  { valor: "hoy", texto: "Hoy", rango: (hoy) => ({ from: hoy, to: hoy }) },
  {
    valor: "semana",
    texto: "Esta semana",
    rango: (hoy) => ({ from: startOfWeek(hoy, { weekStartsOn: 1 }), to: hoy }),
  },
  { valor: "mes", texto: "Este mes", rango: (hoy) => ({ from: startOfMonth(hoy), to: hoy }) },
];

const mismoRango = (rango, otro) =>
  aFechaISO(rango?.from) === aFechaISO(otro.from) && aFechaISO(rango?.to) === aFechaISO(otro.to);

const consultarResumen = (parametros) =>
  parametros.FechaInicio && parametros.FechaFin
    ? verResumenSalidas(parametros)
    : Promise.resolve(null);

const entero = (valor) => formatearNumero(valor, { decimales: 0 });

const textoUsuario = (m) => `${m.PrimerNombre} ${m.ApellidoPaterno}`;

const COLUMNAS_LINEAS = [
  { titulo: "Línea", clase: "font-bold text-slate-900", valor: (l) => l.NombreProducto },
  { titulo: "Unidad", valor: (l) => l.Unidad },
  { titulo: "Cantidad salida", ...DERECHA, valor: (l) => entero(l.CantidadSalida) },
  { titulo: "Salidas", ...DERECHA, valor: (l) => l.NumeroSalidas },
];

const COLUMNAS_PRESENTACIONES = [
  { titulo: "Código", clase: "font-mono font-bold text-c3", valor: (p) => p.CodigoPresentacion },
  { titulo: "Producto", clase: "font-bold text-slate-900", valor: (p) => p.NombrePresentacion },
  { titulo: "Cantidad salida", ...DERECHA, valor: (p) => entero(p.CantidadSalida) },
  { titulo: "Salidas", ...DERECHA, valor: (p) => p.NumeroSalidas },
  { titulo: "Stock actual", ...DERECHA, valor: (p) => entero(p.CantidadActual) },
];

const COLUMNAS_ITEMS = [
  { titulo: "Código", clase: "font-mono font-bold text-c3", valor: (m) => m.CodigoPresentacion },
  { titulo: "Producto", clase: "font-bold text-slate-900", valor: (m) => m.NombrePresentacion },
  { titulo: "Unidad", valor: (m) => m.Unidad },
  {
    titulo: "Cantidad",
    ...DERECHA,
    valor: (m) => <span className="font-bold text-emerald-700">{entero(m.Cantidad)}</span>,
  },
];

function tarjetaLinea(l) {
  return (
    <TarjetaFila nombre={l.NombreProducto} detalle={contar(l.NumeroSalidas, "salida", "salidas")}>
      <strong className="text-emerald-700">{entero(l.CantidadSalida)}</strong>{" "}
      <span className="text-slate-500">{l.Unidad}</span>
    </TarjetaFila>
  );
}

function tarjetaPresentacion(p) {
  return (
    <TarjetaFila
      nombre={`${p.CodigoPresentacion} · ${p.NombrePresentacion}`}
      detalle={`${contar(p.NumeroSalidas, "salida", "salidas")} · stock actual ${entero(p.CantidadActual)}`}
    >
      <strong className="text-emerald-700">{entero(p.CantidadSalida)}</strong>
    </TarjetaFila>
  );
}

function tarjetaItem(m) {
  return (
    <TarjetaFila nombre={`${m.CodigoPresentacion} · ${m.NombrePresentacion}`} detalle={m.Unidad}>
      <strong className="text-emerald-700">{entero(m.Cantidad)}</strong>
    </TarjetaFila>
  );
}

function BotonArchivo({ texto, icono: Icono, disponible, descargar, exito }) {
  const { descargando, iniciar } = useDescarga(descargar, exito);

  return (
    <Button
      onClick={iniciar}
      disabled={!disponible || descargando}
      className="h-9 gap-1.5 bg-gradient-to-r from-c3 to-c4 font-bold text-white hover:opacity-90"
    >
      {descargando ? (
        <Loader2 size={15} className="animate-spin" />
      ) : (
        <Icono size={15} strokeWidth={2.5} />
      )}
      {texto}
    </Button>
  );
}

function TarjetaDespacho({ despacho }) {
  return (
    <TarjetaSeccion
      titulo={`Salida N° ${despacho.IdDespacho}`}
      extra={
        <div className="flex flex-wrap items-center gap-2">
          <BotonArchivo
            texto="PDF"
            icono={FileText}
            disponible
            exito={`Salida N° ${despacho.IdDespacho} descargada`}
            descargar={() => descargarReporteDespacho(despacho.IdDespacho)}
          />
          <BotonArchivo
            texto="Excel"
            icono={FileSpreadsheet}
            disponible
            exito={`Excel de la salida N° ${despacho.IdDespacho} descargado`}
            descargar={() => descargarExcelDespacho(despacho.IdDespacho)}
          />
        </div>
      }
    >
      <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-slate-100 px-5 py-3 text-[12.5px] text-slate-600">
        <span>
          <strong className="text-slate-500">Fecha:</strong> {dateFormatter(despacho.FechaMovimiento)}
        </span>
        <span>
          <strong className="text-slate-500">Registrado por:</strong> {textoUsuario(despacho)} · CI{" "}
          {despacho.Ci} · {despacho.NombreRol}
        </span>
        <span>
          <strong className="text-slate-500">Observación:</strong> {despacho.Observacion ?? "-"}
        </span>
        <span>
          <strong className="text-slate-500">Total:</strong>{" "}
          <strong className="text-emerald-700">{entero(despacho.CantidadTotal)}</strong> en{" "}
          {contar(despacho.NumeroPresentaciones, "presentación", "presentaciones")}
        </span>
      </div>
      <TablaFilas
        columnas={COLUMNAS_ITEMS}
        filas={despacho.Items}
        clave={(m) => m.IdMovimientoProductoTerminado}
        tarjeta={tarjetaItem}
      />
    </TarjetaSeccion>
  );
}

function ResultadosSalidas({ reporte }) {
  const { catalogo: resumen, cargando, error, recargar } = reporte;

  if (cargando || error) {
    return (
      <TarjetaSeccion titulo="Resumen por línea" className="mt-6">
        {cargando ? <EsqueletoCarga /> : <ErrorCarga error={error} recargar={recargar} />}
      </TarjetaSeccion>
    );
  }

  if (!resumen) {
    return (
      <TarjetaSeccion titulo="Resumen por línea" className="mt-6">
        <div className="p-10 text-center text-sm text-slate-400">
          Elegí una fecha de inicio y una de fin para ver las salidas.
        </div>
      </TarjetaSeccion>
    );
  }

  if (resumen.Movimientos.length === 0) {
    return (
      <TarjetaSeccion titulo="Resumen por línea" className="mt-6">
        <div className="p-10 text-center text-sm text-slate-400">
          No se registraron salidas en el período y las líneas elegidas.
        </div>
      </TarjetaSeccion>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <TarjetaSeccion titulo="Resumen por línea">
        <TablaFilas
          columnas={COLUMNAS_LINEAS}
          filas={resumen.Lineas}
          clave={(l) => l.IdProducto}
          tarjeta={tarjetaLinea}
        />
      </TarjetaSeccion>

      <TarjetaSeccion titulo="Resumen por presentación">
        <TablaFilas
          columnas={COLUMNAS_PRESENTACIONES}
          filas={resumen.Presentaciones}
          clave={(p) => p.IdPresentacion}
          tarjeta={tarjetaPresentacion}
        />
      </TarjetaSeccion>

      <div className="flex items-center justify-between gap-3 px-1 pt-2">
        <h2 className="text-base font-extrabold text-slate-900">Salidas registradas</h2>
        <span className="text-[12.5px] font-semibold text-slate-500">
          {contar(resumen.Despachos.length, "salida", "salidas")}
        </span>
      </div>

      {resumen.Despachos.map((despacho) => (
        <TarjetaDespacho key={despacho.IdDespacho} despacho={despacho} />
      ))}
    </div>
  );
}

function PaginaProducto({ subtitulo, contador, children }) {
  return (
    <TooltipProvider>
      <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
        <Header
          volver="/encargado/producto/movimientos"
          titulo="Producto terminado"
          subtitulo={subtitulo}
          contador={contador}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">{children}</main>
      </div>
    </TooltipProvider>
  );
}

export default function SalidasReporteProducto({ usuario, origen = "reportes" }) {
  const reporte = useReporte(consultarResumen, {
    Rango: ATAJOS[0].rango(new Date()),
    [LINEA_PRODUCTO.campo]: [],
  });
  const { filtros, catalogo: resumen } = reporte;
  const { Rango } = filtros;
  const lineas = filtros[LINEA_PRODUCTO.campo];

  const rangoCompleto = Boolean(Rango?.from && Rango?.to);
  const haySalidas = rangoCompleto && Boolean(resumen?.Movimientos.length);
  const hoy = new Date();
  const atajoActivo = ATAJOS.find((atajo) => mismoRango(Rango, atajo.rango(hoy)))?.valor;

  const parametros = () => ({
    FechaInicio: aFechaISO(Rango.from),
    FechaFin: aFechaISO(Rango.to),
    IdsProducto: lineas.length ? lineas : null,
  });

  const contador = resumen
    ? { valor: resumen.NumeroSalidas, singular: "salida", plural: "salidas" }
    : null;

  const Contenedor = origen === "producto" ? PaginaProducto : PaginaReporte;

  return (
    <Contenedor
      usuario={usuario}
      titulo="Reportes · Productos"
      subtitulo="Salidas de inventario"
      contador={contador}
    >
      <TarjetaFiltros
        reporte={{ ...reporte, hayFiltros: atajoActivo !== "hoy" || lineas.length > 0 }}
        informe={
          <div className="flex flex-wrap items-center gap-2">
            <BotonArchivo
              texto="PDF"
              icono={FileText}
              disponible={haySalidas}
              exito="Reporte de salidas descargado"
              descargar={() => descargarReporteSalidas(parametros())}
            />
            <BotonArchivo
              texto="Excel"
              icono={FileSpreadsheet}
              disponible={haySalidas}
              exito="Excel de salidas descargado"
              descargar={() => descargarExcelSalidas(parametros())}
            />
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DoubleDatePicker
            id="rango-salidas-producto"
            label="Fecha de salida"
            value={Rango}
            onChange={(valor) => reporte.cambiar("Rango", valor)}
          />
          <CampoFiltro etiqueta="Atajos">
            <ToggleGroup
              value={atajoActivo ? [atajoActivo] : []}
              className="flex flex-wrap justify-start gap-2"
            >
              {ATAJOS.map((atajo) => (
                <ToggleGroupItem
                  key={atajo.valor}
                  value={atajo.valor}
                  onClick={() => reporte.cambiar("Rango", atajo.rango(new Date()))}
                  className={PILDORA_FILTRO}
                >
                  {atajo.texto}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CampoFiltro>
        </div>

        <FiltroTipos reporte={reporte} tipo={LINEA_PRODUCTO} />
      </TarjetaFiltros>

      <ResultadosSalidas reporte={reporte} />
    </Contenedor>
  );
}
