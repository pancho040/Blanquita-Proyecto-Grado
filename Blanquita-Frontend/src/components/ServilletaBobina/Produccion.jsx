import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  verProduccionServilletaActivas,
  verPausasProduccionServilletaActivas,
  pausarProduccionServilleta,
  reanudarProduccionServilleta,
  finalizarProduccionServilleta,
  cancelarProduccionServilleta,
} from "../../services/BobinaServilleta/Produccion";
import { ObservacionServilleta, MotivosReanudacionProduccion } from "@/constants/OperadorConfig";
import { VeComoLider, EsEncargado, EsGerente } from "@/utils/validators";
import { useProduccion } from "@/hooks/useProduccion";
import {
  TarjetaProduccion,
  TabsProduccion,
  ListaProducciones,
} from "@/components/Produccion/comunes";
import ConcluidasServilleta from "./Concluidas";
import {
  DialogoPausar,
  DialogoReanudar,
  DialogoCancelar,
  AlertaFinalizar,
} from "@/components/Produccion/Dialogos";
import Header from "@/components/layout/Header";

const tituloDe = (p) => `Sub-bobina #${p.IdSubBobina} · ${p.CodigoUnidadOrigen}`;

function EncabezadoSubBobina({ p }) {
  return (
    <>
      <div className="text-[15px] font-extrabold text-slate-900">
        Sub-bobina #{p.IdSubBobina}
      </div>
      <div className="font-mono text-sm font-bold text-c3">{p.CodigoUnidadOrigen}</div>
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-slate-600">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
          {p.MedidaMm} mm
        </span>
        <span>Formato {p.DescripcionFormato}</span>
      </div>
    </>
  );
}

export default function ProduccionBobinaServilleta({ usuario }) {
  const [vista, setVista] = useState("activas");
  const esEncargado = EsEncargado(usuario?.IdRol);
  const veConcluidas = VeComoLider(usuario?.IdRol);
  const soloLectura = EsGerente(usuario?.IdRol);
  const [totalConcluidas, setTotalConcluidas] = useState(0);

  const {
    activas,
    pausadas,
    pausa,
    cancelacion,
    finalizacion,
    reanudacion,
    procesandoId,
    reanudar,
  } = useProduccion({
    verActivas: () => verProduccionServilletaActivas(),
    verPausadas: () => verPausasProduccionServilletaActivas(),
    idDe: (p) => p.IdProduccionServilleta,
    pausar: pausarProduccionServilleta,
    cancelar: cancelarProduccionServilleta,
    finalizar: finalizarProduccionServilleta,
    reanudar: reanudarProduccionServilleta,
  });

  return (
    <TooltipProvider>
    <div className="contenido-con-sidebar pt-20 md:pt-0 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header titulo="Producción" subtitulo="Producción de Bobinas de Servilleta" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-6">
        <TabsProduccion
          vista={vista}
          onCambio={setVista}
          totalActivas={activas.datos.length}
          totalPausadas={pausadas.datos.length}
          mostrarConcluidas={veConcluidas}
          totalConcluidas={totalConcluidas}
        />

        {vista === "concluidas" && veConcluidas && (
          <ConcluidasServilleta onTotal={setTotalConcluidas} />
        )}

        {vista === "activas" && (
          <ListaProducciones
            lista={activas}
            altoSkeleton="h-52"
            mensajeVacio="No hay producciones activas."
            renderizar={(p) => (
              <TarjetaProduccion
                key={p.IdProduccionServilleta}
                produccion={p}
                encabezado={<EncabezadoSubBobina p={p} />}
                acciones={soloLectura ? [] : [
                  { tipo: "pausar", onClick: () => pausa.abrir(p) },
                  ...(esEncargado ? [{ tipo: "finalizar", onClick: () => finalizacion.abrir(p) }] : []),
                ]}
              />
            )}
          />
        )}

        {vista === "pausadas" && (
          <ListaProducciones
            lista={pausadas}
            altoSkeleton="h-52"
            mensajeVacio="No hay producciones pausadas."
            renderizar={(p) => {
              const procesando = procesandoId === p.IdProduccionServilleta;
              return (
                <TarjetaProduccion
                  key={p.IdPausaProduccionServilleta}
                  produccion={p}
                  pausada
                  encabezado={<EncabezadoSubBobina p={p} />}
                  acciones={soloLectura ? [] : [
                    { tipo: "reanudar", onClick: () => reanudar(p), disabled: procesando, procesando },
                    ...(esEncargado
                      ? [{ tipo: "cancelar", onClick: () => cancelacion.abrir(p), disabled: procesando }]
                      : []),
                  ]}
                />
              );
            }}
          />
        )}
      </main>

      <DialogoPausar dialogo={pausa} tituloDe={tituloDe} opciones={ObservacionServilleta} />

      <DialogoReanudar
        dialogo={reanudacion}
        tituloDe={tituloDe}
        opciones={MotivosReanudacionProduccion}
      />

      <DialogoCancelar
        dialogo={cancelacion}
        tituloDe={tituloDe}
        placeholder="Ej. Sub-bobina dañada, error de registro..."
      />

      <AlertaFinalizar
        dialogo={finalizacion}
        prefijo="de la sub-bobina"
        codigoDe={(p) => p.CodigoUnidadOrigen}
      />
    </div>
    </TooltipProvider>
  );
}
