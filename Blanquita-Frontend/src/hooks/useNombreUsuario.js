import { useEffect, useState } from "react";
import { obtenerPerfil } from "@/services/Usuario/Perfil";

export function useNombreUsuario() {
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    obtenerPerfil()
      .then((perfil) => setNombre(`${perfil.PrimerNombre} ${perfil.ApellidoPaterno}`))
      .catch(() => setNombre(""));
  }, []);

  return nombre;
}
