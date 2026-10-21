import { format } from "date-fns";
import { es } from "date-fns/locale";

export function dateFormatter(fechaUtc) {
    return new Intl.DateTimeFormat("es-BO", {
        timeZone: "America/La_Paz",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).format(new Date(fechaUtc));
}

export function dateOnlyFormatter(fecha) {
    return format(new Date(`${fecha}T00:00:00`), "d 'de' LLL, y", { locale: es });
}

export const aFechaISO = (fecha) => (fecha ? format(fecha, "yyyy-MM-dd") : null);

export const hoyISO = () => aFechaISO(new Date());

export function formatearDuracion(duracionIso) {
    if (!duracionIso) return "-";
    const coincidencia = duracionIso.match(
        /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:[\d.]+S)?$/,
    );
    if (!coincidencia) return "-";
    const dias = Number(coincidencia[1] || 0);
    const horas = Number(coincidencia[2] || 0) + dias * 24;
    const minutos = Number(coincidencia[3] || 0);
    return `${horas}h ${String(minutos).padStart(2, "0")}m`;
}

export function formatearSegundos(segundos) {
    const total = Math.max(Math.floor(Number(segundos) || 0), 0);
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    if (horas === 0) return `${minutos}m`;
    return `${horas}h ${String(minutos).padStart(2, "0")}m`;
}

export const segundosDesde = (fecha, ahora = Date.now()) =>
    fecha ? Math.max(Math.floor((ahora - new Date(fecha).getTime()) / 1000), 0) : 0;

export function diaSemanaCorto(fechaISO) {
    return format(new Date(`${fechaISO}T00:00:00`), "EEE d", { locale: es });
}
