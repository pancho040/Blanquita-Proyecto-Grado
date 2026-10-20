import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import DoubleDatePicker from "@/components/layout/dates/DoubleDatePicker";
import { CampoFiltro } from "@/components/Reportes/comunes";
import { ATAJOS, atajoActivo } from "@/components/Reportes/Empaque/filtros";
import { useDescarga } from "@/hooks/useDescarga";
import { PILDORA_FILTRO } from "@/constants/Acentos";
import { aFechaISO } from "@/utils/dates";
import { descargarReporteUsuarioRegistroIngreso } from "@/services/Usuario/RegistroIngreso";
import { descargarReporteUsuarioHistorialAdmin } from "@/services/Usuario/HistorialAdmin";

const ATAJO_INICIAL = ATAJOS.find((a) => a.valor === "mes");

const REPORTES = {
  accesos: {
    titulo: "Reporte de accesos",
    descripcion: "PDF con los ingresos, salidas e intentos fallidos del usuario en el período.",
    exito: "Reporte de accesos descargado",
    descargar: descargarReporteUsuarioRegistroIngreso,
  },
  acciones: {
    titulo: "Reporte de acciones de administrador",
    descripcion: "PDF con las acciones que el administrador registró en el período.",
    exito: "Reporte de acciones descargado",
    descargar: descargarReporteUsuarioHistorialAdmin,
  },
};

export function DialogoReporteUsuario({ consulta, onCerrar }) {
  const [rango, setRango] = useState(() => ATAJO_INICIAL.rango(new Date()));
  const abierto = consulta !== null;
  const config = consulta ? REPORTES[consulta.tipo] : null;
  const usuario = consulta?.usuario;
  const rangoCompleto = Boolean(rango?.from && rango?.to);
  const atajo = atajoActivo(rango);

  const { descargando, iniciar } = useDescarga(
    () =>
      config.descargar({
        Ci: usuario.Ci,
        FechaInicio: aFechaISO(rango.from),
        FechaFin: aFechaISO(rango.to),
      }),
    config?.exito,
  );

  useEffect(() => {
    if (abierto) setRango(ATAJO_INICIAL.rango(new Date()));
  }, [abierto]);

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && !descargando && onCerrar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        {config && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold">{config.titulo}</DialogTitle>
              <DialogDescription>{config.descripcion}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-0.5 rounded-xl bg-slate-50 px-3.5 py-2.5">
              <span className="text-sm font-extrabold text-slate-900">{usuario.NombreCompleto}</span>
              <span className="text-[12.5px] text-slate-500">
                CI <span className="font-mono font-bold">{usuario.Ci}</span> · {usuario.NombreRol}
              </span>
            </div>

            <DoubleDatePicker
              id="rango-reporte-usuario"
              label="Período"
              value={rango}
              onChange={setRango}
            />

            <CampoFiltro etiqueta="Atajos">
              <ToggleGroup value={atajo ? [atajo] : []} className="flex flex-wrap justify-start gap-2">
                {ATAJOS.map((a) => (
                  <ToggleGroupItem
                    key={a.valor}
                    value={a.valor}
                    onClick={() => setRango(a.rango(new Date()))}
                    className={PILDORA_FILTRO}
                  >
                    {a.texto}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </CampoFiltro>

            <DialogFooter className="gap-2">
              <Button
                variant="ghost"
                onClick={onCerrar}
                disabled={descargando}
                className="h-11 font-bold text-slate-500 hover:text-slate-900"
              >
                Cerrar
              </Button>
              <Button
                onClick={iniciar}
                disabled={!rangoCompleto || descargando}
                className="h-11 gap-2 bg-gradient-to-r from-c3 to-c4 font-extrabold text-white hover:opacity-90"
              >
                {descargando ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} strokeWidth={2.5} />
                )}
                Descargar PDF
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
