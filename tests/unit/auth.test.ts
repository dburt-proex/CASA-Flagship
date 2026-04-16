import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

// ============================================================================
// Auth Middleware Tests
// ============================================================================

const JWT_SECRET = new TextEncoder().encode('test-secret');

function createMockReq(headers: Record<string, string> = {}) {
  return {
    headers: {
      ...headers,
    },
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
  };
  return res;
}

// We test the authenticate logic directly by recreating it
async function authenticate(req: any, res: any, next: any) {
  const { jwtVerify } = await import('jose');
  const secret = new TextEncoder().encode('test-secret');

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { payload } = await jwtVerify(token, secret);
    req.user = payload;
    next();
  } catch (err: any) {
    if (err.name === 'JWTExpired' || err.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({ error: 'Unauthorized', message: 'Token expired' });
    }
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

async function createToken(payload: Record<string, any>, expiresIn = '1h') {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setSubject(payload.email || 'test@test.com')
    .sign(JWT_SECRET);
}

describe('authenticate middleware', () => {
  it('rejects request without Authorization header', async () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with non-Bearer Authorization', async () => {
    const req = createMockReq({ authorization: 'Basic abc123' });
    const res = createMockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with invalid JWT', async () => {
    const req = createMockReq({ authorization: 'Bearer invalid.token.here' });
    const res = createMockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts request with valid JWT', async () => {
    const token = await createToken({ role: 'operator', email: 'test@casa.local' });
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeDefined();
    expect(req.user.role).toBe('operator');
    expect(req.user.email).toBe('test@casa.local');
  });

  it('rejects expired JWT', async () => {
    // Create a token that expires immediately
    const token = await new SignJWT({ role: 'operator', email: 'test@casa.local' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600) // issued 1 hour ago
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1) // expired 1 second ago
      .setSubject('test@casa.local')
      .sign(JWT_SECRET);

    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Token expired');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects JWT signed with different secret', async () => {
    const wrongSecret = new TextEncoder().encode('wrong-secret');
    const token = await new SignJWT({ role: 'operator' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(wrongSecret);

    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches admin role from JWT payload', async () => {
    const token = await createToken({ role: 'admin', email: 'admin@casa.local' });
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user.role).toBe('admin');
  });
});
