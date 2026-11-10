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
    <div className="space-y-6">

      {/* ENCABEZADO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Gestión de Usuarios y Roles
          </h1>
        </div>

        {/* ACCIONES Y PESTAÑAS */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {tabActiva === "usuarios" && (
            <Button
              onClick={() => setModalCrearAbierto(true)}
              className="bg-[#20A7DB] hover:bg-[#188cba] text-white text-xs gap-1.5 h-9 font-semibold shadow-xs"
            >
              <Plus size={15} />
              <span>Nuevo Colaborador</span>
            </Button>
          )}

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setTabActiva("usuarios")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                tabActiva === "usuarios"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Usuarios ({usuarios.length})
            </button>
            <button
              type="button"
              onClick={() => setTabActiva("matriz")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                tabActiva === "matriz"
                  ? "bg-white text-slate-900 shadow-xs"
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
        <div className="space-y-4">
          {/* BARRA DE FILTROS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, usuario o email..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#20A7DB]"
              />
            </div>

            <div>
              <select
                value={filtroRol}
                onChange={(e) => setFiltroRol(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#20A7DB]"
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
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#20A7DB]"
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
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#20A7DB]"
              >
                <option value="todos">Todos los Estados</option>
                <option value="activos">Sólo Usuarios Activos</option>
                <option value="inactivos">Sólo Usuarios Inactivos</option>
              </select>
            </div>
          </div>

          {/* TABLA DE USUARIOS */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Usuario / Colaborador</th>
                  <th className="py-3 px-4">Rol Asignado</th>
                  <th className="py-3 px-4">Sucursal Asignada</th>
                  <th className="py-3 px-4">Régimen</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
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
                    const iniciales = u.nombre
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("");

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">
                              {u.nombre}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              @{u.usuario} • {u.correo}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              rolInfo?.badgeColor || "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {rolInfo?.nombre || "Sin Rol"}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {u.idSucursal === 1 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                              <MapPin size={11} />
                              Sucre (Central)
                            </span>
                          ) : u.idSucursal === 2 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <MapPin size={11} />
                              Potosí
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              <Building size={11} />
                              Multisede / Todas
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {u.personalizado ? (
                            <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-medium">
                              Personalizado
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">
                              Estándar
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleEstadoUsuario(u.id)}
                            className="cursor-pointer"
                            title="Haga clic para alternar estado"
                          >
                            {u.activo ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                Activo
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-50 text-rose-700 border-rose-200">
                                Inactivo
                              </Badge>
                            )}
                          </button>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAbrirEditar(u)}
                            className="gap-1.5 h-8 text-xs font-semibold hover:border-[#20A7DB] hover:text-[#20A7DB]"
                          >
                            <Sliders size={13} />
                            Configurar Permisos
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
        <div className="space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((r) => {
              // Contar cuántos usuarios tienen este rol
              const countUsuarios = usuarios.filter((u) => u.idRol === r.id).length;

              return (
                <div
                  key={r.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${r.badgeColor}`}
                      >
                        {r.nombre}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {countUsuarios} {countUsuarios === 1 ? "usuario" : "usuarios"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      {r.descripcion}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>Módulos habilitados:</span>
                    <span className="font-bold text-slate-800">
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
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
              <Lock size={16} className="text-[#20A7DB]" />
              Matriz Comparativa de Permisos por Rol
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Cada nuevo usuario asignado a un rol hereda automáticamente estos permisos. Los cambios son escalables sin necesidad de crear páginas independientes.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Módulo</th>
                    {roles.map((r) => (
                      <th key={r.id} className="py-2.5 px-3 text-center font-semibold">
                        {r.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MODULOS_SISTEMA.map((mod) => (
                    <tr key={mod.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {mod.nombre}
                      </td>
                      {roles.map((r) => {
                        const perm = r.permisosPorDefecto[mod.id] || {};
                        const tieneLectura = perm.ver;
                        const tieneEscritura = perm.crear || perm.editar;
                        const tieneAprobacion = perm.aprobar;

                        return (
                          <td key={r.id} className="py-2.5 px-3 text-center">
                            {tieneLectura ? (
                              <div className="inline-flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  <CheckCircle2 size={12} />
                                  {tieneAprobacion ? "Total" : tieneEscritura ? "Edición" : "Lectura"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-300 font-bold">—</span>
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users size={18} className="text-[#20A7DB]" />
              Registrar Nuevo Colaborador
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCrearUsuario} className="space-y-4 pt-2 text-xs">
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
                  className="h-9 text-xs"
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
                  className="h-9 text-xs"
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
                  className="h-9 text-xs"
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
                  className="h-9 text-xs"
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
                  className="h-9 text-xs"
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
                className="h-9 text-xs"
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
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#20A7DB]"
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
                  <MapPin size={13} className="text-[#20A7DB]" />
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
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#20A7DB]"
                >
                  <option value={1}>Sucursal Central Sucre</option>
                  <option value={2}>Sucursal Potosí</option>
                  <option value="todas">
                    Multisede / General (Todas las Sedes)
                  </option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1">
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

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalCrearAbierto(false)}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creandoUsuario}
                className="bg-[#20A7DB] hover:bg-[#188cba] text-white text-xs h-9 font-semibold gap-1.5"
              >
                {creandoUsuario ? (
                  <span>Registrando...</span>
                ) : (
                  <>
                    <Plus size={14} />
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
