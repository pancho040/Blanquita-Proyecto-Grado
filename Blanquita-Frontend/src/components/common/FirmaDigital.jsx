import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, PenTool, ShieldCheck } from 'lucide-react';

export default function FirmaDigital({
  onGuardar,
  bloqueado = false,
  firmaExistenteUrl = null,
  etiqueta = "Firma del Cliente Receptor"
}) {
  const canvasRef = useRef(null);
  const [dibujando, setDibujando] = useState(false);
  const [tieneFirma, setTieneFirma] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0F172A'; // Slate 900
  }, []);

  const obtenerCoordenadas = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches && e.touches[0]) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const iniciarTrazo = (e) => {
    if (bloqueado) return;
    e.preventDefault();
    const { x, y } = obtenerCoordenadas(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDibujando(true);
    setTieneFirma(true);
    setGuardado(false);
  };

  const dibujarTrazo = (e) => {
    if (!dibujando || bloqueado) return;
    e.preventDefault();
    const { x, y } = obtenerCoordenadas(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const finalizarTrazo = (e) => {
    if (bloqueado) return;
    e.preventDefault();
    setDibujando(false);
  };

  const limpiarCanvas = () => {
    if (bloqueado) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTieneFirma(false);
    setGuardado(false);
    if (onGuardar) onGuardar(null, null);
  };

  const confirmarFirma = () => {
    if (!tieneFirma || bloqueado) return;
    const canvas = canvasRef.current;
    const firmaBase64 = canvas.toDataURL('image/png');
    const metadata = {
      fechaHora: new Date().toISOString(),
      ancho: canvas.width,
      alto: canvas.height
    };
    setGuardado(true);
    if (onGuardar) {
      onGuardar(firmaBase64, metadata);
    }
  };

  if (firmaExistenteUrl) {
    return (
      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col items-center">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          {etiqueta} (Registrada)
        </span>
        <img
          src={firmaExistenteUrl}
          alt="Firma registrada"
          className="max-h-36 max-w-full object-contain bg-white rounded-lg border border-slate-200 p-2 shadow-xs"
        />
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-[#20A7DB]" />
          {etiqueta}
        </label>
        {guardado && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <Check className="w-3 h-3" /> Firma fijada
          </span>
        )}
      </div>

      <div className="relative border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          width={460}
          height={180}
          className="w-full h-36 cursor-crosshair bg-transparent"
          onMouseDown={iniciarTrazo}
          onMouseMove={dibujarTrazo}
          onMouseUp={finalizarTrazo}
          onMouseLeave={finalizarTrazo}
          onTouchStart={iniciarTrazo}
          onTouchMove={dibujarTrazo}
          onTouchEnd={finalizarTrazo}
        />
        {!tieneFirma && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs font-medium">
            Firme aquí con el dedo o puntero
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={limpiarCanvas}
          disabled={bloqueado || !tieneFirma}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Eraser className="w-3.5 h-3.5" />
          Limpiar
        </button>
        <button
          type="button"
          onClick={confirmarFirma}
          disabled={bloqueado || !tieneFirma || guardado}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#20A7DB] hover:bg-[#1B92C0] rounded-lg shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-3.5 h-3.5" />
          {guardado ? 'Confirmada' : 'Aceptar Firma'}
        </button>
      </div>
    </div>
  );
}
