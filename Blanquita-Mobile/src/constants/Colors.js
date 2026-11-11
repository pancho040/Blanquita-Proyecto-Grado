// Paleta de Colores Institucional - Blanquita Choferes
// Alineado estrictamente con DESIGN.md y verificado contra WCAG 2.1 AA (contraste mínimo 4.5:1 texto, 3:1 bordes)

export const Colors = {
  // Acentos Corporativos Blanquita (DESIGN.md)
  // Nota: #1C96C5 (3.38:1) se reserva para fondos de componentes gráficos y bordes activos;
  // para texto interactivo y lectura en pantalla se utiliza primaryText (#0E6E92, 5.73:1) y primaryDark (#157A9E, 4.87:1).
  primary: "#1C96C5",       // Azul Primario Blanquita (Marca / Superficies grandes)
  primaryDark: "#157A9E",   // Azul Primario Activo (4.87:1 sobre blanco - Pasa WCAG AA)
  primaryText: "#0E6E92",   // Azul para texto y enlaces (5.73:1 sobre blanco - Pasa WCAG AA)
  primaryLight: "#F0F9FF",  // Fondo sutil info/marca
  primaryMuted: "rgba(28, 150, 197, 0.12)",

  // Secundarios y Acentos Operativos
  secondary: "#0F172A",     // Slate 900 (17.85:1 - Pasa WCAG AAA)
  accent: "#B45309",        // Ámbar industrial (5.02:1 - Pasa WCAG AA)
  success: "#15803D",       // Verde éxito (5.02:1 - Pasa WCAG AA)
  successLight: "#F0FDF4",
  successBorder: "#86EFAC",
  warning: "#B45309",       // Advertencia ámbar (5.02:1 - Pasa WCAG AA)
  warningLight: "#FFFBEB",
  warningBorder: "#FDE68A",
  danger: "#B91C1C",        // Rojo peligro/error (6.47:1 - Pasa WCAG AA)
  dangerLight: "#FEF2F2",
  dangerBorder: "#FCA5A5",
  info: "#0369A1",          // Azul info (5.93:1 - Pasa WCAG AA)
  infoLight: "#F0F9FF",
  infoBorder: "#BAE6FD",

  // Fondos y Superficies (DESIGN.md - Sin sombras, mate)
  background: "#F8FAFC",    // Fondo aplicación mate (Slate 50)
  backgroundDark: "#F1F5F9",// Fondo sutil (Slate 100)
  surface: "#FFFFFF",       // Superficie pura
  card: "#FFFFFF",          // Tarjeta sin sombras
  border: "#CBD5E1",        // Borde estándar 1px sólido (Slate 300)
  borderStrong: "#64748B",  // Borde activo/enfocado (Slate 500, 4.76:1 - Pasa WCAG AA)
  borderFocus: "#157A9E",

  // Tipografía de Alta Legibilidad
  text: "#0F172A",          // Texto Principal (Slate 900, 17.85:1 - Pasa WCAG AAA)
  textPrimary: "#0F172A",
  textSecondary: "#334155", // Texto Secundario (Slate 700, 10.35:1 - Pasa WCAG AAA)
  textMuted: "#475569",     // Metadatos (Slate 600, 7.58:1 - Pasa WCAG AAA)
  textLight: "#FFFFFF",

  // Estados Logísticos Operativos
  estadoPendiente: "#B45309",  // 5.02:1 - Pasa WCAG AA
  estadoEntregado: "#15803D",  // 5.02:1 - Pasa WCAG AA
  estadoNoEntregado: "#B91C1C",// 6.47:1 - Pasa WCAG AA
  estadoEnCamino: "#0E6E92",   // 5.73:1 - Pasa WCAG AA
  estadoOffline: "#475569",    // 7.58:1 - Pasa WCAG AA
  estadoOnline: "#15803D",     // 5.02:1 - Pasa WCAG AA
};

export const COLORS = Colors;
export default Colors;
