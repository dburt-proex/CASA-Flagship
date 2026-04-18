// Shared JWT secret module — fails closed when the secret is missing or unsafe.
// Import this instead of reading process.env.JWT_SECRET directly in middleware.

const KNOWN_WEAK_SECRETS = new Set([
  'default-secret-do-not-use-in-prod',
  'your-256-bit-secret',
  'secret',
  'jwt_secret',
  'password',
]);

function resolveJwtSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (!raw || KNOWN_WEAK_SECRETS.has(raw)) {
    if (isProd) {
      console.error('[FATAL] JWT_SECRET is missing or using a known-weak value in production. Refusing to continue.');
      process.exit(1);
    }
    console.warn('[WARNING] JWT_SECRET is not set or is using a known-weak default. Set a strong secret before deploying to production.');
    return new TextEncoder().encode(raw ?? 'default-secret-do-not-use-in-prod');
  }

  return new TextEncoder().encode(raw);
}

export const JWT_ENCODED_SECRET: Uint8Array = resolveJwtSecret();
