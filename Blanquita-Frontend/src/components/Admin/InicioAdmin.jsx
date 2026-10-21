import { Icon, ArrowRight } from "lucide-react";
import { RutasAdmin } from "@/constants/NavBarRoutes";

function IconoRuta({ item, size = 20, className }) {
  if (item.esIconoLab) {
    return <Icon iconNode={item.icono} size={size} className={className} />;
  }
  const Comp = item.icono;
  return <Comp size={size} className={className} />;
}

function TileAdmin({ item }) {
  return (
    <a
      href={`/admin/${item.ruta}`}
      className="group flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-c4/10">
        <IconoRuta item={item} size={20} className="text-c3" />
      </div>

      <div className="min-w-0">
        <div className="text-[15px] font-extrabold leading-tight text-slate-900 break-words">
          {item.titulo}
        </div>
        <p className="mt-1 text-[13px] leading-snug text-slate-500">{item.descripcion}</p>
      </div>

      <div className="mt-auto flex items-center gap-1 text-xs font-bold text-c3">
        Abrir
        <ArrowRight
          size={14}
          strokeWidth={2.75}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </div>
    </a>
  );
}

export default function InicioAdmin() {
  const accesos = RutasAdmin.filter((item) => item.descripcion);

  return (
    <div className="contenido-con-sidebar mt-20 flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 md:mt-0">
      <header className="bg-gradient-to-r from-c3 to-c4 px-5 py-5 text-white sm:px-7">
        <div className="mx-auto w-full max-w-5xl">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
            Administración
          </div>
          <div className="mt-0.5 text-xl font-extrabold">¿Qué quieres gestionar?</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accesos.map((item) => (
            <TileAdmin key={item.ruta} item={item} />
          ))}
        </div>
      </main>
    </div>
  );
}
