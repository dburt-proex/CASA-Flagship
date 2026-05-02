# CASA-Flagship

CASA-Flagship is the operator-facing control plane for CASA — a governance-grade AI oversight system. It provides a full-stack web UI and server orchestration layer for governing autonomous AI agents.

---

## Features

| Module | Description |
|---|---|
| **System Dashboard** | Real-time governance metrics (active policies, decisions, alerts, system health) |
| **Review Gate** | Human-in-the-loop approval for flagged AI decisions |
| **Policy Lab** | Policy dry-run simulation + AI impact analysis |
| **Boundary Stress** | Live boundary stress analysis and recommendations |
| **Audit Ledger** | Decision replay and history |
| **Operator Chat** | AI-powered governance assistant with live tool-calling |
| **Ops Metrics** | Internal telemetry for tool calls, latency, and route error rates |

---

## Architecture

```
┌─────────────────────────────────────────┐
│         CASA-Flagship (this repo)        │
│  React UI  <->  Express Server           │
│  (port 3000)   └── /api routes          │
│                    └── backendBridge --> │---> Python Governance Engine
│                    └── geminiService --> │---> Gemini AI API
└─────────────────────────────────────────┘
```

### Repos

| Repo | Role |
|---|---|
| `dburt-proex/CASA-Flagship` | Frontend + Express server (this repo) |
| `dburt-proex/python-fastapi-backend` | Python Governance Engine (data + simulation) |

---

## Environment Variables

Create a `.env` file (or configure in your deployment platform). See `.env.example` for all variables.

### Required

```env
# Primary governance API URL
CASA_GOVERNANCE_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com

# JWT signing secret — use a long random value in production
JWT_SECRET=replace-with-a-long-random-secret

# Gemini AI API key
GEMINI_API_KEY=your-gemini-api-key
```

### Optional

```env
# Redis for persistent chat session storage (falls back to in-memory if not set)
REDIS_URL=rediss://default:<password>@<host>:<port>

# Google Cloud credentials for Cloud Logging audit trail (uses ADC if not set)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env
# Edit .env and set GEMINI_API_KEY and JWT_SECRET

# 3. Start the dev server (Vite + Express)
npm run dev

# 4. Run tests
npm test
```

The app runs at `http://localhost:3000`.

---

## Testing

```bash
npm test          # Run all unit tests (Vitest)
npx tsc --noEmit  # TypeScript type check
```

Test coverage:
- `tests/unit/backendBridge.normalization.test.ts` — 39 backend bridge normalization tests
- `tests/unit/opsMetrics.test.ts` — ops metrics aggregation and rolling cap
- `tests/unit/middleware.auth.test.ts` — auth and audit middleware (JWT, RBAC, fail-closed)
- `tests/unit/geminiService.executeTool.test.ts` — tool dispatch, validation, and truncation

---

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Server health check |
| `POST` | `/api/auth/dev-login` | None | Issue dev JWT (rate-limited) |
| `GET` | `/api/dashboard` | None | Governance dashboard metrics |
| `GET` | `/api/stress` | None | Boundary stress analysis |
| `GET` | `/api/replay/:id` | None | Decision replay |
| `POST` | `/api/policy/dryrun` | None | Policy dry-run simulation |
| `POST` | `/api/chat` | Bearer JWT | Operator AI assistant |
| `POST` | `/api/explain` | Bearer JWT | Explain data with AI |
| `POST` | `/api/policy/analyze` | Bearer JWT | AI policy impact analysis |
| `GET` | `/api/decisions/flagged` | Bearer JWT | Flagged decisions pending review |
| `GET` | `/api/decisions/history` | Bearer JWT | Resolved decision history |
| `POST` | `/api/decisions/:id/review` | Bearer JWT | Approve or halt a decision |
| `GET` | `/api/ops/metrics` | Bearer JWT (admin) | Internal ops telemetry |
| `POST` | `/api/admin/policy/apply` | Bearer JWT (admin + confirmation code) | Apply policy mutation |

---

## Backend Contract

The Python Governance Engine must expose:

```
GET  /dashboard
GET  /boundary-stress
POST /policy/dryrun
GET  /decision-replay/{decision_id}
GET  /health
```

Backend bridge URL: `https://dburt-proex-python-fastapi-backend.onrender.com`

---

## Deployment

### CASA-Flagship

Deploy as a Node.js service. Required runtime environment:

```env
CASA_GOVERNANCE_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
JWT_SECRET=<production-secret>
GEMINI_API_KEY=<api-key>
NODE_ENV=production
```

Build for production:

```bash
npm run build
node dist/server/server.js
```

### Python Backend (Render)

Start command:

```
uvicorn main_v2:app --host 0.0.0.0 --port $PORT
```

---

## Security

- **Helmet**: Security headers on all responses
- **JWT authentication**: All write and AI endpoints require a valid Bearer token
- **RBAC**: Admin role required for `/ops/metrics` and `/admin/policy/apply`
- **Rate limiting**: 100 req/15min globally, 10 req/15min on `/auth/dev-login`
- **Confirmation codes**: Admin policy mutations require explicit `APPLY-<policyId>` confirmation
- **Fail-closed audit**: Policy mutations are rejected if Cloud Logging write fails
- **Input validation**: All API inputs validated with Zod schemas
- **Session isolation**: Chat sessions are scoped to the authenticated user's JWT subject

---

## Troubleshooting

**Dashboard shows fetch error**
- Check `CASA_GOVERNANCE_API_URL` is set correctly
- Verify backend is reachable: `https://dburt-proex-python-fastapi-backend.onrender.com/health`
- Restart the server after env var changes

**Chat returns AI config error**
- `GEMINI_API_KEY` is missing or invalid — configure it in the Secrets panel

**Redis connection refused**
- If `REDIS_URL` is not set or points to `localhost`, the system automatically falls back to in-memory session storage
