import type { JWTPayload } from 'jose';

// Typed representation of the authenticated user attached to Express requests.
export interface AuthenticatedUser extends JWTPayload {
  role: string;
  email: string;
}

// Typed audit event written to Cloud Logging for every admin write action.
export interface AuditEvent {
  timestamp: string;
  action: 'POLICY_MUTATION';
  policyId: string;
  actorIdentity: string;
  ip: string | undefined;
  reason: string;
  requestId: string | string[] | undefined;
}

// Module augmentation so that req.user is typed everywhere in Express handlers.
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
