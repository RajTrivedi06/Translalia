# Documentation Directory

This directory contains all permanent documentation for the Metamorphs project.

## Structure

```
docs/
├── api/                    # API documentation
│   ├── flow-api.md
│   └── llm-api.md
├── configuration/          # Configuration guides
│   └── flags-and-models.md
├── context/                # Architectural & system documentation
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
│   └── domains/           # Domain-specific documentation
│       ├── authentication.md
│       ├── business-logic.md
│       ├── data-flow.md
│       └── user-management.md
├── diagnostics/            # Diagnostic reports
│   └── new_chat_state_leak.md
└── policies/               # Policy documentation
    ├── moderation-policy.md
    └── spend-and-cache-policy.md
```

## Documentation Categories

### Context/Architecture (`/context`)

Long-term architectural documentation covering:

- System architecture and design decisions
- Component structure and relationships
- Database schema and data models
- Deployment and operations guides
- Security and testing strategies
- Domain-specific documentation

### API Documentation (`/api`)

Reference documentation for API endpoints and integrations.

### Configuration (`/configuration`)

Guides for feature flags, model configurations, and system settings.

### Policies (`/policies`)

Project policies including moderation, spending, and caching policies.

### Diagnostics (`/diagnostics`)

Diagnostic reports and troubleshooting documentation.

## Style Guide

- `STYLE.md` - Documentation style guide and standards for writing documentation

## Notes

- All temporary session summaries, implementation reports, and phase completion docs have been removed
- This directory contains only permanent, long-term reference documentation
- Component-specific README files remain in their respective component directories
- Documentation style guide moved from `_docs/` to `docs/STYLE.md`
