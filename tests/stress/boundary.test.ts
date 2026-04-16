import { describe, it, expect } from 'vitest';
import {
  ChatRequestSchema,
  PolicyDryRunRequestSchema,
  AdminApplyPolicySchema,
} from '../../src/server/schemas/contracts';

// ============================================================================
// Stress Tests - Input Boundary Conditions
// ============================================================================

describe('Schema Stress Tests - Boundary Conditions', () => {
  describe('ChatRequestSchema under stress', () => {
    it('accepts message at exact max length (10000 chars)', () => {
      const msg = 'A'.repeat(10000);
      expect(() => ChatRequestSchema.parse({ message: msg })).not.toThrow();
    });

    it('rejects message exceeding max length (10001 chars)', () => {
      const msg = 'A'.repeat(10001);
      expect(() => ChatRequestSchema.parse({ message: msg })).toThrow();
    });

    it('accepts minimum valid message (1 char)', () => {
      expect(() => ChatRequestSchema.parse({ message: 'A' })).not.toThrow();
    });

    it('handles unicode characters in message', () => {
      const msg = '你好世界🌍'.repeat(100);
      expect(() => ChatRequestSchema.parse({ message: msg })).not.toThrow();
    });

    it('handles messages with special characters', () => {
      const msg = '<script>alert("xss")</script>';
      // Schema should accept the string (sanitization happens at render level)
      expect(() => ChatRequestSchema.parse({ message: msg })).not.toThrow();
    });

    it('handles rapid sequential validations (100 in a row)', () => {
      for (let i = 0; i < 100; i++) {
        expect(() =>
          ChatRequestSchema.parse({ message: `Message ${i}`, sessionId: `sess-${i}` })
        ).not.toThrow();
      }
    });
  });

  describe('PolicyDryRunRequestSchema under stress', () => {
    it('accepts policyId at exact max length (100 chars)', () => {
      expect(() =>
        PolicyDryRunRequestSchema.parse({
          policyId: 'P'.repeat(100),
          parameters: {},
        })
      ).not.toThrow();
    });

    it('rejects policyId exceeding max length', () => {
      expect(() =>
        PolicyDryRunRequestSchema.parse({
          policyId: 'P'.repeat(101),
          parameters: {},
        })
      ).toThrow();
    });

    it('handles large parameter maps', () => {
      const params: Record<string, unknown> = {};
      for (let i = 0; i < 50; i++) {
        params[`param_${i}`] = i;
      }
      expect(() =>
        PolicyDryRunRequestSchema.parse({
          policyId: 'POL-102',
          parameters: params,
        })
      ).not.toThrow();
    });

    it('handles nested objects in parameters', () => {
      expect(() =>
        PolicyDryRunRequestSchema.parse({
          policyId: 'POL-102',
          parameters: { nested: { deep: { value: 123 } } },
        })
      ).not.toThrow();
    });
  });

  describe('AdminApplyPolicySchema under stress', () => {
    it('accepts reason at exact max length (2000 chars)', () => {
      expect(() =>
        AdminApplyPolicySchema.parse({
          policyId: 'POL-102',
          confirmationCode: 'APPLY-POL-102',
          reason: 'R'.repeat(2000),
        })
      ).not.toThrow();
    });

    it('rejects reason exceeding max length', () => {
      expect(() =>
        AdminApplyPolicySchema.parse({
          policyId: 'POL-102',
          confirmationCode: 'APPLY-POL-102',
          reason: 'R'.repeat(2001),
        })
      ).toThrow();
    });

    it('handles confirmation codes with special characters', () => {
      expect(() =>
        AdminApplyPolicySchema.parse({
          policyId: 'POL-102',
          confirmationCode: 'APPLY-POL-<script>',
          reason: 'Testing injection',
        })
      ).not.toThrow(); // Schema accepts the string; validation is at the middleware level
    });

    it('validates 100 sequential requests rapidly', () => {
      for (let i = 0; i < 100; i++) {
        expect(() =>
          AdminApplyPolicySchema.parse({
            policyId: `POL-${i}`,
            confirmationCode: `APPLY-POL-${i}`,
            reason: `Reason ${i}`,
          })
        ).not.toThrow();
      }
    });
  });
});

// ============================================================================
// Stress Tests - Concurrency Simulation
// ============================================================================

describe('Concurrent Request Simulation', () => {
  it('handles 50 concurrent schema validations', async () => {
    const promises = Array.from({ length: 50 }, (_, i) =>
      new Promise<void>((resolve) => {
        const result = ChatRequestSchema.parse({
          message: `Concurrent message ${i}`,
          sessionId: `concurrent-${i}`,
        });
        expect(result.message).toBe(`Concurrent message ${i}`);
        resolve();
      })
    );

    await Promise.all(promises);
  });

  it('handles mixed valid/invalid concurrent validations', async () => {
    const promises = Array.from({ length: 100 }, (_, i) =>
      new Promise<void>((resolve) => {
        if (i % 2 === 0) {
          // Valid
          expect(() =>
            ChatRequestSchema.parse({ message: `Valid ${i}` })
          ).not.toThrow();
        } else {
          // Invalid (empty message)
          expect(() =>
            ChatRequestSchema.parse({ message: '' })
          ).toThrow();
        }
        resolve();
      })
    );

    await Promise.all(promises);
  });
});

// ============================================================================
// Stress Tests - Memory Pressure
// ============================================================================

describe('Memory Pressure Tests', () => {
  it('validates a large batch of 1000 requests without error', () => {
    const startMem = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      ChatRequestSchema.parse({ message: `Stress message ${i}` });
    }

    const endMem = process.memoryUsage().heapUsed;
    const memDelta = endMem - startMem;

    // Memory increase should be reasonable (less than 50MB for 1000 validations)
    expect(memDelta).toBeLessThan(50 * 1024 * 1024);
  });

  it('validates large payloads near limits', () => {
    // Create a message at max size
    const largeMessage = 'X'.repeat(10000);
    const largeReason = 'R'.repeat(2000);

    for (let i = 0; i < 100; i++) {
      expect(() => ChatRequestSchema.parse({ message: largeMessage })).not.toThrow();
      expect(() =>
        AdminApplyPolicySchema.parse({
          policyId: 'POL-102',
          confirmationCode: 'APPLY-POL-102',
          reason: largeReason,
        })
      ).not.toThrow();
    }
  });
});
