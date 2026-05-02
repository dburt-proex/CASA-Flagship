/**
 * Centralized JWT secret — single source of truth for all middleware
 * and route handlers that sign or verify JWTs.
 */
export const JWT_ENCODED_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-do-not-use-in-prod'
);
