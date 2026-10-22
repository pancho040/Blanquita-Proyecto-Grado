import { CalendarClock, History, LogIn, LogOut, ShieldAlert } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import DoubleDatePicker from "@/components/layout/dates/DoubleDatePicker";
import {
  TarjetaFiltros,
  CampoFiltro,
  BuscadorFiltro,
  BotonInforme,
  ResultadosReporte,
  TarjetaReporte,
  PieTarjeta,
  Dato,
} from "@/components/Reportes/comunes";
import { ATAJOS, atajoActivo } from "@/components/Reportes/Empaque/filtros";
import {
  REGISTROS,
  BadgeRegistro,
  CeldaEquipo,
  TarjetaResumen,
} from "@/components/Admin/Accesos/Accesos";
import { MODULOS, BadgeModulo, estiloModulo } from "@/components/Admin/Acciones/Acciones";
import { useReporte } from "@/hooks/useReporte";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { aFechaISO, dateFormatter } from "@/utils/dates";
import {
  listarAccesosUsuario,
  descargarReporteUsuarioRegistroIngreso,
} from "@/services/Usuario/RegistroIngreso";
import {
  listarAccionesUsuario,
  descargarReporteUsuarioHistorialAdmin,
} from "@/services/Usuario/HistorialAdmin";

const TODO = "todo";

const textoFecha = (fecha) => (fecha ? dateFormatter(fecha) : "-");

const periodo = (rango) => {
  if (!rango?.from) return { FechaInicio: null, FechaFin: null };
  const inicio = aFechaISO(rango.from);
  return { FechaInicio: inicio, FechaFin: rango.to ? aFechaISO(rango.to) : inicio };
};

const delUsuario = (listar, ci) => ({ FechaInicio, FechaFin, ...resto }) =>
  listar({ ...resto, FechaInicio, FechaFin: FechaFin ?? FechaInicio, Ci: ci });

