import type { JWTPayload } from 'jose';

/**
 * Shape of the JWT payload after verification.
 * Attached to req.user by the authenticate / requireAdminConfirmation middleware.
 */
export interface AuthenticatedUser extends JWTPayload {
  role: 'admin' | 'operator' | string;
  email: string;
}

export interface AuditEvent {
  timestamp: string;
  action: string;
  policyId?: string;
  actorIdentity: string;
  ip: string | undefined;
  reason: string;
  requestId: string | string[] | undefined;
}

// Augment the Express Request type so req.user is typed throughout the codebase.
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
