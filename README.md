Here’s a clean README.md draft for dburt-proex/CASA-Flagship.

# CASA-Flagship

CASA-Flagship is the operator-facing control plane for CASA.

It provides a web UI and server orchestration layer for:

- system dashboard visibility
- boundary stress analysis
- policy dry-run simulation
- decision replay
- operator tooling and future admin workflows

This repository is the **frontend + server integration layer**. It connects to a separate backend service for governance data and simulation.

---

## Architecture

### This repo: `dburt-proex/CASA-Flagship`
Responsible for:

- frontend UI
- server-side orchestration
- backend bridge/service calls
- environment-based backend wiring
- future auth, audit, and session integrations

### Backend repo: `dburt-proex/python-fastapi-backend`
Responsible for:

- dashboard data
- boundary stress data
- policy dry-run responses
- decision replay responses
- backend compatibility routes used by CASA-Flagship

Live backend URL:

```env
PYTHON_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
Current Backend Contract

CASA-Flagship expects the backend to support these routes:

GET /api/v1/dashboard
GET /api/v1/boundary-stress
POST /api/v1/policy/dryrun
GET /api/v1/decision-replay/{decision_id}
POST /api/v1/admin/policy/apply

The FastAPI backend also exposes:

GET /health
GET /dashboard
GET /stress
GET /boundary-stress
POST /policy/dryrun
GET /replay/{decision_id}
Environment Variables

Create a local .env file or configure these in your deployment platform.

Required
PYTHON_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
BACKEND_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
JWT_SECRET=replace-with-a-long-random-secret
Optional / future infrastructure
REDIS_URL=redis://127.0.0.1:6379

Notes:

PYTHON_API_URL is the primary backend URL for the FastAPI service.
BACKEND_API_URL is included for compatibility with older/internal bridge code.
JWT_SECRET should be a long random secret in real deployments.
REDIS_URL is only valid if Redis is actually running there.
Local Development
1. Install dependencies

Use your normal package manager for this repo.

Example:

npm install

or

pnpm install

Use whichever one the repo is already configured for.

2. Set environment variables

Example local .env:

PYTHON_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
BACKEND_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
JWT_SECRET=dev-secret-change-me
REDIS_URL=redis://127.0.0.1:6379
3. Start the app

Example:

npm run dev

or

pnpm dev
4. Verify backend reachability

Open these in the browser:

https://dburt-proex-python-fastapi-backend.onrender.com/health
https://dburt-proex-python-fastapi-backend.onrender.com/api/v1/dashboard
https://dburt-proex-python-fastapi-backend.onrender.com/api/v1/boundary-stress

If those return JSON, the backend is live and reachable.

Deployment Notes
CASA-Flagship

Deploy this repo as the UI/server application.

Make sure the deployed runtime has:

PYTHON_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
BACKEND_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
JWT_SECRET=<real-secret>
Python backend

The FastAPI backend is deployed separately on Render.

Current live backend:

https://dburt-proex-python-fastapi-backend.onrender.com

If the backend repo uses the compatibility entrypoint, the Render start command should be:

uvicorn main_v2:app --host 0.0.0.0 --port $PORT
Primary Features
Dashboard

Loads system metrics from the backend.

Expected fields:

activePolicies
decisions24h
boundaryAlerts
systemStatus
Boundary Stress

Loads stress analysis from the backend.

Expected fields:

stressLevel
criticalBoundaries
recommendations
Policy Dry-Run

Sends a policy simulation request and renders the result.

Expected response fields:

status
simulatedOutcome
impactScore
logs
Decision Replay

Fetches and renders a previous decision context.

Expected response fields:

decisionId
timestamp
originalOutcome
policyApplied
context
Troubleshooting
Dashboard shows fetch error

Most likely causes:

PYTHON_API_URL not set in the CASA-Flagship runtime
app not restarted after env var changes
backend route mismatch
backend temporarily unavailable
Backend URL is wrong

Current backend URL should be:

PYTHON_API_URL=https://dburt-proex-python-fastapi-backend.onrender.com
Redis connection refused

If REDIS_URL=redis://127.0.0.1:6379 is set, Redis must actually be running locally.

Otherwise:

use a real hosted Redis URL, or
make Redis optional in development mode
Render backend health check

Use:

/health
Render backend start command

Use:

uvicorn main_v2:app --host 0.0.0.0 --port $PORT
Recommended Near-Term Next Steps
finish end-to-end route compatibility
add durable audit logging
add real auth / RBAC
add Redis-backed shared session storage
add request correlation IDs
add full-stack integration tests
Repositories
Frontend/server: dburt-proex/CASA-Flagship
Backend: dburt-proex/python-fastapi-backend
Status

Current status: active integration and stabilization between CASA-Flagship and the live FastAPI backend.


Paste that into:

**`dburt-proex/CASA-Flagship/README.md`**

The only line I’d expect you may need to tweak afterward is the exact install/start command if the repo uses `pnpm` instead of `npm`.

