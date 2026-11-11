import React, { useState, useMemo, useEffect } from "react";
import {
  ShieldCheck,
  Users,
  Search,
  Filter,
  Sliders,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Building,
  Lock,
  FileSpreadsheet,
  Settings,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ROLES_CONFIG,
  MODULOS_SISTEMA,
  ACCIONES_PERMISO,
  USUARIOS_INICIALES,
} from "@/constants/RolesPermisos";
import ModalPermisosUsuario from "./ModalPermisosUsuario";
import StatusBadge from "@/components/common/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { toast } from "sonner";

const CLAVE_STORAGE_USERS = "blanquita_roles_usuarios";
const CLAVE_STORAGE_ROLES = "blanquita_roles_config";

export default function GestionRoles({ usuario: usuarioActual }) {
  const [tabActiva, setTabActiva] = useState("usuarios"); // "usuarios" | "matriz"
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroSucursal, setFiltroSucursal] = useState("todos");
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [creandoUsuario, setCreandoUsuario] = useState(false);
  const [nuevoUsuario, setNuevoUsuario] = useState({
    nombre: "",
    usuario: "",
    ci: "",
    correo: "",
    celular: "",
    idRol: 5,
    idSucursal: 1,
    clave: "Blanquita123!"
  });

  // Estado de roles y usuarios con persistencia local
  const [roles, setRoles] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const guardado = window.localStorage.getItem(CLAVE_STORAGE_ROLES);
        if (guardado) return JSON.parse(guardado);
      } catch {
        /* noop */
      }
    }
    return ROLES_CONFIG;
  });

  const [usuarios, setUsuarios] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const guardado = window.localStorage.getItem(CLAVE_STORAGE_USERS);
        if (guardado) return JSON.parse(guardado);
      } catch {
        /* noop */
      }
    }
    return USUARIOS_INICIALES;
  });

  const [usuarioEditar, setUsuarioEditar] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  // Guardar en storage cuando cambian
  useEffect(() => {
    try {
      window.localStorage.setItem(CLAVE_STORAGE_USERS, JSON.stringify(usuarios));
    } catch {
      /* noop */
    }
  }, [usuarios]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CLAVE_STORAGE_ROLES, JSON.stringify(roles));
    } catch {
      /* noop */
    }
  }, [roles]);

  // Filtrado de usuarios
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      const coincideBusqueda =
        u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.usuario.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.correo.toLowerCase().includes(busqueda.toLowerCase());

      const coincideRol =
        filtroRol === "todos" || u.idRol === Number(filtroRol);

      const coincideEstado =
        filtroEstado === "todos" ||
        (filtroEstado === "activos" && u.activo) ||
        (filtroEstado === "inactivos" && !u.activo);

      const coincideSucursal =
        filtroSucursal === "todos" ||
        (filtroSucursal === "1" && u.idSucursal === 1) ||
        (filtroSucursal === "2" && u.idSucursal === 2) ||
        (filtroSucursal === "multisede" && (u.idSucursal === null || u.idSucursal === "todas"));

      return coincideBusqueda && coincideRol && coincideEstado && coincideSucursal;
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado, filtroSucursal]);

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    if (!nuevoUsuario.nombre.trim() || !nuevoUsuario.usuario.trim()) {
      toast.error("Nombre completo y usuario son obligatorios");
      return;
    }

    try {
      setCreandoUsuario(true);
      const nuevoId = Math.max(...usuarios.map((u) => u.id || 0), 0) + 1;
      const sid = nuevoUsuario.idSucursal === "todas" ? null : Number(nuevoUsuario.idSucursal);

      const usuarioCreado = {
        id: nuevoId,
        nombre: nuevoUsuario.nombre.trim(),
        usuario: nuevoUsuario.usuario.trim().toLowerCase(),
        correo: nuevoUsuario.correo.trim() || `${nuevoUsuario.usuario.trim()}@blanquita.bo`,
        ci: nuevoUsuario.ci.trim() || String(Math.floor(1000000 + Math.random() * 9000000)),
        celular: nuevoUsuario.celular.trim() || "70000000",
        idRol: Number(nuevoUsuario.idRol),
        idSucursal: sid,
        activo: true,
        personalizado: false,
        permisosPersonalizados: null,
      };

      try {
        await fetch("/api/Usuario/crear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            IdRol: Number(nuevoUsuario.idRol),
            Ci: usuarioCreado.ci,
            PrimerNombre: nuevoUsuario.nombre.split(" ")[0] || "Usuario",
            ApellidoPaterno: nuevoUsuario.nombre.split(" ")[1] || "Blanquita",
            Celular: usuarioCreado.celular,
            Clave: nuevoUsuario.clave || "Blanquita123!",
            IdSucursal: sid,
            IsAdmin: Number(nuevoUsuario.idRol) === 3,
          }),
        });
      } catch {
        /* Fallback local */
      }

      setUsuarios((prev) => [usuarioCreado, ...prev]);
      const sedeTexto = sid === 2 ? "Sucursal Potosí" : sid === 1 ? "Sucursal Central Sucre" : "Multisede General";
      toast.success(`Usuario ${usuarioCreado.nombre} creado exitosamente para ${sedeTexto}`);
      setModalCrearAbierto(false);
      setNuevoUsuario({
        nombre: "",
        usuario: "",
        ci: "",
        correo: "",
        celular: "",
        idRol: 5,
        idSucursal: 1,
        clave: "Blanquita123!",
      });
    } catch (err) {
      toast.error("Error al registrar colaborador: " + err.message);
    } finally {
      setCreandoUsuario(false);
    }
  };

  const handleAbrirEditar = (u) => {
    setUsuarioEditar(u);
    setModalAbierto(true);
  };

  const handleGuardarUsuario = (usuarioActualizado) => {
    setUsuarios((prev) =>
      prev.map((u) => (u.id === usuarioActualizado.id ? usuarioActualizado : u))
    );
  };

  const handleToggleEstadoUsuario = (id) => {
    setUsuarios((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const nuevo = !u.activo;
          toast.info(`Usuario ${u.nombre} marcado como ${nuevo ? "Activo" : "Inactivo"}`);
          return { ...u, activo: nuevo };
        }
        return u;
      })
    );
  };

  return (
    <div className="space-y-5">

      {/* ENCABEZADO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Gestión de Usuarios y Roles
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Administración de cuentas, niveles de acceso y asignación operativa por sucursal.
          </p>
        </div>

        {/* ACCIONES Y PESTAÑAS */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {tabActiva === "usuarios" && (
            <Button
              onClick={() => setModalCrearAbierto(true)}
              className="bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs gap-1.5 h-8 font-semibold rounded cursor-pointer border border-transparent shadow-none"
            >
              <Plus size={14} />
              <span>Nuevo Colaborador</span>
            </Button>
          )}

          <div className="flex items-center gap-1 p-0.5 rounded bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setTabActiva("usuarios")}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                tabActiva === "usuarios"
                  ? "bg-white text-slate-900 border border-slate-200 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Usuarios ({usuarios.length})
            </button>
            <button
              type="button"
              onClick={() => setTabActiva("matriz")}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                tabActiva === "matriz"
                  ? "bg-white text-slate-900 border border-slate-200 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Matriz de Permisos ({roles.length})
            </button>
          </div>
        </div>
      </div>

      {/* VISTA 1: TABLA DE USUARIOS Y ASIGNACIÓN DE ROLES */}
      {tabActiva === "usuarios" && (
        <div className="space-y-3">
          {/* BARRA DE FILTROS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-2.5 bg-white rounded border border-slate-200">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, usuario o email..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 rounded border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>

            <div>
              <select
                value={filtroRol}
                onChange={(e) => setFiltroRol(e.target.value)}
                className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              >
                <option value="todos">Todos los Roles del Sistema</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filtroSucursal}
                onChange={(e) => setFiltroSucursal(e.target.value)}
                className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              >
                <option value="todos">Todas las Sucursales</option>
                <option value="1">Sucursal Central Sucre</option>
                <option value="2">Sucursal Potosí</option>
                <option value="multisede">Multisede / Corporativo</option>
              </select>
            </div>

            <div>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              >
                <option value="todos">Todos los Estados</option>
                <option value="activos">Sólo Usuarios Activos</option>
                <option value="inactivos">Sólo Usuarios Inactivos</option>
              </select>
            </div>
          </div>

          {/* TABLA DE USUARIOS */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Usuario / Colaborador</th>
                  <th className="py-2.5 px-3">Rol Asignado</th>
                  <th className="py-2.5 px-3">Sucursal Asignada</th>
                  <th className="py-2.5 px-3">Régimen</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No se encontraron usuarios con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  usuariosFiltrados.map((u) => {
                    const rolInfo = roles.find((r) => r.id === u.idRol);

                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div>
                            <div className="font-semibold text-slate-900 text-xs">
                              {u.nombre}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              @{u.usuario} • {u.correo}
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                              rolInfo?.badgeColor || "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {rolInfo?.nombre || "Sin Rol"}
                          </span>
                        </td>

                        <td className="py-2.5 px-3">
                          {u.idSucursal === 1 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-sky-50 text-sky-800 border border-sky-200">
                              <MapPin size={11} />
                              Sucre (Central)
                            </span>
                          ) : u.idSucursal === 2 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              <MapPin size={11} />
                              Potosí
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                              <Building size={11} />
                              Multisede / Todas
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          {u.personalizado ? (
                            <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-medium">
                              Personalizado
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[11px]">
                              Estándar
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => handleToggleEstadoUsuario(u.id)}
                            className="cursor-pointer"
                            title="Haga clic para alternar estado"
                          >
                            <StatusBadge estado={u.activo ? "ACTIVO" : "INACTIVO"} />
                          </button>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAbrirEditar(u)}
                            className="gap-1.5 h-7 text-xs font-medium rounded hover:bg-slate-50 cursor-pointer"
                          >
                            <Sliders size={12} />
                            <span>Permisos</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 2: PLANTILLAS DE ROLES Y MATRIZ POR DEFECTO */}
      {tabActiva === "matriz" && (
        <div className="space-y-5">

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {roles.map((r) => {
              // Contar cuántos usuarios tienen este rol
              const countUsuarios = usuarios.filter((u) => u.idRol === r.id).length;

              return (
                <div
                  key={r.id}
                  className="bg-white rounded border border-slate-200 p-3.5 flex flex-col justify-between hover:border-slate-300 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${r.badgeColor}`}
                      >
                        {r.nombre}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {countUsuarios} {countUsuarios === 1 ? "usuario" : "usuarios"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {r.descripcion}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span>Módulos habilitados:</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {
                        Object.values(r.permisosPorDefecto).filter((mod) =>
                          Object.values(mod).some(Boolean)
                        ).length
                      }{" "}
                      de {MODULOS_SISTEMA.length}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* TABLA COMPARATIVA DE PERMISOS POR ROL */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1 flex items-center gap-1.5">
              <Lock size={15} className="text-[#1C96C5]" />
              <span>Matriz Comparativa de Permisos por Rol</span>
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Cada nuevo usuario asignado a un rol hereda automáticamente estos permisos. Los cambios son escalables sin necesidad de crear páginas independientes.
            </p>

            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3">Módulo</th>
                    {roles.map((r) => (
                      <th key={r.id} className="py-2 px-3 text-center">
                        {r.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MODULOS_SISTEMA.map((mod) => (
                    <tr key={mod.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-900">
                        {mod.nombre}
                      </td>
                      {roles.map((r) => {
                        const perm = r.permisosPorDefecto[mod.id] || {};
                        const tieneLectura = perm.ver;
                        const tieneEscritura = perm.crear || perm.editar;
                        const tieneAprobacion = perm.aprobar;

                        return (
                          <td key={r.id} className="py-2 px-3 text-center">
                            {tieneLectura ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <CheckCircle2 size={11} />
                                {tieneAprobacion ? "Total" : tieneEscritura ? "Edición" : "Lectura"}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-mono">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN DE PERMISOS POR USUARIO */}
      {usuarioEditar && (
        <ModalPermisosUsuario
          abierto={modalAbierto}
          onCerrar={() => {
            setModalAbierto(false);
            setUsuarioEditar(null);
          }}
          usuario={usuarioEditar}
          onGuardar={handleGuardarUsuario}
        />
      )}

      {/* MODAL DE REGISTRO DE NUEVO COLABORADOR */}
      <Dialog open={modalCrearAbierto} onOpenChange={setModalCrearAbierto}>
        <DialogContent className="max-w-xl rounded border border-slate-200 p-5">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users size={16} className="text-[#1C96C5]" />
              <span>Registrar Nuevo Colaborador</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCrearUsuario} className="space-y-3.5 pt-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nombre Completo *
                </label>
                <Input
                  required
                  placeholder="Ej. Juan Pérez López"
                  value={nuevoUsuario.nombre}
                  onChange={(e) =>
                    setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })
                  }
                  className="h-8 text-xs rounded"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nombre de Usuario *
                </label>
                <Input
                  required
                  placeholder="Ej. jperez"
                  value={nuevoUsuario.usuario}
                  onChange={(e) =>
                    setNuevoUsuario({ ...nuevoUsuario, usuario: e.target.value })
                  }
                  className="h-8 text-xs rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Cédula de Identidad (CI)
                </label>
                <Input
                  placeholder="Ej. 1029384"
                  value={nuevoUsuario.ci}
                  onChange={(e) =>
                    setNuevoUsuario({ ...nuevoUsuario, ci: e.target.value })
                  }
                  className="h-8 text-xs rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Teléfono / Celular
                </label>
                <Input
                  placeholder="Ej. 75012345"
                  value={nuevoUsuario.celular}
                  onChange={(e) =>
                    setNuevoUsuario({ ...nuevoUsuario, celular: e.target.value })
                  }
                  className="h-8 text-xs rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Contraseña Inicial
                </label>
                <Input
                  type="password"
                  placeholder="Blanquita123!"
                  value={nuevoUsuario.clave}
                  onChange={(e) =>
                    setNuevoUsuario({ ...nuevoUsuario, clave: e.target.value })
                  }
                  className="h-8 text-xs rounded"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Correo Electrónico
              </label>
              <Input
                type="email"
                placeholder="jperez@blanquita.bo"
                value={nuevoUsuario.correo}
                onChange={(e) =>
                  setNuevoUsuario({ ...nuevoUsuario, correo: e.target.value })
                }
                className="h-8 text-xs rounded"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Rol en el Sistema *
                </label>
                <select
                  value={nuevoUsuario.idRol}
                  onChange={(e) =>
                    setNuevoUsuario({
                      ...nuevoUsuario,
                      idRol: Number(e.target.value),
                    })
                  }
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <MapPin size={13} className="text-[#1C96C5]" />
                  Sucursal de Operación *
                </label>
                <select
                  value={nuevoUsuario.idSucursal}
                  onChange={(e) =>
                    setNuevoUsuario({
                      ...nuevoUsuario,
                      idSucursal:
                        e.target.value === "todas"
                          ? "todas"
                          : Number(e.target.value),
                    })
                  }
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                >
                  <option value={1}>Sucursal Central Sucre</option>
                  <option value={2}>Sucursal Potosí</option>
                  <option value="todas">
                    Multisede / General (Todas las Sedes)
                  </option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">
                Ámbito de Visibilidad y Operación:
              </p>
              <p>
                • Si asignas una sede fija (Sucre o Potosí), el colaborador sólo
                podrá operar y ver información de su respectiva sucursal sin selector de cambio.
              </p>
              <p>
                • Si seleccionas <strong>Multisede / General</strong>, el usuario podrá alternar
                entre sucursales y consultar reportes consolidados.
              </p>
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalCrearAbierto(false)}
                className="text-xs h-8 rounded"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creandoUsuario}
                size="sm"
                className="bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs h-8 font-semibold rounded gap-1.5 cursor-pointer border border-transparent shadow-none"
              >
                {creandoUsuario ? (
                  <span>Registrando...</span>
                ) : (
                  <>
                    <Plus size={13} />
                    <span>Guardar Colaborador</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
