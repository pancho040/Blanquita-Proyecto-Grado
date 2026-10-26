export const prerender = false;

import { obtenerAccessTokenValido, limpiarSesion } from "../../lib/auth-server";

const BACKEND_URL = import.meta.env.BACKEND_URL;

export const ALL = async ({ request, params, cookies }) => {
  const accessToken = await obtenerAccessTokenValido(cookies);

  if (!accessToken) {
    limpiarSesion(cookies);
    return new Response(
      JSON.stringify({ detail: "No autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(request.url);
  const targetUrl = `${BACKEND_URL}/${params.path}${url.search}`;

  const headers = {
    Authorization: `Bearer ${accessToken}`
  };

  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  const init = {
    method: request.method,
    headers
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  const backendResponse = await fetch(targetUrl, init);
  const data = await backendResponse.text();

  return new Response(data, {
    status: backendResponse.status,
    headers: {
      "Content-Type": backendResponse.headers.get("content-type") || "application/json"
    }
  });
};