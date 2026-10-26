import React from "react";

export default function ReporteHeaderFormal({ titulo, subtitulo, usuario = "Administración" }) {
  const fechaGeneracion = new Date().toLocaleString("es-BO", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="hidden print:block mb-5 border-b-2 border-slate-900 pb-3 font-sans">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-wider text-slate-900 uppercase">
              EMPRESA DE PAPEL BLANQUITA
            </span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 border border-slate-400 font-bold uppercase rounded text-slate-700">
              SHEMA ASOCIADOS S.R.L.
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
            Calle Regimiento Charcas (16 de Infantería) N° 37 • Sucre, Bolivia • NIT: 1028495024
          </p>
          <p className="text-[11px] text-slate-600">
            Fabricación y Distribución de Productos de Papel • Sistema de Gestión y Análisis
          </p>
        </div>

        <div className="text-right">
          <span className="inline-block px-3 py-1 bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wide rounded">
            REPORTE OFICIAL
          </span>
          <p className="text-[10px] font-semibold text-slate-600 mt-1">
            Generado: {fechaGeneracion}
          </p>
          <p className="text-[10px] text-slate-500">
            Responsable: {usuario}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-2 border-t border-slate-200">
        <h2 className="text-base font-extrabold uppercase text-slate-900 tracking-wide">
          {titulo}
        </h2>
        {subtitulo && (
          <p className="text-xs text-slate-600 mt-0.5 font-medium">
            {subtitulo}
          </p>
        )}
      </div>
    </div>
  );
}
