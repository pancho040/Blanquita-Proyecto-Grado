import { NotificacionesResponse } from "@/models/Notificacion/Notificacion";
import { pedirJson } from "@/utils/api";

export async function verNotificaciones() {
  const data = await pedirJson("/api/notificaciones/resumen");
  return NotificacionesResponse(data);
}
