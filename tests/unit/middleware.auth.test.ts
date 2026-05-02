/**
 * Unit tests for auth middleware (authenticate) and audit middleware
 * (requireAdminConfirmation).
 *
 * Strategy: Create mock Request/Response objects, sign JWTs with the
 * shared secret, and verify middleware behaviour without hitting a real server.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';
import { JWT_ENCODED_SECRET } from '../../src/server/lib/jwtSecret.js';

// Mock Cloud Logging before audit middleware is imported (Vitest hoists vi.mock)
const mockWrite = vi.fn().mockResolvedValue(undefined);
vi.mock('@google-cloud/logging', () => ({
  Logging: function Logging() {
    return {
      log: () => ({
        entry: () => ({}),
        write: mockWrite,
      }),
    };
  },
}));

// Import after mocks are set up
const { authenticate } = await import('../../src/server/middleware/auth.js');
const { requireAdminConfirmation } = await import('../../src/server/middleware/audit.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRes() {
  const res: any = { statusCode: 200, headers: {} as Record<string, string> };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: any) => { res.body = body; return res; };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  return res;
}

async function signToken(payload: Record<string, any>, expiresIn = '1h') {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setSubject(payload.email || 'test@casa.local')
    .sign(JWT_ENCODED_SECRET);
}

async function expiredToken(payload: Record<string, any>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
    .setSubject(payload.email || 'test@casa.local')
    .sign(JWT_ENCODED_SECRET);
}

// ---------------------------------------------------------------------------
// 1. authenticate middleware
// ---------------------------------------------------------------------------

describe('authenticate middleware', () => {
  it('passes through on valid JWT', async () => {
    const token = await signToken({ role: 'operator', email: 'op@casa.local' });
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeDefined();
    expect(req.user.role).toBe('operator');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req: any = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 401 when Authorization header is not Bearer', async () => {
    const req: any = { headers: { authorization: 'Basic abc123' } };
    const res = makeRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 on expired JWT', async () => {
    const token = await expiredToken({ role: 'operator', email: 'op@casa.local' });
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('returns 401 on tampered/invalid JWT', async () => {
    const req: any = { headers: { authorization: 'Bearer not.a.valid.token' } };
    const res = makeRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('attaches user to req on success', async () => {
    const token = await signToken({ role: 'admin', email: 'admin@casa.local' });
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(req.user.role).toBe('admin');
    expect(req.user.email).toBe('admin@casa.local');
  });
});

// ---------------------------------------------------------------------------
// 2. requireAdminConfirmation middleware
// ---------------------------------------------------------------------------

describe('requireAdminConfirmation middleware', () => {
  beforeEach(() => {
    mockWrite.mockResolvedValue(undefined);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req: any = { headers: {}, body: { confirmationCode: 'APPLY-POL-1', policyId: 'POL-1' } };
    const res = makeRes();
    const next = vi.fn();

    await requireAdminConfirmation(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for non-admin role', async () => {
    const token = await signToken({ role: 'operator', email: 'op@casa.local' });
    const req: any = {
      headers: { authorization: `Bearer ${token}`, 'x-request-id': 'req-1' },
      body: { confirmationCode: 'APPLY-POL-1', policyId: 'POL-1' },
      ip: '127.0.0.1',
    };
    const res = makeRes();
    const next = vi.fn();

    await requireAdminConfirmation(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/admin role required/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for wrong confirmation code', async () => {
    const token = await signToken({ role: 'admin', email: 'admin@casa.local' });
    const req: any = {
      headers: { authorization: `Bearer ${token}`, 'x-request-id': 'req-2' },
      body: { confirmationCode: 'WRONG-CODE', policyId: 'POL-1', reason: 'test' },
      ip: '127.0.0.1',
    };
    const res = makeRes();
    const next = vi.fn();

    await requireAdminConfirmation(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for expired token', async () => {
    const token = await expiredToken({ role: 'admin', email: 'admin@casa.local' });
    const req: any = {
      headers: { authorization: `Bearer ${token}`, 'x-request-id': 'req-3' },
      body: { confirmationCode: 'APPLY-POL-1', policyId: 'POL-1' },
      ip: '127.0.0.1',
    };
    const res = makeRes();
    const next = vi.fn();

    await requireAdminConfirmation(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('is fail-closed: returns 500 when Cloud Logging throws', async () => {
    mockWrite.mockRejectedValueOnce(new Error('GCP unavailable'));
    const token = await signToken({ role: 'admin', email: 'admin@casa.local' });
    const req: any = {
      headers: { authorization: `Bearer ${token}`, 'x-request-id': 'req-4' },
      body: { confirmationCode: 'APPLY-POL-FAIL', policyId: 'POL-FAIL', reason: 'test' },
      ip: '127.0.0.1',
    };
    const res = makeRes();
    const next = vi.fn();

    await requireAdminConfirmation(req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body.message).toMatch(/audit/i);
    expect(next).not.toHaveBeenCalled();
  });
});
