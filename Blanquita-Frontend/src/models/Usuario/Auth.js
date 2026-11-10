export const LoginRequest = (ci, clave) => ({
  Ci: ci,
  Clave: clave
});

export const RefreshRequest = (refreshToken) => ({
  RefreshToken: refreshToken
});

export const LoginResponse = (data) => ({
  AccessToken: data.AccessToken,
  RefreshToken: data.RefreshToken,
  TokenType: data.TokenType
});

export const RefreshResponse = (data) => ({
  AccessToken: data.AccessToken,
  RefreshToken: data.RefreshToken,
  TokenType: data.TokenType
});

export const LogoutResponse = (data) => ({
  Revocado: data.Revocado
});

export const SesionUsuario = (payload) => {
  const metadata = payload.app_metadata ?? {};

  return {
    IdUsuario: metadata.IdUsuario ?? null,
    IdRol: metadata.IdRol ?? null,
    IdEstadoUsuario: metadata.IdEstadoUsuario ?? null,
    IsAdmin: metadata.IsAdmin ?? false,
    IdSucursal: metadata.IdSucursal ?? null,
    AuthUserId: payload.sub ?? null,
    Correo: payload.email ?? null
  };
};