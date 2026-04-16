# CASA Flagship — Safety Policy

**Effective Date:** April 16, 2026  
**Last Updated:** April 16, 2026  
**Applies To:** CASA Control Plane (Governance Engine) and all integrated AI agents

---

## 1. Purpose

This Safety Policy defines the principles, controls, and operational safeguards that govern the CASA ("Cognitive Autonomous Safety Architecture") Control Plane. CASA is designed to ensure that agentic AI systems operate within defined safety boundaries through a structured three-gate decision system: **Allow**, **Review**, and **Halt**.

The goal of this policy is to prevent harmful autonomous decisions before they occur and to maintain a fully auditable, reproducible record of every action taken.

---

## 2. Core Safety Principles

### 2.1 Fail-Closed Design
All critical operations in CASA follow a **fail-closed** model:
- If an audit log write fails, the associated policy mutation is **rejected**.
- If the AI service times out, the operation fails safely with a clear error message.
- If authentication cannot be verified, access is **denied**.
- System defaults to the most restrictive state when uncertainty is detected.

### 2.2 Defense in Depth
CASA implements multiple independent layers of security:
- **Layer 1 — Transport:** HTTPS/TLS for all communications.
- **Layer 2 — Authentication:** JWT-based identity verification on every protected request.
- **Layer 3 — Authorization:** Role-Based Access Control (RBAC) separating operator and admin privileges.
- **Layer 4 — Input Validation:** Zod schema enforcement on all API inputs with length constraints.
- **Layer 5 — Rate Limiting:** Per-IP request throttling on all endpoints.
- **Layer 6 — Audit Logging:** Immutable, durable audit records for all policy mutations.
- **Layer 7 — XSS Prevention:** HTML sanitization in all rendered content.

### 2.3 Least Privilege
- Operators can view dashboards, run simulations, query chat, and replay decisions.
- Only administrators can apply policy mutations to production.
- Admin actions require dual verification: role check + explicit confirmation code.
- The development login endpoint is disabled in production environments.

### 2.4 Transparency and Auditability
- Every API request receives a unique correlation ID for end-to-end tracing.
- All policy mutations generate an immutable audit log entry containing actor identity, timestamp, IP address, reason, and correlation ID.
- Decision replay allows any past governance decision to be inspected and explained.

---

## 3. AI Safety Controls

### 3.1 AI Boundary Management
CASA manages AI agent decision-making through the **Verified Intelligence Liability Grading System**:

| Gate | Action | Criteria |
|------|--------|----------|
| **Allow** | Proceed autonomously | Decision falls within established safe boundaries |
| **Review** | Flag for human review | Decision triggers boundary stress alerts or elevated risk scores |
| **Halt** | Block execution | Decision exceeds critical thresholds or violates active policies |

### 3.2 AI Interaction Safeguards
- **No hallucination tolerance:** The AI assistant is instructed to use real-time data tools rather than generating synthetic metrics.
- **Tool call limits:** The function calling loop is capped at 10 iterations to prevent infinite recursion.
- **Timeout protection:** All AI API calls have enforced timeouts (15–30 seconds) to prevent resource exhaustion.
- **Uncertainty disclosure:** When a tool call fails, the AI explicitly states the uncertainty rather than fabricating data.
- **Structured output validation:** AI-generated policy analyses are validated against a JSON schema before being presented.

### 3.3 AI Data Boundaries
- The AI assistant only accesses governance data through defined tool interfaces (dashboard, stress, dry-run, replay).
- No direct database access is granted to the AI service.
- AI-generated content is rendered with HTML sanitization to prevent XSS attacks from malicious model outputs.
- Session history expires after 1 hour to limit data exposure.

---

## 4. Operational Safety Controls

### 4.1 Policy Mutation Safeguards
Policy mutations (applying a policy to production) require **four independent safety checks**:

1. **Authentication:** Valid, non-expired JWT with verified signature.
2. **Authorization:** JWT payload must contain `role: 'admin'`.
3. **Confirmation:** Request must include the exact confirmation code `APPLY-{policyId}`.
4. **Audit logging:** An immutable audit entry must be durably written before the action proceeds.

If any of these checks fail, the mutation is rejected.

### 4.2 Rate Limiting
| Endpoint Category | Limit | Window |
|---|---|---|
| General API | 100 requests | 1 minute |
| Authentication | 20 attempts | 15 minutes |

Rate limit responses return a clear error message without exposing system internals.

