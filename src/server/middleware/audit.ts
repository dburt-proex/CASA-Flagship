import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import { Logging } from '@google-cloud/logging';

const logging = new Logging();
const log = logging.log('casa-audit-log');

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'default-secret-do-not-use-in-prod');

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

  const token = authHeader.split(' ')[1];
  let payload;
  try {
    const { payload: jwtPayload } = await jwtVerify(token, JWT_SECRET);
    payload = jwtPayload;
    (req as any).user = payload; // Consistency with authenticate middleware
  } catch (err) {
    console.error('[Auth Error] Admin JWT verification failed:', err);
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }

  // RBAC check
  if (payload.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin role required' });
  }

  if (!confirmationCode || confirmationCode !== `APPLY-${policyId}`) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: `Explicit admin confirmation required. Expected: APPLY-${policyId}` 
    });
  }

  // Durable Audit Log (Fail-closed)
  const auditEntry = {
    timestamp: new Date().toISOString(),
    action: 'POLICY_MUTATION',
    policyId,
    actorIdentity: payload.sub || payload.email || 'unknown-admin',
    ip: req.ip,
    reason: req.body.reason || 'No reason provided',
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
