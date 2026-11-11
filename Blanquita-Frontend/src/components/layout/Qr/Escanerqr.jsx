import { useCallback, useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

export default function EscanerQR({ abierto, onCerrar, onDetectar }) {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const pistaRef = useRef(null);
  const yaLeidoRef = useRef(false);

  const onCerrarRef = useRef(onCerrar);
  const onDetectarRef = useRef(onDetectar);
  onCerrarRef.current = onCerrar;
  onDetectarRef.current = onDetectar;

  const [estado, setEstado] = useState("cargando"); 
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  const [zoom, setZoom] = useState(null);
  const [limitesZoom, setLimitesZoom] = useState(null);

  const pellizcoRef = useRef(null);

 
  useEffect(() => {
    if (!abierto) return;

    window.history.pushState({ escanerQR: true }, "");

    const alVolver = () => onCerrarRef.current();
    window.addEventListener("popstate", alVolver);

    return () => window.removeEventListener("popstate", alVolver);
  }, [abierto]);

  const cerrar = useCallback(() => {
    if (window.history.state && window.history.state.escanerQR) {
      window.history.back();
      return;
    }
    onCerrarRef.current();
  }, []);


  const prepararZoom = useCallback(() => {
    const stream = videoRef.current && videoRef.current.srcObject;
    if (!stream) return;

    const pista = stream.getVideoTracks()[0];
    if (!pista || typeof pista.getCapabilities !== "function") return;

    pistaRef.current = pista;

    const caps = pista.getCapabilities();
    if (!caps || !caps.zoom) return;

    const min = caps.zoom.min ?? 1;
    const max = caps.zoom.max ?? 1;
    if (max <= min) return;

    const paso = caps.zoom.step || (max - min) / 20;
    const actual = pista.getSettings().zoom ?? min;

    setLimitesZoom({ min, max, paso });
    setZoom(actual);
  }, []);

  const aplicarZoom = useCallback(
    (valor) => {
      if (!limitesZoom || !pistaRef.current) return;

      const acotado = Math.min(limitesZoom.max, Math.max(limitesZoom.min, valor));
      setZoom(acotado);

      pistaRef.current
        .applyConstraints({ advanced: [{ zoom: acotado }] })
        .catch(() => {});
    },
    [limitesZoom]
  );

  const alTocarInicio = (evento) => {
    if (!limitesZoom || evento.touches.length !== 2) return;
    pellizcoRef.current = {
      distancia: distanciaEntreDedos(evento.touches),
      zoomInicial: zoom,
    };
  };

  const alTocarMover = (evento) => {
    const pellizco = pellizcoRef.current;
    if (!pellizco || evento.touches.length !== 2) return;

    const distancia = distanciaEntreDedos(evento.touches);
    if (pellizco.distancia === 0) return;

    const factor = distancia / pellizco.distancia;
    aplicarZoom(pellizco.zoomInicial * factor);
  };

  const alTocarFin = () => {
    pellizcoRef.current = null;
  };

  useEffect(() => {
    if (!abierto) return;

    let cancelado = false;
    yaLeidoRef.current = false;

    setEstado("cargando");
    setError("");
    setZoom(null);
    setLimitesZoom(null);

    const alLeer = (resultado) => {
      if (yaLeidoRef.current) return;
      yaLeidoRef.current = true;

      const valor = resultado && resultado.data ? resultado.data : resultado;

      if (scannerRef.current) scannerRef.current.stop();

      if (window.history.state && window.history.state.escanerQR) {
        window.history.replaceState(null, "");
      }

      onDetectarRef.current(valor);
    };

    (async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelado || !videoRef.current) return;

        const scanner = new QrScanner(videoRef.current, alLeer, {
          preferredCamera: "environment",
          highlightScanRegion: false,
          highlightCodeOutline: false,
          maxScansPerSecond: 5,
        });

        scannerRef.current = scanner;
        await scanner.start();

        if (cancelado) {
          scanner.destroy();
          scannerRef.current = null;
          return;
        }

        setEstado("activo");
        prepararZoom();
      } catch (fallo) {
        if (cancelado) return;
        setEstado("error");
        setError(mensajeDeFallo(fallo));
      }
    })();

    return () => {
      cancelado = true;
      if (scannerRef.current) {
        scannerRef.current.destroy(); 
        scannerRef.current = null;
      }
      pistaRef.current = null;
    };
  }, [abierto, intento, prepararZoom]);

  if (!abierto) return null;

  const hayZoom = limitesZoom !== null && zoom !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Escanear código QR"
    >
      {/* Cámara */}
      <div
        className="absolute inset-0 overflow-hidden"
        onTouchStart={alTocarInicio}
        onTouchMove={alTocarMover}
        onTouchEnd={alTocarFin}
        onTouchCancel={alTocarFin}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
      </div>

      {/* Marco de encuadre */}
      {estado === "activo" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative aspect-square w-[min(72vw,52vh,340px)]">
            <span className="absolute -left-px -top-px h-10 w-10 border-l-4 border-t-4 border-c3" />
            <span className="absolute -right-px -top-px h-10 w-10 border-r-4 border-t-4 border-c3" />
            <span className="absolute -bottom-px -left-px h-10 w-10 border-b-4 border-l-4 border-c3" />
            <span className="absolute -bottom-px -right-px h-10 w-10 border-b-4 border-r-4 border-c3" />
          </div>
        </div>
      ) : null}

      {/* Cabecera */}
      <div className="relative z-10 flex items-center justify-between gap-3 bg-linear-to-b from-black/70 to-transparent px-4 pb-8 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <span className="font-sans text-sm font-semibold text-white">
          Escanear código QR
        </span>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar cámara"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 active:bg-white/30"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1" />

      {/* Controles y mensajes */}
      <div className="relative z-10 flex flex-col gap-4 bg-linear-to-t from-black/80 to-transparent px-5 pt-10 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        {estado === "error" ? (
          <div className="mx-auto w-full max-w-sm rounded-2xl bg-white/10 p-4 text-center backdrop-blur">
            <p className="font-sans text-sm font-medium text-white">{error}</p>
            <button
              type="button"
              onClick={() => setIntento((n) => n + 1)}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-c3 px-5 py-2.5 font-sans text-sm font-semibold text-white transition-transform active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
              Reintentar
            </button>
          </div>
        ) : null}

        {estado === "cargando" ? (
          <p className="text-center font-sans text-sm text-white/70">
            Encendiendo la cámara…
          </p>
        ) : null}

        {estado === "activo" && hayZoom ? (
          <div className="mx-auto flex w-full max-w-sm items-center gap-3 rounded-full bg-white/10 px-3 py-2 backdrop-blur">
            <button
              type="button"
              onClick={() => aplicarZoom(zoom - limitesZoom.paso * 2)}
              aria-label="Alejar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
            >
              <ZoomOut className="h-5 w-5" />
            </button>

            <input
              type="range"
              min={limitesZoom.min}
              max={limitesZoom.max}
              step={limitesZoom.paso}
              value={zoom}
              onChange={(evento) => aplicarZoom(Number(evento.target.value))}
              aria-label="Nivel de acercamiento"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/30 accent-c3"
            />

            <button
              type="button"
              onClick={() => aplicarZoom(zoom + limitesZoom.paso * 2)}
              aria-label="Acercar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
          </div>
        ) : null}

        {estado === "activo" ? (
          <p className="text-center font-sans text-sm text-white/70">
            Apunta la cámara al código del material
          </p>
        ) : null}
      </div>
    </div>
  );
}

function distanciaEntreDedos(dedos) {
  const dx = dedos[0].clientX - dedos[1].clientX;
  const dy = dedos[0].clientY - dedos[1].clientY;
  return Math.hypot(dx, dy);
}

function mensajeDeFallo(fallo) {
  const nombre = fallo && fallo.name ? fallo.name : "";

  if (nombre === "NotAllowedError" || nombre === "SecurityError") {
    return "El navegador bloqueó la cámara. Habilita el permiso desde la configuración del sitio.";
  }
  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") {
    return "Este dispositivo no tiene una cámara disponible.";
  }
  if (nombre === "NotReadableError") {
    return "Otra aplicación está usando la cámara. Ciérrala y vuelve a intentar.";
  }
  return "No se pudo abrir la cámara.";
}