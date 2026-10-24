import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";



const CLASES_ACCION =
  "h-11 gap-2 bg-white font-bold text-c3 shadow-md hover:bg-slate-100";

export default function Header({
  titulo,
  subtitulo,
  volver = false, 
  accion = null, 
  contador = null, 
  children = null, 
}) {
  const acciones = [accion].flat().filter(Boolean);

  const manejarVolver = () => {
    if (window.history.length > 1) window.history.back();
    else if (typeof volver === "string") window.location.href = volver;
  };

  const textoContador =
    typeof contador === "string"
      ? contador
      : contador
        ? `${contador.valor} ${contador.valor === 1 ? contador.singular : contador.plural}`
        : null;

  const botonAccion = acciones.length
    ? acciones.map((item) => {
        const IconoAccion = item.icono;
        const contenido = (
          <>
            {IconoAccion && <IconoAccion size={16} strokeWidth={2.75} />}
            {item.texto}
          </>
        );
        return item.href ? (
          <Button
            key={item.texto}
            nativeButton={false}
            render={<a href={item.href} />}
            className={`${CLASES_ACCION} whitespace-nowrap`}
          >
            {contenido}
          </Button>
        ) : (
          <Button key={item.texto} onClick={item.onClick} className={CLASES_ACCION}>
            {contenido}
          </Button>
        );
      })
    : null;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-c3 to-c4 px-5 py-4 text-white sm:px-7">
      <div className="flex items-center gap-3">
        {volver && (
          <Button
            variant="ghost"
            onClick={manejarVolver}
            aria-label="Volver"
            className="h-11 w-11 shrink-0 rounded-full p-0 text-white hover:bg-white/15 hover:text-white"
          >
            <ArrowLeft size={19} strokeWidth={2.75} />
          </Button>
        )}

        <div className="flex flex-col gap-0.5">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
            {titulo}
          </div>
          <div className="text-xl font-extrabold">{subtitulo}</div>
        </div>
      </div>

      {(children || botonAccion || textoContador) && (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-end">
          {children}

          {textoContador && (
            <div className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold">
              {textoContador}
            </div>
          )}

          {botonAccion}
        </div>
      )}
    </header>
  );
}