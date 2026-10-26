export const prerender = false;

import { verificarAccessToken, guardarSesion, limpiarSesion } from "../../../lib/auth-server";
import { login } from "../../../services/Usuario/Auth";
import { SesionUsuario } from "../../../models/Usuario/Auth";

const RUTA_POR_ROL = {
  1: "/operador/inicio",
  2: "/encargado/inicio",
  3: "/gerente/inicio",
  4: "/contador/inicio",
  5: "/supervisor/inicio",
  6: "/repartidor/inicio"
};

function obtenerIpReal(request, clientAddress) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  try {
    return clientAddress ?? null;
  } catch {
    return null;
  }
}

export async function POST({ request, cookies, clientAddress }) {
  let Ci, Clave;

  try {
    ({ Ci, Clave } = await request.json());
  } catch {
    return new Response(
      JSON.stringify({ detail: "Cuerpo de la petición inválido" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!Ci || !Clave) {
    return new Response(
      JSON.stringify({ detail: "Ci y Clave son requeridos" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const ip = obtenerIpReal(request, clientAddress);
  const userAgent = request.headers.get("user-agent");

  let resultado;
  try {
    resultado = await login(Ci, Clave, ip, userAgent);
  } catch (error) {
    return new Response(
      JSON.stringify({ detail: error.message || "Error al iniciar sesión" }),
      { status: error.status || 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let payload;
  try {
    payload = await verificarAccessToken(resultado.AccessToken);
  } catch {
    limpiarSesion(cookies);
    return new Response(
      JSON.stringify({ detail: "Token recibido inválido" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const sesion = SesionUsuario(payload);

  if (!sesion.IdUsuario || !sesion.IdRol) {
    limpiarSesion(cookies);
    return new Response(
      JSON.stringify({ detail: "Usuario no habilitado para operar el sistema" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  guardarSesion(cookies, resultado);

  const rutaDestino = sesion.IsAdmin 
    ? "/admin/inicio" 
    : (RUTA_POR_ROL[sesion.IdRol] || "/");

  return new Response(
    JSON.stringify({
      ...sesion,
      rutaRedirect: rutaDestino
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
