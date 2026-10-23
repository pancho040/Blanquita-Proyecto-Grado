import { Fragment } from "react";
import {
  Search,
  Eye,
  FileDown,
  Loader2,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import InputCodigo from "@/components/layout/InputCodigo";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SelectEntidad } from "@/components/layout/Selectentidad";
import { ObtenerProveedoresForm } from "@/services/Proveedor/Proveedor";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { useOpciones } from "@/hooks/useOpciones";
import { useDescarga } from "@/hooks/useDescarga";

export const ESTADOS_MATERIA_PRIMA = {
  "En almacén": "border-emerald-300 bg-emerald-50 text-emerald-700",
  "En producción": "border-sky-300 bg-sky-50 text-sky-700",
  Agotado: "border-slate-300 bg-slate-100 text-slate-600",
  "Dado de baja": "border-red-300 bg-red-50 text-red-600",
  "Fuera de Inventario": "border-amber-300 bg-amber-50 text-amber-700",
  Abierta: "border-sky-300 bg-sky-50 text-sky-700",
  Terminada: "border-slate-300 bg-slate-100 text-slate-600",
};

export const ESTADOS_PRODUCCION = {
  "En Producción": "border-sky-300 bg-sky-50 text-sky-700",
  Pausa: "border-amber-300 bg-amber-50 text-amber-700",
  Finalizado: "border-emerald-300 bg-emerald-50 text-emerald-700",
  Cancelada: "border-red-300 bg-red-50 text-red-600",
  "Cambio de línea": "border-violet-300 bg-violet-50 text-violet-700",
};

const AYUDA_SIN_RANGO =
  "Elegí una fecha de inicio y una de fin para poder descargar el informe";

export const DERECHA = { claseTitulo: "text-right", clase: "text-right tabular-nums" };

export const contar = (cantidad, singular, plural) =>
  `${cantidad} ${cantidad === 1 ? singular : plural}`;

export function BadgeEstado({ estado, estilos = ESTADOS_MATERIA_PRIMA, className }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        className,
        "font-bold",
        estilos[estado] ?? "border-slate-300 bg-slate-100 text-slate-600",
      )}
    >
      {estado}
    </Badge>
  );
}

export const columnaCodigo = (campo) => ({
  titulo: "Código",
  clase: "font-mono font-bold text-slate-900",
  valor: (elemento) => elemento[campo],
});

export const COLUMNA_ESTADO = {
  titulo: "Estado",
  valor: (elemento) => <BadgeEstado estado={elemento.TipoEstado} />,
};

export const COLUMNA_PROVEEDOR = {
  titulo: "Proveedor",
  valor: (elemento) => elemento.NombreProveedor,
};

export function CampoFiltro({ etiqueta, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-bold uppercase tracking-wide text-slate-600">
        {etiqueta}
      </Label>
      {children}
    </div>
  );
}

export function BuscadorFiltro({ reporte, campo, etiqueta, placeholder, mono = true, codigo = false }) {
  return (
    <CampoFiltro etiqueta={etiqueta}>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
        />
        {codigo ? (
          <InputCodigo
            valor={reporte.textos[campo]}
            onCambio={(texto) => reporte.escribir(campo, texto)}
            placeholder={placeholder}
            className="h-11 pl-9"
          />
        ) : (
          <Input
            value={reporte.textos[campo]}
            onChange={(e) => reporte.escribir(campo, e.target.value)}
            placeholder={placeholder}
            className={cn("h-11 pl-9", mono && "font-mono")}
          />
        )}
      </div>
    </CampoFiltro>
  );
}

export function SelectFiltro({ reporte, campo, etiqueta, opciones, campoEtiqueta, placeholder }) {
  return (
    <CampoFiltro etiqueta={etiqueta}>
      <SelectEntidad
        opciones={opciones}
        valor={reporte.filtros[campo]}
        onCambio={(valor) => reporte.cambiar(campo, valor)}
        campoValor={campo}
        campoEtiqueta={campoEtiqueta}
        placeholder={placeholder}
      />
    </CampoFiltro>
  );
}

export function FiltroProveedor({ reporte }) {
  const proveedores = useOpciones(ObtenerProveedoresForm);

  return (
    <SelectFiltro
      reporte={reporte}
      campo="IdProveedor"
      etiqueta="Proveedor"
      opciones={proveedores}
      campoEtiqueta="NombreProveedor"
      placeholder="Todos los proveedores"
    />
  );
}

