import { createRemoteJWKSet, jwtVerify } from "jose";
import { refresh } from "../services/Usuario/Auth";
import { SesionUsuario } from "../models/Usuario/Auth";

const SUPABASE_URL = import.meta.env.SUPABASE_URL.replace(/\/+$/, "");
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const AUDIENCE = "authenticated";
const ALGORITMOS = ["ES256"];

const JWKS = createRemoteJWKSet(
  new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

export const ACCESS_TOKEN_MAX_AGE_SEGUNDOS = 60 * 15; 
export const REFRESH_TOKEN_MAX_AGE_SEGUNDOS = 60 * 60 * 12;

const OPCIONES_COOKIE = {
  httpOnly: true,
  secure: import.meta.env.PROD,
  sameSite: "strict",
  path: "/"
};

const refrescosEnCurso = new Map();

export async function verificarAccessToken(token) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ALGORITMOS,
    clockTolerance: 60
  });

  return payload;
}

export function guardarSesion(cookies, { AccessToken, RefreshToken }) {
  cookies.set("token", AccessToken, {
    ...OPCIONES_COOKIE,
    maxAge: ACCESS_TOKEN_MAX_AGE_SEGUNDOS
  });

  if (RefreshToken) {
    cookies.set("refresh_token", RefreshToken, {
      ...OPCIONES_COOKIE,
      maxAge: REFRESH_TOKEN_MAX_AGE_SEGUNDOS
    });
  }
}

export function limpiarSesion(cookies) {
  cookies.delete("token", { path: "/" });
  cookies.delete("refresh_token", { path: "/" });
}

function refrescarDeduplicando(refreshTokenCrudo) {
  if (refrescosEnCurso.has(refreshTokenCrudo)) {
    return refrescosEnCurso.get(refreshTokenCrudo);
  }

  const promesa = refresh(refreshTokenCrudo).finally(() => {
    refrescosEnCurso.delete(refreshTokenCrudo);
  });

  refrescosEnCurso.set(refreshTokenCrudo, promesa);
  return promesa;
}

export async function obtenerAccessTokenValido(cookies) {
  const token = cookies.get("token")?.value;

  if (token) {
    try {
      await verificarAccessToken(token);
      return token;
    } catch {
    }
  }

  const refreshTokenCrudo = cookies.get("refresh_token")?.value;
  if (!refreshTokenCrudo) return null;

  try {
    const resultado = await refrescarDeduplicando(refreshTokenCrudo);
    guardarSesion(cookies, resultado);
    return resultado.AccessToken;
  } catch {
    return null;
  }
}

export async function resolverSesion(cookies) {
  const accessToken = await obtenerAccessTokenValido(cookies);
  if (!accessToken) return null;

  try {
    const payload = await verificarAccessToken(accessToken);
    const sesion = SesionUsuario(payload);
    if (!sesion.IdUsuario || !sesion.IdRol) return null;
    return sesion;
  } catch {
    return null;
  }
}