const rawJwtSecret = process.env.JWT_SECRET?.trim();

if (!rawJwtSecret) {
  throw new Error('JWT_SECRET must be configured');
}

if (process.env.NODE_ENV === 'production' && rawJwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

export const JWT_SECRET = new TextEncoder().encode(rawJwtSecret);
