import fs from "fs";
import path from "path";

const components = [
  "src/components/Admin/DashboardGerencial.jsx",
  "src/components/Admin/Auditoria/GestionAuditoria.jsx",
  "src/components/Admin/Auditoria/CentroReportesAuditoria.jsx",
  "src/components/RRHH/InicioRRHH.jsx",
  "src/components/RRHH/Empleados/GestionEmpleados.jsx",
  "src/components/RRHH/Asistencia/ControlAsistencia.jsx",
  "src/components/RRHH/Turnos/CronogramaTurnos.jsx",
  "src/components/RRHH/GestionPersonalPlanillasDual.jsx",
  "src/components/RRHH/Reportes/CentroReportesRRHH.jsx",
  "src/components/Logistica/InicioSupervisor.jsx",
  "src/components/Logistica/Asignaciones/TablaAsignaciones.jsx",
  "src/components/Logistica/Rutas/GestorRutas.jsx",
  "src/components/Logistica/Rutas/RastreoChoferesGPS.jsx",
  "src/components/Logistica/Clientes/TablaClientes.jsx",
  "src/components/Logistica/Envios/GestionEnviosInventario.jsx",
  "src/components/Logistica/InventarioComercial/GestionInventarioComercial.jsx",
  "src/components/Logistica/Precios/TablaPrecios.jsx",
  "src/components/Logistica/Reportes/CentroReportesLogistica.jsx",
  "src/components/Contabilidad/InicioContador.jsx",
  "src/components/Contabilidad/GestionNotasVenta.jsx",
  "src/components/Contabilidad/GestionCuentasCobrar.jsx",
  "src/components/Contabilidad/GestionCaja.jsx",
  "src/components/Contabilidad/GestionCajaChicaOperativa.jsx",
  "src/components/Contabilidad/AprobacionCobrosQR.jsx",
  "src/components/Contabilidad/Reportes/CentroReportesContabilidad.jsx",
  "src/components/Gerencia/DashboardGerencialDonOsvaldo.jsx"
];

const basePath = "C:/Users/franz/Desktop/Blanquita/Blanquita-Proyecto-Grado/Blanquita-Frontend";
let ok = 0, missing = 0;
for (const rel of components) {
  const full = path.join(basePath, rel);
  if (!fs.existsSync(full)) {
    console.log("[NO EXISTE]", rel);
    missing++;
    continue;
  }
  const content = fs.readFileSync(full, "utf8");
  const hasImport = content.includes("PageHeader");
  const hasTag = content.includes("<PageHeader");
  if (hasImport && hasTag) {
    console.log("[OK PageHeader]", rel);
    ok++;
  } else {
    console.log("[FALTA PageHeader]", rel, { hasImport, hasTag });
    missing++;
  }
}
console.log(`\nResumen: ${ok} usan PageHeader, ${missing} faltantes de un total de ${components.length}`);
