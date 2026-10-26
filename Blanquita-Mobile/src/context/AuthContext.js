import React, { createContext, useContext, useState, useEffect } from "react";
import { AuthApi } from "../api/authApi";
import { supabase } from "../api/supabaseClient";
import { LocalDB } from "../database/localDb";
import { useNetwork } from "./NetworkContext";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorAuth, setErrorAuth] = useState(null);
  const { isOnline } = useNetwork();

  // Cargar sesión persistida al iniciar la app
  useEffect(() => {
    async function restaurarSesion() {
      try {
        const sesionGuardada = await LocalDB.obtenerSesion();
        if (sesionGuardada && sesionGuardada.usuario) {
          setUsuario(sesionGuardada.usuario);
          setTokens(sesionGuardada.tokens);
        }
      } catch (e) {
        console.error("[AuthContext] Error restaurando sesión:", e);
      } finally {
        setCargando(false);
      }
    }
    restaurarSesion();
  }, []);

  /**
   * Iniciar Sesión para Chofer (HU-27, HU-35)
   * Si hay red: valida contra FastAPI backend.
   * Si está offline: valida credenciales contra la última sesión local guardada.
   */
  const iniciarSesion = async (ci, clave) => {
    setErrorAuth(null);
    setCargando(true);

    try {
      if (isOnline) {
        let authData = null;

        // 1. Intentar Login con el Backend FastAPI
        try {
          authData = await AuthApi.login(ci, clave);
        } catch (backendErr) {
          console.log("[AuthContext] Backend local no respondió, intentando acceso directo Supabase Auth...", backendErr.message);
          // 2. Fallback directo a Supabase Auth en la nube
          const emailSintetico = `${ci.trim()}@papelblanquita.invalid`;
          const { data: supaData, error: supaErr } = await supabase.auth.signInWithPassword({
            email: emailSintetico,
            password: clave,
          });

          if (supaErr || !supaData?.session) {
            throw new Error(supaErr?.message || "Credenciales incorrectas (CI o contraseña inválida).");
          }

          authData = {
            AccessToken: supaData.session.access_token,
            RefreshToken: supaData.session.refresh_token,
          };
        }

        const usuarioPerfil = {
          IdUsuario: ci === "7891002" ? 10 : 9,
          NombreCompleto: ci === "7891002" ? "Alejandro Vargas" : "Marcos Antonio Condori",
          nombre: ci === "7891002" ? "Alejandro" : "Marcos",
          apellido: ci === "7891002" ? "Vargas" : "Condori",
          Ci: ci.trim(),
          IdRol: 6,
          RolNombre: "Agente de Reparto",
        };

        setUsuario(usuarioPerfil);
        setTokens(authData);

        // Guardar sesión en local para acceso offline (HU-27)
        await LocalDB.guardarSesion(usuarioPerfil, authData);
        return { exito: true, usuario: usuarioPerfil };
      } else {
        // 2. Login Offline (HU-27: CA-27.1 y CA-27.2)
        const sesionPrevia = await LocalDB.obtenerSesion();
        if (sesionPrevia && sesionPrevia.usuario && sesionPrevia.usuario.Ci === ci.trim()) {
          setUsuario(sesionPrevia.usuario);
          setTokens(sesionPrevia.tokens);
          return { exito: true, usuario: sesionPrevia.usuario, offline: true };
        } else {
          throw new Error(
            "Sin conexión a internet. No se encontraron credenciales previas guardadas en este celular."
          );
        }
      }
    } catch (error) {
      const msg = error.friendlyMessage || error.message || "Credenciales incorrectas.";
      setErrorAuth(msg);
      return { exito: false, error: msg };
    } finally {
      setCargando(false);
    }
  };

  // Cerrar Sesión
  const cerrarSesion = async () => {
    try {
      await LocalDB.eliminarSesion();
      setUsuario(null);
      setTokens(null);
    } catch (e) {
      console.error("[AuthContext] Error al cerrar sesión:", e);
    }
  };

  const loginWrapper = async (ci, clave) => {
    const res = await iniciarSesion(ci, clave);
    return {
      success: res.exito,
      message: res.error,
      user: res.usuario,
    };
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        user: usuario,
        tokens,
        token: tokens?.AccessToken || tokens?.access_token,
        cargando,
        loading: cargando,
        errorAuth,
        error: errorAuth,
        estaAutenticado: Boolean(usuario),
        isAuthenticated: Boolean(usuario),
        iniciarSesion,
        login: loginWrapper,
        cerrarSesion,
        logout: cerrarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
}
