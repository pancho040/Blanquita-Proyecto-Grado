import {
  LoginRequest,
  RefreshRequest,
  LoginResponse,
  RefreshResponse,
  LogoutResponse
} from "../../models/Usuario/Auth";
import { pedirJson } from "@/utils/api";

const BACKEND_URL = import.meta.env.BACKEND_URL;

function cabecerasCliente(ip, userAgent) {
  const headers = {};
  if (ip) headers["X-Forwarded-For"] = ip;
  if (userAgent) headers["X-Client-User-Agent"] = userAgent;
  return headers;
}

export async function login(ci, clave, ip, userAgent) {
  const headers = cabecerasCliente(ip, userAgent);

  const data = await pedirJson(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers,
    body: LoginRequest(ci, clave)
  });

  return LoginResponse(data);
}

export async function refresh(refreshTokenCrudo) {
  const data = await pedirJson(`${BACKEND_URL}/auth/refresh`, {
    method: "POST",
    body: RefreshRequest(refreshTokenCrudo)
  });

  return RefreshResponse(data);
}

export async function logout(accessToken, ip, userAgent) {
  const headers = cabecerasCliente(ip, userAgent);
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const data = await pedirJson(`${BACKEND_URL}/auth/logout`, {
    method: "POST",
    headers
  });

  return LogoutResponse(data);
}

export async function logoutTodos(accessToken, ip, userAgent) {
  const data = await pedirJson(`${BACKEND_URL}/auth/logout-todos`, {
    method: "POST",
    headers: { ...cabecerasCliente(ip, userAgent), Authorization: `Bearer ${accessToken}` }
  });

  return LogoutResponse(data);
}
