import { Users, Route, Truck, Tag, MapPin, ArrowRight, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InicioSupervisor({ usuario }) {
  const nombre = usuario?.PrimerNombre ? `${usuario.PrimerNombre} ${usuario.ApellidoPaterno || ""}` : "Supervisor";

  const accesos = [
    {
      titulo: "Directorio de Clientes",
      descripcion: "Alta, edición, sucursales y georreferenciación de clientes en Sucre.",
      icono: Users,
      color: "bg-blue-500",
      href: "/supervisor/clientes",
    },
    {
      titulo: "Zonas y Rutas",
      descripcion: "Sectores geográficos y secuencia de paradas de entrega.",
      icono: Route,
      color: "bg-indigo-500",
      href: "/supervisor/rutas",
    },
    {
      titulo: "Programación Diaria",
      descripcion: "Despacho de vehículos y asignación de rutas a repartidores.",
      icono: Truck,
      color: "bg-emerald-500",
      href: "/supervisor/asignaciones",
    },
    {
      titulo: "Catálogo de Precios",
      descripcion: "Precios unitarios y mayoristas vigentes por producto de papel.",
      icono: Tag,
      color: "bg-amber-500",
      href: "/supervisor/precios",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Banner Bienvenida */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#20A7DB] to-[#147a9f] p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-md">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Módulo de Logística & Distribución</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Bienvenido, {nombre}
          </h1>
          <p className="text-sky-100 text-sm sm:text-base">
            Control integral de clientes, puntos de venta, itinerarios de ruta y programación de repartidores para la ciudad de Sucre.
          </p>
        </div>
        <div className="absolute -right-8 -bottom-8 h-48 w-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      </div>

      {/* Tarjetas de Accesos Rápidos */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Gestión Logística</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accesos.map((item) => {
            const Icono = item.icono;
            return (
              <Card
                key={item.titulo}
                className="border-slate-200 shadow-xs hover:shadow-md transition-all hover:border-[#20A7DB] group cursor-pointer"
                onClick={() => (window.location.href = item.href)}
              >
                <CardContent className="p-5 flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${item.color} text-white shrink-0 group-hover:scale-105 transition-transform`}>
                    <Icono className="h-6 w-6" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <h3 className="font-bold text-slate-900 group-hover:text-[#20A7DB] transition-colors flex items-center justify-between">
                      <span>{item.titulo}</span>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-[#20A7DB] group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.descripcion}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
