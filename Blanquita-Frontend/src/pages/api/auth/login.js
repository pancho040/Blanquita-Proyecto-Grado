export const prerender = false;

import { verificarAccessToken, guardarSesion, limpiarSesion, obtenerIpReal, obtenerUserAgent } from "../../../lib/auth-server";
import { login } from "../../../services/Usuario/Auth";
import { SesionUsuario } from "../../../models/Usuario/Auth";
import { RUTA_POR_ROL } from "../../../constants/Values";

export async function POST(contexto) {
  const { request, cookies } = contexto;
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

  const ip = obtenerIpReal(contexto);
  const userAgent = obtenerUserAgent(contexto);

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

  return new Response(
    JSON.stringify({
      ...sesion,
      rutaRedirect: RUTA_POR_ROL[sesion.IdRol] || "/"
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}