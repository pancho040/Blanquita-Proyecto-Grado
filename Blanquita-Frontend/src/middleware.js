import { defineMiddleware } from "astro/middleware";
import { resolverSesion, limpiarSesion } from "./lib/auth-server";
import { PREFIJO_POR_ROL, RUTA_POR_ROL } from "./constants/Values";

const RUTAS_PROTEGIDAS = ["/operador", "/encargado", "/gerente", "/admin"];
const RUTAS_SIN_PREFIJO_ROL = ["/admin"];
const RUTAS_SOLO_ADMIN = ["/admin"];
const RUTAS_PUBLICAS_AUTH = ["/"];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const esRutaProtegida = RUTAS_PROTEGIDAS.some((prefijo) =>
    pathname.startsWith(prefijo)
  );
  const esRutaPublicaAuth = RUTAS_PUBLICAS_AUTH.includes(pathname);

  if (!esRutaProtegida && !esRutaPublicaAuth) {
    return next();
  }

  const sesion = await resolverSesion(context.cookies);

  if (esRutaPublicaAuth) {
    if (sesion) {
      return context.redirect(RUTA_POR_ROL[sesion.IdRol] || "/");
    }
    limpiarSesion(context.cookies);
    return next();
  }

  if (!sesion) {
    limpiarSesion(context.cookies);
    const destino = encodeURIComponent(pathname + context.url.search);
    return context.redirect(`/?redirigir=${destino}`);
  }

  const requiereAdmin = RUTAS_SOLO_ADMIN.some((prefijo) =>
    pathname.startsWith(prefijo)
  );

  if (requiereAdmin && !sesion.IsAdmin) {
    return context.redirect(RUTA_POR_ROL[sesion.IdRol] || "/");
  }

  const omitePrefijoRol = RUTAS_SIN_PREFIJO_ROL.some((prefijo) =>
    pathname.startsWith(prefijo)
  );

  if (!omitePrefijoRol) {
    const prefijo = PREFIJO_POR_ROL[sesion.IdRol];
    if (!prefijo || !pathname.startsWith(`/${prefijo}`)) {
      return context.redirect(RUTA_POR_ROL[sesion.IdRol] || "/");
    }
  }

  context.locals.usuario = sesion;

  return next();
});