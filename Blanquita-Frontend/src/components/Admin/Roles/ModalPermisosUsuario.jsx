import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ROLES_CONFIG,
  MODULOS_SISTEMA,
  ACCIONES_PERMISO,
} from "@/constants/RolesPermisos";
import {
  ShieldCheck,
  User,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

export default function ModalPermisosUsuario({
  abierto,
  onCerrar,
  usuario,
  onGuardar,
}) {
  if (!abierto || !usuario) return null;
  const [rolSeleccionado, setRolSeleccionado] = useState(3);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState(null);
  const [personalizado, setPersonalizado] = useState(false);
  const [permisos, setPermisos] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (usuario) {
      setRolSeleccionado(usuario.idRol || 3);
      setSucursalSeleccionada(usuario.idSucursal !== undefined ? usuario.idSucursal : null);
      setPersonalizado(Boolean(usuario.personalizado));

      if (usuario.personalizado && usuario.permisosPersonalizados) {
        setPermisos(JSON.parse(JSON.stringify(usuario.permisosPersonalizados)));
      } else {
        const rolCfg = ROLES_CONFIG.find((r) => r.id === (usuario.idRol || 3));
        if (rolCfg) {
          setPermisos(JSON.parse(JSON.stringify(rolCfg.permisosPorDefecto)));
        }
      }
    }
  }, [usuario, abierto]);

  // Al cambiar de rol en el select
  const handleCambiarRol = (nuevoRolId) => {
    setRolSeleccionado(nuevoRolId);
    if (!personalizado) {
      const rolCfg = ROLES_CONFIG.find((r) => r.id === nuevoRolId);
      if (rolCfg) {
        setPermisos(JSON.parse(JSON.stringify(rolCfg.permisosPorDefecto)));
      }
    }
  };

  const handleTogglePersonalizado = (e) => {
    const val = e.target.checked;
    setPersonalizado(val);
    if (!val) {
      // Revertir a los del rol
      const rolCfg = ROLES_CONFIG.find((r) => r.id === rolSeleccionado);
      if (rolCfg) {
        setPermisos(JSON.parse(JSON.stringify(rolCfg.permisosPorDefecto)));
      }
    }
  };

  const handleToggleAccion = (moduloId, accionId) => {
    if (!personalizado) return;
    setPermisos((prev) => {
      const actualModulo = prev[moduloId] || {};
      return {
        ...prev,
        [moduloId]: {
          ...actualModulo,
          [accionId]: !actualModulo[accionId],
        },
      };
    });
  };

  const handleRestablecerDefecto = () => {
    const rolCfg = ROLES_CONFIG.find((r) => r.id === rolSeleccionado);
    if (rolCfg) {
      setPermisos(JSON.parse(JSON.stringify(rolCfg.permisosPorDefecto)));
      setPersonalizado(false);
      toast.info("Se han restaurado los permisos por defecto del rol.");
    }
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      const datosActualizados = {
        ...usuario,
        idRol: rolSeleccionado,
        idSucursal: sucursalSeleccionada,
        personalizado,
        permisosPersonalizados: personalizado ? permisos : null,
      };

      // Si existe el usuario en la base de datos, sincronizar sucursal y permisos territoriales
      if (usuario.id) {
        try {
          const esTodas = sucursalSeleccionada === null || sucursalSeleccionada === "todas";
          const params = new URLSearchParams();
          if (!esTodas && sucursalSeleccionada) {
            params.append("id_sucursal", sucursalSeleccionada);
            params.append("puede_ver_todas", "false");
          } else {
            params.append("puede_ver_todas", "true");
          }
          const res = await fetch(`/api/Usuario/${usuario.id}/sucursal?${params.toString()}`, { method: "PUT" });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            toast.error(err.detail || "No se pudo actualizar el alcance territorial en el servidor");
          }
        } catch {
          /* Fallback local */
        }
      }

      await onGuardar(datosActualizados);
      toast.success("Rol y sucursal de operación actualizados con éxito", {
        description: `Usuario: ${usuario.nombre}`,
      });
      onCerrar();
    } catch {
      toast.error("Error al guardar permisos del usuario");
    } finally {
      setGuardando(false);
    }
  };

  if (!usuario) return null;

  const rolActualCfg = ROLES_CONFIG.find((r) => r.id === rolSeleccionado);

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-xl max-h-[85vh] overflow-y-auto p-5 rounded border border-slate-200">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded border border-sky-200 bg-sky-50 text-[#1C96C5] flex items-center justify-center font-bold">
                <ShieldCheck size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Rol y Permisos
                </DialogTitle>
                <p className="text-xs text-slate-500">
                  <strong className="text-slate-800 font-semibold">{usuario.nombre}</strong> (@{usuario.usuario})
                </p>
              </div>
            </div>
            {personalizado ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200 bg-amber-50 text-amber-800">
                Personalizado
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-200 bg-emerald-50 text-emerald-800">
                Estándar
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* SELECCIÓN DE ROL Y SUCURSAL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded bg-slate-50 border border-slate-200">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Rol Asignado al Usuario
              </label>
              <select
                value={rolSeleccionado}
                onChange={(e) => handleCambiarRol(Number(e.target.value))}
                className="w-full h-8 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              >
                {ROLES_CONFIG.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                {rolActualCfg?.descripcion}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Sucursal de Operación Asignada
              </label>
              <select
                value={sucursalSeleccionada === null || sucursalSeleccionada === "todas" ? "todas" : String(sucursalSeleccionada)}
                onChange={(e) => setSucursalSeleccionada(e.target.value === "todas" ? null : Number(e.target.value))}
                className="w-full h-8 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              >
                <option value="todas">Multisede / General (Todas las Sedes)</option>
                <option value="1">Sucursal Central Sucre</option>
                <option value="2">Sucursal Potosí</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                {sucursalSeleccionada === null || sucursalSeleccionada === "todas"
                  ? "Acceso global; conmutador en barra superior disponible."
                  : `Operará exclusivamente con datos de ${sucursalSeleccionada === 2 ? "Potosí" : "Sucre"}.`}
              </p>
            </div>

            <div className="md:col-span-2 pt-2 border-t border-slate-200 flex flex-col justify-center">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Modo de Permisos
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chkPersonalizado"
                  checked={personalizado}
                  onChange={handleTogglePersonalizado}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <label
                  htmlFor="chkPersonalizado"
                  className="text-xs font-medium text-slate-700 cursor-pointer select-none"
                >
                  Personalizar excepciones para este usuario (anular rol por defecto)
                </label>
              </div>
              {personalizado && (
                <button
                  type="button"
                  onClick={handleRestablecerDefecto}
                  className="mt-1.5 text-[11px] text-[#1C96C5] hover:text-[#157A9E] flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>Restablecer a los permisos por defecto de {rolActualCfg?.nombre}</span>
                </button>
              )}
            </div>
          </div>

          {/* MATRIZ DE PERMISOS POR MÓDULO */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sliders size={13} className="text-[#1C96C5]" />
                <span>Matriz de Accesos por Módulo</span>
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">
                {personalizado ? "Edición manual habilitada" : "Heredados del rol"}
              </span>
            </div>

            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3">Módulo del Sistema</th>
                    {ACCIONES_PERMISO.map((act) => (
                      <th key={act.id} className="py-2 px-2 text-center">
                        {act.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {MODULOS_SISTEMA.map((mod) => (
                    <tr key={mod.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900">{mod.nombre}</div>
                        <div className="text-[11px] text-slate-500">{mod.descripcion}</div>
                      </td>
                      {ACCIONES_PERMISO.map((act) => {
                        const tienePermiso = Boolean(permisos[mod.id]?.[act.id]);

                        return (
                          <td key={act.id} className="py-2 px-2 text-center">
                            <button
                              type="button"
                              disabled={!personalizado}
                              onClick={() => handleToggleAccion(mod.id, act.id)}
                              className={`h-6 w-6 rounded inline-flex items-center justify-center transition-colors border ${
                                tienePermiso
                                  ? "bg-emerald-700 text-white border-emerald-800"
                                  : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                              } ${
                                !personalizado
                                  ? "cursor-default opacity-85"
                                  : "cursor-pointer"
                              }`}
                              title={`${act.label} en ${mod.nombre}: ${
                                tienePermiso ? "Habilitado" : "Denegado"
                              }`}
                            >
                              {tienePermiso ? (
                                <CheckCircle2 size={13} strokeWidth={2.5} />
                              ) : (
                                <span className="text-[10px] font-mono text-slate-400">—</span>
                              )}
                            </button>
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

        <DialogFooter className="gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onCerrar} className="h-8 text-xs rounded">
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={guardando}
            size="sm"
            onClick={handleGuardar}
            className="bg-[#1C96C5] hover:bg-[#157A9E] text-white gap-1.5 h-8 text-xs font-semibold rounded cursor-pointer border border-transparent shadow-none"
          >
            <Save size={14} />
            <span>{guardando ? "Guardando..." : "Guardar Permisos"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