export function FiltroTipos({ reporte, tipo }) {
  const opciones = useOpciones(tipo.cargar);
  const seleccion = reporte.filtros[tipo.campo];

  if (!Array.isArray(seleccion)) {
    return (
      <SelectFiltro
        reporte={reporte}
        campo={tipo.campo}
        etiqueta={tipo.etiqueta}
        opciones={opciones}
        campoEtiqueta={tipo.campoEtiqueta}
        placeholder="Todos los tipos"
      />
    );
  }

  if (opciones.length === 0) return null;

  return (
    <CampoFiltro etiqueta={tipo.etiqueta}>
      <ToggleGroup
        value={seleccion.map(String)}
        className="flex flex-wrap justify-start gap-2"
      >
        {opciones.map((opcion) => (
          <ToggleGroupItem
            key={opcion[tipo.campoValor]}
            value={String(opcion[tipo.campoValor])}
            onClick={() => reporte.alternar(tipo.campo, opcion[tipo.campoValor])}
            className={PILDORA_FILTRO}
          >
            {opcion[tipo.campoEtiqueta]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </CampoFiltro>
  );
}

export function TarjetaFiltros({ reporte, informe, children }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="text-base font-extrabold text-slate-900">Filtros</div>
        <div className="flex items-center gap-2">
          {reporte.hayFiltros && (
            <Button
              variant="ghost"
              onClick={reporte.limpiar}
              className="h-9 gap-1.5 font-bold text-slate-500 hover:text-slate-900"
            >
              <X size={14} strokeWidth={2.75} />
              Limpiar
            </Button>
          )}
          {informe}
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5">{children}</div>
    </section>
  );
}

export function BotonInforme({
  descargar,
  exito,
  ayuda,
  disponible = true,
  ayudaNoDisponible = AYUDA_SIN_RANGO,
  texto = "Ver informe",
}) {
  const { descargando, iniciar } = useDescarga(descargar, exito);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex">
            <Button
              onClick={iniciar}
              disabled={!disponible || descargando}
              className="h-9 gap-1.5 bg-gradient-to-r from-c3 to-c4 font-bold text-white hover:opacity-90"
            >
              {descargando ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Eye size={15} strokeWidth={2.5} />
              )}
              {texto}
            </Button>
          </span>
        }
      />
      <TooltipContent>{disponible ? ayuda : ayudaNoDisponible}</TooltipContent>
    </Tooltip>
  );
}

export function BotonDescargaFila({ descargar, ayuda, icono: Icono = FileDown, className }) {
  const { descargando, iniciar } = useDescarga(descargar);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            disabled={descargando}
            onClick={iniciar}
            className={cn("h-9 w-9", className, "text-slate-400 hover:bg-c4/10 hover:text-c3")}
          >
            {descargando ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Icono size={16} strokeWidth={2.25} />
            )}
          </Button>
        }
      />
      <TooltipContent>{ayuda}</TooltipContent>
    </Tooltip>
  );
}

function Paginacion({ reporte, resumen }) {
  const { catalogo, pagina, totalPaginas, cambiarPagina } = reporte;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5">
      <span className="text-[12.5px] font-semibold text-slate-500">
        Página {catalogo.Pagina} de {totalPaginas} · {resumen}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          disabled={pagina <= 1}
          onClick={() => cambiarPagina(-1)}
          className="h-9 w-9"
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={pagina >= totalPaginas}
          onClick={() => cambiarPagina(1)}
          className="h-9 w-9"
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}

export function ResultadosReporte({
  reporte,
  elementos,
  clave,
  nombres: [singular, plural],
  resumen,
  columnas,
  anchoAccion = "w-12",
  tituloAccion,
  accion,
  tarjeta,
}) {
  const { catalogo, cargando, error, recargar } = reporte;
  const listo = !cargando && !error;

  return (
    <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      {cargando && (
        <div className="flex flex-col gap-2 p-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!cargando && error && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-6 text-sm font-semibold text-red-600">
          {error}
          <Button
            variant="outline"
            onClick={recargar}
            className="h-9 gap-1.5 border-red-300 font-bold text-red-600 hover:bg-red-50"
          >
            <RefreshCcw size={14} strokeWidth={2.5} />
            Reintentar
          </Button>
        </div>
      )}

      {listo && elementos?.length === 0 && (
        <div className="p-10 text-center text-sm text-slate-400">
          No hay {plural} que coincidan con los filtros seleccionados.
        </div>
      )}

      {listo && elementos?.length > 0 && (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {columnas.map((columna) => (
                    <TableHead key={columna.titulo} className={columna.claseTitulo}>
                      {columna.titulo}
                    </TableHead>
                  ))}
                  {accion && (
                    <TableHead className={cn(anchoAccion, tituloAccion && "text-center")}>
                      {tituloAccion}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {elementos.map((elemento) => (
                  <TableRow key={clave(elemento)}>
                    {columnas.map((columna) => (
                      <TableCell key={columna.titulo} className={columna.clase}>
                        {columna.valor(elemento)}
                      </TableCell>
                    ))}
                    {accion && <TableCell>{accion(elemento)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 p-4 md:hidden">
            {elementos.map((elemento) => (
              <Fragment key={clave(elemento)}>{tarjeta(elemento)}</Fragment>
            ))}
          </div>

          <Paginacion
            reporte={reporte}
            resumen={resumen ?? contar(catalogo.Total, singular, plural)}
          />
        </>
      )}
    </section>
  );
}

export function TarjetaReporte({
  titulo,
  tamanoTitulo = "text-[15px]",
  subtitulo,
  estado,
  estilos,
  children,
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className={cn("font-mono", tamanoTitulo, "font-bold text-slate-900")}>
            {titulo}
          </span>
          <span className="text-[12.5px] text-slate-500">{subtitulo}</span>
        </div>
        {estado && <BadgeEstado estado={estado} estilos={estilos} className="shrink-0" />}
      </div>

      {children}
    </div>
  );
}

export function PieTarjeta({ accion, children }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2.5">
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-slate-600">
        {children}
      </div>
      {accion}
    </div>
  );
}

export function Dato({ etiqueta, children }) {
  return (
    <span>
      {etiqueta}{" "}
      <strong className="text-slate-900">{children}</strong>
    </span>
  );
}
