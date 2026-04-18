import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import { JWT_ENCODED_SECRET } from '../lib/jwtSecret.js';
import type { AuthenticatedUser } from '../lib/authTypes.js';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7); // skip 'Bearer '
  try {
    const { payload } = await jwtVerify(token, JWT_ENCODED_SECRET);
    req.user = payload as AuthenticatedUser;
    next();
  } catch (err) {
    if (err instanceof Error && (err.name === 'JWTExpired' || (err as NodeJS.ErrnoException).code === 'ERR_JWT_EXPIRED')) {
      res.status(401).json({ error: 'Unauthorized', message: 'Token expired' });
      return;
    }
    console.error('[Auth Error] JWT verification failed:', err);
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}