function FiltroPeriodo({ reporte, id }) {
  const { Rango } = reporte.filtros;
  const atajo = Rango?.from ? atajoActivo(Rango) : TODO;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <DoubleDatePicker
        id={id}
        label="Período (vacío = todo el historial)"
        value={Rango}
        onChange={(valor) => reporte.cambiar("Rango", valor)}
      />
      <CampoFiltro etiqueta="Atajos">
        <ToggleGroup value={atajo ? [atajo] : []} className="flex flex-wrap justify-start gap-2">
          <ToggleGroupItem
            value={TODO}
            onClick={() => reporte.cambiar("Rango", undefined)}
            className={PILDORA_FILTRO}
          >
            Todo
          </ToggleGroupItem>
          {ATAJOS.map((a) => (
            <ToggleGroupItem
              key={a.valor}
              value={a.valor}
              onClick={() => reporte.cambiar("Rango", a.rango(new Date()))}
              className={PILDORA_FILTRO}
            >
              {a.texto}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CampoFiltro>
    </div>
  );
}

function FiltroPildoras({ etiqueta, opciones, valor, onCambio }) {
  return (
    <CampoFiltro etiqueta={etiqueta}>
      <ToggleGroup value={[valor]} className="flex flex-wrap justify-start gap-2">
        {opciones.map((opcion) => (
          <ToggleGroupItem
            key={opcion.valor || "todos"}
            value={opcion.valor}
            onClick={() => onCambio(opcion.valor)}
            className={PILDORA_FILTRO}
          >
            {opcion.texto}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </CampoFiltro>
  );
}

function textoPeriodo(rango) {
  const { FechaInicio, FechaFin } = periodo(rango);
  return FechaInicio ? `del ${FechaInicio} al ${FechaFin}` : "de todo el historial";
}

const COLUMNAS_ACCESOS = [
  {
    titulo: "Fecha",
    clase: "text-[12.5px] whitespace-nowrap",
    valor: (r) => dateFormatter(r.FechaRegistro),
  },
  { titulo: "Registro", valor: (r) => <BadgeRegistro registro={r.Registro} /> },
  {
    titulo: "Detalle",
    clase: "whitespace-normal wrap-anywhere text-[12.5px] text-slate-600",
    valor: (r) => r.Detalle ?? "-",
  },
  {
    titulo: "IP / Dispositivo",
    clase: "whitespace-normal wrap-anywhere text-[12.5px]",
    valor: (r) => <CeldaEquipo r={r} />,
  },
];

export function PanelAccesos({ usuario }) {
  const reporte = useReporte(delUsuario(listarAccesosUsuario, usuario.Ci), {
    Rango: undefined,
    Registro: "",
  });
  const { filtros, catalogo } = reporte;
  const parametros = { ...periodo(filtros.Rango), Registro: filtros.Registro, Ci: usuario.Ci };
  const resumen = catalogo?.Resumen;

  return (
    <div className="flex flex-col">
      <TarjetaFiltros
        reporte={reporte}
        informe={
          <BotonInforme
            disponible={Boolean(catalogo?.Total)}
            ayuda={`PDF con los accesos ${textoPeriodo(filtros.Rango)}`}
            ayudaNoDisponible="No hay accesos con los filtros elegidos"
            exito="Reporte de accesos descargado"
            descargar={() => descargarReporteUsuarioRegistroIngreso(parametros)}
          />
        }
      >
        <FiltroPeriodo reporte={reporte} id="rango-accesos-usuario" />
        <FiltroPildoras
          etiqueta="Registro"
          opciones={REGISTROS}
          valor={filtros.Registro}
          onCambio={(valor) => reporte.cambiar("Registro", valor)}
        />
      </TarjetaFiltros>

      {resumen && (
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TarjetaResumen icono={LogIn} etiqueta="Ingresos" valor={resumen.Ingresos} clase="bg-emerald-50 text-emerald-700" />
          <TarjetaResumen icono={LogOut} etiqueta="Salidas" valor={resumen.Salidas} clase="bg-slate-100 text-slate-700" />
          <TarjetaResumen
            icono={ShieldAlert}
            etiqueta="Intentos fallidos"
            valor={resumen.IntentosFallidos}
            clase="bg-red-50 text-red-700"
          />
          <TarjetaResumen
            icono={CalendarClock}
            etiqueta={`Último ingreso: ${textoFecha(catalogo.UltimoIngreso)}`}
            valor={resumen.Total}
            clase="bg-c4/10 text-c3"
          />
        </div>
      )}

      <ResultadosReporte
        reporte={reporte}
        elementos={catalogo?.Registros}
        clave={(r) => r.IdRegistroIngreso}
        nombres={["registro", "registros"]}
        columnas={COLUMNAS_ACCESOS}
        tarjeta={(r) => (
          <TarjetaReporte
            titulo={dateFormatter(r.FechaRegistro)}
            tamanoTitulo="text-[14px] font-sans"
            subtitulo={r.Detalle ?? r.Dispositivo}
          >
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-slate-600">
              <BadgeRegistro registro={r.Registro} />
            </div>
            <PieTarjeta>
              <Dato etiqueta="IP">{r.DireccionIp ?? "-"}</Dato>
              <Dato etiqueta="Equipo">{r.Dispositivo}</Dato>
            </PieTarjeta>
          </TarjetaReporte>
        )}
      />
    </div>
  );
}

const COLUMNAS_ACCIONES = [
  {
    titulo: "Fecha",
    clase: "text-[12.5px] whitespace-nowrap",
    valor: (a) => dateFormatter(a.FechaMovimiento),
  },
  { titulo: "Módulo", valor: (a) => <BadgeModulo modulo={a.Modulo} /> },
  {
    titulo: "Acción",
    clase: "whitespace-normal wrap-anywhere font-semibold text-slate-900",
    valor: (a) => a.Accion,
  },
  {
    titulo: "Detalle",
    clase: "w-1/2 whitespace-normal wrap-anywhere text-[12.5px] text-slate-600",
    valor: (a) => a.Detalle ?? "-",
  },
];

export function PanelAccionesAdmin({ usuario }) {
  const reporte = useReporte(
    delUsuario(listarAccionesUsuario, usuario.Ci),
    { Rango: undefined, Modulo: "", Busqueda: "" },
    ["Busqueda"],
  );
  const { filtros, catalogo } = reporte;
  const parametros = {
    ...periodo(filtros.Rango),
    Modulo: filtros.Modulo,
    Busqueda: filtros.Busqueda,
    Ci: usuario.Ci,
  };
  const modulos = catalogo?.Resumen.Modulos.filter((m) => m.Cantidad > 0) ?? [];

  return (
    <div className="flex flex-col">
      <TarjetaFiltros
        reporte={reporte}
        informe={
          <BotonInforme
            disponible={Boolean(catalogo?.Total)}
            ayuda={`PDF con las acciones de administrador ${textoPeriodo(filtros.Rango)}`}
            ayudaNoDisponible="No hay acciones con los filtros elegidos"
            exito="Reporte de acciones descargado"
            descargar={() => descargarReporteUsuarioHistorialAdmin(parametros)}
          />
        }
      >
        <FiltroPeriodo reporte={reporte} id="rango-acciones-usuario" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <BuscadorFiltro
            reporte={reporte}
            campo="Busqueda"
            etiqueta="Buscar en la acción"
            placeholder="Nombre, CI afectado, motivo…"
            mono={false}
          />
        </div>
        <FiltroPildoras
          etiqueta="Módulo"
          opciones={MODULOS}
          valor={filtros.Modulo}
          onCambio={(valor) => reporte.cambiar("Modulo", valor)}
        />
      </TarjetaFiltros>

      {catalogo && (
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {modulos.map((m) => (
            <TarjetaResumen
              key={m.Modulo}
              icono={estiloModulo(m.Modulo).icono}
              etiqueta={m.Modulo}
              valor={m.Cantidad}
              clase={estiloModulo(m.Modulo).tarjeta}
            />
          ))}
          <TarjetaResumen
            icono={History}
            etiqueta={`Última acción: ${textoFecha(catalogo.UltimaAccion)}`}
            valor={catalogo.Resumen.Total}
            clase="bg-c4/10 text-c3"
          />
        </div>
      )}

      <ResultadosReporte
        reporte={reporte}
        elementos={catalogo?.Acciones}
        clave={(a) => a.IdHistorialAdmin}
        nombres={["acción", "acciones"]}
        columnas={COLUMNAS_ACCIONES}
        tarjeta={(a) => (
          <TarjetaReporte
            titulo={a.Accion}
            tamanoTitulo="text-[14px] font-sans"
            subtitulo={dateFormatter(a.FechaMovimiento)}
          >
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-slate-600">
              <BadgeModulo modulo={a.Modulo} />
              {a.Detalle && <span>{a.Detalle}</span>}
            </div>
          </TarjetaReporte>
        )}
      />
    </div>
  );
}
