---
applyTo: "**/*.py,api/**/*,server/**/*,backend/**/*"
excludeAgent: "code-review"
---

# CASA backend instructions

## Rules
- Preserve deterministic behavior
- Validate inputs and outputs
- Keep contracts stable
- Treat policy, replay, and dashboard routes as high-risk
- Avoid hidden state mutation
- Maintain compatibility with frontend consumers
