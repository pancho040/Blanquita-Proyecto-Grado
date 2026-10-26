import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";

/**
 * Combobox reutilizable con filtro integrado en vivo.
 * @param {Array<{ value: string|number, label: string, sublabel?: string, badge?: string, icon?: any }>} options
 * @param {string|number} value
 * @param {Function} onChange
 * @param {string} placeholder
 * @param {string} searchPlaceholder
 * @param {boolean} disabled
 * @param {string} className
 */
export default function BuscadorSelect({
  options = [],
  value,
  onChange,
  placeholder = "Seleccionar opción...",
  searchPlaceholder = "Buscar...",
  disabled = false,
  className = ""
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const contenedorRef = useRef(null);
  const inputBusquedaRef = useRef(null);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    function handleClickAfuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    if (abierto) {
      document.addEventListener("mousedown", handleClickAfuera);
      // Auto-focus en el buscador al abrir
      setTimeout(() => {
        inputBusquedaRef.current?.focus();
      }, 50);
    }
    return () => document.removeEventListener("mousedown", handleClickAfuera);
  }, [abierto]);

  // Encontrar opción seleccionada
  const opcionSeleccionada = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(value));
  }, [options, value]);

  // Filtrado reactivo por texto
  const opcionesFiltradas = useMemo(() => {
    if (!busqueda.trim()) return options;
    const q = busqueda.toLowerCase().trim();
    return options.filter((opt) => {
      const matchLabel = opt.label?.toLowerCase().includes(q);
      const matchSublabel = opt.sublabel?.toLowerCase().includes(q);
      const matchBadge = opt.badge?.toLowerCase().includes(q);
      return matchLabel || matchSublabel || matchBadge;
    });
  }, [options, busqueda]);

  const seleccionar = (val) => {
    onChange(val);
    setAbierto(false);
    setBusqueda("");
  };

  return (
    <div ref={contenedorRef} className={`relative w-full ${className}`}>
      {/* Botón Trigger del Combobox */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto(!abierto)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-all ${
          disabled
            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
            : abierto
            ? "border-[#20A7DB] ring-2 ring-[#20A7DB]/20 bg-white shadow-xs"
            : "border-slate-300 hover:border-slate-400 bg-white text-slate-800 shadow-2xs"
        }`}
      >
        <div className="flex-1 truncate">
          {opcionSeleccionada ? (
            <div className="flex items-center gap-2 truncate">
              {opcionSeleccionada.icon && (
                <span className="text-[#20A7DB] shrink-0">{opcionSeleccionada.icon}</span>
              )}
              <span className="font-medium text-slate-900 truncate">{opcionSeleccionada.label}</span>
              {opcionSeleccionada.sublabel && (
                <span className="text-xs text-slate-500 truncate hidden sm:inline">
                  • {opcionSeleccionada.sublabel}
                </span>
              )}
              {opcionSeleccionada.badge && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-semibold shrink-0">
                  {opcionSeleccionada.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>

      {/* Popover flotante con Buscador y Lista de Opciones */}
      {abierto && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden animate-in fade-in-0 duration-75">
          {/* Input Buscador Integrado */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/60 relative">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
            <input
              ref={inputBusquedaRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-slate-200 bg-white focus:outline-none focus:border-[#20A7DB] focus:ring-1 focus:ring-[#20A7DB] placeholder:text-slate-400"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Lista de Resultados con Scroll */}
          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-50">
            {opcionesFiltradas.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 italic">
                No se encontraron opciones que coincidan
              </div>
            ) : (
              opcionesFiltradas.map((opt) => {
                const esActivo = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => seleccionar(opt.value)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs rounded-lg transition-colors ${
                      esActivo
                        ? "bg-sky-50 text-sky-900 font-semibold"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.icon && <span className="text-[#20A7DB] shrink-0">{opt.icon}</span>}
                      <div className="truncate">
                        <p className="truncate font-medium">{opt.label}</p>
                        {opt.sublabel && (
                          <p className="text-[11px] text-slate-400 font-normal truncate">{opt.sublabel}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {opt.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {opt.badge}
                        </span>
                      )}
                      {esActivo && <Check className="h-3.5 w-3.5 text-[#20A7DB]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}