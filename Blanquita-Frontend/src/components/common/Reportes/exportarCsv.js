export const exportarAExcelCSV = (nombreArchivo, encabezados, filas) => {
  if (!filas || !filas.length) return;

  const headerKeys = Object.keys(encabezados);
  const headerLabels = Object.values(encabezados);

  let csvContent = "\uFEFF"; // BOM para compatibilidad con tildes en Excel
  csvContent += headerLabels.map((l) => `"${l.replace(/"/g, '""')}"`).join(",") + "\r\n";

  filas.forEach((fila) => {
    const rowValues = headerKeys.map((key) => {
      let val = fila[key];
      if (val === null || val === undefined) val = "";
      if (typeof val === "number") return val;
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvContent += rowValues.join(",") + "\r\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${nombreArchivo}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
