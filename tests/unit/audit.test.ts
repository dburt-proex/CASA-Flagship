/**
 * Unit tests for the `requireAdminConfirmation` middleware
 * (src/server/middleware/audit.ts).
 *
 * Strategy:
 *  - Mock `jose` (jwtVerify) to control JWT outcomes.
 *  - Mock `@google-cloud/logging` to avoid real GCP calls and simulate audit
 *    log failures.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before module under test is imported
// ---------------------------------------------------------------------------

// vi.hoisted ensures these variables are available inside vi.mock factories,
// which are hoisted to the top of the module by Vitest.
const { mockLogWrite, mockLogEntry } = vi.hoisted(() => ({
  mockLogWrite: vi.fn().mockResolvedValue(undefined),
  mockLogEntry: vi.fn().mockReturnValue({}),
}));

vi.mock('@google-cloud/logging', () => ({
  Logging: function () {
    return {
      log: () => ({ write: mockLogWrite, entry: mockLogEntry }),
    };
  },
}));

vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}));

import { jwtVerify } from 'jose';
import { requireAdminConfirmation } from '../../src/server/middleware/audit.js';
import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(overrides: Partial<{
  headers: Record<string, string>;
  body: Record<string, unknown>;
  ip: string;
}> = {}): Request {
  return {
    headers: {},
    body: {},
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json } as unknown as Response & { status: typeof status; json: typeof json };
}

const next: NextFunction = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockLogWrite.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireAdminConfirmation middleware', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const req = makeReq({ body: { policyId: 'POL-001', confirmationCode: 'APPLY-POL-001', reason: 'test' } });
    const res = makeRes();
    await requireAdminConfirmation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with "Bearer "', async () => {
    const req = makeReq({
      headers: { authorization: 'Token abc' },
      body: { policyId: 'POL-001', confirmationCode: 'APPLY-POL-001', reason: 'test' },
    });
    const res = makeRes();
    await requireAdminConfirmation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with "Token expired" on JWTExpired error', async () => {
    const err = Object.assign(new Error('expired'), { name: 'JWTExpired' });
    vi.mocked(jwtVerify).mockRejectedValueOnce(err);

    const req = makeReq({
      headers: { authorization: 'Bearer expired' },
      body: { policyId: 'POL-001', confirmationCode: 'APPLY-POL-001', reason: 'test' },
    });
    const res = makeRes();
    const jsonSpy = vi.fn();
    (res.status as any).mockReturnValue({ json: jsonSpy });

    await requireAdminConfirmation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token expired' }));
  });

  it('returns 401 with "Invalid or expired token" on a generic JWT error', async () => {
    vi.mocked(jwtVerify).mockRejectedValueOnce(new Error('bad sig'));

    const req = makeReq({
      headers: { authorization: 'Bearer invalid' },
      body: { policyId: 'POL-001', confirmationCode: 'APPLY-POL-001', reason: 'test' },
    });
    const res = makeRes();
    const jsonSpy = vi.fn();
    (res.status as any).mockReturnValue({ json: jsonSpy });

    await requireAdminConfirmation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid or expired token' }));
  });

  it('returns 403 when JWT is valid but role is not admin', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({ payload: { role: 'operator', sub: 'op-1' } } as any);

    const req = makeReq({
      headers: { authorization: 'Bearer operator-token' },
      body: { policyId: 'POL-001', confirmationCode: 'APPLY-POL-001', reason: 'test' },
    });
    const res = makeRes();
    const jsonSpy = vi.fn();
    (res.status as any).mockReturnValue({ json: jsonSpy });

    await requireAdminConfirmation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Admin role required' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when confirmationCode is missing', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({ payload: { role: 'admin', sub: 'admin-1' } } as any);

    const req = makeReq({
      headers: { authorization: 'Bearer admin-token' },
      body: { policyId: 'POL-001', reason: 'test' }, // no confirmationCode
    });
    const res = makeRes();
    const jsonSpy = vi.fn();
    (res.status as any).mockReturnValue({ json: jsonSpy });

    await requireAdminConfirmation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('APPLY-POL-001') })
    );
  });

  it('returns 403 when confirmationCode does not match expected pattern', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({ payload: { role: 'admin', sub: 'admin-1' } } as any);

    const req = makeReq({
      headers: { authorization: 'Bearer admin-token' },
      body: { policyId: 'POL-001', confirmationCode: 'WRONG-CODE', reason: 'test' },
    });
    const res = makeRes();
    const jsonSpy = vi.fn();
    (res.status as any).mockReturnValue({ json: jsonSpy });

    await requireAdminConfirmation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when audit log write fails (fail-closed)', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({ payload: { role: 'admin', sub: 'admin-1' } } as any);
    mockLogWrite.mockRejectedValueOnce(new Error('GCP unavailable'));

    const req = makeReq({
      headers: { authorization: 'Bearer admin-token' },
      body: { policyId: 'POL-002', confirmationCode: 'APPLY-POL-002', reason: 'emergency' },
    });
    const res = makeRes();
    const jsonSpy = vi.fn();
    (res.status as any).mockReturnValue({ json: jsonSpy });

    await requireAdminConfirmation(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Failed to durably log audit event') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when admin token, correct code, and audit log succeed', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({ payload: { role: 'admin', sub: 'admin-1' } } as any);
    mockLogWrite.mockResolvedValueOnce(undefined);

    const req = makeReq({
      headers: { authorization: 'Bearer admin-token' },
      body: { policyId: 'POL-003', confirmationCode: 'APPLY-POL-003', reason: 'planned update' },
    });
    const res = makeRes();

    await requireAdminConfirmation(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('includes actorIdentity from email when sub is absent', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { role: 'admin', email: 'admin@casa.local' },
    } as any);
    mockLogWrite.mockResolvedValueOnce(undefined);

    const req = makeReq({
      headers: { authorization: 'Bearer admin-email-token' },
      body: { policyId: 'POL-004', confirmationCode: 'APPLY-POL-004', reason: 'routine' },
    });
    const res = makeRes();

    await requireAdminConfirmation(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    // Verify the audit entry was constructed with the email field
    const auditData = mockLogEntry.mock.calls.at(-1)?.[1];
    expect(auditData.actorIdentity).toBe('admin@casa.local');
  });
});
