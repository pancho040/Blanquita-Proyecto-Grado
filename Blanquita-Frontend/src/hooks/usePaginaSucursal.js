/**
 * Re-export canónico del hook de sucursal para compatibilidad con '@/hooks/usePaginaSucursal'.
 * Provee listoParaConsultar, sucursal, sucursalIdNumerico y bloqueo cerrado de consultas a Sucre
 * para usuarios con sede fija Potosí.
 */
export { usePaginaSucursal, useBranch } from "@/stores/branchStore";
