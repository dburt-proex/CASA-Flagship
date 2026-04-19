import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'default-secret-do-not-use-in-prod');

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    // Attach payload to request for downstream use
    (req as any).user = payload;
    next();
  } catch (err: any) {
    if (err.name === 'JWTExpired' || err.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({ error: 'Unauthorized', message: 'Token expired' });
    }
    console.error('[Auth Error] JWT verification failed:', err);
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}
