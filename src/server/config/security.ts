const DEFAULT_JWT_SECRET = 'default-secret-do-not-use-in-prod';

export const DEV_LOGIN_ENABLED = process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === 'true';
export const DEBUG_ROUTES_ENABLED = process.env.NODE_ENV !== 'production';

export function getJwtSecret(): Uint8Array {
  const configuredJwtSecret = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === 'production' && (!configuredJwtSecret || configuredJwtSecret === DEFAULT_JWT_SECRET)) {
    throw new Error('JWT_SECRET must be set to a non-default value in production');
  }
  return new TextEncoder().encode(configuredJwtSecret || DEFAULT_JWT_SECRET);
}
