import { createContext, useContext, useState, useEffect } from "react";
import { AuthApi } from "../api/authApi";
import { SecureStorage } from "../services/secureStorage";
import { LocalDB } from "../database/localDb";
import { SyncQueue } from "../database/syncQueue";
import { setSesionExpiradaListener, setTokenRenovadoListener, setTokenEnMemoria } from "../api/client";
import { useNetwork } from "./NetworkContext";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorAuth, setErrorAuth] = useState(null);
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const { isOnline } = useNetwork();

  // Escuchar eventos de sesión expirada y token renovado emitidos por client.js
  useEffect(() => {
    setSesionExpiradaListener(() => {
      console.log("[AuthContext] Sesión expirada detectada. Manteniendo datos locales y pausando sync.");
      setSesionExpirada(true);
    });
    setTokenRenovadoListener((nuevoAccessToken, nuevoRefreshToken) => {
      console.log("[AuthContext] Token renovado en background. Actualizando estado.");
      setTokens({
        AccessToken: nuevoAccessToken,
        RefreshToken: nuevoRefreshToken,
      });
      setSesionExpirada(false);
    });
    return () => {
      setSesionExpiradaListener(null);
      setTokenRenovadoListener(null);
    };
  }, []);

  // Cargar sesión persistida al iniciar la app
  useEffect(() => {
    async function restaurarSesion() {
      try {
        const sesionGuardada = await LocalDB.obtenerSesion();
        const tokenSeguro = await SecureStorage.obtenerToken();
        const refreshSeguro = await SecureStorage.obtenerRefreshToken();

        if (sesionGuardada && sesionGuardada.usuario) {
          const actToken = tokenSeguro || sesionGuardada.tokens?.AccessToken;
          setUsuario(sesionGuardada.usuario);
          setTokens({
            AccessToken: actToken,
            RefreshToken: refreshSeguro || sesionGuardada.tokens?.RefreshToken,
          });
          if (actToken) {
            setTokenEnMemoria(actToken);
          }
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
        setTokenEnMemoria(respLogin.access_token);
        await SecureStorage.guardarToken(respLogin.access_token);
        await SecureStorage.guardarRefreshToken(respLogin.refresh_token);

        // Guardar sesión en local para acceso offline (HU-27)
        await LocalDB.guardarSesion(usuarioPerfil, tokenPayload);

        setUsuario(usuarioPerfil);
        setTokens(tokenPayload);
        setSesionExpirada(false);

        return { exito: true, usuario: usuarioPerfil };
      } else {
        // 2. Login Offline (HU-27: CA-27.1 y CA-27.2)
        const sesionPrevia = await LocalDB.obtenerSesion();
        if (sesionPrevia && sesionPrevia.usuario && sesionPrevia.usuario.Ci === ci.trim()) {
          setUsuario(sesionPrevia.usuario);
          setTokens(sesionPrevia.tokens);
          setSesionExpirada(false);
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
  // Requisito Subagente B: La cola de operaciones está ligada al id del usuario y NO se borra al cerrar sesión.
  const cerrarSesion = async (forzar = false) => {
    try {
      const usuarioId = usuario?.IdUsuario;
      const resumen = await SyncQueue.obtenerResumenDineroPendiente(usuarioId);
      const pendientesTotales = await SyncQueue.contarPendientes(usuarioId);

      // Si hay cobros/dinero reintentables pendientes y no se ha confirmado forzar:
      if (resumen.bloqueoRequerido && !forzar) {
        return {
          bloqueado: true,
          requiereConfirmacion: true,
          cantidad: resumen.cantidadReintentables,
          montoTotal: resumen.totalDineroBs,
          desgloseReintentables: resumen.reintentables,
          desgloseNoReintentables: resumen.noReintentables4xx,
          mensaje: `Tienes ${resumen.cantidadReintentables} cobro(s) con dinero por un total de Bs. ${resumen.totalDineroBs.toFixed(2)} sin sincronizar (${pendientesTotales} operaciones en total). Si cierras sesión, quedarán guardadas en el teléfono y se enviarán al volver a iniciar sesión con tu cuenta.`,
        };
      }

      // Los errores 4xx no reintentables NO bloquean el logout
      setTokenEnMemoria(null);
      await AuthApi.logout().catch(() => {});
      await SecureStorage.limpiarTokens();
      await LocalDB.eliminarSesion();
      // NO se borra la cola de sincronización (está ligada al usuario y protegida offline)
      setUsuario(null);
      setTokens(null);
      setSesionExpirada(false);
      return {
        exito: true,
        pendientesPreservados: pendientesTotales,
        advertenciaPendientes: pendientesTotales > 0
          ? `Quedan ${pendientesTotales} operaciones guardadas en el teléfono, pendientes de enviar.`
          : null,
        advertencia4xx: resumen.cantidadNoReintentables4xx > 0
          ? `Hay ${resumen.cantidadNoReintentables4xx} operaciones con error de validación 4xx archivadas.`
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
        sesionExpirada,
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
