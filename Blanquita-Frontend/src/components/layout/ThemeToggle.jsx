import React from "react";
import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Botón estético de Modo Oscuro integrado en la barra institucional.
 * Por ahora permanece inerte con tema claro por defecto.
 */
export default function ThemeToggle() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Modo oscuro (Próximamente)"
      title="Modo oscuro (Próximamente)"
      className="relative h-9 w-9 rounded-xl border border-white/25 bg-white/15 hover:bg-white/25 text-white transition-colors cursor-default shadow-2xs"
    >
      <Moon className="h-[1.15rem] w-[1.15rem]" />
      <span className="sr-only">Modo oscuro (Próximamente)</span>
    </Button>
  );
}
