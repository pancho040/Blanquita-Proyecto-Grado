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
  const [personalizado, setPersonalizado] = useState(false);
  const [permisos, setPermisos] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (usuario) {
      setRolSeleccionado(usuario.idRol || 3);
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
      await onGuardar({
        ...usuario,
        idRol: rolSeleccionado,
        personalizado,
        permisosPersonalizados: personalizado ? permisos : null,
      });
      toast.success("Permisos y rol actualizados con éxito", {
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
      <DialogContent className="w-full sm:max-w-xl max-h-[85vh] overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-[#20A7DB]/15 text-[#20A7DB] flex items-center justify-center font-bold">
                <ShieldCheck size={20} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-800">
                  Rol y Permisos
                </DialogTitle>
                <p className="text-xs text-slate-500">
                  <strong className="text-slate-800 font-semibold">{usuario.nombre}</strong> ({usuario.usuario})
                </p>
              </div>
            </div>
            {personalizado ? (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[11px]">
                Personalizado
              </Badge>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px]">
                Estándar
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* SELECCIÓN DE ROL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Rol Asignado al Usuario
              </label>
              <select
                value={rolSeleccionado}
                onChange={(e) => handleCambiarRol(Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#20A7DB]"
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

            <div className="flex flex-col justify-center">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Modo de Permisos
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chkPersonalizado"
                  checked={personalizado}
                  onChange={handleTogglePersonalizado}
                  className="h-4 w-4 rounded border-slate-300 text-[#20A7DB] focus:ring-[#20A7DB] cursor-pointer"
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
                  className="mt-2 text-[11px] text-sky-600 hover:text-sky-800 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <RotateCcw size={12} />
                  Restablecer a los permisos por defecto de {rolActualCfg?.nombre}
                </button>
              )}
            </div>
          </div>

          {/* MATRIZ DE PERMISOS POR MÓDULO */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Sliders size={14} className="text-[#20A7DB]" />
                Matriz de Accesos por Módulo
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                {personalizado ? "Edición manual habilitada" : "Heredados del rol"}
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Módulo del Sistema</th>
                    {ACCIONES_PERMISO.map((act) => (
                      <th key={act.id} className="py-2.5 px-2 text-center font-semibold">
                        {act.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {MODULOS_SISTEMA.map((mod) => (
                    <tr key={mod.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-800">{mod.nombre}</div>
                        <div className="text-[11px] text-slate-500">{mod.descripcion}</div>
                      </td>
                      {ACCIONES_PERMISO.map((act) => {
                        const tienePermiso = Boolean(permisos[mod.id]?.[act.id]);

                        return (
                          <td key={act.id} className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              disabled={!personalizado}
                              onClick={() => handleToggleAccion(mod.id, act.id)}
                              className={`h-7 w-7 rounded-lg inline-flex items-center justify-center transition-all ${
                                tienePermiso
                                  ? "bg-emerald-500 text-white shadow-2xs hover:scale-105"
                                  : "bg-slate-100 text-slate-400 hover:bg-slate-200"
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
                                <CheckCircle2 size={15} />
                              ) : (
                                <span className="text-[11px] font-bold">—</span>
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
          <Button type="button" variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={guardando}
            onClick={handleGuardar}
            className="bg-[#20A7DB] hover:bg-[#188cba] text-white gap-2 font-semibold shadow-xs"
          >
            <Save size={16} />
            {guardando ? "Guardando..." : "Guardar Cambios de Permisos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
