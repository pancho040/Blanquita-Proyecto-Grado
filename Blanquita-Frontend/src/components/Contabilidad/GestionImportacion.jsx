import React, { useState } from "react";
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Database,
  Layers,
  Truck,
  HandCoins,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ImportarFlujoCaja,
  ImportarNotasVenta,
  ImportarCuentasCobrar,
  ImportarProveedores,
  ImportarTodasLasTablas,
} from "@/services/Contabilidad/importacionService";

const ARCHIVOS_EXCEL = [
  {
    id: "flujo",
    titulo: "Flujo de Caja y Libro Diario",
    archivo: "Flujo de Caja - Blanquita 2026.xlsx",
    descripcion: "158 asientos de libro diario, arqueos de cortes por denominación y 30+ categorías contables.",
    icono: Wallet,
    color: "from-blue-500 to-cyan-600",
    fn: ImportarFlujoCaja,
  },
  {
    id: "notas",
    titulo: "Control Notas de Venta",
    archivo: "Control Notas de Venta - Blanquita 2026.xlsx",
    descripcion: "47 despachos en camión, choferes, placas, fletes y desglose de Mega, Lux, Servilleta.",
    icono: Truck,
    color: "from-emerald-500 to-teal-600",
    fn: ImportarNotasVenta,
  },
  {
    id: "cxc",
    titulo: "Cuentas por Cobrar y Abonos",
    archivo: "CUENTAS POR COBRAR.xlsx",
    descripcion: "38 clientes departamentales, 315 cuentas por cobrar y 427 abonos bancarios en BOB y USD.",
    icono: HandCoins,
    color: "from-amber-500 to-orange-600",
    fn: ImportarCuentasCobrar,
  },
  {
    id: "cxp",
    titulo: "Cuentas Proveedores e Insumos",
    archivo: "CUENTAS PROVEEDOR 2026.xlsx",
    descripcion: "Proveedores industriales (Vinto, Derqui, Multiflex, Colmaflex, etc.), compras y pagos.",
    icono: Layers,
    color: "from-purple-500 to-indigo-600",
    fn: ImportarProveedores,
  },
];

export default function GestionImportacion({ usuario }) {
  const [procesandoId, setProcesandoId] = useState(null);
  const [procesandoTodo, setProcesandoTodo] = useState(false);
  const [resultados, setResultados] = useState({});

  const ejecutarImportacion = async (item) => {
    try {
      setProcesandoId(item.id);
      const res = await item.fn();
      setResultados((prev) => ({
        ...prev,
        [item.id]: { ok: true, data: res, fecha: new Date() },
      }));
      toast.success(`¡${item.titulo} importado correctamente!`);
    } catch (err) {
      setResultados((prev) => ({
        ...prev,
        [item.id]: { ok: false, error: err.message, fecha: new Date() },
      }));
      toast.error(`Error al importar ${item.titulo}: ${err.message}`);
    } finally {
      setProcesandoId(null);
    }
  };

  const ejecutarTodo = async () => {
    try {
      setProcesandoTodo(true);
      const res = await ImportarTodasLasTablas();
      setResultados({
        todas: { ok: true, data: res, fecha: new Date() },
      });
      toast.success("¡Sincronización completa de todos los Excels finalizada con éxito!");
    } catch (err) {
      toast.error("Error en sincronización general: " + err.message);
    } finally {
      setProcesandoTodo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2.5">
            <FileSpreadsheet className="h-7 w-7 text-[#20A7DB]" />
            Importación y Sincronización de Archivos Excel
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Procesamiento de los archivos contables de la empresa situados en la carpeta empresarial.
          </p>
        </div>

        <Button
          onClick={ejecutarTodo}
          disabled={procesandoTodo || procesandoId !== null}
          className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-xs"
        >
          {procesandoTodo ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Sincronizando Todo...
            </>
          ) : (
            <>
              <UploadCloud className="h-4 w-4" />
              Sincronizar Todos los Excels
            </>
          )}
        </Button>
      </div>

      {/* Grid de Archivos Excel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {ARCHIVOS_EXCEL.map((item) => {
          const Icono = item.icono;
          const estaProcesando = procesandoId === item.id || procesandoTodo;
          const resultado = resultados[item.id];

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between transition-all hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${item.color} text-white shadow-xs`}>
                      <Icono className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-800">{item.titulo}</h3>
                      <span className="font-mono text-xs text-slate-400">{item.archivo}</span>
                    </div>
                  </div>

                  {resultado && (
                    <Badge
                      className={
                        resultado.ok
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-rose-100 text-rose-800 border-rose-300"
                      }
                    >
                      {resultado.ok ? "Sincronizado" : "Error"}
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-slate-500 mt-4 leading-relaxed">{item.descripcion}</p>

                {/* Resultado si existe */}
                {resultado && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 font-mono">
                    {resultado.ok ? (
                      <div className="text-emerald-700 flex items-center gap-1.5 font-sans font-semibold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>{resultado.data.mensaje || "Datos importados a Supabase correctamente"}</span>
                      </div>
                    ) : (
                      <div className="text-rose-700 flex items-center gap-1.5 font-sans font-semibold">
                        <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                        <span>{resultado.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {resultado ? `Último: ${resultado.fecha.toLocaleTimeString()}` : "Listo para importar"}
                </span>

                <Button
                  size="sm"
                  onClick={() => ejecutarImportacion(item)}
                  disabled={estaProcesando}
                  className="bg-[#20A7DB] hover:bg-[#1992c0] text-white flex items-center gap-1.5 text-xs shadow-xs"
                >
                  {estaProcesando ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-3.5 w-3.5" />
                      Importar Archivo
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tarjeta Informativa de Arquitectura */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-start gap-3.5 text-xs text-slate-600">
        <Database className="h-5 w-5 text-[#20A7DB] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-slate-800 text-sm">Integridad y Compatibilidad Asegurada</div>
          <p>
            El importador ejecuta la lectura nativa con `openpyxl` en el backend, normalizando los nombres de clientes,
            números de notas de venta correlativas, asignaciones bancarias y manteniendo la inmutabilidad de los datos
            existentes de inventario y producción de la planta.
          </p>
        </div>
      </div>
    </div>
  );
}
