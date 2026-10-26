import { defineMiddleware } from "astro/middleware";
import { resolverSesion, limpiarSesion } from "./lib/auth-server";

const PREFIJO_POR_ROL = {
  1: "/operador",
  2: "/encargado",
  3: "/gerente",
  4: "/contador",
  5: "/supervisor",
  6: "/repartidor"
};

const RUTA_POR_ROL = {
  1: "/operador/inicio",
  2: "/encargado/inicio",
  3: "/gerente/inicio",
  4: "/contador/inicio",
  5: "/supervisor/inicio",
  6: "/repartidor/inicio"
};

const RUTAS_PROTEGIDAS = ["/operador", "/encargado", "/gerente", "/contador", "/supervisor", "/repartidor", "/scan", "/admin"];
const RUTAS_SIN_PREFIJO_ROL = ["/scan", "/admin"];
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
      const rutaDestino = sesion.IsAdmin ? "/admin/inicio" : (RUTA_POR_ROL[sesion.IdRol] || "/");
      return context.redirect(rutaDestino);
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

  if (!omitePrefijoRol && !sesion.IsAdmin) {
    const prefijoPermitido = PREFIJO_POR_ROL[sesion.IdRol];
    const esGerenteEnContador = sesion.IdRol === 3 && pathname.startsWith("/contador");
    if (!esGerenteEnContador && (!prefijoPermitido || !pathname.startsWith(prefijoPermitido))) {
      return context.redirect(RUTA_POR_ROL[sesion.IdRol] || "/");
    }
  }

  context.locals.usuario = sesion;

  return next();
});
