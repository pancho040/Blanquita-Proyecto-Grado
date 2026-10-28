import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  ObtenerCronograma, 
  ObtenerTurnos, 
  ObtenerEmpleados, 
  AsignarTurno, 
  DesasignarTurno 
} from "@/services/RRHH/RRHHService";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Calendar, 
  Clock, 
  Users, 
  Plus, 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Loader2, 
  ArrowLeft,
  Settings,
  Sparkles,
  Building2
} from "lucide-react";
import ModalTurno from "./ModalTurno";
import { cache } from "@/lib/cacheService";

const DIAS_SEMANA_NOMBRES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const AREAS_DEF = ["Rebobinado", "Servilletas", "Rodela", "Empaque", "Logística"];

// Utilidad para obtener el lunes de la semana de una fecha
function getLunes(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function formatearFechaISO(d) {
  return d.toISOString().split("T")[0];
}

export default function CronogramaTurnos() {
  const [lunesActual, setLunesActual] = useState(() => getLunes(new Date()));
  const [cronograma, setCronograma] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtro área
  const [areaSeleccionada, setAreaSeleccionada] = useState("TODAS");

  // Modal para asignar empleado a turno y día
  const [modalAsignar, setModalAsignar] = useState(false);
  const [diaParaAsignar, setDiaParaAsignar] = useState(null);
  const [areaParaAsignar, setAreaParaAsignar] = useState("Rebobinado");
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState("");
  const [turnoSeleccionado, setTurnoSeleccionado] = useState("");
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);

  // Modal gestión de turnos
  const [modalTurnoAbierto, setModalTurnoAbierto] = useState(false);
  const [turnoEditar, setTurnoEditar] = useState(null);

  // Generar los 6 días de la semana (Lunes a Sábado)
  const diasSemana = useMemo(() => {
    const dias = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(lunesActual);
      d.setDate(d.getDate() + i);
      dias.push({
        nombre: DIAS_SEMANA_NOMBRES[i],
        fechaStr: formatearFechaISO(d),
        diaMes: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
      });
    }
    return dias;
  }, [lunesActual]);

  const fechaInicioStr = diasSemana[0]?.fechaStr;
  const fechaFinStr = diasSemana[5]?.fechaStr;

  const cargarDatos = useCallback(async (silencioso = false) => {
    if (!fechaInicioStr || !fechaFinStr) return;
    try {
      if (!silencioso) setLoading(true);

      // Usar caché para datos maestros (turnos y empleados)
      let turnosData = cache.get("rrhh:turnos");
      let empsData = cache.get("rrhh:empleados_activos");

      const promesas = [ObtenerCronograma(fechaInicioStr, fechaFinStr, areaSeleccionada)];
      if (!turnosData) promesas.push(ObtenerTurnos());
      if (!empsData) promesas.push(ObtenerEmpleados("", "", true));

      const resultados = await Promise.all(promesas);
      const cronoData = resultados[0];
      
      let rIdx = 1;
      if (!turnosData) {
        turnosData = resultados[rIdx++];
        cache.set("rrhh:turnos", turnosData, 600);
      }
      if (!empsData) {
        empsData = resultados[rIdx++];
        cache.set("rrhh:empleados_activos", empsData, 300);
      }

      setCronograma(cronoData);
      setTurnos(turnosData);
      setEmpleados(empsData);

      if (turnosData.length > 0 && !turnoSeleccionado) {
        setTurnoSeleccionado(String(turnosData[0].IdTurno));
      }
    } catch (err) {
      if (!silencioso) toast.error("Error al cargar cronograma semanal");
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [fechaInicioStr, fechaFinStr, areaSeleccionada]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const moverSemana = (deltaDias) => {
    setLunesActual(prev => {
      const nuevo = new Date(prev);
      nuevo.setDate(nuevo.getDate() + deltaDias);
      return nuevo;
    });
  };

  const irSemanaActual = () => {
    setLunesActual(getLunes(new Date()));
  };

  // Mapear cronograma: key `${area}_${fecha}` -> array de empleados
  const mapaCronograma = useMemo(() => {
    const mapa = {};
    cronograma.forEach((item) => {
      const area = item.Area || "Rebobinado";
      const fecha = item.Fecha;
      const key = `${area}_${fecha}`;
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(item);
    });
    return mapa;
  }, [cronograma]);

  // Lista de áreas a renderizar
  const areasMostrar = useMemo(() => {
    if (areaSeleccionada !== "TODAS") return [areaSeleccionada];
    return ["Rebobinado", "Servilletas", "Rodela", "Logística"];
  }, [areaSeleccionada]);

  const abrirModalAsignar = (dia, area) => {
    setDiaParaAsignar(dia);
    setAreaParaAsignar(area);

    // Sugerir empleados del área
    const empsArea = empleados.filter(e => e.Area === area);
    if (empsArea.length > 0) {
      setEmpleadoSeleccionado(String(empsArea[0].IdUsuario));
    } else if (empleados.length > 0) {
      setEmpleadoSeleccionado(String(empleados[0].IdUsuario));
    }

    // Sugerir turno del área
    const turnoArea = turnos.find(t => t.Area === area) || turnos[0];
    if (turnoArea) {
      setTurnoSeleccionado(String(turnoArea.IdTurno));
    }

    setModalAsignar(true);
  };

  const handleGuardarAsignacion = async (e) => {
    e.preventDefault();
    if (!empleadoSeleccionado || !turnoSeleccionado || !diaParaAsignar) {
      toast.error("Selecciona empleado y turno");
      return;
    }

    try {
      setGuardandoAsignacion(true);
      await AsignarTurno({
        IdUsuario: Number(empleadoSeleccionado),
        IdTurno: Number(turnoSeleccionado),
        Fecha: diaParaAsignar.fechaStr,
        Area: areaParaAsignar
      });
      toast.success("Turno asignado al cronograma");
      setModalAsignar(false);
      cargarDatos(true);
    } catch (err) {
      toast.error(err.message || "Error al asignar turno");
    } finally {
      setGuardandoAsignacion(false);
    }
  };

  const handleDesasignar = async (asig) => {
    try {
      await DesasignarTurno(asig.IdUsuario, asig.Fecha);
      toast.success(`Turno desasignado para ${asig.PrimerNombre}`);
      cargarDatos(true);
    } catch (err) {
      toast.error("Error al quitar turno");
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER & CONTROLES */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs print:hidden">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-[#20A7DB]" />
            <span>Turnos</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Asignación de cuadrillas y horarios de trabajo.
          </p>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setTurnoEditar(null);
              setModalTurnoAbierto(true);
            }}
            className="border-slate-300 text-slate-700 hover:bg-slate-50 text-xs h-9 gap-1.5 shadow-2xs"
          >
            <Clock className="h-4 w-4 text-[#20A7DB]" />
            <span>Horarios</span>
          </Button>

          <Button
            type="button"
            onClick={handleImprimir}
            className="bg-[#20A7DB] hover:bg-[#188cba] text-white text-xs h-9 gap-1.5 font-semibold px-4 shadow-2xs"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimir</span>
          </Button>
        </div>
      </div>

      {/* 2. BARRA DE NAVEGACIÓN DE SEMANA & FILTROS */}
      <Card className="border-slate-200 shadow-2xs bg-white print:hidden">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Navegación por semanas */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => moverSemana(-7)}
              className="h-9 px-2.5 text-slate-600 hover:bg-slate-100"
              title="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={irSemanaActual}
              className="h-9 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Esta Semana
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => moverSemana(7)}
              className="h-9 px-2.5 text-slate-600 hover:bg-slate-100"
              title="Semana siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <div className="ml-2 text-sm font-bold text-slate-900 ">
              Semana del {diasSemana[0]?.diaMes} al {diasSemana[5]?.diaMes}
            </div>
          </div>

          {/* Filtro por área */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Área:</Label>
            <select
              value={areaSeleccionada}
              onChange={(e) => setAreaSeleccionada(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 font-medium h-9"
            >
              <option value="TODAS">Todas las Áreas de Planta</option>
              {AREAS_DEF.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* 3. MATRIZ VISUAL DEL CRONOGRAMA (FORMATO IDÉNTICO A LA HOJA DEL BIOMÉTRICO) */}
      <div className="bg-white rounded-2xl border-2 border-slate-800 p-5 shadow-sm space-y-4 print:border-2 print:border-black print:p-2 print:rounded-none">
        {/* MEMBRETE IMPRESO FORMAL */}
        <div className="text-center border-b-2 border-slate-800 pb-3">
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-900">
            CRONOGRAMA DE TURNOS
          </h1>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mt-0.5">
            EMPRESA DE PAPEL BLANQUITA • PLANTA INDUSTRIAL SUCRE
          </p>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
            Semana operativa: del {diasSemana[0]?.diaMes} al {diasSemana[5]?.diaMes}
          </p>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col justify-center items-center gap-3 print:hidden">
            <Loader2 className="h-8 w-8 animate-spin text-[#20A7DB]" />
            <p className="text-xs text-slate-500 font-medium">Cargando cronograma semanal...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-800 text-xs">
              {/* CABECERA: AREA Y DÍAS LUNES A SÁBADO */}
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black text-center border-b-2 border-slate-800">
                  <th className="border border-slate-800 p-3 w-32 uppercase text-xs">
                    ÁREA
                  </th>
                  {diasSemana.map((d) => (
                    <th key={d.fechaStr} className="border border-slate-800 p-2 text-center min-w-[130px]">
                      <div className="font-extrabold uppercase text-xs">{d.nombre}</div>
                      <div className="text-[11px] font-semibold text-slate-600">{d.diaMes}</div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* FILAS POR ÁREA (Rebobinado, Servilletas, etc.) */}
              <tbody>
                {areasMostrar.map((area) => (
                  <tr key={area} className="border-b border-slate-800">
                    {/* Nombre del Área a la izquierda */}
                    <td className="border border-slate-800 p-3 bg-slate-50 font-bold text-slate-900 text-sm align-middle text-center">
                      <div className="uppercase">{area}</div>
                    </td>

                    {/* Celdas para cada día de la semana */}
                    {diasSemana.map((dia) => {
                      const key = `${area}_${dia.fechaStr}`;
                      const asignados = mapaCronograma[key] || [];

                      return (
                        <td 
                          key={dia.fechaStr} 
                          className="border border-slate-800 p-2 align-top bg-white hover:bg-sky-50/30 transition-colors min-h-[90px]"
                        >
                          <div className="space-y-1.5 flex flex-col justify-between h-full">
                            {/* Lista de colaboradores asignados */}
                            <div className="space-y-1">
                              {asignados.length === 0 ? (
                                <div className="text-center py-2 text-[11px] text-slate-300 italic print:text-slate-400">
                                  {dia.nombre === "Sábado" ? "Turno se informará día antes" : "(Sin asignación)"}
                                </div>
                              ) : (
                                asignados.map((asig) => (
                                  <div
                                    key={asig.IdAsistenciaDiaria}
                                    style={{ borderLeftColor: asig.ColorTurno || "#20A7DB" }}
                                    className="p-1.5 rounded bg-slate-50 border border-slate-200 border-l-4 flex items-center justify-between gap-1 shadow-2xs group"
                                  >
                                    <div>
                                      <p className="font-bold text-xs text-slate-900 leading-tight">
                                        {asig.PrimerNombre} {asig.ApellidoPaterno?.[0]}.
                                      </p>
                                      <span className="text-[10px] text-slate-500 block">
                                        {asig.TurnoHoraInicio} - {asig.TurnoHoraFin}
                                      </span>
                                    </div>

                                    {/* Botón quitar asignación (oculto al imprimir) */}
                                    <button
                                      type="button"
                                      onClick={() => handleDesasignar(asig)}
                                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-opacity p-0.5 print:hidden"
                                      title="Desasignar turno"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Botón para asignar más personal al día (oculto al imprimir) */}
                            <div className="pt-1 print:hidden text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => abrirModalAsignar(dia, area)}
                                className="w-full h-6 text-[10px] font-semibold text-slate-500 hover:text-[#20A7DB] hover:bg-sky-50 border border-dashed border-slate-200 gap-1 rounded"
                              >
                                <Plus className="h-2.5 w-2.5" />
                                <span>Asignar</span>
                              </Button>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PIE DE PÁGINA IMPRESO */}
        <div className="hidden print:flex justify-between items-center text-[10px] text-slate-600 pt-4 border-t border-slate-300">
          <span>Elaborado por: Administración & RRHH Blanquita</span>
          <span>Aprobado por: Gerencia General</span>
          <span>Registro en Biométrico Obligatorio (Entrada / Salida)</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL ASIGNAR EMPLEADO A DÍA Y TURNO                          */}
      {/* ============================================================== */}
      {modalAsignar && (
        <Dialog open={modalAsignar} onOpenChange={setModalAsignar}>
          <DialogContent className="w-full sm:max-w-2xl p-6 sm:p-8">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-base font-bold text-[#20A7DB] flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[#20A7DB]" />
                <span>Asignar Turno • {diaParaAsignar?.nombre} ({diaParaAsignar?.diaMes})</span>
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Área de trabajo: <strong className="text-slate-800">{areaParaAsignar}</strong>
              </p>
            </DialogHeader>

            <form onSubmit={handleGuardarAsignacion} className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Colaborador / Empleado *</Label>
                <select
                  value={empleadoSeleccionado}
                  onChange={(e) => setEmpleadoSeleccionado(e.target.value)}
                  required
                  className="mt-1 w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-medium"
                >
                  <option value="">-- Seleccionar Empleado --</option>
                  {empleados.map((emp) => (
                    <option key={emp.IdUsuario} value={emp.IdUsuario}>
                      {emp.NombreCompleto} ({emp.Area || "General"} - {emp.Cargo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Turno & Horario *</Label>
                <select
                  value={turnoSeleccionado}
                  onChange={(e) => setTurnoSeleccionado(e.target.value)}
                  required
                  className="mt-1 w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-medium"
                >
                  <option value="">-- Seleccionar Turno --</option>
                  {turnos.map((t) => (
                    <option key={t.IdTurno} value={t.IdTurno}>
                      {t.NombreTurno} ({t.HoraInicio} a {t.HoraFin})
                    </option>
                  ))}
                </select>
              </div>

              <DialogFooter className="gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setModalAsignar(false)}>Cancelar</Button>
                <Button type="submit" disabled={guardandoAsignacion} className="bg-[#20A7DB] hover:bg-[#188cba] text-white px-6 font-semibold">
                  {guardandoAsignacion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar Asignación
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ============================================================== */}
      {/* MODAL GESTIÓN DE HORARIOS Y TURNOS                             */}
      {/* ============================================================== */}
      {modalTurnoAbierto && (
        <ModalTurno
          turno={turnoEditar}
          abierto={modalTurnoAbierto}
          onCerrar={() => setModalTurnoAbierto(false)}
          onGuardado={() => {
            cargarDatos(true);
          }}
        />
      )}
    </div>
  );
}
