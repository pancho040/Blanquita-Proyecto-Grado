import React from "react";
import { Users, ShieldCheck, FileText } from "lucide-react";

export default function ModuloAdminNav({ pestanaActiva }) {
  const tabs = [
    {
      id: "roles",
      label: "Usuarios y Roles",
      href: "/admin/roles",
      icon: Users,
      descripcion: "Gestión de usuarios y matriz de permisos por rol",
    },
    {
      id: "modificaciones",
      label: "Historial de Modificaciones",
      href: "/admin/auditoria",
      icon: ShieldCheck,
      descripcion: "Trazabilidad de cambios, creaciones y eliminaciones",
    },
    {
      id: "reportes",
      label: "Reportes de Auditoría",
      href: "/admin/auditoria/reportes",
      icon: FileText,
      descripcion: "Consolidado de acciones, filtros y exportación",
    },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl shadow-2xs" aria-label="Navegación del Módulo">
      {tabs.map((tab) => {
        const Icono = tab.icon;
        const activa = pestanaActiva === tab.id;
        return (
          <a
            key={tab.id}
            href={tab.href}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activa
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
            title={tab.descripcion}
          >
            <Icono className={`w-4 h-4 ${activa ? "text-[#20A7DB]" : "text-slate-500"}`} />
            <span>{tab.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
