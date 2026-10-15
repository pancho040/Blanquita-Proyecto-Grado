import { Q as defineMiddleware, c as sequence } from "./chunks/server_DUgAORLa.mjs";
import { n as limpiarSesion, o as resolverSesion } from "./chunks/auth-server_DhUxtndp.mjs";
import { a as RUTA_POR_ROL, i as PREFIJO_POR_ROL } from "./chunks/Values_BkpO45yz.mjs";
//#region src/middleware.js
var RUTAS_PROTEGIDAS = [
	"/operador",
	"/encargado",
	"/admin"
];
var RUTAS_SIN_PREFIJO_ROL = ["/admin"];
var RUTAS_SOLO_ADMIN = ["/admin"];
var RUTAS_PUBLICAS_AUTH = ["/"];
//#endregion
//#region \0virtual:astro:middleware
var onRequest = sequence(defineMiddleware(async (context, next) => {
	const { pathname } = context.url;
	const esRutaProtegida = RUTAS_PROTEGIDAS.some((prefijo) => pathname.startsWith(prefijo));
	const esRutaPublicaAuth = RUTAS_PUBLICAS_AUTH.includes(pathname);
	if (!esRutaProtegida && !esRutaPublicaAuth) return next();
	const sesion = await resolverSesion(context.cookies);
	if (esRutaPublicaAuth) {
		if (sesion) return context.redirect(RUTA_POR_ROL[sesion.IdRol] || "/");
		limpiarSesion(context.cookies);
		return next();
	}
	if (!sesion) {
		limpiarSesion(context.cookies);
		const destino = encodeURIComponent(pathname + context.url.search);
		return context.redirect(`/?redirigir=${destino}`);
	}
	if (RUTAS_SOLO_ADMIN.some((prefijo) => pathname.startsWith(prefijo)) && !sesion.IsAdmin) return context.redirect(RUTA_POR_ROL[sesion.IdRol] || "/");
	if (!RUTAS_SIN_PREFIJO_ROL.some((prefijo) => pathname.startsWith(prefijo))) {
		const prefijo = PREFIJO_POR_ROL[sesion.IdRol];
		if (!prefijo || !pathname.startsWith(`/${prefijo}`)) return context.redirect(RUTA_POR_ROL[sesion.IdRol] || "/");
	}
	context.locals.usuario = sesion;
	return next();
}));
//#endregion
export { onRequest };
