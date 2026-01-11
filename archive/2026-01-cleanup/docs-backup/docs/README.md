# Documentation Index

Permanent documentation for the Translalia project, organized by category with short descriptions and a recommended reading order for new contributors.

## Getting Started

- `STYLE.md` — Documentation style standards and conventions used across this repo.
- `configuration/flags-and-models.md` — How feature flags work and how LLM models are selected/configured.

## API

- `api/flow-api.md` — End‑to‑end flow endpoints and how the translator/enhancer flows are orchestrated.
- `api/llm-api.md` — LLM usage patterns, response formats, debugging toggles, and prompt logging guidance.

## Architecture and Context

- `context/CODEBASE_OVERVIEW.md` — High‑level map of the codebase, major modules, and responsibilities.
- `context/ARCHITECTURE_DECISIONS.md` — Key architectural choices and their rationale.
- `context/API_ROUTES.md` — Inventory of API routes with inputs/outputs and feature flag gating.
- `context/COMPONENTS_STRUCTURE.md` — Frontend components hierarchy and composition patterns.
- `context/RELATIONSHIPS.md` — How modules and services relate and depend on one another.
- `context/DATABASE_SCHEMA.md` — Data models and relationships used by the application.
- `context/STATE_MANAGEMENT.md` — Client/server state strategy (Zustand, TanStack Query) and cache boundaries.
- `context/LLM_INTEGRATION_GUIDE.md` — How we call LLMs, error handling, retries, and safety controls.
- `context/ERROR_HANDLING.md` — Error surfaces, response shapes, and logging strategy.
- `context/PERFORMANCE_OPTIMIZATION.md` — Perf guidelines and techniques relevant to this codebase.
- `context/SERVICES_INTEGRATIONS.md` — External services used (e.g., Supabase, OpenAI) and integration notes.
- `context/UTILITIES_HELPERS.md` — Common utilities and helper modules, with usage guidance.
- `context/TESTING_STRATEGIES.md` — Testing approach, types of tests, and example coverage.
- `context/DEPLOYMENT_GUIDE.md` — Environments, required env vars, and deployment steps.
- `context/CURRENT_ISSUES.md` — Known issues, limitations, and active areas of work.

### Domain‑specific Context

- `context/domains/authentication.md` — Auth flows, SSR cookie handling, and permission checks.
- `context/domains/business-logic.md` — Core domain logic and invariants for translation workflows.
- `context/domains/data-flow.md` — Data lifecycle from request to persistence and back to UI.
- `context/domains/user-management.md` — Users, roles, and lifecycle operations.

## Policies

- `policies/moderation-policy.md` — Content moderation policy and enforcement guidelines.
- `policies/spend-and-cache-policy.md` — Cost controls, caching strategy, rate limits, and usage caps.

## Diagnostics

- `diagnostics/new_chat_state_leak.md` — Diagnostic note on state leakage, detection, and mitigation steps.

## Full Directory Structure

```
docs/
├── api/
│   ├── flow-api.md
│   └── llm-api.md
├── configuration/
│   └── flags-and-models.md
├── context/
│   ├── API_ROUTES.md
│   ├── ARCHITECTURE_DECISIONS.md
│   ├── CODEBASE_OVERVIEW.md
│   ├── COMPONENTS_STRUCTURE.md
│   ├── CURRENT_ISSUES.md
│   ├── DATABASE_SCHEMA.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── ERROR_HANDLING.md
│   ├── LLM_INTEGRATION_GUIDE.md
│   ├── PERFORMANCE_OPTIMIZATION.md
│   ├── RELATIONSHIPS.md
│   ├── SECURITY_GUIDELINES.md
│   ├── SERVICES_INTEGRATIONS.md
│   ├── STATE_MANAGEMENT.md
│   ├── TESTING_STRATEGIES.md
│   ├── UTILITIES_HELPERS.md
│   └── domains/
│       ├── authentication.md
│       ├── business-logic.md
│       ├── data-flow.md
│       └── user-management.md
├── diagnostics/
│   └── new_chat_state_leak.md
├── policies/
│   ├── moderation-policy.md
│   └── spend-and-cache-policy.md
├── README.md
└── STYLE.md
```

## Recommended Reading Order (new contributors)

1. `context/CODEBASE_OVERVIEW.md`
2. `configuration/flags-and-models.md`
3. `context/API_ROUTES.md`
4. `api/flow-api.md`
5. `context/LLM_INTEGRATION_GUIDE.md`
6. `context/STATE_MANAGEMENT.md` and `context/COMPONENTS_STRUCTURE.md`
7. Domain docs under `context/domains/`
8. `context/TESTING_STRATEGIES.md` and `context/ERROR_HANDLING.md`
9. `policies/spend-and-cache-policy.md` and `policies/moderation-policy.md`
10. `context/DEPLOYMENT_GUIDE.md` and `context/SECURITY_GUIDELINES.md`
11. `context/CURRENT_ISSUES.md`

## Missing or Nice‑to‑Have Documentation

- Contribution guide (how to open PRs, branch strategy, code review expectations)
- Release/process guide (versioning, CHANGELOG, tagging, environments)
- Security threat model (deep‑dive beyond guidelines)
- Observability/runbook (logs, metrics, tracing, troubleshooting in prod)
- Glossary (domain vocabulary and recurring terms)

## Notes

- This directory is for permanent, long‑term reference documentation.
- Component‑specific README files live alongside the components in the codebase.
- Follow `STYLE.md` when adding or updating docs.