### 4.3 Input Validation Constraints
| Field | Min Length | Max Length |
|---|---|---|
| Chat message | 1 | 10,000 |
| Session ID | — | 200 |
| Policy ID | 1 | 100 |
| Admin reason | 1 | 2,000 |
| Confirmation code | 1 | 200 |
| Request body | — | 1 MB |

### 4.4 Session Safety
- In-memory session storage is capped at 1,000 sessions to prevent memory exhaustion.
- Redis sessions have a 1-hour TTL.
- Token expiration is checked both client-side and server-side.
- Expired tokens are automatically cleared from the browser.

---

## 5. Incident Response

### 5.1 Security Incident Classification

| Severity | Description | Response Time |
|---|---|---|
| **Critical** | Unauthorized policy mutation, data breach, AI safety boundary violation | Immediate (< 1 hour) |
| **High** | Authentication bypass attempt, rate limit exhaustion, audit log failure | Within 4 hours |
| **Medium** | Repeated failed auth attempts, schema validation anomalies | Within 24 hours |
| **Low** | Configuration warnings, non-critical service degradation | Within 72 hours |

### 5.2 Incident Response Procedure
1. **Detection:** Automated monitoring via audit logs, rate limit alerts, and error tracking.
2. **Containment:** Immediate isolation of affected components. Fail-closed behavior ensures no unsafe actions proceed.
3. **Investigation:** Correlation IDs enable end-to-end request tracing. Decision replay allows exact reconstruction of events.
4. **Remediation:** Patch deployment, secret rotation, policy update as needed.
5. **Documentation:** Incident report added to audit log with root cause analysis.
6. **Review:** Post-incident review to update safety boundaries and policies.

---

## 6. Testing and Validation

### 6.1 Test Coverage
CASA maintains a comprehensive test suite covering:

- **Unit tests:** Schema validation, authentication logic, API contract compliance.
- **Stress tests:** Input boundary conditions, concurrent request handling, memory pressure.
- **Security tests:** SQL injection, XSS injection, path traversal, JWT tampering, role escalation, header injection.

### 6.2 Continuous Validation
- TypeScript strict mode compilation (`tsc --noEmit`) validates type safety.
- Zod schemas provide runtime type checking on all API boundaries.
- All tests must pass before deployment.

### 6.3 Security Scanning
- Dependencies are audited for known vulnerabilities via `npm audit`.
- New dependencies are checked against the GitHub Advisory Database before addition.
- Security headers are enforced via Helmet.js.

---

## 7. Governance Control Plane Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CASA CONTROL PLANE                    │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  ALLOW   │  │  REVIEW  │  │   HALT   │   3-Gate     │
│  │  Gate    │  │  Gate    │  │   Gate   │   System     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
│  ┌────┴──────────────┴──────────────┴────┐              │
│  │     Verified Intelligence Liability    │              │
│  │          Grading System               │              │
│  └───────────────────┬───────────────────┘              │
│                      │                                   │
│  ┌───────────────────┴───────────────────┐              │
│  │         Immutable Audit Ledger         │              │
│  │    (Every output recorded & reproducible)│            │
│  └───────────────────────────────────────┘              │
│                                                         │
│  Security Layers:                                       │
│  [Helmet] [Rate Limit] [JWT Auth] [RBAC] [Zod] [XSS]  │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Compliance and Standards

This safety policy aligns with:

- **NIST AI Risk Management Framework (AI RMF):** Governance, risk mapping, and continuous monitoring.
- **ISO/IEC 42001:** AI Management System standards for responsible AI deployment.
- **OWASP Top 10:** Web application security best practices.
- **SOC 2 Type II principles:** Security, availability, processing integrity, confidentiality.

---

## 9. Policy Review

This Safety Policy is reviewed and updated:
- **Quarterly:** Routine review of controls and threat landscape.
- **After incidents:** Immediate review and update following any security or safety incident.
- **Before major releases:** Review of all safety controls before deploying significant changes.

---

## 10. Responsibilities

| Role | Responsibilities |
|---|---|
| **System Administrator** | Deployment configuration, secret management, infrastructure security |
| **Operator** | Day-to-day governance operations, simulation, monitoring |
| **Administrator** | Policy mutations, audit review, incident response |
| **Development Team** | Code security, test coverage, dependency management |

---

## 11. Contact

For safety-related inquiries or to report a security concern regarding your CASA deployment, contact your organization's security team or system administrator immediately.

---

*This safety policy is part of the CASA Flagship governance control plane documentation.*
