import { createContext, useContext, useState, useEffect } from "react";
import { AuthApi } from "../api/authApi";
import { SecureStorage } from "../services/secureStorage";
import { LocalDB } from "../database/localDb";
import { SyncQueue } from "../database/syncQueue";
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
        const tokenSeguro = await SecureStorage.obtenerToken();
        const refreshSeguro = await SecureStorage.obtenerRefreshToken();

        if (sesionGuardada && sesionGuardada.usuario) {
          setUsuario(sesionGuardada.usuario);
          setTokens({
            AccessToken: tokenSeguro || sesionGuardada.tokens?.AccessToken,
            RefreshToken: refreshSeguro || sesionGuardada.tokens?.RefreshToken,
          });
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
   * Si hay red: valida contra FastAPI /api/movil/v1/auth/login.
   * Si está offline: valida credenciales contra la última sesión local guardada.
   */
  const iniciarSesion = async (ci, clave) => {
    setErrorAuth(null);
    setCargando(true);

    try {
      if (isOnline) {
        // 1. Login centralizado con FastAPI
        const respLogin = await AuthApi.login(ci, clave);
        // respLogin: { access_token, refresh_token, token_type, expires_in, usuario }
        const tokenPayload = {
          AccessToken: respLogin.access_token,
          RefreshToken: respLogin.refresh_token,
        };

        const usuarioPerfil = {
          IdUsuario: respLogin.usuario.id_usuario,
          NombreCompleto: `${respLogin.usuario.nombre} ${respLogin.usuario.apellido}`.trim(),
          nombre: respLogin.usuario.nombre,
          apellido: respLogin.usuario.apellido,
          Ci: respLogin.usuario.ci,
          IdRol: respLogin.usuario.id_rol,
          RolNombre: respLogin.usuario.nombre_rol,
          SucursalesPermitidas: respLogin.usuario.sucursales_permitidas,
          PuedeVerTodas: respLogin.usuario.puede_ver_todas,
          SucursalDefecto: respLogin.usuario.sucursal_defecto,
        };

        // Guardar tokens de forma segura y encriptada
        await SecureStorage.guardarToken(respLogin.access_token);
        await SecureStorage.guardarRefreshToken(respLogin.refresh_token);

        // Guardar sesión en local para acceso offline (HU-27)
        await LocalDB.guardarSesion(usuarioPerfil, tokenPayload);

        setUsuario(usuarioPerfil);
        setTokens(tokenPayload);

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

  // Cerrar Sesión Seguro (Punto 6 - Protección de Dinero con Desglose y Excepción de 4xx)
  const cerrarSesion = async (forzar = false) => {
    try {
      const resumen = await SyncQueue.obtenerResumenDineroPendiente();

      // Si hay cobros/dinero reintentables pendientes y no se ha confirmado forzar:
      if (resumen.bloqueoRequerido && !forzar) {
        return {
          bloqueado: true,
          requiereConfirmacion: true,
          cantidad: resumen.cantidadReintentables,
          montoTotal: resumen.totalDineroBs,
          desgloseReintentables: resumen.reintentables,
          desgloseNoReintentables: resumen.noReintentables4xx,
          mensaje: `Tienes ${resumen.cantidadReintentables} cobro(s) con dinero por un total de Bs. ${resumen.totalDineroBs.toFixed(2)} sin sincronizar. Si cierras sesión ahora, podrían perderse. Por favor sincroniza primero o confirma explícitamente el cierre forzado.`,
        };
      }

      // Los errores 4xx no reintentables NO bloquean el logout
      await AuthApi.logout().catch(() => {});
      await SecureStorage.limpiarTokens();
      await LocalDB.eliminarSesion();
      await LocalDB.limpiarTodo();
      await SyncQueue.limpiarCola();
      setUsuario(null);
      setTokens(null);
      return {
        exito: true,
        advertencia4xx: resumen.cantidadNoReintentables4xx > 0
          ? `Se descartaron ${resumen.cantidadNoReintentables4xx} operaciones con error de validación 4xx.`
          : null,
      };
    } catch (e) {
      console.error("[AuthContext] Error al cerrar sesión:", e);
      return { exito: false, error: e.message };
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
