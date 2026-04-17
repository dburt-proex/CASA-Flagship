# CASA-Flagship

**Operator-facing control plane for governed AI workflows**

CASA-Flagship is the frontend and orchestration layer of the broader CASA ecosystem. It gives operators a unified interface for monitoring system state, analyzing boundary stress, simulating policy changes, and replaying prior decisions across AI-driven workflows.

This project is built to make AI systems more **visible, reviewable, and controllable** before execution risk turns into operational failure.

---

## Why this exists

Modern AI systems are powerful, but they are also difficult to govern once they interact with real tools, APIs, and decision paths.

Common failure modes include:

- inconsistent behavior across repeated tasks
- low visibility into why a decision was made
- weak operator controls before execution
- no replay path for debugging or governance review
- policy changes that are hard to test safely

CASA-Flagship addresses those problems by providing an operator-facing surface for governance workflows.

---

## What CASA-Flagship does

CASA-Flagship provides a working interface for:

- **System dashboard visibility**
  - inspect high-level governance and system metrics
- **Boundary stress analysis**
  - evaluate operational pressure and threshold proximity
- **Policy dry-run simulation**
  - test policy changes before applying them
- **Decision replay**
  - retrieve prior decision context for review and debugging
- **Operator tooling**
  - serve as the control surface for future admin and governance actions

---

## Architecture

CASA-Flagship is the **operator console and server integration layer**.
It connects to a separate FastAPI backend that provides governance data, stress analysis, and simulation responses.

### This repository: `dburt-proex/CASA-Flagship`
Responsible for:

- frontend UI
- operator-facing workflows
- server-side orchestration
- backend bridge/service calls
- environment-based backend wiring
- future auth, audit, and session integrations

### Backend repository: `dburt-proex/python-fastapi-backend`
Responsible for:

- dashboard data
- boundary stress data
- policy dry-run responses
- decision replay responses
- backend compatibility routes used by CASA-Flagship

Live backend:

```env
PYTHON_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
```

---

## System flow

```text
Operator UI
  -> Backend Bridge
  -> FastAPI Governance Services
  -> Dashboard / Boundary Stress / Policy Dry-Run / Decision Replay
```

This allows the frontend to act as the operational surface while the backend handles data delivery and simulation logic.

---

## Current backend contract

CASA-Flagship expects the backend to support these routes:

```text
GET  /api/v1/dashboard
GET  /api/v1/boundary-stress
POST /api/v1/policy/dryrun
GET  /api/v1/decision-replay/{decision_id}
POST /api/v1/admin/policy/apply
```

The FastAPI backend also exposes compatibility endpoints such as:

```text
GET  /health
GET  /dashboard
GET  /stress
GET  /boundary-stress
POST /policy/dryrun
GET  /replay/{decision_id}
```

---

## Core features

### Dashboard
Loads governance and system metrics from the backend.

Expected fields include:

- `activePolicies`
- `decisions24h`
- `boundaryAlerts`
- `systemStatus`

### Boundary Stress
Loads boundary pressure and recommendation data.

Expected fields include:

- `stressLevel`
- `criticalBoundaries`
- `recommendations`

### Policy Dry-Run
Sends a policy simulation request and renders the result before deployment.

Expected response fields include:

- `status`
- `simulatedOutcome`
- `impactScore`
- `logs`

### Decision Replay
Fetches and renders previous decision context for operator review.

Expected response fields include:

- `decisionId`
- `timestamp`
- `originalOutcome`
- `policyApplied`
- `context`

---

## Why this project matters

CASA-Flagship is not just a dashboard.

It is a step toward **governed AI execution**:

- operators can inspect system state before acting
- policy changes can be simulated before rollout
- past decisions can be replayed for traceability
- boundary pressure can be surfaced before failure conditions escalate

That makes the system more useful for real-world AI workflows where observability and control matter as much as model output quality.

---

## Environment variables

Create a local `.env` file or configure these in your deployment platform.

### Required

```env
PYTHON_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
BACKEND_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
JWT_SECRET=replace-with-a-long-random-secret
```

### Optional / future infrastructure

```env
REDIS_URL=redis://127.0.0.1:6379
```

### Notes

- `PYTHON_API_URL` is the primary backend URL for the FastAPI service.
- `BACKEND_API_URL` is retained for compatibility with older or internal bridge logic.
- `JWT_SECRET` should be replaced with a strong secret in real deployments.
- `REDIS_URL` is only valid if Redis is actually running there.

---

## Local development

### 1. Install dependencies

Use the package manager already configured for the repo.

```bash
npm install
```

or

```bash
pnpm install
```

### 2. Set environment variables

Example local `.env`:

```env
PYTHON_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
BACKEND_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
JWT_SECRET=dev-secret-change-me
REDIS_URL=redis://127.0.0.1:6379
```

### 3. Start the app

```bash
npm run dev
```

or

```bash
pnpm dev
```

### 4. Verify backend reachability

Open these in the browser:

- `https://dburt-proex-python-fastapi-backend.onrender.com/health`
- `https://dburt-proex-python-fastapi-backend.onrender.com/api/v1/dashboard`
- `https://dburt-proex-python-fastapi-backend.onrender.com/api/v1/boundary-stress`

If those return JSON, the backend is live and reachable.

---

## Deployment notes

### CASA-Flagship
Deploy this repository as the UI and orchestration application.

Make sure the deployed runtime has:

```env
PYTHON_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
BACKEND_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
JWT_SECRET=<real-secret>
```

### Python backend
The FastAPI backend is deployed separately on Render.

Current live backend:

```text
https://dburt-proex-python-fastapi-backend.onrender.com
```

If the backend repo uses the compatibility entrypoint, the Render start command should be:

```bash
uvicorn main_v2:app --host 0.0.0.0 --port $PORT
```

---

## Troubleshooting

### Dashboard shows fetch error
Most likely causes:

- `PYTHON_API_URL` is not set in the CASA-Flagship runtime
- the app was not restarted after environment variable changes
- backend route mismatch
- backend temporarily unavailable

### Backend URL is wrong
Current backend URL should be:

```env
PYTHON_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
```

### Redis connection refused
If `REDIS_URL=redis://127.0.0.1:6379` is set, Redis must actually be running locally.

Otherwise:

- use a hosted Redis URL, or
- make Redis optional in development mode

### Render backend health check
Use:

```text
/health
```

### Render backend start command
Use:

```bash
uvicorn main_v2:app --host 0.0.0.0 --port $PORT
```

---

## Near-term roadmap

- finish end-to-end route compatibility
- add durable audit logging
- add real auth / RBAC
- add Redis-backed shared session storage
- add request correlation IDs
- add full-stack integration tests

---

## Repositories

- Frontend / operator console: `dburt-proex/CASA-Flagship`
- Backend services: `dburt-proex/python-fastapi-backend`

---

## Status

**Current status:** active integration and stabilization between CASA-Flagship and the live FastAPI backend.

CASA-Flagship represents the operator-facing layer of a broader governance system focused on visibility, simulation, traceability, and controlled AI operations.
