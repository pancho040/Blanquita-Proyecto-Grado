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
import StatusBadge from "@/components/common/StatusBadge";
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
    titulo: "Flujo de Caja",
    archivo: "Flujo de Caja y Caja Chica 2025-2026.xlsx",
    descripcion: "Asientos de libro diario, arqueos de caja y categorías contables.",
    icono: Wallet,
    fn: ImportarFlujoCaja,
  },
  {
    id: "notas",
    titulo: "Notas de Venta",
    archivo: "5_CONTROL NOTAS DE VENTA.xlsx",
    descripcion: "Despachos en camión, choferes, fletes y paquetes entregados.",
    icono: Truck,
    fn: ImportarNotasVenta,
  },
  {
    id: "cxc",
    titulo: "Cuentas por Cobrar",
    archivo: "3_CUENTAS POR COBRAR.xlsx",
    descripcion: "Cartera de clientes, deudas vigentes y abonos bancarios.",
    icono: HandCoins,
    fn: ImportarCuentasCobrar,
  },
  {
    id: "cxp",
    titulo: "Cuentas por Pagar",
    archivo: "CUENTAS PROVEEDOR.xlsx",
    descripcion: "Proveedores industriales, insumos y pagos realizados.",
    icono: Layers,
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
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded border border-slate-200">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[#1C96C5]" />
            Importación y Sincronización de Archivos
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Sincronización de libros contables, notas de venta y cuentas desde planillas oficiales (.xlsx)
          </p>
        </div>

        <Button
          onClick={ejecutarTodo}
          disabled={procesandoTodo || procesandoId !== null}
          className="bg-[#15803D] hover:bg-green-800 text-white flex items-center gap-1.5 h-8 px-3 rounded text-xs font-medium border-0"
        >
          {procesandoTodo ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <UploadCloud className="h-3.5 w-3.5" />
              Sincronizar Todos
            </>
          )}
        </Button>
      </div>

      {/* Grid de Archivos Excel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ARCHIVOS_EXCEL.map((item) => {
          const Icono = item.icono;
          const estaProcesando = procesandoId === item.id || procesandoTodo;
          const resultado = resultados[item.id];

          return (
            <div
              key={item.id}
              className="bg-white rounded border border-slate-200 p-4 flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-slate-50 text-slate-700 border border-slate-200">
                      <Icono className="h-4 w-4 text-[#1C96C5]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{item.titulo}</h3>
                      <span className="text-[11px] font-mono text-slate-500">{item.archivo}</span>
                    </div>
                  </div>

                  {resultado && (
                    <StatusBadge
                      estado={resultado.ok ? "APROBADO" : "RECHAZADO"}
                      label={resultado.ok ? "Sincronizado" : "Error"}
                    />
                  )}
                </div>

                <p className="text-xs text-slate-600 mt-3 leading-relaxed">{item.descripcion}</p>

                {/* Resultado si existe */}
                {resultado && (
                  <div className="mt-3 p-2.5 bg-slate-50 rounded border border-slate-200 text-xs text-slate-700">
                    {resultado.ok ? (
                      <div className="text-[#15803D] flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#15803D] shrink-0" />
                        <span>{resultado.data?.mensaje || "Datos importados a la base de datos correctamente"}</span>
                      </div>
                    ) : (
                      <div className="text-[#B91C1C] flex items-center gap-1.5 font-medium">
                        <AlertCircle className="h-3.5 w-3.5 text-[#B91C1C] shrink-0" />
                        <span>{resultado.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-500">
                  {resultado ? `Último: ${resultado.fecha.toLocaleTimeString()}` : "Listo para importar"}
                </span>

                <Button
                  size="sm"
                  onClick={() => ejecutarImportacion(item)}
                  disabled={estaProcesando}
                  className="bg-[#1C96C5] hover:bg-[#157A9E] text-white flex items-center gap-1.5 text-xs h-8 px-3 rounded font-medium border-0"
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
      <div className="bg-slate-50 border border-slate-200 rounded p-4 flex items-start gap-3 text-xs text-slate-600">
        <Database className="h-4 w-4 text-[#1C96C5] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-slate-900 text-xs">Integridad y Compatibilidad Asegurada</div>
          <p className="leading-relaxed">
            El importador ejecuta la lectura nativa con `openpyxl` en el backend, normalizando los nombres de clientes,
            números de notas de venta correlativas, asignaciones bancarias y manteniendo la inmutabilidad de los datos
            existentes de inventario y producción de la planta.
          </p>
        </div>
      </div>
    </div>
  );
}
