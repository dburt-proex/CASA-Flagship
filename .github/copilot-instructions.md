# CASA-Flagship Repository Instructions

This repository represents a governance-grade AI control plane and operator-facing system. All changes must optimize for deterministic behavior, architectural clarity, auditability, and low regression risk.

## Core mission
- Preserve the integrity of the CASA governance model.
- Keep control logic explicit, reviewable, and testable.
- Prefer narrow, reversible edits over broad architectural drift.
- Maintain alignment between backend contracts, UI assumptions, and policy semantics.

## System priorities
1. correctness
2. deterministic behavior
3. safety and bounded autonomy
4. contract stability
5. simplicity
6. speed

## Required operating behavior
- Read the surrounding implementation before writing code.
- Reuse established naming, folder conventions, schemas, and helper patterns.
- Do not introduce new abstractions unless there is a clear, immediate payoff.
- Do not broaden the scope of a task unless explicitly required.
- Keep changes tight and easy for a reviewer to verify.

## CASA-specific architectural rules
- Preserve gate semantics and do not rename core governance states without explicit direction.
- Treat policy logic, risk scoring, drift handling, and decision routing as high-sensitivity surfaces.
- Do not weaken deterministic routing, evidence capture, or audit behavior.
- Keep decision outputs machine-readable and stable wherever possible.
- Avoid hidden side effects in policy evaluation, dashboard aggregation, or API bridge logic.

## Frontend behavior expectations
- Keep the UI aligned with backend contracts.
- Prefer explicit empty, loading, success, and error states.
- Do not fake data or silently swallow backend failures.
- Preserve operator legibility. Governance state, metrics, and decisions should remain easy to interpret.
- Avoid cosmetic churn unrelated to the requested task.

## Backend and integration expectations
- Validate request and response shapes carefully.
- Preserve backward compatibility for routes already consumed by the frontend.
- Treat policy application, dry-run behavior, replay data, dashboard metrics, and boundary stress responses as contract-sensitive.
- Do not claim end-to-end compatibility unless the request path, response shape, and failure path were all checked.

## Risk controls
Treat the following as high-risk:
- policy mutations
- decision replay logic
- route contract changes
- auth or permission changes
- schema changes
- dashboard aggregation logic
- boundary stress calculations
- environment variable resolution
- deployment configuration

For high-risk changes:
- minimize scope
- preserve existing contracts when possible
- make assumptions explicit
- require validation

## Validation requirements
- Run the narrowest relevant checks first, then broader checks if warranted.
- Prefer typecheck, lint, targeted tests, and endpoint contract checks.
- If validation cannot be run, state exactly what remains unverified.
- Never claim a fix is complete without some real validation path.

## Output discipline
When finishing a task:
- list changed files
- summarize behavioral impact
- state validation performed
- state remaining assumptions or risks

## Anti-drift rules
- No placeholder logic
- No fake mocks presented as final behavior
- No broad refactors mixed into targeted fixes
- No weakening of governance semantics for convenience
- No dependency sprawl without necessity
- No unverified claims of compatibility
