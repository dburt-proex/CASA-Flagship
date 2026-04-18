import { Request, Response, NextFunction } from 'express';
import { jwtVerify, type JWTPayload } from 'jose';
import { Logging } from '@google-cloud/logging';
import { JWT_ENCODED_SECRET } from '../lib/jwtSecret.js';
import type { AuthenticatedUser, AuditEvent } from '../lib/authTypes.js';

const logging = new Logging();
const log = logging.log('casa-audit-log');

/**
 * Middleware to verify JWT and check for admin role.
 * This is a specialized version of authenticate that also enforces RBAC and durable auditing.
 */
export async function requireAdminConfirmation(req: Request, res: Response, next: NextFunction) {
  const { confirmationCode, policyId } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7); // skip 'Bearer '
  let user: AuthenticatedUser;
  try {
    const { payload } = await jwtVerify(token, JWT_ENCODED_SECRET);
    user = payload as AuthenticatedUser;
    req.user = user;
  } catch (err) {
    if (err instanceof Error && (err.name === 'JWTExpired' || (err as NodeJS.ErrnoException).code === 'ERR_JWT_EXPIRED')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Token expired' });
    }
    console.error('[Auth Error] Admin JWT verification failed:', err);
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }

  // RBAC check
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin role required' });
  }

  if (!confirmationCode || confirmationCode !== `APPLY-${policyId}`) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: `Explicit admin confirmation required. Expected: APPLY-${policyId}` 
    });
  }

  // Durable Audit Log (Fail-closed)
  const auditEntry: AuditEvent = {
    timestamp: new Date().toISOString(),
    action: 'POLICY_MUTATION',
    policyId,
    actorIdentity: user.sub ?? user.email ?? 'unknown-admin',
    ip: req.ip,
    reason: (req.body.reason as string | undefined) ?? 'No reason provided',
    requestId: req.headers['x-request-id']
  };

  try {
    const entry = log.entry({ resource: { type: 'global' } }, auditEntry);
    await log.write(entry);
    console.log(`[AUDIT LOG] CRITICAL WRITE ACTION DURABLY LOGGED:`, auditEntry.requestId);
  } catch (error) {
    console.error(`[AUDIT LOG FAILED] Rejecting write action.`, error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to durably log audit event. Action rejected.' });
  }
  
  next();
}
