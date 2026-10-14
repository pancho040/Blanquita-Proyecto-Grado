export const prerender = false;

import { obtenerAccessTokenValido, limpiarSesion, obtenerIpReal, obtenerUserAgent } from "../../../lib/auth-server";
import { logoutTodos } from "../../../services/Usuario/Auth";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

export async function POST(contexto) {
  const { cookies } = contexto;
  const accessToken = await obtenerAccessTokenValido(cookies);

  if (!accessToken) {
    limpiarSesion(cookies);
    return new Response(
      JSON.stringify({ detail: "No hay sesión activa" }),
      { status: 401, headers: HEADERS }
    );
  }

  try {
    const resultado = await logoutTodos(accessToken, obtenerIpReal(contexto), obtenerUserAgent(contexto));
    limpiarSesion(cookies);
    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: HEADERS }
    );
  } catch (error) {
    limpiarSesion(cookies);
    return new Response(
      JSON.stringify({ detail: error.message || "Error al cerrar sesión" }),
      { status: error.status || 500, headers: HEADERS }
    );
  }
}
